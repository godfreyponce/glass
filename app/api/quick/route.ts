import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

import {
  isAvailable,
  spawnClaudeCode,
  SYSTEM_PROMPT,
  type ClaudeEvent,
} from "@/lib/claude-code";

/**
 * POST /api/quick — DEV-ONLY.
 *
 * Spawns Claude Code (`claude -p ...`) in headless mode, streams its
 * stream-json output back to the browser as Server-Sent Events. Claude
 * writes the new project file directly using its Write tool; we detect
 * which file appeared by diffing content/projects/ before vs after.
 *
 * Production responds 503 — Vercel doesn't have the user's `claude`
 * binary or their MAX-plan OAuth.
 */

const bodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  resumeSessionId: z.string().optional(),
});

export async function POST(request: Request): Promise<Response> {
  if (!isAvailable()) {
    return NextResponse.json(
      {
        error:
          "Quick add is a dev-only feature. It runs Claude Code on your local machine; the deployed site can't access your MAX-plan auth or your terminal.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request.",
        issues: parsed.error.issues.map((i) => ({
          field: i.path.join(".") || "(root)",
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const projectsDir = path.join(process.cwd(), "content", "projects");
  const beforeFiles = await snapshotProjects(projectsDir);

  const { child, events, exitPromise } = spawnClaudeCode({
    prompt: parsed.data.prompt,
    resumeSessionId: parsed.data.resumeSessionId,
    systemPrompt: SYSTEM_PROMPT,
    cwd: process.cwd(),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: SseMessage) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      // Spawn-level errors (e.g. ENOENT when `claude` isn't installed).
      child.once("error", (err) => {
        send({
          type: "error",
          message: errorMessage(err),
        });
      });

      try {
        for await (const ev of events) {
          const mapped = mapEvent(ev);
          if (mapped) send(mapped);
        }
        const code = await exitPromise;

        const afterFiles = await snapshotProjects(projectsDir);
        const newFiles = [...afterFiles].filter((f) => !beforeFiles.has(f));
        const newSlug =
          newFiles.length > 0 ? newFiles[0].replace(/\.md$/, "") : undefined;

        send({
          type: "done",
          exitCode: code,
          newSlug,
        });
      } catch (err) {
        send({ type: "error", message: errorMessage(err) });
      } finally {
        controller.close();
      }
    },
    cancel() {
      // Browser closed the stream — kill the subprocess.
      child.kill("SIGTERM");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

type SseMessage =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; input?: unknown }
  | { type: "session"; sessionId: string }
  | { type: "done"; exitCode: number | null; newSlug?: string }
  | { type: "error"; message: string };

function mapEvent(ev: ClaudeEvent): SseMessage | null {
  // The `--include-partial-messages` flag emits "stream_event" wrappers
  // around Anthropic-style delta events. Forward only what the UI needs.
  if (ev.type === "stream_event") {
    const inner = (ev as { event?: { delta?: { type?: string; text?: string } } }).event;
    if (inner?.delta?.type === "text_delta" && typeof inner.delta.text === "string") {
      return { type: "text", delta: inner.delta.text };
    }
    return null;
  }

  if (ev.type === "system") {
    const sessionId = (ev as { session_id?: string }).session_id;
    if (sessionId) return { type: "session", sessionId };
    return null;
  }

  // Tool-use events come through as full assistant messages whose content
  // includes a `tool_use` block. Surface a compact "Claude is using <tool>"
  // hint so the user sees progress while files are being read/written.
  if (ev.type === "assistant") {
    const content = (ev as { message?: { content?: unknown[] } }).message?.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        const b = block as { type?: string; name?: string; input?: unknown };
        if (b.type === "tool_use" && typeof b.name === "string") {
          return { type: "tool", name: b.name, input: b.input };
        }
      }
    }
    return null;
  }

  if (ev.type === "result") {
    const sessionId = (ev as { session_id?: string }).session_id;
    if (sessionId) return { type: "session", sessionId };
    return null;
  }

  return null;
}

async function snapshotProjects(dir: string): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(dir);
    return new Set(entries.filter((f) => f.endsWith(".md")));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw err;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return "Claude Code CLI (`claude`) not found in PATH. Install it from https://claude.com/code and run `claude login`.";
    }
    return err.message;
  }
  return String(err);
}
