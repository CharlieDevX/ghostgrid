import { WIDGET_REGISTRY } from './widgetRegistry'

export default function AddWidgetPanel({ onAdd, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0, right: 0, bottom: 0,
        width: 300,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Add Widget</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          {Object.entries(WIDGET_REGISTRY).map(([type, reg]) => (
            <div
              key={type}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '12px 14px',
                cursor: 'pointer',
              }}
              onClick={() => { onAdd(type); onClose() }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{reg.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{reg.description}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                Default: {reg.defaultW}×{reg.defaultH} · Min: {reg.minW}×{reg.minH}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
