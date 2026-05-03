import { useState, useEffect, useRef } from 'react'

const priorityColor = { high: '#f7768e', medium: '#e0af68', low: '#9ece6a' }
const priorityLabel = { high: 'HIGH', medium: 'MED', low: 'LOW' }

function fmtDate(str) {
  if (!str) return null
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isPast(str) {
  if (!str) return false
  return new Date(str + 'T00:00:00') < new Date(new Date().toDateString())
}

// ── ColorDot picker ────────────────────────────────────────────────────────────
const PALETTE = ['#7aa2f7','#9ece6a','#bb9af7','#f7768e','#e0af68','#7dcfff','#ff9e64','#73daca','#2ac3de','#c0caf5']

function ColorDotPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ width: 20, height: 20, borderRadius: '50%', background: value, cursor: 'pointer', border: '2px solid var(--border)' }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 26, left: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6, width: 140,
        }}>
          {PALETTE.map(c => (
            <div key={c} onClick={() => { onChange(c); setOpen(false) }}
              style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                border: c === value ? '2px solid white' : '2px solid transparent' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Task detail slide-in panel ─────────────────────────────────────────────────
function TaskDetail({ task, projects, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ ...task })
  const [linkDate, setLinkDate] = useState('')
  const [linkEvents, setLinkEvents] = useState(null)
  const [linkLoading, setLinkLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(patch) {
    const merged = { ...form, ...patch }
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    })
    onSave(merged)
  }

  async function fetchLinkEvents() {
    if (!linkDate) return
    setLinkLoading(true)
    const r = await fetch(`/api/calendar/events-on-date?date=${linkDate}`)
    setLinkEvents(await r.json())
    setLinkLoading(false)
  }

  async function linkEvent(uid, title) {
    await save({ calendar_event_uid: uid, _linkedTitle: title })
  }

  async function unlinkEvent() {
    await save({ calendar_event_uid: null })
  }

  const inputStyle = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', padding: '7px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 11, color: 'var(--muted)', marginBottom: 4, display: 'block' }

  return (
    <div style={{
      width: 340, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Task Detail</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>Title</label>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            onBlur={() => save({})} style={inputStyle} />
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)}
            onBlur={() => save({})} rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {/* Priority */}
        <div>
          <label style={labelStyle}>Priority</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['low', 'medium', 'high'].map(p => (
              <button key={p} onClick={() => { set('priority', form.priority === p ? null : p); save({ priority: form.priority === p ? null : p }) }}
                style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${form.priority === p ? priorityColor[p] : 'var(--border)'}`,
                  background: form.priority === p ? `${priorityColor[p]}22` : 'var(--bg)',
                  color: form.priority === p ? priorityColor[p] : 'var(--muted)',
                }}>
                {priorityLabel[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div>
          <label style={labelStyle}>Due Date</label>
          <input type="date" value={form.due_date || ''} onChange={e => { set('due_date', e.target.value || null); save({ due_date: e.target.value || null }) }}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>

        {/* Project */}
        <div>
          <label style={labelStyle}>Project</label>
          <select value={form.project_id || ''} onChange={e => { set('project_id', e.target.value || null); save({ project_id: e.target.value || null }) }}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">Inbox</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Calendar link */}
        <div>
          <label style={labelStyle}>Calendar Event</label>
          {form.calendar_event_uid ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14 }}>🗓</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Linked</span>
              <button onClick={unlinkEvent} style={{ background: 'none', border: 'none', color: '#f7768e', cursor: 'pointer', fontSize: 11 }}>Unlink</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="date" value={linkDate} onChange={e => { setLinkDate(e.target.value); setLinkEvents(null) }}
                  style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }} />
                <button onClick={fetchLinkEvents} disabled={!linkDate || linkLoading}
                  style={{ padding: '7px 10px', borderRadius: 6, background: 'var(--accent)', color: '#1a1b26', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {linkLoading ? '…' : 'Find'}
                </button>
              </div>
              {linkEvents && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                  {linkEvents.length === 0
                    ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>No events on this date</div>
                    : linkEvents.map(ev => (
                      <div key={ev.uid} onClick={() => linkEvent(ev.uid, ev.title)}
                        style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 11 }}>{ev.calendar_name}</div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
        <button onClick={onDelete}
          style={{ width: '100%', padding: '8px 0', borderRadius: 6, background: 'rgba(247,118,142,0.1)', border: '1px solid #f7768e', color: '#f7768e', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Delete Task
        </button>
      </div>
    </div>
  )
}

// ── New project inline form ────────────────────────────────────────────────────
function NewProjectForm({ onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#7aa2f7')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    const r = await fetch(`/api/projects/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color }),
    })
    onCreated(await r.json())
  }

  return (
    <form onSubmit={submit} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ColorDotPicker value={color} onChange={setColor} />
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Project name"
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 8px', fontSize: 13 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" style={{ flex: 1, padding: '5px 0', borderRadius: 6, background: 'var(--accent)', color: '#1a1b26', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Create</button>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '5px 0', borderRadius: 6, background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
      </div>
    </form>
  )
}

// ── New task inline form ───────────────────────────────────────────────────────
function NewTaskForm({ projectId, onCreated, onCancel }) {
  const [title, setTitle] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    const r = await fetch(`/api/tasks/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), project_id: projectId || null }),
    })
    onCreated(await r.json())
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, padding: '0 0 12px' }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title…"
        style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', padding: '7px 10px', fontSize: 13 }} />
      <button type="submit" style={{ padding: '7px 14px', borderRadius: 6, background: 'var(--accent)', color: '#1a1b26', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Add</button>
      <button type="button" onClick={onCancel} style={{ padding: '7px 10px', borderRadius: 6, background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>
    </form>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [selected, setSelected] = useState('all')   // 'all' | 'inbox' | project.id
  const [showCompleted, setShowCompleted] = useState(false)
  const [sortBy, setSortBy] = useState('created')    // 'created' | 'due' | 'priority'
  const [activeTask, setActiveTask] = useState(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showArchivedProjects, setShowArchivedProjects] = useState(false)
  const [allProjects, setAllProjects] = useState([])

  async function loadAll() {
    const [tr, pr, apr] = await Promise.all([
      fetch(`/api/tasks/`).then(r => r.json()),
      fetch(`/api/projects/`).then(r => r.json()),
      fetch(`/api/projects/?include_archived=true`).then(r => r.json()),
    ])
    setTasks(tr)
    setProjects(pr)
    setAllProjects(apr)
  }

  useEffect(() => { loadAll() }, [])

  // ── filtered + sorted task list ──
  const visibleTasks = tasks
    .filter(t => {
      if (selected === 'all') return true
      if (selected === 'inbox') return !t.project_id
      return t.project_id === selected
    })
    .filter(t => showCompleted || !t.completed)
    .sort((a, b) => {
      if (sortBy === 'due') {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      }
      if (sortBy === 'priority') {
        const order = { high: 0, medium: 1, low: 2, null: 3 }
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
      }
      return new Date(b.created_at) - new Date(a.created_at)
    })

  async function toggleTask(task) {
    const r = await fetch(`/api/tasks/${task.id}/toggle`, { method: 'POST' })
    const updated = await r.json()
    setTasks(ts => ts.map(t => t.id === task.id ? updated : t))
    if (activeTask?.id === task.id) setActiveTask(updated)
  }

  async function deleteTask(id) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(ts => ts.filter(t => t.id !== id))
    setActiveTask(null)
  }

  function handleTaskSave(updated) {
    setTasks(ts => ts.map(t => t.id === updated.id ? updated : t))
    setActiveTask(updated)
  }

  const selectedLabel =
    selected === 'all' ? 'All Tasks'
    : selected === 'inbox' ? 'Inbox'
    : allProjects.find(p => p.id === selected)?.name ?? 'Tasks'

  const selectedProject = selected !== 'all' && selected !== 'inbox'
    ? allProjects.find(p => p.id === selected) : null

  const navItem = (id, label, color) => (
    <div key={id} onClick={() => { setSelected(id); setActiveTask(null); setShowNewTask(false) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6,
        cursor: 'pointer', fontSize: 13, fontWeight: selected === id ? 600 : 400,
        color: selected === id ? 'var(--text)' : 'var(--muted)',
        background: selected === id ? 'rgba(122,162,247,0.08)' : 'transparent',
        borderLeft: selected === id ? '3px solid var(--accent)' : '3px solid transparent',
      }}>
      {color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )

  const priorityOrder = { high: 0, medium: 1, low: 2 }

  return (
    <div style={{
      position: 'fixed', left: 210, top: 0, right: 0, bottom: 0,
      display: 'flex', background: 'var(--bg)',
    }}>
      {/* ── Left panel ── */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', flexDirection: 'column',
        padding: '16px 0',
      }}>
        <div style={{ padding: '0 12px 12px', fontSize: 16, fontWeight: 700 }}>Tasks</div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItem('all', 'All Tasks')}
          {navItem('inbox', 'Inbox')}

          {projects.length > 0 && (
            <div style={{ margin: '8px 12px 4px', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Projects
            </div>
          )}
          {projects.map(p => navItem(p.id, p.name, p.color))}

          {/* Archived projects toggle */}
          {allProjects.filter(p => p.archived).length > 0 && (
            <div onClick={() => setShowArchivedProjects(s => !s)}
              style={{ padding: '4px 12px', fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>
              {showArchivedProjects ? '▾' : '▸'} Archived
            </div>
          )}
          {showArchivedProjects && allProjects.filter(p => p.archived).map(p => navItem(p.id, p.name, p.color))}
        </div>

        {/* New project */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {showNewProject
            ? <NewProjectForm
                onCreated={p => { setAllProjects(ps => [...ps, p]); setProjects(ps => [...ps, p]); setShowNewProject(false); setSelected(p.id) }}
                onCancel={() => setShowNewProject(false)}
              />
            : <div onClick={() => setShowNewProject(true)}
                style={{ padding: '8px 12px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Project
              </div>
          }
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {selectedProject && (
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedProject.color }} />
          )}
          <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>{selectedLabel}</span>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
            <option value="created">Newest</option>
            <option value="due">Due Date</option>
            <option value="priority">Priority</option>
          </select>

          {/* Show completed toggle */}
          <button onClick={() => setShowCompleted(s => !s)}
            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)',
              background: showCompleted ? 'rgba(122,162,247,0.1)' : 'none',
              color: showCompleted ? 'var(--accent)' : 'var(--muted)' }}>
            Completed
          </button>

          {/* New task */}
          <button onClick={() => setShowNewTask(t => !t)}
            style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#1a1b26', border: 'none' }}>
            + New Task
          </button>
        </div>

        {/* Task list area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {showNewTask && (
            <NewTaskForm
              projectId={selected !== 'all' && selected !== 'inbox' ? selected : null}
              onCreated={t => { setTasks(ts => [t, ...ts]); setShowNewTask(false); setActiveTask(t) }}
              onCancel={() => setShowNewTask(false)}
            />
          )}

          {visibleTasks.length === 0 && !showNewTask && (
            <div style={{ color: 'var(--muted)', fontSize: 13, paddingTop: 20, textAlign: 'center' }}>
              {showCompleted ? 'No tasks here.' : 'No open tasks. Click "+ New Task" to add one.'}
            </div>
          )}

          {visibleTasks.map(t => {
            const proj = t.project_id ? allProjects.find(p => p.id === t.project_id) : null
            const isActive = activeTask?.id === t.id
            return (
              <div key={t.id} onClick={() => setActiveTask(isActive ? null : t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                  background: isActive ? 'rgba(122,162,247,0.06)' : 'transparent',
                  border: isActive ? '1px solid rgba(122,162,247,0.2)' : '1px solid transparent',
                  borderLeft: proj && selected === 'all' ? `3px solid ${proj.color}` : isActive ? '3px solid rgba(122,162,247,0.2)' : '3px solid transparent',
                  transition: 'background 0.1s',
                }}>
                {/* Checkbox */}
                <div onClick={e => { e.stopPropagation(); toggleTask(t) }}
                  style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    border: `2px solid ${t.completed ? '#9ece6a' : 'var(--border)'}`,
                    background: t.completed ? '#9ece6a' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {t.completed && <span style={{ color: '#1a1b26', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>

                {/* Title */}
                <span style={{
                  flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: t.completed ? 'var(--muted)' : 'var(--text)',
                  textDecoration: t.completed ? 'line-through' : 'none',
                }}>
                  {t.title}
                </span>

                {/* Priority badge */}
                {t.priority && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: priorityColor[t.priority], flexShrink: 0 }}>
                    {priorityLabel[t.priority]}
                  </span>
                )}

                {/* Due date */}
                {t.due_date && (
                  <span style={{ fontSize: 11, color: isPast(t.due_date) && !t.completed ? '#f7768e' : 'var(--muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    📅 {fmtDate(t.due_date)}
                  </span>
                )}

                {/* Calendar link indicator */}
                {t.calendar_event_uid && (
                  <span style={{ fontSize: 12, flexShrink: 0 }} title="Linked to calendar event">🗓</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Detail panel ── */}
      {activeTask && (
        <TaskDetail
          key={activeTask.id}
          task={activeTask}
          projects={projects}
          onSave={handleTaskSave}
          onDelete={() => deleteTask(activeTask.id)}
          onClose={() => setActiveTask(null)}
        />
      )}
    </div>
  )
}
