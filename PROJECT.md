# GhostGrid — Project Context

GhostGrid is a personal homelab dashboard built with FastAPI + React. It runs locally (no auth, no cloud deployment) and aggregates system stats, Docker status, notes, bookmarks, a calendar synced to iCloud, and a task management system.

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3, FastAPI, uvicorn |
| Storage | Flat JSON files in `backend/data/` (no database) |
| Calendar sync | `python-caldav` → iCloud CalDAV |
| Frontend | React 18, Vite, React Router v6 |
| Styling | Inline styles only — Tokyo Night dark theme (see `APPEARANCE.md`) |
| Auth | None — local network only |

---

## Project Structure

```
ghostgrid/
├── backend/
│   ├── main.py                    # FastAPI app; mounts all routers under /api
│   ├── .env                       # ICLOUD_USERNAME, ICLOUD_APP_PASSWORD
│   ├── data/                      # Flat JSON stores
│   │   ├── notes.json
│   │   ├── bookmarks.json
│   │   ├── tasks.json
│   │   ├── projects.json
│   │   └── calendar_colors.json   # Per-calendar color + description overrides
│   └── routers/
│       ├── system.py              # GET /api/system — CPU, RAM, disk stats
│       ├── docker.py              # GET /api/docker — container status
│       ├── network.py             # GET /api/network — interface info
│       ├── notes.py               # CRUD /api/notes
│       ├── bookmarks.py           # CRUD /api/bookmarks
│       ├── tasks.py               # CRUD /api/tasks — full task management
│       ├── projects.py            # CRUD /api/projects — project grouping
│       └── calendar_router.py     # /api/calendar — iCloud CalDAV + task events
│
├── frontend/src/
│   ├── index.css                  # CSS custom properties (theme tokens)
│   ├── main.jsx                   # ReactDOM.createRoot, BrowserRouter
│   ├── components/
│   │   ├── App.jsx                # Routes: / → Home, /calendar → CalendarPage, /tasks → TasksPage
│   │   ├── Layout.jsx             # Fixed sidebar (210px) + <main> content area
│   │   ├── SystemStats.jsx
│   │   ├── DockerWidget.jsx
│   │   ├── NetworkWidget.jsx
│   │   ├── NotesWidget.jsx
│   │   └── BookmarksWidget.jsx
│   └── pages/
│       ├── Home.jsx               # Dashboard: grid of widgets
│       ├── CalendarPage.jsx       # Full-screen calendar — Month/Week/Day views
│       └── TasksPage.jsx          # Full-screen task manager — two-panel layout
│
├── APPEARANCE.md                  # Color palette + typography rules
└── PROJECT.md                     # This file
```

---

## Existing Features

| Feature | Backend endpoint | Frontend |
|---------|-----------------|----------|
| System stats | `GET /api/system` | `SystemStats.jsx` widget |
| Docker status | `GET /api/docker` | `DockerWidget.jsx` widget |
| Network info | `GET /api/network` | `NetworkWidget.jsx` widget |
| Notes (CRUD) | `/api/notes` | `NotesWidget.jsx` widget |
| Bookmarks (CRUD) | `/api/bookmarks` | `BookmarksWidget.jsx` widget |
| Calendar | `/api/calendar` | `CalendarPage.jsx` full-page |
| Tasks (CRUD) | `/api/tasks` | `TasksPage.jsx` full-page |
| Projects (CRUD) | `/api/projects` | Built into `TasksPage.jsx` |

---

## Data Models

All stores are plain JSON arrays. New records get a UUID `id` and ISO 8601 `created_at`. Files written atomically with `Path.write_text(json.dumps(..., indent=2))`.

### tasks.json
```json
{
  "id": "uuid4",
  "title": "string",
  "notes": "string",
  "category": "string",          // course name e.g. "CSE 331"
  "due_date": "YYYY-MM-DD|null",
  "completed": false,
  "completed_at": "ISO8601|null",
  "created_at": "ISO8601",
  "priority": "low|medium|high|null",
  "tags": [],
  "project_id": "uuid4|null",    // null = Inbox
  "calendar_event_uid": "string|null"  // CalDAV UID of linked iCloud event
}
```

### projects.json
```json
{
  "id": "uuid4",
  "name": "string",
  "description": "string",
  "color": "#hex",
  "archived": false,
  "created_at": "ISO8601"
}
```

---

## Tasks API

```
GET    /api/tasks/              ?project_id=<uuid>|inbox  ?completed=true|false  ?priority=low|medium|high
POST   /api/tasks/              Body: { title, notes?, category?, due_date?, priority?, project_id?, calendar_event_uid?, tags? }
GET    /api/tasks/{id}
PATCH  /api/tasks/{id}          Partial update; handles completed_at timestamp automatically
DELETE /api/tasks/{id}
POST   /api/tasks/{id}/toggle   Flip completed boolean + completed_at

GET    /api/projects/           ?include_archived=true
POST   /api/projects/           Body: { name, description?, color? }
GET    /api/projects/{id}
PATCH  /api/projects/{id}
DELETE /api/projects/{id}       Orphans tasks to Inbox (does NOT cascade delete tasks)
```

---

## Calendar System

- iCloud CalDAV sync via `python-caldav`; 5-minute in-process cache
- Local color/description overrides in `calendar_colors.json`
- Active iCloud calendars: CSE 300, CSE 320, CSE 331, CSE 335, STT 351 (school) + personal
- Tasks with `due_date` surface on calendar as all-day events (color `#f7768e`)
- Calendar events linked to completed tasks show a ✓ badge + green tint on event chips
- `GET /api/calendar/events-on-date?date=YYYY-MM-DD` — returns events for task→calendar linking

---

## TasksPage Layout

Two-panel full-screen page (`position: fixed; left: 210px`):

- **Left panel (220px):** All Tasks / Inbox / Projects list / + New Project
- **Right panel (flex: 1):** Task list with sort (newest/due/priority), completed toggle, + New Task
- **Task rows:** checkbox · title · priority badge (HIGH/MED/LOW) · due date · 🗓 calendar link indicator
- **Detail panel (340px slide-in):** Edit title, notes, priority, due date, project, calendar event link, delete
- Completed tasks: strikethrough + muted color
- Past due dates shown in red

---

## Design Rules (full details in APPEARANCE.md)

```
--bg:       #0d0f14
--surface:  #161b24
--border:   #252d3d
--accent:   #7aa2f7   (primary blue)
--text:     #c0caf5
--muted:    #565f89
success:    #9ece6a
danger:     #f7768e
warning:    #e0af68
```

- **Inline styles only** — no CSS modules, no Tailwind
- **Border radius:** 10px widgets, 6px inputs/buttons
- Sidebar: `position: fixed; width: 210px; left: 0; top: 0; bottom: 0`
- Full-screen pages: `position: fixed; left: 210px; top: 0; right: 0; bottom: 0`
