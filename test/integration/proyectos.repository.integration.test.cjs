require('reflect-metadata');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const {
  getDatabaseConfig,
} = require('../../dist/database/database.config');

const {
  ProyectosRepository,
} = require('../../dist/modules/proyectos/proyectos.repository');

test('proyectos: respeta propiedad, colaboración y disponibilidad en PostgreSQL', async () => {
  const pool = new Pool(getDatabaseConfig());

  pool.on('error', () => {
    console.error(
      'Se produjo un error en una conexión ociosa de la prueba.',
    );
    process.exitCode = 1;
  });

  let client;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const repository = new ProyectosRepository({
      query(sql, values) {
        return client.query(sql, values);
      },
    });

    /**
     * Crea cuentas ficticias con una identidad Google de prueba
     * para cumplir la restricción de autenticación de la tabla.
     *
     * No inicia sesión ni contacta con Google.
     */
    async function crearUsuario(rol = 'USUARIO') {
      const identificador = randomUUID();

      const result = await client.query(
        `
          INSERT INTO obra.usuarios (
            correo,
            google_sub,
            rol,
            estado
          )
          VALUES (
            $1,
            $2,
            $3::obra.rol_usuario,
            'ACTIVO'
          )
          RETURNING id_usuario
        `,
        [
          `proyectos-${identificador}@example.test`,
          `google-ficticio-${identificador}`,
          rol,
        ],
      );

      return result.rows[0].id_usuario;
    }

    async function crearProyecto(
      idPropietario,
      estadoProyecto,
      activo = true,
    ) {
      const result = await client.query(
        `
          INSERT INTO obra.proyectos (
            id_propietario,
            nombre,
            descripcion,
            direccion,
            contratante,
            fecha_inicio,
            fecha_finalizacion,
            estado_proyecto,
            activo,
            latitud,
            longitud
          )
          VALUES (
            $1::uuid,
            $2,
            'Descripción de integración',
            'Dirección de integración',
            'Cliente de integración',
            DATE '2026-09-09',
            NULL,
            $3::obra.estado_proyecto,
            $4,
            4.7110,
            -74.0721
          )
          RETURNING id_proyecto
        `,
        [
          idPropietario,
          `Proyecto temporal ${randomUUID()}`,
          estadoProyecto,
          activo,
        ],
      );

      return result.rows[0].id_proyecto;
    }

    async function agregarColaborador(idUsuario, idProyecto) {
      await client.query(
        `
          INSERT INTO obra.usuario_proyecto (
            id_usuario,
            id_proyecto
          )
          VALUES ($1::uuid, $2::uuid)
        `,
        [idUsuario, idProyecto],
      );
    }

    async function cambiarEstadoUsuario(idUsuario, estado) {
      await client.query(
        `
          UPDATE obra.usuarios
          SET estado = $2::obra.estado_usuario
          WHERE id_usuario = $1::uuid
        `,
        [idUsuario, estado],
      );
    }

    function idsOrdenados(filas) {
      return filas.map((fila) => fila.id_proyecto).sort();
    }

    const propietario = await crearUsuario();
    const colaborador = await crearUsuario();
    const propietarioAjeno = await crearUsuario();
    const administrador = await crearUsuario('ADMINISTRADOR');

    const activo = await crearProyecto(propietario, 'ACTIVA');
    const pausado = await crearProyecto(propietario, 'PAUSA');
    const finalizado = await crearProyecto(
      propietario,
      'FINALIZADA',
    );
    const eliminado = await crearProyecto(
      propietario,
      'ACTIVA',
      false,
    );
    const ajeno = await crearProyecto(
      propietarioAjeno,
      'ACTIVA',
    );

    await agregarColaborador(colaborador, activo);
    await agregarColaborador(colaborador, eliminado);

    /**
     * El propietario no necesita esta relación.
     * La añadimos en un proyecto para comprobar que la consulta
     * no duplica resultados si también figura como colaborador.
     */
    await agregarColaborador(propietario, activo);

    // 1. El propietario ve sus proyectos disponibles en los tres estados.
    const proyectosPropietario =
      await repository.findDisponiblesByUsuario(propietario);

    assert.deepEqual(
      idsOrdenados(proyectosPropietario),
      [activo, pausado, finalizado].sort(),
    );

    assert.equal(
      proyectosPropietario.filter(
        (proyecto) => proyecto.id_proyecto === activo,
      ).length,
      1,
    );

    // Comprueba la representación real de pg y la proyección SQL.
    const filaActiva = proyectosPropietario.find(
      (proyecto) => proyecto.id_proyecto === activo,
    );

    assert.ok(filaActiva);
    assert.equal(filaActiva.fecha_inicio, '2026-09-09');
    assert.equal(filaActiva.fecha_finalizacion, null);
    assert.equal(typeof filaActiva.latitud, 'string');
    assert.equal(typeof filaActiva.longitud, 'string');
    assert.equal(Number(filaActiva.latitud), 4.711);
    assert.equal(Number(filaActiva.longitud), -74.0721);

    // 2. El colaborador solo ve el proyecto disponible donde participa.
    assert.deepEqual(
      idsOrdenados(
        await repository.findDisponiblesByUsuario(colaborador),
      ),
      [activo],
    );

    // 3. Otro propietario solo ve su propio proyecto.
    assert.deepEqual(
      idsOrdenados(
        await repository.findDisponiblesByUsuario(propietarioAjeno),
      ),
      [ajeno],
    );

    // 4. Ser administrador no concede acceso ordinario a proyectos ajenos.
    assert.deepEqual(
      await repository.findDisponiblesByUsuario(administrador),
      [],
    );

    // 5. Un usuario inexistente tampoco obtiene resultados.
    assert.deepEqual(
      await repository.findDisponiblesByUsuario(randomUUID()),
      [],
    );

    // 6. Inactivar al colaborador bloquea su acceso, no el del propietario.
    await cambiarEstadoUsuario(colaborador, 'INACTIVO');

    assert.deepEqual(
      await repository.findDisponiblesByUsuario(colaborador),
      [],
    );

    assert.deepEqual(
      idsOrdenados(
        await repository.findDisponiblesByUsuario(propietario),
      ),
      [activo, pausado, finalizado].sort(),
    );

    await cambiarEstadoUsuario(colaborador, 'ACTIVO');

    assert.deepEqual(
      idsOrdenados(
        await repository.findDisponiblesByUsuario(colaborador),
      ),
      [activo],
    );

    // Conservamos los campos de proyecto antes de inactivar al propietario.
    const antes = await client.query(
      `
        SELECT id_proyecto, estado_proyecto, activo
        FROM obra.proyectos
        WHERE id_propietario = $1::uuid
        ORDER BY id_proyecto
      `,
      [propietario],
    );

    // 7. El propietario inactivo bloquea también el acceso del colaborador.
    await cambiarEstadoUsuario(propietario, 'INACTIVO');

    assert.deepEqual(
      await repository.findDisponiblesByUsuario(propietario),
      [],
    );
    assert.deepEqual(
      await repository.findDisponiblesByUsuario(colaborador),
      [],
    );

    const despues = await client.query(
      `
        SELECT id_proyecto, estado_proyecto, activo
        FROM obra.proyectos
        WHERE id_propietario = $1::uuid
        ORDER BY id_proyecto
      `,
      [propietario],
    );

    assert.deepEqual(despues.rows, antes.rows);

    // 8. Reactivarlo recupera el acceso sin restaurar proyectos eliminados.
    await cambiarEstadoUsuario(propietario, 'ACTIVO');

    assert.deepEqual(
      idsOrdenados(
        await repository.findDisponiblesByUsuario(propietario),
      ),
      [activo, pausado, finalizado].sort(),
    );

    assert.deepEqual(
      idsOrdenados(
        await repository.findDisponiblesByUsuario(colaborador),
      ),
      [activo],
    );

    // 9. Paginación real para el propietario.
    //
    // Los tres proyectos tienen la misma fecha de inicio.
    // Por tanto, el desempate debe realizarse por UUID ascendente.
    const idsEsperados = [activo, pausado, finalizado].sort();

    const primeraPagina =
      await repository.findDisponiblesPaginadosByUsuario(
        propietario,
        1,
        2,
      );

    assert.equal(primeraPagina.total, 3);

    // No ordenamos el resultado: comprobamos el orden real del SQL.
    assert.deepEqual(
      primeraPagina.proyectos.map((proyecto) => proyecto.id_proyecto),
      idsEsperados.slice(0, 2),
    );

    const segundaPagina =
      await repository.findDisponiblesPaginadosByUsuario(
        propietario,
        2,
        2,
      );

    assert.equal(segundaPagina.total, 3);
    assert.deepEqual(
      segundaPagina.proyectos.map((proyecto) => proyecto.id_proyecto),
      idsEsperados.slice(2),
    );

    // Las páginas no deben repetir ni omitir proyectos en estos datos estables.
    assert.deepEqual(
      [...primeraPagina.proyectos, ...segundaPagina.proyectos].map(
        (proyecto) => proyecto.id_proyecto,
      ),
      idsEsperados,
    );

    // 10. Una página posterior al final conserva el total.
    const paginaFueraDeRango =
      await repository.findDisponiblesPaginadosByUsuario(
        propietario,
        3,
        2,
      );

    assert.deepEqual(paginaFueraDeRango, {
      proyectos: [],
      total: 3,
    });

    // 11. La proyección conserva fechas y coordenadas para el mapper.
    const proyectoPaginado = primeraPagina.proyectos[0];

    assert.equal(proyectoPaginado.fecha_inicio, '2026-09-09');
    assert.equal(proyectoPaginado.fecha_finalizacion, null);
    assert.equal(typeof proyectoPaginado.latitud, 'string');
    assert.equal(typeof proyectoPaginado.longitud, 'string');
    assert.equal(Object.hasOwn(proyectoPaginado, 'total'), false);

    // 12. El conteo del colaborador incluye solo sus proyectos accesibles.
    // El proyecto eliminado donde también participa no debe contarse.
    const paginaColaborador =
      await repository.findDisponiblesPaginadosByUsuario(
        colaborador,
        1,
        20,
      );

    assert.equal(paginaColaborador.total, 1);
    assert.deepEqual(
      paginaColaborador.proyectos.map((proyecto) => proyecto.id_proyecto),
      [activo],
    );

    // 13. Un administrador sin relación y un usuario inexistente obtienen cero.
    for (const idUsuario of [administrador, randomUUID()]) {
      const paginaSinAcceso =
        await repository.findDisponiblesPaginadosByUsuario(
          idUsuario,
          1,
          20,
        );

      assert.deepEqual(paginaSinAcceso, {
        proyectos: [],
        total: 0,
      });
    }

    // 14. Inactivar al colaborador elimina también su conteo accesible.
    await cambiarEstadoUsuario(colaborador, 'INACTIVO');

    assert.deepEqual(
      await repository.findDisponiblesPaginadosByUsuario(
        colaborador,
        1,
        20,
      ),
      { proyectos: [], total: 0 },
    );

    await cambiarEstadoUsuario(colaborador, 'ACTIVO');

    // 15. Inactivar al propietario bloquea listado y conteo para ambos.
    await cambiarEstadoUsuario(propietario, 'INACTIVO');

    for (const idUsuario of [propietario, colaborador]) {
      assert.deepEqual(
        await repository.findDisponiblesPaginadosByUsuario(
          idUsuario,
          1,
          20,
        ),
        { proyectos: [], total: 0 },
      );
    }

    await cambiarEstadoUsuario(propietario, 'ACTIVO');

    // 16. La fecha de inicio tiene prioridad sobre el desempate por UUID.
    const proyectoMasReciente = idsEsperados[2];

    await client.query(
      `
    UPDATE obra.proyectos
    SET fecha_inicio = DATE '2026-09-10'
    WHERE id_proyecto = $1::uuid
  `,
      [proyectoMasReciente],
    );

    const paginaPorFecha =
      await repository.findDisponiblesPaginadosByUsuario(
        propietario,
        1,
        2,
      );

    assert.equal(paginaPorFecha.total, 3);
    assert.deepEqual(
      paginaPorFecha.proyectos.map((proyecto) => proyecto.id_proyecto),
      [proyectoMasReciente, idsEsperados[0]],
    );

    // 17. El propietario puede consultar el detalle de sus proyectos disponibles.
    for (const idProyecto of [activo, pausado, finalizado]) {
      const detalle = await repository.findDisponibleById(
        idProyecto,
        propietario,
      );

      assert.ok(detalle);
      assert.equal(detalle.id_proyecto, idProyecto);
      assert.equal(detalle.id_propietario, propietario);
    }

    // 18. El colaborador accede al proyecto donde participa.
    const detalleColaborador = await repository.findDisponibleById(
      activo,
      colaborador,
    );

    assert.ok(detalleColaborador);
    assert.equal(detalleColaborador.id_proyecto, activo);

    // 19. Conocer el UUID no permite acceder a proyectos ajenos.
    for (const [idProyecto, idUsuario] of [
      [ajeno, propietario],
      [pausado, colaborador],
      [activo, propietarioAjeno],
      [activo, administrador],
    ]) {
      assert.equal(
        await repository.findDisponibleById(idProyecto, idUsuario),
        null,
      );
    }

    // 20. La eliminación lógica bloquea también el detalle.
    for (const idUsuario of [propietario, colaborador]) {
      assert.equal(
        await repository.findDisponibleById(eliminado, idUsuario),
        null,
      );
    }

    // 21. Un proyecto o solicitante inexistente no obtiene resultados.
    assert.equal(
      await repository.findDisponibleById(randomUUID(), propietario),
      null,
    );

    assert.equal(
      await repository.findDisponibleById(activo, randomUUID()),
      null,
    );

    // 22. Un colaborador inactivo pierde acceso al detalle.
    await cambiarEstadoUsuario(colaborador, 'INACTIVO');

    assert.equal(
      await repository.findDisponibleById(activo, colaborador),
      null,
    );

    await cambiarEstadoUsuario(colaborador, 'ACTIVO');

    // 23. Inactivar al propietario bloquea el detalle para ambos.
    await cambiarEstadoUsuario(propietario, 'INACTIVO');

    for (const idUsuario of [propietario, colaborador]) {
      assert.equal(
        await repository.findDisponibleById(activo, idUsuario),
        null,
      );
    }

    // 24. Reactivar al propietario recupera el acceso.
    await cambiarEstadoUsuario(propietario, 'ACTIVO');

    for (const idUsuario of [propietario, colaborador]) {
      const detalle = await repository.findDisponibleById(
        activo,
        idUsuario,
      );

      assert.ok(detalle);
      assert.equal(detalle.id_proyecto, activo);
    }

  } finally {
    try {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release(true);
        }
      }
    } finally {
      await pool.end();
    }
  }
});