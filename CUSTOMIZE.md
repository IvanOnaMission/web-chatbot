# Customising for a new client

Reuse is a config pass, not a rebuild. The reusable engine (`app/`) never changes —
only the knowledge file and a handful of env vars.

## 1. Knowledge file
Drop the client's knowledge at `knowledge/<client>.md` and point `KNOWLEDGE_FILE` at it.
For an electrician, generate it from the master FAQ bank
(`clients/_templates/chatbot/faq-bank/electrical-faq-bank.md` in the agency repo) +
their brain, via the `chatbot-intake` skill. Keep it billboard-safe — no internal info.

## 2. Branding (.env)
- `BUSINESS_NAME`, `OWNER_NAME` — used in the greeting and the hard-rule prompt.

## 3. Lead routing (.env) — the client's call
- `LEAD_EMAIL_TO` + SMTP_* — where leads email to.
- `LEAD_SMS_TO` + TWILIO_* — optional instant text to the owner.
- To push into a job system (Katipult / Fergus / ServiceM8), extend `app/capture.py`
  `notify_lead()` — add one function and append its status. That's the only code change.

## 4. The widget
- Build `buildship-chat-widget` and host the JS on our domain (don't load from a CDN).
- Edit `widget/embed-snippet.html`: set the JS URL, the `/chat` URL, and the greeting.
- Set `ALLOWED_ORIGINS` to the client's site domain(s).
- If the widget build expects a response field other than `message`, configure it on
  the `<chat-widget>` element so it reads our `{ "message": ... }` reply.

## What you NEVER change per client
The hard rules in `app/brain.py` (no numbers, no booking, 111 for emergencies, don't
make things up). They're the safety contract — that's the whole reason this is safe to
put live. New trade vertical = new knowledge file + FAQ bank, same rules.
