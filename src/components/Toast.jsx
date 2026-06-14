import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

let toastId = 0

export function useToast() {
  const [items, setItems] = useState([])

  const show = useCallback((msg, duration = 2000) => {
    const id = ++toastId
    setItems(prev => [...prev, { id, msg }])
    setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  return { show, items }
}

export function ToastUI({ items }) {
  return (
    <div style={{ position: 'fixed', top: 60, left: '50%', zIndex: 999, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
      <AnimatePresence>
        {items.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            style={{
              background: 'var(--surface-alt)', color: 'var(--text)',
              padding: '8px 20px', borderRadius: 'var(--radius-md)',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              whiteSpace: 'nowrap', pointerEvents: 'auto',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
