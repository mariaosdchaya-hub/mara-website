/**
 * MVP process — entrance.
 *
 * Heading: lines rise out of a mask while un-blurring, the overline fades in from a blur
 * (matched to the LE:MA reference transition after the cases deck).
 *
 * Cards "load" one after another, like content arriving in an app:
 *  1. the card appears as a skeleton (shimmering placeholders) with a thin progress line on top,
 *  2. the line fills in a couple of uneven steps,
 *  3. the skeleton dissolves into the real content: title and number sharpen,
 *     the illustration arrives as coarse pixels and resolves to sharp, the description fades in last.
 * Time-based (not scrubbed); desktop plays row by row, phones card by card.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const CARD_GAP = 0.14; // delay between neighbouring cards in a row

export function initProcess() {
  const section = document.querySelector<HTMLElement>("[data-process]");
  if (!section) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const lines = section.querySelectorAll<HTMLElement>("[data-split] .line > span");
  const fades = section.querySelectorAll<HTMLElement>("[data-fade]");
  const steps = Array.from(section.querySelectorAll<HTMLElement>("[data-step]"));
  const mobile = window.matchMedia("(max-width: 1100px)").matches;

  section.classList.add("is-loading");

  const ctx = gsap.context(() => {
    // ---- heading
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

    // ---- cards
    if (mobile) {
      steps.forEach((s) =>
        ScrollTrigger.create({ trigger: s, start: "top 88%", animation: load(s), toggleActions: "play none none reverse" }),
      );
    } else {
      const rows = new Map<number, HTMLElement[]>();
      steps.forEach((s) => {
        const top = Math.round(s.offsetTop);
        rows.set(top, [...(rows.get(top) ?? []), s]);
      });
      rows.forEach((row) => {
        const tl = gsap.timeline({ paused: true });
        row.forEach((s, i) => tl.add(load(s), i * CARD_GAP));
        ScrollTrigger.create({ trigger: row[0], start: "top 85%", animation: tl, toggleActions: "play none none reverse" });
      });
    }
  }, section);

  function load(step: HTMLElement) {
    const skel = step.querySelector("[data-skel]");
    const bar = step.querySelector("[data-load]");
    const titles = step.querySelectorAll("[data-step-title]");
    const text = step.querySelectorAll("[data-step-text]");
    const full = step.querySelector(".step__img--full");
    const fine = step.querySelector(".step__img--fine");
    const coarse = step.querySelector(".step__img--coarse");
    const corners = step.querySelectorAll(".cta__corner");
    const bg = step.querySelector(".cta__bg");

    const tl = gsap.timeline();
    // 1 · skeleton card appears
    tl.fromTo(step, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0)
      .fromTo(skel, { opacity: 1 }, { opacity: 1, duration: 0.01 }, 0);
    // 2 · progress line fills in uneven steps, like a real request
    if (bar) {
      tl.set(bar, { opacity: 1, scaleX: 0 }, 0.1)
        .to(bar, { scaleX: 0.35, duration: 0.3, ease: "power2.out" }, 0.15)
        .to(bar, { scaleX: 0.7, duration: 0.25, ease: "power1.inOut" }, 0.55)
        .to(bar, { scaleX: 1, duration: 0.2, ease: "power1.in" }, 0.9)
        .to(bar, { opacity: 0, duration: 0.25 }, 1.12);
    }
    // 3 · content replaces the skeleton
    const at = 1.05;
    if (full && fine && coarse) {
      tl.set(full, { opacity: 0 }, 0)
        .set(fine, { opacity: 0 }, 0)
        .set(coarse, { opacity: 0 }, 0)
        .set(coarse, { opacity: 1 }, at)
        .set(fine, { opacity: 1 }, at + 0.18)
        .set(coarse, { opacity: 0 }, at + 0.18)
        .to(full, { opacity: 1, duration: 0.3, ease: "power1.out" }, at + 0.36)
        .set(fine, { opacity: 0 }, at + 0.66);
    }
    if (bg) tl.fromTo(bg, { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "power2.out" }, at);
    tl.to(skel, { opacity: 0, duration: 0.35, ease: "power1.out" }, at)
      .fromTo(
        titles,
        { opacity: 0, filter: "blur(6px)" },
        { opacity: 1, filter: "blur(0px)", duration: 0.45, stagger: 0.05, ease: "power2.out" },
        at + 0.05,
      )
      .fromTo(text, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, at + 0.3);
    if (corners.length) tl.fromTo(corners, { scale: 0 }, { scale: 1, duration: 0.3, stagger: 0.04, ease: "back.out(2)" }, at + 0.3);
    return tl;
  }

  return () => {
    ctx.revert();
    section.classList.remove("is-loading");
  };
}
