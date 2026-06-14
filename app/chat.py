"""The Claude call + the lead-capture tool loop."""
import anthropic

from . import capture, config
from .brain import system_prompt

client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

CAPTURE_TOOL = {
    "name": "capture_lead",
    "description": (
        "Save a lead so the owner can follow up. Call this ONLY once you have at "
        "least the person's name, phone number, and a short description of the job "
        "they want done. The other fields (email, suburb, urgency, contact preference) "
        "are nice-to-haves — include them if you have them, but NEVER hold back the "
        "lead waiting on them. Do not call it for vague browsing."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "The caller's name"},
            "phone": {"type": "string", "description": "Best contact number"},
            "job": {"type": "string", "description": "Short description of the work they need"},
            "email": {"type": "string", "description": "Email for the quote, if they give one (optional)"},
            "suburb": {"type": "string", "description": "Their suburb / area / address, if given (optional)"},
            "urgency": {"type": "string", "description": "How soon they need it — emergency, this week, or just pricing (optional)"},
            "contact_pref": {"type": "string", "description": "Preferred contact: call or text, if mentioned (optional)"},
        },
        "required": ["name", "phone", "job"],
    },
}


# Keep cost bounded on long chats: only the most recent turns are sent each time.
# (The system prompt + knowledge is cached separately — see cache_control below.)
MAX_HISTORY = 20


def _trim(messages: list) -> list:
    """Cap history length; never start mid tool_use/tool_result exchange."""
    if len(messages) <= MAX_HISTORY:
        return messages
    msgs = messages[-MAX_HISTORY:]
    # drop leading messages until a clean user text turn (avoid orphaned tool_result)
    while msgs and not (
        msgs[0]["role"] == "user"
        and not (isinstance(msgs[0].get("content"), list)
                 and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in msgs[0]["content"]))
    ):
        msgs.pop(0)
    return msgs


def respond(history: list) -> tuple[str, list]:
    """Run one user turn through Claude, handling the capture tool.

    `history` is the full message list (user/assistant turns). Returns the
    assistant's reply text and the updated history to store for the thread.
    """
    messages = _trim(list(history))

    while True:
        resp = client.messages.create(
            model=config.MODEL,
            max_tokens=1024,
            system=[{
                "type": "text",
                "text": system_prompt(),
                "cache_control": {"type": "ephemeral"},  # knowledge is stable → cache it
            }],
            tools=[CAPTURE_TOOL],
            messages=messages,
        )
        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason != "tool_use":
            text = "".join(b.text for b in resp.content if b.type == "text").strip()
            return text, messages

        # Execute any capture_lead calls, feed results back, loop for the final reply.
        tool_results = []
        for block in resp.content:
            if block.type == "tool_use" and block.name == "capture_lead":
                status = capture.notify_lead(block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": f"Lead saved and sent to the owner ({status}).",
                })
        messages.append({"role": "user", "content": tool_results})
