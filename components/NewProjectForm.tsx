"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { STATUS_VALUES, PRIORITY_VALUES } from "@/lib/schema";

const FIELD =
  "w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[#bdbdbd]";
const LABEL =
  "block text-xs font-medium uppercase tracking-[0.06em] text-muted mb-1.5";

interface IssueError {
  field: string;
  message: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewProjectForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<IssueError[]>([]);
  const [status, setStatus] = useState<string>("planned");

  const needsNextAction = status === "in-progress" || status === "planned";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setIssues([]);

    const fd = new FormData(e.currentTarget);
    const str = (k: string) => (fd.get(k) as string | null)?.trim() ?? "";
    const list = (k: string) =>
      str(k)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const optional = (v: string) => (v.length > 0 ? v : undefined);

    const payload: Record<string, unknown> = {
      passphrase: str("passphrase"),
      name: str("name"),
      slug: optional(str("slug")),
      status: str("status"),
      priority: str("priority"),
      stack: list("stack"),
      started: str("started"),
      last_worked_on: str("last_worked_on"),
      next_action: optional(str("next_action")),
      run_command: optional(str("run_command")),
      entry_point: optional(str("entry_point")),
      repo_url: optional(str("repo_url")),
      live_url: optional(str("live_url")),
      recruiter_pitch: optional(str("recruiter_pitch")),
      tags: list("tags").length > 0 ? list("tags") : undefined,
    };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        slug?: string;
        error?: string;
        issues?: IssueError[];
      };

      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status}).`);
        if (data.issues) setIssues(data.issues);
        setSubmitting(false);
        return;
      }

      router.push(`/projects/${data.slug}`);
      router.refresh();
    } catch {
      setError("Network error — could not reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rise mt-10 flex flex-col gap-5">
      <div>
        <label className={LABEL} htmlFor="name">
          Name
        </label>
        <input id="name" name="name" required className={FIELD} />
      </div>

      <div>
        <label className={LABEL} htmlFor="slug">
          Slug{" "}
          <span className="lowercase tracking-normal">
            (optional — derived from name)
          </span>
        </label>
        <input
          id="slug"
          name="slug"
          placeholder="kebab-case"
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL} htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            className={FIELD}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            className={FIELD}
            defaultValue="medium"
          >
            {PRIORITY_VALUES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="stack">
          Stack <span className="lowercase tracking-normal">(comma-separated)</span>
        </label>
        <input
          id="stack"
          name="stack"
          required
          placeholder="Next.js, TypeScript, Tailwind CSS"
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL} htmlFor="started">
            Started
          </label>
          <input
            id="started"
            name="started"
            type="date"
            required
            defaultValue={todayISO()}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="last_worked_on">
            Last worked on
          </label>
          <input
            id="last_worked_on"
            name="last_worked_on"
            type="date"
            required
            defaultValue={todayISO()}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="next_action">
          Next action{" "}
          {needsNextAction && (
            <span className="lowercase tracking-normal text-status-planned-fg">
              (required for {status})
            </span>
          )}
        </label>
        <textarea
          id="next_action"
          name="next_action"
          rows={2}
          required={needsNextAction}
          className={FIELD}
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="recruiter_pitch">
          Recruiter pitch{" "}
          <span className="lowercase tracking-normal">(one sentence)</span>
        </label>
        <textarea
          id="recruiter_pitch"
          name="recruiter_pitch"
          rows={2}
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL} htmlFor="run_command">
            Run command
          </label>
          <input
            id="run_command"
            name="run_command"
            placeholder="npm run dev"
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="entry_point">
            Entry point
          </label>
          <input
            id="entry_point"
            name="entry_point"
            placeholder="app/page.tsx"
            className={FIELD}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL} htmlFor="repo_url">
            Repo URL
          </label>
          <input
            id="repo_url"
            name="repo_url"
            type="url"
            placeholder="https://github.com/..."
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="live_url">
            Live URL
          </label>
          <input
            id="live_url"
            name="live_url"
            type="url"
            placeholder="https://..."
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="tags">
          Tags <span className="lowercase tracking-normal">(comma-separated)</span>
        </label>
        <input
          id="tags"
          name="tags"
          placeholder="ai, freelance, nlp"
          className={FIELD}
        />
      </div>

      <div className="border-t border-line pt-5">
        <label className={LABEL} htmlFor="passphrase">
          Passphrase
        </label>
        <input
          id="passphrase"
          name="passphrase"
          type="password"
          required
          autoComplete="off"
          className={`${FIELD} font-mono`}
        />
        <p className="mt-1.5 text-xs text-muted">
          Validated server-side against API_WRITE_SECRET. Required to commit.
        </p>
      </div>

      {error && (
        <div className="rounded-[6px] border border-status-progress-bg bg-[#fdebec] px-4 py-3 text-sm text-[#9f2f2d]">
          <p>{error}</p>
          {issues.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {issues.map((i) => (
                <li key={i.field}>
                  <span className="font-mono text-xs">{i.field}</span>:{" "}
                  {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 inline-flex w-fit items-center rounded-[6px] bg-[#111111] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#333333] active:scale-[0.98] disabled:opacity-50"
      >
        {submitting ? "Committing…" : "Create project"}
      </button>
    </form>
  );
}
