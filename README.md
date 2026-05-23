# Portfolio Dashboard

A deployed Next.js 16 app that renders a project portfolio from markdown files.
The markdown files in `content/projects/*.md` are the source of truth; the
dashboard is a view over them. Phase 1 — no database, no real auth (a passphrase
gates writes); the database migration is tracked as a project card inside the
dashboard (`content/projects/portfolio-phase-2.md`).

- **Dashboard** (`/`) — projects grouped into In Progress / Planned / Completed,
  in collapsible sections.
- **Detail** (`/projects/[slug]`) — full metadata + rendered markdown body.
  `local_path` is private and only shown with `?private=1`.
- **New Project** (`/new`) — a form that commits a new `.md` to the repo via the
  GitHub API, gated by a passphrase. The commit triggers a Vercel redeploy.
- **Quick add** (`/new/quick`) — *dev-only* chat that drives your local Claude Code
  to write the `.md` from a plain-language description (see below).
- **Inline editing** — unlock the padlock (top-right) with the passphrase, then edit
  any field, or the body, in place. Changes write back to the markdown (see below).

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 ·
`gray-matter` · `remark`/`remark-html` · `zod` (schema) · `@octokit/rest`.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Required environment variables

| Variable           | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `GITHUB_TOKEN`     | Fine-grained PAT, scoped to **only** this repo, Contents: R/W.  |
| `GITHUB_OWNER`     | GitHub user/org that owns the repo.                            |
| `GITHUB_REPO`      | Repo name where markdown lives.                                |
| `GITHUB_BRANCH`    | Branch to commit to (default `main`).                          |
| `API_WRITE_SECRET` | Passphrase the `/new` form must send; checked server-side.     |

Only `GITHUB_TOKEN` and `API_WRITE_SECRET` are secret. Set all of them in the
Vercel project settings for the deployed app; the form's passphrase field is
validated against `API_WRITE_SECRET` and never ships to the client bundle.

## Adding a project

**Path 1 — manually (recommended for control):** create
`content/projects/<slug>.md` with frontmatter matching the locked schema in
`lib/schema.ts` (see any seed file for a template), commit, push. Vercel
redeploys and it appears.

**Path 2 — the form:** go to `/new`, fill it in, enter the passphrase, submit.
The API route (`app/api/projects/route.ts`) validates against the Zod schema,
derives a kebab-case slug from the name if you leave slug blank, and commits
`content/projects/<slug>.md` via Octokit. Existing slugs are rejected (409).

**Path 3 — agentic import:** to add an *existing* project on your machine, run
Claude Code from inside that project's directory and paste `RECON_PROMPT.md`.
It emits schema-conformant YAML you paste into the `/new` form (or hand to the
API). See `RECON_PROMPT.md`.

**Path 4 — Quick add (`/new/quick`, dev-only):** describe a project in plain
language; the page spawns your local Claude Code CLI in headless mode (using your
MAX/Pro subscription — no API key) and it writes `content/projects/<slug>.md`
directly, validated against the schema. Requires `claude` installed and logged in.
Hidden in production — Vercel can't run your local CLI.

## Editing a project

Click the **padlock** (top-right of the dashboard or any detail page) and enter the
passphrase (`API_WRITE_SECRET`) to unlock edit mode. Then:

- **Double-click any frontmatter field** (name, status, stack, dates, …) to edit
  it inline. Enter saves, Esc cancels.
- **"Edit body"** on a detail page opens a markdown textarea for the body.

Persistence is hybrid: in local dev, edits write straight to the `.md` file
(instant); in production they commit to GitHub via Octokit and a "redeploying"
banner shows while the live site catches up (~1 min). Or just edit the `.md` file
directly and push — same result.

The frontmatter schema is the spine of the app — read the "Schema is sacred"
section of `CLAUDE.md` before changing it.

## Verify

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run build       # production build
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (framework auto-detected as Next.js).
3. Add the five environment variables above in Project Settings → Environment
   Variables (Production + Preview).
4. Deploy. The GitHub token's repo must match `GITHUB_OWNER`/`GITHUB_REPO` so
   that form submissions commit back to the same repo and trigger redeploys.

## Phase 2 (not started)

Migrating the read layer from the filesystem to Postgres/Prisma, plus real auth
and delete-via-UI — a deliberate database-learning project. The full scope and
open questions are tracked as a project card inside the dashboard itself:
`content/projects/portfolio-phase-2.md`. Do not start without explicit instruction.
