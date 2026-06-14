import { motion } from 'framer-motion'
import './shared.css'

export default function Card({ children, onClick, style }) {
  const Wrapper = onClick ? motion.div : 'div'
  const props = onClick ? { whileTap: { scale: 0.98 }, whileHover: { scale: 1.01 } } : {}
  return (
    <Wrapper
      onClick={onClick}
      {...props}
      className="shared-card"
      style={{ padding: 16, cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {children}
    </Wrapper>
  )
}
