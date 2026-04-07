import { useEffect, useState } from 'react'

function fmtBytes(bytes) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB'
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024).toFixed(0) + ' KB'
}

function fmtSpeed(kbps) {
  if (kbps >= 1024) return (kbps / 1024).toFixed(1) + ' MB/s'
  return kbps.toFixed(0) + ' KB/s'
}

const IFACE_LABEL = {
  enp4s0: 'LAN',
  tailscale0: 'Tailscale',
}

export default function NetworkWidget() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const fetchData = () => {
    fetch('/api/network/')
      .then(r => r.json())
      .then(d => { setData(d); setError(null) })
      .catch(() => setError('Failed to reach backend'))
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 2000)
    return () => clearInterval(id)
  }, [])

  if (error) return <div className="widget"><p style={{ color: 'var(--danger)' }}>{error}</p></div>
  if (!data) return <div className="widget"><p style={{ color: 'var(--muted)' }}>Loading...</p></div>

  return (
    <div className="widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="widget-title" style={{ marginBottom: 0 }}>Network</div>
        {data.tailscale_ip && (
          <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>
            TS {data.tailscale_ip}
          </span>
        )}
      </div>

      {data.interfaces.map(iface => (
        <div key={iface.name} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{IFACE_LABEL[iface.name] ?? iface.name}</span>
            <span className={`tag ${iface.up ? 'tag-green' : 'tag-red'}`}>{iface.up ? 'up' : 'down'}</span>
            {iface.ip4 && (
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', marginLeft: 'auto' }}>
                {iface.ip4}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>↑ Upload</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{fmtSpeed(iface.tx_kbps)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmtBytes(iface.bytes_sent)} total</div>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>↓ Download</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>{fmtSpeed(iface.rx_kbps)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmtBytes(iface.bytes_recv)} total</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
