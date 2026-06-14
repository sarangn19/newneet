import { motion } from 'framer-motion'

export default function PrimaryButton({ onClick, children, style, disabled = false, fullWidth = true }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      disabled={disabled}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '12px 24px', borderRadius: 'var(--radius-md)', border: 'none',
        background: disabled ? 'var(--border)' : 'var(--primary)',
        color: disabled ? 'var(--text-3)' : '#fff',
        fontSize: 13, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 6, ...style,
      }}
    >
      {children}
    </motion.button>
  )
}
