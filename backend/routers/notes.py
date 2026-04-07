import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

DATA_FILE = Path(__file__).parent.parent / "data" / "notes.json"


def _load() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text())


def _save(data: list[dict]):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class NoteIn(BaseModel):
    title: str
    body: str


@router.get("/")
def list_notes():
    return _load()


@router.post("/", status_code=201)
def create_note(note: NoteIn):
    items = _load()
    entry = {
        "id": len(items) + 1,
        "title": note.title,
        "body": note.body,
        "created_at": _now(),
        "updated_at": _now(),
    }
    items.append(entry)
    _save(items)
    return entry


@router.put("/{note_id}")
def update_note(note_id: int, note: NoteIn):
    items = _load()
    for item in items:
        if item["id"] == note_id:
            item["title"] = note.title
            item["body"] = note.body
            item["updated_at"] = _now()
            _save(items)
            return item
    raise HTTPException(status_code=404, detail="Note not found")


@router.delete("/{note_id}")
def delete_note(note_id: int):
    items = _load()
    new_items = [n for n in items if n["id"] != note_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="Note not found")
    _save(new_items)
    return {"ok": True}
