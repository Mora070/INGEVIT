import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ApiError } from '../../../shared/api/http';

import {
  listarProyectos,
} from '../api/proyectos.api';

import type {
  ProyectoListado,
  ProyectosPaginados,
} from '../types/proyecto';

interface EstadoProyectos {
  cargando: boolean;
  proyectos: ProyectoListado[];

  pagina: number;
  limite: number;

  total: number;
  totalPaginas: number;

  error: string | null;
}

const ESTADO_INICIAL: EstadoProyectos = {
  cargando: true,
  proyectos: [],

  pagina: 1,
  limite: 20,

  total: 0,
  totalPaginas: 0,

  error: null,
};

export function useProyectos(
  pagina = 1,
  limite = 20,
  busqueda = '',
) {
  const [
    estado,
    setEstado,
  ] = useState<EstadoProyectos>({
    ...ESTADO_INICIAL,
    pagina,
    limite,
  });

  const idPeticionRef =
    useRef(0);

  const cargar =
    useCallback(async () => {
      const idPeticion =
        idPeticionRef.current + 1;

      idPeticionRef.current =
        idPeticion;

      setEstado((actual) => ({
        ...actual,
        cargando: true,
        error: null,
      }));

      try {
        const respuesta: ProyectosPaginados =
          await listarProyectos({
            pagina,
            limite,
            busqueda,
          });

        /*
         * Si mientras esta petición estaba pendiente
         * se inició otra más reciente, ignoramos
         * completamente esta respuesta.
         */
        if (
          idPeticion !==
          idPeticionRef.current
        ) {
          return;
        }

        setEstado({
          cargando: false,

          proyectos:
            respuesta.proyectos,

          pagina:
            respuesta.pagina,

          limite:
            respuesta.limite,

          total:
            respuesta.total,

          totalPaginas:
            respuesta.total_paginas,

          error: null,
        });
      } catch (error) {
        /*
         * También ignoramos errores pertenecientes
         * a una petición antigua.
         */
        if (
          idPeticion !==
          idPeticionRef.current
        ) {
          return;
        }

        let mensaje =
          'No fue posible cargar los proyectos.';

        if (error instanceof ApiError) {
          mensaje =
            error.message;
        }

        setEstado((actual) => ({
          ...actual,

          cargando: false,
          proyectos: [],

          total: 0,
          totalPaginas: 0,

          error: mensaje,
        }));
      }
    }, [
      pagina,
      limite,
      busqueda,
    ]);

  useEffect(() => {
    void cargar();

    return () => {
      /*
       * Invalida la petición actual cuando cambian
       * los parámetros o se desmonta el componente.
       */
      idPeticionRef.current += 1;
    };
  }, [
    cargar,
  ]);

  return {
    ...estado,

    recargar:
      cargar,
  };
}