// Tipos compartidos por todo el sitio.
// A medida que agreguemos secciones, iremos sumando interfaces aquí.

export interface NavLink {
  label: string;
  href: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Service {
  icon: string;
  title: string;
  description: string;
  features: string[];
}

export interface Project {
  image: string;
  images: string[];
  category: string;
  title: string;
  location: string;
  detail: string;
  description: string;
}