/**
 * Selected work — "filing cabinet" deck (reference: LE:MA cases section).
 *
 * All cases stand in a row like folders in a drawer, seen slightly from above:
 * each folder shows only its top strip, nearer folders sit lower and wider.
 * The folder under the pointer (or, while scrolling, the one at the scroll focus)
 * lifts out of the row and shows the whole card; folders in front settle down a bit.
 * Entering the section, the whole cabinet pulls back from a close-up.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// geometry, in card heights (H) unless noted — tuned frame-by-frame against the reference
const STEP_Y = 0.2; // vertical distance between folder tops
const STEP_Z = 45; // px each folder sits closer to the camera than the one behind
const LEAN = 14; // deg, folders lean back so tops recede
const LIFT_Y = 0.42; // how far a lifted folder rises
const LIFT_Z = 30; // px it comes forward
const FRONT_STRIP = 0.1; // strip each folder in front keeps visible below the lifted one
const FRONT_GAP = 0.025; // breathing room under the lifted card
const BEHIND_STRIP = 0.1; // strip each folder behind the lifted one keeps visible above it
const FRAME_UP = 0.18; // nearer folders render larger, so frame the row a little high
const DRIFT = 0.35; // camera travel along the row over the whole scroll (H)

const smooth = (x: number) => x * x * (3 - 2 * x);

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
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // focus = which folder is lifted (float, so lifting blends between neighbours)
  // lift  = 0..1 overall strength (0 = all folders resting in the row)
  const state = { focus: 0, lift: 0, drift: 0 };
  let scrollFocus = 0;
  let hovered: number | null = null;
  let lastLabel = -1;

  const render = () => {
    const H = cards[0].offsetHeight;
    // centre the row in the stage; drift moves the "camera" along it
    const rowH = (n - 1) * STEP_Y * H + H;
    const baseY = (stage.offsetHeight - rowH) / 2 - FRAME_UP * H - state.drift * H;

    for (let i = 0; i < n; i++) {
      const dist = Math.abs(i - state.focus);
      const up = smooth(Math.max(0, 1 - dist)) * state.lift; // this folder's lift 0..1
      // folders behind shuffle up just enough that each keeps a strip above the lifted one
      const k = state.focus - i;
      const makeRoom = k > 0 ? Math.max(0, LIFT_Y - k * (STEP_Y - BEHIND_STRIP)) * state.lift * smooth(Math.min(1, k)) : 0;
      // folders in front sink below the lifted card's bottom edge, compressed into strips
      const f = i - state.focus;
      const settle =
        f > 0
          ? Math.max(0, 1 - LIFT_Y + FRONT_GAP + (f - 1) * FRONT_STRIP - f * STEP_Y) * state.lift * smooth(Math.min(1, f))
          : 0;
      const y = baseY + i * STEP_Y * H - up * LIFT_Y * H + settle * H - makeRoom * H;
      const z = i * STEP_Z + up * LIFT_Z;
      const lean = LEAN * (1 - up);
      const el = cards[i];
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${lean.toFixed(2)}deg)`;
      el.style.zIndex = String(up > 0.5 ? 100 : 10 + i); // the lifted folder sits on top
      el.style.setProperty("--shade", ((1 - up) * (n - 1 - i) * 0.025).toFixed(3));
      el.classList.toggle("is-lifted", up > 0.6);
    }

    const active = Math.max(0, Math.min(n - 1, Math.round(state.focus)));
    if (active !== lastLabel) {
      lastLabel = active;
      if (nameEl) nameEl.textContent = links[active].dataset.title ?? "";
      if (indexEl) indexEl.textContent = String(active + 1).padStart(2, "0");
    }
  };

  const go = (vars: Partial<typeof state>, duration = 0.5) =>
    gsap.to(state, { ...vars, duration, ease: "power3.out", overwrite: "auto", onUpdate: render });

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

    // entry: the cabinet pulls back from a close-up as the section scrolls in
    gsap.fromTo(
      stage,
      { scale: 1.45, yPercent: 8 },
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

    // pinned browse: scroll walks the focus along the row and drifts the camera
    ScrollTrigger.create({
      trigger: stack,
      start: () => `top ${header?.offsetHeight ?? 0}px`,
      end: () => `+=${Math.max(1, n) * window.innerHeight * 0.45}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        scrollFocus = self.progress * (n - 1);
        state.drift = (self.progress - 0.5) * DRIFT;
        // on touch there is no hover, so scrolling lifts the folder at the focus
        if (hovered === null) go({ focus: scrollFocus, lift: canHover ? state.lift : 1 }, 0.35);
        else render();
      },
      onLeave: () => !canHover && go({ lift: 0 }),
      onLeaveBack: () => !canHover && go({ lift: 0 }),
    });
  }, section);

  // hover: lift the folder under the pointer; leaving the cabinet lets the row settle
  if (canHover) {
    cards.forEach((card, i) => {
      let timer = 0;
      on(card, "pointerenter", () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          hovered = i;
          go({ focus: i, lift: 1 }, 0.55);
        }, 60);
      });
      on(card, "pointerleave", () => clearTimeout(timer));
    });
    on(stage, "pointerleave", () => {
      hovered = null;
      go({ lift: 0, focus: scrollFocus }, 0.6);
    });
  }

  // keyboard: focusing a card lifts it
  links.forEach((link, i) => {
    on(link, "focus", () => {
      hovered = i;
      go({ focus: i, lift: 1 });
    });
    on(link, "blur", () => {
      hovered = null;
      go({ lift: canHover ? 0 : 1, focus: scrollFocus });
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
