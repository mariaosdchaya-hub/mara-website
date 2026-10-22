/**
 * Selected work — card deck you flip through with scroll, which then turns into a row of
 * compact cards (every case + a "Let's talk" card) that scrolls sideways under a nav bar.
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
// Figma (Selected Work): strips under the front card show 100, 70 and 45 px of a 529 px card,
// and get wider at the bottom (1002 → 1040 → 1060 px) — their bottom edges turn towards the viewer.
const PEEK = [0, 0.19, 0.32, 0.405]; // projected bottom edge of card k, below the front card's bottom, in H
const TILT = [0, 7, 10, 11.5]; // deg, bottom edge towards the viewer
const PERSP = 1500; // px, matches .stack__stage perspective
const SHOWN = 3; // waiting cards visible behind the front one
const PER_CARD = 0.55; // viewport heights of scroll per flip

const lerpAt = (arr: number[], k: number) => {
  const i = Math.min(Math.floor(k), arr.length - 2);
  return arr[i] + (arr[i + 1] - arr[i]) * Math.min(1, k - i);
};
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function initWorkStack() {
  const section = document.querySelector<HTMLElement>("[data-work]");
  const stack = section?.querySelector<HTMLElement>("[data-stack]");
  if (!section || !stack) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = window.matchMedia("(min-width: 1101px)").matches;
  if (reduce || !desktop) return initNativeReel(section); // swipe row (CSS), arrows + progress wired here

  section.classList.add("is-3d");
  const stage = stack.querySelector<HTMLElement>(".stack__stage")!;
  const cards = Array.from(stack.querySelectorAll<HTMLElement>("[data-card]"));
  const links = cards.map((c) => c.querySelector<HTMLAnchorElement>("a")!);
  const nameEl = stack.querySelector<HTMLElement>("[data-stack-name]");
  const indexEl = stack.querySelector<HTMLElement>("[data-stack-index]");
  const header = document.querySelector<HTMLElement>(".header");
  const reveals = section.querySelectorAll<HTMLElement>("[data-reveal]");
  const n = cards.length;

  const reel = section.querySelector<HTMLElement>("[data-reel]")!;
  const track = section.querySelector<HTMLElement>("[data-reel-track]")!;
  const rcards = Array.from(section.querySelectorAll<HTMLElement>("[data-rcard]"));
  const metas = section.querySelectorAll<HTMLElement>(".stack__meta");
  const nav = navRefs(section);
  const m = rcards.length;

  const state = { p: 0, t: 0, x: 0 }; // deck position · deck→row transition · row scroll (0..1)
  const len = { deck: 0, trans: 0, row: 0, dist: 0, total: 1 };
  const measure = () => {
    const vh = window.innerHeight;
    len.deck = Math.max(1, n - 1) * vh * PER_CARD;
    len.trans = vh * 0.5;
    // the row may run past the right content edge to the viewport edge; it stops when its end meets the content edge
    const right = reel.getBoundingClientRect().left + reel.clientWidth;
    len.dist = Math.max(0, track.scrollWidth - (right - reel.getBoundingClientRect().left));
    len.row = Math.max(vh * 0.4, len.dist);
    len.total = len.deck + len.trans + len.row;
  };
  const renderReel = () => {
    const t = state.t, e = smooth(t);
    stage.style.opacity = String(1 - e);
    stage.style.transform = `scale(${1 - 0.18 * e}) translateY(${-4 * e}%)`;
    stage.style.visibility = t >= 1 ? "hidden" : "";
    metas.forEach((el) => (el.style.opacity = String(1 - e)));
    reel.style.opacity = String(e);
    track.style.transform = `translate3d(${((1 - e) * 160 - state.x * len.dist).toFixed(1)}px, 0, 0)`;
    section.classList.toggle("is-reel", t > 0.5);
    const cur = Math.round(state.x * (m - 1));
    nav.setProgress(state.x, cur, m);
  };
  let st: ScrollTrigger | undefined;
  let lastLabel = -1;

  const render = () => {
    const H = cards[0].offsetHeight;
    const groupH = H * (1 + PEEK[SHOWN]);
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
        // pivots on the top edge; place the card so its *projected* bottom edge lands PEEK[k] below the front card
        const kk = Math.min(k, SHOWN);
        const deg = lerpAt(TILT, kk);
        const a = (deg * Math.PI) / 180;
        const target = baseY + H + lerpAt(PEEK, kk) * H;
        y = oy + ((target - oy) * (PERSP - H * Math.sin(a))) / PERSP - H * Math.cos(a);
        rx = deg;
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
          trigger: window.matchMedia("(min-width: 1101px)").matches ? section : stack,
          start: "top bottom",
          end: () => `top ${header?.offsetHeight ?? 0}px`,
          scrub: 0.4,
          invalidateOnRefresh: true,
        },
      },
    );

    // pinned: scroll flips through the deck (snapping to whole cards), turns it into the row, then scrolls the row
    const pinEl = section;
    measure();
    st = ScrollTrigger.create({
      trigger: pinEl,
      start: () => `top ${header?.offsetHeight ?? 0}px`,
      end: () => `+=${len.total}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefreshInit: measure,
      snap: {
        snapTo: (v: number) => {
          const sAt = v * len.total;
          if (sAt > len.deck + len.trans) return v; // free scrolling along the row
          const points = Array.from({ length: n }, (_, k) => (k / Math.max(1, n - 1)) * len.deck).concat(len.deck + len.trans);
          const best = points.reduce((a, b) => (Math.abs(b - sAt) < Math.abs(a - sAt) ? b : a));
          return best / len.total;
        },
        duration: { min: 0.2, max: 0.5 },
        delay: 0.08,
        ease: "power2.inOut",
      },
      onUpdate: (self) => {
        const sAt = self.progress * len.total;
        const p = Math.min(1, sAt / len.deck) * (n - 1);
        const t = clamp01((sAt - len.deck) / len.trans);
        const x = clamp01((sAt - len.deck - len.trans) / len.row);
        gsap.to(state, {
          p, t, x, duration: 0.3, ease: "power2.out", overwrite: "auto",
          onUpdate: () => { render(); renderReel(); },
        });
      },
    });

    // arrows: jump the scroll to the previous / next card of the row
    const goTo = (j: number) => {
      if (!st) return;
      const k = Math.max(0, Math.min(m - 1, j));
      const sAt = len.deck + len.trans + len.row * (k / Math.max(1, m - 1));
      window.scrollTo({ top: st.start + sAt, behavior: "smooth" });
    };
    nav.onPrev(() => goTo(Math.round(state.x * (m - 1)) - 1));
    nav.onNext(() => goTo(Math.round(state.x * (m - 1)) + 1));
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
  renderReel();

  return () => {
    ctx.revert();
    ro.disconnect();
    listeners.forEach((off) => off());
    section.classList.remove("is-3d", "is-reel");
    nav.off();
  };
}

/** Nav bar under the row: progress line, "03 / 09" counter, prev / next buttons. */
function navRefs(section: HTMLElement) {
  const fill = section.querySelector<HTMLElement>("[data-wnav-fill]");
  const count = section.querySelector<HTMLElement>("[data-wnav-count]");
  const prev = section.querySelector<HTMLButtonElement>("[data-wnav-prev]");
  const next = section.querySelector<HTMLButtonElement>("[data-wnav-next]");
  const offs: Array<() => void> = [];
  const pad = (v: number) => String(v).padStart(2, "0");
  return {
    setProgress(x: number, cur: number, total: number) {
      fill?.style.setProperty("--p", x.toFixed(4));
      if (count) count.textContent = `${pad(cur + 1)} / ${pad(total)}`;
      if (prev) prev.disabled = cur <= 0;
      if (next) next.disabled = cur >= total - 1;
    },
    onPrev(fn: () => void) { prev?.addEventListener("click", fn); offs.push(() => prev?.removeEventListener("click", fn)); },
    onNext(fn: () => void) { next?.addEventListener("click", fn); offs.push(() => next?.removeEventListener("click", fn)); },
    off() { offs.forEach((f) => f()); },
  };
}

/** Tablet / phone / reduced motion: no deck, the row is a native swipe row; wire arrows + progress to it. */
function initNativeReel(section: HTMLElement) {
  const reel = section.querySelector<HTMLElement>("[data-reel]");
  const cards = Array.from(section.querySelectorAll<HTMLElement>("[data-rcard]"));
  if (!reel || !cards.length) return;
  const nav = navRefs(section);
  const step = () => cards[0].offsetWidth + 12;
  const update = () => {
    const max = reel.scrollWidth - reel.clientWidth;
    const x = max > 0 ? reel.scrollLeft / max : 0;
    nav.setProgress(x, Math.round(reel.scrollLeft / step()), cards.length);
  };
  const smoothBehavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  nav.onPrev(() => reel.scrollBy({ left: -step(), behavior: smoothBehavior }));
  nav.onNext(() => reel.scrollBy({ left: step(), behavior: smoothBehavior }));
  reel.addEventListener("scroll", update, { passive: true });
  update();
  return () => { nav.off(); reel.removeEventListener("scroll", update); };
}
