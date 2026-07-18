# CLAUDE.md
> This file is read by Claude Code at the start of every session in this project. Keep it lean — every rule competes for attention.

## Project
**Glass** — a deployed Next.js 16 portfolio dashboard. `content/projects/*.md` files are the source of truth; the app is a typed view over them. Live: https://glass-green-one.vercel.app — Repo: https://github.com/godfreyponce/glass. Phase 1 is shipped. Phase 2 is a deliberate migration to Postgres as a database-learning project — tracked as a card *inside* the dashboard; do not start the migration without explicit instruction.

## Stack
- Runtime: Node 20 / npm
- Framework: Next.js 16 (App Router) + Tailwind + TypeScript (strict)
- Content: Markdown files in `content/projects/`, parsed with `gray-matter`, validated with `zod`, rendered with `remark` + `remark-html`
- Writes: `@octokit/rest` against the portfolio repo. Env (`.env.local`, mirrored in `.env.example`): `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` (default `main`), `API_WRITE_SECRET`
- Write gate: `/api/projects` compares a form passphrase to `API_WRITE_SECRET` — a single env-secret string check, not an auth library or session. Compliant with the "no auth in Phase 1" rule below
- Deploy: Vercel (auto-deploys from `main`)
- Tests: Vitest (add when first non-trivial logic appears — don't scaffold prematurely)

## Feature surface (Phase 1)
- `/` — dashboard home; cards grouped by status in collapsible sections (In Progress open by default). Empty Planned section has a spot illustration. Header has a **Keys** popover (see API-key tracking).
- `/projects/[slug]` — detail page; full frontmatter table + rendered markdown body; `local_path` only shown with `?private=1`. `api_keys` are editable inline here.
- `/new` — manual form; passphrase field + POST to `/api/projects`; commits a new `.md` via Octokit. Includes repeatable `api_keys` rows.
- `/new/quick` — **dev-only**. Two paths: (1) describe a project in plain language; (2) **Choose project** → native macOS folder picker (`/api/pick-dir`) → two-stage headless pipeline: read-only *recon* in that dir builds a brief, then the schema-owning *card* agent writes the `.md`. Spawns local `claude` headless (`-p --output-format stream-json`, MAX-plan OAuth, no API key).
- **API-key tracking** — projects carry an optional `api_keys` array (metadata only, NEVER secrets). Card badge shows provider logos beside status; header **Keys** popover aggregates by provider → distinct key (identity = `label` ?? `location`) with per-project links that jump to + highlight the card. Recon auto-detects provider keys. Logos: `public/logos/<provider>.png` (object-contain, `shrink-0`), generic-key glyph fallback.
- **Inline editing** — padlock toggle (top-right of dashboard + detail) unlocks edit mode after passphrase check against `/api/auth/check`. Every frontmatter field is double-click-editable (`<EditableField>`); `api_keys` edit via `<EditableKeys>` (chips → click to edit, hover-✕ to remove, "Add key"); markdown body has an explicit "Edit body" button (`<EditableBody>`). Esc cancels, Enter (or Cmd/Ctrl+Enter for textareas) saves.
- **Hybrid persistence** — dev writes to `content/projects/*.md` on disk for instant feedback (router.refresh); prod commits via Octokit and shows a "Redeploying ~Ns" banner (`<RedeployBanner>`) with optimistic UI during the ~60s redeploy lag.
- Esc-to-go-back on detail / `/new` / `/new/quick`.

## Critical files
- `lib/schema.ts` — the Zod spine. `projectFrontmatterSchema` for full files, `projectInputSchema` for POST, `projectPatchSchema` for PATCH (strict). `apiKeySchema` + optional `api_keys` array (`provider`/`location`/`env_var?`/`label?`). `body` lives alongside frontmatter for transport.
- `lib/projects.ts` — server-side read (`readAllProjects`, `readProject`); normalizes frontmatter before validation.
- `lib/persist.ts` — hybrid write (`persistProjectFile` branches on `NODE_ENV`) + `readCurrentProject` (fetches latest from GitHub in prod to avoid stale-bundle clobbers).
- `lib/github.ts` — Octokit client; `createProjectFile` (no-clobber, used by POST) and `updateProjectFile` (overwrite-allowed, used by PATCH).
- `lib/markdown.ts` — `serializeProject` (gray-matter stringify) + `normalizeFrontmatter` (coerces YAML `Date` → `YYYY-MM-DD` string before validation; an unquoted date in a `.md` would otherwise fail the string schema and silently drop the project — a real footgun for agent-written files).
- `lib/keys.ts` — `aggregateKeys` (group `api_keys` by provider → distinct key) + `providerLabel`.
- `lib/focus.ts` — client event bus for "jump to a project card" from the Keys popover (`FOCUS_PROJECT_EVENT`, `playFocusPop`).
- `lib/claude-code.ts` — `spawnClaudeCode` (configurable `allowedTools`) + `SYSTEM_PROMPT` (card creator) + `RECON_SYSTEM_PROMPT` (read-only project recon; detects API keys, quotes dates); dev-only headless spawner.
- `app/api/projects/route.ts` — **POST** create; passphrase in body.
- `app/api/projects/[slug]/route.ts` — **PATCH** update; passphrase in `x-passphrase` header; accepts frontmatter fields (incl. `api_keys`; `null` clears) and `body`.
- `app/api/quick/route.ts` — **dev-only** SSE; single-stage (describe) or two-stage (recon-in-`projectDir` → card). 503 in prod.
- `app/api/pick-dir/route.ts` — **dev-only**, macOS only; native folder picker via `osascript`. 503 in prod.
- `app/api/auth/check/route.ts` — passphrase validator for the LockToggle.
- `components/LockProvider.tsx` + `LockToggle.tsx` — sessionStorage-backed edit state via `useLock()`.
- `components/EditableField.tsx` + `EditableBody.tsx` + `EditableKeys.tsx` — inline-edit primitives (`EditableKeys` = the `api_keys` array editor; PATCHes the whole array).
- `components/KeyBadge.tsx` / `KeysPopover.tsx` / `ProviderLogo.tsx` — API-key UI (card badge / header popover / logo with key-glyph fallback).
- `components/QuickChat.tsx` — dev-only Claude Code chat UI (describe + choose-project) with SSE parsing.
- `components/ProjectCard.tsx` / `ProjectSection.tsx` / `StatusBadge.tsx` / `RedeployBanner.tsx` / `EditableDetailView.tsx` / `NewProjectForm.tsx` / `EscToGoBack.tsx` / `PlannedSketch.tsx` — supporting UI.
- `content/projects/*.md` — the data. `public/logos/*.png` — provider logos.
- `.env.example` — full list of 5 env vars needed in Vercel and `.env.local`.
- `docs/superpowers/specs/*.md` — design specs (api-key tracking, quick-add-by-directory).

## How to verify your changes
Run these yourself before claiming "done."
```bash
npm run typecheck    # must pass (add to package.json scripts if absent: "tsc --noEmit")
npm run lint         # must pass
npm run build        # must pass — catches RSC / server-client boundary issues that dev hides
npm run dev          # smoke test in browser when relevant
```
For any change touching `lib/schema.ts` or `content/projects/*.md`, also confirm `readAllProjects()` parses every seed file without warnings.

## Workflow rules
- **Ticket system.** The work queue is GitHub Issues; `STATE.md`'s YAML head names the ticket that is up now. Protocol (one ticket = two sessions, `/plan-ticket` → `/build-ticket`, STATE.md written once per ticket in the accept-commit): `AGENTS.md`. Archive: `docs/HISTORY.md`. A test-gate hook blocks commits with a red suite.
- **Plan before code.** For any task bigger than a one-file change, output the plan first and wait for approval.
- **Verify, don't claim.** "Done" means typecheck + lint + build are green AND smoke-tested where relevant. Never say "this should work" — run it.
- **Surgical edits.** Smallest change that solves the problem. No incidental refactors. No reformatting unrelated files.
- **Ask before installing.** New dependencies need approval with one-line justification.
- **Stop and ask** when scope grew, or when two reasonable approaches exist with real tradeoffs.

## Schema is sacred
The Zod schema in `lib/schema.ts` is the spine of the entire app. The form, the API route, the read layer, and every `.md` file all depend on it matching.
- Never silently add fields to a `.md` file that aren't in the schema. Update the schema first.
- Never loosen the schema (e.g. making a required field optional) without flagging it as a breaking change and waiting for approval.
- If you need a new field: update `lib/schema.ts` → update the form → update the API route → update `ProjectCard` / detail page if it needs to render → only then write `.md` files using it.

## Hard nos
- No `console.log` left in committed code.
- No commented-out code in commits.
- No `TODO` / `FIXME` without a follow-up note.
- No silent error swallowing (`catch {}` empty).
- No hardcoded secrets. Use `.env.local` and `.env.example`.
- No `any` types. Use `unknown` and narrow.
- No client components unless interactivity actually requires it. Server components by default.
- No database, no Supabase, no auth library in Phase 1. That's Phase 2.

## Git commit policy
- Commits are authored by me directly using my git config. Use my identity, not a Claude identity.
- Never add `Co-Authored-By: Claude` trailers.
- Never add `🤖 Generated with Claude Code` footers or any AI-attribution text.
- Commit messages are plain conventional commits (feat:, fix:, chore:, refactor:, docs:, test:) without emoji.
- Sign nothing. No GPG signing required.

## Communication style
- Direct. No "Great question!" or "Let me know if you need anything else!"
- If I'm wrong, tell me. Cite file:line.
- If you were wrong, acknowledge in one line and move on.
- Spec content (this file, the README, the schema in `lib/schema.ts`) beats your assumptions. When in doubt, reread what I gave you.

## Pointers
- **Phase 2 / roadmap:** lives as a project card — `content/projects/portfolio-phase-2.md` (rendered at `/projects/portfolio-phase-2`). Authoritative for Phase 2 scope + open design questions. (The original `PLAN.md` / `CLAUDE_CODE_PROMPT.md` scaffolding were deleted once Phase 1 shipped; recover from git history if ever needed.)
- **Recon prompt (do not run here):** @RECON_PROMPT.md — pasted into Claude Code in *other* project directories to generate frontmatter for import. Not run in this repo.
- README: @README.md — human-facing setup + feature overview.
- Scripts: @package.json
