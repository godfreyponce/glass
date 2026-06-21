"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ToolCall {
  name: string;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolCall[];
  /** Phase labels ("Scanning recipe-app…", "Building card…"). */
  statuses: string[];
}

type ServerEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; input?: unknown }
  | { type: "session"; sessionId: string }
  | { type: "phase"; label: string }
  | { type: "done"; exitCode: number | null; newSlug?: string; existed?: boolean }
  | { type: "error"; message: string };

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

export default function QuickChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [createdExisted, setCreatedExisted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  async function chooseProject() {
    if (streaming || picking) return;
    setError(null);
    setPicking(true);
    try {
      const res = await fetch("/api/pick-dir", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        path?: string;
        canceled?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Folder picker failed (${res.status}).`);
        return;
      }
      if (data.canceled) return;
      if (data.path) setProjectDir(data.path);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open the folder picker.",
      );
    } finally {
      setPicking(false);
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (streaming) return;
    const notes = input.trim();
    if (!projectDir && notes.length === 0) return;

    setInput("");
    setError(null);

    const userText = projectDir
      ? `Add project from ${basename(projectDir)}${notes ? ` — ${notes}` : ""}`
      : notes;

    setMessages((m) => [
      ...m,
      { role: "user", text: userText, toolCalls: [], statuses: [] },
      { role: "assistant", text: "", toolCalls: [], statuses: [] },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: notes.length > 0 ? notes : undefined,
          projectDir: projectDir ?? undefined,
          resumeSessionId: sessionId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Request failed (${res.status}).`);
        setStreaming(false);
        return;
      }

      // A project dir is single-use per send; clear it once the request is away.
      setProjectDir(null);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE: events end with a blank line; lines starting with "data:" carry payload.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLines = raw
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim());
          if (dataLines.length === 0) continue;
          try {
            const ev = JSON.parse(dataLines.join("\n")) as ServerEvent;
            handleEvent(ev);
          } catch {
            // ignore malformed payloads
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream interrupted.");
    } finally {
      setStreaming(false);
    }
  }

  function updateLastAssistant(fn: (m: Message) => Message) {
    setMessages((m) => {
      const last = m[m.length - 1];
      if (!last || last.role !== "assistant") return m;
      const updated = [...m];
      updated[updated.length - 1] = fn(last);
      return updated;
    });
  }

  function handleEvent(ev: ServerEvent) {
    if (ev.type === "text") {
      updateLastAssistant((last) => ({ ...last, text: last.text + ev.delta }));
    } else if (ev.type === "tool") {
      updateLastAssistant((last) => ({
        ...last,
        toolCalls: [...last.toolCalls, { name: ev.name }],
      }));
    } else if (ev.type === "phase") {
      updateLastAssistant((last) => ({
        ...last,
        statuses: [...last.statuses, ev.label],
      }));
    } else if (ev.type === "session") {
      setSessionId(ev.sessionId);
    } else if (ev.type === "done") {
      if (ev.newSlug) {
        setCreatedSlug(ev.newSlug);
        setCreatedExisted(ev.existed ?? false);
        router.refresh();
      }
    } else if (ev.type === "error") {
      setError(ev.message);
    }
  }

  function reset() {
    setMessages([]);
    setSessionId(null);
    setCreatedSlug(null);
    setCreatedExisted(false);
    setProjectDir(null);
    setError(null);
  }

  return (
    <div className="mt-8 flex flex-col">
      {messages.length === 0 && (
        <div className="rounded-[8px] border border-line bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
            two ways to add
          </p>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li className="rounded-[6px] bg-[#f7f6f3] px-3 py-2">
              <span className="font-medium">Choose a project</span> — point it at a
              folder; it inspects the real files and builds the card for you.
            </li>
            <li className="rounded-[6px] bg-[#f7f6f3] px-3 py-2">
              <span className="font-medium">Or just describe one</span> — “weekend
              Swift recipe app, low priority, starting Sunday”.
            </li>
          </ul>
        </div>
      )}

      <ul className="mt-6 flex flex-col gap-6">
        {messages.map((m, i) => (
          <li key={i} className="rise flex flex-col gap-1.5">
            <span
              className={`text-[0.65rem] font-medium uppercase tracking-[0.1em] ${
                m.role === "user" ? "text-ink" : "text-status-progress-fg"
              }`}
            >
              {m.role === "user" ? "You" : "Claude Code"}
            </span>
            {m.statuses.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-xs text-muted">
                {m.statuses.map((s, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span aria-hidden>▸</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
            {m.toolCalls.length > 0 && (
              <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted">
                {m.toolCalls.map((t, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span aria-hidden>·</span>
                    <span>
                      using <span className="text-ink">{t.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {m.text && (
              <p className="whitespace-pre-wrap text-sm text-ink">{m.text}</p>
            )}
            {m.role === "assistant" &&
              streaming &&
              i === messages.length - 1 &&
              m.text.length === 0 &&
              m.toolCalls.length === 0 &&
              m.statuses.length === 0 && (
                <p className="font-mono text-xs text-muted">working…</p>
              )}
          </li>
        ))}
      </ul>

      {createdSlug && (
        <div className="rise mt-6 rounded-[8px] border border-status-completed-fg/30 bg-status-completed-bg px-4 py-3 text-sm text-status-completed-fg">
          <p>
            {createdExisted
              ? "This project already has a card. "
              : "Card created. "}
            <Link
              href={`/projects/${createdSlug}`}
              className="font-medium underline underline-offset-4"
            >
              Open it &rarr;
            </Link>
          </p>
        </div>
      )}

      {error && (
        <div className="rise mt-6 rounded-[8px] border border-line bg-[#fdebec] px-4 py-3 text-sm text-[#9f2f2d]">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        {projectDir && (
          <div className="flex items-center justify-between gap-3 rounded-[6px] border border-line bg-[#f7f6f3] px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <span aria-hidden>📁</span>
              <span className="truncate font-mono text-xs" title={projectDir}>
                {projectDir}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setProjectDir(null)}
              disabled={streaming}
              aria-label="Clear chosen project"
              className="text-muted hover:text-ink disabled:opacity-50"
            >
              &times;
            </button>
          </div>
        )}

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={
            projectDir
              ? "Optional notes (status, priority, anything to add)…"
              : messages.length === 0
                ? "Describe the project in plain language…"
                : "Reply or tweak the card…"
          }
          rows={3}
          disabled={streaming}
          className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[#bdbdbd] disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={chooseProject}
            disabled={streaming || picking}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#f7f6f3] disabled:opacity-50"
          >
            <span aria-hidden>📁</span>
            {picking ? "Opening…" : projectDir ? "Change project" : "Choose project"}
          </button>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                disabled={streaming}
                className="rounded-[6px] border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
              >
                New conversation
              </button>
            )}
            <button
              type="submit"
              disabled={streaming || (!projectDir && input.trim().length === 0)}
              className="rounded-[6px] bg-[#111111] px-4 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-[#333333] active:scale-[0.98] disabled:opacity-50"
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted">
          Cmd/Ctrl + Enter to send. Uses your local Claude Code (MAX plan, no API
          costs). Choosing a project runs a read-only scan of that folder first.
        </p>
      </form>

      <div ref={bottomRef} />
    </div>
  );
}
