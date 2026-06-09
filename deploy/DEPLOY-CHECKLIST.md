# Deploy checklist — per client

Ivan-hosted (the client never touches the server). Host the backend where it's always
on (Railway / a small droplet) and serve the widget JS from the same domain.

## Before go-live
- [ ] `knowledge/<client>.md` compiled and reviewed (no prices, no made-up services).
- [ ] `.env` filled: `ANTHROPIC_API_KEY` (client's own key), `BUSINESS_NAME`, `OWNER_NAME`,
      `KNOWLEDGE_FILE`, lead routing (`LEAD_EMAIL_TO`/SMTP, optional `LEAD_SMS_TO`/Twilio).
- [ ] `ALLOWED_ORIGINS` = the client's real site domain(s) only (not `*`).
- [ ] Backend deployed; `GET /health` returns ok.
- [ ] Smoke test `/chat`: ask "how much for a switchboard?" → it must NOT give a number,
      it must route to a quote. Ask "do you do X?" → answers from the knowledge file.
- [ ] Lead test: run a full "I want a quote" conversation → confirm the owner actually
      receives the email/SMS. **Do not go live until a real lead lands.**
- [ ] Widget JS built from the vetted repo and self-hosted (not a public CDN).
- [ ] Embed snippet added to the client's WordPress footer; bubble appears on the live site.

## After go-live (first week)
- [ ] Watch the first real leads; tune the knowledge file for anything it fumbled.
- [ ] Capture before/after numbers (leads caught, especially after-hours) for the case study.

## Safety re-check (this is the bot that replaced one Bryce killed)
- [ ] It never states a price or books a time.
- [ ] Emergencies → tells them to call 111.
- [ ] When unsure, it offers a callback instead of guessing.
