/*
 * Website lead-capture chat widget — self-contained, zero dependencies.
 * Intercom-style: gradient header, status line, tappable suggested questions.
 *
 * Attributes:
 *   url        (required) backend /chat endpoint
 *   agent      assistant name shown in the header
 *   business   business name (header subtitle)
 *   avatar     image URL for the assistant (falls back to a monogram)
 *   greeting   first message shown
 *   prompts    suggested questions, separated by | (tappable chips)
 *   tagline    header status line (default "Typically replies instantly")
 *   accent     brand colour for buttons/bubbles (default #ed5521)
 *   header     header colour start (defaults to accent)
 *   header2    header gradient end (defaults to accent)
 *   placeholder input placeholder
 */
(function () {
  const ICON_CHAT = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const ICON_SEND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  class ChatWidget extends HTMLElement {
    connectedCallback() {
      this.url = this.getAttribute("url");
      this.agent = this.getAttribute("agent") || "Assistant";
      this.business = this.getAttribute("business") || this.getAttribute("title") || "";
      this.avatar = this.getAttribute("avatar") || "";
      this.greeting = this.getAttribute("greeting") ||
        "Hi 👋 — got a question or after a quote? I can help.";
      this.prompts = (this.getAttribute("prompts") || "").split("|").map(s => s.trim()).filter(Boolean);
      this.tagline = this.getAttribute("tagline") || "Typically replies instantly";
      this.accent = this.getAttribute("accent") || "#ed5521";
      this.header = this.getAttribute("header") || this.accent;
      this.header2 = this.getAttribute("header2") || this.accent;
      this.placeholder = this.getAttribute("placeholder") || "Write a message…";
      this.initial = (this.agent.trim()[0] || "•").toUpperCase();
      this.threadId = null;
      this.open = false;
      this.greeted = false;
      this.render();
    }

    avatarHTML(cls) {
      if (this.avatar) {
        return `<span class="${cls}"><img src="${this.avatar}" alt="${this.agent}" onerror="this.parentNode.textContent='${this.initial}'"/></span>`;
      }
      return `<span class="${cls}">${this.initial}</span>`;
    }

    render() {
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>
          :host { --accent: ${this.accent}; --header: ${this.header}; --header2: ${this.header2}; all: initial; }
          *, *::before, *::after { box-sizing: border-box;
            font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

          .launcher {
            position: fixed; bottom: 24px; right: 24px; z-index: 2147483000;
            width: 58px; height: 58px; border-radius: 50%; border: none; cursor: pointer;
            background: var(--accent); color: #fff; display: grid; place-items: center;
            box-shadow: 0 6px 18px rgba(15,23,42,.28), 0 2px 6px rgba(15,23,42,.18);
            transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease;
          }
          .launcher:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 10px 26px rgba(15,23,42,.32); }
          .launcher:active { transform: scale(.96); }

          .panel {
            position: fixed; bottom: 94px; right: 24px; z-index: 2147483000;
            width: 384px; max-width: calc(100vw - 32px);
            height: 588px; max-height: calc(100vh - 132px);
            display: flex; flex-direction: column; overflow: hidden;
            background: #fff; border-radius: 20px;
            box-shadow: 0 20px 54px rgba(15,23,42,.26), 0 4px 14px rgba(15,23,42,.12);
            opacity: 0; transform: translateY(16px) scale(.98); pointer-events: none;
            transition: opacity .24s ease, transform .24s cubic-bezier(.34,1.2,.64,1);
          }
          .panel.open { opacity: 1; transform: none; pointer-events: auto; }

          .head { background: linear-gradient(135deg, var(--header) 0%, var(--header2) 100%);
            color: #fff; padding: 20px 20px 22px; display: flex; align-items: center; gap: 13px; }
          .avatar { width: 44px; height: 44px; border-radius: 50%; flex: none; overflow: hidden;
            background: rgba(255,255,255,.18); display: grid; place-items: center; font-weight: 600; font-size: 17px;
            box-shadow: 0 0 0 2px rgba(255,255,255,.25); }
          .avatar img, .ava-sm img { width: 100%; height: 100%; object-fit: cover; display: block; }
          .who { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
          .who .name { font-weight: 700; font-size: 17px; letter-spacing: .1px; }
          .who .sub { font-size: 12.5px; opacity: .9; display: flex; align-items: center; gap: 6px; margin-top: 1px; }
          .dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 0 2px rgba(74,222,128,.3); }
          .x { margin-left: auto; align-self: flex-start; background: none; border: none; color: #fff; opacity: .85; cursor: pointer; padding: 4px; display: grid; place-items: center; border-radius: 8px; }
          .x:hover { opacity: 1; background: rgba(255,255,255,.14); }

          .log { flex: 1; overflow-y: auto; padding: 18px 16px; background: #f6f7f9; display: flex; flex-direction: column; gap: 12px; }
          .log::-webkit-scrollbar { width: 7px; }
          .log::-webkit-scrollbar-thumb { background: #d5d9e0; border-radius: 4px; }

          .row { display: flex; gap: 8px; align-items: flex-end; max-width: 88%; animation: rise .26s ease both; }
          .row.bot { align-self: flex-start; }
          .row.me { align-self: flex-end; flex-direction: row-reverse; }
          .ava-sm { width: 28px; height: 28px; border-radius: 50%; flex: none; overflow: hidden; background: var(--accent);
            color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 600; }
          .bubble { padding: 11px 14px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }
          .bot .bubble { background: #fff; color: #1c2430; border: 1px solid #e9ecf1; border-radius: 16px 16px 16px 4px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
          .me .bubble { background: var(--accent); color: #fff; border-radius: 16px 16px 4px 16px; }
          @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

          .chips { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin: 2px 0 2px 36px; animation: rise .3s ease both; }
          .chip { background: #fff; border: 1.5px solid var(--accent); color: #1c2430; border-radius: 18px;
            padding: 9px 14px; font-size: 13px; cursor: pointer; text-align: left; transition: background .14s ease, color .14s ease; }
          .chip:hover { background: var(--accent); color: #fff; }

          .typing { display: flex; gap: 4px; padding: 13px 14px; background: #fff; border: 1px solid #e9ecf1; border-radius: 16px 16px 16px 4px; width: max-content; }
          .typing span { width: 7px; height: 7px; border-radius: 50%; background: #b7c0cc; animation: blink 1.3s infinite both; }
          .typing span:nth-child(2) { animation-delay: .2s; }
          .typing span:nth-child(3) { animation-delay: .4s; }
          @keyframes blink { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

          .foot { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-top: 1px solid #eceef2; background: #fff; }
          .foot input { flex: 1; border: 1px solid #dde1e8; border-radius: 22px; padding: 12px 16px; font-size: 14px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
          .foot input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
          .foot button { flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
            background: var(--accent); color: #fff; display: grid; place-items: center; transition: filter .15s ease, transform .12s ease; }
          .foot button:hover { filter: brightness(1.08); }
          .foot button:active { transform: scale(.92); }
          .foot button:disabled { opacity: .45; cursor: default; }
          .credit { text-align: center; font-size: 10.5px; color: #aab2bd; padding: 0 0 9px; background: #fff; letter-spacing: .2px; }
        </style>

        <button class="launcher" aria-label="Open chat">${ICON_CHAT}</button>
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

      this.$launcher.addEventListener("click", () => this.toggle());
      this.$x.addEventListener("click", () => this.toggle());
      this.$send.addEventListener("click", () => this.send());
      this.$input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.send(); });
    }

    toggle() {
      this.open = !this.open;
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
