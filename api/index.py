"""Freebuff hosting entrypoint — exposes the LendSure FastAPI app.

The hosting builder is Node.js-only; Python handlers in api/*.py are served
natively (Freebuff installs api/requirements.txt itself). All backend code
lives in backend/; we add it to sys.path and re-export the ASGI app.
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.abspath(os.path.join(_HERE, os.pardir, "backend"))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# Keep the live DB off the read-only app dir on hosted platforms.
if not os.environ.get("LENDSURE_DB_PATH"):
    os.environ["LENDSURE_DB_PATH"] = "/tmp/lendsure/lending.db"

from app import app  # noqa: E402  (LendSure ASGI application)

# Mangum-style handler in case the platform expects a function instead of ASGI.
handler = app
