import json
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

DATA_FILE = Path(__file__).parent.parent / "data" / "journal.json"

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _load() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text())


def _save(data: list[dict]):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_date(date: str):
    if not DATE_RE.match(date):
        raise HTTPException(status_code=422, detail="Date must be YYYY-MM-DD.")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid calendar date.")


class JournalEntryIn(BaseModel):
    body: str


@router.get("/")
def list_entries():
    items = _load()
    return sorted(items, key=lambda e: e["date"], reverse=True)


@router.get("/{date}")
def get_entry(date: str):
    _validate_date(date)
    for item in _load():
        if item["date"] == date:
            return item
    raise HTTPException(status_code=404, detail="Journal entry not found")


@router.put("/{date}")
def upsert_entry(date: str, entry: JournalEntryIn):
    _validate_date(date)
    items = _load()
    for item in items:
        if item["date"] == date:
            item["body"] = entry.body
            item["updated_at"] = _now()
            _save(items)
            return item

    new_entry = {
        "date": date,
        "body": entry.body,
        "created_at": _now(),
        "updated_at": _now(),
    }
    items.append(new_entry)
    _save(items)
    return new_entry


@router.delete("/{date}", status_code=204)
def delete_entry(date: str):
    _validate_date(date)
    items = _load()
    new_items = [i for i in items if i["date"] != date]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="Journal entry not found")
    _save(new_items)
