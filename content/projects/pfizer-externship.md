---
name: "Pfizer Externship — Document Intelligence"
slug: "pfizer-externship"
status: "in-progress"
priority: "medium"
stack: ["Python", "RAG", "LangChain", "FastAPI"]
started: "2026-05-04"
last_worked_on: "2026-05-15"
next_action: "Finish the document ingestion pipeline and benchmark retrieval accuracy against the week-2 sample set."
run_command: "uvicorn app.main:app --reload"
entry_point: "app/main.py"
local_path: "~/projects/pfizer-externship"
recruiter_pitch: "A 10-week Extern.com externship with Pfizer building a retrieval-augmented document intelligence system over regulatory documents."
tags: ["externship", "rag", "nlp", "python"]
api_keys:
  - provider: "openai"
    label: "extern sandbox"
    location: ".env.local · ~/projects/pfizer-externship"
    env_var: "OPENAI_API_KEY"
  - provider: "anthropic"
    label: "personal"
    location: "1Password → Anthropic"
    env_var: "ANTHROPIC_API_KEY"
---

# Pfizer Externship — Document Intelligence

A 10-week remote externship through Extern.com, sponsored by Pfizer, focused on
building a retrieval-augmented generation (RAG) system for querying dense
regulatory and clinical documents.

## Current state

Week 2 of 10. Started May 4, 2026. Environment and FastAPI skeleton are set up;
working through the document chunking and embedding strategy now.

## Goal

A reproducible pipeline that ingests PDFs, indexes them, and answers analyst
questions with citations — evaluated on a held-out question set each week.
