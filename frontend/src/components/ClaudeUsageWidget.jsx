import { useEffect, useState } from 'react'

function UsageBar({ label, pct, sublabel }) {
  const cls = pct >= 95 ? 'crit' : pct >= 80 ? 'warn' : ''
  const color = pct >= 95 ? 'var(--danger)' : pct >= 80 ? '#e0af68' : 'var(--accent)'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</span>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {sublabel && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{sublabel}</div>
      )}
    </div>
  )
}

function formatCountdown(isoString) {
  if (!isoString) return null
  const diff = new Date(isoString) - Date.now()
  if (diff <= 0) return 'resetting now'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `resets in ${h}h ${m}m`
  return `resets in ${m}m`
}

function humanLabel(key) {
  return key
    .replace(/claude_3_5_sonnet|claude_3_7_sonnet|claude_sonnet/gi, 'Sonnet')
    .replace(/claude_3_opus|claude_opus/gi, 'Opus')
    .replace(/claude_3_haiku|claude_haiku/gi, 'Haiku')
    .replace(/_5_hour|_5hour|_window/gi, ' (5h window)')
    .replace(/_week(ly)?/gi, ' weekly')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase())
}

function parseStats(raw) {
  const bars = []

  // Pattern 1: explicit _pct / _percent fields (0–100 or 0–1)
  const pctKeys = Object.keys(raw).filter(
    k => (k.endsWith('_pct') || k.endsWith('_percent')) && typeof raw[k] === 'number'
  )
  if (pctKeys.length > 0) {
    for (const k of pctKeys) {
      const val = raw[k]
      const pct = val > 1 ? val : val * 100
      const base = k.replace(/_pct$|_percent$/, '')
      const resetKey = [base + '_reset_at', base + '_end', base + '_expires_at'].find(rk => raw[rk])
      bars.push({ label: humanLabel(base), pct, sublabel: resetKey ? formatCountdown(raw[resetKey]) : null })
    }
    return bars
  }

  // Pattern 2: count + limit pairs  e.g. message_5_hour_count / message_5_hour_limit
  const countKeys = Object.keys(raw).filter(k => k.endsWith('_count') && typeof raw[k] === 'number')
  for (const ck of countKeys) {
    const base = ck.replace(/_count$/, '')
    const lk = base + '_limit'
    if (raw[lk] && raw[lk] > 0) {
      const pct = (raw[ck] / raw[lk]) * 100
      const resetKey = [base + '_reset_at', base + '_end'].find(rk => raw[rk])
      bars.push({ label: humanLabel(base), pct, sublabel: resetKey ? formatCountdown(raw[resetKey]) : null })
    }
  }

  // Pattern 3: usage_pct / remaining fields (some versions return these directly)
  for (const k of ['usage_pct', 'session_usage_pct', 'weekly_usage_pct', 'sonnet_usage_pct']) {
    if (typeof raw[k] === 'number' && !bars.find(b => b.label.toLowerCase().includes(k.split('_')[0]))) {
      const pct = raw[k] > 1 ? raw[k] : raw[k] * 100
      bars.push({ label: humanLabel(k.replace(/_pct$/, '')), pct, sublabel: null })
    }
  }

  return bars
}

export default function ClaudeUsageWidget() {
  const [status, setStatus]         = useState('loading')   // loading | disconnected | connected
  const [data, setData]             = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [keyInput, setKeyInput]     = useState('')
  const [connectError, setConnectError] = useState(null)
  const [showRaw, setShowRaw]       = useState(false)
  const [saving, setSaving]         = useState(false)

  const checkStatus = () =>
    fetch('/api/claude-usage/status')
      .then(r => r.json())
      .then(d => setStatus(d.connected ? 'connected' : 'disconnected'))
      .catch(() => setStatus('disconnected'))

  const fetchStats = () =>
    fetch('/api/claude-usage/stats')
      .then(r => {
        if (r.status === 401) { setStatus('disconnected'); return null }
        if (!r.ok) return null
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(() => {})

  useEffect(() => { checkStatus() }, [])

  useEffect(() => {
    if (status !== 'connected') return
    fetchStats()
    const id = setInterval(fetchStats, 60000)
    return () => clearInterval(id)
  }, [status])

  const handleConnect = () => {
    setSaving(true)
    setConnectError(null)
    fetch('/api/claude-usage/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_key: keyInput }),
    })
      .then(async r => {
        if (r.ok) {
          setKeyInput('')
          setConnecting(false)
          setStatus('connected')
        } else {
          const err = await r.json().catch(() => ({}))
          setConnectError(err.detail || 'Connection failed')
        }
      })
      .catch(() => setConnectError('Network error'))
      .finally(() => setSaving(false))
  }

  const handleDisconnect = () =>
    fetch('/api/claude-usage/connect', { method: 'DELETE' })
      .then(() => { setStatus('disconnected'); setData(null) })

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="widget">
        <div className="widget-title">Claude Usage</div>
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    )
  }

  // ── Disconnected ─────────────────────────────────────────────────────────
  if (status === 'disconnected') {
    return (
      <div className="widget">
        <div className="widget-title">Claude Usage</div>
        {!connecting ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 'calc(100% - 40px)', gap: 10,
          }}>
            <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
              Connect your Claude.ai session<br />to track subscription usage
            </div>
            <button className="btn-primary" onClick={() => setConnecting(true)}>
              Connect
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13 }}>
            <ol style={{ color: 'var(--muted)', paddingLeft: 18, marginBottom: 12, lineHeight: 1.8 }}>
              <li>Open <strong style={{ color: 'var(--text)' }}>claude.ai</strong> in your browser</li>
              <li>Open DevTools → Application → Cookies</li>
              <li>Find the <code style={{ color: 'var(--accent)', background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>sessionKey</code> cookie and copy its value</li>
            </ol>
            <input
              type="password"
              placeholder="sk-ant-sid01-…"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !saving && keyInput.trim() && handleConnect()}
              style={{ marginBottom: 8 }}
              autoFocus
            />
            {connectError && (
              <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{connectError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-primary"
                onClick={handleConnect}
                disabled={!keyInput.trim() || saving}
              >
                {saving ? 'Connecting…' : 'Save'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setConnecting(false); setConnectError(null); setKeyInput('') }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Connected ────────────────────────────────────────────────────────────
  const bars = data ? parseStats(data) : []

  return (
    <div className="widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="widget-title" style={{ marginBottom: 0 }}>Claude Usage</div>
        <button
          className="btn-ghost"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={handleDisconnect}
        >
          Disconnect
        </button>
      </div>

      {!data && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Fetching usage…</p>}

      {bars.map((bar, i) => (
        <UsageBar key={i} label={bar.label} pct={bar.pct} sublabel={bar.sublabel} />
      ))}

      {data && bars.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>
          Connected — unknown data shape, see raw below
        </p>
      )}

      {data && (
        <div style={{ marginTop: bars.length > 0 ? 4 : 0 }}>
          <button
            className="btn-ghost"
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={() => setShowRaw(v => !v)}
          >
            {showRaw ? 'Hide raw' : 'Raw data'}
          </button>
          {showRaw && (
            <pre style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 8,
              fontSize: 10,
              color: 'var(--muted)',
              overflow: 'auto',
              maxHeight: 180,
              marginTop: 6,
            }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
