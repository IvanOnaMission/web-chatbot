"""FastAPI app the website widget talks to.

The embedded chat widget POSTs each user message to /chat with a threadId; we keep
the conversation per thread in memory and return the assistant's reply.
"""
import uuid
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import chat, config

app = FastAPI(title="Website Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS or ["*"],
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["*"],
)

# Serve the widget JS from this app too, so the Mac Mini is the single origin for
# both the script and /chat — Jordan only needs one URL.
WIDGET_JS = Path(__file__).resolve().parent.parent / "widget" / "chat-widget.js"


@app.get("/chat-widget.js")
def widget_js() -> FileResponse:
    return FileResponse(WIDGET_JS, media_type="application/javascript")


# Serve images/assets (e.g. the assistant's photo) from the widget folder.
# Drop dan.jpg in widget/ → it's served at /assets/dan.jpg.
app.mount("/assets", StaticFiles(directory=str(WIDGET_JS.parent)), name="assets")


# In-memory conversation store: threadId -> message history. Fine for a single
# long-running process. Capped so it can't grow unbounded over weeks of uptime
# (oldest threads evicted first — chat history is ephemeral, leads are already emailed).
_THREADS: dict[str, list] = {}
_MAX_THREADS = 500


class ChatIn(BaseModel):
    message: str
    threadId: str | None = None


class ChatOut(BaseModel):
    message: str
    threadId: str


@app.get("/health")
def health() -> dict:
    return {"ok": True, "business": config.BUSINESS_NAME, "model": config.MODEL}


@app.post("/chat", response_model=ChatOut)
def chat_endpoint(body: ChatIn) -> ChatOut:
    tid = body.threadId or uuid.uuid4().hex
    history = _THREADS.pop(tid, [])  # pop+reinsert = move to newest (LRU eviction)
    history.append({"role": "user", "content": body.message})

    reply, history = chat.respond(history)

    if len(_THREADS) >= _MAX_THREADS:
        del _THREADS[next(iter(_THREADS))]  # evict oldest
    _THREADS[tid] = history

    return ChatOut(message=reply, threadId=tid)
