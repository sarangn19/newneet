import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { subjects, getMcqBank } from '../data/subjects'
import useStore from '../store/useStore'
import { ChevronLeft, ChevronRight, Users, BookOpen, Trophy, AlertCircle, Plus, Trash2, CheckCircle, Edit3, Download, ArrowLeft, BarChart3, Target, Book, Clock, Zap, Newspaper, Repeat, Activity, Timer, PieChart, Layers, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SearchInput from '../components/SearchInput'

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit',
  color: 'var(--text)', background: 'var(--white)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4, display: 'block' }

const emptyQ = { subject: 'biology', chapter: '', question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 0, explanation: '', difficulty: 'medium', source: '' }

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => typeof c === 'string' ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function AdminDashboard() {
  const { userRole, session } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({ totalUsers: 0, activeToday: 0, totalLessons: 0, totalQuestions: 0, localQuestions: 0 })
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const caHistory = useStore(s => s.caHistory)
  const caFallbackCount = useStore(s => s.caFallbackCount)
  const caRetryAttempts = useStore(s => s.caRetryAttempts)
  const caRetrySuccess = useStore(s => s.caRetrySuccess)
  const caMcqTimeoutCount = useStore(s => s.caMcqTimeoutCount)
  const caMcqFailCount = useStore(s => s.caMcqFailCount)

  // Content tab state
  const [contentView, setContentView] = useState('list')
  const [bulkJson, setBulkJson] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')
  const [form, setForm] = useState({ ...emptyQ })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [dbQuestions, setDbQuestions] = useState([])
  const [qFilter, setQFilter] = useState({ subject: 'all', search: '' })
  const [qLoading, setQLoading] = useState(false)

  // Student drill-down
  const [selectedUser, setSelectedUser] = useState(null)
  const [studentData, setStudentData] = useState(null)
  const [studentLoading, setStudentLoading] = useState(false)

  useEffect(() => {
    if (userRole !== 'admin' && userRole !== 'superadmin') return
    fetchData()
  }, [userRole])

  useEffect(() => {
    if (tab === 'content') fetchQuestions()
  }, [tab, qFilter.subject])

  const fetchData = async () => {
    if (!supabase) return
    setLoading(true)

    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (usersData) {
      setUsers(usersData)
      const today = new Date().toISOString().split('T')[0]
      setStats(s => ({
        ...s,
        totalUsers: usersData.length,
        activeToday: usersData.filter(u => u.last_active === today || u.last_active === 'Just now').length,
        totalLessons: usersData.reduce((sum, u) => sum + (u.completed_lessons || 0), 0),
      }))
    }

    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true })
    setStats(s => ({ ...s, totalQuestions: count || 0 }))

    try {
      const localBank = await getMcqBank()
      const allQs = [...(localBank.physics || []), ...(localBank.chemistry || []), ...(localBank.biology || [])]
      setStats(s => ({ ...s, localQuestions: allQs.length }))
    } catch (e) {}

    const { data: logsData } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (logsData) setReports(logsData)
    setLoading(false)
  }

  const fetchQuestions = async () => {
    if (!supabase) return
    setQLoading(true)
    let query = supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(50)
    if (qFilter.subject !== 'all') query = query.eq('subject', qFilter.subject)
    const { data } = await query
    if (data) setDbQuestions(data)
    setQLoading(false)
  }

  const fetchStudentDetail = async (user) => {
    setStudentLoading(true)
    setSelectedUser(user)
    // Query additional stats from user_battle_stats if they exist
    let battleStats = { battles: 0, wins: 0 }
    if (supabase) {
      const { data: bs } = await supabase
        .from('user_battle_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (bs) battleStats = bs
    }
    setStudentData({
      level: user.level || 1,
      xp: user.tokens || 0,
      gems: user.gems || 0,
      streak: user.streak || 0,
      lessons: user.completed_lessons || 0,
      lastActive: user.last_active,
      examType: user.exam_type || 'neet',
      battleWins: battleStats.wins || 0,
      battlesPlayed: battleStats.battles || 0,
    })
    setStudentLoading(false)
  }

  // ── Question CRUD ──────────────────────────────────────────
  const handleSave = async () => {
    if (!supabase || !session) return
    if (!form.question.trim() || !form.chapter.trim() || !form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) {
      setSaveMsg('Please fill all required fields'); setTimeout(() => setSaveMsg(''), 3000); return
    }
    setSaving(true); setSaveMsg('')

    const payload = {
      subject: form.subject, chapter: form.chapter,
      question: form.question,
      option_a: form.option_a, option_b: form.option_b, option_c: form.option_c, option_d: form.option_d,
      correct_option: form.correct_option, explanation: form.explanation,
      difficulty: form.difficulty, source: form.source,
    }

    if (editingId) {
      const { error } = await supabase.from('questions').update(payload).eq('id', editingId)
      setSaving(false)
      if (error) { setSaveMsg('Error: ' + error.message) } else {
        setSaveMsg('Question updated!')
        setEditingId(null)
        setForm({ ...emptyQ, subject: form.subject, chapter: form.chapter })
        fetchQuestions()
        setTimeout(() => setSaveMsg(''), 3000)
      }
    } else {
      payload.created_by = session.user.id
      const { error } = await supabase.from('questions').insert(payload)
      setSaving(false)
      if (error) { setSaveMsg('Error: ' + error.message) } else {
        setSaveMsg('Question added!')
        setForm({ ...emptyQ, subject: form.subject, chapter: form.chapter })
        fetchQuestions()
        setStats(s => ({ ...s, totalQuestions: s.totalQuestions + 1 }))
        setTimeout(() => setSaveMsg(''), 3000)
      }
    }
  }

  const handleEdit = (q) => {
    setForm({
      subject: q.subject, chapter: q.chapter,
      question: q.question,
      option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
      correct_option: q.correct_option, explanation: q.explanation || '',
      difficulty: q.difficulty, source: q.source || '',
    })
    setEditingId(q.id)
    setContentView('add')
  }

  const handleDelete = async (id) => {
    if (!supabase || !window.confirm('Delete this question?')) return
    await supabase.from('questions').delete().eq('id', id)
    setDbQuestions(q => q.filter(x => x.id !== id))
    setStats(s => ({ ...s, totalQuestions: Math.max(0, s.totalQuestions - 1) }))
  }

  const handleBulkSave = async () => {
    if (!supabase || !session || !bulkJson.trim()) return
    setBulkLoading(true); setBulkMsg('')
    try {
      const questions = JSON.parse(bulkJson)
      if (!Array.isArray(questions)) throw new Error('Input must be a JSON array')
      if (questions.length === 0) throw new Error('No questions found in array')
      if (questions.length > 50) throw new Error('Maximum 50 questions per upload')
      const validSubjects = ['physics', 'chemistry', 'biology']
      const validDifficulties = ['easy', 'medium', 'hard']
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        if (!validSubjects.includes(q.subject)) throw new Error(`Question ${i+1}: subject must be physics/chemistry/biology`)
        if (!q.chapter?.trim()) throw new Error(`Question ${i+1}: chapter is required`)
        if (!q.question?.trim()) throw new Error(`Question ${i+1}: question is required`)
        if (!q.option_a?.trim()) throw new Error(`Question ${i+1}: option_a is required`)
        if (!q.option_b?.trim()) throw new Error(`Question ${i+1}: option_b is required`)
        if (!q.option_c?.trim()) throw new Error(`Question ${i+1}: option_c is required`)
        if (!q.option_d?.trim()) throw new Error(`Question ${i+1}: option_d is required`)
        if (typeof q.correct_option !== 'number' || q.correct_option < 0 || q.correct_option > 3)
          throw new Error(`Question ${i+1}: correct_option must be 0, 1, 2, or 3`)
        if (!validDifficulties.includes(q.difficulty)) throw new Error(`Question ${i+1}: difficulty must be easy/medium/hard`)
      }
      const questionsToInsert = questions.map(q => ({
        subject: q.subject, chapter: q.chapter, question: q.question,
        option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
        correct_option: q.correct_option, explanation: q.explanation || '',
        difficulty: q.difficulty, source: q.source || '',
        created_by: session.user.id,
      }))
      const { error } = await supabase.from('questions').insert(questionsToInsert)
      if (error) throw error
      setBulkMsg(`Successfully uploaded ${questions.length} questions!`)
      setBulkJson('')
      fetchQuestions()
      setStats(s => ({ ...s, totalQuestions: s.totalQuestions + questions.length }))
    } catch (err) { setBulkMsg(`Error: ${err.message}`) }
    setBulkLoading(false)
  }

  const formSubjectChapters = subjects.find(s => s.id === form.subject)?.chapters || []

  if (userRole !== 'admin' && userRole !== 'superadmin') {
    return (
      <div className="screen-white" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <AlertCircle size={48} color="#ef4444" />
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>Access Denied</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>You don't have permission to view this page.</div>
        </div>
      </div>
    )
  }

  const statCards = [
    { emoji: '', value: stats.totalUsers, label: 'Total Users' },
    { emoji: '', value: stats.activeToday, label: 'Active Today' },
    { emoji: '', value: stats.totalLessons, label: 'Lessons Done' },
    { emoji: '', value: stats.totalQuestions, label: 'DB Questions' },
    { emoji: '', value: stats.localQuestions, label: 'Local Questions' },
  ]

  const filteredQ = dbQuestions.filter(q =>
    (!qFilter.search || q.question.toLowerCase().includes(qFilter.search.toLowerCase()) || q.chapter.toLowerCase().includes(qFilter.search.toLowerCase()))
  )

  // ── Export helpers ─────────────────────────────────────────
  const exportUsersCSV = () => {
    const rows = [['Name', 'Email', 'Role', 'Status', 'Level', 'XP', 'Gems', 'Streak', 'Lessons', 'Exam', 'Last Active']]
    users.forEach(u => rows.push([
      u.name || '', u.email || '', u.role || 'user', u.status || 'active',
      u.level || 0, u.tokens || 0, u.gems || 0, u.streak || 0,
      u.completed_lessons || 0, u.exam_type || '', u.last_active || '',
    ]))
    downloadCSV(`users-${new Date().toISOString().split('T')[0]}.csv`, rows)
  }

  const exportReportsCSV = () => {
    const rows = [['Event', 'User', 'Created At']]
    reports.forEach(r => rows.push([
      r.event || r.action || '', r.user_id || r.user || '',
      r.created_at ? new Date(r.created_at).toLocaleString() : '',
    ]))
    downloadCSV(`reports-${new Date().toISOString().split('T')[0]}.csv`, rows)
  }

  return (
    <div className="screen-white admin-container">
      {/* Header */}
      <div className="page-header" style={{ background: 'var(--primary)', borderRadius: '0 0 24px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button className="back-btn" onClick={() => navigate('/')}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'white' }}>Admin Dashboard</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Manage your platform</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px', paddingBottom: 100 }}>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {statCards.map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
              <div style={{ fontSize: 24 }}>{s.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 22, marginTop: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'users', label: 'Users', icon: Users },
            { key: 'content', label: 'Questions', icon: BookOpen },
            { key: 'reports', label: 'Reports', icon: Trophy },
            { key: 'ca-insights', label: 'CA Insights', icon: Newspaper },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: '10px 0', borderRadius: 12,
              border: tab === key ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
              background: tab === key ? 'var(--primary-light)' : 'var(--white)',
              color: tab === key ? 'var(--primary)' : 'var(--text-3)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}><Icon size={14} /> {label}</button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
        )}

        {/* ═══════════════ USERS TAB ═══════════════ */}
        {!loading && tab === 'users' && !selectedUser && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button onClick={exportUsersCSV} style={{
                padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
                background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-2)',
              }}><Download size={14} /> Export CSV</button>
            </div>
            <div className="card" style={{ padding: '4px 0' }}>
              {users.map((u, i) => (
                <div key={u.id} onClick={() => fetchStudentDetail(u)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', transition: 'background 0.1s',
                }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--primary)',
                  }}>{u.name?.[0]?.toUpperCase() || '?'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email}</div>
                  </div>
                  <div style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: u.role === 'superadmin' ? '#fef3c7' : u.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                    color: u.role === 'superadmin' ? '#d97706' : u.role === 'admin' ? '#2563eb' : '#6b7280',
                  }}>{u.role}</div>
                  <div style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: u.status === 'active' ? '#dcfce7' : '#fee2e2',
                    color: u.status === 'active' ? '#16a34a' : '#dc2626',
                  }}>{u.status}</div>
                  <ChevronRight size={14} color="var(--text-3)" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ STUDENT DRILL-DOWN ═══════════════ */}
        {!loading && tab === 'users' && selectedUser && (
          <div>
            <button onClick={() => { setSelectedUser(null); setStudentData(null) }} style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              color: 'var(--primary)', fontWeight: 700, fontSize: 13, marginBottom: 16, fontFamily: 'inherit', padding: 0,
            }}><ArrowLeft size={16} /> Back to Users</button>

            {studentLoading ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>Loading student data...</div>
            ) : (
              <div>
                {/* Profile card */}
                <div className="card" style={{ padding: 20, textAlign: 'center', marginBottom: 16 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%', background: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 700, color: '#fff', margin: '0 auto 12px',
                  }}>{selectedUser.name?.[0]?.toUpperCase() || '?'}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{selectedUser.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{selectedUser.email}</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      background: selectedUser.role === 'superadmin' ? '#fef3c7' : selectedUser.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                      color: selectedUser.role === 'superadmin' ? '#d97706' : selectedUser.role === 'admin' ? '#2563eb' : '#6b7280',
                    }}>{selectedUser.role}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      background: selectedUser.status === 'active' ? '#dcfce7' : '#fee2e2',
                      color: selectedUser.status === 'active' ? '#16a34a' : '#dc2626',
                    }}>{selectedUser.status}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                      background: selectedUser.exam_type === 'upsc' ? '#fef3c7' : '#dbeafe',
                      color: selectedUser.exam_type === 'upsc' ? '#d97706' : '#2563eb',
                    }}>{(selectedUser.exam_type || 'neet').toUpperCase()}</span>
                  </div>
                </div>

                {/* Stats grid */}
                {studentData && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[
                      { icon: Zap, value: studentData.level, label: 'Level', color: 'var(--primary)' },
                      { icon: Target, value: studentData.xp, label: 'XP', color: '#f59e0b' },
                      { icon: BarChart3, value: studentData.streak, label: 'Streak', color: '#ef4444' },
                      { icon: Book, value: studentData.lessons, label: 'Lessons', color: '#8b5cf6' },
                      { icon: Trophy, value: `${studentData.battleWins}/${studentData.battlesPlayed}`, label: 'Battles', color: '#06b6d4' },
                      { icon: Clock, value: studentData.lastActive || 'N/A', label: 'Last Active', color: '#6b7280' },
                    ].map((s, i) => (
                      <div key={i} className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
                        <s.icon size={18} color={s.color} style={{ display: 'block', margin: '0 auto 4px' }} />
                        <div style={{ fontWeight: 900, fontSize: 18, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Activity Timeline Placeholder */}
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Recent Activity</div>
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)', fontSize: 13 }}>
                    Detailed activity tracking coming soon
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ CONTENT / QUESTIONS TAB ═══════ */}
        {!loading && tab === 'content' && contentView === 'list' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={() => { setEditingId(null); setForm({ ...emptyQ }); setContentView('add') }} style={{
                flex: 1, padding: '14px', borderRadius: 12,
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white',
                border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit',
              }}><Plus size={18} /> Add Single</button>
              <button onClick={() => setContentView('bulk')} style={{
                flex: 1, padding: '14px', borderRadius: 12,
                background: 'var(--white)', color: 'var(--primary)',
                border: '2px solid var(--primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit',
              }}><Plus size={18} /> Bulk Upload</button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[{ id: 'all', label: 'All' }, { id: 'physics', label: 'Phy' }, { id: 'chemistry', label: 'Chem' }, { id: 'biology', label: 'Bio' }].map(s => (
                <button key={s.id} onClick={() => setQFilter(f => ({ ...f, subject: s.id }))} style={{
                  flex: 1, padding: '7px 0', borderRadius: 12,
                  background: qFilter.subject === s.id ? 'var(--primary)' : 'var(--white)',
                  border: `1.5px solid ${qFilter.subject === s.id ? 'var(--primary)' : 'var(--border)'}`,
                  color: qFilter.subject === s.id ? 'white' : 'var(--text-3)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>{s.label}</button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <SearchInput value={qFilter.search} onChange={v => setQFilter(f => ({ ...f, search: v }))} placeholder="Search questions..." />
            </div>

            {qLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)', fontSize: 13 }}>Loading questions...</div>
            ) : filteredQ.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}></div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>No questions yet</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Add your first question to the bank!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredQ.map(q => (
                  <div key={q.id} className="card" style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: q.subject === 'physics' ? 'var(--phys-light)' : q.subject === 'chemistry' ? 'var(--chem-light)' : 'var(--bio-light)',
                          color: q.subject === 'physics' ? 'var(--phys)' : q.subject === 'chemistry' ? 'var(--chem)' : 'var(--bio)',
                        }}>{q.subject}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{q.chapter}</span>
                        <span style={{
                          padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                          background: q.difficulty === 'hard' ? '#fee2e2' : q.difficulty === 'easy' ? '#dcfce7' : '#f3f4f6',
                          color: q.difficulty === 'hard' ? '#dc2626' : q.difficulty === 'easy' ? '#16a34a' : '#6b7280',
                        }}>{q.difficulty}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleEdit(q)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        }}><Edit3 size={14} color="var(--primary)" /></button>
                        <button onClick={() => handleDelete(q.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        }}><Trash2 size={14} color="#ef4444" /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: 6 }}>{q.question}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {['option_a', 'option_b', 'option_c', 'option_d'].map((key, i) => (
                        <div key={key} style={{
                          fontSize: 11, padding: '4px 8px', borderRadius: 6,
                          background: q.correct_option === i ? 'rgba(16,185,129,0.1)' : 'var(--bg)',
                          border: q.correct_option === i ? '1px solid #10b981' : '1px solid transparent',
                          color: q.correct_option === i ? '#10b981' : 'var(--text-2)',
                          fontWeight: q.correct_option === i ? 700 : 500,
                        }}>{String.fromCharCode(65 + i)}. {q[key]}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ ADD/EDIT QUESTION FORM ═══════ */}
        {!loading && tab === 'content' && contentView === 'add' && (
          <div>
            <button onClick={() => { setContentView('list'); setEditingId(null); setForm({ ...emptyQ }) }} style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              color: 'var(--primary)', fontWeight: 700, fontSize: 13, marginBottom: 16, fontFamily: 'inherit', padding: 0,
            }}><ChevronLeft size={16} /> Back to Questions</button>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: 'var(--text)' }}>
                {editingId ? 'Edit Question' : 'Add New Question'}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Subject *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ id: 'physics', label: 'Physics' }, { id: 'chemistry', label: 'Chemistry' }, { id: 'biology', label: 'Biology' }].map(s => (
                    <button key={s.id} onClick={() => setForm(f => ({ ...f, subject: s.id, chapter: '' }))} style={{
                      flex: 1, padding: '9px 4px', borderRadius: 12,
                      background: form.subject === s.id ? 'var(--primary)' : 'var(--white)',
                      border: `1.5px solid ${form.subject === s.id ? 'var(--primary)' : 'var(--border)'}`,
                      color: form.subject === s.id ? 'white' : 'var(--text)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Chapter *</label>
                <select value={form.chapter} onChange={e => setForm(f => ({ ...f, chapter: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select chapter...</option>
                  {formSubjectChapters.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Question *</label>
                <textarea value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                  rows={3} placeholder="Enter the question text..."
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {['A', 'B', 'C', 'D'].map((letter, i) => {
                const key = `option_${letter.toLowerCase()}`
                return (
                  <div key={letter} style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>
                      Option {letter} *
                      {form.correct_option === i && <span style={{ color: '#10b981', marginLeft: 6 }}>✓ Correct</span>}
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={`Option ${letter}`} style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => setForm(f => ({ ...f, correct_option: i }))} style={{
                        width: 36, height: 36, borderRadius: 12, border: `2px solid ${form.correct_option === i ? '#10b981' : 'var(--border)'}`,
                        background: form.correct_option === i ? 'rgba(16,185,129,0.1)' : 'var(--white)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {form.correct_option === i && <CheckCircle size={16} color="#10b981" />}
                      </button>
                    </div>
                  </div>
                )
              })}

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Explanation</label>
                <textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
                  rows={2} placeholder="Why this answer is correct..."
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Difficulty</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['easy', 'medium', 'hard'].map(d => (
                      <button key={d} onClick={() => setForm(f => ({ ...f, difficulty: d }))} style={{
                        flex: 1, padding: '7px 0', borderRadius: 12,
                        background: form.difficulty === d
                          ? d === 'easy' ? '#dcfce7' : d === 'hard' ? '#fee2e2' : '#f3f4f6'
                          : 'var(--white)',
                        border: `1.5px solid ${form.difficulty === d
                          ? d === 'easy' ? '#16a34a' : d === 'hard' ? '#dc2626' : '#9ca3af'
                          : 'var(--border)'}`,
                        color: form.difficulty === d
                          ? d === 'easy' ? '#16a34a' : d === 'hard' ? '#dc2626' : '#374151'
                          : 'var(--text-3)',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        textTransform: 'capitalize',
                      }}>{d}</button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Source</label>
                  <input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    placeholder="e.g. NEET 2023" style={inputStyle} />
                </div>
              </div>

              {saveMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600,
                  background: saveMsg.startsWith('Error') ? '#fee2e2' : '#dcfce7',
                  color: saveMsg.startsWith('Error') ? '#dc2626' : '#16a34a',
                }}>{saveMsg}</div>
              )}

              <button onClick={handleSave} disabled={saving} style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: saving ? '#94a3b8' : 'linear-gradient(135deg, var(--primary), #e67e22)',
                color: 'white', border: 'none', fontSize: 14, fontWeight: 700,
                cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>{saving ? 'Saving...' : editingId ? 'Update Question' : 'Save Question'}</button>
            </div>
          </div>
        )}

        {/* ═══════ BULK UPLOAD VIEW ═══════ */}
        {!loading && tab === 'content' && contentView === 'bulk' && (
          <div>
            <button onClick={() => setContentView('list')} style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              color: 'var(--primary)', fontWeight: 700, fontSize: 13, marginBottom: 16, fontFamily: 'inherit', padding: 0,
            }}><ChevronLeft size={16} /> Back to Questions</button>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, color: 'var(--text)' }}>Bulk Upload Questions</div>

              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>JSON Format:</div>
                <pre style={{ background: '#f8fafc', borderRadius: 6, padding: 10, fontSize: 11, overflow: 'auto', margin: 0, color: '#334155' }}>{`[
  {
    "subject": "biology",
    "chapter": "Digestion and Absorption",
    "question": "The alimentary canal is approximately how long?",
    "option_a": "3 metres",
    "option_b": "6 metres",
    "option_c": "9 metres",
    "option_d": "12 metres",
    "correct_option": 1,
    "explanation": "...",
    "difficulty": "medium",
    "source": "NCERT"
  }
]`}</pre>
                <div style={{ marginTop: 8, color: '#64748b', fontSize: 11 }}>
                  <strong>Fields:</strong> subject (physics/chemistry/biology), chapter, question, option_a-d, correct_option (0-3), explanation, difficulty (easy/medium/hard), source
                </div>
              </div>

              <textarea value={bulkJson} onChange={e => setBulkJson(e.target.value)}
                rows={12} placeholder="Paste your JSON array here..."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />

              {bulkMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, marginTop: 12, fontSize: 13, fontWeight: 600,
                  background: bulkMsg.startsWith('Error') ? '#fee2e2' : bulkMsg.startsWith('Uploading') ? '#dbeafe' : '#dcfce7',
                  color: bulkMsg.startsWith('Error') ? '#dc2626' : bulkMsg.startsWith('Uploading') ? '#2563eb' : '#16a34a',
                }}>{bulkMsg}</div>
              )}

              <button onClick={handleBulkSave} disabled={bulkLoading || !bulkJson.trim()} style={{
                width: '100%', padding: '14px', borderRadius: 12, marginTop: 12,
                background: bulkLoading || !bulkJson.trim() ? '#94a3b8' : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: 'white', border: 'none', fontSize: 14, fontWeight: 700,
                cursor: bulkLoading || !bulkJson.trim() ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>{bulkLoading ? 'Uploading...' : 'Upload Questions'}</button>
            </div>
          </div>
        )}

        {/* ═══════ REPORTS TAB ═══════ */}
        {!loading && tab === 'reports' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button onClick={exportReportsCSV} disabled={reports.length === 0} style={{
                padding: '8px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
                background: 'var(--white)', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                color: reports.length === 0 ? 'var(--text-3)' : 'var(--text-2)',
                opacity: reports.length === 0 ? 0.5 : 1,
              }}><Download size={14} /> Export CSV</button>
            </div>
            <div className="card" style={{ padding: '4px 0' }}>
              {reports.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  No system logs yet
                </div>
              ) : reports.map((r, i) => (
                <div key={r.id || i} style={{
                  padding: '12px 16px',
                  borderBottom: i < reports.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.event || r.action || 'Log entry'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ CA INSIGHTS TAB ═══════ */}
        {!loading && tab === 'ca-insights' && <CaInsights caHistory={caHistory} caFallbackCount={caFallbackCount} caRetryAttempts={caRetryAttempts} caRetrySuccess={caRetrySuccess} caMcqTimeoutCount={caMcqTimeoutCount} caMcqFailCount={caMcqFailCount} />}
      </div>
    </div>
  )
}

// ── CA Insights Sub-Component ──────────────────────────────────────
function CaInsights({ caHistory, caFallbackCount, caRetryAttempts, caRetrySuccess, caMcqTimeoutCount, caMcqFailCount }) {
  const reading = useMemo(() => {
    const total = caHistory.length
    const unique = new Set(caHistory.map(h => h.articleId))
    const uniqueCount = unique.size
    const reads = caHistory.filter(h => h.timeSpentSeconds > 0)
    const totalReadTime = reads.reduce((s, h) => s + h.timeSpentSeconds, 0)
    const avgTime = reads.length > 0 ? Math.round(totalReadTime / reads.length) : 0
    const times = reads.map(h => h.timeSpentSeconds).sort((a, b) => a - b)
    const median = times.length > 0
      ? times.length % 2 === 0
        ? Math.round((times[times.length/2 - 1] + times[times.length/2]) / 2)
        : times[Math.floor(times.length/2)]
      : 0
    const under5 = caHistory.filter(h => h.timeSpentSeconds < 5).length
    const mid = caHistory.filter(h => h.timeSpentSeconds >= 5 && h.timeSpentSeconds <= 30).length
    const over30 = caHistory.filter(h => h.timeSpentSeconds > 30).length
    return { total, uniqueCount, avgTime, median, under5, mid, over30 }
  }, [caHistory])

  const categoryEng = useMemo(() => {
    const map = {}
    caHistory.forEach(h => {
      const cat = h.category || 'General'
      if (!map[cat]) map[cat] = { opens: 0, reads: 0, bookmarks: 0, mcqs: 0 }
      map[cat].opens++
      if (h.timeSpentSeconds > 0) map[cat].reads++
      if (h.bookmarked) map[cat].bookmarks++
      if (h.generatedMCQs) map[cat].mcqs++
    })
    return Object.entries(map).map(([cat, d]) => ({
      category: cat, opens: d.opens, reads: d.reads,
      bookmarks: d.bookmarks, mcqs: d.mcqs,
      bookmarkRate: d.opens > 0 ? Math.round((d.bookmarks / d.opens) * 100) : 0,
      mcqRate: d.opens > 0 ? Math.round((d.mcqs / d.opens) * 100) : 0,
    })).sort((a, b) => b.opens - a.opens)
  }, [caHistory])

  const funnel = useMemo(() => {
    const opened = new Set(caHistory.map(h => h.articleId))
    const read = new Set(caHistory.filter(h => h.timeSpentSeconds > 0).map(h => h.articleId))
    const bookmarked = new Set(caHistory.filter(h => h.bookmarked).map(h => h.articleId))
    const mcq = new Set(caHistory.filter(h => h.generatedMCQs).map(h => h.articleId))
    const o = opened.size, r = read.size, b = bookmarked.size, m = mcq.size
    return {
      opened: o, read: r, bookmarked: b, mcq: m,
      openToRead: o > 0 ? Math.round((r / o) * 100) : 0,
      readToBookmark: r > 0 ? Math.round((b / r) * 100) : 0,
      bookmarkToMcq: b > 0 ? Math.round((m / b) * 100) : 0,
      overall: o > 0 ? Math.round((m / o) * 100) : 0,
    }
  }, [caHistory])

  const repeat = useMemo(() => {
    const countMap = {}
    caHistory.forEach(h => {
      if (!countMap[h.articleId]) countMap[h.articleId] = { count: 0, title: h.articleTitle }
      countMap[h.articleId].count++
    })
    const entries = Object.values(countMap)
    const repeatArticles = entries.filter(e => e.count > 1).length
    const mostRevisited = entries.sort((a, b) => b.count - a.count).slice(0, 5)
    const sessionMap = {}
    caHistory.forEach(h => {
      const date = h.openedAt?.split('T')[0] || 'unknown'
      if (!sessionMap[date]) sessionMap[date] = new Set()
      sessionMap[date].add(h.articleId)
    })
    const sessionCounts = Object.values(sessionMap).map(s => s.size)
    const avgPerSession = sessionCounts.length > 0
      ? Math.round(sessionCounts.reduce((s, c) => s + c, 0) / sessionCounts.length)
      : 0
    return { repeatArticles, avgPerSession, mostRevisited }
  }, [caHistory])

  const infra = useMemo(() => {
    const retryRate = caRetryAttempts > 0 ? Math.round((caRetrySuccess / caRetryAttempts) * 100) : null
    const mcqTotalGen = caMcqTimeoutCount + caMcqFailCount
    const mcqTimeoutRate = mcqTotalGen > 0 ? Math.round((caMcqTimeoutCount / mcqTotalGen) * 100) : null
    const mcqFailRate = mcqTotalGen > 0 ? Math.round((caMcqFailCount / mcqTotalGen) * 100) : null
    return { retryRate, mcqTimeoutRate, mcqFailRate }
  }, [caFallbackCount, caRetryAttempts, caRetrySuccess, caMcqTimeoutCount, caMcqFailCount])

  const decisions = useMemo(() => {
    const recs = []
    const bookmarkRate = funnel.read > 0 ? Math.round((funnel.bookmarked / funnel.read) * 100) : 0
    const mcqGenRate = funnel.bookmarked > 0 ? Math.round((funnel.mcq / funnel.bookmarked) * 100) : 0

    if (bookmarkRate > 25 && mcqGenRate > 20) {
      recs.push({
        action: 'Evaluate CA → Revision integration',
        why: `Bookmark rate ${bookmarkRate}% (>25%) and MCQ gen rate ${mcqGenRate}% (>20%) indicate active learning behaviour. Integration would create a seamless study loop.`,
        metrics: `Bookmark rate: ${bookmarkRate}% | MCQ gen rate: ${mcqGenRate}%`,
        confidence: 'High',
      })
    }

    if (infra.mcqTimeoutRate !== null && infra.mcqTimeoutRate > 15) {
      recs.push({
        action: 'Improve AI infrastructure before expanding MCQ workflows',
        why: `MCQ timeout rate is ${infra.mcqTimeoutRate}% (>15%). Users are experiencing generation failures at scale, eroding trust.`,
        metrics: `Timeout rate: ${infra.mcqTimeoutRate}% | Total failures: ${caMcqTimeoutCount + caMcqFailCount}`,
        confidence: 'High',
      })
    }

    if (reading.median < 10 && reading.total > 5) {
      recs.push({
        action: 'Review article summaries and relevance quality',
        why: `Median read time is ${reading.median}s (<10s). Users are skimming, suggesting content may not match UPSC needs.`,
        metrics: `Median read time: ${reading.median}s | <5s skim rate: ${reading.total > 0 ? Math.round((reading.under5 / reading.total) * 100) : 0}%`,
        confidence: reading.total > 20 ? 'High' : 'Medium',
      })
    }

    const totalOpens = categoryEng.reduce((s, c) => s + c.opens, 0)
    categoryEng.forEach(c => {
      const share = totalOpens > 0 ? Math.round((c.opens / totalOpens) * 100) : 0
      if (share > 40) {
        recs.push({
          action: `Consider prioritizing "${c.category}" in article selection`,
          why: `"${c.category}" accounts for ${share}% of all opens (>40%). This category drives disproportionate engagement.`,
          metrics: `${c.category} opens: ${c.opens} / ${totalOpens} total (${share}%)`,
          confidence: 'High',
        })
      }
    })

    if (recs.length === 0) {
      recs.push({
        action: 'Collect more data before making roadmap decisions',
        why: 'No threshold-triggering patterns detected yet. Continue beta data collection.',
        metrics: `Total interactions: ${reading.total}`,
        confidence: 'Low',
      })
    }

    return recs
  }, [categoryEng, funnel, reading, infra])

  if (caHistory.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <Newspaper size={40} color="var(--text-3)" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>No Current Affairs data yet</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Data appears once students start using the Current Affairs feature.</div>
      </div>
    )
  }

  const skimRate = reading.total > 0 ? Math.round((reading.under5 / reading.total) * 100) : 0
  const repeatRate = reading.uniqueCount > 0 ? Math.round((repeat.repeatArticles / reading.uniqueCount) * 100) : 0
  const topCat = categoryEng[0]
  const bottomCat = categoryEng[categoryEng.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ─── 1. Reading Behavior ─── */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Timer size={16} color="var(--primary)" />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Reading Behavior</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <InsightBox label="Total Opens" value={reading.total} />
          <InsightBox label="Unique Articles" value={reading.uniqueCount} />
          <InsightBox label="Avg Read Time" value={`${reading.avgTime}s`} />
          <InsightBox label="Median Read Time" value={`${reading.median}s`} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Time Spent Distribution</div>
        <BarSegment label="< 5s (skim)" count={reading.under5} total={reading.total} color="#EF4444" />
        <BarSegment label="5-30s" count={reading.mid} total={reading.total} color="#F59E0B" />
        <BarSegment label="> 30s (deep read)" count={reading.over30} total={reading.total} color="#10B981" />
      </div>

      {/* ─── 2. Category Engagement ─── */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <PieChart size={16} color="var(--primary)" />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Category Engagement</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-3)', fontWeight: 700 }}>
                <th style={{ textAlign: 'left', padding: '6px 4px' }}>Category</th>
                <th style={{ textAlign: 'center', padding: '6px 4px' }}>Opens</th>
                <th style={{ textAlign: 'center', padding: '6px 4px' }}>Reads</th>
                <th style={{ textAlign: 'center', padding: '6px 4px' }}>Bookmark%</th>
                <th style={{ textAlign: 'center', padding: '6px 4px' }}>MCQ%</th>
              </tr>
            </thead>
            <tbody>
              {categoryEng.map(c => (
                <tr key={c.category} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600, color: 'var(--text)' }}>{c.category}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-2)' }}>{c.opens}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-2)' }}>{c.reads}</td>
                  <td style={{ textAlign: 'center', color: c.bookmarkRate > 20 ? 'var(--success)' : 'var(--text-3)' }}>{c.bookmarkRate}%</td>
                  <td style={{ textAlign: 'center', color: c.mcqRate > 10 ? 'var(--success)' : 'var(--text-3)' }}>{c.mcqRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 3. Conversion Funnel ─── */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Layers size={16} color="var(--primary)" />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Conversion Funnel</div>
        </div>
        <FunnelRow label="Articles Opened" count={funnel.opened} />
        <FunnelRow label="Articles Read" count={funnel.read} parentCount={funnel.opened} pct={funnel.openToRead} />
        <FunnelRow label="Articles Bookmarked" count={funnel.bookmarked} parentCount={funnel.read} pct={funnel.readToBookmark} />
        <FunnelRow label="MCQs Generated" count={funnel.mcq} parentCount={funnel.bookmarked} pct={funnel.bookmarkToMcq} />
        <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface-alt)', borderRadius: 10, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
          Overall conversion (open → MCQ): <strong style={{ color: 'var(--text)' }}>{funnel.overall}%</strong>
        </div>
      </div>

      {/* ─── 4. Repeat Behavior ─── */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Repeat size={16} color="var(--primary)" />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Repeat Behavior</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <InsightBox label="Repeat Article Opens" value={repeat.repeatArticles} />
          <InsightBox label="Avg Articles / Session" value={repeat.avgPerSession} />
        </div>
        {repeat.mostRevisited.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Most Revisited</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {repeat.mostRevisited.map((art, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-2)' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>{art.count}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.title}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── 5. Infrastructure Health ─── */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Activity size={16} color="var(--primary)" />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Infrastructure Health</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <InsightBox label="RSS Fallback Count" value={caFallbackCount} />
          <InsightBox label="Retry Attempts" value={caRetryAttempts} />
          <InsightBox label="Retry Success Rate" value={infra.retryRate !== null ? `${infra.retryRate}%` : '—'} />
          <InsightBox label="MCQ Timeout Rate" value={infra.mcqTimeoutRate !== null ? `${infra.mcqTimeoutRate}%` : '—'} />
          <InsightBox label="MCQ Failure Rate" value={infra.mcqFailRate !== null ? `${infra.mcqFailRate}%` : '—'} />
          <InsightBox label="MCQ Total Failures" value={caMcqTimeoutCount + caMcqFailCount} />
        </div>
        {caRetryAttempts > 0 && caRetrySuccess > 0 && (
          <BarSegment label="Retry Success" count={caRetrySuccess} total={caRetryAttempts} color="#10B981" />
        )}
      </div>

      {/* ─── 6. Weekly Beta Report ─── */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BookOpen size={16} color="var(--primary)" />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Weekly Beta Report</div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Usage</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <InsightBox label="Unique Articles Opened" value={funnel.opened} />
          <InsightBox label="Articles Read (>0s)" value={funnel.read} />
          <InsightBox label="Bookmarked" value={funnel.bookmarked} />
          <InsightBox label="MCQs Generated" value={funnel.mcq} />
          <InsightBox label="Total Interactions" value={reading.total} />
          <InsightBox label="Repeat Rate" value={`${repeatRate}%`} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Learning</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <InsightBox label="Most Engaged" value={topCat?.category || '—'} sub={`${topCat?.opens || 0} opens`} />
          <InsightBox label="Least Engaged" value={bottomCat?.category || '—'} sub={`${bottomCat?.opens || 0} opens`} />
          <InsightBox label="Median Read Time" value={`${reading.median}s`} />
          <InsightBox label="Skim Rate (<5s)" value={`${skimRate}%`} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Reliability</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <InsightBox label="RSS Fallbacks" value={caFallbackCount} />
          <InsightBox label="Retry Success" value={infra.retryRate !== null ? `${infra.retryRate}%` : '—'} />
          <InsightBox label="MCQ Timeouts" value={infra.mcqTimeoutRate !== null ? `${infra.mcqTimeoutRate}%` : '—'} />
          <InsightBox label="MCQ Failures" value={infra.mcqFailRate !== null ? `${infra.mcqFailRate}%` : '—'} />
        </div>
      </div>

      {/* ─── 7. Decision Engine ─── */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Info size={16} color="var(--primary)" />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Product Decisions</div>
        </div>
        {decisions.map((d, i) => (
          <div key={i} style={{
            padding: 12, marginBottom: 8, borderRadius: 10,
            background: d.confidence === 'High' ? 'var(--success-light)' : 'var(--surface-alt)',
            border: d.confidence === 'High' ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{d.action}</div>
              <span style={{
                padding: '2px 8px', borderRadius: 99, fontSize: 9, fontWeight: 700,
                background: d.confidence === 'High' ? '#dcfce7' : d.confidence === 'Medium' ? '#fef3c7' : '#f3f4f6',
                color: d.confidence === 'High' ? '#16a34a' : d.confidence === 'Medium' ? '#d97706' : '#6b7280',
              }}>{d.confidence} confidence</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 4 }}>{d.why}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace' }}>{d.metrics}</div>
          </div>
        ))}
      </div>

    </div>
  )
}

function InsightBox({ label, value, sub }) {
  return (
    <div style={{ background: 'var(--surface-alt)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginTop: 1 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2, fontStyle: 'italic' }}>{sub}</div>}
    </div>
  )
}

function BarSegment({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-2)', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{count} ({Math.round(pct)}%)</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface-alt)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function FunnelRow({ label, count, parentCount, pct }) {
  const barPct = parentCount > 0 ? (count / parentCount) * 100 : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span><strong style={{ color: 'var(--text)' }}>{count}</strong>{pct !== undefined ? ` (${pct}%)` : ''}</span>
      </div>
      {parentCount !== undefined && (
        <div style={{ height: 8, background: 'var(--surface-alt)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barPct}%`, background: count === 0 ? 'var(--text-3)' : 'var(--primary)', borderRadius: 99, opacity: 0.6, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}
