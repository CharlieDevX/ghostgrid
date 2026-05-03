import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from data_dir import DATA_DIR

router = APIRouter()

DATA_FILE = DATA_DIR / "tasks.json"


def _load() -> list[dict]:
    if not DATA_FILE.exists():
        return []
    return json.loads(DATA_FILE.read_text())


def _save(data: list[dict]):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskIn(BaseModel):
    title: str
    notes: str = ""
    category: str = ""
    due_date: Optional[str] = None
    priority: Optional[str] = None   # "low" | "medium" | "high" | None
    project_id: Optional[str] = None
    calendar_event_uid: Optional[str] = None
    tags: list[str] = []


class TaskPatch(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    due_date: Optional[str] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    project_id: Optional[str] = None
    calendar_event_uid: Optional[str] = None
    tags: Optional[list[str]] = None


@router.get("/")
def list_tasks(
    project_id: Optional[str] = Query(None),
    completed: Optional[bool] = Query(None),
    priority: Optional[str] = Query(None),
):
    tasks = _load()

    if project_id is not None:
        if project_id == "inbox":
            tasks = [t for t in tasks if not t.get("project_id")]
        else:
            tasks = [t for t in tasks if t.get("project_id") == project_id]

    if completed is not None:
        tasks = [t for t in tasks if bool(t.get("completed")) == completed]

    if priority is not None:
        tasks = [t for t in tasks if t.get("priority") == priority]

    return tasks


@router.post("/", status_code=201)
def create_task(body: TaskIn):
    tasks = _load()
    task = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "notes": body.notes,
        "category": body.category,
        "due_date": body.due_date,
        "completed": False,
        "completed_at": None,
        "created_at": _now(),
        "priority": body.priority,
        "tags": body.tags,
        "project_id": body.project_id,
        "calendar_event_uid": body.calendar_event_uid,
    }
    tasks.append(task)
    _save(tasks)
    return task


@router.get("/{task_id}")
def get_task(task_id: str):
    for t in _load():
        if t["id"] == task_id:
            return t
    raise HTTPException(status_code=404, detail="Task not found")


@router.patch("/{task_id}")
def update_task(task_id: str, body: TaskPatch):
    tasks = _load()
    for t in tasks:
        if t["id"] == task_id:
            data = body.model_dump(exclude_unset=True)
            # Handle completed_at timestamp logic
            if "completed" in data:
                if data["completed"] and not t.get("completed"):
                    data["completed_at"] = _now()
                elif not data["completed"]:
                    data["completed_at"] = None
            t.update(data)
            _save(tasks)
            return t
    raise HTTPException(status_code=404, detail="Task not found")


@router.delete("/{task_id}")
def delete_task(task_id: str):
    tasks = _load()
    new_tasks = [t for t in tasks if t["id"] != task_id]
    if len(new_tasks) == len(tasks):
        raise HTTPException(status_code=404, detail="Task not found")
    _save(new_tasks)
    return {"ok": True}


@router.post("/{task_id}/toggle")
def toggle_task(task_id: str):
    tasks = _load()
    for t in tasks:
        if t["id"] == task_id:
            t["completed"] = not t.get("completed", False)
            t["completed_at"] = _now() if t["completed"] else None
            _save(tasks)
            return t
    raise HTTPException(status_code=404, detail="Task not found")
