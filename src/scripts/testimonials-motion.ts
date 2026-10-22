/**
 * Testimonials — featured client stories.
 *
 * Desktop: the section pins under the header so the title, subtitle and CTA stay in view;
 * scrolling slides each next story up over the previous one, which sinks back and dims
 * (a stack, 14 px of each earlier card left showing on top). Each story plays its own reveal
 * as it lands: the photo sharpens, the text rises, the rule draws and the number counts up.
 * Mobile: plain list, each story revealed as it scrolls in.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const PEEK = 14; // px of each earlier card left showing above the next
const PER_STORY = 0.6; // viewport heights of scroll per story

export function initTestimonials() {
  const section = document.querySelector<HTMLElement>("[data-testi]");
  if (!section) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  const header = document.querySelector<HTMLElement>(".header");
  const stage = section.querySelector<HTMLElement>(".stories")!;
  const stories = Array.from(section.querySelectorAll<HTMLElement>("[data-story]"));
  const n = stories.length;

  // one story's own reveal (paused; played when it arrives)
  const reveal = (story: HTMLElement) => {
    const img = story.querySelector("[data-story-photo] img");
    const texts = story.querySelectorAll("[data-story-text]");
    const rule = story.querySelector("[data-story-rule]");
    const num = story.querySelector<HTMLElement>("[data-count]");
    const target = Number(num?.dataset.count ?? 0);
    const counter = { v: 0 };
    if (num) num.textContent = "0";
    return gsap
      .timeline({ paused: true })
      .fromTo(img, { scale: 1.12, filter: "grayscale(1) blur(10px)" }, { scale: 1, filter: "grayscale(1) blur(0px)", duration: 1, ease: "power3.out" }, 0)
      .fromTo(texts, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power2.out" }, 0.15)
      .fromTo(rule, mobile ? { scaleX: 0 } : { scaleY: 0 }, mobile ? { scaleX: 1, duration: 0.6, ease: "power2.inOut" } : { scaleY: 1, duration: 0.6, ease: "power2.inOut" }, 0.2)
      .fromTo(counter, { v: 0 }, { v: target, duration: 1.3, ease: "power2.out", onUpdate: () => { if (num) num.textContent = String(Math.round(counter.v)); } }, 0.25);
  };

  const ctx = gsap.context(() => {
    gsap
      .timeline({ scrollTrigger: { trigger: section, start: "top 78%", toggleActions: "play none none reverse" } })
      .fromTo(section.querySelectorAll("[data-split] .line > span"), { yPercent: 105, opacity: 0, filter: "blur(8px)" }, { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.75, stagger: 0.09, ease: "power3.out" })
      .fromTo(section.querySelectorAll("[data-fade]"), { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0)
      .fromTo(section.querySelector("[data-cta]"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 0.3);

    const reveals = stories.map(reveal);

    if (mobile || n < 2) {
      stories.forEach((story, i) => {
        gsap.fromTo(story, { y: 40, opacity: 0 }, {
          y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: story, start: "top 85%", toggleActions: "play none none reverse", onEnter: () => reveals[i].play(), onLeaveBack: () => reveals[i].reverse() },
        });
      });
      return;
    }

    section.classList.add("is-pinned");
    const layout = () => {
      const h = Math.max(...stories.map((s) => s.offsetHeight));
      stage.style.setProperty("--stage-h", `${h + (n - 1) * PEEK}px`);
      return h;
    };
    layout();

    // first story is in place; the others wait below the stage
    stories.forEach((s, i) => {
      gsap.set(s, { y: i === 0 ? 0 : () => stage.offsetHeight + 60, opacity: i === 0 ? 1 : 0, zIndex: i + 1 });
    });
    gsap.fromTo(stories[0], { y: 48, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
      scrollTrigger: { trigger: stage, start: "top 85%", toggleActions: "play none none reverse", onEnter: () => reveals[0].play(), onLeaveBack: () => reveals[0].reverse() },
    });

    const shown = stories.map(() => false);
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: () => `top ${header?.offsetHeight ?? 0}px`,
        end: () => `+=${(n - 1) * window.innerHeight * PER_STORY}`,
        pin: true,
        scrub: 0.5,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefreshInit: layout,
        snap: { snapTo: 1 / (n - 1), duration: { min: 0.2, max: 0.5 }, delay: 0.08, ease: "power2.inOut" },
        // play a story's own reveal once it has mostly slid in; rewind it when it slides back out
        onUpdate: (self) => {
          const p = self.progress * (n - 1);
          for (let i = 1; i < n; i++) {
            if (p > i - 0.4 && !shown[i]) { shown[i] = true; reveals[i].play(); }
            else if (p < i - 0.6 && shown[i]) { shown[i] = false; reveals[i].reverse(); }
          }
        },
      },
    });
    for (let i = 1; i < n; i++) {
      const at = i - 1;
      tl.to(stories[i], { y: i * PEEK, opacity: 1, duration: 1, ease: "power2.out" }, at);
      // every card already in the stack sinks back a step and dims
      for (let j = 0; j < i; j++) {
        const depth = i - j;
        tl.to(stories[j], { scale: 1 - depth * 0.035, duration: 1 }, at)
          .to(stories[j].querySelectorAll(":scope > *"), { opacity: Math.max(0.25, 1 - depth * 0.45), duration: 1 }, at);
      }
    }
  }, section);

  return () => {
    ctx.revert();
    section.classList.remove("is-pinned");
  };
}
