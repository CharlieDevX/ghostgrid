import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

DATA_FILE = Path(__file__).parent.parent / "data" / "bookmarks.json"


def _load() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text())


def _save(data: list[dict]):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2))


class Bookmark(BaseModel):
    name: str
    url: str
    category: Optional[str] = "general"
    icon: Optional[str] = None


@router.get("/")
def list_bookmarks():
    return _load()


@router.post("/", status_code=201)
def add_bookmark(bookmark: Bookmark):
    items = _load()
    entry = {"id": len(items) + 1, **bookmark.model_dump()}
    items.append(entry)
    _save(items)
    return entry


@router.delete("/{bookmark_id}")
def delete_bookmark(bookmark_id: int):
    items = _load()
    new_items = [b for b in items if b.get("id") != bookmark_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="Bookmark not found")
    _save(new_items)
    return {"ok": True}
