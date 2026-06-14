---
name: chatbot-knowledge-intake
description: Use when filling in or updating a client's website-chatbot knowledge — e.g. "run the chatbot intake", "fill the chatbot gaps", "set up <client>'s chatbot answers", "the bot's missing info", or onboarding a new client's bot. Works for any client in this repo.
---

# Chatbot Knowledge Intake

## Overview

Interview a client's owner through the unanswered gaps in their chatbot knowledge, write the
answers straight into the **live** knowledge file the bot actually reads, then deploy. The bot
is already mostly pre-filled from their audit — this only closes the gaps, ~5 minutes of mostly
one-word answers, never a form.

**The bot reads ONE file per client: `knowledge/<client>.md`** (path set by `KNOWLEDGE_FILE`).
That file IS the knowledge base — change it and you change what the bot knows. Nothing in
`Brain 2/wiki/` or any other repo reaches the live bot. Always write to `knowledge/<client>.md`.

⚠️ **Ignore this repo's `CLAUDE.md` and the local `.env` for client deploys** — both are stale
TCCO/Mac-Mini demo values (`tcco.md`, a demo `LEAD_EMAIL_TO`). The truth is: Barnett-Digital-hosted
client bots (Leck, etc.) run on the **DigitalOcean droplet** at `chat.barnettdigital.co`, served by
systemd unit **`chatbot.service`** (BD's own bot is the separate `chatbot-bd.service`). Trust the
code default + `deploy/droplet/` + `INSTALL-<client>.md`, not CLAUDE.md.

## Steps

1. **Find the two files** for this client (ask which client if unclear):
   - Live knowledge: `knowledge/<client>.md` (e.g. `knowledge/leck-electrical.md`)
   - Gap list: `knowledge/FOR-<OWNER>-fill-in.md` (e.g. `knowledge/FOR-BRYCE-fill-in.md`) —
     glob `knowledge/FOR-*-fill-in.md` if unsure of the name.
   Read both fully before asking anything.

2. **Set expectations** with the owner:
   > "Most of your chatbot's already filled in from your system. I've just got a few quick
   > questions it doesn't know — mostly one-word answers. Takes about 5 minutes."

3. **Work the `👉` gaps one at a time**, conversationally. After each answer, **write it into
   the matching section of `knowledge/<client>.md` immediately** — don't batch, don't dump the
   whole list at once, react like a person.

4. **Boundaries (do not break):**
   - **Never put a price/amount** in the knowledge file. "Free quotes yes/no" and "is there a
     call-out fee yes/no" are fine; the *number* is never written (the no-price rule lives in code).
   - **Lead-routing is INTERNAL, not public knowledge.** Where leads go (which email, mobile,
     who handles them) does NOT go in `knowledge/<client>.md` — that file is sent to customers'
     AI. Put lead-routing in the droplet `.env` instead: `LEAD_EMAIL_TO` (and `LEAD_SMS_TO` if
     texting). Tell Ivan the value to set; don't write it into the knowledge file.
   - **Bot name / opener is NOT in the knowledge file.** The greeting customers see is the
     widget's `greeting=` attribute (in `widget/embed-<client>.html` + `INSTALL-<client>.md`). If
     the owner wants to change the opener or bot name, edit there — not `knowledge/<client>.md`.

5. **Mark gaps done** — clear each answered `👉` flag from `FOR-<OWNER>-fill-in.md` as you go.
   If something's genuinely unknown, leave a clear `[STILL NEEDED: …]` line rather than guessing.

6. **Deploy so it goes live** (same loop as any change):
   - `cd ~/code/web-chatbot && git add -A && git commit -m "..." && git push`
   - Then on the droplet (Ivan runs this — no SSH from his Mac):
     `cd /opt/web-chatbot && git pull && systemctl restart chatbot`
   - Restart is REQUIRED — the knowledge loads at process start.

7. **Verify** — ask the live bot a question that uses a new answer
   (`curl -s https://chat.barnettdigital.co/chat -H 'content-type: application/json' -d '{"message":"..."}'`)
   and confirm it now knows it.

## Quick reference

| Thing | Where |
|---|---|
| What the bot knows | `knowledge/<client>.md` (only this) |
| Gap questions to ask | `knowledge/FOR-<OWNER>-fill-in.md` |
| Where leads go | droplet `.env` `LEAD_EMAIL_TO` — NOT the knowledge file |
| Prices | never written anywhere (code enforces) |
| Make it live | push → droplet `git pull && systemctl restart chatbot` |

## Common mistakes

- **Writing answers to the brain wiki / client repo** instead of `knowledge/<client>.md`. The
  live bot only reads `knowledge/<client>.md`. Anywhere else is wasted — the bot never sees it.
- **Putting lead-routing in the knowledge file** — that's customer-facing; routing is internal
  (`.env`). Keep them separate.
- **Forgetting the restart** — a `git pull` alone won't reload the knowledge; the service must
  restart.
- **Dumping all questions at once** — ask one at a time, write as you go.
