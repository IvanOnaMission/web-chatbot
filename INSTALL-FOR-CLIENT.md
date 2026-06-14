# Website Chat Assistant — Install Guide

Reusable install instructions to hand a client so they can add their chat assistant
to their own website. Works for any client — each one just needs their own embed block
(see the per-client `widget/embed-<client>.html` file).

---

## ⚙️ Ivan's per-client checklist (INTERNAL — delete this whole section before sending to the client)

Before you send a client the guide below, do these once:

1. **Add their website domain to `ALLOWED_ORIGINS`** in the droplet `.env`
   (`/opt/web-chatbot/.env`), e.g. `https://theirsite.co.nz,https://www.theirsite.co.nz`,
   then `systemctl restart chatbot`. **Without this the bubble loads but won't reply.**
2. **Grab their configured embed block** from `widget/embed-<client>.html`
   (branding, logo, prompts, greeting already set for that client).
3. **Paste that block into "Step 1" below**, replacing the `PASTE THE CLIENT'S BLOCK HERE`
   placeholder.
4. **Delete this internal section**, then send the rest to the client.

> Note: the long-term simpler path is a one-line per-client loader
> (`<script src="https://chat.barnettdigital.co/embed/<client>.js" defer></script>`).
> Build that when remote onboarding becomes routine — it removes the "paste a big block"
> friction entirely.

---

## 📋 Add your chat assistant to your website (≈2 minutes)

**Step 1 — copy this code:**

```html
PASTE THE CLIENT'S BLOCK HERE
(from widget/embed-<client>.html)
```

**Step 2 — paste it into your website. Find your platform:**

| Platform | Where to paste |
|---|---|
| **WordPress** | Install the free **"WPCode"** plugin → **Code Snippets → Header & Footer** → paste into the **Footer** box → **Save**. *(Divi theme? Even simpler: **Divi → Theme Options → Integration → "Add code to the body"** → paste → Save.)* |
| **Squarespace** | **Settings → Advanced → Code Injection** → paste into the **Footer** box → **Save**. *(Needs a Business plan or higher.)* |
| **Wix** | **Settings → Custom Code → + Add Code** → paste → set **"Place code in: Body – end"** + **All pages** → **Apply**. |
| **Shopify** | **Online Store → Themes → ⋯ → Edit code → `theme.liquid`** → paste just before `</body>` → **Save**. |
| **Other / not sure** | Look for a setting called **"Custom Code", "Code Injection", "Header/Footer scripts"** or **"Embed code"**, and paste it into the **Footer** or **end of Body**. |

**Step 3 — check it worked:** open your site in a **private/incognito window**, wait ~2 seconds —
a chat bubble appears bottom-right. Click it, send a test message. Done. ✅

If you don't see it: hard-refresh (Ctrl/Cmd + Shift + R), make sure you **published/saved**
the change, and confirm you pasted it in the **Footer / end of Body** (not the Header).
