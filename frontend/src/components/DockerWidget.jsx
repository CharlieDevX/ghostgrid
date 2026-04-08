import { useEffect, useState } from 'react'

export default function DockerWidget() {
  const [containers, setContainers] = useState([])
  const [error, setError] = useState(null)
  const [pending, setPending] = useState({})

  const fetchContainers = () => {
    fetch('/api/docker/')
      .then(r => {
        if (!r.ok) throw new Error('Docker unavailable')
        return r.json()
      })
      .then(data => { setContainers(data); setError(null) })
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    fetchContainers()
    const id = setInterval(fetchContainers, 8000)
    return () => clearInterval(id)
  }, [])

  const action = (name, verb) => {
    setPending(p => ({ ...p, [name]: verb }))
    fetch(`/api/docker/${name}/${verb}`, { method: 'POST' })
      .then(() => fetchContainers())
      .finally(() => setPending(p => { const n = { ...p }; delete n[name]; return n }))
  }

  if (error) return (
    <div className="widget">
      <div className="widget-title">Docker</div>
      <p style={{ color: 'var(--danger)' }}>{error}</p>
    </div>
  )

  return (
    <div className="widget">
      <div className="widget-title">Docker — {containers.filter(c => c.running).length}/{containers.length} running</div>
      {containers.length === 0
        ? <p style={{ color: 'var(--muted)' }}>No containers found.</p>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '52%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <tbody>
              {containers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ padding: '8px 0', color: 'var(--muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span>{c.image}</span>
                  </td>
                  <td style={{ padding: '8px 0' }}>
                    <span className={`tag ${c.running ? 'tag-green' : 'tag-red'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {c.running
                      ? <button className="btn-danger" disabled={!!pending[c.name]} onClick={() => action(c.name, 'stop')}>
                          {pending[c.name] === 'stop' ? '...' : 'Stop'}
                        </button>
                      : <button className="btn-primary" disabled={!!pending[c.name]} onClick={() => action(c.name, 'start')}>
                          {pending[c.name] === 'start' ? '...' : 'Start'}
                        </button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  )
}
