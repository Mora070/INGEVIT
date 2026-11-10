"""Pruebas pequeñas con Rasterio real; no necesitan PostgreSQL ni el original."""
import errno
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import ColorInterp
from rasterio.transform import from_bounds

from procesar_geotiff import procesar, Rechazo, transformacion, overview_para_zoom


class ProcesadorTest(unittest.TestCase):
    def test_inspeccion_no_crea_salida_y_respeta_zoom_efectivo(self):
        salida = self.raiz / 'inspeccion'
        plan = procesar(self.original, salida, 12, 22, 1, inspect_only=True)
        self.assertEqual(plan['zoom_max'], 12)
        self.assertEqual(plan['zoom_max_solicitado'], 22)
        self.assertFalse(salida.exists())

    def test_rgba_piramides_alineacion_y_alpha_parcial(self):
        original = self.raiz / 'rgba.tif'
        t = transformacion(154050, 255400, 19)
        # Dos teselas XYZ exactas, fuente cuatro veces más fina.
        with rasterio.open(original, 'w', driver='GTiff', width=2048, height=1024,
                           count=4, dtype='uint8', crs='EPSG:3857',
                           transform=t * rasterio.Affine.scale(0.25, 0.25),
                           tiled=True, blockxsize=256, blockysize=256) as dst:
            datos = np.empty((4, 1024, 2048), dtype='uint8')
            datos[0], datos[1], datos[2], datos[3] = 40, 100, 180, 128
            datos[3, :, :512] = 0
            dst.write(datos)
            dst.colorinterp = (ColorInterp.red, ColorInterp.green, ColorInterp.blue, ColorInterp.alpha)
            dst.build_overviews([2, 4, 8], rasterio.enums.Resampling.average)
        with rasterio.open(original) as src:
            self.assertEqual(overview_para_zoom(src, (1, 2, 3), 4, 19), 0)
            self.assertIsNone(overview_para_zoom(src, (1, 2, 3), 4, 22))
        salida = self.raiz / 'rgba-tiles'
        procesar(original, salida, 19, 19, 20)
        with Image.open(salida / '19/154050/255400.png') as imagen:
            datos = np.array(imagen)
            self.assertEqual(int(datos[128, 32, 3]), 0)
            np.testing.assert_allclose(datos[128, 200], [40, 100, 180, 128], atol=1)
        with Image.open(salida / '19/154051/255400.png') as imagen:
            datos = np.array(imagen)
            np.testing.assert_allclose(datos[128, 128], [40, 100, 180, 128], atol=1)

    def test_grises_sin_piramides_se_convierten_a_rgba(self):
        original = self.raiz / 'gris.tif'
        with rasterio.open(original, 'w', driver='GTiff', width=256, height=256,
                           count=1, dtype='uint8', crs='EPSG:3857',
                           transform=transformacion(154050, 255400, 19)) as dst:
            dst.write(np.full((1, 256, 256), 90, dtype='uint8'))
            dst.colorinterp = (ColorInterp.gray,)
        salida = self.raiz / 'gris-tiles'
        procesar(original, salida, 19, 19, 20)
        with Image.open(salida / '19/154050/255400.png') as imagen:
            np.testing.assert_array_equal(np.array(imagen)[128, 128], [90, 90, 90, 255])

    def setUp(self):
        self.temporal = tempfile.TemporaryDirectory(
            prefix='ingevit-rasterio-test-'
        )
        self.addCleanup(self.temporal.cleanup)

        self.raiz = Path(self.temporal.name)
        self.original = self.raiz / 'original.tif'

        with rasterio.open(
            self.original,
            'w',
            driver='GTiff',
            width=32,
            height=32,
            count=3,
            dtype='uint8',
            crs='EPSG:4326',
            transform=from_bounds(
                -74.22010,
                4.62210,
                -74.22008,
                4.62212,
                32,
                32,
            ),
        ) as dst:
            dst.write(
                np.full(
                    (3, 32, 32),
                    80,
                    dtype='uint8',
                )
            )

            dst.colorinterp = (
                ColorInterp.red,
                ColorInterp.green,
                ColorInterp.blue,
            )

    def test_zoom_22_conserva_original_y_transparencia(self):
        antes = hashlib.sha256(
            self.original.read_bytes()
        ).digest()

        salida = self.raiz / 'teselas'

        resultado = procesar(
            self.original,
            salida,
            22,
            22,
            100,
        )

        archivos = list(
            salida.glob('22/*/*.png')
        )

        self.assertEqual(
            len(archivos),
            resultado['total'],
        )

        self.assertEqual(
            hashlib.sha256(
                self.original.read_bytes()
            ).digest(),
            antes,
        )

        visible = False
        transparente = False

        for archivo in archivos:
            with Image.open(archivo) as imagen:
                self.assertEqual(
                    imagen.size,
                    (256, 256),
                )

                self.assertEqual(
                    imagen.mode,
                    'RGBA',
                )

                alpha = np.array(imagen)[:, :, 3]

                visible |= bool(
                    np.any(alpha > 0)
                )

                transparente |= bool(
                    np.any(alpha == 0)
                )

        self.assertTrue(visible)
        self.assertTrue(transparente)

    def test_presupuesto_rechaza_antes_de_crear_salida(self):
        salida = self.raiz / 'teselas'

        with self.assertRaises(Rechazo) as captura:
            procesar(
                self.original,
                salida,
                22,
                22,
                1,
            )

        self.assertEqual(
            captura.exception.codigo,
            'LIMITE_TESELAS',
        )

        self.assertFalse(salida.exists())

    def test_no_sobrescribe_una_salida_existente(self):
        salida = self.raiz / 'existente'
        salida.mkdir()

        testigo = salida / 'testigo.txt'

        testigo.write_text(
            'conservar',
            encoding='utf-8',
        )

        with self.assertRaises(Rechazo):
            procesar(
                self.original,
                salida,
                22,
                22,
                100,
            )

        self.assertEqual(
            testigo.read_text(
                encoding='utf-8'
            ),
            'conservar',
        )

    def test_limite_de_bytes_interrumpe_el_intento(self):
        salida = self.raiz / 'teselas'

        with self.assertRaises(Rechazo) as captura:
            procesar(
                self.original,
                salida,
                22,
                22,
                100,
                max_bytes=1,
            )

        self.assertEqual(
            captura.exception.codigo,
            'LIMITE_DISCO',
        )

        # NestJS elimina el intento provisional en su bloque finally.
        self.assertTrue(salida.exists())

    def test_acepta_presupuesto_exacto_de_bytes_y_conserva_original(self):
        """El presupuesto admite igualdad; no rechaza el último byte válido."""
        antes = hashlib.sha256(
            self.original.read_bytes()
        ).digest()

        referencia = procesar(
            self.original,
            self.raiz / 'referencia',
            22,
            22,
            100,
        )

        resultado = procesar(
            self.original,
            self.raiz / 'presupuesto_exacto',
            22,
            22,
            100,
            max_bytes=referencia['bytes'],
        )

        self.assertEqual(
            resultado['bytes'],
            referencia['bytes'],
        )

        self.assertEqual(
            resultado['total'],
            referencia['total'],
        )

        self.assertEqual(
            hashlib.sha256(
                self.original.read_bytes()
            ).digest(),
            antes,
        )

    def test_fallo_de_escritura_por_espacio_conserva_original(self):
        """Simula disco lleno sin llenar el disco real del equipo."""
        antes = hashlib.sha256(
            self.original.read_bytes()
        ).digest()

        salida = self.raiz / 'sin_espacio'

        with patch.object(
            Image.Image,
            'save',
            side_effect=OSError(
                errno.ENOSPC,
                'Sin espacio disponible',
            ),
        ):
            with self.assertRaises(OSError) as captura:
                procesar(
                    self.original,
                    salida,
                    22,
                    22,
                    100,
                )

        self.assertEqual(
            captura.exception.errno,
            errno.ENOSPC,
        )

        self.assertEqual(
            hashlib.sha256(
                self.original.read_bytes()
            ).digest(),
            antes,
        )

        self.assertEqual(
            list(salida.rglob('*.png')),
            [],
        )


if __name__ == '__main__':
    unittest.main()
