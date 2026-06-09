/*
 * Website lead-capture chat widget — self-contained, zero dependencies.
 * Drop one <script> tag + one <chat-widget> element on any site (see embed-snippet.html).
 * Talks to our /chat backend; renders a floating bubble. Ours end-to-end — nothing pulled.
 *
 * Attributes on <chat-widget>:
 *   url               (required) backend /chat endpoint
 *   greeting          first message the bot shows
 *   title             header text (e.g. "Leck Electrical")
 *   accent            accent colour (default #1f6feb)
 *   placeholder       input placeholder
 */
(function () {
  class ChatWidget extends HTMLElement {
    connectedCallback() {
      this.url = this.getAttribute("url");
      this.greeting = this.getAttribute("greeting") ||
        "Hi 👋 — got a question or after a quote? I can help.";
      this.title = this.getAttribute("title") || "Chat";
      this.accent = this.getAttribute("accent") || "#1f6feb";
      this.placeholder = this.getAttribute("placeholder") || "Type your message…";
      this.threadId = null;
      this.open = false;
      this.render();
    }

    render() {
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>
          :host { all: initial; }
          * { box-sizing: border-box; font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; }
          .bubble {
            position: fixed; bottom: 20px; right: 20px; z-index: 2147483000;
            width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
            background: ${this.accent}; color: #fff; font-size: 26px; box-shadow: 0 4px 16px rgba(0,0,0,.25);
          }
          .panel {
            position: fixed; bottom: 90px; right: 20px; z-index: 2147483000;
            width: 360px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 130px);
            display: none; flex-direction: column; background: #fff; border-radius: 14px; overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,.28);
          }
          .panel.open { display: flex; }
          .head { background: ${this.accent}; color: #fff; padding: 14px 16px; font-weight: 600; }
          .log { flex: 1; overflow-y: auto; padding: 14px; background: #f6f7f9; }
          .msg { margin: 8px 0; max-width: 82%; padding: 9px 12px; border-radius: 12px; line-height: 1.35; font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
          .bot { background: #fff; border: 1px solid #e6e8eb; color: #1a1a1a; }
          .me { background: ${this.accent}; color: #fff; margin-left: auto; }
          .typing { color: #888; font-size: 13px; padding: 4px 12px; }
          .foot { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; }
          .foot input { flex: 1; border: 1px solid #d6d9dd; border-radius: 10px; padding: 10px 12px; font-size: 14px; }
          .foot button { border: none; background: ${this.accent}; color: #fff; border-radius: 10px; padding: 0 16px; cursor: pointer; font-size: 14px; }
          .foot button:disabled { opacity: .5; cursor: default; }
        </style>
        <button class="bubble" aria-label="Open chat">💬</button>
        <div class="panel">
          <div class="head">${this.title}</div>
          <div class="log"></div>
          <div class="foot">
            <input type="text" placeholder="${this.placeholder}" />
            <button>Send</button>
          </div>
        </div>`;

      this.$bubble = root.querySelector(".bubble");
      this.$panel = root.querySelector(".panel");
      this.$log = root.querySelector(".log");
      this.$input = root.querySelector("input");
      this.$send = root.querySelector(".foot button");

      this.$bubble.addEventListener("click", () => this.toggle());
      this.$send.addEventListener("click", () => this.send());
      this.$input.addEventListener("keydown", (e) => { if (e.key === "Enter") this.send(); });
    }

    toggle() {
      this.open = !this.open;
      this.$panel.classList.toggle("open", this.open);
      if (this.open && !this.$log.childElementCount) this.add("bot", this.greeting);
      if (this.open) this.$input.focus();
    }

    add(who, text) {
      const el = document.createElement("div");
      el.className = "msg " + (who === "me" ? "me" : "bot");
      el.textContent = text;
      this.$log.appendChild(el);
      this.$log.scrollTop = this.$log.scrollHeight;
      return el;
    }

    async send() {
      const text = this.$input.value.trim();
      if (!text) return;
      this.$input.value = "";
      this.add("me", text);
      this.$send.disabled = true;
      const typing = document.createElement("div");
      typing.className = "typing"; typing.textContent = "…";
      this.$log.appendChild(typing); this.$log.scrollTop = this.$log.scrollHeight;

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
        this.add("bot", "Sorry, something went wrong. Please try again or call us.");
      } finally {
        this.$send.disabled = false;
        this.$input.focus();
      }
    }
  }

  if (!customElements.get("chat-widget")) customElements.define("chat-widget", ChatWidget);
})();
