from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import system, docker, bookmarks, notes, network
from routers import calendar_router, tasks, projects
from routers import claude_usage
from routers import roadmap

app = FastAPI(title="GhostGrid", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(docker.router, prefix="/api/docker", tags=["docker"])
app.include_router(bookmarks.router, prefix="/api/bookmarks", tags=["bookmarks"])
app.include_router(notes.router, prefix="/api/notes", tags=["notes"])
app.include_router(network.router, prefix="/api/network", tags=["network"])
app.include_router(calendar_router.router, prefix="/api/calendar", tags=["calendar"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(claude_usage.router, prefix="/api/claude-usage", tags=["claude-usage"])
app.include_router(roadmap.router, prefix="/api/roadmap", tags=["roadmap"])


@app.get("/api/health")
def health():
    return {"status": "ok", "agent": "Ghost"}
