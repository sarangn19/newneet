import './shared.css'

export default function Badge({ children, color, bg }) {
  return (
    <span className="shared-badge" style={{ background: bg || 'var(--surface-alt)', color: color || 'var(--text-3)' }}>
      {children}
    </span>
  )
}
