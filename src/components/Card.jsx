import { motion } from 'framer-motion'
import './shared.css'

export default function Card({ children, onClick, style }) {
  const Wrapper = onClick ? motion.div : 'div'
  const props = onClick ? { whileTap: { scale: 0.98 }, whileHover: { scale: 1.01 } } : {}
  const cls = 'shared-card' + (onClick ? ' shared-card-clickable' : '')
  return (
    <Wrapper onClick={onClick} {...props} className={cls} style={{ '--card-p': '16px', ...style }}>
      {children}
    </Wrapper>
  )
}