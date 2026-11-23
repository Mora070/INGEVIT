import { ArrowUp, ArrowUpRight, Mail } from "lucide-react";
import logoWhite from "../../assets/logo-white.png";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-ink text-white">
      <div aria-hidden="true" className="absolute left-1/2 top-0 h-0.5 w-16 -translate-x-1/2 bg-accent" />
      <div className="site-container py-8 lg:py-10">
        <div className="grid items-center gap-7 border-b border-white/15 pb-7 md:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
            <a href="#inicio" className="inline-flex items-center" aria-label="INGEVIT - Ir al inicio">
              <img src={logoWhite} alt="INGEVIT" className="h-12 w-auto object-contain sm:h-14" />
            </a>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">
              Ingeniería, topografía e infraestructura para el desarrollo
              de proyectos en Colombia.
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-center border-t border-white/10 pt-6 text-center md:items-start md:border-l md:border-t-0 md:pl-10 md:pt-0 md:text-left lg:pl-12">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">Trayectoria INGEVIT</p>
            <h3 className="mt-3 max-w-md text-3xl leading-tight text-white sm:text-4xl">Ingeniería con experiencia desde 2023.</h3>
            <a href="mailto:ingevit77@gmail.com" className="mt-3 inline-flex max-w-full items-center gap-2.5 text-sm text-white/85 transition-colors hover:text-accent">
              <Mail size={16} strokeWidth={1.6} className="shrink-0 text-accent" />
              <span className="break-all">ingevit77@gmail.com</span>
            </a>
            <a href="#nosotros" className="group mt-5 flex w-fit items-center gap-3 border border-accent bg-accent px-5 py-3 text-xs font-semibold text-white transition-colors hover:border-accent-dark hover:bg-accent-dark">
              Conozca INGEVIT
              <ArrowUpRight size={16} strokeWidth={1.6} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 pt-5 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left">
          <p className="text-xs leading-5 text-white/55">
            © {new Date().getFullYear()} INGEVIT. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <a href="#inicio" className="inline-flex items-center gap-2 text-xs text-white/65 transition-colors hover:text-accent">Volver arriba<ArrowUp size={14} strokeWidth={1.6} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}