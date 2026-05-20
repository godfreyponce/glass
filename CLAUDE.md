# CLAUDE.md
> This file is read by Claude Code at the start of every session in this project. Keep it lean — every rule competes for attention.

## Project
Personal portfolio dashboard. A deployed Next.js 16 app that renders my project portfolio from markdown files in `content/projects/*.md`. Two ingestion paths: a `/new` form that commits a new `.md` to the repo via Octokit, and an agentic recon path where Claude Code (in *another* directory) outputs YAML frontmatter I paste in. Markdown is the source of truth in Phase 1. Phase 2 is a deliberate migration to Postgres as a database-learning project — do not start it without explicit instruction.

## Stack
- Runtime: Node 20 / npm
- Framework: Next.js 16 (App Router) + Tailwind + TypeScript (strict)
- Content: Markdown files in `content/projects/`, parsed with `gray-matter`, validated with `zod`, rendered with `remark` + `remark-html`
- Writes: `@octokit/rest` against the portfolio repo. Env (`.env.local`, mirrored in `.env.example`): `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` (default `main`), `API_WRITE_SECRET`
- Write gate: `/api/projects` compares a form passphrase to `API_WRITE_SECRET` — a single env-secret string check, not an auth library or session. Compliant with the "no auth in Phase 1" rule below
- Deploy: Vercel
- Tests: Vitest (add when first non-trivial logic appears — don't scaffold prematurely)

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
- Spec content (PLAN.md, this file) beats your assumptions. When in doubt, reread what I gave you.

## Pointers
- **Spec:** @PLAN.md — full architecture, locked frontmatter schema, page-by-page breakdown, Phase 2 preview. Read first on every new session.
- **Build order:** @CLAUDE_CODE_PROMPT.md — 13-step sequence for the initial scaffold. Already executed if `app/` exists.
- **Recon prompt (do not run here):** @RECON_PROMPT.md — pasted into Claude Code in *other* project directories to generate frontmatter for import. Not used in this repo's workflow except as reference.
- README: @README.md
- Scripts: @package.json
