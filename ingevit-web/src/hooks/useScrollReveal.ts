import { useEffect, useRef } from "react";

export default function useScrollReveal() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || preference.matches || !("IntersectionObserver" in window) || typeof Element.prototype.animate !== "function") return;

    const pending = new Map<HTMLElement, Animation>();
    const active = new Set<Animation>();
    const visible = new Set<HTMLElement>();
    const listeners: Array<[HTMLImageElement, () => void]> = [];
    const play = (element: HTMLElement) => {
      const animation = pending.get(element);
      if (!animation || !visible.has(element)) return;
      if (element instanceof HTMLImageElement && !element.complete) return;
      pending.delete(element);
      observer.unobserve(element);
      visible.delete(element);
      active.add(animation);
      animation.onfinish = () => {
        animation.cancel();
        active.delete(animation);
      };
      animation.play();
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          visible.add(element);
          play(element);
        } else visible.delete(element);
      }
    }, { threshold: 0.25, rootMargin: "0px 0px -8% 0px" });

    root.querySelectorAll<HTMLElement>("[data-motion]").forEach(element => {
      const bounds = element.getBoundingClientRect();
      // Already visible content stays still, including when restoring scroll.
      if (bounds.top < window.innerHeight * 0.75) return;
      const kind = element.dataset.motion;
      let frames: Keyframe[];
      if (kind === "photo") {
        frames = [{ opacity: 0.35, transform: "scale(1.035)" }, { opacity: 1, transform: "scale(1)" }];
      } else if (kind === "team") {
        frames = [{ opacity: 0.25, transform: "translateX(18px)" }, { opacity: 1, transform: "translateX(0)" }];
      } else if (kind === "rise") {
        frames = [{ opacity: 0.2, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }];
      } else {
        frames = [{ opacity: 0.25 }, { opacity: 1 }];
      }
      const animation = element.animate(frames, {
        duration: kind === "rise" ? 650 : 900,
        delay: kind === "rise" ? Math.min(Number(element.dataset.revealDelay) || 0, 150) : 0,
        easing: "cubic-bezier(.25,.46,.45,.94)", fill: "both",
      });
      animation.pause();
      animation.currentTime = 0;
      pending.set(element, animation);
      observer.observe(element);
      if (element instanceof HTMLImageElement && !element.complete) {
        const onLoad = () => play(element);
        element.addEventListener("load", onLoad, { once: true });
        listeners.push([element, onLoad]);
      }
    });
    const finishFocused = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      for (const [element, animation] of pending) {
        if (element.contains(event.target)) {
          animation.cancel();
          pending.delete(element);
          observer.unobserve(element);
        }
      }
    };
    const cancelAll = () => {
      observer.disconnect();
      pending.forEach(animation => animation.cancel());
      active.forEach(animation => animation.cancel());
      pending.clear();
      active.clear();
      visible.clear();
    };
    const onPreferenceChange = () => { if (preference.matches) cancelAll(); };
    root.addEventListener("focusin", finishFocused);
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      cancelAll();
      listeners.forEach(([image, listener]) => image.removeEventListener("load", listener));
      root.removeEventListener("focusin", finishFocused);
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, []);

  return ref;
}
