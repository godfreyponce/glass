import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

/**
 * Helper for invoking the Claude Code CLI (`claude`) in headless mode.
 *
 * DEV-ONLY. Spawns the user's local `claude` binary, which authenticates
 * via the user's MAX/Pro subscription OAuth — no API key, no per-call
 * billing. Cannot run on Vercel (no `claude` binary, no user auth).
 *
 * Reference: https://code.claude.com/docs/en/headless.md
 */

export function isAvailable(): boolean {
  return process.env.NODE_ENV !== "production";
}

export interface SpawnOptions {
  /** The user's prompt for this turn. */
  prompt: string;
  /** Continue a prior conversation by session_id (returned by `result` event). */
  resumeSessionId?: string;
  /** Additional system instructions appended to Claude Code's defaults. */
  systemPrompt: string;
  /** Working directory the agent operates in (project root, gives access to lib/schema.ts and content/projects/). */
  cwd: string;
  /** Comma-separated tool allowlist. Defaults to "Read,Write,Edit". Pass a
   *  read-only set (e.g. "Read,Grep,Glob") for recon in foreign directories. */
  allowedTools?: string;
}

export interface SpawnedClaude {
  child: ChildProcessWithoutNullStreams;
  /** Async iterable yielding parsed NDJSON events from stdout. */
  events: AsyncIterable<ClaudeEvent>;
  /** Resolves with the exit code when the subprocess terminates. */
  exitPromise: Promise<number | null>;
}

export type ClaudeEvent = Record<string, unknown> & { type?: string };

export function spawnClaudeCode(opts: SpawnOptions): SpawnedClaude {
  const args: string[] = [
    "-p",
    opts.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--allowedTools",
    opts.allowedTools ?? "Read,Write,Edit",
    "--permission-mode",
    "acceptEdits",
    "--append-system-prompt",
    opts.systemPrompt,
  ];
  if (opts.resumeSessionId) {
    args.push("--resume", opts.resumeSessionId);
  }

  const child = spawn("claude", args, {
    cwd: opts.cwd,
    env: process.env,
  });

  const exitPromise = new Promise<number | null>((resolve) => {
    child.once("close", (code) => resolve(code));
  });

  return { child, events: parseNdjsonStream(child), exitPromise };
}

async function* parseNdjsonStream(
  child: ChildProcessWithoutNullStreams,
): AsyncIterable<ClaudeEvent> {
  let buffer = "";
  for await (const chunk of child.stdout) {
    buffer += chunk.toString("utf8");
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (line.length === 0) continue;
      try {
        yield JSON.parse(line) as ClaudeEvent;
      } catch {
        // Forward non-JSON lines as raw text so debugging still works.
        yield { type: "raw", text: line };
      }
    }
  }
  if (buffer.trim().length > 0) {
    try {
      yield JSON.parse(buffer) as ClaudeEvent;
    } catch {
      yield { type: "raw", text: buffer };
    }
  }
}

/**
 * The system prompt that turns Claude Code into a portfolio-card creator.
 * Kept here (not the route handler) so it stays version-controlled and
 * reviewable alongside the schema it references.
 */
export const SYSTEM_PROMPT = `You are an assistant inside a Next.js portfolio dashboard. The user wants to add a new project entry quickly from a one-line description.

Source of truth: markdown files in content/projects/<slug>.md. The locked frontmatter shape is defined in lib/schema.ts (Zod). Read that file first if you need to confirm the exact fields and rules.

Your job, in one turn:
1. From the user's description, fill out the frontmatter sensibly. Pick reasonable defaults. Ask follow-up questions only if you genuinely cannot proceed.
2. Generate a kebab-case slug from the project name (lowercase, hyphens, no other punctuation).
3. Write the file at content/projects/<slug>.md with valid YAML frontmatter and a short starter markdown body (2-4 sentences describing the project).
4. Confirm to the user what you created (project name and slug) in one short sentence.

Rules you must follow:
- next_action is REQUIRED when status is "in-progress" or "planned"; optional otherwise.
- Dates are YYYY-MM-DD and MUST be written as quoted strings (e.g. started: "2026-06-20") so YAML doesn't parse them as timestamps. Use today's date for started and last_worked_on unless the user specifies.
- Do not invent repo_url or live_url. Omit them if the user didn't mention.
- Slug in the frontmatter must match the filename.
- Stack must have at least one entry. If the user didn't say, infer from the description.
- If the description identifies API keys (a provider plus an env var, and possibly where it's stored), populate the frontmatter \`api_keys\` array per lib/schema.ts: each entry needs a lowercase \`provider\` (e.g. anthropic, openai) and a required \`location\` (where the key is stored — prefer the env file like ".env.local" if that's all you know; NEVER the secret value); \`env_var\` and \`label\` are optional. Only include real third-party provider keys, never app secrets like session secrets or passwords.

Style:
- The user wants a card created fast. Keep your prose minimal.
- Don't quote large blocks of YAML back at them; the dashboard renders the card itself.
- If the user's description is genuinely ambiguous on something critical (e.g. "I'm building something cool"), ask ONE focused clarifying question; don't ask a chain.`;

/**
 * System prompt for the RECON stage: a read-only pass over a real project
 * directory that produces a plain-language brief for the card-creating agent.
 * It must NOT write files — it only inspects and reports. The card agent (which
 * owns the schema) turns this brief into content/projects/<slug>.md afterward.
 */
export const RECON_SYSTEM_PROMPT = `You are doing reconnaissance on a software project so it can be added to a portfolio dashboard. You are read-only: you have Read, Grep, and Glob tools only. Do NOT attempt to write or modify anything.

Inspect the project in your working directory and produce a concise plain-language brief. To do that:
1. List the top-level files; read the build manifest (package.json, pyproject.toml, Cargo.toml, requirements.txt, go.mod, etc.) and the README if present.
2. Identify the primary language and framework, and the key libraries.
3. Find the entry point (e.g. app/page.tsx, main.py, src/index.ts) and the run/dev command.
4. Skim for TODO/FIXME and the README to infer the project's purpose and current state.
5. Detect any third-party provider API keys the project uses: check dependencies for provider SDKs (e.g. @anthropic-ai/sdk, openai, stripe) and read .env.example / .env templates / README / config for env vars like ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.

Then output ONLY the brief — no preamble, no questions, no file writes — covering, as far as you can determine:
- Project name (title case) and a suggested kebab-case slug.
- Best-guess status: planned | in-progress | completed | archived (judge from README maturity, activity, presence of a deployed URL).
- Stack: framework, language, key libraries (up to 6).
- A suggested next action — one sentence, based on TODOs and project state.
- The run command and the entry point path.
- A one-sentence, plain-English recruiter pitch (no jargon): what it does and why it's interesting.
- 3–5 lowercase tags.
- API keys: any third-party provider API keys the project uses. For each, give the provider id (lowercase, e.g. anthropic, openai), the env var name (e.g. ANTHROPIC_API_KEY), and where the key appears to be stored (e.g. ".env.local" if there's a .env template) — note "storage location unknown" if you can't tell. Exclude generic app secrets (session secrets, passwords, database URLs); only external-service API keys. If there are none, say "no API keys".

Some facts (git dates, repo remote, the directory path) are provided to you in the message — use them; don't try to run git yourself (you can't). Keep the brief tight and factual. If you genuinely cannot determine something, say so briefly rather than inventing it.`;
