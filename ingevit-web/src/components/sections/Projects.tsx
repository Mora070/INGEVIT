import { useState } from "react";
import ProjectCard from "../ui/ProjectCard";
import ProjectModal from "../ui/ProjectModal";
import { projects } from "../../data/projects";
import type { Project } from "../../types";

export default function Projects() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <section
      id="proyectos"
      className="site-section"
    >
      <div className="site-container">
        {/* =====================================================
            ENCABEZADO
        ===================================================== */}
        <div className="grid gap-8 border-b border-line-light pb-7 lg:grid-cols-2 lg:items-center lg:gap-8">
          {/* Texto */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-accent" />

              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-warm">
                Proyectos
              </p>
            </div>

            <h2 className="max-w-xl text-ink">
              Proyectos en los que hemos trabajado.
            </h2>
          </div>

          <div className="lg:border-l lg:border-line-light lg:pl-8">
            <p className="max-w-lg text-sm leading-7 text-muted-warm sm:text-[15px]">
              Una selección de nuestras obras. Abra cada proyecto para consultar su ubicación, alcance y fotografías.
            </p>
          </div>
        </div>

        {/* =====================================================
            PROYECTOS
        ===================================================== */}
        <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-7 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <button
              key={project.title}
              type="button"
              onClick={() => setSelectedProject(project)}
              className="block w-full text-left"
              aria-label={`Ver proyecto ${project.title}`}
            >
              <ProjectCard
                {...project}
                index={index}
              />
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================
          MODAL DEL PROYECTO
      ===================================================== */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </section>
  );
}