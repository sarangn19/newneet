import './shared.css'

export default function Badge({ children, color, bg }) {
  return (
    <span className="shared-badge" style={{ '--badge-bg': bg, '--badge-color': color }}>
      {children}
    </span>
  )
}