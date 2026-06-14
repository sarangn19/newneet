import { useMemo } from 'react'

export function useSequentialReveal(count, delayMs = 50, baseDelay = 0) {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: {
        delay: baseDelay + i * delayMs,
        duration: 0.3,
        ease: [0.2, 0.8, 0.2, 1],
      },
    }))
  }, [count, delayMs, baseDelay])
}

export const springPreset = { type: 'spring', stiffness: 300, damping: 30 }
export const easePreset = { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }
export const microPress = { whileTap: { scale: 0.98 } }
export const skeletonBreath = {
  opacity: [0.85, 1, 0.85],
  transition: { duration: 1.8, ease: 'easeInOut', repeat: Infinity },
}
