"use client";

import { useEffect, useRef, useState } from "react";

import { providerLabel, type ProviderKeys } from "@/lib/keys";
import { dispatchFocusProject } from "@/lib/focus";
import ProviderLogo from "@/components/ProviderLogo";

/**
 * Variant 1 — header "Keys" button that opens a popover aggregating active
 * API keys by provider (logo + name + location + usage count). Closes on
 * outside click or Escape. Renders nothing when there are no keys at all.
 */
export default function KeysPopover({
  groups,
  total,
}: {
  groups: ProviderKeys[];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (total === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Active API keys across your projects"
        className="inline-flex w-fit items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors duration-200 hover:bg-[#f7f6f3] active:scale-[0.98]"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="m21 2-9.6 9.6" />
          <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </svg>
        Keys
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[0.62rem] font-bold leading-none text-white">
          {total}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-[320px] rounded-[10px] border border-line bg-surface p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.10)]">
          <p className="px-2.5 pb-2 pt-2 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">
            <span className="text-status-progress-fg">{total}</span> active API keys
          </p>
          <ul className="flex flex-col gap-1">
            {groups.map((g) => (
              <li key={g.provider}>
                <div className="flex items-center gap-2.5 px-2.5 py-1.5">
                  <ProviderLogo provider={g.provider} box="h-[22px] w-[22px]" />
                  <span className="text-sm font-medium text-ink">
                    {providerLabel(g.provider)}
                  </span>
                </div>
                <ul className="flex flex-col">
                  {g.keys.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-baseline gap-2 rounded-[6px] py-1 pl-[40px] pr-2 hover:bg-[#f7f6f3]"
                    >
                      <span className="truncate text-[0.8rem] text-ink">
                        {k.label ?? k.location}
                      </span>
                      {k.label && (
                        <span className="truncate text-xs text-muted">
                          {k.location}
                        </span>
                      )}
                      <span className="ml-auto flex flex-wrap justify-end gap-x-1.5 gap-y-0.5 pl-2 font-mono text-[0.68rem]">
                        {k.projects.map((slug) => (
                          <button
                            key={slug}
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              dispatchFocusProject(slug);
                            }}
                            className="text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
                          >
                            {slug}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
