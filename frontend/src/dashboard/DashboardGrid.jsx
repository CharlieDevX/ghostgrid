import { useRef, useState, useEffect } from 'react'
import { ReactGridLayout } from 'react-grid-layout'
import { WIDGET_REGISTRY } from './widgetRegistry'
import WidgetWrapper from './WidgetWrapper'

export const COLS       = 4
export const ROW_HEIGHT = 180
export const GAP        = 20

function GridOverlay({ width, numRows }) {
  if (!width) return null
  const colW = (width - GAP * (COLS - 1)) / COLS
  const rowH = ROW_HEIGHT + GAP

  const cells = []
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < COLS; col++) {
      cells.push(
        <div
          key={`${row}-${col}`}
          style={{
            position: 'absolute',
            left:   col * (colW + GAP),
            top:    row * rowH,
            width:  colW,
            height: ROW_HEIGHT,
            border: '1px dashed rgba(122,162,247,0.12)',
            borderRadius: 10,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      )
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {cells}
    </div>
  )
}

export default function DashboardGrid({ layout, editMode, savePositions, onRemove }) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(null)

  // Measure container width — use viewport estimate immediately to avoid stacking
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Set width immediately from DOM, then watch for changes
    setWidth(el.getBoundingClientRect().width || window.innerWidth - 260)

    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rglItems = layout.items.map(item => ({
    i:    item.i,
    x:    item.x,
    y:    item.y,
    w:    item.w,
    h:    item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
  }))

  // Calculate how many grid rows to show in the overlay
  const maxRow = layout.items.reduce((acc, item) => Math.max(acc, item.y + item.h), 0)
  const numRows = maxRow + 1

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {editMode && <GridOverlay width={width} numRows={numRows} />}
      {width && (
        <ReactGridLayout
          layout={rglItems}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={width}
          margin={[GAP, GAP]}
          containerPadding={[0, 0]}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          onDragStop={savePositions}
          onResizeStop={savePositions}
          resizeHandles={['se']}
          useCSSTransforms
        >
          {layout.items.map(item => {
            const reg = WIDGET_REGISTRY[item.type]
            if (!reg) return null
            const Component = reg.component
            return (
              <div key={item.i} style={{ zIndex: 1 }}>
                <WidgetWrapper
                  id={item.i}
                  label={reg.label}
                  editMode={editMode}
                  onRemove={onRemove}
                >
                  <Component />
                </WidgetWrapper>
              </div>
            )
          })}
        </ReactGridLayout>
      )}
    </div>
  )
}
