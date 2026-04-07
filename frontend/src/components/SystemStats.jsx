import { useEffect, useState } from 'react'

function Bar({ percent }) {
  const cls = percent >= 90 ? 'crit' : percent >= 70 ? 'warn' : ''
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${percent}%` }} data-cls={cls || undefined} />
    </div>
  )
}

function StatRow({ label, value, percent }) {
  const barCls = percent >= 90 ? 'crit' : percent >= 70 ? 'warn' : ''
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span>{value}</span>
      </div>
      <div className="bar-track">
        <div className={`bar-fill ${barCls}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

export default function SystemStats() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  const fetchStats = () => {
    fetch('/api/system/')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setError('Failed to reach backend'))
  }

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, 5000)
    return () => clearInterval(id)
  }, [])

  if (error) return <div className="widget"><p style={{ color: 'var(--danger)' }}>{error}</p></div>
  if (!stats) return <div className="widget"><p style={{ color: 'var(--muted)' }}>Loading...</p></div>

  const { cpu, memory, disks } = stats

  return (
    <div className="widget">
      <div className="widget-title">System</div>

      <StatRow
        label={`CPU — ${cpu.count_physical}C/${cpu.count_logical}T${cpu.temp_c ? ` · ${cpu.temp_c}°C` : ''}`}
        value={`${cpu.percent}%`}
        percent={cpu.percent}
      />
      <StatRow
        label={`RAM — ${memory.used_gb} / ${memory.total_gb} GB`}
        value={`${memory.percent}%`}
        percent={memory.percent}
      />
      {disks && disks.map(d => (
        <StatRow
          key={d.mount}
          label={`${d.label} — ${d.used_gb} / ${d.total_gb} GB`}
          value={`${d.percent}%`}
          percent={d.percent}
        />
      ))}

      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
        Uptime: {formatUptime(stats.uptime_seconds)}
        {cpu.freq_mhz && <span style={{ marginLeft: 12 }}>{(cpu.freq_mhz / 1000).toFixed(2)} GHz</span>}
      </div>
    </div>
  )
}
