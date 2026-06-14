import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { useRecommendations } from '../lib/useRecommendations'
import { usePerformanceAlerts } from '../lib/usePerformanceAlerts'
import { generateRevisionContent } from '../lib/revisionAI'
import { upscMCQs } from '../data/upsc/questions'
import { upscSubjects } from '../data/upsc/subjects'
import { calcPriority as calculatePriorityScore, generateDailyMix as getRevisionMix, getMasteryLevel as getMastery } from '../lib/revisionEngine'
import { Flame, BarChart3, AlertTriangle, X, Loader, Lightbulb, CheckCircle, TrendingDown, TrendingUp, Clock, Search, FileText, Zap, Target } from 'lucide-react'

export default function UpscHome() {
  const navigate = useNavigate()
  const { user, topicScores, saveTopicScore, recordQuestionAttempt, startSession, endSession, updateStats, revisionSchedule, revisionSeenQuestions, markTopicReviewed, revisionMastery, setRevisionMastery, recordSeenQuestion } = useStore()
  const { allTopics } = useRecommendations('upsc')
  const todayStr = new Date().toISOString().slice(0, 10)
  const [dailyMix] = useState(() => getRevisionMix(allTopics, topicScores, revisionSchedule, 5))
  const [feedIdx, setFeedIdx] = useState(0)
  const [feedDone, setFeedDone] = useState(() => new Set(
    Object.entries(revisionSchedule)
      .filter(([_, v]) => v.lastReviewed === todayStr)
      .map(([k]) => k)
  ))

  const remainingFeed = useMemo(() => dailyMix.filter(t => !feedDone.has(t.id)), [dailyMix, feedDone])
  const currentTopic = remainingFeed[feedIdx]
  const remainingCount = remainingFeed.length - feedIdx

  const priorityInfo = useMemo(() => {
    if (!currentTopic) return {}
    return calculatePriorityScore(currentTopic.id, topicScores, revisionSchedule)
  }, [currentTopic, topicScores, revisionSchedule])

  // Day of week format
  const dayOfWeek = new Date().getDay()
  const dayLabels = { 0: 'Weekly Review', 1: 'Flashcards', 2: 'MCQ Revision', 3: 'Mind Maps', 4: 'Summary', 5: 'AI Q&A', 6: 'Mixed Test' }
  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const skipTopic = () => { if (feedIdx < remainingFeed.length - 1) setFeedIdx(i => i + 1) }
  const touchStartX = useRef(0)
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (diff > 50 && feedIdx < remainingFeed.length - 1) setFeedIdx(i => i + 1)
    else if (diff < -50 && feedIdx > 0) setFeedIdx(i => i - 1)
  }

  const alerts = usePerformanceAlerts('upsc')
  const [revisionPopupTopic, setRevisionPopupTopic] = useState(null)
  const [revisionContent, setRevisionContent] = useState(null)
  const [revisionLoading, setRevisionLoading] = useState(false)
  const [practiceQ, setPracticeQ] = useState([])
  const [practiceIdx, setPracticeIdx] = useState(0)
  const [practiceAnswers, setPracticeAnswers] = useState([])
  const [practiceSelected, setPracticeSelected] = useState(null)
  const [practiceSubmitted, setPracticeSubmitted] = useState(false)
  const [practiceDone, setPracticeDone] = useState(false)

  const streak = user?.streak || 0
  const [questionStartTime, setQuestionStartTime] = useState(null)

  const getTailoredQuestions = (topicId, count) => {
    const topicQ = upscMCQs.filter(q => q.chapter === topicId)
    const topicSeen = revisionSeenQuestions[topicId] || {}
    const withStatus = topicQ.map(q => {
      const key = q.q.slice(0, 40)
      const s = topicSeen[key]
      return { ...q, _key: key, _seen: s?.seen || 0, _wrong: (s?.seen || 0) - (s?.correct || 0) }
    })
    const unseen = withStatus.filter(q => q._seen === 0)
    const wrong = withStatus.filter(q => q._wrong > 0)
    const done = withStatus.filter(q => q._seen > 0 && q._wrong === 0)
    const shuffle = a => a.sort(() => Math.random() - 0.5)
    const pick = (pool, n) => shuffle(pool).slice(0, n)
    const result = [...pick(unseen, count)]
    if (result.length < count) result.push(...pick(wrong, count - result.length))
    if (result.length < count) result.push(...pick(done, count - result.length))
    return result.slice(0, count)
  }
  const recordSeenQuestionLocal = (topicId, questionText, isCorrect) => {
    recordSeenQuestion(topicId, questionText.slice(0, 40), isCorrect)
  }

  const openRevision = async (topic) => {
    setRevisionPopupTopic(topic)
    setRevisionLoading(true)
    setRevisionContent(null)
    setPracticeQ([])
    setPracticeIdx(0)
    setPracticeAnswers([])
    setPracticeSelected(null)
    setPracticeSubmitted(false)
    setPracticeDone(false)
    setQuestionStartTime(Date.now())
    startSession()
    const ts = topicScores[topic.id]
    const accuracy = ts?.total > 0 ? Math.round((ts.correct / ts.total) * 100) : 0
    const result = await generateRevisionContent({ ...topic, accuracy, total: ts?.total || 0 })
    setRevisionContent(result)
    setRevisionLoading(false)
    const level = getMastery(topic.id, revisionMastery)
    const count = level === 1 ? 3 : level === 2 ? 5 : level === 3 ? 5 : 1
    const questions = getTailoredQuestions(topic.id, count)
    setPracticeQ(questions)
  }

  const handlePracticeAnswer = (idx) => {
    if (practiceSubmitted) return
    setPracticeSelected(idx)
  }

  const submitPractice = () => {
    if (practiceSelected === null) return
    setPracticeSubmitted(true)
    const correct = practiceSelected === practiceQ[practiceIdx].ans
    const timeSpent = questionStartTime ? Math.round((Date.now() - questionStartTime) / 1000) : 0
    const newAnswers = [...practiceAnswers, { correct, selected: practiceSelected }]
    setPracticeAnswers(newAnswers)
    if (revisionPopupTopic) {
      recordQuestionAttempt(revisionPopupTopic.id, correct, timeSpent, revisionPopupTopic.subjectId || '')
      recordSeenQuestionLocal(revisionPopupTopic.id, practiceQ[practiceIdx].q, correct)
    }
  }

  const nextPractice = () => {
    if (practiceIdx < practiceQ.length - 1) {
      setPracticeIdx(p => p + 1)
      setPracticeSelected(null)
      setPracticeSubmitted(false)
      setQuestionStartTime(Date.now())
    } else {
      const correct = practiceAnswers.filter(a => a.correct).length + (practiceSelected === practiceQ[practiceIdx].ans ? 1 : 0)
      const total = practiceAnswers.length + 1
      if (revisionPopupTopic) {
        saveTopicScore(revisionPopupTopic.id, correct, total)
        updateStats(correct, total, revisionPopupTopic.subjectId || '')
        const pct = Math.round((correct / total) * 100)
        const newLevel = Math.min((getMastery(revisionPopupTopic.id, revisionMastery) || 1) + (pct >= 70 ? 1 : 0), 4)
        setRevisionMastery(revisionPopupTopic.id, newLevel)
        markTopicReviewed(revisionPopupTopic.id)
        setFeedDone(prev => new Set([...prev, revisionPopupTopic.id]))
      }
      endSession()
      setPracticeDone(true)
    }
  }

  const dueCount = useMemo(() => {
    return allTopics.filter(t => {
      const s = topicScores[t.id]
      if (!s || !s.total) return false
      const acc = (s.correct / s.total) * 100
      let interval = 1
      if (acc >= 80) interval = 7
      else if (acc >= 60) interval = 4
      else if (acc >= 40) interval = 2
      const review = revisionSchedule[t.id]
      if (!review?.lastReviewed) return true
      return Math.floor((new Date() - new Date(review.lastReviewed)) / (8.64e7)) >= interval
    }).length
  }, [allTopics, topicScores, revisionSchedule])

  const totalQs = useMemo(() => {
    return Object.values(topicScores).reduce((sum, s) => sum + (s.total || 0), 0)
  }, [topicScores])

  const overallAccuracy = useMemo(() => {
    let c = 0, t = 0
    Object.values(topicScores).forEach(s => { c += s.correct || 0; t += s.total || 0 })
    return t > 0 ? Math.round(c / t * 100) : 0
  }, [topicScores])

  const topWeakTopic = useMemo(() => {
    return allTopics
      .map(t => ({ ...t, acc: topicScores[t.id] ? (topicScores[t.id].correct / topicScores[t.id].total) * 100 : 0 }))
      .sort((a, b) => a.acc - b.acc)[0]
  }, [allTopics, topicScores])

  const progressInsight = useMemo(() => {
    if (totalQs === 0) return 'Start practicing to get personalized insights'
    if (topWeakTopic) return `${topWeakTopic.name} needs attention — ${Math.round(topWeakTopic.acc)}% accuracy`
    if (overallAccuracy >= 70) return `Strong momentum — ${overallAccuracy}% overall accuracy`
    return `${dueCount} topics due for revision — keep the momentum going`
  }, [totalQs, topWeakTopic, overallAccuracy, dueCount])

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 20px' }}>
        {/* ══ GREETING ══ */}
        <div style={{ padding: '56px 0 4px' }}>
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500 }}>{greeting()},</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0 }}>
                {user?.name?.split(' ')[0] || 'Student'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/pyq-search')} style={{ background: 'var(--surface-alt)', border: 'none', borderRadius: 99, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={15} color="var(--text-2)" />
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/profile')} style={{
                  width: 34, height: 34, borderRadius: 99, border: 'none', cursor: 'pointer',
                  background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {user?.name?.[0] || 'U'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ══ TODAY'S FOCUS ══ */}
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's Focus</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Due for Revision', value: dueCount, color: 'var(--primary)' },
              { label: 'Questions Solved', value: totalQs, color: '#34C759' },
              { label: 'Accuracy', value: `${overallAccuracy}%`, color: '#AF52DE' },
            ].map((item, i) => (
              <motion.div key={item.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.3, ease: 'easeOut' }}
                style={{ background: 'var(--card-bg)', borderRadius: 14, padding: '10px 8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', fontWeight: 500, marginTop: 2 }}>{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ══ CONTINUE LEARNING ══ */}
        {currentTopic && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Continue Learning</p>
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35, ease: 'easeOut' }}
              whileHover={{ y: -2 }}
              onClick={() => openRevision(currentTopic)}
              style={{
                background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', padding: 20,
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{currentTopic.subjectName}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 4, lineHeight: 1.3 }}>{currentTopic.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.4 }}>
                    {priorityInfo?.weakness >= 0.6 ? `Weak area — ${currentTopic.accuracy || 0}% accuracy` : 'Due for revision'}
                  </div>
                </div>
                <motion.div whileTap={{ scale: 0.95 }} style={{
                  background: 'var(--primary)', borderRadius: 99, width: 40, height: 40,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </motion.div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Level {getMastery(currentTopic.id, revisionMastery)}/4
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Est. {getMastery(currentTopic.id, revisionMastery) === 1 ? '3m' : '5m'}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* ══ REVISION RADAR ══ */}
        {remainingFeed.length > 1 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revision Radar</p>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{remainingFeed.length} topics</span>
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
              {remainingFeed.slice(0, 8).map((t, i) => {
                const pi = calculatePriorityScore(t.id, topicScores, revisionSchedule)
                const urgency = pi?.weakness >= 0.6 ? '#FF3B30' : pi?.forgetting >= 0.5 ? '#D4A853' : 'var(--text-3)'
                return (
                  <motion.div key={t.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.03, duration: 0.2, ease: 'easeOut' }}
                    whileHover={{ y: -2 }}
                    onClick={() => openRevision(t)}
                    style={{
                      minWidth: 140, background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--border)',
                      padding: 12, cursor: 'pointer', flexShrink: 0,
                      borderLeft: `3px solid ${urgency}`,
                    }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: urgency, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.subjectName}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 3, lineHeight: 1.3 }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                      {t.total ? `${t.accuracy}% accuracy` : 'New topic'}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ CURRENT AFFAIRS SNAPSHOT ══ */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Affairs</p>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/current-affairs')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--primary)', fontWeight: 600, fontFamily: 'inherit' }}>
              View all
            </motion.button>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.3, ease: 'easeOut' }}
            onClick={() => navigate('/current-affairs')}
            style={{
              background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)',
              padding: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Today's UPSC Stories</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>3 new articles · Economy, Polity, Environment</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </motion.div>
        </div>

        {/* ══ PROGRESS INSIGHT ══ */}
        <div style={{ marginTop: 20, marginBottom: 90 }}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.3 }}
            style={{
              background: 'var(--primary-light)', borderRadius: 14, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
            </div>
            <p style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500, lineHeight: 1.4, margin: 0 }}>
              {progressInsight}
            </p>
          </motion.div>
        </div>

        {/* ══ EMPTY STATE ══ */}
        {dailyMix.length === 0 && totalQs === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>No topics yet</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Practice some questions to get started.</div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate('/learn')}
              style={{ marginTop: 14, padding: '10px 24px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              Get Started
            </motion.button>
          </div>
        )}
      </div>

      {/* ══ REVISION POPUP ══ */}
      <AnimatePresence>
        {revisionPopupTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32, mass: 1 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 440, maxHeight: '92vh', background: 'var(--card-bg)', borderRadius: '20px 20px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}
            >
              {/* Header */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>{revisionPopupTopic.subjectName}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 1 }}>{revisionPopupTopic.name}</div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
                  style={{ background: 'var(--surface-alt)', border: 'none', borderRadius: 12, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <X size={16} color="var(--text-3)" />
                </motion.button>
              </div>

              {/* Body */}
              <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
                {/* Performance card */}
                {(() => {
                  const ts = topicScores[revisionPopupTopic.id]
                  const acc = ts?.total > 0 ? Math.round((ts.correct / ts.total) * 100) : 0
                  return (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <div style={{ flex: 1, background: 'var(--success-light)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: acc >= 60 ? '#059669' : '#DC2626' }}>{acc}%</div>
                        <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Accuracy</div>
                      </div>
                      <div style={{ flex: 1, background: 'var(--surface-alt)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{ts?.total || 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Questions</div>
                      </div>
                      <div style={{ flex: 1, background: 'var(--primary-light)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{ts?.correct || 0}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Correct</div>
                      </div>
                    </div>
                  )
                })()}

                {/* AI Content */}
                {!practiceQ.length || practiceDone ? (
                  revisionLoading ? (
                    <div style={{ padding: '24px 0', textAlign: 'center' }}>
                      <Loader size={20} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Generating personalized content...</div>
                    </div>
                  ) : revisionContent ? (
                    <div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Lightbulb size={14} color="var(--primary)" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>Key Concepts</span>
                        </div>
                        {revisionContent.keyPoints?.slice(0, 5).map((p, i) => (
                          <div key={i} style={{ padding: '6px 0 6px 20px', position: 'relative', fontSize: 11, color: 'var(--text)', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
                            <span style={{ position: 'absolute', left: 0, top: 6, width: 14, height: 14, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'var(--primary)' }}>{i + 1}</span>
                            <span dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          </div>
                        ))}
                      </div>
                      {revisionContent.commonMistakes?.length > 0 && (
                        <div style={{ marginBottom: 10, background: 'var(--error-light)', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <AlertTriangle size={12} color="#DC2626" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--error)' }}>Common Mistakes</span>
                          </div>
                          {revisionContent.commonMistakes.slice(0, 3).map((m, i) => (
                            <div key={i} style={{ fontSize: 11, color: 'var(--error)', padding: '3px 0', lineHeight: 1.5 }}>• {m}</div>
                          ))}
                        </div>
                      )}
                      {revisionContent.mnemonics?.length > 0 && (
                        <div style={{ background: 'var(--primary-light)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <TrendingUp size={12} color="var(--primary)" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Memory Aids</span>
                          </div>
                          {revisionContent.mnemonics.map((m, i) => (
                            <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', padding: '2px 0', fontStyle: 'italic', lineHeight: 1.5 }}>🧠 {m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null
                ) : null}

                {/* Inline Practice */}
                {practiceQ.length > 0 && !practiceDone && (
                  <div style={{ borderTop: revisionContent && !practiceDone ? '1px solid var(--border)' : 'none', paddingTop: revisionContent ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Quick Practice</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{practiceIdx + 1}/{practiceQ.length}</div>
                    </div>
                    <div style={{ height: 3, background: 'var(--surface-alt)', borderRadius: 99, marginBottom: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${((practiceIdx + (practiceSubmitted ? 1 : 0)) / practiceQ.length) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8, lineHeight: 1.5 }}>{practiceQ[practiceIdx].q}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                      {practiceQ[practiceIdx].options.map((opt, oi) => {
                        const isAns = practiceQ[practiceIdx].ans === oi
                        const isSel = practiceSelected === oi
                        let bg = 'var(--surface-alt)'
                        let border = 'var(--border)'
                        let color = 'var(--text)'
                        if (practiceSubmitted) {
                          if (isAns) { bg = 'var(--success-light)'; border = '#10B981'; color = 'var(--success-dark)' }
                          else if (isSel && !isAns) { bg = 'var(--error-light)'; border = '#EF4444'; color = 'var(--error-dark)' }
                          else { bg = 'var(--surface-alt)'; border = 'var(--border)'; color = 'var(--text-3)' }
                        } else if (isSel) { bg = 'var(--primary-light)'; border = 'var(--primary)'; color = 'var(--primary)' }
                        return (
                          <motion.div key={oi} onClick={() => handlePracticeAnswer(oi)} whileTap={practiceSubmitted ? {} : { scale: 1.01 }}
                            style={{
                              padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${border}`, cursor: practiceSubmitted ? 'default' : 'pointer',
                              background: bg, fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 8, transition: '0.1s',
                            }}>
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${border}`, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700,
                              background: practiceSubmitted && isAns ? 'var(--success)' : isSel ? 'var(--primary)' : 'transparent',
                              color: practiceSubmitted && isAns ? '#fff' : isSel ? '#fff' : border,
                              borderColor: practiceSubmitted && isAns ? 'var(--success)' : isSel ? 'var(--primary)' : border,
                            }}>
                              {practiceSubmitted && isAns ? '✓' : isSel && !isAns ? '✗' : String.fromCharCode(65 + oi)}
                            </div>
                            {opt}
                          </motion.div>
                        )
                      })}
                    </div>
                    {!practiceSubmitted ? (
                          <motion.button onClick={submitPractice} whileTap={{ scale: 0.97 }}
                            style={{
                              width: '100%', padding: '8px 0', borderRadius: 12, border: 'none',
                              background: practiceSelected !== null ? 'var(--primary)' : 'var(--border)',
                              color: practiceSelected !== null ? '#fff' : 'var(--text-3)',
                              fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: practiceSelected !== null ? 'pointer' : 'default',
                            }}>
                        Check Answer
                      </motion.button>
                    ) : (
                      <motion.button onClick={nextPractice} whileTap={{ scale: 0.97 }}
                        style={{ width: '100%', padding: '8px 0', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                        {practiceIdx < practiceQ.length - 1 ? 'Next Question →' : 'See Results'}
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Practice Results */}
                {practiceDone && (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <CheckCircle size={28} color="#10B981" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Practice Complete!</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, marginBottom: 10 }}>
                      {practiceAnswers.filter(a => a.correct).length}/{practiceAnswers.length + 1} correct (scores saved)
                    </div>
                    <motion.button onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
                      whileTap={{ scale: 0.97 }}
                      style={{ padding: '8px 20px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                      Done
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
