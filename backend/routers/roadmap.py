import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from data_dir import DATA_DIR

router = APIRouter()

DATA_FILE = DATA_DIR / "roadmap.json"

VALID_STATUSES = {"Complete", "In progress", "Planned", "Exploratory"}
VALID_PRIORITIES = {"High", "Medium", "Low", "N/A"}


def _load() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text())


def _save(data: list[dict]):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_depends_on(depends_on: list[str], items: list[dict], self_id: str | None = None) -> list[str]:
    """Deduplicate and validate dependency IDs.

    Circular dependency detection is intentionally omitted in v1.
    This is a personal tool — the user is responsible for avoiding cycles.
    """
    # Deduplicate while preserving order
    seen: list[str] = []
    seen_set: set[str] = set()
    for dep_id in depends_on:
        if dep_id not in seen_set:
            seen.append(dep_id)
            seen_set.add(dep_id)

    # Self-dependency check (only relevant on PATCH where self_id is known)
    if self_id and self_id in seen_set:
        raise HTTPException(status_code=422, detail="An item cannot depend on itself.")

    # All IDs must exist in the current data
    item_ids = {item["id"] for item in items}
    for dep_id in seen:
        if dep_id not in item_ids:
            raise HTTPException(status_code=422, detail="depends_on contains one or more invalid item IDs.")

    return seen


class RoadmapItemIn(BaseModel):
    title: str
    section: str
    status: str
    priority: str
    target_date: Optional[str] = None
    notes: Optional[str] = ""
    depends_on: Optional[list[str]] = []


class RoadmapItemPatch(BaseModel):
    title: Optional[str] = None
    section: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    target_date: Optional[str] = None
    notes: Optional[str] = None
    depends_on: Optional[list[str]] = None


@router.get("/")
def list_roadmap():
    return _load()


@router.post("/", status_code=201)
def create_roadmap_item(item: RoadmapItemIn):
    if item.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status. Allowed: {', '.join(sorted(VALID_STATUSES))}")
    if item.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=422, detail=f"Invalid priority. Allowed: {', '.join(sorted(VALID_PRIORITIES))}")

    items = _load()
    depends_on = _validate_depends_on(item.depends_on or [], items)

    entry = {
        "id": str(uuid.uuid4()),
        "title": item.title,
        "section": item.section,
        "status": item.status,
        "priority": item.priority,
        "target_date": item.target_date if item.target_date else None,
        "notes": (item.notes or "").strip(),
        "depends_on": depends_on,
        "created_at": _now(),
    }
    items.append(entry)
    _save(items)
    return entry


@router.get("/{item_id}")
def get_roadmap_item(item_id: str):
    for item in _load():
        if item["id"] == item_id:
            return item
    raise HTTPException(status_code=404, detail="Roadmap item not found")


@router.patch("/{item_id}")
def update_roadmap_item(item_id: str, patch: RoadmapItemPatch):
    items = _load()
    for i, item in enumerate(items):
        if item["id"] != item_id:
            continue

        if patch.status is not None and patch.status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid status. Allowed: {', '.join(sorted(VALID_STATUSES))}")
        if patch.priority is not None and patch.priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=422, detail=f"Invalid priority. Allowed: {', '.join(sorted(VALID_PRIORITIES))}")

        if patch.title is not None:
            item["title"] = patch.title
        if patch.section is not None:
            item["section"] = patch.section
        if patch.status is not None:
            item["status"] = patch.status
        if patch.priority is not None:
            item["priority"] = patch.priority
        # target_date uses model_fields_set so explicit null clears the field
        if "target_date" in patch.model_fields_set:
            item["target_date"] = patch.target_date  # None is a valid value (clears the date)
        if patch.notes is not None:
            item["notes"] = patch.notes.strip()
        if patch.depends_on is not None:
            item["depends_on"] = _validate_depends_on(patch.depends_on, items, item_id)

        items[i] = item
        _save(items)
        return item

    raise HTTPException(status_code=404, detail="Roadmap item not found")


@router.delete("/{item_id}", status_code=204)
def delete_roadmap_item(item_id: str):
    items = _load()
    new_items = [item for item in items if item["id"] != item_id]
    if len(new_items) == len(items):
        raise HTTPException(status_code=404, detail="Roadmap item not found")

    # Remove the deleted item's ID from all depends_on arrays in a single atomic write
    for item in new_items:
        item["depends_on"] = [dep for dep in item.get("depends_on", []) if dep != item_id]

    _save(new_items)
