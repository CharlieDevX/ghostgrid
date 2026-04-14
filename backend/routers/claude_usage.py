import json
import requests
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

CONFIG_FILE = Path(__file__).parent.parent / "data" / "claude_config.json"

_BASE = "https://claude.ai"
_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _cfg() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    return json.loads(CONFIG_FILE.read_text())


def _save_cfg(data: dict):
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(data, indent=2))


def _headers(session_key: str) -> dict:
    return {
        "Cookie": f"sessionKey={session_key}",
        "User-Agent": _UA,
        "Accept": "application/json",
        "Referer": "https://claude.ai/",
    }


class ConnectIn(BaseModel):
    session_key: str


@router.get("/status")
def get_status():
    cfg = _cfg()
    return {"connected": bool(cfg.get("session_key"))}


@router.post("/connect")
def connect(body: ConnectIn):
    key = body.session_key.strip()
    try:
        r = requests.get(f"{_BASE}/api/organizations", headers=_headers(key), timeout=10)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach Claude.ai: {e}")

    if r.status_code in (401, 403):
        raise HTTPException(status_code=401, detail="Invalid or expired session key")
    if not r.ok:
        raise HTTPException(status_code=502, detail=f"Claude.ai returned {r.status_code}")

    orgs = r.json()
    if not orgs:
        raise HTTPException(status_code=400, detail="No organizations found")

    first = orgs[0] if isinstance(orgs, list) else orgs
    org_id = first.get("uuid") or first.get("id")
    if not org_id:
        raise HTTPException(status_code=400, detail="Could not read organization ID")

    _save_cfg({"session_key": key, "org_id": org_id})
    return {"ok": True}


@router.delete("/connect")
def disconnect():
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()
    return {"ok": True}


@router.get("/stats")
def get_stats():
    cfg = _cfg()
    if not cfg.get("session_key"):
        raise HTTPException(status_code=401, detail="Not connected")

    try:
        r = requests.get(
            f"{_BASE}/api/organizations/{cfg['org_id']}/usage",
            headers=_headers(cfg["session_key"]),
            timeout=10,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach Claude.ai: {e}")

    if r.status_code in (401, 403):
        raise HTTPException(status_code=401, detail="Session expired")
    if not r.ok:
        raise HTTPException(status_code=502, detail=f"Claude.ai returned {r.status_code}")

    return r.json()
