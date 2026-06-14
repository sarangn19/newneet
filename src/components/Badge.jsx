export default function Badge({ children, color, bg }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-pill)',
      fontSize: 9, fontWeight: 700,
      background: bg || 'var(--surface-alt)',
      color: color || 'var(--text-3)',
    }}>
      {children}
    </span>
  )
}
