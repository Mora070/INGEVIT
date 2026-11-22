import {
  ArrowRight,
  Building2,
  Cpu,
  MapPinned,
  Route,
} from "lucide-react";

import servicePrincipal from "../../assets/service-principal.jpg";
import serviceCivil from "../../assets/service-civil.jpg";
import servicesRoad from "../../assets/services-road.jpg";
import serviceTopografia from "../../assets/service-topografia.jpg";
import serviceConstruccion from "../../assets/logo360.jpeg";


/* =========================================================
   SERVICIOS
========================================================= */

const services = [
  {
    number: "01",
    title: "Ingeniería Civil",
    description:
      "Diseño y desarrollo de proyectos de infraestructura.",
    image: serviceCivil,
    icon: Building2,
  },
  {
    number: "02",
    title: "Vías y Pavimentos",
    description:
      "Planificación, diseño y control de obras viales y pavimentos.",
    image: servicesRoad,
    icon: Route,
  },
  {
    number: "03",
    title: "Topografía de Precisión",
    description:
      "Levantamiento topográfico con tecnología GNSS, drones y modelado digital del terreno.",
    image: serviceTopografia,
    icon: MapPinned,
  },
  {
    number: "04",
    title: "Tecnología y sistema",
    description:
      "Ejecución y control de obras con tecnología propia para la gestión y seguimiento de proyectos. ",
    image: serviceConstruccion,
    icon: Cpu,
  },
];




/* =========================================================
   COMPONENTE
========================================================= */

export default function Services() {
  return (
    <section id="servicios" className="site-section">
      <div className="site-container">
        <div className="grid items-center gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <div className="lg:pb-20">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-8 bg-accent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-warm">Servicios</span>
            </div>
            <h2 className="text-ink">Servicios de ingeniería</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-warm sm:text-[15px]">
              Trabajamos en ingeniería civil, vías, topografía y construcción. Estas son las áreas en las que podemos apoyar su obra.
            </p>
          </div>
          <div
            className="relative aspect-[16/10] overflow-hidden rounded-[30px] lg:aspect-[16/11]"
            style={{
              clipPath:
                "polygon(22% 0%, 100% 0%, 100% 100%, 8% 100%, 3% 96%, 0% 88%, 0% 63%)",
            }}
          >
            <img data-motion="photo" src={servicePrincipal} alt="Proyecto de infraestructura INGEVIT" className="h-full w-full object-cover object-center" />
          </div>
        </div>
        <div className="service-grid relative z-10 -mt-8 grid gap-x-6 gap-y-7 bg-paper px-4 pt-5 sm:grid-cols-2 sm:px-5 lg:-mt-16 lg:grid-cols-4 lg:px-6 lg:pt-6">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <article data-motion="rise" key={service.number} data-reveal-delay={index * 70} className="service-item group flex flex-col border-b border-line-light pb-5 lg:border-b-0 lg:border-r lg:pr-6 lg:last:border-r-0">                <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs text-accent">{service.number}</span>
                <Icon size={22} strokeWidth={1.65} className="service-icon text-accent" />
              </div>
                <div className="aspect-[3/2] overflow-hidden rounded-[16px] bg-white">
                  <img
                    src={service.image}
                    alt={service.title}
                    className={`h-full w-full ${service.number === "04"
                      ? "object-contain p-2"
                      : "object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                      }`}
                  />
                </div>
                <h3 className="mt-4 text-xl leading-tight text-ink">{service.title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-muted-warm">{service.description}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-4 border-t border-line-light pt-5">
          <a href="#proyectos" className="inline-flex items-center gap-3 text-sm font-medium text-ink transition-colors hover:text-accent">Ver proyectos<ArrowRight size={17} strokeWidth={1.8} /></a>
        </div>
      </div>
    </section>
  );
}
