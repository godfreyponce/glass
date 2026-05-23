---
slug: portfolio-phase-2
name: Portfolio Phase 2 — Database Migration
status: planned
priority: medium
stack:
  - Postgres
  - Prisma
  - Supabase
  - Next.js
started: '2026-05-20'
last_worked_on: '2026-05-20'
next_action: >-
  Sketch the Prisma schema so it mirrors the locked frontmatter spec
  field-for-field.
local_path: ~/projects/portfolio-dashboard
repo_url: 'https://github.com/godfreyponce/portfolio-dashboard'
recruiter_pitch: >-
  Migrate this dashboard's source-of-truth from markdown files to Postgres +
  Prisma — a deliberate database-learning project documented inside the
  dashboard itself.
tags:
  - meta
  - database
  - learning
---

# Portfolio Phase 2 — Database Migration

Phase 1 of this dashboard treats markdown files in `content/projects/` as the
source of truth. Phase 2 swaps that read layer for a real database — both because
the dashboard's grown enough projects to want richer queries, and because the
migration *itself* is the learning artifact.

## Plan

Mirror the locked Zod frontmatter schema (`lib/schema.ts`) onto a Prisma model
field-for-field, write a one-shot script that reads every existing `.md` and
inserts the rows, then flip the dashboard's read functions over to Prisma.
Markdown export stays as a backup sync path so Obsidian remains useful.

## Also in Phase 2

- **Real auth** — replace the Phase 1 passphrase gate (`API_WRITE_SECRET`) with
  Supabase Auth / GitHub OAuth. The passphrase is a deliberate stopgap.
- **Delete via UI** — Phase 1 shipped inline *editing* ahead of schedule; deleting
  a project from the UI still doesn't exist and lands here.
- **Publish the migration writeup** — the migration is the learning artifact; turn
  it into a blog post or a detail page on the dashboard itself.

## Open question

- **Whole-project privacy** — beyond the current `local_path` `?private=1` gate, do
  private *projects* get a frontmatter flag, or just never get committed? Undecided.

## Why this is on the Planned shelf

Waiting until Phase 1 has settled and there are ~10 real projects to migrate.
No point modelling tables for three rows.
