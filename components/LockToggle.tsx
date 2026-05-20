"use client";

import { useEffect, useRef, useState } from "react";

import { useLock } from "@/components/LockProvider";

/**
 * Padlock icon button. Locked: opens a passphrase popover; on submit calls
 * /api/auth/check and unlocks on 200. Unlocked: re-locks immediately.
 */
export default function LockToggle() {
  const { locked, lock, unlock } = useLock();
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close popover on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/check", {
        method: "POST",
        headers: { "x-passphrase": pass },
      });
      if (res.ok) {
        unlock(pass);
        setPass("");
        setOpen(false);
      } else if (res.status === 401) {
        setError("Wrong passphrase.");
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Auth check failed (${res.status}).`);
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClick() {
    if (locked) {
      setOpen((o) => !o);
    } else {
      lock();
    }
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={locked ? "Unlock editing" : "Lock editing"}
        aria-pressed={!locked}
        title={locked ? "Unlock to edit" : "Lock — view only"}
        className={`flex h-9 w-9 items-center justify-center rounded-[6px] border transition-colors duration-200 ${
          locked
            ? "border-line bg-surface text-muted hover:text-ink"
            : "border-status-completed-fg/20 bg-status-completed-bg text-status-completed-fg"
        }`}
      >
        {locked ? <LockedIcon /> : <UnlockedIcon />}
      </button>

      {locked && open && (
        <form
          onSubmit={handleSubmit}
          className="absolute right-0 z-20 mt-2 w-72 rounded-[8px] border border-line bg-surface p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
        >
          <label
            className="block text-xs font-medium uppercase tracking-[0.06em] text-muted mb-1.5"
            htmlFor="lock-pass"
          >
            Passphrase
          </label>
          <input
            ref={inputRef}
            id="lock-pass"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="off"
            className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-[#bdbdbd]"
          />
          {error && (
            <p className="mt-2 text-xs text-[#9f2f2d]">{error}</p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted">Validated server-side.</p>
            <button
              type="submit"
              disabled={submitting || pass.length === 0}
              className="rounded-[6px] bg-[#111111] px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-[#333333] active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? "…" : "Unlock"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function LockedIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.2" />
      <path d="M5 7.5 V5 a3 3 0 0 1 6 0 V7.5" />
    </svg>
  );
}

function UnlockedIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.2" />
      <path d="M5 7.5 V5 a3 3 0 0 1 5.6 -1.4" />
    </svg>
  );
}
