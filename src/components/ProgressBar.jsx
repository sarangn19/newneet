export default function ProgressBar({ value, max = 100, height = 4, color }) {
  const pct = Math.min(value / max, 1) * 100
  return (
    <div style={{
      height, background: 'var(--surface-alt)', borderRadius: 'var(--radius-pill)',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: color || 'var(--primary)',
        borderRadius: 'var(--radius-pill)',
        transition: 'width 0.3s',
      }} />
    </div>
  )
}
