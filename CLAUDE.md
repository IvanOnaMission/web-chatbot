# Dan — TCCO Website Chatbot · setup guide for Claude Code

This repo is **Dan**, the website chatbot for **The Conduction Company (TCCO)** — it answers
customer questions and captures leads on tcco.co.nz. It runs on **this Mac Mini** and is
embedded on the Webflow site. Same Dan persona as the TCCO phone assistant.

**If Jordan asks you to "set up Dan", "get this running", or similar — do the steps below,
asking him for each input as you reach it.** The full runbook is `deploy/MAC-MINI-SETUP.md`;
this is the orientation. Read `HANDOVER.md` too.

## Collect from Jordan (ask as you go — never guess these)
1. **Anthropic API key** (console.anthropic.com) → `.env` `ANTHROPIC_API_KEY`
2. **Resend API key** (resend.com) + a **verified sending domain** → `RESEND_API_KEY`, `EMAIL_FROM`
   *(needed so lead emails actually reach his inbox — verify tcco.co.nz or another domain he owns)*
3. **Where leads get emailed** → `LEAD_EMAIL_TO` (default `office@tcco.co.nz`)
4. **His photo of Dan** → save it as `widget/dan.jpg`
5. **His content/answers** → he fills `knowledge/FOR-JORDAN-fill-in.md`; you fold those into
   `knowledge/tcco.md` (keep it lean, facts only, never add prices)

## Steps
1. `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
2. `cp .env.example .env` → fill the keys above. **NEVER commit `.env` — it's gitignored.**
3. Fold Jordan's `FOR-JORDAN-fill-in.md` answers into `knowledge/tcco.md`.
4. **Test:** `bash deploy/start.sh`, then in another terminal
   `curl -s localhost:8000/chat -H 'content-type: application/json' -d '{"message":"how much for a switchboard?"}'`
   → it must NOT give a price (routes to a quote). Run a full "I'd like a quote" chat and
   confirm a lead email lands in `LEAD_EMAIL_TO`.
5. **Keep it running:** edit the paths in `deploy/com.barnettdigital.chatbot.plist`, then
   `cp` it to `~/Library/LaunchAgents/` and `launchctl load` it (survives crashes + reboots).
6. **Public HTTPS:** Cloudflare Tunnel → `chat.tcco.co.nz` (see `deploy/cloudflared-config.yml`).
   tcco.co.nz must be on Cloudflare first.
7. **Embed:** give Jordan `widget/embed-snippet.html` to paste into Webflow → Settings →
   Custom Code → Footer → **Publish**.
8. **Go-live smoke test:** work through `deploy/DEPLOY-CHECKLIST.md`.

## Rules (do not break)
- **Never commit secrets.** `.env` stays local.
- **Dan must never quote a price or book a job** — enforced in `app/brain.py` (HARD_RULES). Don't weaken it.
- Keep `knowledge/tcco.md` lean — it's sent to the model each chat (cached). Facts, not waffle.
- When unsure, **ask Jordan** rather than guessing.
