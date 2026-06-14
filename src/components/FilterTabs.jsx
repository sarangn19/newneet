import { motion } from 'framer-motion'

export default function FilterTabs({ items, active, onChange, pill = false, labels }) {
  const radius = pill ? 'var(--radius-pill)' : 'var(--radius-md)'
  return (
    <div style={{
      display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none',
      padding: '8px 14px',
    }}>
      {items.map(item => {
        const isActive = active === item
        const label = labels?.[item] ?? item
        return (
          <motion.button
            key={item}
            layout
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.04 }}
            onClick={() => onChange(item)}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            style={{
              padding: '4px 12px', borderRadius: radius, border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              background: isActive ? 'var(--primary)' : 'var(--surface-alt)',
              color: isActive ? '#fff' : 'var(--text-3)',
            }}
          >
            {label}
          </motion.button>
        )
      })}
    </div>
  )
}

export function Chip({ children, color, active }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--radius-pill)',
      fontSize: 9, fontWeight: 700,
      background: active ? `${color}18` : 'var(--surface-alt)',
      color: active ? color : 'var(--text-3)',
    }}>
      {children}
    </span>
  )
}
