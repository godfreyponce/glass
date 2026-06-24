# glass.md State Sync — Design

**Date:** 2026-06-23
**Status:** Approved (brainstorm) — pending implementation plan

## Problem

Keeping a project card's "where am I" fields current (`status`, `last_worked_on`,
`next_action`) is manual today: you edit the card by hand, or re-run the full
`/new/quick` recon (which is built for *creating* cards, not updating them, and
can rewrite prose you wrote). When you finish a feature in a project, there's no
fast, safe path to reflect that on the dashboard.

## Goal

A lightweight contract so each project can **publish** its current state and the
Glass dashboard can **read** it to update that project's card — touching only the
three volatile state fields, never hand-written prose, stack, name, or body.

Example: you finish features in `clyde-mochi`. You say "update clyde-mochi" (or
click a button). Glass reads the project's `glass.md` and the card flips to its
new status with a fresh date and next action.

## Model: publisher / reader

The feature has two halves with a single file as the interface between them.

### Publisher — `GLASS_PROMPT.md` (new file in the Glass repo)

A paste-in prompt, sibling to the existing `RECON_PROMPT.md`. You paste it into
Claude Code **inside any project**; it scans the code + git and writes/refreshes
a `glass.md` at that project's root. The project's own Claude session keeps it
current — the same paste-in pattern already used for recon.

This is where all the *reasoning* lives (read code, judge status, infer next
action). The dashboard never reasons about the project.

### Reader — the Glass dashboard

When an update is triggered, Glass:

1. Resolves the target card and reads its `local_path`.
2. Reads `glass.md` from that directory.
3. Validates the three state fields.
4. Shows an `old → new` diff and, on confirm, PATCHes the card.

## The `glass.md` format

A small file at each project's root. Concrete values (not freeform notes) so the
dashboard applies them directly without interpretation:

```yaml
---
slug: clyde-mochi
status: completed
last_worked_on: "2026-06-22"
next_action: "Ship to TestFlight"
---
Finished auth and offline sync this week. Ready for beta.
```

- `slug` — identity; ties the file to `content/projects/<slug>.md`.
- `status` / `last_worked_on` / `next_action` — the only fields a sync applies.
- Body (below frontmatter) — optional human-readable progress note. The
  dashboard does **not** apply it to the card in v1 (it stays in the project repo
  as a record). Not load-bearing.

### Validation

The three frontmatter fields reuse the existing Zod rules:

- `status` ∈ `STATUS_VALUES` (planned | in-progress | completed | archived)
- `last_worked_on` matches the ISO-date regex (`YYYY-MM-DD`)
- `next_action` is required when `status` is `in-progress` or `planned`

A small dedicated parser/validator reads `glass.md` and produces a typed
`{ slug, status, last_worked_on, next_action }`. Malformed or missing files
produce a clear error — never a silent or guessed update. Dates are normalized
the same way `normalizeFrontmatter` already handles unquoted YAML dates.

## Key design decision: no Claude spawn on the dashboard side

Because `GLASS_PROMPT.md` produces a **structured** `glass.md` with concrete
values, the dashboard's read path is a plain `read file → validate → PATCH`. No
headless `claude` process is spawned for an update.

This is deliberately different from `/new/quick`, which spawns `claude` to
*create* cards. The tradeoff: if `glass.md` were ever loose freeform notes, the
dashboard would need an LLM to interpret it. We choose structured + no-spawn:
simpler, faster, zero token cost, deterministic, cannot hallucinate.

## Scope of a sync

A sync changes **only** `status`, `last_worked_on`, `next_action`. Every other
field — `name`, `stack`, `recruiter_pitch`, `api_keys`, `repo_url`, body, etc. —
is never touched by an update. Those change only by hand in the dashboard.

## Triggers

### 1. Chat (no new code)

You say "update clyde-mochi" in a Claude Code session. Claude reads the card's
`local_path`, reads `glass.md` there, shows `old → new` for the three fields, and
PATCHes on your OK. Works today via the existing `PATCH /api/projects/[slug]`.

### 2. Button — "Update state" in `/new/quick` (dev-only)

A new mode in the existing dev-only quick surface:

1. Pick a tracked project (from existing cards).
2. Server resolves `local_path` → reads `glass.md` → validates.
3. UI shows the `old → new` diff for the three fields.
4. **Apply** PATCHes the card (one confirm).
5. Missing/malformed `glass.md` → a clear message, no change applied.

Like the rest of `/new/quick`, this is dev-only (it reads the local filesystem)
and 503s in production.

## Components

| Component | Role |
| --------- | ---- |
| `GLASS_PROMPT.md` (repo root) | Paste-in prompt that writes `glass.md` in a foreign project. |
| `glass.md` (in each project) | The published state contract. Read-only from Glass's perspective. |
| `lib/glass-md.ts` (new) | Parse + validate a `glass.md` into typed state; reuses schema rules. |
| Update API route (dev-only) | Resolve card → read `glass.md` → return proposed diff; apply via PATCH. |
| `/new/quick` UI | "Update state" mode: pick project, show diff, Apply. |
| `PATCH /api/projects/[slug]` (existing) | Applies the three fields. Unchanged. |

## Out of scope (v1)

- Applying the `glass.md` body/progress note to the card.
- Auto-discovering projects that have a `glass.md` (you trigger per-project).
- Updating any field beyond the three state fields.
- Production support for the button (dev-only, same as quick add).
- Changes to `lib/schema.ts` — `glass.md` is a separate file format that only
  *reuses* the status/date rules; the sacred frontmatter schema is untouched.

## Open questions

- Matching: drive the button purely by the selected card's `slug`/`local_path`,
  using `glass.md`'s `slug` only as a sanity check (flag a mismatch). Confirm
  this is the intended matching rule during planning.
