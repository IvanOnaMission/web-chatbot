# Dan — TCCO Website Chatbot · Handover

This repo is **Dan**, the website chatbot for The Conduction Company — answers questions
and captures leads on tcco.co.nz, 24/7. Same Dan persona as the phone assistant.

Most of it's done. Below is everything we need **from Jordan** to flip it live. Most are
quick confirms — we've pre-filled from the TCCO website.

---

## 1. Confirm the knowledge (5 min) — `knowledge/tcco.md`
We pulled services, Auckland suburbs, credentials, guarantee, reviews, and **drafted the
common FAQ answers** from the site. Open `knowledge/tcco.md` and:
- [ ] Fix anything wrong in the services / area / FAQ answers.
- [ ] Add any questions customers ask that aren't there.
- [ ] Answer the one flagged gap: **after-hours / emergency line** (if any).

## 2. Confirm the behaviour (already set — just nod)
- [ ] Dan **never quotes a price** — always routes to "the team will get you a quote." OK?
- [ ] Dan **captures details, never books a time** (a human confirms). OK?
- [ ] After hours: *"the team will call you back first thing."* OK or reword?
- [ ] Greeting: *"Hi 👋 I'm Dan from TCCO — Auckland electrical. Got a question or after a
      quote? I can help, or get the team to call you back."* OK?

## 3. Where leads go
- [ ] Email to **office@tcco.co.nz**, or a specific person?
- [ ] Want a **text** to a mobile too when a lead comes in? (give the number)
- [ ] (Later) drop leads into Simpro?

## 4. Three things only you can provide
- [ ] **Anthropic API key** — console.anthropic.com → API Keys. (You pay usage; tiny for chat.)
- [ ] **tcco.co.nz DNS** on Cloudflare — powers `chat.tcco.co.nz` + the lead emails. Who
      manages your domain? (If this is heavy on the live site, we can use a barnettdigital.co
      URL instead — customers never see it.)
- [ ] **Webflow** — we paste one code block into Settings → Custom Code → Footer and Publish.
      Either add Ivan, or paste the block we send.

## 5. The Mac Mini
- [ ] Remote access (screen share) so we install it, and confirm the Mini stays **on** with
      stable internet (Dan lives there).

---

Once 1–5 are in, go-live is ~30 min — full steps in `deploy/MAC-MINI-SETUP.md`.
