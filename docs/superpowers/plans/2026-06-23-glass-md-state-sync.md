# glass.md State Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each project publish a `glass.md` state file; the Glass dashboard reads it to sync a card's `status` / `last_worked_on` / `next_action` — via chat (works today) and a dev-only "Update state" button in `/new/quick`.

**Architecture:** Two halves joined by one file. A paste-in prompt (`GLASS_PROMPT.md`) makes a project's own Claude write `glass.md` (the *publisher*). The dashboard *reader* is a plain `read file → validate → PATCH`: no Claude spawn, deterministic. A new `lib/glass-md.ts` parses/validates `glass.md`; a new dev-only route previews and applies the three-field patch; a new tab in `/new/quick` drives it.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Zod, gray-matter, Vitest (added in Task 1).

## Global Constraints

- **Schema is sacred.** Do NOT modify `lib/schema.ts`. `glass.md` is a *separate* file format that only *reuses* the status enum and ISO-date rule. (`CLAUDE.md` → "Schema is sacred")
- **Scope of a sync:** only `status`, `last_worked_on`, `next_action` may change on a card. Never `name`, `stack`, `recruiter_pitch`, `api_keys`, `repo_url`, `live_url`, `body`, etc.
- **Dev-only surfaces** must return HTTP 503 in production via `isAvailable()` from `@/lib/claude-code` (`process.env.NODE_ENV !== "production"`), mirroring `app/api/quick/route.ts`.
- **No `any`.** Use `unknown` and narrow. No `console.log`, no commented-out code, no empty `catch {}`, no `TODO`/`FIXME` without a note. (`CLAUDE.md` → "Hard nos")
- **No secrets** ever read from or written to `glass.md`.
- **Status values** (verbatim): `planned`, `in-progress`, `completed`, `archived`.
- **Dates** are `YYYY-MM-DD` strings. Unquoted YAML dates parse to `Date`; normalize with `normalizeFrontmatter` from `@/lib/markdown` before Zod validation.
- **Slug rule** (verbatim regex): `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
- **`next_action` required** when `status` is `in-progress` or `planned`; optional otherwise.
- **Commits:** plain conventional commits, no emoji, no `Co-Authored-By`, no AI-attribution footer. (`CLAUDE.md` → "Git commit policy")
- **Verify gate** before "done": `npm run typecheck && npm run lint && npm run build` all green; dev smoke-test where noted.

---

## File Structure

- **Create** `vitest.config.ts` — Vitest config with `@/` path alias (Task 1).
- **Create** `lib/glass-md.ts` — parse + validate a `glass.md` into typed state, and read it from a project dir. The only reasoning-free contract reader.
- **Create** `lib/glass-md.test.ts` — Vitest unit tests for the parser.
- **Create** `GLASS_PROMPT.md` (repo root) — paste-in prompt that writes `glass.md` in a foreign project. Sibling to `RECON_PROMPT.md`.
- **Create** `app/api/quick/update/route.ts` — dev-only `POST`: preview (default) or apply (`apply: true`) a three-field sync.
- **Create** `components/QuickUpdate.tsx` — dev-only client UI: pick a project, see the `old → new` diff, Apply.
- **Create** `components/QuickTabs.tsx` — client wrapper toggling "Add" (`QuickChat`) and "Update state" (`QuickUpdate`).
- **Modify** `app/new/quick/page.tsx` — in the dev branch, read projects and render `<QuickTabs>` instead of `<QuickChat>` directly.

Interfaces are deterministic file IO + HTTP; no shared in-memory state. The PATCH route and inline-edit components are **not** touched.

---

## Task 1: `lib/glass-md.ts` — parse & validate `glass.md`

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/glass-md.ts`
- Test: `lib/glass-md.test.ts`
- Modify: `package.json` (add `vitest` devDependency + `test` script)

**Interfaces:**
- Consumes: `STATUS_VALUES`, `ProjectStatus` from `@/lib/schema`; `normalizeFrontmatter` from `@/lib/markdown`.
- Produces:
  - `interface GlassState { slug: string; status: ProjectStatus; last_worked_on: string; next_action?: string }`
  - `type GlassParseResult = { ok: true; state: GlassState } | { ok: false; error: string }`
  - `function parseGlassState(raw: string): GlassParseResult`
  - `function readGlassState(projectDir: string): Promise<GlassParseResult>`

- [ ] **Step 1: Add Vitest (requires dependency approval — see Global Constraints).**

Run:
```bash
npm install --save-dev vitest
```
Add a `test` script to `package.json` `scripts`:
```json
"test": "vitest run"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 3: Write the failing tests** in `lib/glass-md.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseGlassState } from "@/lib/glass-md";

const file = (fm: string) => `---\n${fm}\n---\nA progress note.\n`;

describe("parseGlassState", () => {
  it("parses a valid completed glass.md (next_action optional)", () => {
    const r = parseGlassState(
      file('slug: clyde-mochi\nstatus: completed\nlast_worked_on: "2026-06-22"'),
    );
    expect(r).toEqual({
      ok: true,
      state: { slug: "clyde-mochi", status: "completed", last_worked_on: "2026-06-22" },
    });
  });

  it("parses an in-progress glass.md with next_action", () => {
    const r = parseGlassState(
      file('slug: kal\nstatus: in-progress\nlast_worked_on: "2026-06-20"\nnext_action: "Wire up auth"'),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.next_action).toBe("Wire up auth");
  });

  it("normalizes an unquoted YAML date to a string", () => {
    const r = parseGlassState(file("slug: kal\nstatus: completed\nlast_worked_on: 2026-06-22"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.last_worked_on).toBe("2026-06-22");
  });

  it("rejects an unknown status", () => {
    const r = parseGlassState(file('slug: kal\nstatus: shipping\nlast_worked_on: "2026-06-22"'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/status/);
  });

  it("rejects in-progress without next_action", () => {
    const r = parseGlassState(file('slug: kal\nstatus: in-progress\nlast_worked_on: "2026-06-22"'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/next_action/);
  });

  it("rejects a non-kebab slug", () => {
    const r = parseGlassState(file('slug: Clyde_Mochi\nstatus: completed\nlast_worked_on: "2026-06-22"'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/slug/);
  });

  it("rejects a malformed date", () => {
    const r = parseGlassState(file('slug: kal\nstatus: completed\nlast_worked_on: "June 22"'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/last_worked_on/);
  });
});
```

- [ ] **Step 4: Run the tests — verify they fail**

Run: `npx vitest run lib/glass-md.test.ts`
Expected: FAIL — `Cannot find module '@/lib/glass-md'` (file not created yet).

- [ ] **Step 5: Implement `lib/glass-md.ts`**

```ts
import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { z } from "zod";

import { STATUS_VALUES, type ProjectStatus } from "@/lib/schema";
import { normalizeFrontmatter } from "@/lib/markdown";

/**
 * The state a project publishes to the dashboard via a root-level `glass.md`.
 * Mirrors the three volatile card fields plus the slug that ties it to a card.
 * This is a SEPARATE file format from the card frontmatter — it only reuses
 * the status enum and ISO-date rule. It is never the secret-bearing schema.
 */
export interface GlassState {
  slug: string;
  status: ProjectStatus;
  last_worked_on: string;
  next_action?: string;
}

export type GlassParseResult =
  | { ok: true; state: GlassState }
  | { ok: false; error: string };

const glassStateSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case (a-z, 0-9, hyphens)"),
    status: z.enum(STATUS_VALUES),
    last_worked_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "last_worked_on must be an ISO date (YYYY-MM-DD)"),
    next_action: z.string().min(1).optional(),
  })
  .superRefine((d, ctx) => {
    if ((d.status === "in-progress" || d.status === "planned") && !d.next_action) {
      ctx.addIssue({
        code: "custom",
        message: "next_action is required for in-progress and planned projects",
        path: ["next_action"],
      });
    }
  });

/** Parse a raw glass.md string into typed state, or a human-readable error. */
export function parseGlassState(raw: string): GlassParseResult {
  let data: Record<string, unknown>;
  try {
    data = matter(raw).data;
  } catch (err) {
    return {
      ok: false,
      error: `Could not parse glass.md frontmatter: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  const parsed = glassStateSchema.safeParse(normalizeFrontmatter(data));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, state: parsed.data };
}

/** Read and parse `<projectDir>/glass.md`. Missing file → a clear, actionable error. */
export async function readGlassState(projectDir: string): Promise<GlassParseResult> {
  const filePath = path.join(projectDir, "glass.md");
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        ok: false,
        error: `No glass.md found at ${filePath}. Paste GLASS_PROMPT.md into Claude Code inside that project to create one.`,
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return parseGlassState(raw);
}
```

- [ ] **Step 6: Run the tests — verify they pass**

Run: `npx vitest run lib/glass-md.test.ts`
Expected: PASS — 7 passing.

- [ ] **Step 7: Typecheck & lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts lib/glass-md.ts lib/glass-md.test.ts package.json package-lock.json
git commit -m "feat: add glass.md parser and validator"
```

---

## Task 2: `GLASS_PROMPT.md` — the paste-in publisher prompt

**Files:**
- Create: `GLASS_PROMPT.md` (repo root)

**Interfaces:**
- Consumes: nothing (a document).
- Produces: a `glass.md` (in foreign projects) whose frontmatter shape exactly matches what `parseGlassState` (Task 1) accepts: `slug`, `status`, `last_worked_on`, optional `next_action`.

- [ ] **Step 1: Create `GLASS_PROMPT.md`**

```markdown
# Glass State Prompt — Update Your Portfolio Card

Paste this into Claude Code from inside a project directory whenever you want the
Glass portfolio dashboard to reflect the project's current state. It writes (or
overwrites) a `glass.md` file at the project root. The dashboard reads that file
to update the project's card — only the status, last-worked-on date, and next
action. It never touches anything else.

---

You are updating this project's published state for my portfolio dashboard. Look
at the project and write a single file named `glass.md` at the repository root.

Do this:

1. Determine the project's current `status`: one of `planned`, `in-progress`,
   `completed`, or `archived`. Judge from README maturity, recent git activity,
   open TODOs, and whether it appears deployed.
2. Determine `last_worked_on` — the date of the most recent git commit
   (`git log -1 --format=%cs`). Fall back to today if there is no git history.
3. Determine `next_action` — one short sentence on the most sensible next step,
   based on TODO/FIXME comments and the project's state.
4. Determine `slug` — the kebab-case identifier of this project's existing card
   (lowercase, hyphens only). If unsure, use the kebab-case of the project name;
   it MUST match the card's slug on the dashboard or the sync won't find it.

Then write `glass.md` with EXACTLY this shape and nothing else:

\`\`\`yaml
---
slug: "<kebab-case-slug>"
status: "<planned | in-progress | completed | archived>"
last_worked_on: "<YYYY-MM-DD>"
next_action: "<one sentence>"
---
<One or two sentences of plain-language progress notes — what changed recently.>
\`\`\`

Rules you MUST follow:
- Dates MUST be quoted strings in `YYYY-MM-DD` form (e.g. `"2026-06-22"`), so YAML
  doesn't parse them as timestamps.
- `status` MUST be one of the four exact values above.
- `next_action` is REQUIRED when `status` is `in-progress` or `planned`; omit it
  otherwise if there's nothing meaningful to do next.
- NEVER put secrets, API keys, tokens, or passwords in `glass.md`. It is metadata
  only and will be committed to the repo.
- Write ONLY the file. Don't print the YAML back or add commentary.

After writing the file, confirm in one short sentence what status you set.
```

- [ ] **Step 2: Verify the embedded frontmatter matches the parser**

Read `lib/glass-md.ts` `glassStateSchema`. Confirm the four field names (`slug`,
`status`, `last_worked_on`, `next_action`) and the status values match exactly.
Expected: identical field names and the four status values.

- [ ] **Step 3: Commit**

```bash
git add GLASS_PROMPT.md
git commit -m "docs: add GLASS_PROMPT paste-in prompt for publishing glass.md"
```

---

## Task 3: `app/api/quick/update/route.ts` — dev-only preview + apply

**Files:**
- Create: `app/api/quick/update/route.ts`

**Interfaces:**
- Consumes: `isAvailable` from `@/lib/claude-code`; `readCurrentProject`, `persistProjectFile` from `@/lib/persist`; `readGlassState` from `@/lib/glass-md`; `projectFrontmatterSchema` from `@/lib/schema`; `matter` from `gray-matter`.
- Produces: `POST /api/quick/update`.
  - Request body: `{ slug: string; apply?: boolean }`.
  - Preview response (no `apply`): `{ slug, current: StateTriple, proposed: StateTriple }` where `StateTriple = { status: string; last_worked_on: string; next_action?: string }`.
  - Apply response (`apply: true`): `{ slug, applied: StateTriple, persistence: "local" | "github" }`.
  - Errors: 503 (prod), 400 (bad slug / no `local_path`), 404 (no card), 409 (slug mismatch), 422 (bad/missing glass.md or merged validation), 500 (persist failure).

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import matter from "gray-matter";

import { isAvailable } from "@/lib/claude-code";
import { readCurrentProject, persistProjectFile } from "@/lib/persist";
import { readGlassState } from "@/lib/glass-md";
import { projectFrontmatterSchema } from "@/lib/schema";

/**
 * POST /api/quick/update — DEV-ONLY.
 *
 * Reads a project's root-level glass.md (located via the card's local_path) and
 * syncs ONLY status / last_worked_on / next_action onto the card.
 *  - Default: returns a { current, proposed } preview, no mutation.
 *  - With { apply: true }: writes the three-field patch and persists the file.
 *
 * No Claude spawn — glass.md is already structured, so this is a deterministic
 * read → validate → patch. Production responds 503 (it reads the local FS).
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(request: Request): Promise<Response> {
  if (!isAvailable()) {
    return NextResponse.json(
      {
        error:
          "Update state is a dev-only feature — it reads glass.md from your local project folders, which the deployed site can't access.",
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

  const slug = (body as { slug?: unknown }).slug;
  const apply = (body as { apply?: unknown }).apply === true;
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "Invalid or missing slug." }, { status: 400 });
  }

  const current = await readCurrentProject(slug);
  if (!current) {
    return NextResponse.json(
      { error: `No project found at slug "${slug}".` },
      { status: 404 },
    );
  }

  const localPath = current.frontmatter.local_path;
  if (!localPath) {
    return NextResponse.json(
      { error: `Card "${slug}" has no local_path, so its glass.md can't be located.` },
      { status: 400 },
    );
  }

  const result = await readGlassState(localPath);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  const state = result.state;

  if (state.slug !== slug) {
    return NextResponse.json(
      {
        error: `glass.md declares slug "${state.slug}" but you're updating card "${slug}". Fix the slug in glass.md.`,
      },
      { status: 409 },
    );
  }

  const proposed = {
    status: state.status,
    last_worked_on: state.last_worked_on,
    ...(state.next_action !== undefined ? { next_action: state.next_action } : {}),
  };
  const currentTriple = {
    status: current.frontmatter.status,
    last_worked_on: current.frontmatter.last_worked_on,
    ...(current.frontmatter.next_action !== undefined
      ? { next_action: current.frontmatter.next_action }
      : {}),
  };

  if (!apply) {
    return NextResponse.json({ slug, current: currentTriple, proposed });
  }

  // Apply: overlay ONLY the three state fields onto the current frontmatter.
  const merged: Record<string, unknown> = { ...current.frontmatter };
  merged.status = state.status;
  merged.last_worked_on = state.last_worked_on;
  if (state.next_action !== undefined) {
    merged.next_action = state.next_action;
  } else {
    delete merged.next_action;
  }

  const finalCheck = projectFrontmatterSchema.safeParse(merged);
  if (!finalCheck.success) {
    return NextResponse.json(
      {
        error: "Merged result failed validation.",
        issues: finalCheck.error.issues.map((i) => ({
          field: i.path.join(".") || "(root)",
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const data = Object.fromEntries(
    Object.entries(finalCheck.data).filter(([, v]) => v !== undefined),
  );
  const fileContents = matter.stringify(`\n${current.body.trim()}\n`, data);

  try {
    const persistResult = await persistProjectFile(slug, fileContents);
    return NextResponse.json({ slug, applied: proposed, persistence: persistResult.mode });
  } catch (err) {
    console.error(`Update ${slug} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to persist the project file." },
      { status: 500 },
    );
  }
}
```

> Note: `console.error` in a `catch` is allowed (it mirrors the existing PATCH route at `app/api/projects/[slug]/route.ts:133`); the "no console.log" rule targets stray `console.log`, not error logging.

- [ ] **Step 2: Typecheck & lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Smoke-test the preview path (dev server running)**

Pick a real card slug that has a `local_path`, and ensure a `glass.md` exists in that folder (write a temporary one matching Task 2's shape). Then:
```bash
curl -s -X POST http://localhost:3000/api/quick/update \
  -H 'Content-Type: application/json' \
  -d '{"slug":"<real-slug>"}' | npx --yes json 2>/dev/null || \
curl -s -X POST http://localhost:3000/api/quick/update \
  -H 'Content-Type: application/json' -d '{"slug":"<real-slug>"}'
```
Expected: JSON `{ slug, current: {...}, proposed: {...} }`. With a bogus slug → 404; with a card lacking `local_path` → 400; with no glass.md → 422 and the actionable message.

- [ ] **Step 4: Smoke-test the apply path**

```bash
curl -s -X POST http://localhost:3000/api/quick/update \
  -H 'Content-Type: application/json' -d '{"slug":"<real-slug>","apply":true}'
```
Expected: `{ slug, applied: {...}, persistence: "local" }`, and `content/projects/<slug>.md` now shows the new status/date/next_action with all other fields and the body unchanged (`git diff` that file to confirm only the three fields moved).

- [ ] **Step 5: Revert the smoke-test mutation**

```bash
git checkout -- content/projects/<slug>.md
```
(If you created a temporary `glass.md` in a foreign folder for testing, delete it.)

- [ ] **Step 6: Commit**

```bash
git add app/api/quick/update/route.ts
git commit -m "feat: add dev-only glass.md update route"
```

---

## Task 4: "Update state" UI in `/new/quick`

**Files:**
- Create: `components/QuickUpdate.tsx`
- Create: `components/QuickTabs.tsx`
- Modify: `app/new/quick/page.tsx`

**Interfaces:**
- Consumes: `POST /api/quick/update` (Task 3); `readAllProjects` from `@/lib/projects`.
- `QuickTabs` props: `{ projects: ProjectOption[] }` where
  `interface ProjectOption { slug: string; name: string; status: string; last_worked_on: string; next_action?: string }`.
- `QuickUpdate` props: `{ projects: ProjectOption[] }`.

- [ ] **Step 1: Create `components/QuickUpdate.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `components/QuickTabs.tsx`**

```tsx
"use client";

import { useState } from "react";

import QuickChat from "@/components/QuickChat";
import QuickUpdate, { type ProjectOption } from "@/components/QuickUpdate";

export default function QuickTabs({ projects }: { projects: ProjectOption[] }) {
  const [tab, setTab] = useState<"add" | "update">("add");

  const tabClass = (active: boolean) =>
    `rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-[#111111] text-white" : "border border-line bg-surface text-ink hover:bg-[#f7f6f3]"
    }`;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setTab("add")} className={tabClass(tab === "add")}>
          Add
        </button>
        <button type="button" onClick={() => setTab("update")} className={tabClass(tab === "update")}>
          Update state
        </button>
      </div>

      {tab === "add" ? <QuickChat /> : <QuickUpdate projects={projects} />}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `app/new/quick/page.tsx`**

Replace the `QuickChat` import with `QuickTabs`, read projects, and pass them through. Change the import line:
```tsx
import QuickTabs from "@/components/QuickTabs";
import { readAllProjects } from "@/lib/projects";
```
Make the component async and build the options inside it (the dev branch only):
```tsx
export default async function QuickAddPage() {
  const dev = isAvailable();
  const projects = dev
    ? (await readAllProjects()).map((p) => ({
        slug: p.slug,
        name: p.name,
        status: p.status,
        last_worked_on: p.last_worked_on,
        next_action: p.next_action,
      }))
    : [];
```
Then replace `{dev ? (<QuickChat />) : (` with `{dev ? (<QuickTabs projects={projects} />) : (`. Leave the production fallback block unchanged. Remove the now-unused `QuickChat` import.

- [ ] **Step 4: Typecheck, lint, build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all exit 0. The build is the real gate here — it catches RSC/server-client boundary issues (`QuickTabs`/`QuickUpdate` are client components; the page stays a server component passing plain-object props).

- [ ] **Step 5: Dev smoke test**

Run `npm run dev`, open `/new/quick`:
- The "Add" tab still shows the existing `QuickChat` and works.
- The "Update state" tab lists your projects. Pick one with a `glass.md` in its folder → the diff table renders, changed cells are highlighted.
- Click **Apply to card** → success banner + link; return to `/` and confirm the card reflects the new status/date/next action.
- Pick a project with no `glass.md` → the actionable error shows; nothing is applied.

- [ ] **Step 6: Commit**

```bash
git add components/QuickUpdate.tsx components/QuickTabs.tsx app/new/quick/page.tsx
git commit -m "feat: add Update state tab to quick add"
```

---

## Final verification

- [ ] `npm run typecheck && npm run lint && npm run build` — all green.
- [ ] `npx vitest run` — all tests pass.
- [ ] `readAllProjects()` still parses every seed file without warnings (no schema change, but confirm the dev server logs are clean on `/`).
- [ ] Chat path works (no code needed): in a Claude Code session, "update <slug>" reads the card's `local_path`, reads `glass.md`, shows `old → new`, and PATCHes on approval.

## Self-review notes (for the implementer)

- **Schema untouched:** Task 1 deliberately defines a *separate* `glassStateSchema`; it does not import or alter `projectFrontmatterSchema`'s shape. The apply path in Task 3 validates the merged result against `projectFrontmatterSchema` so a card can never be left invalid.
- **Three-field scope enforced twice:** the route only ever writes `status`/`last_worked_on`/`next_action` onto a spread of the existing frontmatter; the body is carried over verbatim from `current.body`.
- **`next_action` clearing:** when `glass.md` omits `next_action` (allowed only for completed/archived), the apply path deletes it from the card. The final `projectFrontmatterSchema` check still enforces "required for in-progress/planned," so an inconsistent glass.md is rejected, not silently applied.
