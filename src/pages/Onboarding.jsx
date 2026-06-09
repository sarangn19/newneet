import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRive } from '@rive-app/react-canvas'
import { Check } from 'lucide-react'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'

const PROFILE_PICS = [
  '/profile-pics/1.png', '/profile-pics/2.png', '/profile-pics/3.png',
  '/profile-pics/4.png', '/profile-pics/5.png', '/profile-pics/6.png',
]

function RiveCelebration() {
  const { rive, RiveComponent } = useRive({
    src: '/latest_mascot.riv',
    autoplay: false,
  })
  useEffect(() => {
    if (!rive) return
    const mt = rive
    const names = mt.animationNames
    const defs = ['default reading', 'default 2 blink'].filter(n => names?.includes(n))
    const playDefault = () => {
      if (defs.length) try { mt.play(defs[0], true) } catch {}
    }
    let t
    if (names?.includes('celebration')) {
      try { mt.play('celebration') } catch {}
      t = setTimeout(playDefault, 2000)
    } else {
      playDefault()
    }
    return () => { clearTimeout(t); try { mt.stop?.() } catch {} }
  }, [rive])
  return (
    <div style={{ width: 180, height: 180 }}>
      <RiveComponent />
    </div>
  )
}

const SCREENS = ['welcome', 'exam', 'avatar', 'ready']

export default function Onboarding() {
  const navigate = useNavigate()
  const OnboardingComplete = useStore(s => s.onboardingComplete)
  const setOnboardingComplete = useStore(s => s.setOnboardingComplete)
  const setAvatarStore = useStore(s => s.setAvatar)
  const setExamType = useStore(s => s.setExamType)
  const [step, setStep] = useState(0)
  const [examType, setLocalExamType] = useState('neet')
  const [direction, setDirection] = useState(1)
  const [avatar, setAvatar] = useState('')
  const containerRef = useRef(null)
  const [width, setWidth] = useState(320)

  useEffect(() => {
    if (containerRef.current) setWidth(containerRef.current.offsetWidth)
  }, [])

  useEffect(() => {
    if (OnboardingComplete) navigate('/', { replace: true })
  }, [OnboardingComplete, navigate])

  const goNext = useCallback(() => {
    if (step < SCREENS.length - 1) { setDirection(1); setStep(s => s + 1) }
  }, [step])

  const goPrev = useCallback(() => {
    if (step > 0) { setDirection(-1); setStep(s => s - 1) }
  }, [step])

  const handleDragEnd = useCallback((_, info) => {
    if (info.offset.x < -60) goNext()
    else if (info.offset.x > 60) goPrev()
  }, [goNext, goPrev])

  const finish = async () => {
    if (avatar) setAvatarStore(avatar)
    setExamType(examType)
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('users').upsert({ id: user.id, exam_type: examType }, { onConflict: 'id' })
    }
    setOnboardingComplete(true)
    navigate('/', { replace: true })
  }

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? width : -width, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -width : width, opacity: 0 }),
  }

  return (
    <div ref={containerRef} style={{
        minHeight: '100dvh',
        background: 'var(--white)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxWidth: 480, margin: '0 auto',
      }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={SCREENS[step]}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              padding: '48px 28px 24px',
            }}
          >
            {step === 0 && (
              <ScreenWelcome goNext={goNext} />
            )}
            {step === 1 && (
              <ScreenExamType examType={examType} setExamType={setLocalExamType} goNext={goNext} />
            )}
            {step === 2 && (
              <ScreenAvatar avatar={avatar} setAvatar={setAvatar} goNext={goNext} />
            )}
            {step === 3 && (
              <ScreenReady avatar={avatar} finish={finish} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8,
        padding: '20px 0 32px',
      }}>
        {SCREENS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 24 : 8, height: 8,
            borderRadius: 4,
            background: i === step ? 'var(--primary)' : 'var(--border)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>
    </div>
  )
}

function ScreenWelcome({ goNext }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 24,
        background: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
      }}>
        <svg width="60" height="60" viewBox="0 0 130 130" fill="none">
          <polygon points="30,60 22,30 50,55" fill="#fff" />
          <polygon points="100,60 108,30 80,55" fill="#fff" />
          <ellipse cx="65" cy="72" rx="34" ry="30" fill="#fff" />
          <ellipse cx="65" cy="108" rx="36" ry="26" fill="#fff" />
          <circle cx="54" cy="69" r="7" fill="#22c55e" />
          <circle cx="76" cy="69" r="7" fill="#22c55e" />
          <circle cx="54" cy="69" r="3.5" fill="#0a0a0a" />
          <circle cx="76" cy="69" r="3.5" fill="#0a0a0a" />
        </svg>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>
        Welcome to<br />Exam Prep!
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 280 }}>
        Master NEET or UPSC with gamified lessons, smart practice, and a cute study buddy.
      </div>
      <div style={{ margin: '12px 0' }}>
        <RiveCelebration />
      </div>
      <button onClick={goNext}
        style={{
          width: '100%', maxWidth: 240, marginTop: 8,
          padding: '14px', borderRadius: 12, border: 'none',
          background: 'var(--primary)', color: '#fff',
          fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
        }}>
        Get Started
      </button>
    </div>
  )
}

function ScreenExamType({ examType, setExamType, goNext }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', gap: 20,
    }}>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          What are you preparing for?
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
          We'll tailor your experience accordingly
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { id: 'neet', label: 'NEET', emoji: '🩺', desc: 'Medical entrance exam', color: '#22C55E' },
          { id: 'upsc', label: 'UPSC', emoji: '📜', desc: 'Civil services exam', color: '#8B5CF6' },
        ].map(et => (
          <button key={et.id} onClick={() => setExamType(et.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px',
              borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
              border: examType === et.id ? '2px solid ' + et.color : '2px solid var(--border)',
              background: examType === et.id ? et.color + '12' : 'var(--surface-alt)',
              transition: 'all 0.15s', textAlign: 'left',
            }}>
            <span style={{ fontSize: 28 }}>{et.emoji}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{et.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-3)' }}>{et.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={goNext}
        style={{
          width: '100%', marginTop: 8, padding: '14px', borderRadius: 12,
          border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
          cursor: 'pointer',
          background: 'var(--primary)', color: '#fff',
          boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
        }}>
        Continue
      </button>
    </div>
  )
}

function ScreenAvatar({ avatar, setAvatar, goNext }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', gap: 20,
    }}>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          Choose your avatar
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
          Pick a study buddy to represent you
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
        justifyItems: 'center',
      }}>
        {PROFILE_PICS.map(src => (
          <button key={src} onClick={() => setAvatar(src)}
            style={{
              width: 80, height: 80, borderRadius: 20, padding: 0,
              border: avatar === src ? '3px solid var(--primary)' : '3px solid var(--border)',
              background: 'var(--card-bg)', cursor: 'pointer', overflow: 'hidden',
              boxShadow: avatar === src ? '0 4px 14px rgba(249,115,22,0.25)' : 'none',
              transition: 'all 0.15s',
            }}>
            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </button>
        ))}
      </div>
      <button onClick={goNext}
        style={{
          width: '100%', marginTop: 8, padding: '14px', borderRadius: 12,
          border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
          cursor: 'pointer',
          background: 'var(--primary)', color: '#fff',
          boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
        }}>
        Continue
      </button>
    </div>
  )
}

function ScreenReady({ avatar, finish }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      gap: 12,
    }}>
      <RiveCelebration />
      <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>
        You're all set!
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, maxWidth: 280 }}>
        Start your exam prep journey
      </div>
      {avatar && (
        <div style={{
          width: 88, height: 88, borderRadius: 22, overflow: 'hidden',
          border: '3px solid var(--primary)', marginTop: 4,
        }}>
          <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <button onClick={finish}
        style={{
          width: '100%', maxWidth: 240, marginTop: 16,
          padding: '16px', borderRadius: 12, border: 'none',
          background: 'var(--primary)', color: '#fff',
          fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
          cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
        }}>
        Start Learning
      </button>
    </div>
  )
}
