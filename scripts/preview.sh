#!/bin/sh
# Local/preview server for LendSure: FastAPI serves API + built frontend.
# Freebuff injects PORT; bind 0.0.0.0 so the container is reachable.
cd "$(dirname "$0")/../backend" || exit 1
exec python3 -m uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}"
