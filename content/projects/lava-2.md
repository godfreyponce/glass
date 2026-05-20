---
slug: lava-2
name: LAVA-2
status: archived
priority: high
stack:
  - Next.js
  - TypeScript
  - Prisma
  - Obsidian
  - Claude API
started: '2026-03-15'
last_worked_on: '2026-04-20'
run_command: npm run dev
entry_point: app/page.tsx
local_path: ~/projects/lava-2
repo_url: 'https://github.com/godfreyponce/lava-2'
live_url: 'https://lava2.godfreyponce.dev'
recruiter_pitch: >-
  Built an Obsidian-based agentic second brain that turns scattered notes into a
  queryable, self-organizing knowledge system.
tags:
  - ai
  - obsidian
  - agents
  - knowledge-base
---

# LAVA-2

An agentic AI "second brain" layered on top of an Obsidian vault. LAVA-2 watches a notes directory, indexes markdown into a structured store via Prisma, and exposes a chat surface that answers questions across the whole vault with citations back to the source note.

## Architecture

The dashboard is a Next.js App Router app. A background agent loop reads new and changed notes, extracts entities and links, and writes them to a Postgres-backed Prisma schema. Retrieval blends keyword search with embedding similarity, and the Claude API composes answers grounded in retrieved note chunks.

## Outcome

Shipped and in daily personal use. The Prisma data-modelling work here is the direct precedent for Phase 2 of this portfolio dashboard.
