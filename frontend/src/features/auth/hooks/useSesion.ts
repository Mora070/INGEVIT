import { useCallback, useEffect, useState } from 'react';
import { consultarSesion } from '../api/auth.api';
import type { Usuario } from '../types/usuario';

type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'anonima' }
  | { tipo: 'autenticada'; usuario: Usuario }
  | { tipo: 'error' };

/**
 * Mantiene el perfil en memoria, nunca la credencial.
 * Al recargar la aplicación, consulta nuevamente la cookie al backend.
 */
export function useSesion() {
  const [estado, setEstado] = useState<EstadoSesion>({
    tipo: 'cargando',
  });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    consultarSesion(controller.signal)
      .then((usuario) => {
        if (controller.signal.aborted) return;

        setEstado(
          usuario
            ? { tipo: 'autenticada', usuario }
            : { tipo: 'anonima' },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEstado({ tipo: 'error' });
        }
      });

    // También evita aplicar respuestas de una ejecución anterior.
    return () => controller.abort();
  }, [intento]);

  const actualizarUsuario = useCallback((usuario: Usuario | null) => {
    setEstado(
      usuario
        ? { tipo: 'autenticada', usuario }
        : { tipo: 'anonima' },
    );
  }, []);

  const reintentar = useCallback(() => {
    setEstado({ tipo: 'cargando' });
    setIntento((anterior) => anterior + 1);
  }, []);

  return { estado, actualizarUsuario, reintentar };
}