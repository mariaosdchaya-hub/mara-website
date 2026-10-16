/**
 * Testimonials — the section pins and scroll turns a 3D photo rolodex:
 * the current client photo lies flat on top, the next ones wait below as strips tilted
 * away from the viewer (Figma: 294 / 75 / 45 / 34 px tall). Scrolling flips the top photo
 * up and over, and the next strip swings up flat to take its place. The quote, name and
 * counter switch with it. Arrows jump the scroll to the previous / next photo.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const PER_ITEM = 0.6; // viewport heights of scroll per testimonial
const CARD_H = 294; // Figma card height at 480 px wide
const GAP = 10;
// resting pose for the card at distance d below the current one: top offset + tilt (deg)
// tilts tuned so the projected strips are ~75, 45, 34 px tall with the viewer at the bottom edge
const POSES = [
  { y: 0, a: 0 },
  { y: CARD_H + GAP, a: 78.6 },
  { y: CARD_H + GAP + 75 + GAP, a: 82.6 },
  { y: CARD_H + GAP + 75 + GAP + 45 + GAP, a: 83.4 },
  { y: CARD_H + GAP + 75 + GAP + 45 + GAP + 34 + GAP, a: 86 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function initTestimonials() {
  const section = document.querySelector<HTMLElement>("[data-testi]");
  const rolodex = section?.querySelector<HTMLElement>("[data-rolodex]");
  if (!section || !rolodex) return;

  const cards = Array.from(rolodex.querySelectorAll<HTMLElement>("[data-tcard]"));
  const quotes = Array.from(section.querySelectorAll<HTMLElement>("[data-quote]"));
  const indexEl = section.querySelector<HTMLElement>("[data-testi-index]");
  const prev = section.querySelector<HTMLButtonElement>("[data-testi-prev]");
  const next = section.querySelector<HTMLButtonElement>("[data-testi-next]");
  const header = document.querySelector<HTMLElement>(".header");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const n = cards.length;
  let current = 0;
  let progress = 0;
  let st: ScrollTrigger | undefined;

  const scale = () => {
    const s = rolodex.offsetWidth / 480;
    rolodex.style.setProperty("--s", String(s));
    section.style.setProperty("--s", String(s));
    return s;
  };

  const render = () => {
    const s = scale();
    cards.forEach((card, i) => {
      const d = i - progress;
      let y: number, a: number, opacity = 1, shade = 0;
      if (d <= -1) {
        y = -40; a = -90; opacity = 0;
      } else if (d < 0) {
        // the top photo flips up and over its top edge and fades
        const t = -d;
        y = lerp(0, -40, t);
        a = lerp(0, -90, t);
        opacity = 1 - t * t;
      } else {
        const k = Math.min(Math.floor(d), POSES.length - 2);
        const t = Math.min(1, d - k);
        y = lerp(POSES[k].y, POSES[k + 1].y, t);
        a = lerp(POSES[k].a, POSES[k + 1].a, t);
        shade = Math.min(0.25, (a / 90) * 0.25);
        if (d > POSES.length - 2) opacity = Math.max(0, 1 - (d - (POSES.length - 2)));
      }
      card.style.transform = `translate3d(0, ${(y * s).toFixed(1)}px, 0) rotateX(${(-a).toFixed(2)}deg)`;
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(d < 0 ? 40 : 30 - Math.round(d));
      card.style.setProperty("--shade", shade.toFixed(3));
    });
  };

  const showQuote = (i: number) => {
    if (i === current) return;
    const down = i > current;
    const out = quotes[current];
    const inc = quotes[i];
    current = i;
    out.setAttribute("aria-hidden", "true");
    inc.removeAttribute("aria-hidden");
    quotes.forEach((q) => q !== out && q !== inc && q.classList.remove("is-active"));
    inc.classList.add("is-active");
    if (indexEl) indexEl.textContent = String(i + 1).padStart(2, "0");
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === n - 1;
    if (reduce) {
      out.classList.remove("is-active");
      return;
    }
    const outParts = out.querySelectorAll("[data-part]");
    const inParts = inc.querySelectorAll("[data-part]");
    gsap.killTweensOf([...outParts, ...inParts]);
    gsap.to(outParts, {
      y: down ? -16 : 16, opacity: 0, filter: "blur(6px)", duration: 0.28, stagger: 0.03, ease: "power2.in",
      onComplete: () => { if (quotes[current] !== out) out.classList.remove("is-active"); },
    });
    gsap.fromTo(
      inParts,
      { y: down ? 22 : -22, opacity: 0, filter: "blur(8px)" },
      { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.5, stagger: 0.06, ease: "power3.out", delay: 0.15 },
    );
  };

  const goTo = (i: number) => {
    i = Math.max(0, Math.min(n - 1, i));
    if (st) {
      const y = st.start + (st.end - st.start) * (i / (n - 1));
      window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    } else {
      progress = i;
      render();
      showQuote(i);
    }
  };

  const ctx = gsap.context(() => {
    st = ScrollTrigger.create({
      trigger: section,
      start: () => `top ${header?.offsetHeight ?? 0}px`,
      end: () => `+=${(n - 1) * window.innerHeight * PER_ITEM}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      snap: reduce ? undefined : { snapTo: 1 / (n - 1), duration: { min: 0.2, max: 0.5 }, delay: 0.08, ease: "power2.inOut" },
      onUpdate: (self) => {
        progress = self.progress * (n - 1);
        render();
        showQuote(Math.round(progress));
      },
    });
  }, section);

  const onPrev = () => goTo(current - 1);
  const onNext = () => goTo(current + 1);
  prev?.addEventListener("click", onPrev);
  next?.addEventListener("click", onNext);
  if (prev) prev.disabled = true;
  const ro = new ResizeObserver(render);
  ro.observe(rolodex);
  render();

  return () => {
    ctx.revert();
    ro.disconnect();
    prev?.removeEventListener("click", onPrev);
    next?.removeEventListener("click", onNext);
  };
}
