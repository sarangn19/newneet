import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRive } from '@rive-app/react-canvas'

// ── Rive Cat Component ─────────────────────────────────────
function RiveCat() {
  const { RiveComponent } = useRive({
    src: '/cat.riv',
    autoplay: true,
  })

  return (
    <div style={{ width: 100, height: 100, pointerEvents: 'none' }}>
      <RiveComponent />
    </div>
  )
}

// ── Particle effects ────────────────────────────────────────
function Particles({ type }) {
  if (type === 'sparkle') {
    return (
      <div style={{ position: 'absolute', inset: -8, pointerEvents: 'none' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div key={i}
            initial={{ opacity: 1, scale: 0, x: 30 + Math.random() * 20, y: 20 + Math.random() * 20 }}
            animate={{ opacity: 0, scale: 1, y: -20 - Math.random() * 30, x: 10 + Math.random() * 60 }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
            style={{ position: 'absolute', fontSize: 10 }}>
            
          </motion.div>
        ))}
      </div>
    )
  }
  if (type === 'fire') {
    return (
      <div style={{ position: 'absolute', inset: -12, pointerEvents: 'none' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            animate={{ y: [-4, -16, -4], opacity: [0.8, 1, 0.8], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
            style={{ position: 'absolute', bottom: 8, left: 10 + i * 24, fontSize: 14 }}>
            
          </motion.div>
        ))}
      </div>
    )
  }
  if (type === 'hearts') {
    return (
      <div style={{ position: 'absolute', inset: -8, pointerEvents: 'none' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            initial={{ opacity: 1, y: 30, x: 15 + i * 20 }}
            animate={{ opacity: 0, y: -10 }}
            transition={{ duration: 1, delay: i * 0.2 }}
            style={{ position: 'absolute', fontSize: 12 }}>
            
          </motion.div>
        ))}
      </div>
    )
  }
  return null
}

// ── Tap responses ───────────────────────────────────────────
const tapMessages = [
  'Meow!', 'Purrrr~', '*nuzzle*', 'Study time!', 'You got this!',
  '*stretches*', 'Feed me questions!', 'Nyaa~', '*tail wag*', 'Let\'s learn!',
  '*happy purr*', 'I believe in you!', '*paw wave*', 'Meow meow!', 'Focus!',
]

// ── Mood-to-expression mapping ──────────────────────────────
const moodExpressions = {
  idle: 'idle',
  correct: 'happy',
  wrong: 'dizzy',
  streak: 'happy',
  sleeping: 'sleeping',
  excited: 'shocked',
  victory: 'happy',
  thinking: 'idle',
  tapped: 'happy',
}

// ── Body animations per mood ────────────────────────────────
const bodyAnimations = {
  idle: { y: [0, -3, 0], transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' } },
  correct: { y: [0, -16, 0], scale: [1, 1.15, 1], transition: { duration: 0.5 } },
  wrong: { rotate: [0, -8, 8, -6, 4, 0], transition: { duration: 0.6 } },
  streak: { y: [0, -12, 0], scale: [1, 1.2, 1], transition: { duration: 0.4, repeat: 2 } },
  sleeping: { rotate: [0, 3, 0, -3, 0], transition: { repeat: Infinity, duration: 4, ease: 'easeInOut' } },
  excited: { y: [0, -10, 0, -6, 0], scale: [1, 1.1, 1, 1.08, 1], transition: { duration: 0.7 } },
  victory: { rotate: [0, 8, -8, 0], scale: [1, 1.25, 1], transition: { duration: 0.7 } },
  tapped: { scale: [1, 1.15, 0.95, 1], transition: { duration: 0.4 } },
}

// ── Module outfit mapping ───────────────────────────────────
const moduleOutfits = {
  'b14-m0': 'crown',     // Digestive Kingdom
  'b14-m1': 'dentist',   // Entry of Food
  'b14-m2': 'goggles',   // Saliva Lab
  'b14-m4': 'crown',     // Stomach Kingdom
  'b14-m7': 'chef',      // Fat Breakdown Arena
  'b14-m19': 'warrior',  // Final Boss
}

// ── Default speech for moods ────────────────────────────────
const moodSpeech = {
  idle: '',
  correct: ['Nice!', 'Purrfect!', 'Yes!', 'Meow-nificent!', 'Nailed it!'],
  wrong: ['Oops!', 'Try again~', 'Hmm...', 'Almost!', 'Don\'t worry!'],
  streak: ['ON FIRE!', 'COMBO!', 'Unstoppable!', 'MEOW YEAH!'],
  sleeping: ['Zzz...', '...', '*snore*'],
  excited: ['BOSS TIME!', 'Let\'s GO!', 'READY?!'],
  victory: ['VICTORY!', 'We did it!', 'AMAZING!', 'Purrfection!'],
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function Gastro({ mood = 'idle', message, show = true, moduleId }) {
  const [tapped, setTapped] = useState(false)
  const [tapMsg, setTapMsg] = useState('')
  const [particles, setParticles] = useState(null)
  const [currentMood, setCurrentMood] = useState(mood)
  const idleTimerRef = useRef(null)

  // Update mood from props
  useEffect(() => {
    setCurrentMood(mood)
    // Set particles based on mood
    if (mood === 'correct') setParticles('sparkle')
    else if (mood === 'streak') setParticles('fire')
    else if (mood === 'victory') setParticles('sparkle')
    else setParticles(null)

    // Clear particles after animation
    if (mood === 'correct' || mood === 'victory') {
      const t = setTimeout(() => setParticles(null), 1200)
      return () => clearTimeout(t)
    }
  }, [mood])

  // Idle → sleeping after 30s
  useEffect(() => {
    if (mood === 'idle') {
      idleTimerRef.current = setTimeout(() => setCurrentMood('sleeping'), 30000)
    }
    return () => clearTimeout(idleTimerRef.current)
  }, [mood])

  // Handle tap
  const handleTap = () => {
    if (tapped) return
    setTapped(true)
    setCurrentMood('tapped')
    setTapMsg(tapMessages[Math.floor(Math.random() * tapMessages.length)])
    setParticles('hearts')
    setTimeout(() => {
      setTapped(false)
      setCurrentMood(mood)
      setTapMsg('')
      setParticles(null)
    }, 1500)
  }

  if (!show) return null

  const expression = moodExpressions[currentMood] || 'idle'
  const bodyAnim = bodyAnimations[currentMood] || bodyAnimations.idle
  const outfit = moduleOutfits[moduleId] || null

  // Pick speech
  let speech = message || tapMsg
  if (!speech && moodSpeech[currentMood]) {
    const arr = moodSpeech[currentMood]
    if (Array.isArray(arr)) speech = arr[Math.floor(Math.random() * arr.length)]
    else speech = arr
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'fixed', bottom: 76, left: 12, zIndex: 50,
        display: 'flex', alignItems: 'flex-end', gap: 4,
      }}
    >
      {/* Cat body */}
      <motion.div
        animate={bodyAnim}
        onClick={handleTap}
        style={{
          cursor: 'pointer', position: 'relative',
          filter: currentMood === 'streak' ? 'drop-shadow(0 0 8px rgba(239,68,68,0.6))' : 'drop-shadow(0 3px 8px rgba(99,102,241,0.3))',
        }}
      >
        <RiveCat />
        {particles && <Particles type={particles} />}

        {/* Streak glow ring */}
        {currentMood === 'streak' && (
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              border: '2px solid #ef4444', pointerEvents: 'none',
            }}
          />
        )}
      </motion.div>

      {/* Speech bubble */}
      <AnimatePresence mode="wait">
        {speech && (
          <motion.div
            key={speech}
            initial={{ opacity: 0, x: -6, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'white', borderRadius: 14, padding: '5px 11px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              fontSize: 11, fontWeight: 700, color: '#4f46e5',
              maxWidth: 140, lineHeight: 1.35,
              border: '1.5px solid rgba(99,102,241,0.15)',
              position: 'relative',
            }}
          >
            {speech}
            {/* Bubble tail */}
            <div style={{
              position: 'absolute', left: -5, bottom: 8,
              width: 0, height: 0,
              borderTop: '5px solid transparent',
              borderBottom: '5px solid transparent',
              borderRight: '6px solid white',
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
