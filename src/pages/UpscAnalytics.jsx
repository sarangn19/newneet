import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Brain, TrendingUp, Clock, CheckCircle, BookOpen, MessageSquare, Globe, BarChart3, Flame, Target, Rotate3D } from 'lucide-react'
import useStore from '../store/useStore'
import { upscSubjects } from '../data/upsc/subjects'
import { supabase } from '../lib/supabase'

export default function UpscAnalytics() {
  const navigate = useNavigate()
  const { stats, topicScores, questionHistory, revisionSchedule, user } = useStore()
  const [notesCount, setNotesCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [dailyRows, setDailyRows] = useState([])

  const userId = useStore(s => s.userId)
  const syncFromSupabase = useStore(s => s.syncFromSupabase)

  useEffect(() => {
    if (!userId) return
    syncFromSupabase(userId)
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).then(({ count }) => { if (count !== null) setNotesCount(count) })
    supabase.from('chat_history').select('id', { count: 'exact', head: true }).eq('user_id', userId).then(({ count }) => { if (count !== null) setChatCount(count) })
    supabase.from('daily_stats').select('*').eq('user_id', userId).eq('exam_type', 'upsc').order('date', { ascending: true }).then(({ data }) => { if (data) setDailyRows(data) })
  }, [userId])

  const totalQ = stats.upscTotal || 0
  const correct = stats.upscCorrect || 0
  const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0
  const streak = user?.streak || 0
  const timeSpent = stats.timeSpent || 0

  const subjectAccuracies = useMemo(() => {
    return upscSubjects.map(sub => {
      const chapterIds = sub.chapters.map(c => c.id)
      let subCorrect = 0, subTotal = 0
      chapterIds.forEach(chId => {
        const score = topicScores[chId]
        if (score) { subCorrect += score.correct || 0; subTotal += score.total || 0 }
      })
      return { id: sub.id, name: sub.name, color: sub.color, correct: subCorrect, total: subTotal, accuracy: subTotal > 0 ? Math.round((subCorrect / subTotal) * 100) : null }
    })
  }, [topicScores])

  const topicBreakdown = useMemo(() => {
    return upscSubjects.flatMap(sub =>
      sub.chapters.map(ch => {
        const score = topicScores[ch.id]
        const correct = score?.correct || 0
        const total = score?.total || 0
        const acc = total > 0 ? Math.round((correct / total) * 100) : null
        const review = revisionSchedule[ch.id]
        const daysSince = review?.lastReviewed ? Math.floor((new Date() - new Date(review.lastReviewed)) / (1000 * 60 * 60 * 24)) : null
        return { id: ch.id, name: ch.name, subjectId: sub.id, subjectName: sub.name, correct, total, accuracy: acc, lastReviewed: review?.lastReviewed, daysSince, interval: review?.interval }
      })
    ).filter(t => t.total > 0)
  }, [topicScores, revisionSchedule])

  const recentActivity = useMemo(() => {
    return [...questionHistory].reverse().slice(0, 10)
  }, [questionHistory])

  const weeklyStats = useMemo(() => {
    const last7 = dailyRows.slice(-7)
    const q = last7.reduce((s, r) => s + (r.questions || 0), 0)
    const c = last7.reduce((s, r) => s + (r.correct || 0), 0)
    return { questions: q, accuracy: q > 0 ? Math.round((c / q) * 100) : 0, daysActive: last7.filter(r => (r.questions || 0) > 0).length }
  }, [dailyRows])

  const MIN_Q = 20

  const topicStatus = useMemo(() => {
    const allChapters = upscSubjects.flatMap(s => s.chapters)
    const attempted = allChapters.filter(ch => (topicScores[ch.id]?.total || 0) >= MIN_Q).length
    const mastered = allChapters.filter(ch => { const s = topicScores[ch.id]; return (s?.total || 0) >= MIN_Q && ((s.correct / s.total) * 100) >= 70 }).length
    const weak = allChapters.filter(ch => { const s = topicScores[ch.id]; return (s?.total || 0) >= MIN_Q && ((s.correct / s.total) * 100) < 40 }).length
    return { total: allChapters.length, attempted, mastered, weak }
  }, [topicScores])

  const dueRevisionCount = useMemo(() => {
    return Object.keys(topicScores).filter(topicId => {
      const score = topicScores[topicId]
      if (!score || !score.total) return false
      const acc = (score.correct / score.total) * 100
      let interval = 1
      if (acc >= 80) interval = 7
      else if (acc >= 60) interval = 4
      else if (acc >= 40) interval = 2
      const review = revisionSchedule[topicId]
      if (!review?.lastReviewed) return true
      return Math.floor((new Date() - new Date(review.lastReviewed)) / (1000 * 60 * 60 * 24)) >= interval
    }).length
  }, [topicScores, revisionSchedule])

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100vh', paddingBottom: 100, position: 'relative' }}>
      <div className="bg-pattern" style={{ position: 'fixed', inset: 0, opacity: 0.4, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: '48px 16px 14px', background: '#fff', borderBottom: '2px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="pill-3d" onClick={() => navigate('/')} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff', border: '2px solid #e2e8f0', borderRadius: 9999, padding: 0 }}>
              <ChevronLeft size={18} color="#475569" />
            </button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Unified Analytics</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 1 }}>All learning activity in one place</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <KpiBox icon={Brain} value={totalQ} label="Questions" color="#6366f1" />
            <KpiBox icon={Target} value={`${accuracy}%`} label="Accuracy" color={accuracy >= 60 ? '#059669' : '#DC2626'} />
            <KpiBox icon={Flame} value={streak} label="Streak" color="#EF4444" />
            <KpiBox icon={Clock} value={`${Math.floor(timeSpent / 60)}h`} label="Study Time" color="#8B5CF6" />
          </div>

          {/* Weekly Summary */}
          <div className="card-3d" style={{ padding: 16, borderBottomWidth: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>This Week</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1' }}>{weeklyStats.questions}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Questions</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{weeklyStats.accuracy}%</div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Accuracy</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B' }}>{weeklyStats.daysActive}/7</div>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Active Days</div>
              </div>
            </div>
          </div>

          {/* Activity Overview */}
          <div className="card-3d" style={{ padding: 16, borderBottomWidth: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Activity Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <ActivityItem icon={BookOpen} label="Notes Created" value={notesCount} color="#6366f1" />
              <ActivityItem icon={MessageSquare} label="Chat Messages" value={chatCount} color="#8B5CF6" />
              <ActivityItem icon={Rotate3D} label="Due for Revision" value={dueRevisionCount} color="#F59E0B" />
              <ActivityItem icon={BarChart3} label="Topics Attempted" value={`${topicStatus.attempted}/${topicStatus.total}`} color="#10B981" />
            </div>
          </div>

          {/* Subject Accuracy */}
          <div className="card-3d" style={{ padding: 16, borderBottomWidth: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Subject Accuracy</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginBottom: 10 }}>Percentages shown after {MIN_Q}+ questions per subject</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div className="card-3d" style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderBottomWidth: 3, background: '#f0fdf4' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{topicStatus.mastered}</div>
                <div style={{ fontSize: 9, color: '#059669', fontWeight: 600 }}>Mastered</div>
              </div>
              <div className="card-3d" style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderBottomWidth: 3, background: '#fffbeb' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>{topicStatus.attempted}</div>
                <div style={{ fontSize: 9, color: '#D97706', fontWeight: 600 }}>Attempted</div>
              </div>
              <div className="card-3d" style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderBottomWidth: 3, background: '#fef2f2' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#DC2626' }}>{topicStatus.weak}</div>
                <div style={{ fontSize: 9, color: '#DC2626', fontWeight: 600 }}>Weak</div>
              </div>
              <div className="card-3d" style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderBottomWidth: 3 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#64748b' }}>{topicStatus.total - topicStatus.attempted}</div>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>New</div>
              </div>
            </div>

            {subjectAccuracies.map((sub, i) => (
              <div key={sub.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: sub.color }}>{sub.name}</span>
                  <span style={{ fontSize: 10, color: sub.accuracy !== null && sub.total >= MIN_Q ? '#059669' : '#94a3b8', fontWeight: 700 }}>
                    {sub.accuracy !== null && sub.total >= MIN_Q ? `${sub.accuracy}%` : sub.total > 0 ? `${sub.total}Q` : '—'}
                  </span>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(sub.accuracy !== null && sub.total >= MIN_Q) ? sub.accuracy : 0}%` }}
                    transition={{ delay: 0.15 + i * 0.05, duration: 0.6 }}
                    style={{ height: '100%', borderRadius: 99, background: sub.total < MIN_Q ? '#e2e8f0' : sub.accuracy >= 70 ? '#10B981' : sub.accuracy >= 40 ? '#F59E0B' : '#EF4444' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Topic Breakdown */}
          {topicBreakdown.length > 0 && (
            <div className="card-3d" style={{ padding: 16, borderBottomWidth: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Second Brain — Topic Scores</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topicBreakdown.sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0)).slice(0, 15).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: t.accuracy >= 70 ? '#D1FAE5' : t.accuracy >= 40 ? '#FEF3C7' : '#FEE2E2',
                      fontSize: 10, fontWeight: 700, color: t.accuracy >= 70 ? '#059669' : t.accuracy >= 40 ? '#D97706' : '#DC2626',
                    }}>
                      {t.accuracy || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>{t.subjectName} · {t.total}Q</div>
                    </div>
                    {t.daysSince !== null && (
                      <div style={{ fontSize: 9, color: t.daysSince >= (t.interval || 1) ? '#DC2626' : '#94a3b8', flexShrink: 0 }}>
                        {t.daysSince}d ago
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="card-3d" style={{ padding: 16, borderBottomWidth: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>Recent Activity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentActivity.map((e, i) => (
                  <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#475569' }}>
                    {e.correct ? <CheckCircle size={12} color="#10B981" /> : <TrendingUp size={12} color="#DC2626" />}
                    <span style={{ flex: 1 }}>{e.topicId}</span>
                    <span style={{ fontSize: 9, color: '#94a3b8' }}>{new Date(e.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalQ === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Brain size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>No data yet</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Start practicing to see your analytics.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiBox({ icon: Icon, value, label, color }) {
  return (
    <div className="card-3d" style={{ padding: '12px 6px', textAlign: 'center', borderBottomWidth: 3 }}>
      <Icon size={16} color={color} style={{ marginBottom: 4 }} />
      <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ActivityItem({ icon: Icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
      <Icon size={14} color={color} />
      <div style={{ flex: 1, fontSize: 11, color: '#475569', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{value}</div>
    </div>
  )
}
