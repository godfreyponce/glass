---
glass: glass
status: in-progress
last_worked_on: 2026-07-17
next_action: "#2 — Stage 1 private store: building Tasks 4–6 on feat/stage1-private-store; then owner Task 7 setup"
blocked_on: ""
phase: "Phase 1 + glass.md state sync shipped and deployed; Stage 1 (private card store) mid-build"
---

# Glass — Project State

Deployed Next.js 16 portfolio dashboard. `content/projects/*.md` is the source of truth; the
app is a typed view over them. Live: https://glass-green-one.vercel.app

*Thin snapshot. `next_action` above names the ticket that is up now — start there.
Archive: `docs/HISTORY.md`. Queue: GitHub Issues (`gh issue list`). Protocol: `AGENTS.md`.*

## Now

*Unaccepted work only. Anything the owner has accepted belongs in `docs/HISTORY.md`, not here.*

- **#2 Stage 1** on `feat/stage1-private-store` (unpushed): Tasks 1–3 built (read-layer merge,
  prod fetch); Tasks 4–6 (persistence routing, visibility UI, quick-add private checkbox) in
  flight. Plan: `~/Developer/docs/superpowers/plans/2026-07-11-glass-stage1-coverage-private-store.md`.
- **#2 Task 7 (OWNER)**: create + clone `glass-private`, rescope the PAT to it, set
  `GITHUB_PRIVATE_REPO` in `.env.local` + Vercel, import the 6 missing repos via quick-add.

## Run / verify (do this first)

```bash
npm run dev        # :3000
npm run typecheck && npm run lint && npm test   # the commit gate runs these too
npm run build      # required for RSC / server-client boundary changes
```

## Gotchas (things that would still bite you today)

- `content/private/` is empty probe scaffolding, NOT a git clone — the `glass-private` repo
  does not exist yet and `GITHUB_PRIVATE_REPO` is unset everywhere (unconfigured store reads
  as empty by design). Task 7 replaces it with the real clone.
- `mockups/` is untracked leftover from the api-key feature — never `git add` it or
  `content/private/`.
- Unquoted YAML dates in a card parse as `Date` and would fail the string schema —
  `normalizeFrontmatter` (lib/markdown.ts) coerces them, but always quote dates in
  agent-written `.md` files.
- Port :3000 is glass's; Kal dev runs on :3100 to stay out of the way.
