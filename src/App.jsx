import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/useAuth'
import { supabase } from './lib/supabase'
import useStore from './store/useStore'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import UpscHome from './pages/UpscHome'
import Learn from './pages/Learn'
import Chapters from './pages/Chapters'
import Roadmap from './pages/Roadmap'
import Module from './pages/Module'
import MCQPractice from './pages/MCQPractice'
import Battle from './pages/Battle'
import Statistics from './pages/Statistics'
import Profile from './pages/Profile'
import Auth from './pages/Auth'
import CurrentAffairs from './pages/CurrentAffairs'
import AIChatbot from './pages/AIChatbot'
import PrelimsTest from './pages/PrelimsTest'
import AdaptivePractice from './pages/AdaptivePractice'
import NoteEditor from './pages/NoteEditor'
import Notes from './pages/Notes'
import AdminDashboard from './pages/AdminDashboard'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import Revision from './pages/Revision'
import RevisionSchedule from './pages/RevisionSchedule'
import PyqSearch from './pages/PyqSearch'
import UpscAnalytics from './pages/UpscAnalytics'
import Onboarding from './pages/Onboarding'

const NEET_TABS = ['/', '/battle', '/mcq', '/stats', '/profile']
const UPSC_TABS = ['/', '/learn', '/current-affairs', '/ai-chatbot', '/stats', '/profile']

function getTabIndex(pathname, examType) {
  const order = examType === 'upsc' ? UPSC_TABS : NEET_TABS
  // Exact match
  const exact = order.indexOf(pathname)
  if (exact !== -1) return exact
  // Prefix match (e.g. /battle/something → /battle)
  const prefix = order.findIndex(t => t !== '/' && pathname.startsWith(t))
  return prefix !== -1 ? prefix : 0
}

// ── Loading spinner ───────────────────────────────────────────────
function Loader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--white)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '4px solid var(--border)',
          borderTopColor: 'var(--primary-alt)',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }} />
        <div style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 600 }}>Loading...</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Animated page wrapper ─────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation()
  const examType = useStore(s => s.examType)
  const prevPath = useRef(location.pathname)
  const tabIdx = getTabIndex(location.pathname, examType)
  const prevTabIdx = getTabIndex(prevPath.current, examType)
  const direction = tabIdx >= prevTabIdx ? 1 : -1
  useEffect(() => { prevPath.current = location.pathname }, [location.pathname])

  return (
    <AnimatePresence initial={false} custom={direction}>
      <motion.div
        key={location.pathname}
        custom={direction}
        variants={{
          enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
          center: { x: 0, opacity: 1 },
          exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
        }}

        initial="enter"
        animate="center"
        exit="exit"
        transition={{ type: 'tween', duration: 0.22, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--page-bg)' }}
      >
        <div className="app-content">
          <Routes location={location}>
          <Route path="/"                            element={examType === 'neet' ? <Home /> : <UpscHome />} />
          <Route path="/learn"                       element={<Learn />} />
          <Route path="/subject/:subjectId"          element={<Chapters />} />
          <Route path="/subject/:subjectId/chapter/:chapterId"                  element={<Roadmap />} />
          <Route path="/subject/:subjectId/chapter/:chapterId/module/:moduleId" element={<Module />} />
          <Route path="/mcq"                         element={<MCQPractice />} />
          <Route path="/battle"                      element={<Battle />} />
          <Route path="/stats"                       element={examType === 'upsc' ? <UpscAnalytics /> : <Statistics />} />
          <Route path="/profile"                     element={<Profile />} />
          <Route path="/admin"                       element={<AdminDashboard />} />
          <Route path="/current-affairs"             element={<CurrentAffairs />} />
          <Route path="/ai-chatbot"                   element={<AIChatbot />} />
          <Route path="/prelims-test"                 element={<PrelimsTest />} />
          <Route path="/adaptive-practice"            element={<AdaptivePractice />} />
          <Route path="/notes"                        element={<Notes />} />
          <Route path="/superadmin"                  element={<SuperAdminDashboard />} />
          <Route path="/note/:noteId"                 element={<NoteEditor />} />
          <Route path="/revision/:topicId"            element={<Revision />} />
          <Route path="/revision-schedule"           element={<RevisionSchedule />} />
          <Route path="/pyq-search"                  element={<PyqSearch />} />
          <Route path="*"                            element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Protected route wrapper ───────────────────────────────────────
function ProtectedRoutes() {
  const { session, loading } = useAuth()
  const examType = useStore(s => s.examType)
  const userId = useStore(s => s.userId)
  const isDemo = useStore(s => s.isDemo)
  const [newUserDecision, setNewUserDecision] = useState(null)
  const googleAuthRef = useRef(null)
  const navigate = useNavigate()

  // Capture google_auth param once and clean URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ga = params.get('google_auth')
    if (ga) {
      googleAuthRef.current = ga
      const url = new URL(window.location)
      url.searchParams.delete('google_auth')
      window.history.replaceState({}, '', url)
    }
  }, [])

  useEffect(() => {
    if (!session) return

    const ga = googleAuthRef.current

    if (examType === null && userId && newUserDecision === null) {
      if (supabase) {
        supabase.from('users').select('exam_type').eq('id', userId).maybeSingle().then(({ data: row }) => {
          if (row?.exam_type) {
            useStore.getState().setExamType(row.exam_type)
            return
          }
          if (row && !row.exam_type) {
            useStore.getState().setExamType('upsc')
            supabase.from('users').upsert({ id: userId, exam_type: 'upsc' }, { onConflict: 'id' })
            return
          }
          handleNoUserRow(ga, session, setNewUserDecision, navigate)
        })
      } else {
        handleNoUserRow(ga, session, setNewUserDecision, navigate)
      }
      return
    }

    if (ga === 'signup' && examType !== null && examType !== undefined && userId && newUserDecision === null) {
      setNewUserDecision('already_registered')
    }
  }, [examType, userId, newUserDecision, session, navigate])

  function handleNoUserRow(ga, session, setNewUserDecision, navigate) {
    if (ga === 'login') {
      fetch('/api/check-blocked', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      }).then(r => r.json()).then(d => {
        if (d.blocked) setNewUserDecision('pending')
        else navigate('/onboarding', { replace: true })
      }).catch(() => navigate('/onboarding', { replace: true }))
      return
    }
    if (ga === 'signup') {
      navigate('/onboarding', { replace: true })
      return
    }
    fetch('/api/check-blocked', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    }).then(r => r.json()).then(d => {
      if (d.blocked) setNewUserDecision('pending')
      else navigate('/onboarding', { replace: true })
    }).catch(() => navigate('/onboarding', { replace: true }))
  }

  // If URL hash contains access_token, OAuth redirect just landed — wait for session recovery
  if (!loading && !session && !isDemo && window.location.hash?.includes('access_token')) return <Loader />
  if (loading) return <Loader />
  if (!session && !isDemo) return <Navigate to="/auth" replace />
  if (!isDemo && examType === null && !userId) return <Loader />

  if (newUserDecision === 'already_registered') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          background: 'var(--card-bg)', borderRadius: 16, padding: 32, maxWidth: 360, width: '100%',
          textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Already Registered
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 24 }}>
            This Google account is already registered. Please sign in instead.
          </div>
          <button onClick={async () => {
            setNewUserDecision(null)
            try { await supabase?.auth.signOut() } catch {}
            localStorage.removeItem('neet-prep-store')
            localStorage.removeItem('sb-ievtwzygmpluzrltzdmr-auth-token')
            window.location.href = '/auth'
          }} style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
            background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  if (newUserDecision === 'pending') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--page-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          background: 'var(--card-bg)', borderRadius: 16, padding: 32, maxWidth: 360, width: '100%',
          textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Welcome!
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 24 }}>
            This Google account is not registered yet. Would you like to create a new account?
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={async () => {
              setNewUserDecision('cancel')
              try { await supabase?.auth.signOut() } catch {}
              localStorage.removeItem('neet-prep-store')
              localStorage.removeItem('sb-ievtwzygmpluzrltzdmr-auth-token')
              window.location.href = '/auth'
            }} style={{
              flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-2)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button onClick={async () => {
              try { await supabase?.auth.signOut() } catch {}
              localStorage.removeItem('neet-prep-store')
              window.location.href = '/auth'
            }} style={{
              flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
              background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Create Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={examType === 'neet' ? 'neet-mode' : ''} style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <AnimatedRoutes />
      </div>
      <Navbar />
    </div>
  )
}

// ── Auth route (redirect if already logged in) ────────────────────
function AuthRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Loader />
  if (session) return <Navigate to="/" replace />
  return <Auth />
}

// ── Onboarding route (must be authenticated, no navbar) ──────────
function OnboardingRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Loader />
  if (!session) return <Navigate to="/auth" replace />
  return <Onboarding />
}

// ── Root ──────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/auth"       element={<AuthRoute />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/*"          element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
