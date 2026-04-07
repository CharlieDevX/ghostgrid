# GhostGrid — Claude Code Session Guide

Read `PROJECT.md` for full project context before starting work.
Read `APPEARANCE.md` for all styling rules — inline styles only, Tokyo Night dark theme.

## Quick orientation
- **Backend:** FastAPI, runs on port 8000. Restart with `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
- **Frontend:** React/Vite, runs on port 5173. Build with `cd frontend && npm run build`
- **Storage:** Flat JSON in `backend/data/` — no database
- **After backend changes:** always verify with `python3 -c "import main; print('OK')"` from the backend dir
- **After frontend changes:** always run `npm run build` and confirm clean build

## Key constraints
- Inline styles ONLY — no Tailwind, no CSS modules, no component libraries
- Full-screen pages use `position: fixed; left: 210px; top: 0; right: 0; bottom: 0` to escape the layout padding chain
- Never cascade-delete tasks when deleting a project — orphan them to Inbox instead
- Follow the file I/O pattern in `notes.py` for any new data routers
