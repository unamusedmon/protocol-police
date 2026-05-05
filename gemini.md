## Current State — DO NOT REGENERATE THESE

- Full Astro SSR project running
- Auth system: bcryptjs + JWT cookies, /login + /register pages 
  with classified terminal aesthetic, boot sequence on register
- SQLite via better-sqlite3, database at ./data/protocol-police.db
- Tables: users, zahra_messages, progress, flashcard_log, 
  scenario_progress, rank, unlocks
- Middleware protecting all routes except /login /register
- Progression engine with 7 ranks PACKET_MONKEY → PROTOCOL_WIZARD
- Personnel Dossier at /dossier
- Rank badge in header polling /api/rank/current every 5s
- Flashcard system with FSRS, wired to /api/progress/flashcard
- RFC reading view wired to /api/progress/fragment
- Zahra AI companion: chibi SVG, draggable widget, Gemini API, 
  conversation history in SQLite, emotional states, page awareness
- All Zahra API endpoints: /api/zahra/chat + /api/zahra/initiate
- 5 Zeek scenarios in src/data/zeek-scenarios/
- RFCs loaded: 791 (IP), 9293 (TCP), 8446 (TLS 1.3)

## Known Issues to Fix

- dossier.astro calls getRankProgress() and getUnlocks() without 
  userId — needs user from Astro.locals
- Syntax error at bottom of dossier.astro (duplicate closing tag)
- GEMINI.md was outdated

## Project Identity
You are the lead architect for Protocol Police — a RFC learning platform 
built for people with ADHD who want to understand networking protocols at 
a deep level. The site has two modes: reading and drilling.

## The Brand
Protocol Police is a classified-dossier themed learning tool. Dry wit, 
technical precision, zero condescension. The voice is: "we're going to 
learn this properly and have fun doing it." Each RFC has its own identity 
— treat them like characters, not documents.

## Tech Stack
- Astro (static site, islands for interactivity)
- Dark theme throughout
- SVG/HTML/CSS for diagrams — no canvas unless absolutely necessary
- Spaced repetition based on SM-2 or FSRS (prefer FSRS — it's the current 
  best-evidence algorithm)
- All ASCII art converted to interactive/animated SVG where it adds 
  understanding, static SVG where it doesn't

## RFC Reading Experience
Each RFC page should feel like a well-designed technical document, not a 
plaintext dump. Requirements:
- Beautiful typography, generous spacing, clear section hierarchy
- Each RFC gets a visual identity: color accent, thematic icon, 
  personality in section headers
- ASCII diagrams → interactive/animated SVG. Packet headers should be 
  explorable. State machines should animate. Timelines should sequence.
- Inline glossary tooltips for technical terms on first use
- "Evidence fragments" — chunked readable sections with progress tracking
- The Protocol Police voice can appear as callouts, asides, and section 
  intros — but never obscures the actual RFC content

## Flashcard System
- Cards generated from RFC source text — answers must be traceable to 
  specific RFC sections
- FSRS spaced repetition with four self-rating options: 
  BRAIN ROT / SKILL ISSUE / ACCEPTABLE / RFC GOD
- Cards organized by RFC and by concept tag
- Study plans available as an optional path — not required to use the site
- Study plans based on psychological evidence: interleaving, spaced 
  retrieval, desirable difficulty. Not just "here are cards in order."

## ADHD Design Principles
- Short chunks. Always. No walls of text.
- Clear progress indicators at all times
- Low friction to start, low friction to stop and resume
- Dopamine hooks are okay — streaks, completion states, RFC GOD moments
- Never trap the user in a flow they didn't choose

## Quality Bar
- RFC content is authoritative. Never paraphrase an RFC into something 
  subtly wrong.
- Flashcard answers must be verifiable against the source RFC section
- ASCII → SVG conversions must be semantically accurate, not just 
  aesthetically pleasing
- When in doubt, ask. Wrong diagrams are worse than missing diagrams.
