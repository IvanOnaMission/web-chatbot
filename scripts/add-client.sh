#!/usr/bin/env bash
#
# add-client.sh — scaffold a new Barnett-Digital-hosted website-chatbot client.
#
# One systemd service per client, each on its own port, reverse-proxied by Caddy
# per subdomain (see deploy/droplet/DROPLET-SETUP.md). This script generates every
# per-client file LOCALLY, then prints the exact droplet runbook to finish the job.
#
# Usage:
#   scripts/add-client.sh                         # interactive (prompts for everything)
#   scripts/add-client.sh --slug acme-electrical --business "Acme Electrical" \
#     --owner Sam --subdomain chat-acme.barnettdigital.co \
#     --domain acmeelectrical.co.nz --lead jobs@acmeelectrical.co.nz
#
# Flags (all optional — anything missing is prompted for):
#   --slug         url-safe id, e.g. acme-electrical
#   --business     Business Name, e.g. "Acme Electrical"
#   --owner        Owner first name, e.g. Sam
#   --subdomain    bot subdomain, e.g. chat-acme.barnettdigital.co
#   --domain       client website apex domain, e.g. acmeelectrical.co.nz
#   --lead         lead email, e.g. jobs@acmeelectrical.co.nz
#   --accent       accent colour hex (default #2b6cb0)
#   --header       header colour hex (default #1a1a1a)
#   --header2      secondary header colour hex (default = accent)
#   --droplet-ip   droplet IP for the DNS step (default 209.38.94.136)
#   --yes          accept all defaults, skip confirmation prompt
#
set -euo pipefail

# ---- locate repo root (script lives in <root>/scripts/) ---------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

DROPLET_DIR="$ROOT/deploy/droplet"
CADDYFILE="$DROPLET_DIR/Caddyfile"

# ---- defaults ---------------------------------------------------------------
SLUG=""; BUSINESS=""; OWNER=""; SUBDOMAIN=""; DOMAIN=""; LEAD=""
ACCENT="#2b6cb0"
HEADER="#1a1a1a"
HEADER2=""
DROPLET_IP="209.38.94.136"
MODEL="claude-haiku-4-5"
EMAIL_FROM="leads@barnettdigital.co"
ASSUME_YES=0

# ---- flag parsing -----------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug)       SLUG="$2"; shift 2;;
    --business)   BUSINESS="$2"; shift 2;;
    --owner)      OWNER="$2"; shift 2;;
    --subdomain)  SUBDOMAIN="$2"; shift 2;;
    --domain)     DOMAIN="$2"; shift 2;;
    --lead)       LEAD="$2"; shift 2;;
    --accent)     ACCENT="$2"; shift 2;;
    --header)     HEADER="$2"; shift 2;;
    --header2)    HEADER2="$2"; shift 2;;
    --droplet-ip) DROPLET_IP="$2"; shift 2;;
    --yes|-y)     ASSUME_YES=1; shift;;
    -h|--help)    grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown flag: $1" >&2; exit 1;;
  esac
done

# ---- helpers ----------------------------------------------------------------
say()  { printf '%s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

ask() { # ask <var> <prompt> <default>
  local __var="$1" __prompt="$2" __default="${3:-}" __cur
  eval "__cur=\${$__var}"
  [[ -n "$__cur" ]] && return 0          # already set via flag
  if [[ -n "$__default" ]]; then
    read -r -p "$__prompt [$__default]: " __in || true
    __in="${__in:-$__default}"
  else
    read -r -p "$__prompt: " __in || true
  fi
  printf -v "$__var" '%s' "$__in"
}

slugify() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'; }

# ---- collect inputs ---------------------------------------------------------
say ""
say "── Add a Barnett Digital hosted chatbot client ──"
say ""

ask BUSINESS  "Business name (e.g. Acme Electrical)"
[[ -n "$BUSINESS" ]] || die "Business name is required."

DEFAULT_SLUG="$(slugify "$BUSINESS")"
ask SLUG      "Slug (url-safe id)" "$DEFAULT_SLUG"
SLUG="$(slugify "$SLUG")"
[[ -n "$SLUG" ]] || die "Slug is required."

ask OWNER     "Owner first name (e.g. Sam)"
[[ -n "$OWNER" ]] || die "Owner name is required."
OWNER_UC="$(echo "$OWNER" | tr '[:lower:]' '[:upper:]')"

ask SUBDOMAIN "Bot subdomain" "chat-${SLUG%%-*}.barnettdigital.co"
ask DOMAIN    "Client website apex domain (no https://)"
[[ -n "$DOMAIN" ]] || die "Client domain is required (for ALLOWED_ORIGINS)."
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN%/}"

ask LEAD      "Lead email (where leads land)"
[[ -n "$LEAD" ]] || die "Lead email is required."

ask ACCENT    "Accent colour (hex)" "$ACCENT"
ask HEADER    "Header colour (hex)" "$HEADER"
[[ -n "$HEADER2" ]] || HEADER2="$ACCENT"

ALLOWED_ORIGINS="https://${DOMAIN},https://www.${DOMAIN}"
SUBDOMAIN="${SUBDOMAIN#http://}"; SUBDOMAIN="${SUBDOMAIN#https://}"; SUBDOMAIN="${SUBDOMAIN%/}"

# ---- collision check (don't clobber) ---------------------------------------
KNOW_FILE="$ROOT/knowledge/${SLUG}.md"
FILLIN_FILE="$ROOT/knowledge/FOR-${OWNER_UC}-fill-in.md"
EMBED_FILE="$ROOT/widget/embed-${SLUG}.html"
INSTALL_FILE="$ROOT/INSTALL-${SLUG}.md"
ENV_FILE="$ROOT/.env.${SLUG}"
SERVICE_FILE="$DROPLET_DIR/chatbot-${SLUG}.service"

EXISTING=()
for f in "$KNOW_FILE" "$EMBED_FILE" "$INSTALL_FILE" "$ENV_FILE" "$SERVICE_FILE"; do
  [[ -e "$f" ]] && EXISTING+=("$f")
done
if [[ ${#EXISTING[@]} -gt 0 ]]; then
  warn "Slug '$SLUG' already has files — refusing to clobber:"
  for f in "${EXISTING[@]}"; do say "      $f"; done
  die "Pick a different slug, or delete the above first."
fi

# ---- auto-detect next free port (scan existing *.service, start at 8000) ----
USED_PORTS="$(grep -hoE -- '--port[ =]+[0-9]+' "$DROPLET_DIR"/*.service 2>/dev/null \
  | grep -oE '[0-9]+' | sort -n | uniq || true)"
PORT=8000
while echo "$USED_PORTS" | grep -qx "$PORT"; do PORT=$((PORT+1)); done

# ---- summary + confirm ------------------------------------------------------
say ""
say "── Will generate ──"
say "  Slug:            $SLUG"
say "  Business:        $BUSINESS"
say "  Owner:           $OWNER"
say "  Bot subdomain:   $SUBDOMAIN"
say "  Allowed origins: $ALLOWED_ORIGINS"
say "  Lead email:      $LEAD"
say "  Accent/Header:   $ACCENT / $HEADER (header2 $HEADER2)"
say "  Port (auto):     $PORT   (used: ${USED_PORTS//$'\n'/ })"
say ""
if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "Generate these files? [y/N]: " CONFIRM || true
  case "$CONFIRM" in y|Y|yes|YES) ;; *) die "Aborted — nothing written.";; esac
fi
say ""

# ---- 1. knowledge/<slug>.md (from _TEMPLATE.md, business filled in) ---------
sed -e "s/{{BUSINESS}}/${BUSINESS//\//\\/}/g" \
    -e "s/{{AGENT}}/${BUSINESS//\//\\/}/g" \
    "$ROOT/knowledge/_TEMPLATE.md" > "$KNOW_FILE"
ok "knowledge/${SLUG}.md"

# ---- 2. knowledge/FOR-<OWNER>-fill-in.md (from _TEMPLATE-fill-in.md) --------
sed -e "s/{{AGENT}}/${BUSINESS//\//\\/}/g" \
    -e "s/{{CLIENT NAME}}/${BUSINESS//\//\\/}/g" \
    "$ROOT/knowledge/_TEMPLATE-fill-in.md" > "$FILLIN_FILE"
ok "knowledge/FOR-${OWNER_UC}-fill-in.md"

# ---- 3. widget/embed-<slug>.html --------------------------------------------
GREETING="Hey 👋 ${BUSINESS} here. After a quote or got a question? Ask me anything, or I'll get ${OWNER} to call you back."
PROMPTS="Get a quote|What areas do you cover?|Do you do callouts?|How does quoting work?"
cat > "$EMBED_FILE" <<EOF
<!--
  ${BUSINESS} chatbot — embed snippet (paste into the client's site footer / custom code).
  Barnett-Digital-hosted on the droplet → URLs point at ${SUBDOMAIN}.
  Logo: drop the client's logo into widget/${SLUG}-logo.png (served at /assets/${SLUG}-logo.png).
-->
<script src="https://${SUBDOMAIN}/chat-widget.js?v=1"></script>
<chat-widget
  url="https://${SUBDOMAIN}/chat"
  agent="${BUSINESS}"
  business="${BUSINESS}"
  avatar="https://${SUBDOMAIN}/assets/${SLUG}-logo.png"
  tagline="Typically replies instantly"
  greeting="${GREETING}"
  prompts="${PROMPTS}"
  accent="${ACCENT}"
  header="${HEADER}"
  header2="${HEADER2}"
  teaser="👋 Send us a message — we're online!"
  teaser-timeout="5000"
></chat-widget>
EOF
ok "widget/embed-${SLUG}.html"

# ---- 4. INSTALL-<slug>.md (from INSTALL-FOR-CLIENT.md, embed dropped in) ----
# Strip the INTERNAL section (between the "Ivan's per-client checklist" heading
# and the "Add your chat assistant" client section), then inject the embed block.
EMBED_BLOCK="$(cat "$EMBED_FILE")"
awk -v biz="$BUSINESS" '
  /^## ⚙️ Ivan'"'"'s per-client checklist/ { skip=1 }
  /^## 📋 Add your chat assistant/ { skip=0 }
  skip==1 { next }
  /^# Website Chat Assistant/ { print "# " biz " — Add Your Chat Assistant to Your Website"; next }
  { print }
' "$ROOT/INSTALL-FOR-CLIENT.md" > "$INSTALL_FILE.tmp"

# Replace the PASTE-block placeholder with the real embed.
python3 - "$INSTALL_FILE.tmp" "$INSTALL_FILE" "$EMBED_FILE" <<'PY'
import sys
tmp, out, embed_path = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(tmp, encoding="utf-8").read()
embed = open(embed_path, encoding="utf-8").read().rstrip("\n")
needle = "PASTE THE CLIENT'S BLOCK HERE\n(from widget/embed-<client>.html)"
if needle in src:
    src = src.replace(needle, embed)
else:
    # fallback: replace just the first placeholder line
    src = src.replace("PASTE THE CLIENT'S BLOCK HERE", embed)
open(out, "w", encoding="utf-8").write(src)
PY
rm -f "$INSTALL_FILE.tmp"
ok "INSTALL-${SLUG}.md"

# ---- 5. .env.<slug> (gitignored) --------------------------------------------
cat > "$ENV_FILE" <<EOF
# .env.${SLUG} — config for ${BUSINESS} (gitignored). Loaded via systemd EnvironmentFile.
# Fill the two PLACEHOLDER secrets on the droplet (nano), then enable the service.

# --- Claude ---
ANTHROPIC_API_KEY=PLACEHOLDER_FILL_ON_DROPLET
MODEL=${MODEL}

# --- Per-client branding ---
BUSINESS_NAME=${BUSINESS}
OWNER_NAME=${OWNER}
BOT_NAME=
KNOWLEDGE_FILE=knowledge/${SLUG}.md

# --- Where leads land ---
LEAD_EMAIL_TO=${LEAD}
EMAIL_FROM=${EMAIL_FROM}

# --- Email sending: Resend ---
RESEND_API_KEY=PLACEHOLDER_FILL_ON_DROPLET

# --- Web embed security (client's website) ---
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
EOF
ok ".env.${SLUG}  (gitignored — secrets are placeholders)"

# ---- 6. deploy/droplet/chatbot-<slug>.service -------------------------------
cat > "$SERVICE_FILE" <<EOF
# systemd unit — ${BUSINESS} bot (Barnett-Digital-hosted, shares the /opt/web-chatbot clone + venv).
# Config from .env.${SLUG}, runs on port ${PORT}.
#
# Install (on the droplet):
#   sudo cp /opt/web-chatbot/deploy/droplet/chatbot-${SLUG}.service /etc/systemd/system/
#   sudo systemctl daemon-reload && sudo systemctl enable --now chatbot-${SLUG}
#   sudo systemctl status chatbot-${SLUG} --no-pager

[Unit]
Description=Barnett Digital website chatbot (${BUSINESS})
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/web-chatbot
EnvironmentFile=/opt/web-chatbot/.env.${SLUG}
ExecStart=/opt/web-chatbot/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${PORT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
ok "deploy/droplet/chatbot-${SLUG}.service  (port ${PORT})"

# ---- 7. Caddy block ---------------------------------------------------------
CADDY_BLOCK=$(cat <<EOF

# ${BUSINESS} — port ${PORT}
${SUBDOMAIN} {
    reverse_proxy localhost:${PORT}
}
EOF
)
if [[ -w "$CADDYFILE" ]] && ! grep -q "^${SUBDOMAIN} {" "$CADDYFILE"; then
  printf '%s\n' "$CADDY_BLOCK" >> "$CADDYFILE"
  ok "Appended Caddy block to deploy/droplet/Caddyfile"
  CADDY_APPENDED=1
else
  warn "Caddy block NOT appended (already present or file unwritable) — add manually:"
  CADDY_APPENDED=0
fi

# ---- 8. ensure .gitignore covers .env.* -------------------------------------
if ! grep -qxF '.env.*' "$ROOT/.gitignore" 2>/dev/null; then
  printf '.env.*\n!.env.example\n' >> "$ROOT/.gitignore"
  ok "Added '.env.*' (keeping .env.example) to .gitignore"
fi

# =============================================================================
#  DROPLET RUNBOOK  (run these in the DigitalOcean web console)
# =============================================================================
cat <<RUNBOOK

═══════════════════════════════════════════════════════════════════════════════
 DROPLET RUNBOOK — ${BUSINESS}  (run in the DigitalOcean web console, as deploy)
═══════════════════════════════════════════════════════════════════════════════

 First, commit + push these new files from your Mac (Ivan controls the push):
   git add -A && git commit -m "Add ${SLUG} chatbot client" && git push

──────────────────────────────────────────────────────────────────────────────
 1) Pull the new files onto the droplet
──────────────────────────────────────────────────────────────────────────────
   cd /opt/web-chatbot && git pull

──────────────────────────────────────────────────────────────────────────────
 2) Fill the two secrets in .env.${SLUG}
──────────────────────────────────────────────────────────────────────────────
   nano /opt/web-chatbot/.env.${SLUG}
     → replace ANTHROPIC_API_KEY=PLACEHOLDER_FILL_ON_DROPLET  with the sk-ant-... key
     → replace RESEND_API_KEY=PLACEHOLDER_FILL_ON_DROPLET     with the re_... key
     (Ctrl+O, Enter to save, Ctrl+X to exit)

──────────────────────────────────────────────────────────────────────────────
 3) Install + start the service
──────────────────────────────────────────────────────────────────────────────
   sudo cp /opt/web-chatbot/deploy/droplet/chatbot-${SLUG}.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now chatbot-${SLUG}
   sudo systemctl status chatbot-${SLUG} --no-pager
   curl -s localhost:${PORT}/health        # expect {"ok":true,...}

──────────────────────────────────────────────────────────────────────────────
 4) Caddy (HTTPS for ${SUBDOMAIN})
──────────────────────────────────────────────────────────────────────────────
   # git pull already updated deploy/droplet/Caddyfile — install + reload:
   sudo cp /opt/web-chatbot/deploy/droplet/Caddyfile /etc/caddy/Caddyfile
   sudo systemctl reload caddy
$(if [[ "${CADDY_APPENDED}" -ne 1 ]]; then
echo "   # (block was NOT auto-appended — add this to /etc/caddy/Caddyfile first:)"
printf '%s\n' "${CADDY_BLOCK}" | sed 's/^/   /'
fi)

──────────────────────────────────────────────────────────────────────────────
 5) DNS — A record for the bot subdomain (Cloudflare, DNS-only / grey cloud)
──────────────────────────────────────────────────────────────────────────────
   Type: A   Name: ${SUBDOMAIN%%.barnettdigital.co}   Value: ${DROPLET_IP}   Proxy: DNS only

──────────────────────────────────────────────────────────────────────────────
 6) Smoke test (wait ~30s for the cert)
──────────────────────────────────────────────────────────────────────────────
   curl -s https://${SUBDOMAIN}/health
   # then open https://${SUBDOMAIN}/chat and ask "how much for a job?" → must NOT price, routes to a quote

──────────────────────────────────────────────────────────────────────────────
 7) Hand the client their install guide
──────────────────────────────────────────────────────────────────────────────
   → INSTALL-${SLUG}.md   (embed block already filled in for ${BUSINESS})
   → If they want the avatar: drop their logo at widget/${SLUG}-logo.png, commit, git pull on droplet.

═══════════════════════════════════════════════════════════════════════════════
 Done. ${BUSINESS} → port ${PORT} → ${SUBDOMAIN}
═══════════════════════════════════════════════════════════════════════════════
RUNBOOK
