import { motion } from 'framer-motion'
import './shared.css'

export default function PrimaryButton({ onClick, children, style, disabled = false, fullWidth = true }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      disabled={disabled}
      className="shared-primary-btn"
      style={{
        width: fullWidth ? '100%' : undefined,
        background: disabled ? 'var(--border)' : 'var(--primary)',
        color: disabled ? 'var(--text-3)' : '#fff',
        ...style,
      }}
    >
      {children}
    </motion.button>
  )
}
