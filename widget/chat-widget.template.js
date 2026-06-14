/*
 * ============================================================================
 * BRAND-NEUTRAL CHAT WIDGET TEMPLATE — canonical base for new client widgets.
 * ============================================================================
 * Self-contained, zero dependencies, premium Intercom-style look: gradient
 * header, status line, tappable suggested questions, proactive teaser bubble,
 * typing dots, spring animations, reduced-motion support.
 *
 * This file has NO client branding baked in — every client-specific value is a
 * neutral placeholder or sensible default, overridden purely by attributes on
 * the <chat-widget> tag. To stand up a new client: copy this file (or just embed
 * it as-is) and set the attributes below. Don't hardcode client colours/copy here.
 *
 * Embed (drop into the site footer):
 *   <script src="https://YOUR-HOST/chat-widget.template.js"></script>
 *   <chat-widget
 *     url="https://YOUR-BACKEND/chat"
 *     agent="Assistant"
 *     business="Your Business"
 *     accent="#2563eb">
 *   </chat-widget>
 *
 * Backend contract:  POST {url}  { message, threadId }  ->  { message, threadId }
 *
 * ---------------------------------------------------------------------------
 * ATTRIBUTES (all optional except `url`):
 *   url          (REQUIRED) backend /chat endpoint
 *   agent        assistant name in the header           (default "Assistant")
 *   business     business name / header subtitle source (default "")
 *   avatar       assistant image URL — logo or photo; falls back to a monogram
 *                of the agent's first initial            (default none → monogram)
 *   greeting     first bot message                       (default generic greeting)
 *   prompts      suggested-question chips, "|"-separated (default none)
 *   tagline      header status line                      (default "Typically replies instantly")
 *   accent       brand colour — buttons/bubbles/launcher (default #2563eb, NEUTRAL slate-blue)
 *   header       header gradient start                   (default = accent)
 *   header2      header gradient end                     (default = accent)
 *   placeholder  input placeholder                       (default "Write a message…")
 *   teaser       proactive bubble copy popping ~2s after load beside the launcher
 *                                                        (default "👋 Send us a message — we're online!")
 *   teaser-timeout  ms before the teaser auto-closes after appearing (default 5000).
 *                0 / "off" keeps it up until dismissed. Auto-close does NOT suppress
 *                for the session (timeout = "not engaged yet", can nudge again next
 *                page load); only an explicit × dismiss or opening the chat suppresses
 *                it for the session (sessionStorage). Hover/focus pauses the timer.
 *
 * PLACEHOLDERS to replace per client (or just override via attributes — preferred):
 *   - accent          → the client's brand colour (this file ships a NEUTRAL slate-blue #2563eb)
 *   - agent/greeting  → client's assistant name + opening line
 *   - avatar          → client's logo/photo URL (ships with NONE → monogram fallback)
 *   - prompts         → client's top 2–3 questions
 * ============================================================================
 */
(function () {
  const ICON_CHAT = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const ICON_SEND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  const FONT = "'Inter','SF Pro Text',ui-sans-serif,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const SPRING = "cubic-bezier(.22,1,.36,1)"; // smooth, slightly overshooting ease-out

  class ChatWidget extends HTMLElement {
    connectedCallback() {
      this.url = this.getAttribute("url");
      this.agent = this.getAttribute("agent") || "Assistant";
      this.business = this.getAttribute("business") || this.getAttribute("title") || "";
      this.avatar = this.getAttribute("avatar") || ""; // NEUTRAL: no avatar → monogram fallback
      this.greeting = this.getAttribute("greeting") ||
        "Hi 👋 — got a question or after a quote? I can help.";
      this.prompts = (this.getAttribute("prompts") || "").split("|").map(s => s.trim()).filter(Boolean);
      this.tagline = this.getAttribute("tagline") || "Typically replies instantly";
      this.accent = this.getAttribute("accent") || "#2563eb"; // NEUTRAL placeholder — slate-blue
      this.header = this.getAttribute("header") || this.accent;
      this.header2 = this.getAttribute("header2") || this.accent;
      this.placeholder = this.getAttribute("placeholder") || "Write a message…";
      this.teaser = this.getAttribute("teaser") || "👋 Send us a message — we're online!";
      // How long the teaser lingers before tucking away (ms). 0 / "off" = stay until dismissed.
      this.teaserTimeout = (() => {
        const raw = this.getAttribute("teaser-timeout");
        if (raw == null || raw === "") return 5000;
        if (raw === "off" || raw === "false") return 0;
        const n = parseInt(raw, 10);
        return isNaN(n) || n < 0 ? 5000 : n;
      })();
      this.initial = (this.agent.trim()[0] || "•").toUpperCase();
      this.threadId = null;
      this.open = false;
      this.greeted = false;
      this._autoCloseTimer = null; // pending teaser auto-close (cleared on dismiss/open/hover)
      this.render();
      this.maybeShowTeaser();
    }

    // Don't-nag: once a visitor dismisses the teaser (or opens the chat), remember it for the
    // rest of the session. sessionStorage (not localStorage) on purpose — clears on tab close,
    // so a returning visitor gets the nudge again on a fresh visit but isn't pestered on every
    // page in the same session. Wrapped in try/catch for Safari private mode.
    teaserDismissed() {
      try { return sessionStorage.getItem("cw-teaser-dismissed") === "1"; } catch (e) { return false; }
    }
    markTeaserDismissed() {
      try { sessionStorage.setItem("cw-teaser-dismissed", "1"); } catch (e) {}
    }

    avatarHTML(cls) {
      if (this.avatar) {
        return `<span class="${cls}"><img src="${this.avatar}" alt="${this.agent}" onerror="this.parentNode.textContent='${this.initial}'"/></span>`;
      }
      return `<span class="${cls}">${this.initial}</span>`;
    }

    render() {
      const root = this.attachShadow({ mode: "open" });
      // Premium polish: refined type scale, layered shadows + ring, off-white message area,
      // spring easing, staggered bubble rise, focus ring, online-dot glow, avatar ring. All
      // motion curbed under prefers-reduced-motion (bottom of the stylesheet).
      root.innerHTML = `
        <style>
          :host { --accent: ${this.accent}; --header: ${this.header}; --header2: ${this.header2};
            --ink: #171b22; --ink-soft: #5a6470; all: initial; }
          *, *::before, *::after { box-sizing: border-box; font-family: ${FONT};
            -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }

          .launcher {
            position: fixed; bottom: 24px; right: 24px; z-index: 2147483000;
            width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
            background: radial-gradient(120% 120% at 30% 25%, color-mix(in srgb, var(--accent) 88%, #fff) 0%, var(--accent) 55%, color-mix(in srgb, var(--accent) 80%, #000) 100%);
            color: #fff; display: grid; place-items: center;
            box-shadow: 0 1px 1px rgba(15,23,42,.10), 0 8px 20px rgba(15,23,42,.26), 0 2px 6px rgba(15,23,42,.16), inset 0 1px 0 rgba(255,255,255,.28);
            transition: transform .22s ${SPRING}, box-shadow .22s ease;
          }
          .launcher:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 2px 2px rgba(15,23,42,.12), 0 14px 30px rgba(15,23,42,.32), inset 0 1px 0 rgba(255,255,255,.3); }
          .launcher:active { transform: translateY(0) scale(.95); }
          .launcher svg { transition: transform .22s ${SPRING}; }
          .launcher:hover svg { transform: scale(1.06); }
          /* One-time, gentle attention nudge: soft expanding halo + a single slow bounce.
             Added only while the teaser shows, removed on dismiss/open. */
          .launcher.nudge { animation: cw-bounce 2.2s ease 1; }
          .launcher.nudge::after { content: ''; position: absolute; inset: 0; border-radius: 50%;
            box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent);
            animation: cw-halo 2.2s ease-out 2; pointer-events: none; }
          @keyframes cw-bounce { 0%,55%,100% { transform: translateY(0); } 68% { transform: translateY(-7px); } 82% { transform: translateY(-3px); } }
          @keyframes cw-halo { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); } 100% { box-shadow: 0 0 0 16px transparent; } }

          /* --- proactive teaser bubble (sits left of the launcher) --- */
          .teaser { position: fixed; bottom: 32px; right: 98px; z-index: 2147483000; max-width: 250px;
            display: flex; align-items: center; gap: 11px; background: #fff; color: var(--ink);
            border: 1px solid rgba(15,23,42,.06); border-radius: 18px 18px 5px 18px; padding: 12px 34px 12px 13px;
            box-shadow: 0 1px 2px rgba(15,23,42,.06), 0 14px 34px rgba(15,23,42,.18), 0 4px 10px rgba(15,23,42,.08);
            cursor: pointer; opacity: 0; transform: translateY(8px) scale(.92); transform-origin: bottom right;
            pointer-events: none; transition: opacity .3s ease, transform .3s ${SPRING}, box-shadow .2s ease; }
          .teaser.show { opacity: 1; transform: none; pointer-events: auto; }
          .teaser:hover { box-shadow: 0 2px 4px rgba(15,23,42,.08), 0 18px 40px rgba(15,23,42,.24); }
          .teaser .ava-sm { width: 34px; height: 34px; flex: none; border-radius: 50%; overflow: hidden;
            background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 13px; font-weight: 600;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent); }
          .teaser-txt { font-size: 13.5px; line-height: 1.45; font-weight: 500; letter-spacing: .1px; }
          .teaser-x { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 50%;
            border: none; background: var(--header); color: #fff; font-size: 14px; line-height: 1; cursor: pointer;
            display: grid; place-items: center; box-shadow: 0 2px 6px rgba(15,23,42,.3);
            transition: transform .14s ${SPRING}, filter .14s ease; }
          .teaser-x:hover { filter: brightness(1.25); transform: scale(1.12); }
          @media (max-width: 480px) { .teaser { right: 86px; left: 14px; max-width: none; bottom: 30px; } }

          .panel {
            position: fixed; bottom: 96px; right: 24px; z-index: 2147483000;
            width: 386px; max-width: calc(100vw - 32px);
            height: 592px; max-height: calc(100vh - 132px);
            display: flex; flex-direction: column; overflow: hidden;
            background: #fff; border-radius: 22px; border: 1px solid rgba(15,23,42,.05);
            box-shadow: 0 1px 2px rgba(15,23,42,.06), 0 24px 60px rgba(15,23,42,.24), 0 8px 20px rgba(15,23,42,.12), inset 0 0 0 1px rgba(255,255,255,.5);
            opacity: 0; transform: translateY(18px) scale(.97); transform-origin: bottom right; pointer-events: none;
            transition: opacity .28s ease, transform .34s ${SPRING};
          }
          .panel.open { opacity: 1; transform: none; pointer-events: auto; }

          .head { position: relative;
            background: linear-gradient(135deg, var(--header) 0%, color-mix(in srgb, var(--header) 55%, var(--header2)) 62%, var(--header2) 100%);
            color: #fff; padding: 20px 20px 22px; display: flex; align-items: center; gap: 13px; }
          /* soft sheen across the header for depth, plus a hairline divider under it */
          .head::before { content: ''; position: absolute; inset: 0; background: radial-gradient(140% 80% at 12% -10%, rgba(255,255,255,.16), transparent 60%); pointer-events: none; }
          .head::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: rgba(0,0,0,.12); }
          .avatar { position: relative; width: 46px; height: 46px; border-radius: 50%; flex: none; overflow: hidden;
            background: #fff; display: grid; place-items: center; font-weight: 700; font-size: 17px; color: var(--ink);
            box-shadow: 0 0 0 2px rgba(255,255,255,.4), 0 4px 10px rgba(0,0,0,.18); }
          /* Logo/icon avatars are usually transparent marks, not photos — contain + padding +
             white backing so they sit clean in the circle instead of cropped or squashed. */
          .avatar img { width: 100%; height: 100%; object-fit: contain; padding: 7px; display: block; }
          .ava-sm img { width: 100%; height: 100%; object-fit: contain; padding: 4px; display: block; }
          .who { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; position: relative; }
          .who .name { font-weight: 700; font-size: 16.5px; letter-spacing: .3px; }
          .who .sub { font-size: 12px; opacity: .92; display: flex; align-items: center; gap: 6px; margin-top: 2px; letter-spacing: .2px; }
          .dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
            box-shadow: 0 0 0 2px rgba(74,222,128,.28), 0 0 8px rgba(74,222,128,.8); animation: cw-pulse 2.4s ease-in-out infinite; }
          @keyframes cw-pulse { 0%,100% { box-shadow: 0 0 0 2px rgba(74,222,128,.28), 0 0 6px rgba(74,222,128,.55); } 50% { box-shadow: 0 0 0 3px rgba(74,222,128,.18), 0 0 11px rgba(74,222,128,.95); } }
          .x { position: relative; margin-left: auto; align-self: flex-start; background: none; border: none; color: #fff;
            opacity: .82; cursor: pointer; padding: 4px; display: grid; place-items: center; border-radius: 9px;
            transition: opacity .15s ease, background .15s ease; }
          .x:hover { opacity: 1; background: rgba(255,255,255,.16); }

          .log { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px 16px;
            background: linear-gradient(180deg, #fafafb 0%, #f5f6f8 100%); display: flex; flex-direction: column; gap: 12px; }
          .log::-webkit-scrollbar { width: 8px; }
          .log::-webkit-scrollbar-thumb { background: #d3d8df; border-radius: 5px; border: 2px solid transparent; background-clip: content-box; }
          .log:hover::-webkit-scrollbar-thumb { background: #c2c9d2; background-clip: content-box; }

          .row { display: flex; gap: 8px; align-items: flex-end; max-width: 88%; animation: cw-rise .42s ${SPRING} both; }
          .row.bot { align-self: flex-start; }
          .row.me { align-self: flex-end; flex-direction: row-reverse; }
          .ava-sm { width: 28px; height: 28px; border-radius: 50%; flex: none; overflow: hidden; background: var(--accent);
            color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 600; box-shadow: 0 1px 3px rgba(15,23,42,.18); }
          .bubble { padding: 11px 15px; font-size: 14px; line-height: 1.5; letter-spacing: .1px; white-space: pre-wrap; word-wrap: break-word; }
          .bot .bubble { background: #fff; color: var(--ink); border: 1px solid rgba(15,23,42,.06); border-radius: 18px 18px 18px 5px;
            box-shadow: 0 1px 2px rgba(15,23,42,.05), 0 4px 12px rgba(15,23,42,.04); }
          .me .bubble { background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 92%, #fff) 0%, var(--accent) 100%);
            color: #fff; border-radius: 18px 18px 5px 18px; box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 38%, transparent); }
          @keyframes cw-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

          .chips { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 4px 0 2px 36px; animation: cw-rise .46s ${SPRING} .08s both; }
          .chip { background: #fff; border: 1.5px solid color-mix(in srgb, var(--accent) 65%, #fff); color: var(--ink); border-radius: 20px;
            padding: 9px 15px; font-size: 13px; font-weight: 500; letter-spacing: .1px; cursor: pointer; text-align: left;
            box-shadow: 0 1px 2px rgba(15,23,42,.05);
            transition: background .16s ease, color .16s ease, transform .16s ${SPRING}, box-shadow .16s ease, border-color .16s ease; }
          .chip:hover { background: var(--accent); border-color: var(--accent); color: #fff; transform: translateY(-1px); box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 36%, transparent); }
          .chip:active { transform: translateY(0); }

          .typing { display: flex; gap: 4px; padding: 13px 15px; background: #fff; border: 1px solid rgba(15,23,42,.06); border-radius: 18px 18px 18px 5px; width: max-content; box-shadow: 0 1px 2px rgba(15,23,42,.05); }
          .typing span { width: 7px; height: 7px; border-radius: 50%; background: #b7c0cc; animation: cw-blink 1.3s infinite both; }
          .typing span:nth-child(2) { animation-delay: .2s; }
          .typing span:nth-child(3) { animation-delay: .4s; }
          @keyframes cw-blink { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

          .foot { display: flex; align-items: center; gap: 9px; padding: 13px 14px; border-top: 1px solid rgba(15,23,42,.07); background: #fff; }
          .foot input { flex: 1; border: 1px solid #dfe3ea; border-radius: 24px; padding: 12px 17px; font-size: 14px; letter-spacing: .1px;
            color: var(--ink); background: #fafbfc; outline: none; transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; }
          .foot input::placeholder { color: #9aa3b0; }
          .foot input:focus { border-color: var(--accent); background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent); }
          .foot button { flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
            background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 90%, #fff) 0%, var(--accent) 100%); color: #fff; display: grid; place-items: center;
            box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 36%, transparent); transition: filter .15s ease, transform .15s ${SPRING}, box-shadow .15s ease; }
          .foot button:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 5px 14px color-mix(in srgb, var(--accent) 44%, transparent); }
          .foot button:active { transform: translateY(0) scale(.92); }
          .foot button:disabled { opacity: .45; cursor: default; transform: none; box-shadow: none; }
          .credit { text-align: center; font-size: 10.5px; color: #9aa3b0; padding: 0 0 10px; background: #fff; letter-spacing: .35px; font-weight: 500; }

          /* Accessibility: honour reduced-motion — curb transitions/animations, keep UI usable. */
          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
            .launcher.nudge { animation: none; } .launcher.nudge::after { display: none; } .dot { animation: none; }
          }
        </style>

        <button class="launcher" aria-label="Open chat">${ICON_CHAT}</button>
        <div class="teaser" role="button" tabindex="0" aria-label="Open chat">
          ${this.avatarHTML("ava-sm")}
          <span class="teaser-txt"></span>
          <button class="teaser-x" aria-label="Dismiss">&times;</button>
        </div>
        <div class="panel" role="dialog" aria-label="Chat">
          <div class="head">
            ${this.avatarHTML("avatar")}
            <div class="who">
              <span class="name">${this.agent}</span>
              <span class="sub"><span class="dot"></span>${this.tagline}</span>
            </div>
            <button class="x" aria-label="Close chat">${ICON_CLOSE}</button>
          </div>
          <div class="log"></div>
          <div class="foot">
            <input type="text" placeholder="${this.placeholder}" />
            <button class="send" aria-label="Send">${ICON_SEND}</button>
          </div>
          <div class="credit">AI assistant · replies may need confirming</div>
        </div>`;

      this.$launcher = root.querySelector(".launcher");
      this.$panel = root.querySelector(".panel");
      this.$log = root.querySelector(".log");
      this.$input = root.querySelector("input");
      this.$send = root.querySelector(".send");
      this.$x = root.querySelector(".x");
      this.$teaser = root.querySelector(".teaser");
      this.$teaserX = root.querySelector(".teaser-x");
      this.$teaser.querySelector(".teaser-txt").textContent = this.teaser;

      this.$launcher.addEventListener("click", () => this.toggle());
      this.$x.addEventListener("click", () => this.toggle());
      this.$send.addEventListener("click", () => this.send());
      this.$input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.send(); });

      // Clicking the teaser body opens the chat (same as the launcher); the × just dismisses it.
      this.$teaser.addEventListener("click", (e) => {
        if (e.target === this.$teaserX) return;
        if (!this.open) this.toggle();
      });
      this.$teaser.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!this.open) this.toggle(); }
      });
      this.$teaserX.addEventListener("click", (e) => { e.stopPropagation(); this.hideTeaser(true); });

      // Reading/about-to-click — don't yank it away. Pausing on hover/focus is enough; we
      // deliberately don't restart on leave (once they've engaged, just let it sit there).
      this.$teaser.addEventListener("mouseenter", () => this.clearAutoClose());
      this.$teaser.addEventListener("focusin", () => this.clearAutoClose());
    }

    clearAutoClose() {
      if (this._autoCloseTimer) { clearTimeout(this._autoCloseTimer); this._autoCloseTimer = null; }
    }
    hideTeaser(remember) {
      this.clearAutoClose();
      this.$teaser.classList.remove("show"); // animates OUT via the same transition as the × dismiss
      this.$launcher.classList.remove("nudge");
      if (remember) this.markTeaserDismissed();
    }
    maybeShowTeaser() {
      if (this.open || this.teaserDismissed() || !this.teaser) return;
      // small delay so it animates IN and catches the eye — not jarring on instant load
      setTimeout(() => {
        if (this.open || this.teaserDismissed()) return;
        this.$teaser.classList.add("show");
        this.$launcher.classList.add("nudge"); // one-time gentle bounce + halo
        // Catch the eye, then tuck away. Auto-close does NOT remember — a timeout just means
        // "didn't engage yet", so it can nudge again next page load this session.
        if (this.teaserTimeout > 0) {
          this._autoCloseTimer = setTimeout(() => this.hideTeaser(false), this.teaserTimeout);
        }
      }, 2000);
    }

    toggle() {
      this.open = !this.open;
      if (this.open) this.hideTeaser(true); // opening chat dismisses the teaser for the session
      this.$panel.classList.toggle("open", this.open);
      this.$launcher.innerHTML = this.open ? ICON_CLOSE : ICON_CHAT;
      if (this.open && !this.greeted) {
        this.greeted = true;
        this.add("bot", this.greeting);
        this.renderChips();
      }
      if (this.open) setTimeout(() => this.$input.focus(), 60);
    }

    renderChips() {
      if (!this.prompts.length) return;
      const wrap = document.createElement("div");
      wrap.className = "chips";
      this.prompts.forEach(p => {
        const b = document.createElement("button");
        b.className = "chip"; b.textContent = p;
        b.addEventListener("click", () => this.send(p));
        wrap.appendChild(b);
      });
      this.$log.appendChild(wrap);
      this._chips = wrap;
      this.$log.scrollTop = this.$log.scrollHeight;
    }

    _removeChips() { if (this._chips) { this._chips.remove(); this._chips = null; } }

    add(who, text) {
      const row = document.createElement("div");
      row.className = "row " + (who === "me" ? "me" : "bot");
      if (who === "bot") {
        const wrap = document.createElement("template");
        wrap.innerHTML = this.avatarHTML("ava-sm");
        row.appendChild(wrap.content.firstChild);
      }
      const b = document.createElement("div");
      b.className = "bubble"; b.textContent = text;
      row.appendChild(b);
      // Tiny stagger so the avatar/bubble settle in together rather than snap.
      row.style.animationDelay = (who === "bot" ? "60ms" : "0ms");
      this.$log.appendChild(row);
      this.$log.scrollTop = this.$log.scrollHeight;
    }

    async send(forced) {
      const text = (forced != null ? forced : this.$input.value).trim();
      if (!text) return;
      if (forced == null) this.$input.value = "";
      this._removeChips();
      this.add("me", text);
      this.$send.disabled = true;

      const typing = document.createElement("div");
      typing.className = "row bot";
      typing.innerHTML = `${this.avatarHTML("ava-sm")}<div class="typing"><span></span><span></span><span></span></div>`;
      this.$log.appendChild(typing);
      this.$log.scrollTop = this.$log.scrollHeight;

      try {
        const res = await fetch(this.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, threadId: this.threadId }),
        });
        const data = await res.json();
        this.threadId = data.threadId || this.threadId;
        typing.remove();
        this.add("bot", data.message || "Sorry — I didn't catch that. Try again?");
      } catch (e) {
        typing.remove();
        this.add("bot", "Sorry, something went wrong. Please try again or give us a call.");
      } finally {
        this.$send.disabled = false;
        this.$input.focus();
      }
    }
  }

  if (!customElements.get("chat-widget")) customElements.define("chat-widget", ChatWidget);
})();
