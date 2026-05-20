# Project Recon Prompt — Agentic Import Path

Use this when you want to add an **existing** project on your machine to the portfolio dashboard. Paste this prompt into Claude Code from inside the project directory.

---

You are doing reconnaissance on this project so I can add it to my portfolio dashboard. I haven't touched it in a while and need you to figure out what it is, what state it's in, and how to run it again.

Do this:

1. List the top-level files and directories. Read `README.md`, `package.json`, `pyproject.toml`, `Cargo.toml`, `requirements.txt`, or whatever build manifest exists.
2. Identify the primary language and framework.
3. Find the entry point (e.g. `app/page.tsx`, `main.py`, `src/index.ts`).
4. Find the run/dev command from package.json scripts or equivalent.
5. Check git log for the last commit date.
6. Look for TODO/FIXME comments to infer where I left off.
7. Skim the README for the project's purpose.

Then output a single YAML block matching this schema. Don't write commentary, don't write a summary above or below — just the YAML. I'll copy it directly into my dashboard.

```yaml
---
name: "<project name in title case>"
slug: "<kebab-case-slug>"
status: "<planned | in-progress | completed | archived — best guess based on git activity, README maturity, presence of deployed URL>"
priority: "medium"  # I'll adjust this manually
stack: ["<framework>", "<language>", "<key libraries>"]  # max 6
started: "<YYYY-MM-DD from earliest git commit>"
last_worked_on: "<YYYY-MM-DD from most recent commit>"
next_action: "<one sentence — what you'd suggest doing next based on TODOs and project state>"
run_command: "<the actual command to start dev, e.g. npm run dev>"
entry_point: "<path to main file>"
local_path: "<absolute path to this directory>"
repo_url: "<from `git remote get-url origin` if it exists, otherwise omit>"
live_url: "<omit — I'll fill manually if deployed>"
recruiter_pitch: "<one sentence, plain English, no jargon — what this project does and why it's interesting>"
tags: ["<3–5 lowercase tags>"]
---

<2–4 sentence markdown body describing the project, the architecture, and current state. This goes below the frontmatter as the body of the .md file.>
```

If you can't determine a field with confidence, omit it (for optional fields) or use a placeholder like `"unknown"` (for required fields) and flag it at the very end after the YAML in a `# Flagged for review:` comment so I know what to fix.
