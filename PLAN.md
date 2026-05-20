# Portfolio Dashboard — Phase 1 Plan

A deployed Next.js dashboard that renders my project portfolio from markdown files. Markdown is the source of truth; the dashboard is a view. Phase 2 migrates to Postgres as a deliberate database-learning project.

## Goals

1. Single pane of glass for every project — planned, in-progress, completed
2. Cold-start recovery: I can look at any entry and know how to run it, where I left off, what's next
3. Recruiter-facing: public URL, polished design, real project content
4. Two ingestion paths: manual form (new projects) + Claude Code recon (existing projects)

## Non-goals (Phase 1)

- Database (Phase 2)
- Auth (Phase 2 — Phase 1 uses GitHub API token in env for writes, only I have the deploy)
- Editing existing projects via UI (edit the `.md` file directly for now)
- Deleting projects via UI (delete the `.md` file directly)

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- `gray-matter` for YAML frontmatter parsing
- `remark` + `remark-html` for markdown body rendering
- `zod` for frontmatter schema validation (locked schema, LAVA-2 style)
- `@octokit/rest` for GitHub API writes (the "New Project" form)
- Deploy: Vercel
- Repo: GitHub (markdown lives in repo, commits trigger redeploys)

## File structure

```
portfolio-dashboard/
├── app/
│   ├── page.tsx                    # Dashboard home — grouped by status
│   ├── projects/
│   │   └── [slug]/
│   │       └── page.tsx            # Project detail page
│   ├── new/
│   │   └── page.tsx                # "New Project" form
│   └── api/
│       └── projects/
│           └── route.ts            # POST handler — writes .md via Octokit
├── content/
│   └── projects/
│       ├── lava-2.md
│       ├── foro-sports-club.md
│       └── ...
├── lib/
│   ├── projects.ts                 # readAllProjects(), readProject(slug)
│   ├── schema.ts                   # Zod schema for frontmatter
│   └── github.ts                   # Octokit client for writes
└── components/
    ├── ProjectCard.tsx
    ├── StatusBadge.tsx
    └── NewProjectForm.tsx
```

## Locked frontmatter schema (the spine)

This is the contract. Every `.md` file must match this. Zod validates on read; the form enforces on write.

```yaml
---
name: "LAVA-2"                          # required, string
slug: "lava-2"                          # required, kebab-case, matches filename
status: "completed"                     # required, enum: planned | in-progress | completed | archived
priority: "high"                        # required, enum: high | medium | low
stack: ["Next.js", "TypeScript"]        # required, array of strings
started: "2026-03-15"                   # required, ISO date
last_worked_on: "2026-04-20"            # required, ISO date
next_action: "Integrate Prisma..."      # required for in-progress/planned; optional for completed
run_command: "npm run dev"              # optional, string
entry_point: "app/page.tsx"             # optional, string
local_path: "~/projects/lava-2"         # optional, string (private — don't show on public view)
repo_url: "https://github.com/..."      # optional, URL
live_url: "https://..."                 # optional, URL
recruiter_pitch: "Built an Obsidian..." # optional, one-sentence summary for the front-facing card
tags: ["ai", "obsidian", "agents"]      # optional, array
---

# Markdown body
Longer notes, retros, screenshots, architecture diagrams.
```

## Pages

### `/` (Dashboard home)
- Header: name, short bio, link to portfolio site
- Three columns or stacked sections: **In Progress** / **Planned** / **Completed**
- Each project = card showing name, recruiter pitch, stack badges, status badge, last-worked-on date, link to detail page
- "+ New Project" button top-right

### `/projects/[slug]` (Detail page)
- Full frontmatter rendered cleanly (status, stack, dates, next action, run command, entry point)
- Repo and live links
- Markdown body rendered below
- Private fields (`local_path`) only shown if a query param like `?private=1` is set (rough Phase 1 gate — real auth in Phase 2)

### `/new` (Form)
- Form fields matching the schema
- On submit: POST to `/api/projects` with a token from env
- API route uses Octokit to commit a new `.md` file to the repo
- Vercel auto-redeploys, new project appears on dashboard

## Two ingestion paths

### Path 1: Manual (new projects)
1. Go to `/new`
2. Fill form
3. Submit → API writes `content/projects/<slug>.md` to GitHub
4. Vercel redeploys
5. Project appears

### Path 2: Agentic (existing projects)
1. `cd ~/projects/some-old-project`
2. `claude` (Claude Code)
3. Paste the recon prompt (see `RECON_PROMPT.md`)
4. Claude Code outputs a complete YAML frontmatter block
5. Either:
   - Paste into `/new` form (copy field-by-field), or
   - Paste into chat-Claude and ask "create this project entry" — chat-Claude calls the API for me

## Phase 2 preview (database learning project)

When Phase 1 is solid and has ~10 real projects:
- Add Supabase (Postgres + auth)
- Schema design: `projects` table with columns matching frontmatter
- Prisma as ORM (familiar from Prisma Calendar in LAVA-2)
- Migration script: read every `.md` file, parse frontmatter, insert rows
- Switch dashboard reads from filesystem to DB
- Add edit + delete via UI
- Add real auth (Supabase Auth, GitHub OAuth)
- Keep markdown export as a backup/sync path so Obsidian stays useful

The migration *itself* is the learning artifact. Document it in a blog post or detail page on the dashboard.

## Open questions to resolve before Phase 1 ships

- [ ] Where does the GitHub token live? (Vercel env var, scoped to the portfolio repo only)
- [ ] What's the deployed URL? (subdomain of godfreyponce.dev? `projects.godfreyponce.dev`?)
- [ ] Public vs. private projects — flag in frontmatter or just don't commit private ones?
- [ ] Design reference — match genesiating.com aesthetic from the portfolio redesign, or distinct look?
