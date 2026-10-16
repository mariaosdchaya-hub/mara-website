/**
 * "In their words" section.
 *  - Scroll: the section pins and steps through the founder quotes. Each change blurs the current
 *    quote up and out and brings the next one up from below; counter and progress line follow.
 *  - Cursor: two small "In their / words" tags trail the pointer while it is over the section
 *    (pointer devices only).
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const PER_QUOTE = 0.55; // viewport heights of scroll per quote

export function initVoices() {
  const section = document.querySelector<HTMLElement>("[data-voices]");
  if (!section) return;
  const stage = section.querySelector<HTMLElement>(".voices__stage")!;
  const items = Array.from(section.querySelectorAll<HTMLElement>("[data-voice]"));
  const indexEl = section.querySelector<HTMLElement>("[data-voice-index]");
  const fill = section.querySelector<HTMLElement>("[data-voice-progress]");
  const cursor = section.querySelector<HTMLElement>("[data-voice-cursor]");
  const header = document.querySelector<HTMLElement>(".header");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const n = items.length;
  let current = 0;
  const cleanups: Array<() => void> = [];

  const show = (next: number) => {
    if (next === current) return;
    const down = next > current;
    const out = items[current];
    const inc = items[next];
    current = next;

    gsap.killTweensOf([out, inc]);
    gsap.killTweensOf([...out.querySelectorAll("[data-part]"), ...inc.querySelectorAll("[data-part]")]);
    out.setAttribute("aria-hidden", "true");
    inc.removeAttribute("aria-hidden");
    items.forEach((el) => el !== out && el !== inc && el.classList.remove("is-active"));
    inc.classList.add("is-active");

    if (reduce) {
      out.classList.remove("is-active");
    } else {
      gsap.to(out.querySelectorAll("[data-part]"), {
        y: down ? -18 : 18,
        opacity: 0,
        filter: "blur(6px)",
        duration: 0.3,
        stagger: 0.03,
        ease: "power2.in",
        onComplete: () => {
          if (items[current] !== out) out.classList.remove("is-active");
        },
      });
      gsap.fromTo(
        inc.querySelectorAll("[data-part]"),
        { y: down ? 24 : -24, opacity: 0, filter: "blur(8px)" },
        { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.55, stagger: 0.06, ease: "power3.out", delay: 0.18 },
      );
    }
    if (indexEl) indexEl.textContent = String(next + 1).padStart(2, "0");
  };

  const ctx = gsap.context(() => {
    ScrollTrigger.create({
      trigger: section,
      start: () => `top ${header?.offsetHeight ?? 0}px`,
      end: () => `+=${Math.max(1, n - 1) * window.innerHeight * PER_QUOTE}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const i = Math.min(n - 1, Math.floor(self.progress * n * 0.999));
        show(i);
        if (fill) gsap.set(fill, { scaleX: (self.progress * (n - 1) + 1) / n });
      },
    });
  }, section);

  // cursor tags
  if (cursor && fine && !reduce) {
    document.body.appendChild(cursor);
    const OFFSET_X = 18;
    const OFFSET_Y = 14;
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3.out" });
    let inside = false;

    const move = (e: PointerEvent) => {
      if (!inside) {
        gsap.set(cursor, { x: e.clientX + OFFSET_X, y: e.clientY + OFFSET_Y });
      }
      xTo(e.clientX + OFFSET_X);
      yTo(e.clientY + OFFSET_Y);
    };
    const enter = (e: PointerEvent) => {
      move(e);
      inside = true;
      gsap.to(cursor, { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" });
    };
    const leave = () => {
      inside = false;
      gsap.to(cursor, { opacity: 0, scale: 0.85, duration: 0.2, ease: "power2.in" });
    };
    gsap.set(cursor, { scale: 0.85, transformOrigin: "0 0" });
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerenter", enter);
    stage.addEventListener("pointerleave", leave);
    cleanups.push(() => {
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerenter", enter);
      stage.removeEventListener("pointerleave", leave);
      section.appendChild(cursor);
    });
  }

  return () => {
    ctx.revert();
    cleanups.forEach((fn) => fn());
  };
}
