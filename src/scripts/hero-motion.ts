/**
 * Mara hero motion
 * idle loop video → hover "charging" → scroll-pinned light expansion → white.
 * The transition is a pre-extracted frame sequence of hero-light-transition.mp4
 * drawn to <canvas>, so scroll position maps to exact frames (no Safari seek lag).
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Cleanup = () => void;

const SEQ = {
  lg: { dir: "/hero/seq/d", count: 75 }, // 1280×720, every 2nd frame
  sm: { dir: "/hero/seq/m", count: 50 }, // 640×360, every 3rd frame
};

export function initHeroMotion(): Cleanup | undefined {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  if (!hero) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    hero.classList.add("is-static");
    return;
  }

  const video = hero.querySelector<HTMLVideoElement>(".hero__video")!;
  const canvas = hero.querySelector<HTMLCanvasElement>(".hero__seq")!;
  const glow = hero.querySelector<HTMLElement>(".hero__glow")!;
  const fade = hero.querySelector<HTMLElement>(".hero__fade")!;
  const white = hero.querySelector<HTMLElement>(".hero__white")!;
  const inner = hero.querySelector<HTMLElement>(".hero__inner")!;
  const header = document.querySelector<HTMLElement>(".header");
  const ctx2d = canvas.getContext("2d", { alpha: false })!;

  const small = window.matchMedia("(max-width: 767px)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const seq = small ? SEQ.sm : SEQ.lg;
  const listeners: Array<() => void> = [];
  const on = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement | Window | Document,
    type: K | string,
    fn: (e: any) => void,
    opts?: AddEventListenerOptions,
  ) => {
    el.addEventListener(type, fn, opts);
    listeners.push(() => el.removeEventListener(type, fn, opts));
  };

  /* ---------- header height → CSS var (pin offset + hero height) ---------- */
  const setHeaderH = () =>
    document.documentElement.style.setProperty("--header-h", `${header?.offsetHeight ?? 0}px`);
  setHeaderH();

  /* ---------- 1. idle video ---------- */
  const addSource = (src: string, type: string) => {
    const s = document.createElement("source");
    s.src = src;
    s.type = type;
    video.appendChild(s);
  };
  if (small) {
    addSource(video.dataset.srcSmMp4!, "video/mp4");
  } else {
    addSource(video.dataset.srcLgWebm!, "video/webm");
    addSource(video.dataset.srcLgMp4!, "video/mp4");
  }
  video.muted = true;
  video.preload = "auto";
  video.load();

  let pinnedPastVideo = false; // canvas fully covers the video → no need to decode it
  let heroVisible = true;
  const syncPlayback = () => {
    if (heroVisible && !pinnedPastVideo && !document.hidden) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };
  syncPlayback();
  const io = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    syncPlayback();
  });
  io.observe(hero);
  on(document, "visibilitychange", syncPlayback);

  /* ---------- charge (hover + scroll share one value) ---------- */
  const charge = { hover: 0, scroll: 0 };
  const applyCharge = () =>
    hero.style.setProperty("--charge", Math.max(charge.hover, charge.scroll).toFixed(3));

  /* ---------- 3. hover: subtle charging + glow follows pointer ---------- */
  if (canHover) {
    const gx = gsap.quickTo(hero, "--gx", { duration: 0.6, ease: "power3.out", unit: "%" } as any);
    const gy = gsap.quickTo(hero, "--gy", { duration: 0.6, ease: "power3.out", unit: "%" } as any);
    on(hero, "pointerenter", () =>
      gsap.to(charge, { hover: 0.6, duration: 0.4, ease: "power2.out", overwrite: true, onUpdate: applyCharge }),
    );
    on(hero, "pointerleave", () =>
      gsap.to(charge, { hover: 0, duration: 0.45, ease: "power2.out", overwrite: true, onUpdate: applyCharge }),
    );
    on(hero, "pointermove", (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      gx(((e.clientX - r.left) / r.width) * 100);
      gy(((e.clientY - r.top) / r.height) * 100);
    });
  }

  /* ---------- 2. frame sequence on canvas ---------- */
  const frames: (HTMLImageElement | undefined)[] = new Array(seq.count);
  let current = -1;
  let loadingStarted = false;

  const frameSrc = (i: number) => `${seq.dir}/${String(i + 1).padStart(3, "0")}.webp`;

  const sizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
    const w = Math.round(hero.clientWidth * dpr);
    const h = Math.round(hero.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ctx2d.imageSmoothingQuality = "high";
      if (current >= 0) draw(current, true);
    }
  };

  // nearest already-decoded frame, so scrubbing never shows a blank canvas
  const nearestLoaded = (i: number) => {
    for (let d = 0; d < seq.count; d++) {
      if (frames[i - d]) return i - d;
      if (frames[i + d]) return i + d;
    }
    return -1;
  };

  const draw = (i: number, force = false) => {
    if (i === current && !force) return;
    const idx = nearestLoaded(i);
    if (idx < 0) return;
    const img = frames[idx]!;
    current = idx === i ? i : current;
    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // object-fit: cover
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx2d.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  };

  let wanted = 0;
  const loadFrames = () => {
    if (loadingStarted) return;
    loadingStarted = true;
    // order: first frame, then coarse-to-fine so any scroll position has a close frame early
    const order: number[] = [];
    for (const step of [8, 4, 2, 1]) {
      for (let i = 0; i < seq.count; i += step) if (!order.includes(i)) order.push(i);
    }
    let cursor = 0;
    const CONCURRENCY = small ? 3 : 5;
    const next = () => {
      if (cursor >= order.length) return;
      const i = order[cursor++];
      const img = new Image();
      img.decoding = "async";
      img.src = frameSrc(i);
      img
        .decode()
        .catch(() => {})
        .finally(() => {
          if (img.naturalWidth) frames[i] = img;
          draw(wanted, true);
          next();
        });
    };
    for (let k = 0; k < CONCURRENCY; k++) next();
  };

  // lazy: start after the page settled, or immediately on first scroll intent
  const idle = (window as any).requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 1200));
  const idleId = idle(loadFrames, { timeout: 2500 });
  on(window, "scroll", loadFrames, { passive: true, once: true });

  sizeCanvas();
  const ro = new ResizeObserver(() => {
    setHeaderH();
    sizeCanvas();
  });
  ro.observe(hero);

  /* ---------- 4. scroll-driven light expansion ---------- */
  const gctx = gsap.context(() => {
    const seqProxy = { f: 0 };

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: hero,
        start: () => `top ${header?.offsetHeight ?? 0}px`,
        end: "+=100%",
        pin: true,
        pinSpacing: true,
        scrub: small ? 0.35 : 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onEnter: loadFrames,
        onUpdate: (self) => {
          const past = self.progress > 0.42;
          if (past !== pinnedPastVideo) {
            pinnedPastVideo = past;
            syncPlayback();
          }
        },
      },
    });

    // 0–15%: still dark, cyan intensifies
    tl.to(charge, { scroll: 1, duration: 0.15, onUpdate: applyCharge }, 0);

    // 15–45%: light-transition footage takes over from the idle loop
    tl.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.15);
    tl.to(fade, { opacity: 0, duration: 0.25 }, 0.18);
    tl.to(
      seqProxy,
      {
        f: seq.count - 1,
        duration: 0.8,
        onUpdate: () => {
          wanted = Math.round(seqProxy.f);
          draw(wanted);
        },
      },
      0.15,
    );

    // 45–75%: architecture dissolves, UI steps out of the way
    tl.to(glow, { opacity: 0, duration: 0.25 }, 0.45);
    tl.to(inner, { autoAlpha: 0, y: -40, duration: 0.25, ease: "power1.in" }, 0.45);

    // 75–100%: blend the last frames into pure #FFFFFF (matches next section)
    tl.fromTo(white, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power1.inOut" }, 0.77);
    tl.to({}, { duration: 0.03 }, 0.97);
  }, hero);

  // draw the first frame as soon as it exists so the 15% handoff is seamless
  wanted = 0;

  return () => {
    gctx.revert();
    io.disconnect();
    ro.disconnect();
    (window as any).cancelIdleCallback?.(idleId);
    listeners.forEach((off) => off());
    video.pause();
  };
}
