# scripts

## `add-client.sh` — onboard a new hosted chatbot client

One command to scaffold every per-client file for a new Barnett-Digital-hosted bot, then it
prints the exact droplet runbook. Follows the existing pattern: **one systemd service per client,
each on its own port, reverse-proxied by Caddy per subdomain** — all sharing the single
`/opt/web-chatbot` clone + venv.

### Run it (on your Mac)
```bash
scripts/add-client.sh                 # interactive — prompts for everything, sensible defaults
```
Or pass flags to skip prompts:
```bash
scripts/add-client.sh \
  --slug acme-electrical --business "Acme Electrical" --owner Sam \
  --subdomain chat-acme.barnettdigital.co --domain acmeelectrical.co.nz \
  --lead jobs@acmeelectrical.co.nz --yes
```
`--help` lists every flag.

### What it generates (per client)
| File | Purpose |
|---|---|
| `knowledge/<slug>.md` | the bot's brain (from `_TEMPLATE.md`, business name filled) — you fill the facts |
| `knowledge/FOR-<OWNER>-fill-in.md` | the form the client fills (from `_TEMPLATE-fill-in.md`) |
| `widget/embed-<slug>.html` | the embed block (branding, greeting, prompts, avatar path, subdomain) |
| `INSTALL-<slug>.md` | client-facing install guide with the embed already dropped in (internal section stripped) |
| `.env.<slug>` | **gitignored** config; secrets left as `PLACEHOLDER_FILL_ON_DROPLET` |
| `deploy/droplet/chatbot-<slug>.service` | systemd unit on the **next free port** (auto-scanned from existing `*.service`) |
| Caddy block | appended to `deploy/droplet/Caddyfile` → subdomain → the new port |

It refuses to clobber an existing slug, and ensures `.gitignore` covers `.env.*`.

### After running
1. Fill `knowledge/<slug>.md` with the client's real answers.
2. (Optional) drop their logo at `widget/<slug>-logo.png`.
3. `git add -A && git commit` the new files (the `.env.<slug>` is gitignored — secrets stay off git).
4. Follow the printed **DROPLET RUNBOOK** in the DigitalOcean web console.
5. Hand the client `INSTALL-<slug>.md`.

> Out of scope: this automates the *current* one-process-per-client pattern. Collapsing all
> clients into a single multi-tenant process is a separate, bigger job.
