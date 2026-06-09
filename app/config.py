"""Runtime config, loaded from environment. Per-client values live in .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = os.environ.get("MODEL", "claude-haiku-4-5")

BUSINESS_NAME = os.environ.get("BUSINESS_NAME", "the business")
OWNER_NAME = os.environ.get("OWNER_NAME", "the owner")
KNOWLEDGE_FILE = os.environ.get("KNOWLEDGE_FILE", "knowledge/leck-electrical.md")

LEAD_EMAIL_TO = os.environ.get("LEAD_EMAIL_TO", "")
LEAD_SMS_TO = os.environ.get("LEAD_SMS_TO", "")

# From address used by whichever email sender is configured.
EMAIL_FROM = os.environ.get("EMAIL_FROM", "")

# Resend (recommended — one API key, no SMTP). https://resend.com
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "") or EMAIL_FROM or SMTP_USER

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM", "")

ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()
]


def knowledge_path() -> Path:
    p = Path(KNOWLEDGE_FILE)
    return p if p.is_absolute() else ROOT / p
