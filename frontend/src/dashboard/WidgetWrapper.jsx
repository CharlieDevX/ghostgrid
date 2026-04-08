export default function WidgetWrapper({ id, label, editMode, onRemove, children }) {
  if (!editMode) return children

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Drag handle bar */}
      <div
        className="widget-drag-handle"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--border)',
          borderRadius: '8px 8px 0 0',
          cursor: 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
          <span style={{ letterSpacing: 2, fontSize: 10 }}>⠿</span>
          {label}
        </span>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove(id) }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '0 2px',
          }}
          title="Remove widget"
        >
          ×
        </button>
      </div>

      {/* Widget content */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: '0 0 10px 10px', outline: '2px solid var(--accent)', outlineOffset: -2 }}>
        {children}
      </div>
    </div>
  )
}
