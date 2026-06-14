import { motion } from 'framer-motion'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import useStore from '../store/useStore'
import { Brain, TrendingUp, Clock, CheckCircle, BookOpen, MessageSquare, Globe, BarChart3, Flame, Target, Rotate3D } from 'lucide-react'
import { upscSubjects } from '../data/upsc/subjects'
import { supabase } from '../lib/supabase'

export default function UpscAnalytics() {
  const { stats, topicScores, questionHistory, revisionSchedule, user } = useStore()
  const [notesCount, setNotesCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [dailyRows, setDailyRows] = useState([])
  const refreshInterval = useRef(null)

  const userId = useStore(s => s.userId)
  const syncFromSupabase = useStore(s => s.syncFromSupabase)

  const refreshDailyStats = useCallback(() => {
    if (!userId) return
    supabase.from('daily_stats').select('*').eq('user_id', userId).eq('exam_type', 'upsc').order('date', { ascending: true }).then(({ data }) => { if (data) setDailyRows(data) })
  }, [userId])

  useEffect(() => {
    if (!userId) return
    syncFromSupabase(userId)
    supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId).then(({ count }) => { if (count !== null) setNotesCount(count) })
    supabase.from('chat_history').select('id', { count: 'exact', head: true }).eq('user_id', userId).then(({ count }) => { if (count !== null) setChatCount(count) })
    refreshDailyStats()

    const onVisibility = () => { if (document.visibilityState === 'visible') refreshDailyStats() }
    document.addEventListener('visibilitychange', onVisibility)
    refreshInterval.current = setInterval(refreshDailyStats, 30000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (refreshInterval.current) clearInterval(refreshInterval.current)
    }
  }, [userId, refreshDailyStats])

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
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh', paddingBottom: 100, position: 'relative' }}>
      <div className="bg-pattern" style={{ position: 'fixed', inset: 0, opacity: 0.4, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          style={{ padding: '48px 16px 14px', background: 'var(--card-bg)', borderBottom: '2px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Unified Analytics</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500, marginTop: 1 }}>All learning activity in one place</div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={{ visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }} initial="hidden" animate="visible"
          style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* KPI Row */}
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <KpiBox icon={Brain} value={totalQ} label="Questions" color="#6366f1" />
            <KpiBox icon={Target} value={`${accuracy}%`} label="Accuracy" color={accuracy >= 60 ? '#059669' : '#DC2626'} />
            <KpiBox icon={Flame} value={streak} label="Streak" color="#EF4444" />
            <KpiBox icon={Clock} value={`${Math.floor(timeSpent / 60)}h`} label="Study Time" color="#8B5CF6" />
          </motion.div>

          {/* Weekly Summary */}
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>This Week</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{weeklyStats.questions}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>Questions</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{weeklyStats.accuracy}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>Accuracy</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B' }}>{weeklyStats.daysActive}/7</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>Active Days</div>
              </div>
            </div>
          </motion.div>

          {/* Activity Overview */}
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Activity Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <ActivityItem icon={BookOpen} label="Notes Created" value={notesCount} color="#6366f1" />
              <ActivityItem icon={MessageSquare} label="Chat Messages" value={chatCount} color="#8B5CF6" />
              <ActivityItem icon={Rotate3D} label="Due for Revision" value={dueRevisionCount} color="#F59E0B" />
              <ActivityItem icon={BarChart3} label="Topics Attempted" value={`${topicStatus.attempted}/${topicStatus.total}`} color="#10B981" />
            </div>
          </motion.div>

          {/* Subject Accuracy */}
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Subject Accuracy</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500, marginBottom: 10 }}>Percentages shown after {MIN_Q}+ questions per subject</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderRadius: 14, background: 'var(--success-light)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>{topicStatus.mastered}</div>
                <div style={{ fontSize: 9, color: 'var(--success)', fontWeight: 600 }}>Mastered</div>
              </div>
              <div style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderRadius: 14, background: 'var(--warning-light)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>{topicStatus.attempted}</div>
                <div style={{ fontSize: 9, color: 'var(--warning)', fontWeight: 600 }}>Attempted</div>
              </div>
              <div style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderRadius: 14, background: 'var(--error-light)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--error)' }}>{topicStatus.weak}</div>
                <div style={{ fontSize: 9, color: 'var(--error)', fontWeight: 600 }}>Weak</div>
              </div>
              <div style={{ flex: 1, padding: '8px 6px', textAlign: 'center', borderRadius: 14, background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-2)' }}>{topicStatus.total - topicStatus.attempted}</div>
                <div style={{ fontSize: 9, color: 'var(--text-2)', fontWeight: 600 }}>New</div>
              </div>
            </div>

            {subjectAccuracies.map((sub, i) => (
              <div key={sub.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: sub.color }}>{sub.name}</span>
                  <span style={{ fontSize: 10, color: sub.accuracy !== null && sub.total >= MIN_Q ? 'var(--success)' : 'var(--text-3)', fontWeight: 700 }}>
                    {sub.accuracy !== null && sub.total >= MIN_Q ? `${sub.accuracy}%` : sub.total > 0 ? `${sub.total}Q` : '—'}
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-alt)', borderRadius: 99, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(sub.accuracy !== null && sub.total >= MIN_Q) ? sub.accuracy : 0}%` }}
                    transition={{ delay: 0.15 + i * 0.05, duration: 0.6 }}
                    style={{ height: '100%', borderRadius: 99, background: sub.total < MIN_Q ? 'var(--border)' : sub.accuracy >= 70 ? '#10B981' : sub.accuracy >= 40 ? '#F59E0B' : '#EF4444' }}
                  />
                </div>
              </div>
            ))}
          </motion.div>

          {/* Topic Breakdown */}
          {topicBreakdown.length > 0 && (
            <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Second Brain — Topic Scores</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topicBreakdown.sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0)).slice(0, 15).map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: t.accuracy >= 70 ? 'var(--success-light)' : t.accuracy >= 40 ? 'var(--warning-light)' : 'var(--error-light)',
                      fontSize: 10, fontWeight: 700, color: t.accuracy >= 70 ? 'var(--success)' : t.accuracy >= 40 ? 'var(--warning)' : 'var(--error)',
                    }}>
                      {t.accuracy || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{t.subjectName} · {t.total}Q</div>
                    </div>
                    {t.daysSince !== null && (
                      <div style={{ fontSize: 9, color: t.daysSince >= (t.interval || 1) ? 'var(--error)' : 'var(--text-3)', flexShrink: 0 }}>
                        {t.daysSince}d ago
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Recent Activity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentActivity.map((e, i) => (
                  <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-2)' }}>
                    {e.correct ? <CheckCircle size={12} color="var(--success)" /> : <TrendingUp size={12} color="var(--error)" />}
                    <span style={{ flex: 1 }}>{e.topicId}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{new Date(e.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {totalQ === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Brain size={36} color="var(--text-3)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No data yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Start practicing to see your analytics.</div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function KpiBox({ icon: Icon, value, label, color }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      style={{ background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', padding: '14px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
    </motion.div>
  )
}

function ActivityItem({ icon: Icon, label, value, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <Icon size={14} color={color} />
      <div style={{ flex: 1, fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
    </motion.div>
  )
}
