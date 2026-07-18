---
description: Build a ticket from its plan file, prove the tests pass, and stop before committing.
argument-hint: "[#N] (optional — defaults to STATE.md's next_action)"
---

Build one ticket from its plan file. **Start from the plan, not from a conversation you weren't in.**

## Which ticket

`$ARGUMENTS` names the issue if set; otherwise read `next_action` from STATE.md's YAML head.
Load `docs/superpowers/plans/*-issue-N.md`. If no plan file exists, stop — run `/plan-ticket N`
first. Building without the plan is exactly the failure this split exists to prevent.

## Build it

1. Use the `superpowers:executing-plans` skill. Follow the plan task by task.
2. Where the plan turns out to be wrong, **say so** rather than quietly improvising around it —
   a deviation the owner never sees is a deviation they can't catch at review.
3. Run the suite. **Paste the real output**, not a claim about it:

```bash
npm run typecheck && npm run lint && npm test
```

Run `npm run build` too when the ticket touched pages, layouts, or anything with a server-client
boundary — dev mode hides RSC violations that the build catches.

A commit hook will run the suite anyway and block you if it's red — but by then you've wasted the
owner's time. Run it yourself first.

## Then stop — before committing

Show the owner the diff and wait. Do not commit, do not push, do not close the issue.

## Only after the owner accepts

One commit carrying three things together:

- the code,
- `STATE.md` — clear the finished item out of `## Now`, advance `next_action` to the next ticket
  (ask the owner which if it isn't obvious), bump `last_worked_on`,
- the feature's section in `docs/HISTORY.md`.

Message: `type: summary` with a `Refs #N` body line — plain conventional commits, no emoji, no
AI-attribution trailers (glass commit policy). Then push, close the issue with a one-line result,
and tell the owner to `/clear` before the next ticket.

This is STATE.md's **only** write moment. Anything you discovered along the way that isn't this
ticket goes to `gh issue create`, not into STATE.md.
