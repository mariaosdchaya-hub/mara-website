/**
 * MVP process — entrance, matched frame by frame to the LE:MA reference
 * (cases deck → "End-to-End Web Design Partner" → services cards):
 *  1. heading lines rise out of a mask while un-blurring; the overline fades in from a blur
 *  2. cards open one after another, left to right: the panel unrolls from the top,
 *     the title sharpens, the illustration resolves from coarse pixels to sharp,
 *     the description arrives last.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initProcess() {
  const section = document.querySelector<HTMLElement>("[data-process]");
  if (!section) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const lines = section.querySelectorAll<HTMLElement>("[data-split] .line > span");
  const fades = section.querySelectorAll<HTMLElement>("[data-fade]");
  const steps = Array.from(section.querySelectorAll<HTMLElement>("[data-step]"));
  const mobile = window.matchMedia("(max-width: 768px)").matches;

  const ctx = gsap.context(() => {
    // 1 · heading
    gsap
      .timeline({
        scrollTrigger: { trigger: section, start: "top 78%", toggleActions: "play none none reverse" },
      })
      .fromTo(
        lines,
        { yPercent: 105, opacity: 0, filter: "blur(8px)" },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.75, stagger: 0.09, ease: "power3.out" },
      )
      .fromTo(
        fades,
        { opacity: 0, filter: "blur(6px)" },
        { opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "power2.out" },
        0.1,
      );

    // 2 · cards, in reading order; on phones each card triggers on its own
    const build = (step: HTMLElement) => {
      const titles = step.querySelectorAll("[data-step-title]");
      const text = step.querySelectorAll("[data-step-text]");
      const full = step.querySelector(".step__img--full");
      const fine = step.querySelector(".step__img--fine");
      const coarse = step.querySelector(".step__img--coarse");
      const corners = step.querySelectorAll(".cta__corner");
      const bg = step.querySelector(".cta__bg");

      const tl = gsap.timeline();
      tl.fromTo(
        step,
        { clipPath: "inset(0% 0% 100% 0%)", opacity: 0 },
        { clipPath: "inset(0% 0% 0% 0%)", opacity: 1, duration: 0.7, ease: "power3.out", clearProps: "clipPath" },
      ).fromTo(
        titles,
        { opacity: 0, filter: "blur(6px)", y: 6 },
        { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out" },
        0.12,
      );
      if (full && fine && coarse) {
        // coarse pixels → finer pixels → sharp
        tl.set(full, { opacity: 0 }, 0)
          .fromTo(coarse, { opacity: 0 }, { opacity: 1, duration: 0.15 }, 0.2)
          .set(fine, { opacity: 1 }, 0.42)
          .set(coarse, { opacity: 0 }, 0.42)
          .to(full, { opacity: 1, duration: 0.3, ease: "power1.out" }, 0.6)
          .set(fine, { opacity: 0 }, 0.9);
      }
      if (bg) tl.fromTo(bg, { scale: 1.15, filter: "blur(10px)" }, { scale: 1, filter: "blur(0px)", duration: 0.9, ease: "power3.out" }, 0);
      if (corners.length) tl.fromTo(corners, { scale: 0 }, { scale: 1, duration: 0.35, stagger: 0.05, ease: "back.out(2)" }, 0.45);
      tl.fromTo(text, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.55);
      return tl;
    };

    if (mobile) {
      steps.forEach((step) =>
        ScrollTrigger.create({
          trigger: step,
          start: "top 85%",
          animation: build(step),
          toggleActions: "play none none reverse",
        }),
      );
    } else {
      // row by row: a row starts when it comes into view, its cards follow each other
      const rows = new Map<number, HTMLElement[]>();
      steps.forEach((s) => {
        const top = Math.round(s.offsetTop);
        rows.set(top, [...(rows.get(top) ?? []), s]);
      });
      rows.forEach((row) => {
        const tl = gsap.timeline({ paused: true });
        row.forEach((s, i) => tl.add(build(s), i * 0.16));
        ScrollTrigger.create({
          trigger: row[0],
          start: "top 88%",
          animation: tl,
          toggleActions: "play none none reverse",
        });
      });
    }
  }, section);

  return () => ctx.revert();
}
