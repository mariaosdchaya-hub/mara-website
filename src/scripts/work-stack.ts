/**
 * Selected work — a drum of case cards turned by scroll (after the LE:MA reference), which then
 * hands over to a row of compact cards (every case + a "Let's talk" card) under a nav bar.
 *
 * Drum: every case is on screen at once, as if stuck around a horizontal cylinder.
 *  - the active card sits in the middle, flat, slightly larger and closer;
 *  - earlier cases stack above it, each showing a shrinking strip, tilted back and further away;
 *  - later cases stack below it the same way;
 *  - scrolling turns the drum continuously (light snap to whole cards).
 * Exit: the drum keeps turning; cards slide up under the top edge of the stage and are cut off there,
 * while the row starts growing below — card by card from a 2 px line, the cover resolving as halftone dots.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// strips (in card heights H) each neighbour shows beyond the one nearer the centre
const STRIP_UP = [0.27, 0.2, 0.15, 0.115, 0.09, 0.07, 0.055];
const STRIP_DOWN = [0.3, 0.22, 0.165, 0.125, 0.095, 0.075, 0.06];
const TILT = 11; // deg per step away from the centre, capped
const DEPTH = 28; // px further from the camera per step
const POP = 1.08; // active card scale
const SHOWN = 3; // neighbours visible on each side
const PER_CARD = 0.5; // viewport heights of scroll per card

const cumStrip = (arr: number[], k: number) => {
  // total strip height for k (fractional) steps away from the centre
  let sum = 0;
  const whole = Math.floor(k);
  for (let j = 0; j < whole; j++) sum += arr[Math.min(j, arr.length - 1)];
  return sum + (k - whole) * arr[Math.min(whole, arr.length - 1)];
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
    len.trans = vh * 1.1;
    // the row may run past the right content edge to the viewport edge; it stops when its end meets the content edge
    const right = reel.getBoundingClientRect().left + reel.clientWidth;
    len.dist = Math.max(0, track.scrollWidth - (right - reel.getBoundingClientRect().left));
    len.row = Math.max(vh * 0.4, len.dist);
    len.total = len.deck + len.trans + len.row;
  };
  // Deck → row, scrubbed by state.t (0..1), after the LE:MA reference:
  //   0.00–0.35  the strips close up under the front card (see render) and the deck shrinks a little;
  //   0.30–0.62  the packed deck slides up and is cut off by the top edge of the stage (clip, no fade);
  //   0.48–1.00  the row "grows": each card starts as a 2 px grey line and extends down to full height,
  //              left to right; once a card is fully grown its cover, tags and text fade in.
  const rparts = rcards.map((c) => ({
    link: c.querySelector<HTMLElement>(".rcard__link")!,
    text: c.querySelectorAll<HTMLElement>(".rcard__tags, .rcard__info, .rcard__label, .rcard__cta"),
  }));
  const renderReel = () => {
    const t = state.t;
    // the turning drum slides up under the top edge of the stage and is cut there (no fade)
    const lift = smooth(clamp01((t - 0.15) / 0.5));
    stack.style.clipPath = t > 0 ? "inset(0 -100vw -100vh -100vw)" : "";
    stage.style.transform = `translateY(${(-lift * stage.offsetHeight * 1.1).toFixed(1)}px)`;
    stage.style.visibility = lift >= 1 ? "hidden" : "";
    metas.forEach((el) => (el.style.opacity = String(1 - smooth(clamp01(t / 0.25)))));

    // the row grows while the tail of the drum is still leaving
    reel.style.opacity = t > 0.3 ? "1" : "0";
    const H = rcards[0]?.offsetHeight ?? 0;
    rparts.forEach((r, i) => {
      const d = Math.min(i, 6) * 0.05;
      const g = smooth(clamp01((t - 0.32 - d) / 0.22));
      const c = clamp01((t - 0.5 - d) / 0.2);
      r.link.style.clipPath = g >= 1 ? "" : `inset(0 0 ${((H - 2) * (1 - g)).toFixed(1)}px 0)`;
      r.link.style.setProperty("--dot", `${(c * 3.6).toFixed(2)}px`);
      r.text.forEach((el) => {
        const ct = smooth(clamp01((c - 0.4) / 0.6));
        el.style.opacity = ct.toFixed(3);
        el.style.transform = ct >= 1 ? "" : `translateY(${((1 - ct) * 8).toFixed(1)}px)`;
      });
    });
    track.style.transform = `translate3d(${(-state.x * len.dist).toFixed(1)}px, 0, 0)`;
    section.classList.toggle("is-reel", t > 0.85);
    const cur = Math.round(state.x * (m - 1));
    nav.setProgress(state.x, cur, m);
  };
  let st: ScrollTrigger | undefined;
  let lastLabel = -1;

  const render = () => {
    const H = cards[0].offsetHeight;
    // centre the whole fan (strips above + card + strips below) in the stage
    const up = cumStrip(STRIP_UP, SHOWN) * H, down = cumStrip(STRIP_DOWN, SHOWN) * H;
    const cy = (stage.offsetHeight - (up + H + down)) / 2 + up + H / 2; // centre line of the active card
    // during the exit the drum keeps turning past the last card
    const p = state.p + smooth(clamp01(state.t / 0.55)) * (SHOWN + 1);

    for (let i = 0; i < n; i++) {
      const d = i - p;
      const k = Math.abs(d);
      const el = cards[i];
      const near = smooth(clamp01(1 - k)); // 1 at the centre → 0 one step away
      const scale = 1 + (POP - 1) * near;
      // earlier cards: top edge above the active card's top by the strips; later: bottom edge below its bottom
      const activeTop = cy - H / 2;
      const yTop = d < 0 ? activeTop - cumStrip(STRIP_UP, k) * H : activeTop + cumStrip(STRIP_DOWN, k) * H;
      const tilt = Math.min(k, 3) * TILT * (d < 0 ? 1 : -1);
      const z = -Math.min(k, SHOWN + 1) * DEPTH + near * 30;
      const opacity = k > SHOWN ? clamp01(SHOWN + 1 - k) : 1;
      el.style.transform = `translate3d(0, ${yTop.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = String(500 - Math.round(k * 20));
      el.style.visibility = opacity < 0.01 ? "hidden" : "";
      el.style.setProperty("--shade", (Math.min(k, SHOWN) * 0.06).toFixed(3));
      el.classList.toggle("is-lifted", k < 0.35 && state.t === 0);
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
