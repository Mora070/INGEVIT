
import SystemShowcase from "./SystemShowcase";

import equipoIngevit from "../../assets/equipo-ingevit.jpg";

const systemVideo = {
  src: import.meta.env.VITE_SYSTEM_VIDEO_URL || "/videos/hero-ingevi.mp4",
  provisional: !import.meta.env.VITE_SYSTEM_VIDEO_URL,
};

export default function AboutUs() {
  return (
    <section id="nosotros" className="site-section">
      <div className="site-container">

        {/* =====================================================
            ENCABEZADO
        ===================================================== */}

        <div className="border-b border-line-light pb-8">

          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-accent" />

            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-warm">
              Nosotros
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-end">

            <h2 className="max-w-[650px] text-ink">
              Construimos soluciones que impulsan proyectos.
            </h2>

            <p className="max-w-[440px] text-sm leading-7 text-muted-warm lg:justify-self-end">
              Ingeniería, tecnología e innovación al servicio de la
              infraestructura y la construcción.
            </p>

          </div>

          {/* =====================================================
              IMAGEN + HISTORIA
          ===================================================== */}

          <div className="mt-9 grid gap-6 lg:grid-cols-[1.35fr_0.85fr] lg:gap-8">

            {/* FOTOGRAFÍA DEL EQUIPO */}

            <div className="flex flex-col">

              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                <img
                  data-motion="team"
                  src={equipoIngevit}
                  alt="Equipo de trabajo INGEVIT"
                  className="h-full w-full object-cover object-center"
                />

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>

              <div className="mt-4 flex items-center justify-between">

                <div className="flex items-center gap-3">
                  <span className="h-px w-7 bg-accent" />

                  <span className="font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-muted-warm">
                    Nuestro equipo
                  </span>
                </div>

                <span className="font-mono text-[10px] tracking-wider text-muted-warm">
                  INGEVIT
                </span>

              </div>

            </div>

            {/* HISTORIA DE LA EMPRESA */}

            <div className="flex flex-col justify-between self-start rounded-xl border border-line-light bg-surface p-6 sm:p-8 lg:aspect-[5/6]">

              <div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-accent">
                    2023
                  </span>

                  <span className="h-px w-6 bg-line-light" />

                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-warm">
                    Nuestra historia
                  </span>
                </div>

                <h3 className="mt-7 text-2xl leading-tight text-ink">
                  Una visión de ingeniería que evoluciona con la tecnología.
                </h3>

                <p className="mt-5 text-sm leading-7 text-muted-warm">
                  INGEVIT nació en 2023 con el propósito de integrar
                  ingeniería, tecnología e innovación en el desarrollo
                  de proyectos de infraestructura y construcción,
                  ofreciendo soluciones eficientes y confiables.
                </p>

              </div>

              {/* FUNDADOR */}

              <div className="mt-10 border-t border-line-light pt-6">

                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-warm">
                  Fundador y propietario
                </p>

                <h4 className="mt-3 text-base font-semibold text-ink">
                  JHON FREDY BONILLA ARIAS
                </h4>

                <div className="mt-5 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />

                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-warm">
                    Desde 2023
                  </span>
                </div>

              </div>

            </div>

          </div>

          {/* =====================================================
              MISIÓN Y VISIÓN
          ===================================================== */}

          <div className="mt-12 grid gap-5 md:grid-cols-2">

            {/* MISIÓN */}

            <div className="rounded-xl border border-line-light bg-surface p-6 sm:p-7">

              <div className="mb-5 flex items-center gap-3">
                <span className="font-mono text-[10px] text-accent">
                  01
                </span>

                <span className="h-px w-6 bg-line-light" />

                <h3 className="text-lg text-ink">
                  Nuestra misión
                </h3>
              </div>

              <p className="text-sm leading-7 text-muted-warm">
                Ofrecer soluciones integrales de ingeniería, diseño y
                topografía, combinando conocimiento técnico y tecnología
                para desarrollar proyectos con calidad, precisión y
                eficiencia.
              </p>

            </div>

            {/* VISIÓN */}

            <div className="rounded-xl border border-line-light bg-surface p-6 sm:p-7">

              <div className="mb-5 flex items-center gap-3">
                <span className="font-mono text-[10px] text-accent">
                  02
                </span>

                <span className="h-px w-6 bg-line-light" />

                <h3 className="text-lg text-ink">
                  Nuestra visión · 2030
                </h3>
              </div>

              <p className="text-sm leading-7 text-muted-warm">
                Consolidarnos como una empresa reconocida en Colombia
                por nuestra excelencia técnica e innovación, integrando
                BIM, fotogrametría, drones y soluciones digitales para
                transformar el desarrollo de proyectos.
              </p>

            </div>

          </div>

        </div>

        {/* =====================================================
            TECNOLOGÍA INGEVIT
        ===================================================== */}

        <SystemShowcase
          src={systemVideo.src}
          provisional={systemVideo.provisional}
        />

      </div>
    </section>
  );
}
