export default function SectionHeader({
  title,
  subtitle,
  action,
  icon: Icon,
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 0 8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && (
          <div style={{
            width: 22, height: 22, borderRadius: 'var(--radius-sm)',
            background: 'var(--primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={12} color="var(--primary)" />
          </div>
        )}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}
