# Website Lead-Capture Chatbot

Reusable web bot for trade businesses — answers customer questions and captures leads
24/7. The text/web sibling of the "Dan" voice receptionist. Automation-library asset #3.

**What it does:** a chat bubble on the client's website answers FAQs from the client's
knowledge file and captures qualified leads (name, phone, job) straight to the owner.
It **never quotes a price, never books a job** — it captures and hands off. That safety
contract lives in code (`app/brain.py`) and is the same for every client.

## Architecture (Option A — our own backend)
- **Frontend:** the vetted `buildship-chat-widget` (lite, MIT, no runtime deps) — a chat
  bubble that POSTs each message to our backend. Build it and self-host the JS.
- **Backend (this repo):** FastAPI + Claude (Haiku 4.5). `app/main.py` exposes `/chat`;
  `app/chat.py` runs the Claude call + the `capture_lead` tool loop; `app/capture.py`
  routes the lead (email / SMS / job system); `app/brain.py` builds the system prompt
  (hard rules + the client's `knowledge/<client>.md`).

```
website  ──POST /chat──▶  FastAPI  ──▶  Claude (Haiku) ──capture_lead──▶  email/SMS to owner
 (widget)                  app/            system = rules + knowledge file
```

## Run locally
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in ANTHROPIC_API_KEY + branding + lead routing
uvicorn app.main:app --reload
# test:
curl -s localhost:8000/chat -H 'content-type: application/json' \
  -d '{"message":"do you do ev chargers?"}' | python -m json.tool
```

## Reuse for a new client
See `CUSTOMIZE.md` — it's a knowledge file + a few env vars, not a rebuild.

## Per-client checklist to go live
See `deploy/DEPLOY-CHECKLIST.md`.
