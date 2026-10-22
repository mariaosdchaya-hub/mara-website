/**
 * Selected work — card deck you flip through with scroll.
 *
 * The first case lies on top, flat and full size, with its title and arrow; the next cases wait
 * under it, each peeking out below as a strip and each one turned back a little more than the
 * one before. Scrolling lifts the front card up and away, and the next one rises to take its
 * place. Snaps to whole cards. Entering the section, the deck pulls back from a close-up.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// geometry, in card heights (H) unless noted
const STRIP = 0.075; // how much of each waiting card peeks out below the one in front
const PERSP = 1500; // px, matches .stack__stage perspective
const LEAN = 9; // deg per step: each waiting card is turned back more than the previous one
const SHOWN = 3; // waiting cards visible behind the front one
const PER_CARD = 0.55; // viewport heights of scroll per flip

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function initWorkStack() {
  const section = document.querySelector<HTMLElement>("[data-work]");
  const stack = section?.querySelector<HTMLElement>("[data-stack]");
  if (!section || !stack) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; // static list fallback (CSS)

  section.classList.add("is-3d");
  const stage = stack.querySelector<HTMLElement>(".stack__stage")!;
  const cards = Array.from(stack.querySelectorAll<HTMLElement>("[data-card]"));
  const links = cards.map((c) => c.querySelector<HTMLAnchorElement>("a")!);
  const nameEl = stack.querySelector<HTMLElement>("[data-stack-name]");
  const indexEl = stack.querySelector<HTMLElement>("[data-stack-index]");
  const header = document.querySelector<HTMLElement>(".header");
  const reveals = section.querySelectorAll<HTMLElement>("[data-reveal]");
  const n = cards.length;

  const state = { p: 0 }; // which card is in front (float while flipping)
  let st: ScrollTrigger | undefined;
  let lastLabel = -1;

  const render = () => {
    const H = cards[0].offsetHeight;
    const groupH = H + SHOWN * STRIP * H;
    const baseY = (stage.offsetHeight - groupH) / 2; // top of the front card
    const oy = stage.offsetHeight * 0.3; // perspective-origin (CSS: 50% 30%)

    for (let i = 0; i < n; i++) {
      const d = i - state.p;
      const el = cards[i];
      let y: number, z = 0, rx: number, opacity = 1, shade = 0, zi: number;
      if (d < 0) {
        // leaving: the card lifts up and away, tipping its top edge towards the viewer
        const t = clamp01(-d);
        y = baseY - smooth(t) * 0.55 * H;
        z = smooth(t) * 60;
        rx = -smooth(t) * 24;
        opacity = 1 - smooth(clamp01((t - 0.25) / 0.6));
        zi = 300;
      } else {
        const k = d;
        // pivots on the top edge, so the bottom edge turns away from the viewer — more for each card.
        // Place the card so its *projected* bottom edge peeks out k strips below the front card.
        const a = (k * LEAN * Math.PI) / 180;
        const target = baseY + H + k * STRIP * H;
        y = oy + ((target - oy) * (PERSP + H * Math.sin(a))) / PERSP - H * Math.cos(a);
        rx = -k * LEAN;
        opacity = k > SHOWN ? clamp01(SHOWN + 1 - k) : 1;
        shade = Math.min(k, SHOWN) * 0.05;
        zi = 200 - Math.round(k * 10);
      }
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = String(zi);
      el.style.visibility = opacity < 0.01 ? "hidden" : "";
      el.style.setProperty("--shade", shade.toFixed(3));
      el.classList.toggle("is-lifted", Math.abs(d) < 0.35);
    }

    const active = Math.max(0, Math.min(n - 1, Math.round(state.p)));
    if (active !== lastLabel) {
      lastLabel = active;
      if (nameEl) nameEl.textContent = links[active].dataset.title ?? "";
      if (indexEl) indexEl.textContent = String(active + 1).padStart(2, "0");
    }
  };

  const listeners: Array<() => void> = [];
  const on = (el: EventTarget, type: string, fn: (e: any) => void) => {
    el.addEventListener(type, fn);
    listeners.push(() => el.removeEventListener(type, fn));
  };

  const ctx = gsap.context(() => {
    gsap.from(reveals, {
      opacity: 0,
      y: 24,
      duration: 0.8,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: { trigger: section, start: "top 85%", toggleActions: "play none none reverse" },
    });

    // entry: the deck pulls back from a close-up as the section scrolls in
    gsap.fromTo(
      stage,
      { scale: 1.3, yPercent: 8 },
      {
        scale: 1,
        yPercent: 0,
        ease: "none",
        scrollTrigger: {
          trigger: stack,
          start: "top bottom",
          end: () => `top ${header?.offsetHeight ?? 0}px`,
          scrub: 0.4,
          invalidateOnRefresh: true,
        },
      },
    );

    // pinned: scroll flips through the deck, snapping to whole cards
    st = ScrollTrigger.create({
      trigger: stack,
      start: () => `top ${header?.offsetHeight ?? 0}px`,
      end: () => `+=${Math.max(1, n - 1) * window.innerHeight * PER_CARD}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      snap: n > 1 ? { snapTo: 1 / (n - 1), duration: { min: 0.2, max: 0.5 }, delay: 0.08, ease: "power2.inOut" } : undefined,
      onUpdate: (self) => {
        gsap.to(state, { p: self.progress * (n - 1), duration: 0.3, ease: "power2.out", overwrite: "auto", onUpdate: render });
      },
    });
  }, section);

  // keyboard: tabbing to a card scrolls the deck to it
  links.forEach((link, i) => {
    on(link, "focus", () => {
      if (!st || n < 2) return;
      window.scrollTo({ top: st.start + (st.end - st.start) * (i / (n - 1)) });
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
