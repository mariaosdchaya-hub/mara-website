/**
 * "Trusted across borders" — scroll reveal.
 *  1. Heading lines rise out of a mask while un-blurring (same as the MVP process heading).
 *  2. Stat cards come up one after another; each number counts up from zero and,
 *     when it lands, the grey dot in the corner lights up teal.
 *  3. The globe is scrubbed with scroll: it rises and grows into place while a soft circle
 *     opens from the middle of the map, so Europe shows first and the edges follow.
 *  4. The dark "We are worldwide" card slides up over the globe; countries appear
 *     column by column.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initResults() {
  const section = document.querySelector<HTMLElement>("[data-results]");
  if (!section) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const lines = section.querySelectorAll("[data-split] .line > span");
  const stats = Array.from(section.querySelectorAll<HTMLElement>("[data-stat]"));
  const globe = section.querySelector<HTMLElement>("[data-globe]");
  const globeImg = section.querySelector<HTMLElement>("[data-globe-img]");
  const world = section.querySelector<HTMLElement>("[data-world]");
  const worldTitle = section.querySelector("[data-world-title]");
  const cols = Array.from(section.querySelectorAll<HTMLElement>(".world__col"));

  const ctx = gsap.context(() => {
    // 1 · heading
    gsap.fromTo(
      lines,
      { yPercent: 105, opacity: 0, filter: "blur(8px)" },
      {
        yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.75, stagger: 0.09, ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 78%", toggleActions: "play none none reverse" },
      },
    );

    // 2 · stats
    const statsTl = gsap.timeline({ paused: true });
    stats.forEach((stat, i) => {
      const numEl = stat.querySelector<HTMLElement>("[data-count]")!;
      const target = Number(numEl.dataset.count);
      const counter = { v: 0 };
      const t = i * 0.12;
      statsTl
        .fromTo(stat, { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, t)
        .fromTo(
          counter,
          { v: 0 },
          {
            v: target,
            duration: 1.4,
            ease: "power2.out",
            onUpdate: () => { numEl.textContent = String(Math.round(counter.v)); },
            onStart: () => stat.classList.remove("is-done"),
            onComplete: () => stat.classList.add("is-done"),
            onReverseComplete: () => stat.classList.remove("is-done"),
          },
          t + 0.1,
        );
    });
    stats.forEach((s) => (s.querySelector<HTMLElement>("[data-count]")!.textContent = "0"));
    ScrollTrigger.create({ trigger: stats[0], start: "top 88%", animation: statsTl, toggleActions: "play none none reverse" });

    // 3 · globe, scrubbed
    if (globe && globeImg) {
      gsap.fromTo(
        globeImg,
        { "--r": "0%", y: 140, scale: 0.86 },
        {
          "--r": "85%",
          y: 0,
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: globe, start: "top 100%", end: "bottom 45%", scrub: 0.6 },
        },
      );
    }

    // 4 · worldwide card
    if (world) {
      gsap
        .timeline({ scrollTrigger: { trigger: world, start: "top 88%", toggleActions: "play none none reverse" } })
        .fromTo(world, { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" })
        .fromTo(worldTitle, { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power2.out" }, 0.25)
        .fromTo(
          cols.map((c) => Array.from(c.children)).flat(),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.035 },
          0.4,
        );
    }
  }, section);

  return () => ctx.revert();
}
