import { useEffect, useRef, useState } from 'react'

// ── constants ────────────────────────────────────────────────────────────────
const HOUR_H = 64        // px per hour
const DAY_START = 6      // 6 AM
const DAY_END = 23       // 11 PM
const TOTAL_HOURS = DAY_END - DAY_START
const GRID_H = TOTAL_HOURS * HOUR_H

const PRESET_COLORS = [
  '#7aa2f7','#9ece6a','#bb9af7','#f7768e',
  '#e0af68','#7dcfff','#ff9e64','#73daca',
  '#2ac3de','#c0caf5','#db4b4b','#ff007c',
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtDateLong(d) {
  return d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
function fmtDateShort(d) {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── helpers ──────────────────────────────────────────────────────────────────
function startOfWeek(d) {
  const day = new Date(d)
  const diff = day.getDay() // 0=Sun
  day.setDate(day.getDate() - diff)
  day.setHours(0, 0, 0, 0)
  return day
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function parseDate(str) {
  if (!str) return null
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by new Date(),
  // which shifts them to the previous day in negative-offset timezones.
  // Parse as local noon instead to keep them on the correct calendar day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d, 12, 0, 0)
  }
  return new Date(str)
}

function minuteOfDay(d) {
  return d.getHours() * 60 + d.getMinutes()
}

function topPx(d) {
  return Math.max(0, (minuteOfDay(d) - DAY_START * 60)) * (HOUR_H / 60)
}

function heightPx(start, end) {
  const startMins = Math.max(minuteOfDay(start), DAY_START * 60)
  const endMins   = Math.min(minuteOfDay(end) || DAY_END * 60, DAY_END * 60)
  return Math.max(22, (endMins - startMins) * (HOUR_H / 60))
}

function fmt12(h) {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ── event layout (basic column overlap) ─────────────────────────────────────
function layoutEvents(events) {
  // sort by start
  const sorted = [...events].sort((a, b) => a._start - b._start)
  const columns = []
  const result = []

  for (const ev of sorted) {
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      if (columns[col] <= ev._start) {
        columns[col] = ev._end
        result.push({ ...ev, _col: col, _cols: columns.length })
        placed = true
        break
      }
    }
    if (!placed) {
      columns.push(ev._end)
      result.push({ ...ev, _col: columns.length - 1, _cols: columns.length })
    }
  }
  // fix _cols to be final column count
  const maxCols = columns.length
  return result.map(e => ({ ...e, _cols: maxCols }))
}

// ── event detail / edit modal ────────────────────────────────────────────────
function EventDetailModal({ event, onClose, onSaved, onDeleted }) {
  const pad = n => String(n).padStart(2, '0')
  const isEditable = event.source === 'icloud'

  // Parse start/end into form-friendly pieces
  const parseToForm = (ev) => {
    const s = new Date(ev.start)
    const e = new Date(ev.end)
    return {
      title: ev.title,
      startDate: `${s.getFullYear()}-${pad(s.getMonth()+1)}-${pad(s.getDate())}`,
      startTime: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      endDate: `${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}`,
      endTime: `${pad(e.getHours())}:${pad(e.getMinutes())}`,
      description: ev.description || '',
      allDay: ev.allDay,
    }
  }

  const [mode, setMode] = useState('view')
  const [form, setForm] = useState(() => parseToForm(event))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    setSaving(true)
    const payload = form.allDay
      ? { title: form.title, start: form.startDate, end: form.endDate, all_day: true, description: form.description }
      : { title: form.title, start: `${form.startDate}T${form.startTime}`, end: `${form.endDate}T${form.endTime}`, all_day: false, description: form.description }
    try {
      await fetch(`/api/calendar/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await fetch('/api/calendar/refresh', { method: 'POST' })
      onSaved()
    } finally { setSaving(false) }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/calendar/events/${event.id}`, { method: 'DELETE' })
      await fetch('/api/calendar/refresh', { method: 'POST' })
      onDeleted()
    } finally { setDeleting(false) }
  }

  const field = (label, children) => (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )

  const sourceColor = event.color ?? 'var(--accent)'

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: 480, overflow: 'hidden' }}>

        {/* Colour bar at top */}
        <div style={{ height: 5, background: sourceColor }} />

        <div style={{ padding: 24 }}>
          {mode === 'view' ? (
            <>
              {/* Title */}
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 16, lineHeight: 1.3 }}>
                {event.title}
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <span style={{ color: 'var(--text)' }}>
                    {event.allDay
                      ? fmtDateLong(new Date(event.start))
                      : `${fmtDateLong(new Date(event.start))}`
                    }
                  </span>
                </div>

                {!event.allDay && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 16 }}>⏰</span>
                    <span style={{ color: 'var(--text)' }}>
                      {fmtTime(new Date(event.start))} – {fmtTime(new Date(event.end))}
                    </span>
                  </div>
                )}

                {event.allDay && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 16 }}>⏰</span>
                    <span style={{ color: 'var(--muted)' }}>All Day</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 16 }}>📁</span>
                  <span className="tag tag-blue">{event.calendarName}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{event.source}</span>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--text)', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {event.description}
                </div>
              )}
              {!event.description && (
                <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16, fontStyle: 'italic' }}>No description.</div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {isEditable && !confirmDelete && (
                    <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
                  )}
                  {isEditable && confirmDelete && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--danger)' }}>Sure?</span>
                      <button className="btn-danger" disabled={deleting} onClick={remove}>{deleting ? '...' : 'Yes, delete'}</button>
                      <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>No</button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" onClick={onClose}>Close</button>
                  {isEditable && <button className="btn-primary" onClick={() => setMode('edit')}>Edit</button>}
                </div>
              </div>
            </>
          ) : (
            /* ── Edit mode ── */
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>Edit Event</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {field('Title', <input value={form.title} autoFocus onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />)}

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>All Day</span>
                </label>

                {form.allDay ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {field('Start Date', <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />)}
                    {field('End Date',   <input type="date" value={form.endDate}   onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />)}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {field('Start Date', <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />)}
                      {field('Start Time', <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {field('End Date', <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />)}
                      {field('End Time', <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />)}
                    </div>
                  </div>
                )}

                {field('Description', <textarea value={form.description} placeholder="Add a note..." onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: 80 }} />)}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button className="btn-ghost" onClick={() => { setForm(parseToForm(event)); setMode('view') }}>Cancel</button>
                  <button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── new event modal ──────────────────────────────────────────────────────────
function NewEventModal({ date, hour, defaultAllDay = false, calendars = [], onSave, onClose }) {
  const pad = n => String(n).padStart(2, '0')
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`

  const [allDay, setAllDay] = useState(defaultAllDay)
  const [form, setForm] = useState({
    title: '',
    startDate: dateStr,
    endDate: dateStr,
    startTime: `${pad(hour)}:00`,
    endTime: `${pad(Math.min(hour + 1, 22))}:00`,
    description: '',
    calendarName: calendars[0]?.name ?? '',
  })

  const submit = e => {
    e.preventDefault()
    if (allDay) {
      onSave({ title: form.title, start: form.startDate, end: form.endDate, all_day: true, description: form.description })
    } else {
      onSave({ title: form.title, start: `${form.startDate}T${form.startTime}`, end: `${form.endDate}T${form.endTime}`, all_day: false, description: form.description })
    }
  }

  const field = (label, children) => (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 460 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--accent)' }}>New Event</div>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>

          {/* Title */}
          <input placeholder="Title *" required autoFocus value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

          {/* Calendar selector */}
          {calendars.length > 0 && field('Calendar',
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {calendars.map(cal => (
                <div key={cal.name} onClick={() => setForm(f => ({ ...f, calendarName: cal.name }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                    borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    background: form.calendarName === cal.name ? cal.color : 'var(--bg)',
                    color: form.calendarName === cal.name ? '#1a1b26' : 'var(--text)',
                    border: `1px solid ${form.calendarName === cal.name ? cal.color : 'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: form.calendarName === cal.name ? '#1a1b26' : cal.color }} />
                  {cal.name}
                </div>
              ))}
            </div>
          )}

          {/* All-day toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>All Day</span>
          </label>

          {allDay ? (
            /* All-day: just date pickers */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {field('Start Date',
                <input type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              )}
              {field('End Date',
                <input type="date" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              )}
            </div>
          ) : (
            /* Timed: date + time separately so they size properly */
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {field('Start Date',
                  <input type="date" value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                )}
                {field('Start Time',
                  <input type="time" value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {field('End Date',
                  <input type="date" value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                )}
                {field('End Time',
                  <input type="time" value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {field('Description (optional)',
            <textarea value={form.description} placeholder="Add a note..."
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ minHeight: 64 }} />
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save to iCloud</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── color picker (presets + wheel + hex) ────────────────────────────────────
function ColorPicker({ color, onChange }) {
  const [hex, setHex] = useState(color)

  // Keep hex input in sync when color prop changes externally
  const prevColor = useRef(color)
  if (prevColor.current !== color) {
    prevColor.current = color
    setHex(color)
  }

  const applyHex = (val) => {
    const clean = val.startsWith('#') ? val : '#' + val
    setHex(clean)
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) onChange(clean)
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Preset swatches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
        {PRESET_COLORS.map(c => (
          <div key={c} onClick={() => { setHex(c); onChange(c) }} style={{
            width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
            border: color === c ? '3px solid white' : '2px solid rgba(255,255,255,0.12)',
            transition: 'transform 0.1s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.18)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          />
        ))}
      </div>

      {/* Color wheel + hex input row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#7aa2f7'}
            onChange={e => { setHex(e.target.value); onChange(e.target.value) }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}
          />
          <div style={{
            width: 34, height: 34, borderRadius: 8, background: color,
            border: '2px solid rgba(255,255,255,0.2)', pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
          </div>
        </div>
        <input
          value={hex}
          onChange={e => applyHex(e.target.value)}
          placeholder="#7aa2f7"
          style={{ fontFamily: 'monospace', fontSize: 13, flex: 1 }}
          maxLength={7}
        />
        <div style={{ width: 26, height: 26, borderRadius: 6, background: /^#[0-9a-fA-F]{6}$/.test(color) ? color : 'transparent', border: '1px solid var(--border)', flexShrink: 0 }} />
      </div>
    </div>
  )
}

// ── edit calendar modal ───────────────────────────────────────────────────────
function EditCalendarModal({ calendar, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: calendar.name,
    description: calendar.description || '',
    color: calendar.color,
  })
  const [saving, setSaving] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/calendar/calendars/${encodeURIComponent(calendar.name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: form.color, description: form.description, new_name: form.name }),
      })
      const data = await res.json()
      await fetch('/api/calendar/refresh', { method: 'POST' })
      onSaved({ ...data, oldName: calendar.name })
    } finally { setSaving(false) }
  }

  const field = (label, children) => (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: 420, overflow: 'hidden' }}>
        <div style={{ height: 5, background: form.color }} />
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--accent)' }}>Edit Calendar</div>
          <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
            {field('Name',
              <input value={form.name} autoFocus required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            )}
            {field('Description',
              <textarea value={form.description} placeholder="Optional description..."
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                style={{ minHeight: 70 }} />
            )}
            {field('Color',
              <ColorPicker color={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── calendar panel (left sidebar) ────────────────────────────────────────────
function CalendarPanel({ calendars, hidden, onToggle, onCalendarUpdated, onNewCalendar }) {
  const [newForm, setNewForm]     = useState(null)   // null | { name, color }
  const [editingCal, setEditingCal] = useState(null) // null | calendar object
  const [hovered, setHovered]     = useState(null)

  const createCalendar = (e) => {
    e.preventDefault()
    if (!newForm?.name?.trim()) return
    fetch('/api/calendar/calendars/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newForm.name, color: newForm.color }),
    }).then(r => r.json()).then(data => {
      onNewCalendar(data)
      setNewForm(null)
    })
  }

  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0, paddingRight: collapsed ? 6 : 10, width: collapsed ? 28 : 158, transition: 'width 0.2s ease', overflow: 'hidden' }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: collapsed ? 0 : 10, userSelect: 'none' }}
      >
        {!collapsed && (
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            My Calendars
          </span>
        )}
        <span style={{ color: 'var(--muted)', fontSize: 14, marginLeft: collapsed ? 0 : 'auto', lineHeight: 1 }}>
          {collapsed ? '›' : '‹'}
        </span>
      </div>

      {!collapsed && <>
      {calendars.map(cal => (
        <div key={cal.name}
          style={{ position: 'relative' }}
          onMouseEnter={() => setHovered(cal.name)}
          onMouseLeave={() => setHovered(null)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', borderRadius: 6, background: hovered === cal.name ? 'var(--border)' : 'transparent' }}>
            {/* Color dot */}
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: cal.color, flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)' }} />
            {/* Name — click to toggle visibility */}
            <span
              onClick={() => onToggle(cal.name)}
              style={{ fontSize: 13, flex: 1, color: hidden.has(cal.name) ? 'var(--muted)' : 'var(--text)', textDecoration: hidden.has(cal.name) ? 'line-through' : 'none', userSelect: 'none', cursor: 'pointer' }}
            >
              {cal.name}
            </span>
            {/* Edit pencil — shown on hover */}
            {hovered === cal.name && (
              <button
                onClick={() => setEditingCal(cal)}
                title="Edit calendar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--muted)', display: 'flex', alignItems: 'center', lineHeight: 1 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}

      {/* New calendar */}
      {newForm === null ? (
        <button onClick={() => setNewForm({ name: '', color: PRESET_COLORS[0] })}
          style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: '4px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
          + New Calendar
        </button>
      ) : (
        <form onSubmit={createCalendar} style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <input placeholder="Calendar name" autoFocus value={newForm.name}
            onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
            style={{ fontSize: 12, padding: '5px 8px' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {PRESET_COLORS.map(c => (
              <div key={c} onClick={() => setNewForm(f => ({ ...f, color: c }))} style={{
                width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                border: newForm.color === c ? '3px solid white' : '2px solid rgba(255,255,255,0.1)',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" className="btn-primary" style={{ fontSize: 12, padding: '4px 10px' }}>Create</button>
            <button type="button" className="btn-ghost"   style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setNewForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      </>}
    </div>

    {editingCal && (
      <EditCalendarModal
        calendar={editingCal}
        onClose={() => setEditingCal(null)}
        onSaved={(data) => { setEditingCal(null); onCalendarUpdated(data) }}
      />
    )}
    </>
  )
}

// ── month view helpers ────────────────────────────────────────────────────────
function getMonthGrid(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const grid = []
  // pad from previous month to fill first row
  for (let i = 0; i < first.getDay(); i++) {
    grid.push(addDays(first, -(first.getDay() - i)))
  }
  // days of this month
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  for (let i = 0; i < daysInMonth; i++) grid.push(addDays(first, i))
  // pad to complete final row
  while (grid.length % 7 !== 0) grid.push(addDays(grid[grid.length - 1], 1))
  return grid
}

// ── month view ────────────────────────────────────────────────────────────────
function MonthView({ viewDate, parsedEvents, today, configured, completedTaskUids = new Set(), onDayClick, onEventClick }) {
  const grid = getMonthGrid(viewDate)
  const weeks = []
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7))

  const allForDay = (day) => parsedEvents.filter(e => {
    if (e.allDay) {
      const s = new Date(e._start); s.setHours(0, 0, 0, 0)
      const en = new Date(e._end); en.setHours(23, 59, 59, 999)
      return day >= s && day <= en
    }
    return sameDay(e._start, day)
  })

  return (
    <div style={{ flex: '0 1 680px', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {DAYS.map(d => (
          <div key={d} style={{ padding: '6px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ flex: 1, display: 'grid', gridTemplateRows: `repeat(${weeks.length}, 1fr)`, overflow: 'hidden' }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 0, borderBottom: wi < weeks.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {week.map((day, di) => {
              const isToday = sameDay(day, today)
              const isCurrentMonth = day.getMonth() === viewDate.getMonth()
              const dayEvs = allForDay(day)
              const MAX_SHOW = 3

              return (
                <div
                  key={di}
                  onClick={() => configured && onDayClick(day)}
                  style={{
                    borderLeft: di > 0 ? '1px solid var(--border)' : 'none',
                    padding: '4px 5px',
                    cursor: configured ? 'pointer' : 'default',
                    opacity: isCurrentMonth ? 1 : 0.35,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    minHeight: 0,
                    overflow: 'hidden',
                    minWidth: 0,
                  }}
                >
                  {/* Day number */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: isToday ? 700 : 400,
                      color: isToday ? '#1a1b26' : 'var(--text)',
                      background: isToday ? 'var(--accent)' : 'transparent',
                      flexShrink: 0,
                    }}>
                      {day.getDate()}
                    </div>
                  </div>

                  {/* Events */}
                  {dayEvs.slice(0, MAX_SHOW).map(e => (
                    <div
                      key={e.id}
                      title={e.title}
                      onClick={ev => { ev.stopPropagation(); onEventClick(e) }}
                      style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '2px 6px', borderRadius: 4,
                        background: completedTaskUids.has(e.id) ? 'rgba(158,206,106,0.25)' : (e.color ?? 'var(--accent)'),
                        borderLeft: completedTaskUids.has(e.id) ? `3px solid ${e.color ?? 'var(--accent)'}` : undefined,
                        color: completedTaskUids.has(e.id) ? '#9ece6a' : '#1a1b26',
                        overflow: 'hidden',
                        display: 'flex', alignItems: 'center', gap: 4,
                        cursor: 'pointer',
                        minWidth: 0,
                      }}
                    >
                      {completedTaskUids.has(e.id) && <span style={{ flexShrink: 0 }}>✓</span>}
                      {!e.allDay && (
                        <span style={{ opacity: 0.75, flexShrink: 0 }}>{fmtTime(e._start)}</span>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>{e.title}</span>
                    </div>
                  ))}
                  {dayEvs.length > MAX_SHOW && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 4 }}>
                      +{dayEvs.length - MAX_SHOW} more
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── week view ─────────────────────────────────────────────────────────────────
function WeekView({ viewDate, parsedEvents, today, configured, completedTaskUids = new Set(), onSlotClick, onEventClick, gridRef }) {
  const weekStart = startOfWeek(viewDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const allDayEvents = parsedEvents.filter(e => e.allDay)
  const timedEvents  = parsedEvents.filter(e => !e.allDay)

  const timedForDay = day => timedEvents.filter(e => sameDay(e._start, day))
  const allDayForDay = day => allDayEvents.filter(e => {
    const s = new Date(e._start); s.setHours(0, 0, 0, 0)
    const en = new Date(e._end); en.setHours(23, 59, 59, 999)
    return day >= s && day <= en
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Day header */}
      <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div />
        {weekDays.map((day, i) => {
          const isToday = sameDay(day, today)
          return (
            <div key={i} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DAYS[day.getDay()]}</div>
              <div style={{
                fontSize: 20, fontWeight: 700, lineHeight: 1.3,
                color: isToday ? '#1a1b26' : 'var(--text)',
                background: isToday ? 'var(--accent)' : 'transparent',
                borderRadius: '50%', width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '4px auto 0',
              }}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', minHeight: 28, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', padding: '6px 4px', textAlign: 'right' }}>all‑day</div>
        {weekDays.map((day, i) => (
          <div key={i} style={{ borderLeft: '1px solid var(--border)', padding: '3px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {allDayForDay(day).map(e => (
              <div key={e.id} title={e.title}
                onClick={ev => { ev.stopPropagation(); onEventClick(e) }}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                  background: completedTaskUids.has(e.id) ? 'rgba(158,206,106,0.25)' : (e.color ?? 'var(--accent)'),
                  borderLeft: completedTaskUids.has(e.id) ? `3px solid ${e.color ?? 'var(--accent)'}` : undefined,
                  color: completedTaskUids.has(e.id) ? '#9ece6a' : '#1a1b26',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}>{completedTaskUids.has(e.id) ? `✓ ${e.title}` : e.title}</div>
            ))}
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div ref={gridRef} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, 1fr)', height: GRID_H }}>
          {/* Time labels */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={i} style={{ position: 'absolute', top: i * HOUR_H - 8, right: 6, fontSize: 10, color: 'var(--muted)', textAlign: 'right', lineHeight: 1 }}>
                {fmt12(DAY_START + i)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, di) => {
            const dayEvs = layoutEvents(timedForDay(day))
            return (
              <div key={di}
                style={{ borderLeft: '1px solid var(--border)', position: 'relative', cursor: configured ? 'crosshair' : 'default' }}
                onClick={e => {
                  if (!configured) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const hour = Math.floor((e.clientY - rect.top) / HOUR_H) + DAY_START
                  onSlotClick({ date: day, hour: Math.min(hour, DAY_END - 1) })
                }}
              >
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div key={i} style={{ position: 'absolute', top: i * HOUR_H, left: 0, right: 0, borderTop: '1px solid var(--border)', opacity: 0.5 }} />
                ))}

                {sameDay(day, today) && (() => {
                  const top = topPx(new Date())
                  return top >= 0 && top <= GRID_H ? (
                    <div style={{ position: 'absolute', top, left: 0, right: 0, zIndex: 10, borderTop: '2px solid var(--danger)', pointerEvents: 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', marginTop: -5, marginLeft: -4 }} />
                    </div>
                  ) : null
                })()}

                {dayEvs.map(ev => {
                  const top = topPx(ev._start)
                  const h = heightPx(ev._start, ev._end)
                  const colW = 100 / ev._cols
                  return (
                    <div key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                      style={{
                        position: 'absolute', top, height: h,
                        left: `${ev._col * colW}%`, width: `calc(${colW}% - 3px)`,
                        background: ev.color ?? 'var(--accent)',
                        borderRadius: 5, padding: '2px 5px', overflow: 'hidden', zIndex: 5, cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1b26', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                      {h > 36 && <div style={{ fontSize: 10, color: 'rgba(26,27,38,0.75)' }}>{fmtTime(ev._start)}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [rawEvents, setRawEvents] = useState([])
  const [completedTaskUids, setCompletedTaskUids] = useState(new Set())
  const [configured, setConfigured] = useState(true)
  const [setupMsg, setSetupMsg] = useState('')
  const [view, setView] = useState('month')
  const [viewDate, setViewDate] = useState(new Date())
  const [modal, setModal] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [calendars, setCalendars] = useState([])
  const [hidden, setHidden] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const gridRef = useRef(null)

  const fetchEvents = () => {
    fetch('/api/calendar/events')
      .then(r => r.json())
      .then(data => {
        setRawEvents(data.events || [])
        setConfigured(data.configured !== false)
        if (data.calendars?.length) setCalendars(data.calendars)
        if (!data.configured) setSetupMsg(data.message || '')
      })
      .catch(() => {})
  }

  const toggleCalendar = (name) => {
    setHidden(h => {
      const next = new Set(h)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const updateCalendar = ({ oldName, name, color, description }) => {
    setCalendars(cs => cs.map(c =>
      c.name === oldName
        ? { ...c, name, color, description: description || '' }
        : c
    ))
    // Also update events that belong to this calendar
    setRawEvents(evs => evs.map(e =>
      e.calendarName === oldName
        ? { ...e, calendarName: name, color }
        : e
    ))
    // Re-fetch to pick up iCloud changes
    fetchEvents()
  }

  const addCalendar = (cal) => {
    setCalendars(cs => [...cs, cal])
    fetchEvents()
  }

  useEffect(() => {
    fetchEvents()
    const id = setInterval(fetchEvents, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetch('/api/tasks/?completed=true')
      .then(r => r.json())
      .then(tasks => {
        const uids = new Set(tasks.filter(t => t.calendar_event_uid).map(t => t.calendar_event_uid))
        setCompletedTaskUids(uids)
      })
      .catch(() => {})
  }, [])
  useEffect(() => { if (gridRef.current) gridRef.current.scrollTop = HOUR_H }, [view])

  const today = new Date()

  const parsedEvents = rawEvents.map(e => {
    const start = parseDate(e.start)
    const end = parseDate(e.end)
    return { ...e, _start: start, _end: end }
  }).filter(e => e._start && e._end && !hidden.has(e.calendarName))

  const saveEvent = async (formData) => {
    setSaving(true)
    try {
      await fetch('/api/calendar/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      await fetch('/api/calendar/refresh', { method: 'POST' })
      fetchEvents()
    } finally { setSaving(false); setModal(null) }
  }

  // Navigation
  const prev = () => {
    if (view === 'month') setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else setViewDate(d => addDays(d, -7))
  }
  const next = () => {
    if (view === 'month') setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else setViewDate(d => addDays(d, 7))
  }
  const goToday = () => setViewDate(new Date())

  // Header label
  const headerLabel = view === 'month'
    ? `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`
    : (() => {
        const ws = startOfWeek(viewDate)
        const we = addDays(ws, 6)
        return ws.getMonth() === we.getMonth()
          ? `${MONTHS[ws.getMonth()]} ${ws.getFullYear()}`
          : `${MONTHS[ws.getMonth()]} / ${MONTHS[we.getMonth()]} ${we.getFullYear()}`
      })()

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 210, display: 'flex', flexDirection: 'column', background: 'var(--bg)', padding: '16px 20px 0', zIndex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1, minWidth: 120 }}>{headerLabel}</h2>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 7, padding: 2, gap: 1 }}>
          {['month', 'week'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? 'var(--surface)' : 'transparent',
              color: view === v ? 'var(--accent)' : 'var(--muted)',
              border: 'none', borderRadius: 5, padding: '4px 10px', fontWeight: 600, fontSize: 12,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <button className="btn-ghost" onClick={prev} style={{ padding: '4px 9px', fontSize: 13 }}>‹</button>
        <button className="btn-ghost" onClick={goToday} style={{ padding: '4px 9px', fontSize: 12 }}>Today</button>
        <button className="btn-ghost" onClick={next} style={{ padding: '4px 9px', fontSize: 13 }}>›</button>
        {configured && <button className="btn-primary" onClick={() => setModal({ date: today, hour: 9 })} style={{ padding: '4px 10px', fontSize: 12 }}>+ Event</button>}
      </div>

      {!configured && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, color: 'var(--muted)', fontSize: 13 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>iCloud not connected. </span>
          {setupMsg} — showing GhostGrid tasks only.
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', gap: 0, minHeight: 0 }}>
        {/* Calendar list panel */}
        {calendars.length > 0 && (
          <CalendarPanel
            calendars={calendars}
            hidden={hidden}
            onToggle={toggleCalendar}
            onCalendarUpdated={updateCalendar}
            onNewCalendar={addCalendar}
          />
        )}

        {/* Main calendar view */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {view === 'month'
            ? <MonthView viewDate={viewDate} parsedEvents={parsedEvents} today={today} configured={configured}
                completedTaskUids={completedTaskUids}
                onDayClick={day => setModal({ date: day, hour: 9, defaultAllDay: true })}
                onEventClick={setSelectedEvent} />
            : <WeekView viewDate={viewDate} parsedEvents={parsedEvents} today={today} configured={configured}
                completedTaskUids={completedTaskUids}
                onSlotClick={setModal} onEventClick={setSelectedEvent} gridRef={gridRef} />
          }
        </div>
      </div>

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSaved={() => { setSelectedEvent(null); fetchEvents() }}
          onDeleted={() => { setSelectedEvent(null); fetchEvents() }}
        />
      )}

      {modal && !selectedEvent && (
        <NewEventModal
          date={modal.date}
          hour={modal.hour ?? 9}
          defaultAllDay={modal.defaultAllDay ?? false}
          calendars={calendars}
          onSave={saveEvent}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
