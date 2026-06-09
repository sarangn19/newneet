import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { ChevronLeft, Shield, Users, Database, Settings, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function SuperAdminDashboard() {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState(null)
  const [stats, setStats] = useState({ totalUsers: 0, admins: 0, superadmins: 0, suspended: 0 })

  useEffect(() => {
    if (userRole !== 'superadmin') return
    fetchData()
  }, [userRole])

  const fetchData = async () => {
    if (!supabase) return
    setLoading(true)

    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (usersData) {
      setUsers(usersData)
      setStats({
        totalUsers: usersData.length,
        admins: usersData.filter(u => u.role === 'admin').length,
        superadmins: usersData.filter(u => u.role === 'superadmin').length,
        suspended: usersData.filter(u => u.status === 'suspended').length,
      })
    }
    setLoading(false)
  }

  const updateUserRole = async (userId, newRole) => {
    if (!supabase) return
    await supabase.from('users').update({ role: newRole }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    setEditingUser(null)
  }

  const updateUserStatus = async (userId, newStatus) => {
    if (!supabase) return
    await supabase.from('users').update({ status: newStatus }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u))
  }

  const deleteUser = async (userId, email) => {
    if (!window.confirm(`Delete user ${email}? This cannot be undone.`)) return
    if (!supabase) return
    await supabase.from('users').delete().eq('id', userId)
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  if (userRole !== 'superadmin') {
    return (
      <div className="screen-white" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <AlertCircle size={48} color="#ef4444" />
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 12 }}>Access Denied</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Only superadmins can access this page.</div>
        </div>
      </div>
    )
  }

  const statCards = [
    { emoji: '', value: stats.totalUsers, label: 'Total Users', color: '#8b5cf6' },
    { emoji: '', value: stats.admins, label: 'Admins', color: 'var(--primary)' },
    { emoji: '', value: stats.superadmins, label: 'Super Admins', color: '#f59e0b' },
    { emoji: '', value: stats.suspended, label: 'Suspended', color: '#ef4444' },
  ]

  return (
    <div className="screen-white admin-container">
      {/* Header */}
      <div className="page-header" style={{ borderRadius: '0 0 24px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button className="back-btn" onClick={() => navigate('/')}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'white' }}>Super Admin</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Full platform control</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {statCards.map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: '14px 8px' }}>
              <div style={{ fontSize: 24 }}>{s.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 22, marginTop: 4, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'users', label: 'Users', icon: Users },
            { key: 'roles', label: 'Roles', icon: Shield },
            { key: 'database', label: 'Database', icon: Database },
            { key: 'settings', label: 'Settings', icon: Settings },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                border: tab === key ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                background: tab === key ? '#FFF3E0' : 'var(--white)',
                color: tab === key ? 'var(--accent)' : 'var(--text-3)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>Loading...</div>
        )}

        {/* Users tab — full user management */}
        {!loading && tab === 'users' && (
          <div className="card" style={{ padding: '4px 0' }}>
            {users.map((u, i) => (
              <div key={u.id} style={{
                padding: '12px 16px',
                borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>{u.avatar || ''}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.email}</div>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, marginLeft: 46 }}>
                  <MiniBtn
                    label={u.status === 'active' ? 'Suspend' : 'Activate'}
                    color={u.status === 'active' ? '#ef4444' : 'var(--success)'}
                    onClick={() => updateUserStatus(u.id, u.status === 'active' ? 'suspended' : 'active')}
                  />
                  <MiniBtn
                    label="Change Role"
                    color="var(--primary)"
                    onClick={() => setEditingUser(editingUser === u.id ? null : u.id)}
                  />
                  <MiniBtn
                    label="Delete"
                    color="#ef4444"
                    onClick={() => deleteUser(u.id, u.email)}
                  />
                </div>
                {/* Role selector */}
                {editingUser === u.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, marginLeft: 46 }}>
                    {['user', 'admin', 'superadmin'].map(role => (
                      <button
                        key={role}
                        onClick={() => updateUserRole(u.id, role)}
                        style={{
                          padding: '6px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          border: u.role === role ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                          background: u.role === role ? '#FFF3E0' : 'var(--white)',
                          color: u.role === role ? 'var(--accent)' : 'var(--text-2)',
                        }}
                      >
                        {role === 'superadmin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'User'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Roles tab */}
        {!loading && tab === 'roles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { role: 'superadmin', icon: '', title: 'Super Admin', desc: 'Full platform control. Manage all users, roles, and settings.', color: '#f59e0b', bg: '#fef3c7' },
              { role: 'admin', icon: '', title: 'Admin', desc: 'View all users, manage content, and monitor activity.', color: '#3b82f6', bg: '#dbeafe' },
              { role: 'user', icon: '', title: 'User', desc: 'Standard student account. Can learn, practice, and battle.', color: '#6b7280', bg: '#f3f4f6' },
            ].map(r => (
              <div key={r.role} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: r.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                }}>{r.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: r.color }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{r.desc}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {users.filter(u => u.role === r.role).length} user(s)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Database tab */}
        {!loading && tab === 'database' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'users', count: users.length, icon: '' },
              { name: 'leaderboard', count: '—', icon: '' },
              { name: 'battle_history', count: '—', icon: '' },
              { name: 'battle_matches', count: '—', icon: '' },
              { name: 'lesson_progress', count: '—', icon: '' },
              { name: 'matchmaking_queue', count: '—', icon: '' },
              { name: 'system_logs', count: '—', icon: '' },
              { name: 'badges', count: '—', icon: '' },
            ].map(t => (
              <div key={t.name} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{t.count} rows</span>
              </div>
            ))}
          </div>
        )}

        {/* Settings tab */}
        {!loading && tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Enable Email Confirmation', desc: 'Require email verification for new signups' },
              { label: 'Enable RLS', desc: 'Row Level Security on all tables' },
              { label: 'SMTP Configuration', desc: 'Configure email provider for auth emails' },
              { label: 'OAuth Providers', desc: 'Google, GitHub, Discord login' },
              { label: 'Database Backups', desc: 'Manage automatic backups' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.desc}</div>
              </div>
            ))}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <a
                href="https://app.supabase.com/project/ievtwzygmpluzrltzdmr"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block', padding: '12px 24px', borderRadius: 10,
                  background: '#1e1e1e', color: 'white', fontSize: 13, fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Open Supabase Dashboard →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RoleBadge({ role }) {
  const config = {
    superadmin: { bg: '#fef3c7', color: '#d97706', label: 'superadmin' },
    admin: { bg: '#dbeafe', color: '#2563eb', label: 'admin' },
    user: { bg: '#f3f4f6', color: '#6b7280', label: 'user' },
  }
  const c = config[role] || config.user
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
      background: c.bg, color: c.color,
    }}>{c.label}</span>
  )
}

function MiniBtn({ label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
        border: `1.5px solid ${color}`, background: 'transparent', color,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}
