---
name: Kal
slug: kal
status: in-progress
priority: medium
stack:
  - Next.js 16
  - TypeScript
  - React 19
  - "@anthropic-ai/sdk"
  - Drizzle ORM
  - Neon Postgres
started: "2026-06-20"
last_worked_on: "2026-06-20"
next_action: Begin Phase 5 — add the iron-session password gate, PWA manifest/icons, and push ANTHROPIC_API_KEY, APP_PASSWORD, and SESSION_SECRET to Vercel for first deploy.
run_command: PORT=3100 npm run dev
entry_point: app/page.tsx
recruiter_pitch: A personal AI fitness coach you chat with — it knows your meal plan and daily nutrition, and a Claude-powered assistant logs your food and tracks your macros in plain conversation.
tags:
  - ai-chat
  - nextjs
  - nutrition
  - claude
  - postgres
api_keys:
  - provider: anthropic
    env_var: ANTHROPIC_API_KEY
    location: .env.local
---

Kal is a personal AI nutrition coach built around a conversational interface. The "Today" screen surfaces your meal plan and daily macros, while a Claude-powered chat assistant logs food and tracks nutrition through plain conversation. The Claude tool loop lives in `app/api/chat/route.ts`, backed by Drizzle ORM over Neon serverless Postgres. Phases 1–4 (schema, REST + Today screen, chat route, chat UI) are complete and verified; Phase 5 adds auth, a PWA shell, and the first Vercel deploy.
