import { useState, useEffect } from 'react'

const STATUS_COLORS = {
  'Complete':    '#9ece6a',
  'In progress': '#e0af68',
  'Planned':     '#7aa2f7',
  'Exploratory': '#565f89',
}

const PRIORITY_COLORS = {
  'High':   '#f7768e',
  'Medium': '#e0af68',
  'Low':    '#9ece6a',
  'N/A':    '#565f89',
}

const STATUSES   = ['Complete', 'In progress', 'Planned', 'Exploratory']
const PRIORITIES = ['High', 'Medium', 'Low', 'N/A']

function sc(status)   { return STATUS_COLORS[status]   || '#565f89' }
function pc(priority) { return PRIORITY_COLORS[priority] || '#565f89' }

const inlineBadgeSelect = (color) => ({
  appearance: 'none', WebkitAppearance: 'none', border: 'none', outline: 'none',
  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
  background: color + '22', color, cursor: 'pointer', flexShrink: 0,
})

// ── Roadmap Card ──────────────────────────────────────────────────────────────
function RoadmapCard({ item, isActive, onClick, onQuickUpdate }) {
  const [hovered, setHovered] = useState(false)
  const snippet = item.notes && item.notes.length > 0
    ? (item.notes.length > 60 ? item.notes.slice(0, 60) + '…' : item.notes)
    : null

  return (
    <div
      id={'card-' + item.id}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#161b24',
        border: `1px solid ${isActive || hovered ? '#7aa2f7' : '#252d3d'}`,
        borderRadius: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Status bar */}
      <div style={{ height: 3, background: sc(item.status), borderRadius: '10px 10px 0 0', flexShrink: 0 }} />
      {/* Content */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#c0caf5', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          <span>{item.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <select
            value={item.status}
            onClick={e => e.stopPropagation()}
            onChange={e => onQuickUpdate(item.id, 'status', e.target.value)}
            style={inlineBadgeSelect(sc(item.status))}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={item.priority}
            onClick={e => e.stopPropagation()}
            onChange={e => onQuickUpdate(item.id, 'priority', e.target.value)}
            style={inlineBadgeSelect(pc(item.priority))}
          >
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {item.target_date && (
            <span style={{ fontSize: 11, color: '#565f89', flexShrink: 0 }}>{item.target_date}</span>
          )}
        </div>
        {snippet && (
          <div style={{ fontSize: 11, color: '#565f89', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            <span>{snippet}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PanelBadgeSelect({ value, color, options, onChange }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch' }}>
      <select
        value={value}
        onChange={onChange}
        style={{ ...inlineBadgeSelect(color), fontSize: 12, paddingRight: 26 }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 22,
        borderLeft: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <svg width="8" height="5" viewBox="0 0 8 5" fill={color}>
          <path d="M0 0.5L4 4.5L8 0.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ item, items, panelMode, onClose, onEdit, onSave, onDelete, onNavigate, onQuickUpdate }) {
  const [form, setForm] = useState({
    title: '', section: '', status: 'Planned', priority: 'Medium',
    target_date: '', notes: '', depends_on: [],
  })
  const [focused, setFocused] = useState(null)

  // Re-initialize form whenever we enter edit or create mode
  useEffect(() => {
    if (panelMode === 'edit' && item) {
      setForm({
        title:       item.title,
        section:     item.section,
        status:      item.status,
        priority:    item.priority,
        target_date: item.target_date || '',
        notes:       item.notes || '',
        depends_on:  [...(item.depends_on || [])],
      })
    } else if (panelMode === 'create') {
      setForm({ title: '', section: '', status: 'Planned', priority: 'Medium', target_date: '', notes: '', depends_on: [] })
    }
  }, [panelMode, item?.id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function toggleDep(id) {
    set('depends_on', form.depends_on.includes(id)
      ? form.depends_on.filter(d => d !== id)
      : [...form.depends_on, id])
  }

  function inputStyle(field) {
    return {
      background: '#0d0f14',
      border: `1px solid ${focused === field ? '#7aa2f7' : '#252d3d'}`,
      borderRadius: 6,
      padding: '7px 10px',
      color: '#c0caf5',
      fontFamily: 'inherit',
      fontSize: 13,
      width: '100%',
      boxSizing: 'border-box',
    }
  }

  const labelStyle = { fontSize: 11, color: '#565f89', marginBottom: 4, display: 'block' }
  const dividerStyle = { borderTop: '1px solid #252d3d', margin: '4px 0' }

  async function handleSave() {
    await onSave({
      ...form,
      target_date: form.target_date.trim() || null,
      notes: form.notes.trim(),
    })
  }

  const isOpen = panelMode !== null

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 0, bottom: 0,
        right: isOpen ? 0 : -300,
        width: 300,
        background: '#161b24',
        borderLeft: '1px solid #252d3d',
        display: 'flex',
        flexDirection: 'column',
        transition: 'right 0.22s ease',
        zIndex: 10,
      }}
    >
      {/* Top status bar */}
      <div style={{
        height: 4, flexShrink: 0,
        background: panelMode === 'view' && item ? sc(item.status) : '#7aa2f7',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #252d3d', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#c0caf5', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
          <span>
            {panelMode === 'create' ? 'New Item'
              : panelMode === 'edit' ? 'Edit Item'
              : item?.title || ''}
          </span>
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#565f89',
          cursor: 'pointer', fontSize: 18, lineHeight: 1, marginLeft: 8, flexShrink: 0,
        }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── View mode ── */}
        {panelMode === 'view' && item && (<>
          <div>
            <div style={labelStyle}>Status</div>
            <PanelBadgeSelect
              value={item.status}
              color={sc(item.status)}
              options={STATUSES}
              onChange={e => onQuickUpdate(item.id, 'status', e.target.value)}
            />
          </div>

          <div>
            <div style={labelStyle}>Priority</div>
            <PanelBadgeSelect
              value={item.priority}
              color={pc(item.priority)}
              options={PRIORITIES}
              onChange={e => onQuickUpdate(item.id, 'priority', e.target.value)}
            />
          </div>

          {item.target_date && (
            <div>
              <div style={labelStyle}>Target Date</div>
              <span style={{ fontSize: 13, color: '#c0caf5' }}>{item.target_date}</span>
            </div>
          )}

          <div style={dividerStyle} />

          <div>
            <div style={labelStyle}>Notes</div>
            <div style={{
              background: '#0d0f14', border: '1px solid #252d3d', borderRadius: 6,
              padding: '9px 11px', fontSize: 13, color: item.notes ? '#c0caf5' : '#565f89',
              whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: 120, lineHeight: 1.5,
            }}>
              {item.notes || 'No notes.'}
            </div>
          </div>

          <div style={dividerStyle} />

          <div>
            <div style={labelStyle}>Depends on</div>
            {item.depends_on && item.depends_on.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.depends_on.map(depId => {
                  const dep = items.find(i => i.id === depId)
                  if (!dep) {
                    return (
                      <div key={depId} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 9px', borderRadius: 6,
                        background: '#0d0f14', border: '1px solid #252d3d',
                        fontSize: 12, color: '#565f89',
                      }}>
                        Unknown item
                      </div>
                    )
                  }
                  return (
                    <div key={depId} onClick={() => onNavigate(dep)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 9px', borderRadius: 6,
                      background: '#0d0f14', border: '1px solid #252d3d',
                      cursor: 'pointer', fontSize: 12, color: '#c0caf5',
                    }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc(dep.status), flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        <span>{dep.title}</span>
                      </span>
                      <span style={{ color: '#565f89', flexShrink: 0 }}>→</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#2e3552' }}>No dependencies</div>
            )}
          </div>
        </>)}

        {/* ── Edit / Create mode ── */}
        {(panelMode === 'edit' || panelMode === 'create') && (<>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              style={inputStyle('title')} onFocus={() => setFocused('title')} onBlur={() => setFocused(null)} />
          </div>

          <div>
            <label style={labelStyle}>Section</label>
            <input value={form.section} onChange={e => set('section', e.target.value)}
              style={inputStyle('section')} onFocus={() => setFocused('section')} onBlur={() => setFocused(null)} />
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              style={inputStyle('status')} onFocus={() => setFocused('status')} onBlur={() => setFocused(null)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              style={inputStyle('priority')} onFocus={() => setFocused('priority')} onBlur={() => setFocused(null)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Target Date</label>
            <input value={form.target_date} onChange={e => set('target_date', e.target.value)}
              placeholder="e.g. May 1"
              style={inputStyle('target_date')} onFocus={() => setFocused('target_date')} onBlur={() => setFocused(null)} />
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4}
              style={{ ...inputStyle('notes'), resize: 'vertical', fontFamily: 'inherit' }}
              onFocus={() => setFocused('notes')} onBlur={() => setFocused(null)} />
          </div>

          <div>
            <label style={labelStyle}>Depends on</label>
            {items.filter(i => i.id !== item?.id).length === 0 ? (
              <div style={{ fontSize: 12, color: '#565f89' }}>No other items to depend on</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                {items.filter(i => i.id !== item?.id).map(i => (
                  <label key={i.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', borderRadius: 6,
                    background: '#0d0f14', border: '1px solid #252d3d',
                    cursor: 'pointer', fontSize: 12, color: '#c0caf5',
                  }}>
                    <input type="checkbox" checked={form.depends_on.includes(i.id)}
                      onChange={() => toggleDep(i.id)} style={{ accentColor: '#7aa2f7', flexShrink: 0 }} />
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc(i.status), flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <span>{i.title}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </>)}
      </div>

      {/* Footer */}
      <div style={{ padding: 16, borderTop: '1px solid #252d3d', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {panelMode === 'view' && (<>
          <button onClick={onEdit} style={{
            padding: '7px 0', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: 'rgba(122,162,247,0.1)', border: '1px solid #7aa2f7', color: '#7aa2f7',
          }}>Edit</button>
          <button onClick={onDelete} style={{
            padding: '7px 0', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: 'rgba(247,118,142,0.1)', border: '1px solid #f7768e', color: '#f7768e',
          }}>Delete</button>
        </>)}

        {(panelMode === 'edit' || panelMode === 'create') && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: '#7aa2f7', border: 'none', color: '#1a1b26',
            }}>Save</button>
            <button onClick={onClose} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              background: 'none', border: '1px solid #252d3d', color: '#565f89',
            }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const [items, setItems]                     = useState([])
  const [selectedId, setSelectedId]           = useState(null)
  const [panelMode, setPanelMode]             = useState(null)  // 'view' | 'edit' | 'create' | null
  const [expandedSections, setExpandedSections] = useState({})
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState(null)

  async function fetchItems() {
    try {
      const r = await fetch(`/api/roadmap/`)
      if (!r.ok) throw new Error('server error')
      setItems(await r.json())
      setError(null)
    } catch {
      setError('Could not load roadmap data.')
    }
  }

  useEffect(() => {
    fetchItems().finally(() => setLoading(false))
  }, [])

  // Derive sections in insertion order (first-seen)
  const sections = []
  const seenSections = new Set()
  for (const item of items) {
    if (!seenSections.has(item.section)) {
      sections.push(item.section)
      seenSections.add(item.section)
    }
  }

  function isSectionExpanded(section) {
    return section in expandedSections ? expandedSections[section] : true
  }

  function toggleSection(section) {
    setExpandedSections(prev => ({ ...prev, [section]: !isSectionExpanded(section) }))
  }

  const selectedItem = items.find(i => i.id === selectedId) || null

  // ── Interaction handlers ──────────────────────────────────────────────────
  function handleCardClick(item) {
    if (panelMode === 'edit' && selectedId !== item.id) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return
    }
    setSelectedId(item.id)
    setPanelMode('view')
  }

  function handleNewItem() {
    if (panelMode === 'edit' || panelMode === 'create') {
      if (!window.confirm('You have unsaved changes. Discard them?')) return
    }
    setSelectedId(null)
    setPanelMode('create')
  }

  function handleOutsideClick() {
    if (panelMode === 'view') {
      setSelectedId(null)
      setPanelMode(null)
    }
    // Do nothing when in edit or create — unsaved changes protected
  }

  function handleClose() {
    if (panelMode === 'edit') {
      // Cancel edit → return to view mode for the same item
      setPanelMode('view')
    } else {
      setSelectedId(null)
      setPanelMode(null)
    }
  }

  function handleEdit() {
    setPanelMode('edit')
  }

  function handleNavigate(dep) {
    setSelectedId(dep.id)
    setPanelMode('view')
    setExpandedSections(prev => ({ ...prev, [dep.section]: true }))
    setTimeout(() => {
      document.getElementById('card-' + dep.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }

  async function handleSave(formData) {
    if (panelMode === 'create') {
      const r = await fetch(`/api/roadmap/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err.detail || 'Save failed.')
        return
      }
      const created = await r.json()
      await fetchItems()
      setSelectedId(created.id)
      setPanelMode('view')
    } else if (panelMode === 'edit' && selectedId) {
      const r = await fetch(`/api/roadmap/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err.detail || 'Save failed.')
        return
      }
      await fetchItems()
      setPanelMode('view')
    }
  }

  async function handleDelete() {
    if (!selectedId) return
    await fetch(`/api/roadmap/${selectedId}`, { method: 'DELETE' })
    await fetchItems()
    setSelectedId(null)
    setPanelMode(null)
  }

  async function handleQuickUpdate(id, field, value) {
    await fetch(`/api/roadmap/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    await fetchItems()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={handleOutsideClick}
      style={{
        position: 'fixed', left: 210, top: 0, right: 0, bottom: 0,
        background: '#0d0f14', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid #252d3d', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#c0caf5' }}>Roadmap</span>
        <button
          onClick={e => { e.stopPropagation(); handleNewItem() }}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: '#7aa2f7', color: '#1a1b26', border: 'none',
          }}
        >
          + New item
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading && (
          <div style={{ color: '#565f89', fontSize: 13, paddingTop: 20, textAlign: 'center' }}>Loading…</div>
        )}

        {error && !loading && (
          <div style={{ color: '#f7768e', fontSize: 13, paddingTop: 20, textAlign: 'center' }}>{error}</div>
        )}

        {!loading && !error && sections.length === 0 && (
          <div style={{ color: '#565f89', fontSize: 13, paddingTop: 40, textAlign: 'center' }}>
            No items yet. Click &quot;+ New item&quot; to get started.
          </div>
        )}

        {!loading && !error && sections.map(section => {
          const sectionItems = items.filter(i => i.section === section)
          const expanded = isSectionExpanded(section)

          return (
            <div key={section} style={{ marginBottom: 28 }}>
              {/* Section header */}
              <div
                onClick={e => { e.stopPropagation(); toggleSection(section) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 4px', marginBottom: expanded ? 12 : 0,
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                {/* Chevron */}
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#565f89" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>

                <span style={{ fontSize: 13, fontWeight: 700, color: '#c0caf5' }}>{section}</span>

                {/* Count badge */}
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
                  background: '#252d3d', color: '#565f89',
                }}>
                  {sectionItems.length}
                </span>
              </div>

              {/* Card grid */}
              {expanded && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}>
                  {sectionItems.map(item => (
                    <RoadmapCard
                      key={item.id}
                      item={item}
                      isActive={item.id === selectedId}
                      onClick={e => { e.stopPropagation(); handleCardClick(item) }}
                      onQuickUpdate={handleQuickUpdate}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Slide-in detail panel (always rendered for transition) */}
      <DetailPanel
        item={selectedItem}
        items={items}
        panelMode={panelMode}
        onClose={handleClose}
        onEdit={handleEdit}
        onSave={handleSave}
        onDelete={handleDelete}
        onNavigate={handleNavigate}
        onQuickUpdate={handleQuickUpdate}
      />
    </div>
  )
}
