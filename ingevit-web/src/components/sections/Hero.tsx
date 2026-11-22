export default function Hero() {
  return (
    <section id="inicio" className="hero-intro relative isolate overflow-hidden">
      <video className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center" autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
        <source src="/videos/hero-ingevi.mp4" type="video/mp4" />
      </video>
      <div aria-hidden="true" className="hero-wash pointer-events-none absolute inset-0" />
      <div className="site-container relative z-10">
        <div className="hero-copy max-w-[650px]">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-accent" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-warm sm:text-xs">INGEVIT · Colombia</p>
          </div>
          <h1 className="text-4xl font-semibold leading-[1.02] tracking-[-0.025em] text-ink sm:text-5xl lg:text-6xl">
            Ingeniería, tecnología y precisión al servicio de la infraestructura.
          </h1>
          <p className="mt-5 max-w-[510px] text-sm leading-7 text-muted-warm sm:text-base">
            Desde 2023 trabajamos en levantamientos topográficos, obras viales y construcción. Acompañamos la planeación, ejecución y seguimiento de proyectos en Colombia.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="#servicios" className="inline-flex min-h-12 items-center justify-center rounded-sm bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-dark">Conocer servicios</a>
            <a href="#proyectos" className="group inline-flex min-h-12 items-center justify-center gap-3 border border-ink/20 bg-paper/75 px-6 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent">
              Ver proyectos<span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
