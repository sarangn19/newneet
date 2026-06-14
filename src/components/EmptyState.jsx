import { motion } from 'framer-motion'

export default function EmptyState({
  icon: Icon,
  title = 'Nothing here',
  description = '',
  children,
}) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      {Icon && (
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--radius-md)',
          background: 'var(--surface-alt)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <Icon size={22} color="var(--text-3)" />
        </div>
      )}
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: description ? 6 : 0 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, maxWidth: 260, margin: '0 auto' }}>
          {description}
        </div>
      )}
      {children && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 200, margin: '20px auto 0' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export function EmptyAction({ onClick, children, secondary = false }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      style={{
        width: '100%', padding: '10px 0', borderRadius: 'var(--radius-md)',
        border: secondary ? '1.5px solid var(--border)' : 'none',
        background: secondary ? 'transparent' : 'var(--primary)',
        color: secondary ? 'var(--text-2)' : '#fff',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </motion.button>
  )
}
