import './shared.css'

export default function StatCard({ value, label, color, bg }) {
  return (
    <div className="shared-stat-card" style={{ '--stat-bg': bg }}>
      <div className="shared-stat-value" style={{ '--stat-color': color }}>{value}</div>
      <div className="shared-stat-label">{label}</div>
    </div>
  )
}