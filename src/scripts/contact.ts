/**
 * Contact form + popup.
 *  - every link to "#contact" opens the popup instead of jumping to the bottom of the page;
 *  - the budget chip is preselected from the calculator estimate (sessionStorage "mara-estimate");
 *  - forms post to Netlify Forms with fetch and show a thank-you state in place.
 */
const BUDGETS = [5000, 10000, 25000, Infinity]; // upper bounds of the first four chips

function budgetIndex(low: number, high: number) {
  const mid = (low + high) / 2;
  return BUDGETS.findIndex((max) => mid < max);
}

function readEstimate(): { type?: string; selected?: string[]; low?: number; high?: number } | null {
  try {
    return JSON.parse(sessionStorage.getItem("mara-estimate") || "null");
  } catch {
    return null;
  }
}

function prefill(form: HTMLFormElement) {
  const est = readEstimate();
  if (!est || !est.low || !est.high) return;
  const hidden = form.querySelector<HTMLInputElement>("[data-c-estimate]");
  if (hidden) hidden.value = `${est.type ?? ""} · ${(est.selected ?? []).join(", ")} · $${est.low}–$${est.high}`;
  // don't override a choice the visitor already made
  if (form.querySelector("[data-c-budget]:checked")) return;
  const i = budgetIndex(est.low, est.high);
  const chip = form.querySelector<HTMLInputElement>(`[data-c-budget="${i}"]`);
  if (chip) chip.checked = true;
}

function wireForm(form: HTMLFormElement) {
  const btn = form.querySelector<HTMLButtonElement>("[data-c-submit]")!;
  const label = form.querySelector<HTMLElement>("[data-c-btn-label]")!;
  const msg = form.querySelector<HTMLElement>("[data-c-msg]")!;
  const done = form.parentElement!.querySelector<HTMLElement>("[data-c-done]")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    form.classList.add("is-checked");
    msg.classList.remove("is-error");
    if (!form.checkValidity()) {
      const first = form.querySelector<HTMLElement>(":invalid:not(fieldset)");
      msg.textContent = "Please fill in your name, a valid email and a budget range.";
      msg.classList.add("is-error");
      first?.focus();
      return;
    }
    btn.disabled = true;
    label.textContent = "Sending…";
    msg.textContent = "";
    try {
      const body = new URLSearchParams(new FormData(form) as unknown as Record<string, string>).toString();
      const res = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      if (!res.ok) throw new Error(String(res.status));
      form.hidden = true;
      done.hidden = false;
      done.querySelector<HTMLElement>("h3")?.focus();
      try { sessionStorage.removeItem("mara-estimate"); } catch {}
    } catch {
      msg.textContent = "Something went wrong. Please try again in a moment.";
      msg.classList.add("is-error");
    } finally {
      btn.disabled = false;
      label.textContent = "Submit";
    }
  });
}

export function initContact() {
  const forms = Array.from(document.querySelectorAll<HTMLFormElement>("[data-contact-form]"));
  forms.forEach((f) => { wireForm(f); prefill(f); });

  const modal = document.querySelector<HTMLDialogElement>("[data-cmodal]");
  if (!modal) return;
  const form = modal.querySelector<HTMLFormElement>("[data-contact-form]")!;
  const done = modal.querySelector<HTMLElement>("[data-c-done]")!;
  let opener: HTMLElement | null = null;

  const open = (from?: HTMLElement) => {
    opener = from ?? null;
    if (!form.hidden || done.hidden) prefill(form);
    // a fresh form after a previous successful send
    if (!done.hidden) { form.reset(); form.hidden = false; done.hidden = true; form.classList.remove("is-checked"); prefill(form); }
    document.documentElement.style.overflow = "hidden";
    modal.showModal();
    modal.scrollTop = 0;
    // focus the first field on pointer devices; keep the dialog itself focused on touch (no keyboard pop-up)
    if (window.matchMedia("(pointer: fine)").matches) form.querySelector<HTMLInputElement>("input[name=name]")?.focus();
  };
  const close = () => modal.close();

  modal.addEventListener("close", () => {
    document.documentElement.style.overflow = "";
    opener?.focus({ preventScroll: true });
  });
  modal.querySelectorAll("[data-c-close]").forEach((b) => b.addEventListener("click", close));

  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href="#contact"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open(a);
  });
  if (location.hash === "#contact-form") open();
}
