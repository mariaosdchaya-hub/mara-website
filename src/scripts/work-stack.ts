/**
 * Selected work — 3D card "drum".
 * Scroll (pinned) rolls the deck: cards travel from below, open flat in the centre,
 * then fold back above. Hover/focus on any card temporarily opens that card.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/*
 * Deck geometry, measured from the Figma stack (4202:2676).
 * Every inactive card folds on a hinge at the edge nearest the open card, so the deck
 * reads as a pile seen in perspective: thin strips above, deeper strips below.
 * Values are visible strip heights as a fraction of the card height.
 */
const ABOVE = [1, 0.13, 0.065, 0.035, 0.018]; // d = 0, -1, -2, -3, -4
const BELOW = [1, 0.2, 0.13, 0.09, 0.06]; // d = 0, +1, +2, +3, +4
const SHADE = [0, 0.1, 0.2, 0.3, 0.38];
const MAX = 4;

// cumulative edge position of the k-th strip (k >= 1), in card heights
const edge = (list: number[], k: number) => {
  let sum = 0;
  for (let i = 1; i <= k; i++) sum += list[i];
  return sum;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Pose = { top: number; h: number; origin: "top" | "bottom"; shade: number; o: number };

// top = y of the card's visual top edge (card heights, 0 = open card top), h = visible height
function poseAt(d: number): Pose {
  const a = Math.min(Math.abs(d), MAX);
  const lo = Math.floor(a);
  const hi = Math.min(lo + 1, MAX);
  const t = a - lo;
  const fade = a >= MAX - 0.0001 ? 0 : a > MAX - 1 ? 1 - (a - (MAX - 1)) : 1;
  if (d <= 0) {
    // above: bottom edge sits on the strip below it
    const bottomLo = lo === 0 ? 1 : -edge(ABOVE, lo - 1);
    const bottomHi = -edge(ABOVE, hi - 1);
    const bottom = lerp(bottomLo, bottomHi, t);
    const h = lerp(ABOVE[lo], ABOVE[hi], t);
    return { top: bottom - h, h, origin: "bottom", shade: lerp(SHADE[lo], SHADE[hi], t), o: fade };
  }
  // below: top edge hangs from the strip above it
  const topLo = lo === 0 ? 0 : 1 + edge(BELOW, lo - 1);
  const topHi = 1 + edge(BELOW, hi - 1);
  return {
    top: lerp(topLo, topHi, t),
    h: lerp(BELOW[lo], BELOW[hi], t),
    origin: "top",
    shade: lerp(SHADE[lo], SHADE[hi], t),
    o: fade,
  };
}

const PERSP = 5000; // flatter lens: strips widen ~10% below, narrow ~9% above (as in Figma)

/**
 * Fold angle (deg) whose perspective projection has height h·H.
 * Hinged edge stays put; toward = the free edge swings toward the viewer (cards below).
 */
function foldAngle(h: number, H: number, toward: boolean) {
  if (h >= 0.9999) return 0;
  const proj = (a: number) => {
    const z = H * Math.sin(a) * (toward ? 1 : -1);
    return (H * Math.cos(a) * PERSP) / (PERSP - z) / H;
  };
  let lo = 0;
  let hi = Math.PI / 2 - 0.001;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (proj(mid) > h) lo = mid;
    else hi = mid;
  }
  return (((lo + hi) / 2) * 180) / Math.PI;
}

/** Visual extent of the whole deck, in card heights (used for sizing). */
export const DECK_ABOVE = edge(ABOVE, 2);
export const DECK_BELOW = edge(BELOW, 3);

export function initWorkStack() {
  const section = document.querySelector<HTMLElement>("[data-work]");
  const stack = section?.querySelector<HTMLElement>("[data-stack]");
  if (!section || !stack) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveals = section.querySelectorAll<HTMLElement>("[data-reveal]");

  if (reduce) return; // static list fallback (CSS)

  section.classList.add("is-3d");
  const cards = Array.from(stack.querySelectorAll<HTMLElement>("[data-card]"));
  const links = cards.map((c) => c.querySelector<HTMLAnchorElement>("a")!);
  const nameEl = stack.querySelector<HTMLElement>("[data-stack-name]");
  const indexEl = stack.querySelector<HTMLElement>("[data-stack-index]");
  const header = document.querySelector<HTMLElement>(".header");
  const n = cards.length;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // two sources of the "active" position: scroll, and a temporary hover/focus override
  const state = { scroll: 0, shown: 0 };
  let override: number | null = null;
  let lastLabel = -1;

  const render = () => {
    const H = cards[0].offsetHeight;
    const p = state.shown;
    for (let i = 0; i < n; i++) {
      const d = i - p;
      const P = poseAt(d);
      const el = cards[i];
      // fold angle so the projected height matches the strip height
      const toward = P.origin === "top";
      const angle = foldAngle(P.h, H, toward);
      // CSS rotateX(+): top edge recedes / bottom edge comes forward — right for both hinges
      const ty = P.origin === "bottom" ? (P.top + P.h - 1) * H : P.top * H;
      el.style.transformOrigin = P.origin === "bottom" ? "50% 100%" : "50% 0%";
      el.style.transform = `translate3d(0, ${ty}px, 0) perspective(${PERSP}px) rotateX(${angle}deg)`;
      el.style.opacity = String(P.o);
      el.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
      el.style.setProperty("--shade", P.shade.toFixed(3));
      el.style.visibility = P.o <= 0.001 ? "hidden" : "visible";
      el.style.pointerEvents = P.o <= 0.001 ? "none" : "auto";
    }
    const active = Math.round(p);
    if (active !== lastLabel && cards[active]) {
      lastLabel = active;
      if (nameEl) nameEl.textContent = links[active].dataset.title ?? "";
      if (indexEl) indexEl.textContent = String(active + 1).padStart(2, "0");
    }
  };

  let animating = false;
  const animateTo = (target: number) =>
    gsap.to(state, {
      shown: target,
      duration: 0.55,
      ease: "power3.out",
      overwrite: true,
      onStart: () => (animating = true),
      onUpdate: render,
      onComplete: () => (animating = false),
      onInterrupt: () => (animating = false),
    });

  const listeners: Array<() => void> = [];
  const on = (el: EventTarget, type: string, fn: (e: any) => void) => {
    el.addEventListener(type, fn);
    listeners.push(() => el.removeEventListener(type, fn));
  };

  const ctx = gsap.context(() => {
    // heading reveal
    gsap.from(reveals, {
      opacity: 0,
      y: 24,
      duration: 0.8,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: { trigger: section, start: "top 85%", toggleActions: "play none none reverse" },
    });

    ScrollTrigger.create({
      trigger: stack,
      start: () => `top ${header?.offsetHeight ?? 0}px`,
      end: () => `+=${Math.max(1, n - 1) * window.innerHeight * 0.55}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      snap: n > 1 ? { snapTo: 1 / (n - 1), duration: { min: 0.2, max: 0.5 }, ease: "power2.inOut", delay: 0.05 } : undefined,
      onUpdate: (self) => {
        state.scroll = self.progress * (n - 1);
        if (override === null) {
          gsap.to(state, { shown: state.scroll, duration: 0.35, ease: "power2.out", overwrite: true, onUpdate: render });
        }
      },
    });
  }, section);

  // hover / focus: open that card in place, return to scroll position on leave
  const release = () => {
    override = null;
    animateTo(state.scroll);
  };
  cards.forEach((card, i) => {
    if (canHover) {
      // hover intent: open only after the pointer rests on a card briefly,
      // and never while the deck is still moving (prevents ping-pong between strips)
      let timer = 0;
      on(card, "pointermove", () => {
        if (override === i || animating) return;
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (!animating && card.matches(":hover")) {
            override = i;
            animateTo(i);
          }
        }, 140);
      });
      on(card, "pointerleave", () => clearTimeout(timer));
      on(card, "pointerleave", (e: PointerEvent) => {
        const to = e.relatedTarget as Element | null;
        if (!to || !to.closest?.("[data-card]")) release();
      });
    }
    on(links[i], "focus", () => {
      override = i;
      animateTo(i);
    });
    on(links[i], "blur", (e: FocusEvent) => {
      const to = e.relatedTarget as Element | null;
      if (!to || !to.closest?.("[data-card]")) release();
    });
  });

  const ro = new ResizeObserver(render);
  ro.observe(stack);
  render();

  return () => {
    ctx.revert();
    ro.disconnect();
    listeners.forEach((off) => off());
    section.classList.remove("is-3d");
  };
}
