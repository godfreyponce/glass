"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface ProjectOption {
  slug: string;
  name: string;
  status: string;
  last_worked_on: string;
  next_action?: string;
}

type Triple = { status: string; last_worked_on: string; next_action?: string };

export default function QuickUpdate({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<{ current: Triple; proposed: Triple } | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview(nextSlug: string) {
    setSlug(nextSlug);
    setPreview(null);
    setApplied(false);
    setError(null);
    if (!nextSlug) return;
    setLoading(true);
    try {
      const res = await fetch("/api/quick/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: nextSlug }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        current?: Triple;
        proposed?: Triple;
        error?: string;
      };
      if (!res.ok || !data.current || !data.proposed) {
        setError(data.error ?? `Could not read glass.md (${res.status}).`);
        return;
      }
      setPreview({ current: data.current, proposed: data.proposed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!slug || applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/quick/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, apply: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Update failed (${res.status}).`);
        return;
      }
      setApplied(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setApplying(false);
    }
  }

  const fields: Array<keyof Triple> = ["status", "last_worked_on", "next_action"];
  const changed = (k: keyof Triple) =>
    preview ? (preview.current[k] ?? "") !== (preview.proposed[k] ?? "") : false;

  return (
    <div className="mt-8 flex flex-col gap-6">
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
          project
        </span>
        <select
          value={slug}
          onChange={(e) => void loadPreview(e.target.value)}
          className="rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[#bdbdbd]"
        >
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {loading && <p className="font-mono text-xs text-muted">reading glass.md…</p>}

      {preview && (
        <div className="rise rounded-[8px] border border-line bg-surface p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-muted">
                <th className="pb-2 font-medium">Field</th>
                <th className="pb-2 font-medium">Current</th>
                <th className="pb-2 font-medium">From glass.md</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((k) => (
                <tr key={k} className="border-t border-line align-top">
                  <td className="py-2 pr-3 font-mono text-xs text-muted">{k}</td>
                  <td className="py-2 pr-3 text-ink">{preview.current[k] ?? "—"}</td>
                  <td className={`py-2 ${changed(k) ? "font-medium text-status-progress-fg" : "text-ink"}`}>
                    {preview.proposed[k] ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {fields.some(changed) ? (
            <button
              type="button"
              onClick={() => void apply()}
              disabled={applying}
              className="mt-4 rounded-[6px] bg-[#111111] px-4 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-[#333333] active:scale-[0.98] disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply to card"}
            </button>
          ) : (
            <p className="mt-4 text-xs text-muted">Card already matches glass.md — nothing to apply.</p>
          )}
        </div>
      )}

      {applied && slug && (
        <div className="rise rounded-[8px] border border-status-completed-fg/30 bg-status-completed-bg px-4 py-3 text-sm text-status-completed-fg">
          Card updated.{" "}
          <Link href={`/projects/${slug}`} className="font-medium underline underline-offset-4">
            Open it &rarr;
          </Link>
        </div>
      )}

      {error && (
        <div className="rise rounded-[8px] border border-line bg-[#fdebec] px-4 py-3 text-sm text-[#9f2f2d]">
          {error}
        </div>
      )}

      <p className="text-xs text-muted">
        Reads <code>glass.md</code> from the project&apos;s folder (via its
        local_path) and syncs only status, last worked on, and next action. Run
        <code> GLASS_PROMPT.md</code> in the project first to refresh its glass.md.
      </p>
    </div>
  );
}
