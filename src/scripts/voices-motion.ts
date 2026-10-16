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

  // cursor tags: hidden by default; moving the pointer brings them in one after the other,
  // the second trailing a little behind the first; when the pointer rests they leave in reverse
  if (cursor && fine && !reduce) {
    document.body.appendChild(cursor);
    const tags = Array.from(cursor.querySelectorAll<HTMLElement>("span"));
    const OFFSET_X = 18;
    const OFFSET_Y = 14;
    const GAP = 3;
    const IDLE = 700; // ms without movement before the tags hide
    const followers = tags.map((tag, i) => ({
      x: gsap.quickTo(tag, "x", { duration: 0.3 + i * 0.12, ease: "power3.out" }),
      y: gsap.quickTo(tag, "y", { duration: 0.3 + i * 0.12, ease: "power3.out" }),
    }));
    gsap.set(tags, { scale: 0.6, transformOrigin: "0% 50%" });
    let shown = false;
    let idle = 0;

    const target = (i: number, e: PointerEvent) => {
      const dx = tags.slice(0, i).reduce((sum, t) => sum + t.offsetWidth + GAP, 0);
      return { x: e.clientX + OFFSET_X + dx, y: e.clientY + OFFSET_Y };
    };
    const showTags = () => {
      shown = true;
      gsap.to(tags, { opacity: 1, scale: 1, duration: 0.28, stagger: 0.12, ease: "back.out(1.6)", overwrite: "auto" });
    };
    const hideTags = () => {
      shown = false;
      gsap.to([...tags].reverse(), { opacity: 0, scale: 0.6, duration: 0.2, stagger: 0.08, ease: "power2.in", overwrite: "auto" });
    };
    const move = (e: PointerEvent) => {
      tags.forEach((tag, i) => {
        const t = target(i, e);
        if (!shown && Number(gsap.getProperty(tag, "opacity")) < 0.05) gsap.set(tag, t); // start at the pointer, no fly-in
        followers[i].x(t.x);
        followers[i].y(t.y);
      });
      if (!shown) showTags();
      clearTimeout(idle);
      idle = window.setTimeout(hideTags, IDLE);
    };
    const leave = () => {
      clearTimeout(idle);
      hideTags();
    };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerleave", leave);
    cleanups.push(() => {
      clearTimeout(idle);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerleave", leave);
      section.appendChild(cursor);
    });
  }

  return () => {
    ctx.revert();
    cleanups.forEach((fn) => fn());
  };
}
