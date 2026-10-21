/**
 * "What we do" — tabs.
 *  - Heading lines rise out of a mask on scroll (same as the other sections).
 *  - Click / arrow keys switch tabs: the cyan bar slides in on the active tab (CSS),
 *    the panel content comes in from a light blur, outputs one after another.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initServices() {
  const section = document.querySelector<HTMLElement>("[data-services]");
  if (!section) return;
  const tabs = Array.from(section.querySelectorAll<HTMLButtonElement>("[data-tab]"));
  const panels = Array.from(section.querySelectorAll<HTMLElement>("[data-panel]"));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = 0;

  const select = (i: number, focus = false) => {
    if (i === current) return;
    tabs[current].classList.remove("is-active");
    tabs[current].setAttribute("aria-selected", "false");
    tabs[current].tabIndex = -1;
    panels[current].classList.remove("is-active");
    panels[current].inert = true;
    current = i;
    tabs[i].classList.add("is-active");
    tabs[i].setAttribute("aria-selected", "true");
    tabs[i].tabIndex = 0;
    panels[i].classList.add("is-active");
    panels[i].inert = false;
    if (focus) tabs[i].focus();
    // on phones the tab row scrolls sideways: bring the active tab into view without moving the page
    const row = tabs[i].parentElement!;
    if (row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: tabs[i].offsetLeft - 16, behavior: reduce ? "auto" : "smooth" });
    }
    if (!reduce) {
      gsap.fromTo(
        panels[i].querySelectorAll("[data-anim]"),
        { opacity: 0, y: 12, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, stagger: 0.05, ease: "power3.out", overwrite: true },
      );
    }
  };

  const onClick = (e: Event) => select(tabs.indexOf(e.currentTarget as HTMLButtonElement));
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k !== "ArrowRight" && k !== "ArrowLeft" && k !== "Home" && k !== "End") return;
    e.preventDefault();
    const n = tabs.length;
    const next = k === "Home" ? 0 : k === "End" ? n - 1 : (current + (k === "ArrowRight" ? 1 : -1) + n) % n;
    select(next, true);
  };
  tabs.forEach((t) => {
    t.addEventListener("click", onClick);
    t.addEventListener("keydown", onKey);
  });

  const ctx = gsap.context(() => {
    if (reduce) return;
    gsap
      .timeline({ scrollTrigger: { trigger: section, start: "top 78%", toggleActions: "play none none reverse" } })
      .fromTo(
        section.querySelectorAll("[data-split] .line > span"),
        { yPercent: 105, opacity: 0, filter: "blur(8px)" },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.75, stagger: 0.09, ease: "power3.out" },
      )
      .fromTo(section.querySelectorAll("[data-fade]"), { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.6 }, 0.1)
      .fromTo(section.querySelector("[data-tabs-card]"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, 0.15);
  }, section);

  return () => {
    ctx.revert();
    tabs.forEach((t) => {
      t.removeEventListener("click", onClick);
      t.removeEventListener("keydown", onKey);
    });
  };
}
