import { useState, useEffect, createContext, useContext } from 'react'
import { supabase, supabaseConfigError, hasUsersTable } from './supabase'
import useStore from '../store/useStore'

const AuthContext = createContext(null)

const authConfigError = () => ({
  data: { user: null, session: null },
  error: new Error(supabaseConfigError),
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('user')
  const syncFromSupabase = useStore((s) => s.syncFromSupabase)

  const fetchRole = async (userId) => {
    if (!supabase || !hasUsersTable) return
    try {
      const { data } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
      if (data?.role) setUserRole(data.role)
    } catch {}
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let oauthResolved = false

    const sub = supabase.auth.onAuthStateChange((_event, nextSession) => {
      oauthResolved = true
      setSession(nextSession)
      if (nextSession) {
        try {
          const stored = JSON.parse(localStorage.getItem('neet-prep-store') || '{}')
          if (stored.state?.userId && stored.state.userId !== nextSession.user.id) {
            localStorage.removeItem('neet-prep-store')
          }
        } catch {}
        syncFromSupabase(nextSession.user.id)
        fetchRole(nextSession.user.id)
      } else {
        setUserRole('user')
      }
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (oauthResolved) return
      setSession(session)
      if (session) {
        try {
          const stored = JSON.parse(localStorage.getItem('neet-prep-store') || '{}')
          if (stored.state?.userId && stored.state.userId !== session.user.id) {
            localStorage.removeItem('neet-prep-store')
          }
        } catch {}
        syncFromSupabase(session.user.id)
        fetchRole(session.user.id)
      }
      setLoading(false)
    })

    return () => sub.data.subscription.unsubscribe()
  }, [syncFromSupabase])

  const signUp = async (email, password, name, examType) => {
    if (!supabase) return authConfigError()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (!error && data.user && hasUsersTable) {
      // Clear any leftover persist data from previous sessions
      try { localStorage.removeItem('neet-prep-store') } catch {}

      try { await supabase.from('users').upsert(
        {
          id: data.user.id,
          email,
          name: name || email.split('@')[0],
          avatar: '',
          role: 'user',
          status: 'active',
          level: 1,
          streak: 0,
          tokens: 0,
          gems: 0,
          completed_lessons: 0,
          last_active: new Date().toISOString().split('T')[0],
          exam_type: examType || 'neet',
        },
        { onConflict: 'id' }
      ) } catch {} }

    return { data, error }
  }

  const signIn = async (email, password) => {
    if (!supabase) return authConfigError()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user && hasUsersTable) {
      try { await supabase.from('users').update({ last_active: new Date().toISOString().split('T')[0] }).eq('id', data.user.id) } catch {}
    }
    return { data, error }
  }

  const signInWithGoogle = async (mode = 'login') => {
    if (!supabase) return authConfigError()

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '?google_auth=' + mode },
    })
    return { data, error }
  }

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setSession(null)
    // Wipe persisted store so next user doesn't inherit old data
    try { localStorage.removeItem('neet-prep-store') } catch {}
  }

  return (
    <AuthContext.Provider value={{ session, loading, userRole, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
