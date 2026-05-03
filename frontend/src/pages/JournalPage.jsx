import { useState, useEffect, useRef } from 'react'
import './JournalPage.css'

// ── date helpers ──────────────────────────────────────────────────────────────
function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Parse YYYY-MM-DD as local noon (avoids UTC date-shift on negative offsets).
function parseLocal(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function fmtFullDate(date) {
  return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
}
function fmtWeekday(date) {
  return date.toLocaleDateString([], { weekday: 'long' })
}
function fmtShort(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function JournalPage() {
  const [entries, setEntries]             = useState([])
  const [selectedDate, setSelectedDate]   = useState(null)
  const [body, setBody]                   = useState('')
  const [lastSavedBody, setLastSavedBody] = useState('')
  const [saveState, setSaveState]         = useState('idle') // 'idle'|'dirty'|'saving'|'saved'|'error'
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerValue, setPickerValue]     = useState(todayLocal())
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [editorFading, setEditorFading]   = useState(false)

  const debounceRef = useRef(null)
  const tokenRef    = useRef(0)

  // ── data ────────────────────────────────────────────────────────────────────
  async function fetchEntries() {
    try {
      const r = await fetch('/api/journal/')
      if (!r.ok) throw new Error('server error')
      setEntries(await r.json())
      setError(null)
    } catch {
      setError('Could not load journal entries.')
    }
  }

  useEffect(() => {
    fetchEntries().finally(() => setLoading(false))
  }, [])

  // Cross-fade textarea content briefly when switching dates.
  useEffect(() => {
    if (!selectedDate) return
    setEditorFading(true)
    const t = setTimeout(() => setEditorFading(false), 80)
    return () => clearTimeout(t)
  }, [selectedDate])

  // ── save flow ───────────────────────────────────────────────────────────────
  async function flushSave(date, bodyToSave) {
    const myToken = ++tokenRef.current
    setSaveState('saving')
    try {
      const r = await fetch(`/api/journal/${date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: bodyToSave }),
      })
      if (!r.ok) throw new Error('save failed')
      if (myToken !== tokenRef.current) return
      setLastSavedBody(bodyToSave)
      setSaveState('saved')
      fetchEntries()
      setTimeout(() => {
        setSaveState(s => (s === 'saved' ? 'idle' : s))
      }, 1500)
    } catch {
      if (myToken === tokenRef.current) setSaveState('error')
    }
  }

  function handleBodyChange(v) {
    setBody(v)
    if (!selectedDate) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (v === lastSavedBody) {
      setSaveState('idle')
      return
    }

    setSaveState('dirty')
    const target = selectedDate
    debounceRef.current = setTimeout(() => {
      const existing = entries.find(e => e.date === target)
      if (v === '' && !existing) {
        setSaveState('idle')
        return
      }
      flushSave(target, v)
    }, 800)
  }

  async function handleSelectDate(newDate) {
    if (newDate === selectedDate) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (saveState === 'dirty' && selectedDate) {
      const existing = entries.find(e => e.date === selectedDate)
      if (!(body === '' && !existing)) {
        await flushSave(selectedDate, body)
      }
    }

    setSelectedDate(newDate)
    const newEntry = entries.find(e => e.date === newDate)
    const newBody = newEntry?.body || ''
    setBody(newBody)
    setLastSavedBody(newBody)
    setSaveState('idle')
    setShowDatePicker(false)
  }

  async function handleDelete() {
    if (!selectedDate) return
    const existing = entries.find(e => e.date === selectedDate)
    if (!existing) return
    const label = fmtFullDate(parseLocal(selectedDate))
    if (!window.confirm(`Delete journal entry for ${label}?`)) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    tokenRef.current++ // invalidate any in-flight save
    await fetch(`/api/journal/${selectedDate}`, { method: 'DELETE' })
    await fetchEntries()
    setSelectedDate(null)
    setBody('')
    setLastSavedBody('')
    setSaveState('idle')
  }

  // ── derived row list ────────────────────────────────────────────────────────
  const today = todayLocal()
  const todayEntry = entries.find(e => e.date === today)
  const others = entries.filter(e => e.date !== today)
  const rows = [
    { date: today, body: todayEntry?.body || '', isToday: true, exists: !!todayEntry },
    ...others.map(e => ({ date: e.date, body: e.body, isToday: false, exists: true })),
  ]

  const selectedRow    = rows.find(r => r.date === selectedDate)
  const selectedExists = selectedRow?.exists || false

  // ── save indicator descriptor ───────────────────────────────────────────────
  function indicator() {
    if (saveState === 'idle')   return null
    if (saveState === 'dirty')  return { dotColor: 'var(--muted)',  label: 'Editing…',     italic: true,  mod: 'dirty' }
    if (saveState === 'saving') return { dotColor: 'var(--accent)', label: 'Saving…',      italic: true,  mod: 'saving' }
    if (saveState === 'saved')  return { dotColor: 'var(--muted)',  label: 'Saved',        italic: false, mod: 'saved' }
    if (saveState === 'error')  return { dotColor: 'var(--danger)', label: 'Save failed',  italic: false, mod: 'error' }
    return null
  }
  const ind = indicator()

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="journal-page"
      style={{
        position: 'fixed', left: 210, top: 0, right: 0, bottom: 0,
        display: 'flex', background: 'var(--bg)',
      }}
    >
      {/* ── Left list panel ─────────────────────────────────────────────── */}
      <div
        className="journal-list-panel"
        style={{
          width: 240, flexShrink: 0, borderRight: '1px solid var(--border)',
          background: 'var(--surface)', display: 'flex', flexDirection: 'column',
          padding: '20px 0',
        }}
      >
        <div style={{ padding: '0 16px 16px', fontSize: 16, fontWeight: 700, letterSpacing: '0.01em' }}>
          Journal
        </div>

        {/* + New entry (backfill picker) */}
        <div style={{ padding: '0 12px 10px' }}>
          {showDatePicker ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="date"
                className="journal-date-input"
                value={pickerValue}
                max={today}
                onChange={e => setPickerValue(e.target.value)}
                style={{
                  flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text)', padding: '5px 7px',
                  fontFamily: 'inherit', fontSize: 12,
                }}
              />
              <button
                onClick={() => handleSelectDate(pickerValue)}
                style={{
                  padding: '5px 11px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  background: 'var(--accent)', color: '#1a1b26', border: 'none', cursor: 'pointer',
                }}
              >Go</button>
              <button
                onClick={() => setShowDatePicker(false)}
                style={{
                  padding: '5px 9px', borderRadius: 6, fontSize: 12,
                  background: 'none', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >×</button>
            </div>
          ) : (
            <button
              className="journal-new-entry-btn"
              onClick={() => { setPickerValue(today); setShowDatePicker(true) }}
              style={{
                width: '100%', padding: '7px 12px', borderRadius: 6, fontSize: 12,
                background: 'none', color: 'var(--muted)', border: '1px dashed var(--border)',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >+ New entry</button>
          )}
        </div>

        {/* Date list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, padding: '0 8px' }}>
          {loading && (
            <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 12px' }}>Loading…</div>
          )}
          {error && !loading && (
            <div style={{ color: 'var(--danger)', fontSize: 12, padding: '8px 12px' }}>{error}</div>
          )}
          {!loading && !error && rows.map(row => {
            const isSelected = row.date === selectedDate
            const d = parseLocal(row.date)
            const snippet = row.body
              ? (row.body.length > 64 ? row.body.slice(0, 64) + '…' : row.body)
              : (row.exists ? '' : 'No entry yet')

            return (
              <div
                key={row.date}
                tabIndex={0}
                role="button"
                onClick={() => handleSelectDate(row.date)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectDate(row.date) } }}
                className="journal-list-row"
                style={{
                  padding: '10px 10px 10px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                  background: isSelected ? 'rgba(122, 162, 247, 0.10)' : 'transparent',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: isSelected ? 'var(--accent)' : 'var(--text)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1,
                  }}>
                    <span>{fmtShort(d)}</span>
                  </span>
                  {row.isToday && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: 'rgba(122, 162, 247, 0.15)', color: 'var(--accent)',
                      letterSpacing: '0.08em', flexShrink: 0,
                    }}>
                      {!row.exists && (
                        <span
                          className="journal-today-dot"
                          style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: 'var(--accent)',
                          }}
                        />
                      )}
                      TODAY
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--muted)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontStyle: row.body ? 'normal' : 'italic',
                  lineHeight: 1.4,
                }}>
                  <span>{snippet}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right editor panel — paper mode ─────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: 'linear-gradient(180deg, var(--paper-bg-top) 0%, var(--paper-bg-bottom) 100%)',
      }}>
        {selectedDate ? (
          <>
            {/* Header */}
            <div
              className="journal-editor-header"
              style={{
                padding: '24px 32px 18px',
                display: 'flex', alignItems: 'flex-end', gap: 16, flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
                  color: 'var(--paper-muted)', textTransform: 'uppercase',
                }}>
                  {fmtWeekday(parseLocal(selectedDate))}
                </span>
                <span style={{
                  fontFamily: "'Lora', 'Charter', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
                  fontSize: 24, fontWeight: 600, color: 'var(--paper-text)',
                  letterSpacing: '0.005em',
                }}>
                  {fmtFullDate(parseLocal(selectedDate))}
                </span>
              </div>

              {ind && (
                <span
                  className={`journal-save-label journal-save--${ind.mod}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    fontSize: 11, color: ind.dotColor,
                    fontStyle: ind.italic ? 'italic' : 'normal',
                    letterSpacing: '0.02em',
                  }}
                >
                  <span className="journal-save-dot" style={{ background: ind.dotColor }} />
                  {ind.label}
                </span>
              )}

              {selectedExists && (
                <button
                  className="journal-delete-btn"
                  onClick={handleDelete}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                    background: 'none', border: '1px solid rgba(247, 118, 142, 0.4)',
                    color: 'var(--danger)', fontFamily: 'inherit', letterSpacing: '0.02em',
                  }}
                >Delete</button>
              )}
            </div>

            {/* Editor — capped reading width */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              padding: '0 32px 32px',
            }}>
              <div style={{
                flex: 1, width: '100%', maxWidth: 680,
                margin: '0 auto', display: 'flex', flexDirection: 'column',
              }}>
                <textarea
                  className={`journal-editor-textarea ${editorFading ? 'journal-editor-fading' : ''}`}
                  value={body}
                  onChange={e => handleBodyChange(e.target.value)}
                  placeholder="Start writing…"
                  spellCheck={true}
                  style={{
                    flex: 1, width: '100%', boxSizing: 'border-box',
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--paper-text)',
                    padding: '12px 4px',
                    fontSize: 16, lineHeight: 1.75,
                    resize: 'none',
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--paper-muted)', gap: 14,
          }}>
            <svg
              width="56" height="56" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.25"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: 0.7 }}
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <div style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: 16, color: 'var(--paper-text)', textAlign: 'center',
              lineHeight: 1.6,
            }}>
              Click <span style={{ color: 'var(--accent)' }}>Today</span> to start writing.
            </div>
            <div style={{
              fontSize: 12, color: 'var(--paper-muted)',
              fontStyle: 'italic', textAlign: 'center',
            }}>
              Your words stay on this machine.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
