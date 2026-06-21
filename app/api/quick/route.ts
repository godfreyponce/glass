import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { z } from "zod";

import {
  isAvailable,
  spawnClaudeCode,
  SYSTEM_PROMPT,
  RECON_SYSTEM_PROMPT,
  type ClaudeEvent,
  type SpawnOptions,
} from "@/lib/claude-code";

/**
 * POST /api/quick — DEV-ONLY.
 *
 * Two modes:
 *  - With `projectDir`: a two-stage pipeline. Stage 1 ("recon") spawns a
 *    read-only Claude Code in that directory to inspect the real files and
 *    produce a brief; stage 2 ("card") feeds that brief (plus optional notes)
 *    to the schema-owning agent in the glass repo, which writes the .md.
 *  - Without `projectDir`: the original single-stage flow — `prompt` is the
 *    plain-language description handed straight to the card agent.
 *
 * Streams stream-json output back as Server-Sent Events. Production responds
 * 503 — Vercel has neither the user's `claude` binary nor their MAX-plan OAuth.
 */

const execFileP = promisify(execFile);

const bodySchema = z
  .object({
    prompt: z.string().max(4000).optional(),
    projectDir: z.string().min(1).optional(),
    resumeSessionId: z.string().optional(),
  })
  .refine((d) => (d.prompt && d.prompt.trim().length > 0) || d.projectDir, {
    message: "Provide a description, or choose a project directory.",
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

  const notes = parsed.data.prompt?.trim() ?? "";
  const projectDir = parsed.data.projectDir;

  // Validate the chosen directory up front, before opening the stream.
  if (projectDir) {
    if (!path.isAbsolute(projectDir) || !(await isDirectory(projectDir))) {
      return NextResponse.json(
        { error: `Not a directory: ${projectDir}` },
        { status: 400 },
      );
    }
  }

  const projectsDir = path.join(process.cwd(), "content", "projects");
  const holder: ChildHolder = { child: null };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: SseMessage) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        let cardInput = notes;

        // ---- Stage 1: recon (only when a project directory was chosen) ----
        if (projectDir) {
          send({ type: "phase", label: `Scanning ${path.basename(projectDir)}…` });

          const reconResult = await streamAgent(
            send,
            {
              prompt: buildReconPrompt(projectDir, await gatherGitFacts(projectDir)),
              systemPrompt: RECON_SYSTEM_PROMPT,
              cwd: projectDir,
              allowedTools: "Read,Grep,Glob",
            },
            { forwardText: false, forwardSession: false },
            holder,
          );

          const brief = reconResult.text.trim();
          if (!brief) {
            send({
              type: "error",
              message: "Recon produced no brief — is the directory a real project?",
            });
            controller.close();
            return;
          }

          cardInput = notes
            ? `${brief}\n\nAdditional notes from me:\n${notes}`
            : brief;

          send({ type: "phase", label: "Building card…" });
        }

        // ---- Stage 2: card (always) ----
        const beforeFiles = await snapshotProjects(projectsDir);

        const cardResult = await streamAgent(
          send,
          {
            prompt: cardInput,
            resumeSessionId: parsed.data.resumeSessionId,
            systemPrompt: SYSTEM_PROMPT,
            cwd: process.cwd(),
            allowedTools: "Read,Write,Edit",
          },
          { forwardText: true, forwardSession: true },
          holder,
        );

        const afterFiles = await snapshotProjects(projectsDir);
        const newFiles = [...afterFiles].filter((f) => !beforeFiles.has(f));
        let newSlug =
          newFiles.length > 0 ? newFiles[0].replace(/\.md$/, "") : undefined;
        let existed = false;

        // No new file but a project was scanned → it likely already has a card.
        // Best-effort: resolve the card by the folder-name slug so the UI can
        // still link to it instead of leaving the user with nothing.
        if (!newSlug && projectDir) {
          const candidate = slugify(path.basename(projectDir));
          if (candidate && afterFiles.has(`${candidate}.md`)) {
            newSlug = candidate;
            existed = true;
          }
        }

        send({ type: "done", exitCode: cardResult.code, newSlug, existed });
      } catch (err) {
        send({ type: "error", message: errorMessage(err) });
      } finally {
        controller.close();
      }
    },
    cancel() {
      // Browser closed the stream — kill whichever stage is running.
      holder.child?.kill("SIGTERM");
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

interface ChildHolder {
  child: ReturnType<typeof spawnClaudeCode>["child"] | null;
}

/**
 * Spawns one Claude Code agent, forwards mapped events to the SSE stream, and
 * returns the accumulated assistant text plus exit code. Text and session
 * events are forwarded selectively: the recon stage keeps its brief and session
 * server-side; the card stage forwards both (its text is the user-facing reply,
 * its session id powers follow-up tweaks).
 */
async function streamAgent(
  send: (event: SseMessage) => void,
  opts: SpawnOptions,
  forward: { forwardText: boolean; forwardSession: boolean },
  holder: ChildHolder,
): Promise<{ text: string; code: number | null }> {
  const { child, events, exitPromise } = spawnClaudeCode(opts);
  holder.child = child;

  child.once("error", (err) => {
    send({ type: "error", message: errorMessage(err) });
  });

  let text = "";
  for await (const ev of events) {
    const mapped = mapEvent(ev);
    if (!mapped) continue;

    if (mapped.type === "text") {
      text += mapped.delta;
      if (forward.forwardText) send(mapped);
    } else if (mapped.type === "session") {
      if (forward.forwardSession) send(mapped);
    } else {
      send(mapped);
    }
  }

  const code = await exitPromise;
  holder.child = null;
  return { text, code };
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Gathers git facts in Node so the recon agent never needs Bash — it stays
 * strictly read-only. Each lookup degrades gracefully: no repo / no remote /
 * no commits just means that fact is omitted from the brief.
 */
async function gatherGitFacts(
  dir: string,
): Promise<{ firstCommit?: string; lastCommit?: string; remoteUrl?: string }> {
  const facts: { firstCommit?: string; lastCommit?: string; remoteUrl?: string } = {};

  try {
    const { stdout } = await execFileP("git", ["-C", dir, "log", "-1", "--format=%cs"]);
    facts.lastCommit = stdout.trim() || undefined;
  } catch {
    // not a git repo or no commits — leave lastCommit undefined
  }
  try {
    // Root commit(s) only — bounded output, unlike logging the whole history.
    const { stdout } = await execFileP("git", [
      "-C",
      dir,
      "log",
      "--max-parents=0",
      "--format=%cs",
    ]);
    facts.firstCommit = stdout.split("\n")[0]?.trim() || undefined;
  } catch {
    // no root commit reachable — leave firstCommit undefined
  }
  try {
    const { stdout } = await execFileP("git", ["-C", dir, "remote", "get-url", "origin"]);
    facts.remoteUrl = stdout.trim() || undefined;
  } catch {
    // no origin remote — leave remoteUrl undefined
  }

  return facts;
}

function buildReconPrompt(
  dir: string,
  facts: { firstCommit?: string; lastCommit?: string; remoteUrl?: string },
): string {
  const lines = [`Project directory (use as local_path): ${dir}`];
  if (facts.firstCommit) lines.push(`First commit date (use as "started"): ${facts.firstCommit}`);
  if (facts.lastCommit) lines.push(`Most recent commit date (use as "last worked on"): ${facts.lastCommit}`);
  if (facts.remoteUrl) lines.push(`Git remote (use as repo_url): ${facts.remoteUrl}`);
  lines.push(
    "",
    "Inspect this project and produce the brief described in your instructions. Do not write or modify any files.",
  );
  return lines.join("\n");
}

type SseMessage =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; input?: unknown }
  | { type: "session"; sessionId: string }
  | { type: "phase"; label: string }
  | { type: "done"; exitCode: number | null; newSlug?: string; existed?: boolean }
  | { type: "error"; message: string };

/** kebab-case a folder name to a candidate slug (mirrors the POST /api/projects rule). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
