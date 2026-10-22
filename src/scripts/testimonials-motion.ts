/**
 * Testimonials — featured client stories, revealed on scroll (no pinning):
 *  - heading lines rise out of a mask;
 *  - each story card rises in; its photo sharpens from a blur and settles from a slight zoom,
 *    the quote and name fade up, the divider draws, and the result number counts up.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initTestimonials() {
  const section = document.querySelector<HTMLElement>("[data-testi]");
  if (!section) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const mobile = window.matchMedia("(max-width: 768px)").matches;

  const ctx = gsap.context(() => {
    gsap
      .timeline({ scrollTrigger: { trigger: section, start: "top 78%", toggleActions: "play none none reverse" } })
      .fromTo(
        section.querySelectorAll("[data-split] .line > span"),
        { yPercent: 105, opacity: 0, filter: "blur(8px)" },
        { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.75, stagger: 0.09, ease: "power3.out" },
      )
      .fromTo(section.querySelectorAll("[data-fade]"), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0);

    const stories = Array.from(section.querySelectorAll<HTMLElement>("[data-story]"));

    // stacking: while the next card slides over, the covered one sinks back a little and dims
    if (!mobile) {
      stories.slice(0, -1).forEach((story, i) => {
        const next = stories[i + 1];
        const content = story.querySelectorAll(":scope > *");
        const tl = gsap.timeline({
          scrollTrigger: { trigger: next, start: "top 85%", end: () => `top ${parseFloat(getComputedStyle(next).top) || 120}px`, scrub: 0.4 },
        });
        tl.to(story, { scale: 0.95 - (stories.length - 2 - i) * 0.02, ease: "none" }, 0)
          .to(content, { opacity: 0.35, ease: "none" }, 0);
      });
    }

    stories.forEach((story) => {
      const img = story.querySelector("[data-story-photo] img");
      const texts = story.querySelectorAll("[data-story-text]");
      const rule = story.querySelector("[data-story-rule]");
      const num = story.querySelector<HTMLElement>("[data-count]");
      const target = Number(num?.dataset.count ?? 0);
      const counter = { v: 0 };
      if (num) num.textContent = "0";

      gsap
        .timeline({ scrollTrigger: { trigger: story, start: "top 82%", toggleActions: "play none none reverse" } })
        .fromTo(story, { y: 48, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" })
        .fromTo(img, { scale: 1.12, filter: "grayscale(1) blur(10px)" }, { scale: 1, filter: "grayscale(1) blur(0px)", duration: 1, ease: "power3.out" }, 0.05)
        .fromTo(texts, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power2.out" }, 0.25)
        .fromTo(rule, mobile ? { scaleX: 0 } : { scaleY: 0 }, mobile ? { scaleX: 1, duration: 0.6, ease: "power2.inOut" } : { scaleY: 1, duration: 0.6, ease: "power2.inOut" }, 0.3)
        .fromTo(
          counter,
          { v: 0 },
          {
            v: target,
            duration: 1.3,
            ease: "power2.out",
            onUpdate: () => { if (num) num.textContent = String(Math.round(counter.v)); },
          },
          0.35,
        );
    });

    gsap.fromTo(
      section.querySelector("[data-cta]"),
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", scrollTrigger: { trigger: section.querySelector("[data-cta]"), start: "top 92%", toggleActions: "play none none reverse" } },
    );
  }, section);

  return () => ctx.revert();
}
