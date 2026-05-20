# Claude Code Execution Prompt — Portfolio Dashboard Phase 1

Paste this into Claude Code from an empty directory where you want the project to live (e.g. `~/projects/portfolio-dashboard`).

---

I'm building a portfolio dashboard — a Next.js 14 app that renders my project portfolio from markdown files. Markdown files in `content/projects/*.md` are the source of truth; the dashboard is a view over them. There's also a form at `/new` that creates new markdown files by committing to the GitHub repo via the Octokit API, which triggers a Vercel redeploy.

Read `PLAN.md` first (I'm pasting it alongside this prompt) — it has the full spec including the locked frontmatter schema, file structure, and pages. Build to that spec exactly.

## Build order (do these in sequence, don't skip ahead)

1. **Scaffold the Next.js 14 app** with TypeScript, Tailwind, App Router. Use `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"`.

2. **Install dependencies**: `gray-matter`, `remark`, `remark-html`, `zod`, `@octokit/rest`, `date-fns`, `lucide-react`.

3. **Build the schema first** (`lib/schema.ts`) — Zod schema matching the frontmatter spec in PLAN.md exactly. This is the spine; everything depends on it. Export both the schema and the inferred TypeScript type.

4. **Build the read layer** (`lib/projects.ts`) with two functions:
   - `readAllProjects()`: reads every `.md` in `content/projects/`, parses frontmatter with gray-matter, validates with Zod, returns typed array. Skip files that fail validation but log a warning.
   - `readProject(slug)`: reads one file, returns frontmatter + rendered HTML body.

5. **Build three seed markdown files** in `content/projects/` so the dashboard isn't empty during development:
   - `lava-2.md` — completed, Obsidian-based agentic AI second brain
   - `foro-sports-club.md` — in-progress, freelance Next.js redesign for Foro Sports Club Dallas
   - `pfizer-externship.md` — planned, Extern.com 10-week RAG/document intelligence externship starting May 4, 2026
   
   Use realistic content. Pull stack and details from the spec — Next.js, TypeScript, AWS Amplify for portfolio context.

6. **Build the dashboard home** (`app/page.tsx`):
   - Server component, reads projects at request time
   - Header with name "Glass" and link to godfreyponce.dev
   - Three sections: In Progress, Planned, Completed (archived hidden by default)
   - Each section renders a grid of `<ProjectCard>` components
   - "+ New Project" link top-right going to `/new`

7. **Build `<ProjectCard>`** (`components/ProjectCard.tsx`):
   - Shows: name, status badge, recruiter_pitch, stack badges (max 4 visible, "+N more" if overflow), last_worked_on date, next_action (if status is in-progress or planned)
   - Wraps in `<Link href="/projects/[slug]">`
   - Use Tailwind, no card libraries

8. **Build `<StatusBadge>`** (`components/StatusBadge.tsx`):
   - Pill component, color-coded: in-progress = blue, planned = amber, completed = green, archived = gray

9. **Build the detail page** (`app/projects/[slug]/page.tsx`):
   - Reads project via `readProject(slug)`
   - Header: name, status, dates
   - Metadata section: stack, run_command (in `<code>`), entry_point, repo_url, live_url
   - Rendered markdown body below
   - `generateStaticParams` for static generation

10. **Build the form page** (`app/new/page.tsx`):
    - Client component
    - Fields for every required frontmatter property + the common optional ones (repo_url, live_url, recruiter_pitch, run_command, entry_point)
    - Stack and tags as comma-separated inputs, parsed to arrays on submit
    - Status and priority as dropdowns
    - Dates as date inputs
    - On submit: POST to `/api/projects`, show success/error, redirect to new project's detail page on success

11. **Build the API route** (`app/api/projects/route.ts`):
    - POST handler
    - Validates body against Zod schema
    - Auto-generates `slug` from `name` (kebab-case) if not provided
    - Builds the markdown file content (frontmatter + empty body)
    - Uses Octokit to create the file in the repo at `content/projects/<slug>.md`
    - Requires `GITHUB_TOKEN` env var, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` (default `main`)
    - Returns the slug on success so the form can redirect

12. **Tailwind design pass** — this needs to look polished, not stock. Read `/mnt/skills/public/frontend-design/SKILL.md` if you haven't already. Reference aesthetic: clean, technical, slightly editorial. Generous whitespace. Monospace for code/commands. Sans for body. No drop shadows on everything, no purple gradients, no generic-AI-card-stack vibes.

13. **README** with:
    - Setup steps
    - Required env vars
    - How to add a project manually (write a `.md` file) and via the form
    - Pointer to `RECON_PROMPT.md` for the agentic import path
    - Deploy-to-Vercel instructions

## Constraints

- TypeScript strict mode, no `any`
- No client components unless interactivity is required (`/new` is the only one)
- Don't add a database, Supabase, or auth — that's Phase 2
- Don't add an edit/delete UI — edit the markdown directly for now
- All file reads happen server-side at request time (or build time for static pages)

## When done

Run `npm run build` to confirm it compiles. List anything you couldn't resolve. Don't deploy — I'll do that.
