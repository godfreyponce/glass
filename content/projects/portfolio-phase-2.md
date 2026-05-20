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

## Why this is on the Planned shelf

Waiting until Phase 1 has settled and there are ~10 real projects to migrate.
No point modelling tables for three rows.
