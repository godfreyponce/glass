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
2. Determine `last_worked_on` — when the project was last touched. Use the most
   recent git commit: `git log -1 --format=%cs` for the date (`YYYY-MM-DD`), or
   `git log -1 --format=%cI` if you want to include the time (then keep just
   `YYYY-MM-DDTHH:MM`). The time is optional — a plain date is fine. Fall back to
   today if there is no git history.
3. Determine `next_action` — one short sentence on the most sensible next step,
   based on TODO/FIXME comments and the project's state.
4. Determine `slug` — the kebab-case identifier of this project's existing card
   (lowercase, hyphens only). If unsure, use the kebab-case of the project name;
   it MUST match the card's slug on the dashboard or the sync won't find it.

Then write `glass.md` with EXACTLY this shape and nothing else:

```yaml
---
slug: "<kebab-case-slug>"
status: "<planned | in-progress | completed | archived>"
last_worked_on: "<YYYY-MM-DD or YYYY-MM-DDTHH:MM>"
next_action: "<one sentence>"
---
<One or two sentences of plain-language progress notes — what changed recently.>
```

Rules you MUST follow:
- Dates MUST be quoted strings (e.g. `"2026-06-22"`, or `"2026-06-22T14:30"` if you
  include a time on `last_worked_on`), so YAML doesn't parse them as timestamps.
- `status` MUST be one of the four exact values above.
- `next_action` is REQUIRED when `status` is `in-progress` or `planned`; omit it
  otherwise if there's nothing meaningful to do next.
- NEVER put secrets, API keys, tokens, or passwords in `glass.md`. It is metadata
  only and will be committed to the repo.
- Write ONLY the file. Don't print the YAML back or add commentary.

After writing the file, confirm in one short sentence what status you set.
