import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { ApiError } from '../../../shared/api/http';

import {
  listarProyectos,
} from '../api/proyectos.api';

import type {
  Proyecto,
  ProyectosPaginados,
} from '../types/proyecto';

interface EstadoProyectos {
  cargando: boolean;
  proyectos: Proyecto[];

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
) {
  const [
    estado,
    setEstado,
  ] = useState<EstadoProyectos>({
    ...ESTADO_INICIAL,
    pagina,
    limite,
  });

  const cargar =
    useCallback(async () => {
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
          });

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

          error: mensaje,
        }));
      }
    }, [pagina, limite]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return {
    ...estado,

    recargar:
      cargar,
  };
}