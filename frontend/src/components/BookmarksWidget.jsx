import { useEffect, useState } from 'react'

const EMPTY_FORM = { name: '', url: '', category: '', icon: '' }

export default function BookmarksWidget() {
  const [bookmarks, setBookmarks] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)

  const fetchBookmarks = () =>
    fetch('/api/bookmarks/').then(r => r.json()).then(setBookmarks)

  useEffect(() => { fetchBookmarks() }, [])

  const grouped = bookmarks.reduce((acc, b) => {
    const cat = b.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(b)
    return acc
  }, {})

  const submit = e => {
    e.preventDefault()
    fetch('/api/bookmarks/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        url: form.url,
        category: form.category || 'general',
        icon: form.icon || null,
      }),
    }).then(() => { fetchBookmarks(); setForm(EMPTY_FORM); setAdding(false) })
  }

  const remove = id => {
    fetch(`/api/bookmarks/${id}`, { method: 'DELETE' }).then(fetchBookmarks)
  }

  return (
    <div className="widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="widget-title" style={{ marginBottom: 0 }}>Bookmarks</div>
        <button className="btn-ghost" onClick={() => setAdding(a => !a)}>
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {adding && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8, marginBottom: 16, padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder="URL *" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input placeholder="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            <input placeholder="Icon URL (optional)" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
          </div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
      )}

      {Object.keys(grouped).length === 0
        ? <p style={{ color: 'var(--muted)' }}>No bookmarks yet. Add one above.</p>
        : Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{cat}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                  {b.icon && <img src={b.icon} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />}
                  <a href={b.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>{b.name}</a>
                  <button onClick={() => remove(b.id)} style={{ background: 'none', padding: '0 2px', color: 'var(--muted)', fontSize: 16, lineHeight: 1 }} title="Remove">×</button>
                </div>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  )
}
