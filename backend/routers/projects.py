import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from data_dir import DATA_DIR

router = APIRouter()

PROJECTS_FILE = DATA_DIR / "projects.json"
TASKS_FILE    = DATA_DIR / "tasks.json"


def _load_projects() -> list[dict]:
    if not PROJECTS_FILE.exists():
        return []
    return json.loads(PROJECTS_FILE.read_text())


def _save_projects(data: list[dict]):
    PROJECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROJECTS_FILE.write_text(json.dumps(data, indent=2))


def _load_tasks() -> list[dict]:
    if not TASKS_FILE.exists():
        return []
    return json.loads(TASKS_FILE.read_text())


def _save_tasks(data: list[dict]):
    TASKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    TASKS_FILE.write_text(json.dumps(data, indent=2))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProjectIn(BaseModel):
    name: str
    description: str = ""
    color: str = "#7aa2f7"


class ProjectPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    archived: Optional[bool] = None


@router.get("/")
def list_projects(include_archived: bool = Query(False)):
    projects = _load_projects()
    if not include_archived:
        projects = [p for p in projects if not p.get("archived", False)]
    return projects


@router.post("/", status_code=201)
def create_project(body: ProjectIn):
    projects = _load_projects()
    project = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "description": body.description,
        "color": body.color,
        "archived": False,
        "created_at": _now(),
    }
    projects.append(project)
    _save_projects(projects)
    return project


@router.get("/{project_id}")
def get_project(project_id: str):
    for p in _load_projects():
        if p["id"] == project_id:
            return p
    raise HTTPException(status_code=404, detail="Project not found")


@router.patch("/{project_id}")
def update_project(project_id: str, body: ProjectPatch):
    projects = _load_projects()
    for p in projects:
        if p["id"] == project_id:
            p.update(body.model_dump(exclude_unset=True))
            _save_projects(projects)
            return p
    raise HTTPException(status_code=404, detail="Project not found")


@router.delete("/{project_id}")
def delete_project(project_id: str):
    projects = _load_projects()
    new_projects = [p for p in projects if p["id"] != project_id]
    if len(new_projects) == len(projects):
        raise HTTPException(status_code=404, detail="Project not found")
    _save_projects(new_projects)

    # Orphan tasks back to Inbox — do NOT cascade delete
    tasks = _load_tasks()
    changed = False
    for t in tasks:
        if t.get("project_id") == project_id:
            t["project_id"] = None
            changed = True
    if changed:
        _save_tasks(tasks)

    return {"ok": True}
