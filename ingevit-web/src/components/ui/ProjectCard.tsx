import { ArrowUpRight, MapPin } from "lucide-react";

interface ProjectCardProps {
  image: string;
  category: string;
  title: string;
  location: string;
  detail: string;
  index: number;
}

export default function ProjectCard({
  image,
  category,
  title,
  location,
  detail,
  index,
}: ProjectCardProps) {




  return (
    <article data-reveal-delay={(index % 3) * 70} className="project-item group">
      {/* Imagen */}
      <div className="relative h-64 overflow-hidden bg-surface sm:h-72 lg:h-80">
        <img
          data-motion="fade"
          src={image}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {/* Flecha */}
        <div className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center border border-line-light bg-paper/95 text-ink backdrop-blur-sm transition-all duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-white">
          <ArrowUpRight
            size={17}
            strokeWidth={1.5}
            className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </div>
      </div>
      {/* Información */}
      <div className="border-b border-line-light py-5">
        <p className="mb-2 text-[11px] font-medium text-muted-warm">{category}</p>
        <h3 className="text-xl text-ink transition-colors duration-300 group-hover:text-accent sm:text-2xl">
          {title}
        </h3>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-warm">
            <MapPin size={13} strokeWidth={1.6} />
            <span>{location}</span>
          </div>

          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-warm">
            {detail}
          </span>
        </div>
      </div>
    </article>
  );
}
