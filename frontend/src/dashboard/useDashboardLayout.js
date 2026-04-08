import { useState, useEffect, useRef } from 'react'
import { WIDGET_REGISTRY, DEFAULT_LAYOUT } from './widgetRegistry'

const STORAGE_KEY = 'ghostgrid_dashboard_layout'
const CURRENT_VERSION = 2

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw)
    if (parsed.version !== CURRENT_VERSION) return DEFAULT_LAYOUT
    return parsed
  } catch {
    return DEFAULT_LAYOUT
  }
}

let idCounter = 0
function genId() {
  return `widget-${Date.now()}-${idCounter++}`
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState(loadLayout)
  const [editMode, setEditMode] = useState(false)
  const isMounted = useRef(false)

  // Persist only after first render (skip initial mount)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [layout])

  // Only update positions — called on drag/resize stop, not on every layout event
  const savePositions = (rglLayout) => {
    setLayout(prev => ({
      ...prev,
      items: prev.items.map(item => {
        const updated = rglLayout.find(l => l.i === item.i)
        return updated
          ? { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h }
          : item
      }),
    }))
  }

  const addWidget = (type) => {
    const reg = WIDGET_REGISTRY[type]
    if (!reg) return
    const newItem = {
      i:    genId(),
      type,
      x:    0,
      y:    Infinity,
      w:    reg.defaultW,
      h:    reg.defaultH,
      minW: reg.minW,
      minH: reg.minH,
      maxW: reg.maxW,
      maxH: reg.maxH,
    }
    setLayout(prev => ({ ...prev, items: [...prev.items, newItem] }))
  }

  const removeWidget = (id) => {
    setLayout(prev => ({ ...prev, items: prev.items.filter(item => item.i !== id) }))
  }

  const resetLayout = () => setLayout(DEFAULT_LAYOUT)

  return { layout, editMode, setEditMode, savePositions, addWidget, removeWidget, resetLayout }
}
