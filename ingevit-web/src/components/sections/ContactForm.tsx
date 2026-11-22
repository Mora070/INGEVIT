import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Mail, Phone, Send } from "lucide-react";

interface FormData {
  nombre: string;
  correo: string;
  telefono: string;
  tipoObra: string;
  ubicacion: string;
}

const initialFormData: FormData = {
  nombre: "",
  correo: "",
  telefono: "",
  tipoObra: "",
  ubicacion: "",
};

export default function ContactForm() {
  const [formData, setFormData] =
    useState<FormData>(initialFormData);

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (status === "error") {
      setStatus("idle");
    }
  };

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          honeypot: "",
        }),
      });

      if (!response.ok) {
        throw new Error("Error en el envío");
      }

      setFormData(initialFormData);
      setStatus("success");
    } catch (error) {
      console.error(error);

      setStatus("error");
    }
  };

  return (
    <section
      id="contacto"
      className="site-section"
    >
      <div className="site-container">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-8">
          {/* =========================================
              INFORMACIÓN
          ========================================= */}
          <div>
            <div className="flex items-center gap-4">
              <span className="h-px w-9 bg-accent" />

              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-warm">
                Contacto
              </span>
            </div>

            <h2 className="mt-7 max-w-md text-ink">
              Cuéntenos qué necesita.
            </h2>

            <p className="mt-6 max-w-sm text-sm leading-7 text-muted-warm">
              Cuéntenos sobre su proyecto y nuestro equipo se pondrá
              en contacto para conocer sus requerimientos.
            </p>

            {/* Contacto directo */}
            <div className="mt-10 space-y-4">
              <a
                href="tel:+573124567890"
                className="flex w-fit items-center gap-3 text-sm text-muted-warm transition-colors hover:text-ink"
              >
                <Phone
                  size={16}
                  className="text-accent"
                />

                <span>+57 312 456 7890</span>
              </a>

              <a
                href="mailto:ingevit77@gmail.com"
                className="flex w-fit items-center gap-3 text-sm text-muted-warm transition-colors hover:text-ink"
              >
                <Mail
                  size={16}
                  className="text-accent"
                />

                <span>ingevit77@gmail.com</span>
              </a>
            </div>
          </div>

          {/* =========================================
              FORMULARIO
          ========================================= */}
          <form
            onSubmit={handleSubmit}
            className="relative overflow-hidden border border-line-light bg-paper/95 shadow-[0_16px_45px_rgba(15,27,42,0.06)]"
          >
            <span className="absolute left-0 top-0 h-1 w-28 bg-accent" />

            <div className="border-b border-line-light px-6 pb-6 pt-8 sm:px-8 lg:px-10 lg:pt-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                    Hablemos de su proyecto
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                    Solicitar información
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-warm">
                    Déjenos sus datos y nuestro equipo se pondrá en contacto.
                  </p>
                </div>
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent sm:inline-flex">
                  <Send size={17} aria-hidden="true" />
                </span>
              </div>
            </div>

            <div className="px-6 py-7 sm:px-8 lg:px-10">
              <p className="mb-6 text-xs text-muted-warm">
                Los campos marcados son obligatorios.
              </p>

            <div className="grid gap-5 sm:grid-cols-2">
              {/* Nombre */}
              <div>
                <label
                  htmlFor="nombre"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Nombre completo
                </label>

                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Nombre y apellido"
                  className="h-12 w-full rounded-sm border border-line-light bg-paper px-4 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>

              {/* Correo */}
              <div>
                <label
                  htmlFor="correo"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Correo electrónico
                </label>

                <input
                  id="correo"
                  name="correo"
                  type="email"
                  required
                  value={formData.correo}
                  onChange={handleChange}
                  placeholder="correo@empresa.com"
                  className="h-12 w-full rounded-sm border border-line-light bg-paper px-4 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label
                  htmlFor="telefono"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Teléfono
                </label>

                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  required
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="+57 300 000 0000"
                  autoComplete="tel"
                  className="h-12 w-full rounded-sm border border-line-light bg-paper px-4 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>

              {/* Tipo de obra */}
              <div>
                <label
                  htmlFor="tipoObra"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Tipo de servicio
                </label>

                <div className="relative">
                  <select
                    id="tipoObra"
                    name="tipoObra"
                    required
                    value={formData.tipoObra}
                    onChange={handleChange}
                    className="h-12 w-full appearance-none rounded-sm border border-line-light bg-paper px-4 pr-10 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
                  >
                    <option value="">
                      Seleccione una opción
                    </option>

                    <option value="civil">
                      Ingeniería Civil
                    </option>

                    <option value="vias">
                      Vías y Pavimentos
                    </option>

                    <option value="topografia">
                      Topografía de Precisión
                    </option>

                    <option value="construccion">
                      Construcción y Edificación
                    </option>
                  </select>
                  <ChevronDown
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-warm"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Ubicación */}
              <div>
                <label
                  htmlFor="ubicacion"
                  className="mb-2 block text-sm font-medium text-ink"
                >
                  Ubicación del proyecto
                </label>

                <input
                  id="ubicacion"
                  name="ubicacion"
                  type="text"
                  required
                  value={formData.ubicacion}
                  onChange={handleChange}
                  placeholder="Ciudad / Municipio"
                  className="h-12 w-full rounded-sm border border-line-light bg-paper px-4 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>
            </div>

            {/* Honeypot */}
            <input
              type="text"
              name="honeypot"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-7 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={16} aria-hidden="true" />
                  {status === "loading" ? "Enviando solicitud..." : "Enviar solicitud"}
                </button>

                {status === "success" && (
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-700" role="status">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    Solicitud enviada. Pronto nos pondremos en contacto.
                  </p>
                )}

                {status === "error" && (
                  <div
                    className="flex max-w-md items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    role="alert"
                  >
                    <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>
                      <strong className="font-semibold">No pudimos enviar la solicitud.</strong>{" "}
                      Verifica los datos e inténtalo nuevamente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
