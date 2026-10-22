/**
 * Project calculator — ballpark price from scope × selected services.
 *
 *   hours  = Σ selected options (per-screen hours × screens of the project type, or fixed hours)
 *   hours *= 1.15                       // project management + QA
 *   price  = hours × RATE ($40/h)
 *   range  = [price × 0.9, price × 1.25], rounded to $500
 *   low   ≥ floor: type minimum (landing $2k, MVP $3.5k …), or $1.5k when only optimization is picked
 *   above $30k the box shows "$30k+" (matches the contact form budget buckets)
 *   timeline = hours ÷ 40–60 h per week
 *
 * All numbers are in CONFIG so the studio can tune them without touching the logic.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const CONFIG = {
  rate: 40, // $/hour
  overhead: 0.15, // PM + QA on top of production hours
  spread: [0.9, 1.25] as const, // low / high multipliers of the point estimate
  round: 500,
  minAny: 1500, // nothing is cheaper than this
  cap: 30000, // shown as "$30k+"
  weekly: [40, 60] as const, // team hours per week (slow / fast) → timeline
  types: {
    landing: { screens: 3, min: 2000 },
    website: { screens: 8, min: 2500 },
    mvp: { screens: 22, min: 3500 },
    platform: { screens: 45, min: 7000 },
  } as Record<string, { screens: number; min: number }>,
  // hours: per = per screen, fixed = once per project
  options: {
    flows: { per: 0.5 },
    wireframes: { per: 1 },
    ui: { per: 3 },
    ux: { per: 0.5, fixed: 12 },
    nocode: { per: 2 },
    custom: { per: 4 },
    cms: { fixed: 10 },
    seo: { fixed: 10 },
    analytics: { fixed: 6 },
    cro: { fixed: 16 },
    perf: { fixed: 8 },
  } as Record<string, { per?: number; fixed?: number }>,
};

const fmt = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`);
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function estimate(type: string, selected: string[]) {
  const t = CONFIG.types[type] ?? CONFIG.types.mvp;
  let hours = 0;
  for (const id of selected) {
    const o = CONFIG.options[id];
    if (!o) continue;
    hours += (o.per ?? 0) * t.screens + (o.fixed ?? 0);
  }
  hours *= 1 + CONFIG.overhead;
  const onlyOptimization = selected.every((id) => ["seo", "analytics", "cro", "perf"].includes(id));
  const floor = onlyOptimization ? CONFIG.minAny : Math.max(CONFIG.minAny, t.min);
  const price = hours * CONFIG.rate;
  const low = Math.max(floor, roundTo(price * CONFIG.spread[0], CONFIG.round));
  const high = Math.max(low + CONFIG.round, roundTo(price * CONFIG.spread[1], CONFIG.round));
  const weeksFast = Math.max(1, Math.ceil(hours / CONFIG.weekly[1]));
  const weeksSlow = Math.max(weeksFast + 1, Math.ceil(hours / CONFIG.weekly[0]));
  return { hours, low, high, weeks: [weeksFast, weeksSlow] as [number, number] };
}

export function initCalculator() {
  const section = document.querySelector<HTMLElement>("[data-calc]");
  const form = section?.querySelector<HTMLFormElement>("[data-calc-form]");
  if (!section || !form) return;
  const priceEl = section.querySelector<HTMLElement>("[data-calc-price]")!;
  const timeEl = section.querySelector<HTMLElement>("[data-calc-time]")!;
  const cta = section.querySelector<HTMLAnchorElement>("[data-calc-cta]");
  const groups = Array.from(form.querySelectorAll<HTMLElement>("[data-group]"));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shown = { low: 0, high: 0 };
  let first = true;

  const read = () => {
    const type = (form.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value) ?? "mvp";
    const selected: string[] = [];
    groups.forEach((g) => {
      const on = g.querySelector<HTMLInputElement>("[data-switch]")!.checked;
      g.classList.toggle("is-on", on);
      g.querySelectorAll<HTMLInputElement>("[data-opt]").forEach((o) => {
        o.disabled = !on;
        if (on && o.checked) selected.push(o.value);
      });
    });
    return { type, selected };
  };

  const paint = (low: number, high: number, capped: boolean) => {
    priceEl.textContent = capped ? `${fmt(CONFIG.cap)}+` : `${fmt(low)}–${fmt(high)}`;
  };

  const update = () => {
    const { type, selected } = read();
    if (!selected.length) {
      priceEl.textContent = "—";
      timeEl.textContent = "Pick at least one option";
      return;
    }
    const e = estimate(type, selected);
    const capped = e.low >= CONFIG.cap;
    const high = Math.min(e.high, CONFIG.cap);
    timeEl.textContent = `≈ ${e.weeks[0]}–${e.weeks[1]} weeks`;
    if (first || reduce || capped) {
      first = false;
      shown.low = e.low;
      shown.high = high;
      paint(e.low, high, capped);
    } else {
      gsap.to(shown, {
        low: e.low,
        high,
        duration: 0.5,
        ease: "power2.out",
        overwrite: true,
        onUpdate: () => paint(roundTo(shown.low, 100), roundTo(shown.high, 100), false),
        onComplete: () => paint(e.low, high, false),
      });
    }
    // hand the selection to the contact form (read there when it exists)
    try {
      sessionStorage.setItem("mara-estimate", JSON.stringify({ type, selected, low: e.low, high: e.high }));
    } catch {}
    if (cta) cta.dataset.range = `${e.low}-${e.high}`;
  };

  // "No-code build" and "Custom front-end" are alternatives
  const onChange = (ev: Event) => {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.exclusive && t.checked) {
      form.querySelectorAll<HTMLInputElement>(`[data-exclusive="${t.dataset.exclusive}"]`).forEach((o) => {
        if (o !== t) o.checked = false;
      });
    }
    update();
  };
  form.addEventListener("change", onChange);
  update();

  const ctx = gsap.context(() => {
    if (reduce) return;
    gsap.fromTo(
      section.querySelectorAll("[data-split] .line > span"),
      { yPercent: 105, opacity: 0, filter: "blur(8px)" },
      {
        yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.75, stagger: 0.09, ease: "power3.out",
        scrollTrigger: { trigger: section, start: "top 78%", toggleActions: "play none none reverse" },
      },
    );
  }, section);

  return () => {
    ctx.revert();
    form.removeEventListener("change", onChange);
  };
}
