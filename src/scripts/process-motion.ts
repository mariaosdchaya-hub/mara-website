/**
 * MVP process — entrance.
 *
 * Heading (all sizes): lines rise out of a mask while un-blurring, the overline fades in from a blur
 * (matched to the LE:MA reference transition after the cases deck).
 *
 * Cards, desktop — "dealing the deck": the grid pins and all seven cards start face down
 * in one loose pile in the middle. Scrolling deals them one by one, 01 → 07: each card lifts
 * off the pile, flies to its slot, grows to its real size and flips face up on the way;
 * its illustration lands as coarse pixels and resolves to sharp. Fully scrubbed, so
 * scrolling back gathers the cards into the pile again.
 *
 * Cards, tablet/phone: each card rises and tilts up into place as it enters the viewport,
 * the panel unrolls from the top and the illustration de-pixelates.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// pile size (px) and the slight disorder of the cards in it
const PILE_W = 250;
const PILE_H = 330;
const PILE_ROT = [-5, 4, -2, 6, -7, 3, 0];
const PILE_X = [-10, 8, -4, 12, -14, 6, 0];
const PILE_Y = [6, -8, 4, -4, 10, -6, 0];
const DEAL_GAP = 0.55; // timeline units between two deals
const DEAL_LEN = 1.1; // one card's flight

export function initProcess() {
  const section = document.querySelector<HTMLElement>("[data-process]");
  if (!section) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const grid = section.querySelector<HTMLElement>(".process__grid")!;
  const lines = section.querySelectorAll<HTMLElement>("[data-split] .line > span");
  const fades = section.querySelectorAll<HTMLElement>("[data-fade]");
  const steps = Array.from(section.querySelectorAll<HTMLElement>("[data-step]"));
  const header = document.querySelector<HTMLElement>(".header");
  const deal = window.matchMedia("(min-width: 1101px) and (min-height: 700px)").matches;

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

    if (deal) dealDeck();
    else steps.forEach(riseCard);
  }, section);

  /* ---------------- desktop: deal the deck ---------------- */
  function dealDeck() {
    section!.classList.add("is-dealing");
    const n = steps.length;

    // where each card has to travel to sit in the pile (layout offsets ignore transforms)
    const pile = (i: number) => {
      const el = steps[i];
      const cx = el.offsetLeft + el.offsetWidth / 2;
      const cy = el.offsetTop + el.offsetHeight / 2;
      return {
        x: grid.clientWidth / 2 - cx + PILE_X[i % PILE_X.length],
        y: grid.clientHeight / 2 - cy + PILE_Y[i % PILE_Y.length],
        scaleX: PILE_W / el.offsetWidth,
        scaleY: PILE_H / el.offsetHeight,
      };
    };

    const tl = gsap.timeline({ defaults: { ease: "none" } });

    steps.forEach((el, i) => {
      const back = el.querySelector<HTMLElement>("[data-back]");
      const full = el.querySelector(".step__img--full");
      const fine = el.querySelector(".step__img--fine");
      const coarse = el.querySelector(".step__img--coarse");
      const corners = el.querySelectorAll(".cta__corner");
      const t = 0.2 + i * DEAL_GAP;

      // face down in the pile; first card on top
      gsap.set(el, { zIndex: 20 + n - i });
      tl.fromTo(
        el,
        {
          x: () => pile(i).x,
          y: () => pile(i).y,
          scaleX: () => pile(i).scaleX,
          scaleY: () => pile(i).scaleY,
          rotation: PILE_ROT[i % PILE_ROT.length],
          rotationY: -180,
        },
        {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          rotationY: 0,
          duration: DEAL_LEN,
          ease: "power3.inOut",
          immediateRender: true,
        },
        t,
      );
      // lift off the pile: a quick pop towards the viewer, then settle
      tl.fromTo(el, { z: 0 }, { z: 220, duration: DEAL_LEN * 0.45, ease: "power2.out", immediateRender: false }, t)
        .to(el, { z: 0, duration: DEAL_LEN * 0.55, ease: "power2.in" }, t + DEAL_LEN * 0.45);
      // shadow follows the lift
      tl.fromTo(
        el,
        { boxShadow: "0 2px 6px rgba(0,0,0,.18)" },
        { boxShadow: "0 40px 80px rgba(0,0,0,.22)", duration: DEAL_LEN * 0.45, ease: "power2.out", immediateRender: true },
        t,
      ).to(el, { boxShadow: "0 0 0 rgba(0,0,0,0)", duration: DEAL_LEN * 0.55, ease: "power2.in" }, t + DEAL_LEN * 0.45);
      // flip: the back is visible until the card turns past 90°
      if (back) {
        tl.set(back, { opacity: 1 }, 0).set(back, { opacity: 0 }, t + DEAL_LEN * 0.5);
      }
      // illustration lands pixelated and resolves
      if (full && fine && coarse) {
        tl.set(full, { opacity: 0 }, 0)
          .set(coarse, { opacity: 1 }, 0)
          .set(fine, { opacity: 0 }, 0)
          .set(coarse, { opacity: 0 }, t + DEAL_LEN * 0.75)
          .set(fine, { opacity: 1 }, t + DEAL_LEN * 0.75)
          .fromTo(full, { opacity: 0 }, { opacity: 1, duration: DEAL_LEN * 0.25, immediateRender: false }, t + DEAL_LEN * 0.92)
          .set(fine, { opacity: 0 }, t + DEAL_LEN * 1.17);
      }
      // CTA corner squares snap on once the card has landed
      if (corners.length) {
        tl.fromTo(corners, { scale: 0 }, { scale: 1, duration: 0.25, stagger: 0.04, ease: "back.out(2)", immediateRender: true }, t + DEAL_LEN * 0.95);
      }
      // cards already dealt sit under the ones still flying
      tl.set(el, { zIndex: 1 }, t + DEAL_LEN);
    });
    tl.to({}, { duration: 0.3 }); // short hold on the finished grid before the pin releases

    const headerH = () => header?.offsetHeight ?? 0;
    ScrollTrigger.create({
      trigger: grid,
      // centre the grid in the space under the sticky header
      start: () => `center ${headerH() + (window.innerHeight - headerH()) / 2}px`,
      end: () => `+=${window.innerHeight * 1.9}`,
      pin: true,
      scrub: 0.6,
      animation: tl,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    });
  }

  /* ---------------- tablet / phone: rise into place ---------------- */
  function riseCard(step: HTMLElement) {
    const titles = step.querySelectorAll("[data-step-title]");
    const text = step.querySelectorAll("[data-step-text]");
    const full = step.querySelector(".step__img--full");
    const fine = step.querySelector(".step__img--fine");
    const coarse = step.querySelector(".step__img--coarse");
    const corners = step.querySelectorAll(".cta__corner");

    const tl = gsap.timeline();
    tl.fromTo(
      step,
      { y: 90, rotationX: 28, scale: 0.92, transformPerspective: 1200, transformOrigin: "50% 100%", opacity: 0, clipPath: "inset(0% 0% 100% 0%)" },
      { y: 0, rotationX: 0, scale: 1, opacity: 1, clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: "power3.out", clearProps: "clipPath,transform" },
    ).fromTo(
      titles,
      { opacity: 0, filter: "blur(6px)", y: 8 },
      { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out" },
      0.2,
    );
    if (full && fine && coarse) {
      tl.set(full, { opacity: 0 }, 0)
        .fromTo(coarse, { opacity: 0 }, { opacity: 1, duration: 0.15 }, 0.25)
        .set(fine, { opacity: 1 }, 0.5)
        .set(coarse, { opacity: 0 }, 0.5)
        .to(full, { opacity: 1, duration: 0.3, ease: "power1.out" }, 0.7)
        .set(fine, { opacity: 0 }, 1);
    }
    if (corners.length) tl.fromTo(corners, { scale: 0 }, { scale: 1, duration: 0.35, stagger: 0.05, ease: "back.out(2)" }, 0.6);
    tl.fromTo(text, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.6);

    ScrollTrigger.create({ trigger: step, start: "top 88%", animation: tl, toggleActions: "play none none reverse" });
  }

  return () => {
    ctx.revert();
    section.classList.remove("is-dealing");
  };
}
