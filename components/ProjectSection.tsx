"use client";

import { useId, useState } from "react";

/**
 * Collapsible section: header acts as a toggle button; the grid of project
 * cards animates open/closed via the CSS `grid-template-rows: 0fr -> 1fr`
 * trick (no JS height measurement, respects prefers-reduced-motion).
 */
export default function ProjectSection({
  title,
  count,
  defaultOpen = false,
  icon,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  /** Optional tiny mark rendered before the title (e.g. for Planned). */
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="mt-12">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group flex w-full items-center gap-3 border-b border-line py-3 text-left transition-colors duration-150 hover:border-[#d8d8d8]"
      >
        {icon && (
          <span aria-hidden className="text-muted group-hover:text-ink">
            {icon}
          </span>
        )}
        <span className="text-sm font-medium uppercase tracking-[0.1em] text-muted group-hover:text-ink">
          {title}
        </span>
        <span className="font-mono text-xs text-muted">{count}</span>
        <span className="ml-auto">
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className={`h-3 w-3 text-muted transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              open ? "rotate-180" : ""
            }`}
          >
            <path
              d="M2.5 4.5 L6 8 L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <div
        id={panelId}
        // `grid-template-rows: 0fr -> 1fr` is the modern CSS-only height
        // animation trick. Combined with `overflow-hidden` on the inner
        // wrapper it gives a clean reveal without measuring DOM height.
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
        }}
        aria-hidden={!open}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="pt-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
