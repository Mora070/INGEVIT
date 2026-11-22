import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import type { NavLink } from "../../types";
import logo from "../../assets/logo-white.png";

const navLinks: NavLink[] = [
  { label: "Inicio", href: "#inicio" },
  { label: "Servicios", href: "#servicios" },
  { label: "Proyectos", href: "#proyectos" },
  { label: "Nosotros", href: "#nosotros" },
  { label: "Contacto", href: "#contacto" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    onScroll();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`fixed left-0 top-0 z-50 w-full transition-all duration-500 ${
        scrolled
          ? "border-b border-white/10 bg-ink shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl"
          : "bg-ink"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:h-24 lg:px-8">
        {/* Logo */}
        <a
          href="#inicio"
          className="relative z-50 flex shrink-0 items-center"
          aria-label="INGEVIT - Inicio"
        >
          <img
            src={logo}
            alt="INGEVIT"
            className="h-10 w-auto object-contain sm:h-11 lg:h-12"
          />
        </a>

        {/* Navegación escritorio */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative py-3 text-[13px] font-medium tracking-wide text-white/80 transition-colors duration-300 hover:text-white"
            >
              {link.label}

              <span className="absolute bottom-1 left-0 h-px w-0 bg-[#f15a24] transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Acceso al sistema */}
        <a
          href="https://app.ingevit360.com/"
          className="group hidden items-center gap-2 border border-white/30 px-5 py-3 text-[13px] font-semibold text-white transition-all duration-300 hover:border-[#f15a24] hover:bg-[#f15a24] lg:inline-flex"
        >
          Ingresar

          <ArrowUpRight
            size={16}
            strokeWidth={1.8}
            className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </a>

        {/* Botón menú móvil */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative z-50 flex h-11 w-11 items-center justify-center border border-white/20 text-white transition-colors hover:border-white/50 lg:hidden"
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X size={22} strokeWidth={1.8} />
          ) : (
            <Menu size={22} strokeWidth={1.8} />
          )}
        </button>
      </div>

      {/* Menú móvil */}
      <div
        className={`absolute left-0 top-0 w-full overflow-hidden bg-[#07111f] transition-all duration-500 lg:hidden ${
          isOpen
            ? "pointer-events-auto min-h-screen opacity-100"
            : "pointer-events-none h-0 opacity-0"
        }`}
      >
        <nav className="flex min-h-screen flex-col justify-center px-8 pb-12 pt-28">
          <p className="mb-7 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
            Navegación
          </p>

          <div className="flex flex-col">
            {navLinks.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="group flex items-center justify-between border-b border-white/10 py-5 text-2xl font-medium text-white"
              >
                <span>{link.label}</span>

                <span className="text-xs font-normal text-white/30">
                  0{index + 1}
                </span>
              </a>
            ))}
          </div>

          {/* Acceso al sistema en móvil */}
          <a
            href="https://app.ingevit360.com/"
            onClick={() => setIsOpen(false)}
            className="mt-10 inline-flex w-full items-center justify-between bg-[#f15a24] px-6 py-4 text-sm font-semibold text-white"
          >
            Ingresar

            <ArrowUpRight size={18} strokeWidth={1.8} />
          </a>

          <p className="mt-auto pt-12 text-xs leading-6 text-white/40">
            Ingeniería · Vías · Topografía
          </p>
        </nav>
      </div>
    </header>
  );
}
