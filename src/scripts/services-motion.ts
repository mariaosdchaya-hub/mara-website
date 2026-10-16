/**
 * "What we do" — the section pins and vertical scroll drives the card row sideways,
 * left to right: it starts shifted left (the last cards in view) and travels right
 * until it settles in the Figma layout, first card at the left margin.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initServices() {
  const section = document.querySelector<HTMLElement>("[data-services]");
  const row = section?.querySelector<HTMLElement>("[data-services-row]");
  if (!section || !row) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  section.classList.add("is-scrolling");
  const header = document.querySelector<HTMLElement>(".header");
  const viewport = row.parentElement!;
  // how far the row overhangs its viewport
  const travel = () => Math.max(0, row.scrollWidth - viewport.clientWidth + parseFloat(getComputedStyle(viewport).paddingLeft) * 2);

  const ctx = gsap.context(() => {
    gsap.fromTo(
      row,
      { x: () => -travel() },
      {
        x: 0,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: () => `top ${header?.offsetHeight ?? 0}px`,
          end: () => `+=${travel()}`,
          pin: true,
          scrub: 0.5,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      },
    );
  }, section);

  return () => {
    ctx.revert();
    section.classList.remove("is-scrolling");
  };
}
