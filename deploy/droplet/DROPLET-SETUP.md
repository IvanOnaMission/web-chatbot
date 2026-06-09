# DigitalOcean droplet — Barnett Digital bot host

One small droplet runs every client bot you self-host (Bryce now; more later, each its own
instance + subdomain). ~15 min, one time. TCCO/Dan is the exception — that's on Jordan's Mac Mini.

## 0. Prereqs (your side)
- A DigitalOcean droplet — **Basic, $6/mo, Ubuntu 24.04** is plenty.
- DNS for `barnettdigital.co` (Cloudflare or wherever): add an **A record**
  `chat.barnettdigital.co` → the droplet's IP. (If on Cloudflare, set the proxy to DNS-only/grey
  cloud so Caddy can get its own cert.)
- Your **Anthropic API key** and **Resend API key**, with **`barnettdigital.co` verified in Resend**
  (so leads can email `bryce@leckelectrical.co.nz`).

## 1. Base setup (on the droplet, as root)
```bash
adduser --disabled-password --gecos "" deploy
apt update && apt install -y python3-venv git
# Caddy (auto-HTTPS):
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

## 2. Get the app + install
```bash
git clone https://github.com/IvanOnaMission/web-chatbot.git /opt/web-chatbot
chown -R deploy:deploy /opt/web-chatbot
sudo -u deploy bash -c 'cd /opt/web-chatbot && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'
```

## 3. Configure `.env` (Leck) — as the deploy user, in /opt/web-chatbot/.env
```
ANTHROPIC_API_KEY=sk-ant-...
MODEL=claude-haiku-4-5
BUSINESS_NAME=Leck Electrical
OWNER_NAME=Bryce
BOT_NAME=
KNOWLEDGE_FILE=knowledge/leck-electrical.md
LEAD_EMAIL_TO=bryce@leckelectrical.co.nz
EMAIL_FROM=leads@barnettdigital.co
RESEND_API_KEY=re_...
ALLOWED_ORIGINS=https://leckelectrical.co.nz,https://www.leckelectrical.co.nz
```
*(No inline comments in the real file.)*

## 4. Run it (systemd — keeps it alive + on reboot)
```bash
cp /opt/web-chatbot/deploy/droplet/chatbot.service /etc/systemd/system/chatbot.service
systemctl daemon-reload && systemctl enable --now chatbot
systemctl status chatbot           # should be active (running)
curl -s localhost:8000/health      # {"ok":true,...}
```

## 5. HTTPS (Caddy → chat.barnettdigital.co)
```bash
cp /opt/web-chatbot/deploy/droplet/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
# wait ~30s for the cert, then from your laptop:
curl -s https://chat.barnettdigital.co/health
```

## 6. Smoke test (don't skip)
- `https://chat.barnettdigital.co/chat` answers; "how much for a rewire?" → NO price, routes to a quote.
- Run a full "I'd like a quote" chat → a lead email lands at `bryce@leckelectrical.co.nz`.
- "burning smell" → tells them to call 111.

## 7. Embed on Bryce's site
Give Bryce `widget/embed-leck.html` to paste into WordPress (Insert Headers & Footers → Footer),
or do it with his access. Then it's live.

---

## Adding the next hosted client later
1. Add their knowledge file (`knowledge/<client>.md`) + their `embed-<client>.html`.
2. Second clone (`/opt/<client>`) with its own `.env` (its `KNOWLEDGE_FILE`, `LEAD_EMAIL_TO`).
3. Copy `chatbot.service` → `chatbot-<client>.service`, point `WorkingDirectory` at the clone
   and `--port 8001` (bump per client). Enable it.
4. Add a Caddy block: `chat.<client>.barnettdigital.co { reverse_proxy localhost:8001 }` → reload.
One droplet, many clients.
