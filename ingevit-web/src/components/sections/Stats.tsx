import type { Stat } from "../../types";

const stats: Stat[] = [
  { value: "Desde 2023", label: "Experiencia en campo" },
  { value: "Ingeniería Civil", label: "Infraestructura y construcción" },
  { value: "Topografía", label: "GNSS, drones y modelado del terreno" },
  { value: "Tecnología Propia", label: "Gestión y seguimiento de proyectos" },
];

export default function Stats() {
  return (
    <section id="capacidades" aria-label="Capacidades y experiencia INGEVIT" className="py-5 sm:py-7">
      <div className="site-container">
        <dl className="grid grid-cols-1 border-y border-line-light sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              data-reveal-delay={index * 70}
              className="border-b border-line-light bg-paper/70 px-4 py-5 text-center last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <dt className="font-display text-2xl font-semibold leading-tight">
                <span className={index === 0 ? "text-accent" : "text-ink"}>
                  {stat.value}
                </span>
              </dt>
              <dd className="mt-2 text-xs leading-5 text-muted-warm sm:text-[13px]">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}