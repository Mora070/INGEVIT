import type { Project } from "../types";

/* =========================================================
   PORTADAS DE LOS PROYECTOS
========================================================= */

import avSantaFe from "../assets/projects-AVSTF.JPG";
import parqueCusezar from "../assets/projects-parquecusezar.JPG";
import viscaya from "../assets/projects-VISCAYA.JPG";

/* =========================================================
   GALERÍA — AV. SANTA FE
========================================================= */

import avSantaFe1 from "../assets/card-1.JPG";
import avSantaFe2 from "../assets/card-1.1.JPG";
import avSantaFe3 from "../assets/card-1.2.JPG";

/* =========================================================
   GALERÍA — PARQUE LA MARLENE CUSEZAR
========================================================= */

import parqueCusezar1 from "../assets/card-2.JPG";
import parqueCusezar2 from "../assets/card-2.1.JPG";
import parqueCusezar3 from "../assets/card-2.2.JPG";

/* =========================================================
   GALERÍA — VISCAYA
========================================================= */

import viscaya1 from "../assets/card-3.JPG";
import viscaya2 from "../assets/card-3.1.JPG";
import viscaya3 from "../assets/card-3.2.JPG";

/* =========================================================
   PROYECTOS
========================================================= */

export const projects: Project[] = [
  {
    image: avSantaFe,

    images: [
      avSantaFe1,
      avSantaFe2,
      avSantaFe3,
    ],

    category: "Vías y Pavimentos",
    title: "Av. Santa Fe",
    location: "Bogotá, Colombia",
    detail: "2 Km Intervenidos",

    description:
      "Entrega de proyecto al instituto de desarrollo urbano convenio IDU186-2023 2 kilómetros de vía, ubicación bosa san Bernardino. ",
  },

  {
    image: parqueCusezar,

    images: [
      parqueCusezar1,
      parqueCusezar2,
      parqueCusezar3,
    ],

    category: "Topografía y Geodesia",
    title: "Parque La Marlene Cusezar",
    location: "Bogotá, Colombia",
    detail: "500 Hectáreas",

    description:
      "Seguimiento a obras de infraestructura, urbanismo parques la marlene, ubicacion bosa san Bernardino.",
  },

  {
    image: viscaya,

    images: [
      viscaya1,
      viscaya2,
      viscaya3,
    ],

    category: "Ingeniería Civil",
    title: "Viscaya",
    location: "Cundinamarca, Colombia",
    detail: "3.5 Km Intervenidos",

    description:
      "Seguimiento a obras de infraestructura, vías y urbanismo para el proyecto Vizcaya lagos de torca urbanismo la concordia.",
  },
];
