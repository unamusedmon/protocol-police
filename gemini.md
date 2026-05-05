## Current State
The following is already built and working — do not regenerate or 
restructure unless explicitly asked:

- Astro project scaffolded and running
- Protocol Police brand, dark theme, and visual design established
- Homepage with curriculum cards and Evidence Locker
- Interrogation Room flashcard system with flip mechanic and 
  BRAIN ROT / SKILL ISSUE / ACCEPTABLE / RFC GOD rating buttons
- RFC reading view with evidence fragments and progress tracking
- RFCs currently loaded: 791 (IP), 9293 (TCP), 8446 (TLS 1.3)

Work from here. Extend, don't replace.

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
