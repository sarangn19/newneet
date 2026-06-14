import { motion } from 'framer-motion'

export default function Card({ children, onClick, style, hover = true, padding = 16 }) {
  const Wrapper = onClick ? motion.div : 'div'
  const props = onClick ? { whileTap: { scale: 0.98 }, ...(hover ? { whileHover: { scale: 1.01 } } : {}) } : {}
  return (
    <Wrapper
      onClick={onClick}
      {...props}
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </Wrapper>
  )
}
