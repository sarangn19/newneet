import './shared.css'

export default function StatCard({ value, label, color, bg }) {
  return (
    <div className="shared-stat-card" style={{ background: bg || 'var(--surface-alt)' }}>
      <div className="shared-stat-value" style={{ color: color || 'var(--text)' }}>{value}</div>
      <div className="shared-stat-label" style={{ color: 'var(--text-2)' }}>{label}</div>
    </div>
  )
}
