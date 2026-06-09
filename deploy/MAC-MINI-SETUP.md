# Mac Mini self-host runbook (TCCO / Jordan)

Runs the bot on Jordan's Mac Mini, reachable from his Webflow site over HTTPS via a
Cloudflare Tunnel. ~30 min, one time.

## 0. Prereqs
- Python 3.11+ on the Mac Mini (`python3 --version`)
- **Jordan's Anthropic API key** (he pays usage — console.anthropic.com)
- **tcco.co.nz DNS on Cloudflare** (free) — this one move enables BOTH the `chat.tcco.co.nz`
  tunnel AND Resend email verification. It changes the domain's nameservers, so do it with
  whoever manages the TCCO site and copy every existing DNS record across first (website,
  email/MX, etc.). If that's too heavy on a live business domain, fall back to
  `chat.barnettdigital.co` (Ivan's domain — zero risk to TCCO's site; customers never see it).
- **Resend** API key + `tcco.co.nz` verified as a sending domain (paste Resend's records into
  Cloudflare). Gives `EMAIL_FROM=leads@tcco.co.nz`. resend.com, free tier.

## 1. Get the code + install
```bash
git clone <repo> web-chatbot && cd web-chatbot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Configure `.env`
```bash
cp .env.example .env
```
Fill:
```
ANTHROPIC_API_KEY=sk-ant-...          # Jordan's key
MODEL=claude-haiku-4-5
BUSINESS_NAME=The Conduction Company
OWNER_NAME=the TCCO team
KNOWLEDGE_FILE=knowledge/tcco.md
LEAD_EMAIL_TO=office@tcco.co.nz        # where leads go (confirm with Jordan)
EMAIL_FROM=leads@<verified-domain>
RESEND_API_KEY=re_...
ALLOWED_ORIGINS=https://www.tcco.co.nz,https://tcco.co.nz
```

## 3. Test locally
```bash
bash deploy/start.sh
# new terminal:
curl -s localhost:8000/chat -H 'content-type: application/json' \
  -d '{"message":"how much for a switchboard?"}' | python3 -m json.tool
# must NOT contain a price; should route to a quote/callback.
```

## 4. Keep it running (launchd)
Edit the two `/Users/REPLACE_ME/...` paths in `deploy/com.barnettdigital.chatbot.plist`, then:
```bash
cp deploy/com.barnettdigital.chatbot.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.barnettdigital.chatbot.plist
```
Survives crashes and reboots. Logs in `/tmp/chatbot.out` / `.err`.

## 5. Public HTTPS — named Cloudflare Tunnel to chat.tcco.co.nz
The Mac Mini isn't on the public internet; the tunnel gives it a stable HTTPS URL with no
port-forwarding. **Prerequisite: tcco.co.nz must be on Cloudflare (step 0).**
```bash
brew install cloudflared
cloudflared tunnel login                       # once, in a browser; pick the tcco.co.nz zone
cloudflared tunnel create tcco-chatbot          # prints a <TUNNEL_ID> + writes a creds .json
cloudflared tunnel route dns tcco-chatbot chat.tcco.co.nz
# put deploy/cloudflared-config.yml at ~/.cloudflared/config.yml (fill <TUNNEL_ID> + path), then:
cloudflared tunnel run tcco-chatbot
```
Keep the tunnel running across reboots (so the bot stays reachable):
```bash
sudo cloudflared service install      # installs cloudflared as a launchd service
```
Public base URL is now **https://chat.tcco.co.nz** (HTTPS auto-handled by Cloudflare).

> Quick demo without any of this: `cloudflared tunnel --url http://localhost:8000` prints a
> throwaway `https://xxxx.trycloudflare.com` (changes on restart — video only, not live).

## 6. Embed on the Webflow site
Webflow → **Project Settings → Custom Code → Footer Code**, paste (swap in the tunnel URL):
```html
<script src="https://chat.tcco.co.nz/chat-widget.js"></script>
<chat-widget
  url="https://chat.tcco.co.nz/chat"
  title="The Conduction Company"
  greeting="Hi 👋 TCCO here — Auckland electrical. Got a question or after a quote? I can help or get the team to call you back."
  accent="#0e2a47"
></chat-widget>
```
**Publish** the site.

## 7. Go-live smoke test (do not skip)
- [ ] Bubble appears on the live tcco.co.nz.
- [ ] "how much…?" → no number, routes to a quote.
- [ ] "do you cover Takapuna?" / "do you do EV chargers?" → answers from the knowledge file.
- [ ] Full "I'd like a quote" chat → a lead email actually lands in `LEAD_EMAIL_TO`.
- [ ] Emergency phrasing ("burning smell") → tells them to call 111.
