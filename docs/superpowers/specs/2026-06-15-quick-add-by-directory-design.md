# Quick add by project directory — design

**Status:** implemented (2026-06-16). Both assumptions kept: text-only fallback retained, `RECON_PROMPT.md` untouched.
**Date:** 2026-06-15
**Surface:** `/new/quick` (dev-only)

## Goal

Today's Quick flow spawns a headless `claude` inside the **glass repo** (`cwd: process.cwd()`),
so it can only build a card from the one-liner you type — it has zero visibility into the
project you're describing. This feature lets you point Quick at an **actual project directory**
on disk. A read-only recon agent inspects the real files, produces a rich brief, and that brief
(plus optional notes) feeds the existing schema-owning card agent. No terminal, no copy-paste.

## User flow

1. Click **Choose project** → native macOS Finder folder picker opens → pick a dir → path shows in the UI.
2. *(Optional)* type notes — e.g. "this one's archived, low priority."
3. Send → UI streams two phases ("Scanning `recipe-app`…" → "Building card…") → card appears with a link to open it.

## Architecture

### 1. `/api/pick-dir` — new, dev-only

- Shells out to `osascript -e 'POSIX path of (choose folder with prompt "…")'`, returns the absolute path.
- Handles dialog cancel (osascript exits 1 / "User canceled") → return `{ canceled: true }`.
- Guarded by `isAvailable()` → 503 in production, same as `/api/quick`.
- **macOS-only.** No-ops off darwin; add a typed-path fallback later if ever needed.

### 2. `/api/quick` — refactored into two stages

Body gains `projectDir?: string` (alongside existing `prompt?`, `resumeSessionId?`).

- **Stage 1 — Recon.** `spawnClaudeCode({ cwd: chosenDir, systemPrompt: RECON_SYSTEM_PROMPT, allowedTools: read-only })`.
  Inspects real files, emits a rich plain-language brief covering every schema-relevant fact.
  Server accumulates its text (from `text_delta` events or the final `result` event).
  - **Safety refinement (recommended):** the route gathers git facts itself in Node
    (`git log` dates, `git remote get-url origin`) and injects them into the recon prompt — so the
    recon agent needs **only Read/Grep/Glob, no Bash**. It genuinely cannot modify or run anything
    in the folder you pick. Slightly more code, real safety win.
- **Stage 2 — Card.** The brief (+ optional notes) becomes the input to the *existing* Quick agent:
  `cwd: glass repo`, the schema-owning `SYSTEM_PROMPT`, Write tool. Writes
  `content/projects/<slug>.md`, detected by the same before/after directory diff that's there today.

### 3. `lib/claude-code.ts`

- Add `RECON_SYSTEM_PROMPT` (brief-producing, schema-aware) next to `SYSTEM_PROMPT`.
- Make `allowedTools` a field on `SpawnOptions` instead of hardcoded `"Read,Write,Edit"`.

### 4. `components/QuickChat.tsx`

- Add the **Choose project** button + selected-path display.
- Two-phase streaming labels.
- Keep the existing text box; it now doubles as the optional-notes box.

## Division of labor

- **Recon agent** knows the *project* (runs in its directory, reads real files).
- **Card agent** knows the *schema* (runs in glass, owns `lib/schema.ts` + the file write).

## Trade-offs accepted

- **Two agents per card** — slower on a big repo (recon ~20–60s). Both on MAX plan, no API cost.
- **Stage 1 reads whatever folder you pick** — own machine, own projects, dev-only, scoped read-only.
- **Multi-file change** (4 files, 2 new, 1 refactor). On-philosophy for Phase 1: dev-only, no new deps, no DB/auth.
- Needs a `git remote` / `osascript` smoke test — can't be cleanly unit-tested.

## Open assumptions — confirm before implementing

1. **The existing text-only path stays as a fallback.** Send with no project chosen → runs single-stage
   exactly like today. Keeps "idea-only" cards working, avoids a regression. (Costs nothing to keep.)
2. **`RECON_PROMPT.md` stays untouched** — it serves the different manual paste-into-form import
   round-trip. The new automated brief is a separate const. Minor duplication, different output targets.

## Files touched

- `app/api/pick-dir/route.ts` — new
- `app/api/quick/route.ts` — refactor to two-stage
- `lib/claude-code.ts` — `RECON_SYSTEM_PROMPT` + `allowedTools` option
- `components/QuickChat.tsx` — choose-project button, path display, phase labels
