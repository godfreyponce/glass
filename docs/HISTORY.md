# Glass — Build History & Reference

*Started 2026-07-17 when the ticket system was adopted. STATE.md is the thin quick-resume
snapshot; this file holds the accepted-work archive. The work queue lives in GitHub Issues.*

## Phase 1 — portfolio dashboard (shipped 2026-06, deployed on Vercel)

Markdown-file-backed dashboard: cards grouped by status (`/`), detail pages
(`/projects/[slug]`), passphrase-gated `/new` form committing via Octokit, dev-only
`/new/quick` (headless Claude Code writes the card — describe or choose-a-directory recon),
inline editing behind a padlock (hybrid persistence: disk in dev, Octokit + redeploy banner in
prod), API-key tracking (card badges + header Keys popover), site-wide password gate
(iron-session), MIT license. Specs: `docs/superpowers/specs/`.

## glass.md state sync — Stage 0 (shipped 2026-07, PR #1)

Projects publish a root `glass.md` (via `GLASS_PROMPT.md`); the dashboard syncs only
`status` / `last_worked_on` / `next_action` onto the card. `lib/glass-md.ts` parser (+ tests),
dev-only `POST /api/quick/update` (preview → apply), "Update state" tab in `/new/quick`
(`QuickTabs` / `QuickUpdate`). `last_worked_on` gained optional time support. Vitest added.
Spec: `docs/superpowers/specs/2026-06-23-glass-md-state-sync-design.md`.

## Stages 2–3 (queued)

Stage 2 — STATE.md heads + `/sync` sweep with confirm gate (#3). Stage 3 — card redesign
around richer state (#4). Stage 1 (private card store, #2) is in flight — see STATE.md.

## Frozen (2026-10-26, #5)

Owner froze glass mid Stage 1 (multi-repo hub spec, Q9): no new work. The Tickets button on
the Developer T3 project replaced it. Code, `feat/stage1-private-store`, the Vercel site, and
repo visibility stay as they are; #2–#4 stay open.
