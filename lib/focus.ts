/**
 * Tiny client-side event bus for "jump to a project card" — fired when a
 * project name is clicked in the Keys popover. The owning ProjectSection
 * expands itself; the matching ProjectCard scrolls into view and plays a
 * highlight animation. Decouples popover → section → card without shared state.
 */

export const FOCUS_PROJECT_EVENT = "glass:focus-project";

export interface FocusProjectDetail {
  slug: string;
}

export function dispatchFocusProject(slug: string): void {
  window.dispatchEvent(
    new CustomEvent<FocusProjectDetail>(FOCUS_PROJECT_EVENT, {
      detail: { slug },
    }),
  );
}

/**
 * Variant 3 — "lift + ring pop". Uses the Web Animations API so it runs on
 * top of the card's existing `.rise` CSS animation instead of conflicting
 * with it. Honors prefers-reduced-motion with a brief static outline.
 */
export function playFocusPop(el: HTMLElement): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Inset ring (not an outward shadow/outline) so the parent section's
  // `overflow-hidden` — needed for its collapse animation — can't clip it.
  if (reduce) {
    el.animate(
      [
        { boxShadow: "inset 0 0 0 2px rgba(31,108,159,0.6)", offset: 0 },
        { boxShadow: "inset 0 0 0 2px rgba(31,108,159,0.6)", offset: 0.7 },
        { boxShadow: "inset 0 0 0 0 rgba(31,108,159,0)", offset: 1 },
      ],
      { duration: 1900, easing: "ease-out" },
    );
    return;
  }

  // Pop early, then hold the ring visible before fading — so it's actually
  // noticeable instead of flashing by.
  el.animate(
    [
      {
        transform: "translateY(0) scale(1)",
        boxShadow: "inset 0 0 0 0 rgba(31,108,159,0)",
        offset: 0,
      },
      {
        transform: "translateY(-3px) scale(1.012)",
        boxShadow: "inset 0 0 0 2px rgba(31,108,159,0.55)",
        offset: 0.12,
      },
      {
        transform: "translateY(0) scale(1)",
        boxShadow: "inset 0 0 0 2px rgba(31,108,159,0.55)",
        offset: 0.28,
      },
      {
        transform: "translateY(0) scale(1)",
        boxShadow: "inset 0 0 0 2px rgba(31,108,159,0.55)",
        offset: 0.72,
      },
      {
        transform: "translateY(0) scale(1)",
        boxShadow: "inset 0 0 0 0 rgba(31,108,159,0)",
        offset: 1,
      },
    ],
    { duration: 2000, easing: "ease-out" },
  );
}
