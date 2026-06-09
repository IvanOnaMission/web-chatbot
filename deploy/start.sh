#!/usr/bin/env bash
# Start the chatbot backend (production — no --reload). Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
