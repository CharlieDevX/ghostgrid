import { useEffect, useState } from 'react'

const EMPTY = { title: '', body: '' }

export default function NotesWidget() {
  const [notes, setNotes] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [open, setOpen] = useState(false)

  const fetchNotes = () =>
    fetch('/api/notes/').then(r => r.json()).then(data => setNotes([...data].reverse()))

  useEffect(() => { fetchNotes() }, [])

  const startEdit = note => {
    setForm({ title: note.title, body: note.body })
    setEditingId(note.id)
    setOpen(true)
  }

  const reset = () => { setForm(EMPTY); setEditingId(null); setOpen(false) }

  const submit = e => {
    e.preventDefault()
    const url = editingId ? `/api/notes/${editingId}` : '/api/notes/'
    const method = editingId ? 'PUT' : 'POST'
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(() => { fetchNotes(); reset() })
  }

  const remove = id => {
    fetch(`/api/notes/${id}`, { method: 'DELETE' }).then(fetchNotes)
  }

  return (
    <div className="widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="widget-title" style={{ marginBottom: 0 }}>Notes</div>
        <button className="btn-ghost" onClick={() => { reset(); setOpen(o => !o) }}>
          {open && !editingId ? 'Cancel' : '+ New'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8, marginBottom: 16, padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <input
            placeholder="Title *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <textarea
            placeholder="Body"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-primary">{editingId ? 'Update' : 'Save'}</button>
            {editingId && <button type="button" className="btn-ghost" onClick={reset}>Cancel</button>}
          </div>
        </form>
      )}

      {notes.length === 0
        ? <p style={{ color: 'var(--muted)' }}>No notes yet.</p>
        : notes.map(n => (
          <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{n.title}</div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => startEdit(n)}>Edit</button>
                <button className="btn-danger" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => remove(n.id)}>Delete</button>
              </div>
            </div>
            {n.body && <p style={{ color: 'var(--muted)', marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 13 }}>{n.body}</p>}
            <div style={{ fontSize: 11, color: 'var(--border)', marginTop: 6 }}>
              {new Date(n.updated_at).toLocaleString()}
            </div>
          </div>
        ))
      }
    </div>
  )
}
