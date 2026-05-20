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
}

type ServerEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; input?: unknown }
  | { type: "session"; sessionId: string }
  | { type: "done"; exitCode: number | null; newSlug?: string }
  | { type: "error"; message: string };

export default function QuickChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (streaming) return;
    const prompt = input.trim();
    if (prompt.length === 0) return;

    setInput("");
    setError(null);
    setMessages((m) => [
      ...m,
      { role: "user", text: prompt, toolCalls: [] },
      { role: "assistant", text: "", toolCalls: [] },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          resumeSessionId: sessionId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Request failed (${res.status}).`);
        setStreaming(false);
        return;
      }

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

  function handleEvent(ev: ServerEvent) {
    if (ev.type === "text") {
      setMessages((m) => {
        const last = m[m.length - 1];
        if (!last || last.role !== "assistant") return m;
        const updated = [...m];
        updated[updated.length - 1] = { ...last, text: last.text + ev.delta };
        return updated;
      });
    } else if (ev.type === "tool") {
      setMessages((m) => {
        const last = m[m.length - 1];
        if (!last || last.role !== "assistant") return m;
        const updated = [...m];
        updated[updated.length - 1] = {
          ...last,
          toolCalls: [...last.toolCalls, { name: ev.name }],
        };
        return updated;
      });
    } else if (ev.type === "session") {
      setSessionId(ev.sessionId);
    } else if (ev.type === "done") {
      if (ev.newSlug) {
        setCreatedSlug(ev.newSlug);
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
    setError(null);
  }

  return (
    <div className="mt-8 flex flex-col">
      {messages.length === 0 && (
        <div className="rounded-[8px] border border-line bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
            try something like
          </p>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li className="rounded-[6px] bg-[#f7f6f3] px-3 py-2">
              weekend hackathon, Swift recipe app I&apos;m building with a
              friend, starting Sunday, low priority
            </li>
            <li className="rounded-[6px] bg-[#f7f6f3] px-3 py-2">
              new freelance project: redesigning a dentist&apos;s website in
              Next.js, in progress, next step is wireframes
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
              m.toolCalls.length === 0 && (
                <p className="font-mono text-xs text-muted">working…</p>
              )}
          </li>
        ))}
      </ul>

      {createdSlug && (
        <div className="rise mt-6 rounded-[8px] border border-status-completed-fg/30 bg-status-completed-bg px-4 py-3 text-sm text-status-completed-fg">
          <p>
            Card created.{" "}
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
            messages.length === 0
              ? "Describe the project in plain language…"
              : "Reply or tweak the card…"
          }
          rows={3}
          disabled={streaming}
          className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-[#bdbdbd] disabled:opacity-60"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Cmd/Ctrl + Enter to send. Uses your local Claude Code (MAX plan,
            no API costs).
          </p>
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
              disabled={streaming || input.trim().length === 0}
              className="rounded-[6px] bg-[#111111] px-4 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-[#333333] active:scale-[0.98] disabled:opacity-50"
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
        </div>
      </form>

      <div ref={bottomRef} />
    </div>
  );
}
