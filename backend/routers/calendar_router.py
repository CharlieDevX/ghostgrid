import os
import time
import json
import uuid
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

router = APIRouter()

TASKS_FILE      = Path(__file__).parent.parent / "data" / "tasks.json"
CAL_COLORS_FILE = Path(__file__).parent.parent / "data" / "calendar_colors.json"

_cache: dict = {"events": [], "calendars": [], "fetched_at": 0.0}
CACHE_TTL = 300


# ── credentials ─────────────────────────────────────────────────────────────────

def _credentials() -> tuple[str | None, str | None]:
    return os.getenv("ICLOUD_USERNAME"), os.getenv("ICLOUD_APP_PASSWORD")

def _configured() -> bool:
    u, p = _credentials()
    return bool(u and p)


# ── local color/description store ───────────────────────────────────────────────
# Format: {"CalName": {"color": "#hex", "description": "..."}}
# Old format (string values) is migrated on read.

def _load_colors() -> dict[str, dict]:
    if not CAL_COLORS_FILE.exists():
        return {}
    try:
        raw = json.loads(CAL_COLORS_FILE.read_text())
        # Migrate old string-value format
        migrated = {}
        for k, v in raw.items():
            if isinstance(v, str):
                migrated[k] = {"color": v, "description": ""}
            else:
                migrated[k] = v
        return migrated
    except Exception:
        return {}

def _save_colors(data: dict):
    CAL_COLORS_FILE.parent.mkdir(parents=True, exist_ok=True)
    CAL_COLORS_FILE.write_text(json.dumps(data, indent=2))

# Fallback palette cycled when iCloud has no color and no local override
_PALETTE = [
    "#7aa2f7", "#9ece6a", "#bb9af7", "#f7768e",
    "#e0af68", "#7dcfff", "#ff9e64", "#73daca",
    "#2ac3de", "#c0caf5", "#db4b4b", "#ff007c",
]
_palette_index: dict[str, str] = {}

def _calendar_color(cal_name: str, icloud_color: str | None) -> str:
    colors = _load_colors()
    if cal_name in colors:
        return colors[cal_name]["color"]
    if icloud_color:
        return icloud_color
    if cal_name not in _palette_index:
        _palette_index[cal_name] = _PALETTE[len(_palette_index) % len(_PALETTE)]
    return _palette_index[cal_name]

def _calendar_description(cal_name: str) -> str:
    colors = _load_colors()
    return colors.get(cal_name, {}).get("description", "")


# ── iCloud fetch ─────────────────────────────────────────────────────────────────

def _fetch_icloud(username: str, password: str) -> tuple[list[dict], list[dict]]:
    import caldav

    client = caldav.DAVClient(
        url="https://caldav.icloud.com",
        username=username,
        password=password,
    )
    principal = client.principal()

    start = datetime.now(timezone.utc) - timedelta(days=14)
    end   = datetime.now(timezone.utc) + timedelta(days=90)

    events    = []
    calendars = []

    for cal in principal.calendars():
        cal_name = str(cal.name) if cal.name else "Calendar"

        # Try to read Apple's calendar-color property
        icloud_color: str | None = None
        try:
            props = cal.get_properties(["{http://apple.com/ns/ical/}calendar-color"])
            raw = props.get("{http://apple.com/ns/ical/}calendar-color")
            if raw:
                icloud_color = raw[:7]  # strip alpha channel if present (#RRGGBBAA → #RRGGBB)
        except Exception:
            pass

        color = _calendar_color(cal_name, icloud_color)
        description = _calendar_description(cal_name)
        calendars.append({"name": cal_name, "color": color, "icloudColor": icloud_color, "description": description})

        try:
            results = cal.search(start=start, end=end, event=True, expand=True)
        except Exception:
            continue

        for obj in results:
            try:
                ical = obj.icalendar_instance
                for comp in ical.walk("VEVENT"):
                    dtstart = comp.get("dtstart").dt
                    dtend_prop = comp.get("dtend")
                    dtend = dtend_prop.dt if dtend_prop else dtstart

                    all_day = isinstance(dtstart, date) and not isinstance(dtstart, datetime)

                    if all_day:
                        start_str = dtstart.isoformat()
                        end_str   = dtend.isoformat()
                    else:
                        # Floating datetimes (no tzinfo) mean "local time" —
                        # do NOT coerce to UTC or the browser will shift them.
                        # Timezone-aware datetimes keep their offset as-is.
                        start_str = dtstart.isoformat()
                        end_str   = dtend.isoformat()

                    events.append({
                        "id":           str(comp.get("uid", "")),
                        "title":        str(comp.get("summary", "(no title)")),
                        "start":        start_str,
                        "end":          end_str,
                        "allDay":       all_day,
                        "source":       "icloud",
                        "calendarName": cal_name,
                        "color":        color,
                        "description":  str(comp.get("description", "")),
                        "location":     str(comp.get("location", "")),
                    })
            except Exception:
                continue

    return events, calendars


# ── tasks as calendar events ─────────────────────────────────────────────────────

def _tasks_as_events() -> list[dict]:
    if not TASKS_FILE.exists():
        return []
    try:
        tasks = json.loads(TASKS_FILE.read_text())
    except Exception:
        return []

    events = []
    for t in tasks:
        if t.get("completed") or not t.get("due_date"):
            continue
        events.append({
            "id":           f"task-{t['id']}",
            "title":        f"Due: {t['title']}",
            "start":        t["due_date"],
            "end":          t["due_date"],
            "allDay":       True,
            "source":       "ghostgrid",
            "calendarName": t.get("category", "task"),
            "color":        "#f7768e",
            "description":  t.get("notes", ""),
            "location":     "",
        })
    return events


# ── endpoints ────────────────────────────────────────────────────────────────────

def _do_fetch():
    username, password = _credentials()
    icloud_events, icloud_cals = _fetch_icloud(username, password)
    _cache["events"]     = icloud_events
    _cache["calendars"]  = icloud_cals
    _cache["fetched_at"] = time.monotonic()
    return icloud_events, icloud_cals


@router.get("/events")
def get_events():
    if not _configured():
        return {
            "events":      _tasks_as_events(),
            "calendars":   [],
            "configured":  False,
            "message":     "iCloud not connected. Fill ICLOUD_USERNAME and ICLOUD_APP_PASSWORD in backend/.env",
        }

    now = time.monotonic()
    if now - _cache["fetched_at"] < CACHE_TTL and _cache["events"]:
        return {
            "events":     _cache["events"] + _tasks_as_events(),
            "calendars":  _cache["calendars"],
            "configured": True,
            "cached":     True,
        }

    try:
        icloud_events, icloud_cals = _do_fetch()
        return {
            "events":     icloud_events + _tasks_as_events(),
            "calendars":  icloud_cals,
            "configured": True,
            "cached":     False,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CalDAV error: {e}")


@router.get("/calendars")
def get_calendars():
    if not _configured():
        return {"calendars": [], "configured": False}

    now = time.monotonic()
    if now - _cache["fetched_at"] < CACHE_TTL and _cache["calendars"]:
        return {"calendars": _cache["calendars"], "configured": True}

    try:
        _, icloud_cals = _do_fetch()
        return {"calendars": icloud_cals, "configured": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CalDAV error: {e}")


@router.post("/refresh")
def refresh_cache():
    _cache["fetched_at"] = 0.0
    return {"ok": True}


# ── events on a specific date (for task→calendar linking) ────────────────────────

@router.get("/events-on-date")
def events_on_date(date: str):
    """Return iCloud events whose start date matches `date` (YYYY-MM-DD).
    Uses the existing cache — no fresh CalDAV request if cache is still valid."""
    if not _configured():
        return []

    now = time.monotonic()
    if now - _cache["fetched_at"] >= CACHE_TTL or not _cache["events"]:
        try:
            _do_fetch()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"CalDAV error: {e}")

    matches = []
    for ev in _cache["events"]:
        if str(ev.get("start", ""))[:10] == date:
            matches.append({
                "uid":           ev["id"],
                "title":         ev["title"],
                "calendar_name": ev["calendarName"],
                "start":         ev["start"],
                "end":           ev["end"],
            })
    return matches


# ── edit calendar (color, description, optional rename) ──────────────────────────

class CalendarUpdate(BaseModel):
    color: str
    description: str = ""
    new_name: str = ""

@router.put("/calendars/{cal_name}")
def update_calendar(cal_name: str, body: CalendarUpdate):
    colors = _load_colors()
    target_name = body.new_name.strip() if body.new_name.strip() else cal_name

    # If renaming, try to rename in iCloud via PROPPATCH
    if target_name != cal_name and _configured():
        try:
            import caldav
            from caldav.lib import dav
            username, password = _credentials()
            client = caldav.DAVClient(url="https://caldav.icloud.com", username=username, password=password)
            for cal in client.principal().calendars():
                if str(cal.name) == cal_name:
                    cal.set_properties([dav.DisplayName(target_name)])
                    break
        except Exception:
            pass  # Rename best-effort; proceed anyway

    # Move color entry to new name key if renamed
    entry = colors.pop(cal_name, {"color": body.color, "description": body.description})
    entry["color"] = body.color
    entry["description"] = body.description
    colors[target_name] = entry
    _save_colors(colors)

    _cache["fetched_at"] = 0.0
    return {"ok": True, "name": target_name, "color": body.color, "description": body.description}


# ── create calendar in iCloud ─────────────────────────────────────────────────────

class NewCalendar(BaseModel):
    name: str
    color: str = "#7aa2f7"

@router.post("/calendars/new", status_code=201)
def create_calendar(data: NewCalendar):
    if not _configured():
        raise HTTPException(status_code=503, detail="iCloud not configured")

    import caldav
    username, password = _credentials()
    client = caldav.DAVClient(url="https://caldav.icloud.com", username=username, password=password)
    principal = client.principal()

    try:
        principal.make_calendar(name=data.name, cal_id=str(uuid.uuid4()))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create calendar: {e}")

    # Store the color locally
    colors = _load_colors()
    colors[data.name] = {"color": data.color, "description": ""}
    _save_colors(colors)

    _cache["fetched_at"] = 0.0
    return {"ok": True, "name": data.name, "color": data.color}


# ── write events ──────────────────────────────────────────────────────────────────

class NewEvent(BaseModel):
    title: str
    start: str
    end: str
    all_day: bool = False
    description: str = ""
    calendar_name: str = ""

@router.post("/events", status_code=201)
def create_event(ev: NewEvent):
    if not _configured():
        raise HTTPException(status_code=503, detail="iCloud not configured")

    import caldav
    from icalendar import Calendar, Event as IEvent

    username, password = _credentials()
    client    = caldav.DAVClient(url="https://caldav.icloud.com", username=username, password=password)
    calendars = client.principal().calendars()

    target = next((c for c in calendars if str(c.name) == ev.calendar_name), calendars[0] if calendars else None)
    if not target:
        raise HTTPException(status_code=404, detail="No calendars found")

    cal = Calendar()
    cal.add("prodid", "-//GhostGrid//EN")
    cal.add("version", "2.0")

    iev = IEvent()
    iev.add("uid",         str(uuid.uuid4()))
    iev.add("summary",     ev.title)
    iev.add("description", ev.description)
    iev.add("dtstamp",     datetime.now(timezone.utc))

    if ev.all_day:
        iev.add("dtstart", date.fromisoformat(ev.start[:10]))
        iev.add("dtend",   date.fromisoformat(ev.end[:10]))
    else:
        iev.add("dtstart", datetime.fromisoformat(ev.start))
        iev.add("dtend",   datetime.fromisoformat(ev.end))

    cal.add_component(iev)
    target.save_event(cal.to_ical().decode())

    _cache["fetched_at"] = 0.0
    return {"ok": True, "title": ev.title}


# ── find event by UID ─────────────────────────────────────────────────────────────

def _find_caldav_event(username, password, uid):
    """iCloud doesn't reliably support event-by-uid REPORT, so scan manually."""
    import caldav
    client = caldav.DAVClient(url="https://caldav.icloud.com", username=username, password=password)
    search_start = datetime.now(timezone.utc) - timedelta(days=365)
    search_end   = datetime.now(timezone.utc) + timedelta(days=365)
    for cal in client.principal().calendars():
        try:
            for obj in cal.search(start=search_start, end=search_end, event=True):
                try:
                    for comp in obj.icalendar_instance.walk("VEVENT"):
                        if str(comp.get("uid", "")) == uid:
                            return cal, obj
                except Exception:
                    continue
        except Exception:
            continue
    return None, None


# ── update event ──────────────────────────────────────────────────────────────────

class UpdateEvent(BaseModel):
    title: str
    start: str
    end: str
    all_day: bool = False
    description: str = ""

@router.put("/events/{uid}")
def update_event(uid: str, ev: UpdateEvent):
    if not _configured():
        raise HTTPException(status_code=503, detail="iCloud not configured")

    from icalendar import Calendar as ICal, Event as IEvent

    username, password = _credentials()
    cal, obj = _find_caldav_event(username, password, uid)
    if not obj:
        raise HTTPException(status_code=404, detail="Event not found")

    new_cal = ICal()
    new_cal.add("prodid", "-//GhostGrid//EN")
    new_cal.add("version", "2.0")

    iev = IEvent()
    iev.add("uid",           uid)
    iev.add("summary",       ev.title)
    iev.add("description",   ev.description)
    iev.add("dtstamp",       datetime.now(timezone.utc))
    iev.add("last-modified", datetime.now(timezone.utc))

    if ev.all_day:
        iev.add("dtstart", date.fromisoformat(ev.start[:10]))
        iev.add("dtend",   date.fromisoformat(ev.end[:10]))
    else:
        iev.add("dtstart", datetime.fromisoformat(ev.start))
        iev.add("dtend",   datetime.fromisoformat(ev.end))

    new_cal.add_component(iev)
    obj.data = new_cal.to_ical().decode()
    obj.save()

    _cache["fetched_at"] = 0.0
    return {"ok": True}


# ── delete event ──────────────────────────────────────────────────────────────────

@router.delete("/events/{uid}")
def delete_event(uid: str):
    if not _configured():
        raise HTTPException(status_code=503, detail="iCloud not configured")

    username, password = _credentials()
    _, obj = _find_caldav_event(username, password, uid)
    if not obj:
        raise HTTPException(status_code=404, detail="Event not found")

    obj.delete()
    _cache["fetched_at"] = 0.0
    return {"ok": True}
