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
      background: 'var(--card-bg)', borderRadius: 14,
      border: '1px solid var(--border)',
      padding: 16, ...style,
    }}>
      {children}
    </div>
  )
}

export function SkeletonArticleCard() {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 14,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <motion.div animate={skeletonBreath}
        style={{ height: 80, background: 'var(--surface-alt)' }}
      />
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonBlock width="40%" height={10} radius={4} />
        <SkeletonBlock width="90%" height={12} radius={4} />
        <SkeletonBlock width="70%" height={12} radius={4} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <SkeletonBlock width={60} height={10} radius={4} />
          <SkeletonBlock width={20} height={10} radius={4} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonNoteCard({ stacked = false }) {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 14,
      border: '1px solid var(--border)',
      padding: 14, display: 'flex', flexDirection: 'column',
      gap: 8, ...(stacked ? { marginBottom: -100, transform: 'scale(0.95)', opacity: 0.6 } : {}),
    }}>
      <SkeletonBlock width="35%" height={10} radius={4} />
      <SkeletonBlock width="85%" height={14} radius={4} />
      <SkeletonBlock width="60%" height={10} radius={4} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <SkeletonBlock width={50} height={10} radius={4} />
        <SkeletonBlock width={50} height={10} radius={4} />
      </div>
    </div>
  )
}
