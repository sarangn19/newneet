import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import useTranslation from '../lib/useTranslation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { ChevronLeft, Save, RotateCcw, Shield, Trash2, Camera, X, Pencil, LogOut } from 'lucide-react'
import { card as cardStyle, spacing } from '../lib/designTokens'
const PROFILE_PICS = [
  '/profile-pics/1.png', '/profile-pics/2.png', '/profile-pics/3.png',
  '/profile-pics/4.png', '/profile-pics/5.png', '/profile-pics/6.png',
]

export default function Profile() {
  const navigate = useNavigate()
  const { user, userId, examType, updateName, setAvatar, language, setLanguage } = useStore()
  const { t } = useTranslation()
  const { session, userRole } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [examYear, setExamYear] = useState(user?.exam_year || 2026)
  const [level, setLevel] = useState(user?.level || 'Beginner')
  const [dailyGoal, setDailyGoal] = useState(user?.daily_goal || '30 min')
  const [notesCount, setNotesCount] = useState(0)
  const [streak] = useState(user?.streak || 0)
  const [saving, setSaving] = useState(false)
  const [showPicPicker, setShowPicPicker] = useState(false)
  const [showSecurity, setShowSecurity] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState('')

  useEffect(() => {
    if (!userId) return
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).then(({ count }) => {
      if (count !== null) setNotesCount(count)
    })
    // Chat count removed — not relevant for exam prep stats
  }, [userId])

  const saveChanges = async () => {
    if (!userId) return; setSaving(true)
    await supabase.from('users').update({ name, exam_year: examYear, level, daily_goal: dailyGoal }).eq('id', userId)
    updateName(name); setSaving(false)
  }

  const updatePassword = async () => {
    if (!currentPw || !newPw || newPw !== confirmPw) { setPwMsg('mismatch'); return }
    setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setPwMsg(error.message)
    else { setPwMsg('updated'); setCurrentPw(''); setNewPw(''); setConfirmPw('') }
  }

  const deleteAccount = async () => {
    if (confirmDelete !== 'DELETE' || !userId) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) {
        const text = await res.text()
        alert('Delete error (' + res.status + '): ' + text)
        return
      }
    } catch {}
    localStorage.removeItem('neet-prep-store')
    localStorage.removeItem('sb-ievtwzygmpluzrltzdmr-auth-token')
    await supabase.auth.signOut(); navigate('/auth')
  }

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh', paddingBottom: 100, overflowX: 'hidden' }}>
      <div className="page-header-light">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="back-btn-dark" onClick={() => navigate('/')}>
            <ChevronLeft size={18} />
          </button>
          <div className="page-header-title" style={{ color: 'var(--text)' }}>{t('profile_title')}</div>
        </div>
      </div>

      <div style={{ padding: spacing.container, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Avatar + Info + Stats compact */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
          <div style={{ padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <div onClick={() => setShowPicPicker(!showPicPicker)} style={{
                width: 56, height: 56, borderRadius: '50%', background: 'var(--border)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
              }}>
                {user?.avatar ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={18} color="var(--text-3)" />}
              </div>
              {showPicPicker && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 10,
                  background: 'var(--card-bg)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 10,
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, width: 160, marginTop: 6,
                }}>
                  {PROFILE_PICS.map((src, i) => (
                    <motion.div key={i} whileTap={{scale:1.1}} onClick={() => { setAvatar(src); setShowPicPicker(false) }} style={{
                      width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', overflow: 'hidden',
                      border: user?.avatar === src ? '2px solid var(--primary)' : '2px solid transparent',
                    }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{session?.user?.email || ''}</div>
              <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 99, background: 'var(--primary-light)', fontSize: 9, fontWeight: 600, color: 'var(--primary)' }}>
                {(examType || 'neet').toUpperCase()} Aspirant
              </div>
            </div>
            {/* Compact stats */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { value: notesCount, label: t('profile_notes'), color: 'var(--primary)' },
                { value: streak, label: t('profile_streak'), color: '#EF4444' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', minWidth: 36 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 8, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Settings — read-only summary with Edit button */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} style={cardStyle}>
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('profile_settings')}</div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowEditProfile(true)}
              className="btn-3d"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 12, border: 'none',
                background: 'var(--accent-secondary)',
                color: '#fff', fontSize: 12, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer',
                boxShadow: '0 4px 0 var(--accent-secondary-dark)',
              }}
            >
              <Pencil size={12} /> Edit Profile
            </motion.button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: t('profile_name'),       value: user?.name || '—' },
              { label: t('profile_exam_year'),  value: user?.exam_year || '—' },
              { label: t('profile_level'),      value: user?.level || '—' },
              { label: t('profile_daily_goal'), value: user?.daily_goal || '—' },
              { label: t('profile_exam_track'), value: (examType || 'neet').toUpperCase() },
              { label: t('profile_language'),   value: language === 'ml' ? 'Malayalam' : 'English' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Edit Profile bottom sheet */}
        <AnimatePresence>
          {showEditProfile && (
            <motion.div
              key="edit-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowEditProfile(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)' }}
            >
              <motion.div
                key="edit-sheet"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'var(--card-bg)',
                  borderRadius: '24px 24px 0 0',
                  padding: '0 0 40px',
                  maxHeight: '90vh', overflowY: 'auto',
                }}
              >
                {/* Handle */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                  <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border)' }} />
                </div>

                {/* Header */}
                <div style={{ padding: '12px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Edit Profile</div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowEditProfile(false)}
                    style={{ background: 'var(--surface-alt)', border: 'none', borderRadius: 12, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={16} color="var(--text-2)" />
                  </motion.button>
                </div>

                {/* Fields */}
                <div style={{ padding: '20px 20px 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{t('profile_name')}</div>
                      <input value={name} onChange={e => setName(e.target.value)} style={{
                        width: '100%', padding: '11px 13px', borderRadius: 12, border: '1.5px solid var(--border)',
                        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--page-bg)', color: 'var(--text)',
                      }} />
                    </div>
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{t('profile_exam_year')}</div>
                      <input type="number" value={examYear} onChange={e => setExamYear(Number(e.target.value))} style={{
                        width: '100%', padding: '11px 13px', borderRadius: 12, border: '1.5px solid var(--border)',
                        outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--page-bg)', color: 'var(--text)',
                      }} />
                    </div>
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{t('profile_level')}</div>
                      <select value={level} onChange={e => setLevel(e.target.value)} style={{
                        width: '100%', padding: '11px 13px', borderRadius: 12, border: '1.5px solid var(--border)',
                        outline: 'none', fontFamily: 'inherit', background: 'var(--page-bg)', color: 'var(--text)', boxSizing: 'border-box',
                      }}>
                        {['Beginner', 'Intermediate', 'Advanced'].map(l => <option key={l} value={l}>{t('profile_'+l.toLowerCase())}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{t('profile_daily_goal')}</div>
                      <select value={dailyGoal} onChange={e => setDailyGoal(e.target.value)} style={{
                        width: '100%', padding: '11px 13px', borderRadius: 12, border: '1.5px solid var(--border)',
                        outline: 'none', fontFamily: 'inherit', background: 'var(--page-bg)', color: 'var(--text)', boxSizing: 'border-box',
                      }}>
                        {['15 min', '30 min', '45 min', '1 hour', '2 hours'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{t('profile_exam_track')}</div>
                    <div style={{
                      padding: '11px 13px', borderRadius: 12,
                      background: 'var(--surface-alt)', color: 'var(--text)',
                      fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
                    }}>
                      {examType || 'neet'}
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{t('profile_language')}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['en', 'ml'].map(l => (
                        <motion.button key={l} whileTap={{ scale: 0.96 }}
                          onClick={() => setLanguage(l)}
                          style={{
                            flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                            background: language === l ? 'var(--accent-secondary)' : 'var(--surface-alt)',
                            color: language === l ? '#fff' : 'var(--text-2)',
                            boxShadow: language === l ? '0 4px 0 var(--accent-secondary-dark)' : 'none',
                            transition: 'all 0.1s',
                          }}>{l === 'en' ? t('profile_english') : t('profile_malayalam')}</motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Save / Reset */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={async () => { await saveChanges(); setShowEditProfile(false) }}
                      disabled={saving}
                      className="btn-3d"
                      style={{
                        flex: 1, padding: '13px 0', borderRadius: 12, border: 'none',
                        background: saving ? 'var(--surface-alt)' : 'var(--accent-secondary)',
                        color: '#fff', fontSize: 14, fontWeight: 800,
                        cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        boxShadow: saving ? 'none' : '0 5px 0 var(--accent-secondary-dark)',
                        opacity: saving ? 0.5 : 1,
                      }}>
                      <Save size={14} /> {saving ? t('profile_saving') : t('profile_save')}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => { setName(user?.name || ''); setExamYear(user?.exam_year || 2026); setLevel(user?.level || 'Beginner'); setDailyGoal(user?.daily_goal || '30 min') }}
                      style={{
                        padding: '13px 18px', borderRadius: 12, border: '1.5px solid var(--border)',
                        background: 'var(--card-bg)', color: 'var(--text-2)', fontSize: 14, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      <RotateCcw size={14} /> {t('profile_reset')}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} style={cardStyle}>
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={15} color="var(--text-2)" />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('profile_password')}</div>
            <motion.button whileTap={{scale:0.97}} onClick={() => setShowSecurity(true)}
              className="btn-3d"
              style={{
              padding: '6px 14px', borderRadius: 12, border: 'none',
              background: 'var(--accent-secondary)',
              fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3, color: '#fff',
              boxShadow: '0 4px 0 var(--accent-secondary-dark)',
            }}>{t('profile_change')}</motion.button>
          </div>
        </motion.div>

        {/* Admin */}
        {(userRole === 'admin' || userRole === 'superadmin') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={cardStyle}>
            <div style={{ padding: '12px 14px', display: 'flex', gap: 6 }}>
              <motion.button whileTap={{scale:0.97}} onClick={() => navigate('/admin')}
                className="btn-3d"
                style={{
                flex: 1, padding: '8px 0', borderRadius: 12, border: 'none',
                background: 'var(--accent-secondary)',
                color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3,
                boxShadow: '0 5px 0 var(--accent-secondary-dark)',
              }}>Admin Dashboard</motion.button>
              {userRole === 'superadmin' && (
                <motion.button whileTap={{scale:0.97}} onClick={() => navigate('/superadmin')}
                  className="btn-3d"
                  style={{
                  flex: 1, padding: '8px 0', borderRadius: 12, border: 'none',
                  background: 'var(--accent-secondary)',
                  color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3,
                  boxShadow: '0 5px 0 var(--accent-secondary-dark)',
                }}>Super Admin</motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* Delete Account */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ ...cardStyle, borderColor: 'var(--error)' }}>
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 size={15} color="var(--error)" />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--error)' }}>{t('profile_delete_account')}</div>
            <motion.button whileTap={{scale:0.96}} onClick={() => setShowDelete(true)} style={{
              padding: '6px 14px', borderRadius: 12, border: '1.5px solid var(--error)',
              background: 'var(--error-light)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--error)',
            }}>{t('profile_delete')}</motion.button>
          </div>
        </motion.div>

        {/* Password modal */}
        <AnimatePresence>
          {showSecurity && (
            <motion.div key="sec-modal" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setShowSecurity(false)}
              style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
              <motion.div key="sec-content" initial={{scale:0.92,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.92,opacity:0}}
                onClick={e => e.stopPropagation()}
                style={{ background:'var(--card-bg)', borderRadius:16, width:'100%', maxWidth:360, overflow:'hidden' }}>
                <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ flex:1, fontSize:14, fontWeight:700, color:'var(--text)' }}>{t('profile_change_password')}</div>
                  <motion.button whileTap={{scale:0.9}} onClick={() => setShowSecurity(false)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex' }}>
                    <X size={18} color="var(--text-2)" />
                  </motion.button>
                </div>
                <div style={{ padding:16 }}>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', marginBottom:3 }}>{t('profile_current_pw')}</div>
                    <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={{
                      width:'100%', padding:'11px 13px', borderRadius:12, border:'1.5px solid var(--border)',
                      outline:'none', fontFamily:'inherit', boxSizing:'border-box', background:'var(--card-bg)', color:'var(--text)',
                    }} />
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', marginBottom:3 }}>{t('profile_new_pw')}</div>
                    <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={{
                      width:'100%', padding:'11px 13px', borderRadius:12, border:'1.5px solid var(--border)',
                      outline:'none', fontFamily:'inherit', boxSizing:'border-box', background:'var(--card-bg)', color:'var(--text)',
                    }} />
                  </div>
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'var(--text-2)', marginBottom:3 }}>{t('profile_confirm_pw')}</div>
                    <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={{
                      width:'100%', padding:'11px 13px', borderRadius:12, border:'1.5px solid var(--border)',
                      outline:'none', fontFamily:'inherit', boxSizing:'border-box', background:'var(--card-bg)', color:'var(--text)',
                    }} />
                  </div>
                  {pwMsg && <div style={{ fontSize:11, color:pwMsg==='updated'?'#10B981':pwMsg==='mismatch'?'#EF4444':'#EF4444', marginBottom:8 }}>{pwMsg==='updated' ? t('profile_password_updated') : pwMsg==='mismatch' ? t('profile_password_mismatch') : pwMsg}</div>}
                  <motion.button whileTap={{scale:0.97}} onClick={updatePassword}
                    className="btn-3d"
                    style={{
                    width:'100%', padding:'10px 0', borderRadius:12, border:'none',
                    background:'var(--accent-secondary)',
                    color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'inherit', letterSpacing:0.3,
                    boxShadow:'0 5px 0 var(--accent-secondary-dark)',
                  }}>{t('profile_update_pw')}</motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign Out */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={cardStyle}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={async () => { await supabase.auth.signOut(); navigate('/auth') }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', borderRadius: 16, border: 'none',
              background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit',
              color: 'var(--text)', fontSize: 14, fontWeight: 600,
            }}>
            <LogOut size={16} color="var(--error)" />
            Sign Out
          </motion.button>
        </motion.div>

        {/* Delete modal */}
        <AnimatePresence>
          {showDelete && (
            <motion.div key="del-modal" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setShowDelete(false)}
              style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
              <motion.div key="del-content" initial={{scale:0.92,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.92,opacity:0}}
                onClick={e => e.stopPropagation()}
                style={{ background:'var(--card-bg)', borderRadius:16, width:'100%', maxWidth:360, overflow:'hidden' }}>
                <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', borderBottom:'1px solid var(--error)' }}>
                  <Trash2 size={16} color="var(--error)" style={{marginRight:8}} />
                  <div style={{ flex:1, fontSize:14, fontWeight:700, color:'var(--error)' }}>{t('profile_delete_confirm_title')}</div>
                  <motion.button whileTap={{scale:0.9}} onClick={() => setShowDelete(false)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex' }}>
                    <X size={18} color="var(--text-2)" />
                  </motion.button>
                </div>
                <div style={{ padding:16 }}>
                  <div style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.5, marginBottom:10 }}>
                    {t('profile_delete_confirm_desc')}
                  </div>
                    <input value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} placeholder={t('profile_delete_placeholder')} style={{
                      width:'100%', padding:'11px 13px', borderRadius:12, border:'1.5px solid var(--error)',
                      outline:'none', fontFamily:'inherit', marginBottom:10, boxSizing:'border-box', background:'var(--card-bg)', color:'var(--text)',
                    }} />
                  <div style={{ display:'flex', gap:8 }}>
                    <motion.button whileTap={{scale:0.97}} onClick={deleteAccount} disabled={confirmDelete!=='DELETE'}
                      className="btn-3d-danger"
                      style={{
                      flex:1, padding:'10px 0', borderRadius:12, border:'none',
                      background:confirmDelete==='DELETE'?'var(--error)':'var(--surface-alt)',
                      color:confirmDelete==='DELETE'?'#fff':'var(--text-3)',
                      fontSize:12, fontWeight:800, cursor:confirmDelete==='DELETE'?'pointer':'default', fontFamily:'inherit', letterSpacing:0.3,
                      boxShadow:confirmDelete==='DELETE'?'0 5px 0 #991B1B':'none',
                    }}>{t('profile_confirm_delete')}</motion.button>
                    <motion.button whileTap={{scale:0.97}} onClick={() => { setShowDelete(false); setConfirmDelete('') }} style={{
                      padding:'10px 16px', borderRadius:12, border:'1.5px solid var(--border)',
                      background:'var(--card-bg)', color:'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                    }}>{t('profile_cancel')}</motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
