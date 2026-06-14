import { motion } from 'framer-motion'
import { skeletonBreath } from '../hooks/useSequentialReveal'

export function SkeletonBlock({ width = '100%', height = 14, radius = 6, style }) {
  return (
    <motion.div
      animate={skeletonBreath}
      style={{
        width, height, borderRadius: radius,
        background: 'var(--surface-alt)',
        ...style,
      }}
    />
  )
}

export function SkeletonCard({ children, style }) {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border)',
      padding: 16, ...style,
    }}>
      {children}
    </div>
  )
}
