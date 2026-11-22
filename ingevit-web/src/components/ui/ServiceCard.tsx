import { type LucideIcon } from "lucide-react";

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  index: number;
}

export default function ServiceCard({
  icon: Icon,
  title,
  description,
  features,
  index,
}: ServiceCardProps) {
  const serviceNumber = String(index + 1).padStart(2, "0");

  return (
    <article
      className="
        group relative border-b border-line-light py-8
        md:px-6
        md:odd:border-r
        lg:border-b-0
        lg:border-r
        lg:first:pl-0
        lg:last:border-r-0
        lg:last:pr-0
      "
    >
      {/* Número e icono */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted">
          {serviceNumber}
        </span>

        <Icon
          size={22}
          strokeWidth={1.5}
          className="text-accent"
        />
      </div>

      {/* Título */}
      <h3 className="mt-6 min-h-[52px] text-xl text-ink xl:text-2xl">
        {title}
      </h3>

      {/* Descripción */}
      <p className="mt-3 text-[13px] leading-6 text-muted-warm">
        {description}
      </p>

      {/* Especialidades */}
      <ul className="mt-5 space-y-2 border-t border-line-light pt-4">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-[12px] leading-5 text-muted-warm"
          >
            <span className="mt-[9px] h-px w-3 shrink-0 bg-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}