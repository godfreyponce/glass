"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useLock } from "@/components/LockProvider";

interface EditableBodyProps {
  slug: string;
  initialBody: string;
  initialHtml: string;
}

/**
 * View/edit toggle for the markdown body on a detail page.
 * Locked: just renders the HTML, no UI chrome.
 * Unlocked: shows a small "Edit body" button above the prose. Click it
 * to swap into a raw-markdown textarea. Save persists via PATCH; the
 * server returns freshly rendered HTML so the new content shows
 * immediately (including in prod's optimistic path).
 */
export default function EditableBody({
  slug,
  initialBody,
  initialHtml,
}: EditableBodyProps) {
  const { locked, passphrase } = useLock();
  const router = useRouter();

  const [body, setBody] = useState(initialBody);
  const [html, setHtml] = useState(initialHtml);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Sync from server when props change (router.refresh in dev).
  useEffect(() => {
    if (!editing) {
      if (initialBody !== body) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBody(initialBody);
        setDraft(initialBody);
      }
      if (initialHtml !== html) setHtml(initialHtml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBody, initialHtml]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  async function save() {
    if (draft === body) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-passphrase": passphrase ?? "",
        },
        body: JSON.stringify({ body: draft }),
      });

      const data = (await res.json()) as {
        error?: string;
        body?: string;
        html?: string;
        persistence?: "local" | "github";
      };

      if (!res.ok) {
        setError(data.error ?? `Save failed (${res.status}).`);
        setSaving(false);
        return;
      }

      // Optimistic update with the server's freshly rendered HTML.
      if (typeof data.body === "string") setBody(data.body);
      if (typeof data.html === "string") setHtml(data.html);
      setEditing(false);
      setSaving(false);

      if (data.persistence === "github") {
        window.dispatchEvent(new CustomEvent("portfolio:redeploying"));
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(body);
    setEditing(false);
    setError(null);
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  }

  if (editing) {
    return (
      <div className="rise mt-12 flex flex-col gap-3">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          disabled={saving}
          spellCheck
          className="w-full rounded-[6px] border border-line bg-surface px-4 py-3 font-mono text-sm leading-relaxed text-ink outline-none focus:border-[#bdbdbd] [field-sizing:content]"
          style={{ minHeight: "20rem" }}
        />
        {error && (
          <p className="text-xs text-[#9f2f2d]">{error}</p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Markdown. Cmd/Ctrl + Enter saves. Esc cancels.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="rounded-[6px] border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-[6px] bg-[#111111] px-4 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-[#333333] active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View mode. Empty body + locked = render nothing (matches old behavior).
  const hasContent = html.trim().length > 0;
  if (locked && !hasContent) return null;

  return (
    <div className="rise mt-12">
      {!locked && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setDraft(body);
              setEditing(true);
              setError(null);
            }}
            className="rounded-[6px] border border-line bg-surface px-3 py-1.5 text-xs text-muted transition-colors duration-200 hover:text-ink"
          >
            Edit body
          </button>
        </div>
      )}
      {hasContent ? (
        <article
          className="prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm italic text-muted">
          No body yet. Click &ldquo;Edit body&rdquo; to add some notes.
        </p>
      )}
    </div>
  );
}
