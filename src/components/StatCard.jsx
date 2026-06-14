export default function StatCard({ value, label, color, bg }) {
  return (
    <div style={{
      flex: 1, background: bg || 'var(--surface-alt)',
      borderRadius: 'var(--radius-md)', padding: 10, textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{label}</div>
    </div>
  )
}
