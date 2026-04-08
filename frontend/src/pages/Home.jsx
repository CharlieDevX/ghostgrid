import { useState } from 'react'
import { useDashboardLayout } from '../dashboard/useDashboardLayout'
import DashboardGrid from '../dashboard/DashboardGrid'
import AddWidgetPanel from '../dashboard/AddWidgetPanel'

export default function Home() {
  const { layout, editMode, setEditMode, savePositions, addWidget, removeWidget } = useDashboardLayout()
  const [addPanelOpen, setAddPanelOpen] = useState(false)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {editMode && (
            <button className="btn-primary" onClick={() => setAddPanelOpen(true)}>
              + Add Widget
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={() => { setEditMode(e => !e); setAddPanelOpen(false) }}
            style={{ border: '1px solid var(--border)' }}
          >
            {editMode ? 'Done' : 'Edit Layout'}
          </button>
        </div>
      </div>

      <DashboardGrid
        layout={layout}
        editMode={editMode}
        savePositions={savePositions}
        onRemove={removeWidget}
      />

      {addPanelOpen && (
        <AddWidgetPanel
          onAdd={addWidget}
          onClose={() => setAddPanelOpen(false)}
        />
      )}
    </div>
  )
}
