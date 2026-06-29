---
slug: clyde-mochi
name: Clyde Mochi
status: completed
priority: medium
stack:
  - Arduino/C++
  - ESP32-C3
  - ST7789 SPI display
  - Next.js 16
  - TypeScript
  - Claude Code hooks
started: '2026-06-20'
last_worked_on: '2026-06-22'
next_action: >-
  Feature-complete and verified on the board — additive only. Pending face
  states are TBD; ask the owner before extending the firmware.
run_command: cd site && npm run dev
entry_point: clyde-mochi/clyde_mochi/clyde_mochi.ino
local_path: /Users/geovponce/Developer/clydeMochi
repo_url: https://github.com/godfreyponce/clawd
recruiter_pitch: >-
  A little desk companion — a tiny screen showing a crab character whose face
  reacts to your coding session (thinking, alerting, done), driven
  automatically by Claude Code.
tags:
  - embedded
  - esp32
  - arduino
  - hardware
  - claude-code
---

Clyde Mochi is a sealed desk companion built on an ESP32-C3 Super Mini driving a 1.54" 240×240 ST7789 SPI display. It shows "Clyde" the crab, runs an autonomous idle loop, hosts a WiFi AP web controller, and takes one-word serial commands over USB-C — Claude Code hooks (`working`/`notify`/`done`) drive its face to mirror the user's coding-session state. The firmware lives in `clyde-mochi/clyde_mochi/clyde_mochi.ino`; a companion Next.js site in `site/` documents the build with live face demos (not deployed). As of 2026-06-22 it is feature-complete and flashed on the board, with all face states and the flashing procedure verified end-to-end. Based on github.com/yousifamanuel/clawd-mochi.
