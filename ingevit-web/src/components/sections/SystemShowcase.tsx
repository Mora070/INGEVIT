import { useEffect, useRef } from "react";

const storyWords = [
  ..."El trabajo comienza en campo. Nuestro sistema ayuda a".split(" ").map(text => ({ text, accent: false })),
  ..."organizar la información".split(" ").map(text => ({ text, accent: true })),
  ..."y dar seguimiento a cada proyecto.".split(" ").map(text => ({ text, accent: false })),
];

interface SystemShowcaseProps {
  src: string;
  provisional: boolean;
}

export default function SystemShowcase({ src, provisional }: SystemShowcaseProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    const video = root?.querySelector<HTMLVideoElement>(".system-story-video video");
    if (video) {
      const videoObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      }, { threshold: 0.35 });
      videoObserver.observe(video);

      return () => videoObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    const root = ref.current;
    const story = root?.querySelector<HTMLElement>(".system-story");
    if (!root || !story) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const panel = root.querySelector<HTMLElement>(".system-story-panel");
    const words = root.querySelectorAll<HTMLElement>(".system-story-word");
    if (!panel) return;
    let frame = 0;
    let focused = false;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    const update = () => {
      frame = 0;
      root.dataset.storyEnhanced = reduced.matches ? "false" : "true";
      const bounds = story.getBoundingClientRect();
      const stickyTop = Number.parseFloat(window.getComputedStyle(panel).top) || 0;
      const progress = reduced.matches || focused ? 1 : clamp(
        (stickyTop - bounds.top) / Math.max(1, bounds.height - panel.offsetHeight),
      );
      const entry = reduced.matches || focused ? 1 : clamp((window.innerHeight - bounds.top) / (window.innerHeight * 0.6));
      root.style.setProperty("--story-entry", String(entry));
      const reading = progress;
      words.forEach((word, index) => {
        const fill = clamp((reading * (words.length + 2) - index) / 3);
        word.style.setProperty("--word-fill", (fill * 100).toFixed(2) + "%");
      });

    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const onFocus = () => { focused = true; schedule(); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    root.addEventListener("focusin", onFocus);
    update();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      root.removeEventListener("focusin", onFocus);
      delete root.dataset.storyEnhanced;
    };
  }, []);

  return (
    <div ref={ref} className="system-showcase pt-8" aria-labelledby="system-story-title">
      <div className="system-story">
        <div className="system-story-panel">
          <div className="system-story-copy">
            <p className="system-story-label">Tecnología INGEVIT · Desarrollo propio</p>
            <h3 id="system-story-title" className="system-story-heading">
              {storyWords.map((word, index) => (
                <span key={index}>
                  <span className={word.accent ? "system-story-word system-story-word-accent" : "system-story-word"}>{word.text}</span>
                  {index < storyWords.length - 1 ? " " : ""}
                </span>
              ))}
            </h3>
            <span aria-hidden="true" className="system-story-cue">Nuestro sistema <span>↓</span></span>
          </div>
        </div>
      </div>
      <figure className="system-story-video mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-sm border border-line-light bg-paper">
          <video className="aspect-video w-full object-contain" muted loop controls playsInline preload="none" aria-label={provisional ? "Video provisional de referencia" : "Presentación del sistema INGEVIT"}>
            <source src={src} type="video/mp4" />
            Tu navegador no soporta video HTML5. <a href={src}>Abrir video</a>
          </video>
        </div>
        <figcaption className="flex flex-col gap-2 border-b border-line-light py-3 sm:flex-row sm:items-start sm:justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted">{provisional ? "Video de referencia" : "Sistema INGEVIT"}</span>
          {provisional && <span className="max-w-xs text-xs leading-5 text-muted-warm sm:text-right">Próximamente, la demostración de nuestro sistema.</span>}
        </figcaption>
      </figure>

    </div>
  );
}
