# API key tracking — design

**Status:** design approved (mockup variants chosen). Not yet implemented.
**Date:** 2026-06-15
**Surface:** dashboard `/` + project cards + `/projects/[slug]` + `/new` form

## Goal

Glass is the overview of every project, so it should also answer: *which of my projects rely
on an active API key, for which provider, and where do I access that key?* Metadata only —
**never the secret itself** (those live in 1Password / `.env.local` / etc.). Each project card
shows a small provider badge; the top of the dashboard aggregates "how many active keys per
company and where each lives."

## Data model — keys on project frontmatter (option A)

Keys are a property of a project. The aggregate top-of-page view is derived by scanning all
project files. No separate registry, no new storage — markdown stays the single source of truth.
Trade-off accepted: one real key shared by N projects is listed N× → counts mean "key usages,"
which is the honest and useful number here.

### Schema addition (`lib/schema.ts`)

New **optional** field on `projectFrontmatterSchema` (and `projectInputSchema` / `projectPatchSchema`):

```ts
api_keys: z.array(z.object({
  provider: z.string().regex(/^[a-z0-9-]+$/),  // lowercase id; maps to /logos/<provider>.png
  location: z.string().min(1),                 // human pointer to where YOU access it — NOT the secret
  env_var: z.string().optional(),              // e.g. ANTHROPIC_API_KEY
})).optional()
```

- Field is **optional** → every existing `.md` and project without keys renders exactly as today. Non-breaking.
- No `active` field. Everything listed is active by definition (user only lists active keys).
- `provider` is a free-form lowercase id (not an enum) so adding a provider never requires a schema change.

```yaml
# example frontmatter
api_keys:
  - provider: anthropic
    location: "1Password → Anthropic"
    env_var: ANTHROPIC_API_KEY
  - provider: openai
    location: ".env.local · ~/dev/recipe-app"
```

## UI

### Logos

- `public/logos/<provider>.png` — filename matches the `provider` value. Served at `/logos/<provider>.png`.
- Render in a fixed box (~18px on cards, ~26px in the panel) with `object-contain` — source dimensions don't matter.
- **Fallback:** missing PNG → generic key glyph + provider name. Nothing breaks if a provider has no logo yet.
- Source PNG specs: square-ish, transparent/white background, ~64–128px.

### Card badge — Variant A (top-right cluster)

On `ProjectCard`, beside the status badge: a small key glyph + overlapping provider logo circles
(`-6px` margin, 2px surface ring). `title` shows the count. Smallest footprint; only renders when
`api_keys` is non-empty.

### Top-of-page — Variant 1 (header button + popover)

A "Keys ⟨n⟩" button in the dashboard header, next to Lock / Quick / New (styled like the existing
header buttons, key glyph + count dot). Click opens a popover, grouped by provider, each row:
logo + provider name + location + `×count`. `n` = distinct providers; popover header shows total keys.
Aggregation runs server-side over `readAllProjects()`; the button + popover is a small client component.

## Components touched / added

- `lib/schema.ts` — add optional `api_keys` array (schema-first; the first change).
- `components/ProjectCard.tsx` — render Variant A badge when `api_keys` present.
- `components/KeyBadge.tsx` *(new)* — the per-card logo cluster + key glyph, with logo fallback.
- `components/KeysPopover.tsx` *(new)* — header button + popover, takes the aggregated list.
- `lib/keys.ts` *(new, or a helper in `lib/projects.ts`)* — aggregate `api_keys` across all projects, grouped by provider.
- `app/page.tsx` — mount the Keys button in the header, pass aggregated data.
- `app/projects/[slug]/page.tsx` + `EditableDetailView` — show keys (provider, location, env_var) in the frontmatter detail; editable.
- `components/NewProjectForm.tsx` — let the form add `api_keys` rows.
- `public/logos/` *(new dir)* — provider PNGs (user supplies).

## Build order (schema is sacred)

1. `lib/schema.ts` — add the optional field. Confirm `readAllProjects()` still parses every seed file.
2. Read/aggregate helper.
3. `KeyBadge` + wire into `ProjectCard`.
4. `KeysPopover` + wire into the header.
5. Detail page + form support (create/edit keys).
6. `public/logos/` PNGs + fallback verified.
7. `npm run typecheck && lint && build`, smoke test.

## Open / deferred

- Editing keys inline via the padlock flow (double-click an array of objects) is more complex than the
  existing scalar `EditableField`s — may land as a follow-up; initial version can be add/remove in `/new` +
  hand-edit the `.md`. Decide before step 5.
