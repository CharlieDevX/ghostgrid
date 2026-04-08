import SystemStats     from '../components/SystemStats'
import NetworkWidget   from '../components/NetworkWidget'
import DockerWidget    from '../components/DockerWidget'
import BookmarksWidget from '../components/BookmarksWidget'
import NotesWidget     from '../components/NotesWidget'

// Grid is 4 columns. w=2 fills half the screen, w=4 fills the full width.
export const WIDGET_REGISTRY = {
  SystemStats: {
    label:       'System Stats',
    description: 'CPU, RAM, and disk usage with live bars',
    component:   SystemStats,
    defaultW: 2, defaultH: 2,
    minW: 2,     minH: 2,
    maxW: 4,     maxH: 6,
  },
  NetworkWidget: {
    label:       'Network',
    description: 'Interface speeds and Tailscale IP',
    component:   NetworkWidget,
    defaultW: 2, defaultH: 2,
    minW: 2,     minH: 2,
    maxW: 4,     maxH: 6,
  },
  DockerWidget: {
    label:       'Docker',
    description: 'Container list with start/stop controls',
    component:   DockerWidget,
    defaultW: 4, defaultH: 2,
    minW: 2,     minH: 2,
    maxW: 4,     maxH: 8,
  },
  BookmarksWidget: {
    label:       'Bookmarks',
    description: 'Grouped link shortcuts',
    component:   BookmarksWidget,
    defaultW: 2, defaultH: 2,
    minW: 2,     minH: 2,
    maxW: 4,     maxH: 8,
  },
  NotesWidget: {
    label:       'Notes',
    description: 'Quick notes with CRUD',
    component:   NotesWidget,
    defaultW: 2, defaultH: 2,
    minW: 2,     minH: 2,
    maxW: 4,     maxH: 10,
  },
}

export const DEFAULT_LAYOUT = {
  version: 2,
  items: [
    { i: 'default-system',    type: 'SystemStats',     x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 6 },
    { i: 'default-network',   type: 'NetworkWidget',   x: 2, y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 6 },
    { i: 'default-docker',    type: 'DockerWidget',    x: 0, y: 2, w: 4, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 8 },
    { i: 'default-bookmarks', type: 'BookmarksWidget', x: 0, y: 4, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 8 },
    { i: 'default-notes',     type: 'NotesWidget',     x: 2, y: 4, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 10 },
  ],
}
