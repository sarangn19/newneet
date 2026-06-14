import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { useDailyStats } from '../lib/useDailyStats'
import { usePerformanceAlerts } from '../lib/usePerformanceAlerts'
import { upscSubjects } from '../data/upsc/subjects'
import { subjects as neetSubjects } from '../data/subjects'

import { Brain, TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle, BarChart3, Activity, Flame, Sparkles, Unlock, Lock, Award } from 'lucide-react'

const PERIODS = ['7 Days', '14 Days', '30 Days', 'All']
const ACC_COLORS = { high: '#10B981', mid: '#F59E0B', low: '#EF4444' }

function getAccColor(pct) {
  if (pct === null || pct === undefined) return '#E5E7EB'
  if (pct >= 70) return ACC_COLORS.high
  if (pct >= 40) return ACC_COLORS.mid
  return ACC_COLORS.low
}

function smoothTrend(data, window = 3) {
  return data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1).filter(v => v !== null)
    return slice.length ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length) : null
  })
}

export default function Statistics() {
  const navigate = useNavigate()
  const { user, stats, completedModules, examType, questionHistory, dailyBreakdown, streakProtection, syncFromSupabase, userId } = useStore()
  const { rows: dailyRows, refetch: refetchDaily } = useDailyStats(30)
  const [period, setPeriod] = useState('7 Days')
  const [syncing, setSyncing] = useState(false)

  // Pull latest data from Supabase on mount
  useEffect(() => {
    if (userId) {
      setSyncing(true)
      syncFromSupabase(userId).then(() => { setSyncing(false); refetchDaily() })
    }
  }, [userId])
  const alerts = usePerformanceAlerts(examType)
  const [insights, setInsights] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [tooltip, setTooltip] = useState(null) // { label, desc }
  const [badgePopup, setBadgePopup] = useState(null)

  const isUpsc = examType === 'upsc'
  const exam = isUpsc ? 'UPSC CSE' : 'NEET'
  const subjects = isUpsc ? upscSubjects : neetSubjects

  // ── Derived KPIs ──────────────────────────────────────────────────
  const totalQ = (isUpsc ? stats.upscTotal : stats.neetTotal) || stats.totalQuestions || 0
  const correct = (isUpsc ? stats.upscCorrect : stats.neetCorrect) || stats.correct || 0
  const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0
  const streak = user?.streak || 0

  // Filter by period
  const cutoffDate = useMemo(() => {
    if (period === 'All') return new Date(0)
    const days = parseInt(period) || 7
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d
  }, [period])

  const periodHistory = useMemo(() => {
    return questionHistory.filter(e => new Date(e.timestamp) >= cutoffDate && e.examType === (examType || 'neet'))
  }, [questionHistory, cutoffDate, examType])

  // ── Accuracy Trend (grouped by day) ──────────────────────────────
  const accuracyTrend = useMemo(() => {
    const daily = {}
    periodHistory.forEach(e => {
      const d = e.timestamp.slice(0, 10)
      if (!daily[d]) daily[d] = { correct: 0, total: 0 }
      daily[d].total++
      if (e.correct) daily[d].correct++
    })
    return Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        acc: Math.round((v.correct / v.total) * 100),
        questions: v.total,
      }))
  }, [periodHistory])

  const trendValues = accuracyTrend.map(d => d.acc)
  const smoothed = smoothTrend(trendValues, 3)
  const trendDirection = trendValues.length >= 2 ? (trendValues[trendValues.length - 1] - trendValues[0]) : 0

  // ── Topic Performance Heatmap ────────────────────────────────────
  const topicPerformance = useMemo(() => {
    const topicMap = {}
    periodHistory.forEach(e => {
      if (!topicMap[e.topicId]) topicMap[e.topicId] = { correct: 0, total: 0, subjectId: e.subjectId }
      topicMap[e.topicId].total++
      if (e.correct) topicMap[e.topicId].correct++
    })

    return Object.entries(topicMap)
      .map(([topicId, v]) => ({
        topicId,
        attempted: v.total,
        correct: v.correct,
        accuracy: Math.round((v.correct / v.total) * 100),
        subjectId: v.subjectId,
        topicName: (() => {
          for (const sub of subjects) {
            const ch = sub.chapters.find(c => c.id === topicId)
            if (ch) return ch.name
          }
          return topicId
        })(),
        subjectName: (() => {
          for (const sub of subjects) {
            if (sub.chapters.some(c => c.id === topicId)) return sub.name
          }
          return ''
        })(),
        subjectColor: (() => {
          for (const sub of subjects) {
            if (sub.chapters.some(c => c.id === topicId)) return sub.color
          }
          return '#6B7280'
        })(),
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
  }, [periodHistory, subjects])

  const weakZones = useMemo(() => {
    return topicPerformance.filter(t => t.attempted >= 3 && t.accuracy < 60)
  }, [topicPerformance])

  // ── Consistency Score ────────────────────────────────────────────
  const consistencyScore = useMemo(() => {
    const daysInPeriod = accuracyTrend.length
    if (daysInPeriod === 0) return 0
    const daysWithGoal = accuracyTrend.filter(d => d.questions >= 20).length
    return Math.round((daysWithGoal / Math.max(daysInPeriod, 7)) * 100)
  }, [accuracyTrend])

  // ── Badges ────────────────────────────────────────────────────────
  const badgeDefs = useMemo(() => {
    const completed = new Set(completedModules)
    return [
      { file: 'Taxonomy Apprentice.svg', name: 'Taxonomy Apprentice', earned: completed.has('b1-m2'), desc: 'Complete the Taxonomy Basics module', howTo: 'Complete the Taxonomy Basics module to unlock' },
      { file: 'Biology Explorer.svg', name: 'Biology Explorer', earned: completed.has('b1-m0'), desc: 'Complete Introduction to Biology module', howTo: 'Complete the Introduction to Biology module to unlock' },
      { file: 'Hierarchy Master.svg', name: 'Hierarchy Master', earned: completed.has('b1-m3'), desc: 'Complete the Taxonomical Hierarchy module', howTo: 'Complete the Taxonomical Hierarchy module to unlock' },
      { file: 'Naming Expert.svg', name: 'Naming Expert', earned: completed.has('b1-m4'), desc: 'Complete the Binomial Nomenclature module', howTo: 'Complete the Binomial Nomenclature module to unlock' },
      { file: 'Digestive Detective.svg', name: 'Digestive Detective', earned: completed.has('b14-m0'), desc: 'Complete The Digestive Kingdom module', howTo: 'Complete The Digestive Kingdom module to unlock' },
      { file: 'Revision Master.svg', name: 'Revision Master', earned: completed.has('b14-m0') && completed.has('b1-m0') && completed.has('b1-m2'), desc: 'Complete all Biology module lessons', howTo: 'Complete all Biology modules to unlock' },
      { file: 'MCQ Sharpshooter.svg', name: 'MCQ Sharpshooter', earned: totalQ >= 200, desc: 'Answer 200 questions in practice', howTo: `${Math.max(0, 200 - totalQ)} more questions to unlock` },
      { file: 'Streak Warrior.svg', name: 'Streak Warrior', earned: (user?.streak || 0) >= 7, desc: 'Maintain a 7-day streak', howTo: `${Math.max(0, 7 - (user?.streak || 0))} more days to reach a 7-day streak` },
      { file: 'Battle Champion.svg', name: 'Battle Champion', earned: (stats.battlesWon || 0) >= 20, desc: 'Win 20 battles', howTo: `Win ${Math.max(0, 20 - (stats.battlesWon || 0))} more battles to unlock` },
      { file: 'Leaderboard Legend.svg', name: 'Leaderboard Legend', earned: (stats.battlesWon || 0) >= 50, desc: 'Win 50 battles', howTo: `Win ${Math.max(0, 50 - (stats.battlesWon || 0))} more battles to unlock` },
    ]
  }, [totalQ, stats, user, completedModules])

  // ── AI Insights ──────────────────────────────────────────────────
  useEffect(() => {
    if (topicPerformance.length < 3 || aiLoading) return
    const fetchInsights = async () => {
      setAiLoading(true)
      try {
        const res = await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examType: examType || 'neet',
            overallAccuracy: accuracy,
            consistencyScore,
            trendDirection,
            totalQuestions: totalQ,
            weakTopics: weakZones.slice(0, 5).map(t => ({ name: t.topicName, accuracy: t.accuracy, attempts: t.attempted })),
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setInsights(data)
        }
      } catch (e) { /* ignore */ }
      setAiLoading(false)
    }
    fetchInsights()
  }, [])

  // ── Chart dimensions ────────────────────────────────────────────
  const trendMax = Math.max(...trendValues, 100)
  const trendMin = Math.min(...trendValues, 0)
  const trendRange = trendMax - trendMin || 1

  const cardBg = 'var(--card-bg)'
  const cardBorder = 'var(--border)'

  return (
    <div style={{
      background: 'var(--page-bg)',
      minHeight: '100vh', paddingBottom: 100, color: 'var(--text)',
      fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, sans-serif',
      overflowX: 'hidden',
    }}>
      {/* Title on purple background — no container */}
        <div style={{ padding: '44px 20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>Statistics</div>
        </div>

      {/* Timeframe Filter Tabs */}
      <div style={{
        margin: '0 12px',
        background: cardBg,
        borderRadius: 16,
        border: `1px solid ${cardBorder}`,
        display: 'flex', padding: 4,
      }}>
        {PERIODS.map(p => {
          const isActive = period === p
          return (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 12, cursor: 'pointer',
                fontSize: 11, fontWeight: 800, fontFamily: 'inherit',
                textTransform: 'uppercase', letterSpacing: '0.03em',
                transition: 'all 0.15s', border: 'none',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-3)',
              }}>
              {p.toUpperCase()}
            </button>
          )
        })}
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Badges */}
        {!isUpsc && (
        <div>
          <div className="section-label" style={{ marginBottom: 10, marginLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Award size={14} color="#F59E0B" />
            Badges
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x mandatory' }}>
            {badgeDefs.map(b => {
              const earned = b.earned
              return (
                <img key={b.file} src={`/badges/${encodeURIComponent(b.file)}`} alt={b.name}
                  onClick={() => setBadgePopup({ ...b, earned })}
                  style={{
                    width: 84, height: 84, objectFit: 'contain', flexShrink: 0,
                    cursor: 'pointer',
                    filter: earned ? 'none' : 'grayscale(1) brightness(0.7)',
                    opacity: earned ? 1 : 0.4,
                    transition: 'all 0.2s',
                  }} />
              )
            })}
          </div>
        </div>
        )}

        {/* Badge popup */}
        <AnimatePresence>
          {badgePopup && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              onClick={() => setBadgePopup(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.15 }} onClick={e => e.stopPropagation()}
                style={{
                  background: 'var(--card-bg)', borderRadius: 24, padding: 24, margin: '0 20px',
                  border: '1px solid var(--border)', maxWidth: 300, width: '100%', textAlign: 'center',
                }}>
                <img src={`/badges/${encodeURIComponent(badgePopup.file)}`} alt=""
                  style={{
                    width: 120, height: 120, objectFit: 'contain', margin: '0 auto 12px',
                    filter: badgePopup.earned ? 'none' : 'grayscale(1) brightness(0.7)',
                    opacity: badgePopup.earned ? 1 : 0.5,
                  }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{badgePopup.name}</div>
                {badgePopup.earned ? (
                  <div style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#34D399',
                    background: 'rgba(52,211,153,0.1)', padding: '3px 12px', borderRadius: 99, marginBottom: 8,
                  }}>Earned</div>
                ) : (
                  <div style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                    background: 'var(--surface-alt)', padding: '3px 12px', borderRadius: 99, marginBottom: 8,
                  }}>Locked</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.5 }}>
                  {badgePopup.desc}
                </div>
                {!badgePopup.earned && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#F59E0B', lineHeight: 1.4 }}>
                    {badgePopup.howTo}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Grid — 2 metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { icon: Activity, value: `${accuracy}%`, label: 'Accuracy', sub: `${correct}/${totalQ}`, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#34D399' },
            { icon: Flame, value: streak, label: 'Day Streak', sub: 'days', iconBg: 'rgba(251,191,36,0.1)', iconColor: '#FBBF24', clickable: true },
          ].map((kpi, i) => {
            const Icon = kpi.icon
            const isStreak = kpi.clickable
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => isStreak && setTooltip({
                  label: '🔥 Streak Protection',
                  desc: `🛡️ Streak Shield ×${streakProtection.shields || 0}\nAuto-protects your streak when you miss a day.\n\n❄️ Weekend Freeze ${streakProtection.weekendFreeze ? '✅ ON' : 'OFF'}\nWeekends won't break your streak.\n\n↩️ Recovery Day ${streakProtection.recoveryDay ? '✅ ON' : 'OFF'}\nMissed yesterday? Study today to recover.\n\nMissing one day shouldn't destroy motivation.` })}
                style={{
                  background: cardBg,
                  borderRadius: 20, padding: '14px 10px',
                  border: `1px solid ${cardBorder}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2,
                  cursor: isStreak ? 'pointer' : 'default',
                }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: kpi.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={kpi.iconColor} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>{kpi.value}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{kpi.label}</div>
                <div style={{ fontSize: 8, color: 'var(--text-3)' }}>{kpi.sub}</div>
                {isStreak && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {streakProtection.shields > 0 && <span style={{ fontSize: 8, background: 'rgba(251,191,36,0.1)', color: '#FBBF24', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>🛡️×{streakProtection.shields}</span>}
                    {streakProtection.weekendFreeze && <span style={{ fontSize: 8, background: 'rgba(147,197,253,0.1)', color: '#93C5FD', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>❄️</span>}
                    {streakProtection.recoveryDay && <span style={{ fontSize: 8, background: 'rgba(52,211,153,0.1)', color: '#34D399', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>↩️</span>}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Tooltip Overlay */}
        <AnimatePresence>
          {tooltip && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              onClick={() => setTooltip(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.15 }} onClick={e => e.stopPropagation()}
                style={{
                  background: 'var(--card-bg)', borderRadius: 20, padding: '18px 16px', margin: '0 20px',
                  border: '1px solid var(--border)', maxWidth: 320, width: '100%',
                }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{tooltip.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{tooltip.desc}</div>
                <div style={{ marginTop: 10, textAlign: 'right' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Tap outside to close</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Accuracy Trend */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: cardBg, borderRadius: 20, padding: 20, border: `1px solid ${cardBorder}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} color="#34D399" />
              Accuracy Trend
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#34D399',
              background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {trendDirection >= 0 ? '+' : ''}{Math.round(trendDirection)}%
            </span>
          </div>
          {accuracyTrend.length < 2 ? (
            <div style={{ height: 112, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 16 }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>Answer more questions to reveal your live accuracy trend</p>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 9, color: 'var(--text-3)' }}>
                <span>Highest: -%</span>
                <span>Average: -%</span>
                <span>Lowest: -%</span>
              </div>
            </div>
          ) : (
            <div style={{ height: 120 }}>
              <svg width="100%" height="96" viewBox="0 0 300 96" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="24" x2="300" y2="24" stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
                <line x1="0" y1="48" x2="300" y2="48" stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
                <line x1="0" y1="72" x2="300" y2="72" stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
                <path
                  d={(() => {
                    const pts = smoothed.filter(v => v !== null)
                    if (pts.length < 2) return ''
                    const steps = pts.map((v, i) => {
                      const x = (i / (pts.length - 1)) * 280 + 10
                      const y = 76 - ((v - trendMin) / trendRange) * 64
                      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
                    }).join(' ')
                    return steps
                  })()}
                  fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
                <path
                  d={(() => {
                    const pts = smoothed.filter(v => v !== null)
                    if (pts.length < 2) return ''
                    const steps = pts.map((v, i) => {
                      const x = (i / (pts.length - 1)) * 280 + 10
                      const y = 76 - ((v - trendMin) / trendRange) * 64
                      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
                    }).join(' ')
                    return steps + ` L ${(pts.length - 1) / (pts.length - 1) * 280 + 10} 86 L 10 86 Z`
                  })()}
                  fill="url(#trendFill)" />
                <circle cx={(() => {
                  const pts = smoothed.filter(v => v !== null)
                  if (!pts.length) return 0
                  return (pts.length - 1) / Math.max(pts.length - 1, 1) * 280 + 10
                })()} cy={(() => {
                  const pts = smoothed.filter(v => v !== null)
                  if (!pts.length) return 0
                  const last = pts[pts.length - 1]
                  return 76 - ((last - trendMin) / trendRange) * 64
                })()} r="5" fill="#34D399" stroke="#fff" strokeWidth="1.5" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 4 }}>
                <span>Highest: <b style={{ color: 'var(--text)' }}>{trendValues.length ? Math.max(...trendValues) : '-'}%</b></span>
                <span>Average: <b style={{ color: 'var(--text)' }}>{trendValues.length ? Math.round(trendValues.reduce((a, b) => a + b, 0) / trendValues.length) : '-'}%</b></span>
                <span>Lowest: <b style={{ color: 'var(--text)' }}>{trendValues.length ? Math.min(...trendValues) : '-'}%</b></span>
              </div>
            </div>
          )}
        </motion.div>



        {/* Weak Zones */}
        {weakZones.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            style={{ background: cardBg, borderRadius: 24, padding: 20, border: `1px solid ${cardBorder}` }}>
            <div className="section-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} color="#EF4444" />
              Weak Zones
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weakZones.slice(0, 8).map((t, i) => (
                <motion.div key={t.topicId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  style={{
                    padding: '10px 12px', borderRadius: 14,
                    background: t.accuracy < 30 ? 'rgba(239,68,68,0.06)' : 'rgba(251,191,36,0.06)',
                    border: `1px solid ${t.accuracy < 30 ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)'}`,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.subjectColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{t.topicName}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{t.subjectName} · {t.attempted} attempts</div>
                    </div>
                    <div style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800,
                      background: t.accuracy < 30 ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)',
                      color: t.accuracy < 30 ? '#EF4444' : '#F59E0B',
                    }}>
                      {t.accuracy}%
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-alt)', borderRadius: 99, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${t.accuracy}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      style={{
                        height: '100%', borderRadius: 99,
                        background: t.accuracy < 30 ? '#EF4444' : '#F59E0B',
                      }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            style={{ background: cardBg, borderRadius: 24, padding: 20, border: `1px solid ${cardBorder}` }}>
            <div className="section-label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart3 size={14} color="#3B82F6" />
              Alerts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.slice(0, 4).map((alert, i) => {
                const iconMap = { critical: TrendingDown, weak: AlertTriangle, declining: TrendingDown, streak: Flame, inactive: Clock, consistency: BarChart3 }
                const colorMap = { critical: '#DC2626', weak: '#D97706', declining: '#DC2626', streak: '#F59E0B', inactive: '#6B7280', consistency: '#3B82F6' }
                const palettes = {
                  critical: { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)', text: '#DC2626' },
                  weak: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)', text: '#D97706' },
                  declining: { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)', text: '#DC2626' },
                  streak: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#F59E0B' },
                  inactive: { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)', text: '#6B7280' },
                  consistency: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: '#3B82F6' },
                }
                const p = palettes[alert.type] || palettes.inactive
                const Icon = iconMap[alert.type] || AlertTriangle
                return (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 12,
                    background: p.bg,
                    border: `1px solid ${p.border}`,
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 8,
                      background: p.border,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon size={13} color={p.text} />
                    </div>
                    <div style={{ fontSize: 11, color: p.text, lineHeight: 1.5, fontWeight: 500 }}>{alert.message}</div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* AI Insights */}
        {isUpsc && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }}
          style={{
            borderRadius: 24, padding: 20, border: `1px solid ${cardBorder}`,
            background: periodHistory.length >= 10
              ? 'linear-gradient(135deg, rgba(30,27,75,0.95), rgba(15,23,42,0.95))'
              : cardBg,
            borderColor: periodHistory.length >= 10 ? 'rgba(99,102,241,0.3)' : cardBorder,
            position: 'relative', overflow: 'hidden',
          }}>
          {periodHistory.length >= 10 && (
            <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: 'rgba(255,255,255,0.03)', borderRadius: '50%', filter: 'blur(40px)' }} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: 6, borderRadius: 10,
                background: periodHistory.length >= 10 ? 'rgba(99,102,241,0.2)' : 'var(--surface-alt)',
                color: periodHistory.length >= 10 ? '#818CF8' : 'var(--text-3)',
              }}>
                <Brain size={14} />
              </span>
              <div className="section-label">AI Insights</div>
            </div>
            {periodHistory.length >= 10 ? (
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', color: '#34D399', background: 'rgba(52,211,153,0.1)', padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Unlock size={8} /> Unlocked
              </span>
            ) : (
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-3)', background: 'var(--surface-alt)', padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={8} /> Locked
              </span>
            )}
          </div>
          {aiLoading ? (
            <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', padding: '10px 0' }}>
              Analyzing your performance...
            </div>
          ) : insights && periodHistory.length >= 10 ? (
            <div>
              <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {insights.analysis}
              </p>
              {insights.recommendations && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Recommended Focus</div>
                  {insights.recommendations.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        color: '#fff', fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{r}</div>
                    </div>
                  ))}
                </div>
              )}
              {insights.predictedRank && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(52,211,153,0.1)', borderRadius: 10, fontSize: 11, color: '#34D399' }}>
                  {insights.predictedRank}
                </div>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {periodHistory.length < 10
                ? `Answer ${10 - periodHistory.length} more questions to unlock AI-powered insights`
                : 'AI analysis will appear here after sufficient data'}
            </p>
          )}
          </motion.div>
        )}




      </div>
    </div>
  )
}