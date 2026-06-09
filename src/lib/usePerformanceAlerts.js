import { useMemo } from 'react'
import useStore from '../store/useStore'

const toDateStr = (d = new Date()) => d.toISOString().slice(0, 10)

export function usePerformanceAlerts(examType = 'upsc') {
  const topicScores = useStore(s => s.topicScores)
  const questionHistory = useStore(s => s.questionHistory)
  const streak = useStore(s => s.user?.streak || 0)
  const stats = useStore(s => s.stats)

  return useMemo(() => {
    const alerts = []

    const et = examType || 'upsc'
    const relevantHistory = questionHistory.filter(e => e.examType === et)

    // ── 1. Critical + Weak topic alerts ──────────────────────────
    const validTopicIds = new Set(relevantHistory.map(e => e.topicId))
    const entries = Object.entries(topicScores)
    entries.forEach(([topicId, score]) => {
      if (!validTopicIds.has(topicId)) return
      if (score.total < 3) return
      const acc = Math.round((score.correct / score.total) * 100)
      if (acc < 40) {
        alerts.push({
          type: 'critical',
          topicId,
          message: `Critical: ${topicId} — ${acc}% accuracy (${score.correct}/${score.total})`,
          priority: 0,
        })
      } else if (acc < 60) {
        alerts.push({
          type: 'weak',
          topicId,
          message: `Needs revision: ${topicId} — ${acc}% accuracy`,
          priority: 1,
        })
      }
    })

    // ── 2. Declining accuracy trend ──────────────────────────────
    const now = new Date()
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const recent7 = relevantHistory.filter(e => new Date(e.timestamp) >= sevenDaysAgo)
    const prev7 = relevantHistory.filter(e => {
      const d = new Date(e.timestamp)
      return d >= fourteenDaysAgo && d < sevenDaysAgo
    })

    const calcAcc = (arr) => {
      if (arr.length < 5) return null
      const c = arr.filter(e => e.correct).length
      return Math.round((c / arr.length) * 100)
    }

    const recentAcc = calcAcc(recent7)
    const prevAcc = calcAcc(prev7)

    if (recentAcc !== null && prevAcc !== null && (prevAcc - recentAcc) > 10) {
      alerts.push({
        type: 'declining',
        message: `Accuracy dropped ${prevAcc - recentAcc}% — was ${prevAcc}%, now ${recentAcc}% in last 7 days`,
        priority: 2,
      })
    }

    // ── 3. Streak at risk ────────────────────────────────────────
    const today = toDateStr()
    const answeredToday = relevantHistory.some(e => e.timestamp.slice(0, 10) === today)
    if (streak > 0 && !answeredToday) {
      alerts.push({
        type: 'streak',
        message: `Streak at risk! Answer 1 question today to maintain ${streak}-day streak.`,
        priority: 3,
      })
    }

    // ── 4. Inactive ──────────────────────────────────────────────
    const lastAnswer = relevantHistory.length > 0
      ? relevantHistory.reduce((latest, e) => new Date(e.timestamp) > new Date(latest.timestamp) ? e : latest)
      : null
    if (lastAnswer) {
      const daysSince = Math.floor((Date.now() - new Date(lastAnswer.timestamp)) / 86400000)
      if (daysSince >= 3) {
        alerts.push({
          type: 'inactive',
          message: `No study session in ${daysSince} days. Consistency is key for ${et.toUpperCase()} preparation.`,
          priority: 4,
        })
      }
    }

    // ── 5. Low consistency ──────────────────────────────────────
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i)
      const ds = toDateStr(d)
      const dayQ = relevantHistory.filter(e => e.timestamp.slice(0, 10) === ds).length
      last7Days.push(dayQ)
    }
    const daysWithGoal = last7Days.filter(q => q >= 20).length
    const consistencyPct = Math.round((daysWithGoal / 7) * 100)
    if (consistencyPct < 40 && relevantHistory.length >= 10) {
      alerts.push({
        type: 'consistency',
        message: `Low consistency: only ${daysWithGoal}/7 days hit 20+ questions (${consistencyPct}%)`,
        priority: 5,
      })
    }

    // Sort by priority
    alerts.sort((a, b) => a.priority - b.priority)

    return alerts
  }, [topicScores, questionHistory, streak, stats, examType])
}
