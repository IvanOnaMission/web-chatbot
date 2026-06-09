"""Lead capture: where a captured lead goes (email + optional SMS).

This is the per-client routing layer. Defaults to email via SMTP and, if Twilio is
configured, an SMS to the owner. If nothing is configured it logs the lead so it's
never silently lost. Extend here to push into a job system (Katipult / Fergus / etc.).
"""
import json
import logging
import smtplib
import urllib.request
from email.message import EmailMessage

from . import config

log = logging.getLogger("capture")


def _send_email_resend(subject: str, body: str) -> bool:
    """Send via Resend's HTTP API. Recommended — just an API key, good deliverability."""
    if not (config.RESEND_API_KEY and config.LEAD_EMAIL_TO and config.EMAIL_FROM):
        return False
    payload = json.dumps({
        "from": config.EMAIL_FROM,
        "to": [config.LEAD_EMAIL_TO],
        "subject": subject,
        "text": body,
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {config.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return 200 <= resp.status < 300


def _send_email_smtp(subject: str, body: str) -> bool:
    if not (config.SMTP_HOST and config.LEAD_EMAIL_TO and config.SMTP_FROM):
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = config.SMTP_FROM
    msg["To"] = config.LEAD_EMAIL_TO
    msg.set_content(body)
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as s:
        s.starttls()
        if config.SMTP_USER:
            s.login(config.SMTP_USER, config.SMTP_PASS)
        s.send_message(msg)
    return True


def _send_sms(body: str) -> bool:
    if not (config.TWILIO_ACCOUNT_SID and config.TWILIO_AUTH_TOKEN and config.LEAD_SMS_TO):
        return False
    # Lazy import so Twilio is only needed when SMS is actually configured.
    from twilio.rest import Client  # type: ignore

    client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    client.messages.create(body=body, from_=config.TWILIO_FROM, to=config.LEAD_SMS_TO)
    return True


def notify_lead(lead: dict) -> str:
    """Send the captured lead to the owner. Returns a short status for logging."""
    name = lead.get("name", "(no name)")
    phone = lead.get("phone", "(no phone)")
    job = lead.get("job", "(no description)")
    suburb = lead.get("suburb", "")
    urgency = lead.get("urgency", "")

    subject = f"New website lead — {name} ({phone})"
    body = (
        f"New lead from the {config.BUSINESS_NAME} website chatbot:\n\n"
        f"Name:     {name}\n"
        f"Phone:    {phone}\n"
        f"Job:      {job}\n"
        f"Suburb:   {suburb or '-'}\n"
        f"Urgency:  {urgency or '-'}\n"
    )

    sent = []
    try:
        # Prefer Resend; fall back to SMTP. Either one sending counts as "email".
        if _send_email_resend(subject, body) or _send_email_smtp(subject, body):
            sent.append("email")
    except Exception as e:  # never let a delivery failure break the chat
        log.error("lead email failed: %s", e)
    try:
        if _send_sms(f"{subject}\n{job}"):
            sent.append("sms")
    except Exception as e:
        log.error("lead sms failed: %s", e)

    if not sent:
        log.warning("LEAD (no delivery configured): %s", body)
        return "logged"
    return "+".join(sent)
