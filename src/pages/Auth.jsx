import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRive } from '@rive-app/react-canvas'
import { useAuth } from '../lib/useAuth'
import useStore from '../store/useStore'
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react'

// ── Rive mascot (plays default idle animations) ─────────────
function RiveMascot() {
  const { rive, RiveComponent } = useRive({
    src: '/latest_mascot.riv',
    autoplay: false,
  })
  useEffect(() => {
    if (!rive) return
    const mt = rive
    const names = mt.animationNames
    const defs = ['default reading', 'default 2 blink'].filter(n => names?.includes(n))
    if (defs.length) {
      try { mt.play(defs[0], true) } catch {}
      if (defs.length > 1) {
        let i = 0
        const id = setInterval(() => {
          i = (i + 1) % defs.length
          try { mt.play(defs[i], true) } catch {}
        }, 4000)
        return () => { clearInterval(id); try { mt.stop?.() } catch {} }
      }
    }
    return () => { try { mt.stop?.() } catch {} }
  }, [rive])
  return (
    <div style={{ width: 140, height: 140, pointerEvents: 'none' }}>
      <RiveComponent />
    </div>
  )
}

// ── Input field (Duolingo-style pill) ───────────────────────
function InputField({ icon: Icon, type, placeholder, value, onChange, rightIcon, onRightClick, label }) {
  const id = `auth-${placeholder?.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div>
      <label htmlFor={id} style={{
        fontSize: 13, fontWeight: 700, color: 'var(--text-2)',
        marginBottom: 6, display: 'block', letterSpacing: '0.01em',
      }}>{label}</label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#F7F6F3', border: '2px solid #E5E0D5',
        borderRadius: 14, padding: '14px 16px',
        transition: 'border-color 0.15s',
      }}>
        <Icon size={18} color="#B0ABA0" />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 15, fontFamily: 'inherit', color: '#1A1410',
            fontWeight: 600, letterSpacing: '0.01em',
          }}
        />
        {rightIcon && (
          <button onClick={onRightClick} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
            {rightIcon}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Auth() {
  const [tab, setTab]           = useState('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const [examType, setExamType] = useState('neet')
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const friendlyError = (msg) => {
    if (!msg) return 'Something went wrong. Please try again.'
    if (msg.includes('Invalid login credentials')) return 'Wrong email or password. Please try again.'
    if (msg.includes('Email not confirmed')) return 'Please confirm your email address before logging in.'
    if (msg.includes('User already registered')) return 'An account with this email already exists.'
    if (msg.includes('Password should be at least')) return 'Password must be at least 6 characters.'
    if (msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('Too many requests') || msg.includes('429')) return 'Too many attempts. Please wait a few minutes and try again.'
    return msg
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)

    if (!email.includes('@')) { setError('Please enter a valid email address'); setLoading(false); return }

    if (tab === 'signup') {
      if (!name.trim()) { setError('Please enter your name'); setLoading(false); return }
      if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return }
      const { data, error } = await signUp(email, password, name, examType)
      if (error) setError(friendlyError(error.message))
      else if (data?.session) { useStore.getState().setOnboardingComplete(false); navigate('/onboarding', { replace: true }) }
      else setSuccess('Check your email to confirm your account!')
    } else {
      const { data, error } = await signIn(email, password)
      if (error) setError(friendlyError(error.message))
      else if (data?.session) navigate('/', { replace: true })
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, var(--primary-alt) 0%, #E8F5E9 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 20px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          width: '100%', maxWidth: 380,
          background: '#fff', borderRadius: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
          padding: '32px 24px',
        }}
      >
        {/* Mascot + heading */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <RiveMascot />
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1A1410', marginTop: 4, letterSpacing: '-0.02em' }}>
            {tab === 'login' ? 'Welcome back!' : 'Join Exam Prep'}
          </div>
          <div style={{ fontSize: 14, color: '#9C9185', fontWeight: 600, marginTop: 4 }}>
            {tab === 'login' ? 'Continue your streak' : 'Start your ' + (examType === 'upsc' ? 'UPSC' : 'NEET') + ' journey'}
          </div>
        </div>

        {/* Tab switcher (Duolingo pill) */}
        <div style={{
          display: 'flex', background: '#F7F6F3', borderRadius: 16,
          padding: 4, marginBottom: 24,
        }}>
          {['login', 'signup'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }} style={{
              flex: 1, padding: '10px', borderRadius: 14,
              background: tab === t ? '#fff' : 'transparent',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 800,
              color: tab === t ? '#1A1410' : '#B0ABA0',
              boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              letterSpacing: '0.01em',
            }}>
              {t === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <AnimatePresence>
            {tab === 'signup' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <InputField icon={User} type="text" placeholder="Full name" label="Full name"
                  value={name} onChange={e => setName(e.target.value)} />
              </motion.div>
            )}
          </AnimatePresence>

          <InputField icon={Mail} type="email" placeholder="Email address" label="Email address"
            value={email} onChange={e => setEmail(e.target.value)} />

          <InputField icon={Lock} type={showPw ? 'text' : 'password'} placeholder="Password" label="Password"
            value={password} onChange={e => setPassword(e.target.value)}
            rightIcon={showPw ? <EyeOff size={18} color="#B0ABA0" /> : <Eye size={18} color="#B0ABA0" />}
            onRightClick={() => setShowPw(v => !v)} />

          {tab === 'signup' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>I'm preparing for</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'neet', label: 'NEET', emoji: '🩺', color: '#22C55E' },
                  { id: 'upsc', label: 'UPSC', emoji: '📜', color: '#8B5CF6' },
                ].map(et => (
                  <button key={et.id} type="button" onClick={() => setExamType(et.id)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                    border: examType === et.id ? '2px solid ' + et.color : '2px solid #E5E0D5',
                    background: examType === et.id ? et.color + '10' : '#F7F6F3',
                    fontSize: 14, fontWeight: examType === et.id ? 800 : 600,
                    color: examType === et.id ? et.color : '#B0ABA0',
                    transition: 'all 0.15s',
                  }}>
                    <span>{et.emoji}</span>
                    <span>{et.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{
              background: '#FFF0F0', border: '1.5px solid #FFC0C0',
              borderRadius: 12, padding: '10px 14px',
              fontSize: 13, fontWeight: 600, color: '#C62828',
            }}>
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{
              background: '#E8F8E8', border: '1.5px solid #A8E6A8',
              borderRadius: 12, padding: '10px 14px',
              fontSize: 13, fontWeight: 600, color: '#2E7D32',
            }}>
              {success}
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            whileHover={{ translateY: -1 }}
            style={{
              marginTop: 4, width: '100%', padding: '15px', borderRadius: 14,
              border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#E5E0D5' : 'var(--primary)',
              color: loading ? '#B0ABA0' : '#fff',
              boxShadow: loading ? 'none' : '0 4px 0 var(--primary-dark), 0 6px 16px rgba(249,115,22,0.25)',
              letterSpacing: '0.02em',
              transition: 'all 0.08s',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'One moment...' : tab === 'login' ? 'Log In' : 'Create Account'}
          </motion.button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#E5E0D5' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#B0ABA0' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#E5E0D5' }} />
        </div>

        {/* Google sign-in / sign-up */}
        <motion.button
          type="button"
          onClick={() => signInWithGoogle(tab === 'signup' ? 'signup' : 'login')}
          whileTap={{ scale: 0.97 }}
          style={{
            width: '100%', padding: '13px', borderRadius: 14,
            border: '2px solid #E5E0D5', background: '#fff',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', color: '#1A1410',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.15s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 000 24c0 3.77.87 7.35 2.56 10.56l7.97-5.97z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.97C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {tab === 'signup' ? 'Sign Up with Google' : 'Sign In with Google'}
        </motion.button>
      </motion.div>
    </div>
  )
}
