import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    to: '/tasks',
    label: 'Tasks',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
]

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 210,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
            GhostGrid
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>homelab dashboard</div>
        </div>

        {/* Nav links */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px' }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: 14,
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                background: isActive ? 'rgba(122,162,247,0.1)' : 'transparent',
                transition: 'background 0.15s, color 0.15s',
              })}
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px 0', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
          Ghost · v0.1
        </div>
      </nav>

      {/* Page content */}
      <main style={{ marginLeft: 210, flex: 1, padding: '28px 28px', minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  )
}
