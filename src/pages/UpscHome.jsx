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

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* ══ TOP BAR ══ */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 20px 8px' }}>
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.05 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0 }}>
              UPSC<span style={{ color: 'var(--primary)' }}>.</span>
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0', fontWeight: 500 }}>
              {greeting()}, {user?.name?.split(' ')[0] || 'Student'} · {dayLabels[dayOfWeek]}
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.button whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }} className="pill-3d" onClick={() => navigate('/pyq-search')} style={{ padding: '6px 10px', cursor: 'pointer', background: 'var(--surface-alt)', borderRadius: 9999, border: '2px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Search size={14} color="var(--primary)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>PYQs</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }} className="pill-3d" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', cursor: 'pointer', background: 'var(--surface-alt)', borderRadius: 9999, border: '2px solid var(--border)' }}>
              <Flame size={14} color="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{streak}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }} className="pill-3d" onClick={() => navigate('/profile')} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--primary-light)', borderRadius: 9999, border: '2px solid var(--border)', overflow: 'hidden', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
              {user?.name?.[0] || 'U'}
            </motion.button>
          </motion.div>
        </motion.div>

        {/* ══ ALERTS ══ */}
        {alerts.length > 0 && (
          <div style={{ padding: '12px 20px 0' }}>
            <AnimatePresence>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {alerts.slice(0, 1).map((alert, i) => {
                  const iconMap = { critical: TrendingDown, weak: AlertTriangle, declining: TrendingDown, streak: Flame, inactive: Clock, consistency: BarChart3 }
                  const colorMap = { critical: '#DC2626', weak: '#D97706', declining: '#DC2626', streak: '#B45309', inactive: 'var(--text-3)', consistency: '#2563EB' }
                  const bgMap = { critical: 'var(--error-light)', weak: 'var(--warning-light)', declining: 'var(--error-light)', streak: 'var(--warning-light)', inactive: 'var(--surface-alt)', consistency: 'var(--primary-light)' }
                  const Icon = iconMap[alert.type] || AlertTriangle
                  return (
                    <div key={i} style={{ padding: '6px 10px', borderRadius: 8, background: bgMap[alert.type], display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>
                      <Icon size={13} color={colorMap[alert.type]} style={{ flexShrink: 0 }} />
                      {alert.message}
                    </div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* ══ TODAY'S REVISION CAROUSEL ══ */}
        {remainingFeed.length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 0', touchAction: 'none', userSelect: 'none' }}
            onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          >
            <div style={{ position: 'relative', width: '100%', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {[-1, 0, 1].map((offset) => {
                const idx = feedIdx + offset
                if (idx < 0 || idx >= remainingFeed.length) return null
                const t = remainingFeed[idx]
                const isCenter = offset === 0
                const pi = isCenter ? priorityInfo : calculatePriorityScore(t.id, topicScores, revisionSchedule)
                const reason = pi?.weakness >= 0.6 ? `Weak — ${t.accuracy || 0}% accuracy` : pi?.forgetting >= 0.8 ? 'Over 2 weeks since review' : pi?.forgetting >= 0.5 ? 'Due for review' : pi?.importance >= 0.6 ? 'High-yield topic' : 'Keep fresh'
                const accentColor = pi?.weakness >= 0.6 ? '#ef4444' : pi?.forgetting >= 0.5 ? '#f59e0b' : 'var(--primary)'
                const badgeLabel = pi?.weakness >= 0.6 ? 'Weak' : pi?.forgetting >= 0.5 ? 'Forgotten' : 'Review'
                const badgeBg = pi?.weakness >= 0.6 ? 'var(--error-light)' : pi?.forgetting >= 0.5 ? 'var(--warning-light)' : 'var(--primary-light)'
                const badgeColor = pi?.weakness >= 0.6 ? '#dc2626' : pi?.forgetting >= 0.5 ? '#d97706' : 'var(--primary)'
                const level = getMastery(t.id, revisionMastery)
                const subj = upscSubjects.find(s => s.id === t.subjectId)
                const subjGradient = subj?.gradient || 'linear-gradient(135deg, var(--primary-dark), var(--primary))'
                return (
                  <motion.div key={t.id}
                    animate={{ x: offset * 200, scale: isCenter ? 1 : 0.85, opacity: isCenter ? 1 : 0.4, zIndex: isCenter ? 10 : 5 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    onClick={() => { if (isCenter) openRevision(t); else setFeedIdx(idx) }}
                    style={{ position: 'absolute', width: 340, cursor: 'pointer', perspective: 1200 }}
                    onMouseMove={(e) => {
                      if (!isCenter) return
                      const el = e.currentTarget.firstChild
                      const rect = el.getBoundingClientRect()
                      const rotateX = ((e.clientY - rect.top - rect.height / 2) / rect.height / 2) * -12
                      const rotateY = ((e.clientX - rect.left - rect.width / 2) / rect.width / 2) * 12
                      el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`
                    }}
                    onTouchMove={(e) => {
                      if (!isCenter) return
                      const touch = e.touches[0]
                      const el = e.currentTarget.firstChild
                      const rect = el.getBoundingClientRect()
                      const rotateX = ((touch.clientY - rect.top - rect.height / 2) / rect.height / 2) * -12
                      const rotateY = ((touch.clientX - rect.left - rect.width / 2) / rect.width / 2) * 12
                      el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.firstChild.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.firstChild.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
                    }}
                  >
                    <motion.div animate={{
                      boxShadow: isCenter
                        ? ['0 30px 60px -15px rgba(0,0,0,0.5)', '0 35px 70px -10px rgba(99,102,241,0.15)', '0 30px 60px -15px rgba(0,0,0,0.5)']
                        : '0 8px 20px -8px rgba(0,0,0,0.3)',
                    }} transition={isCenter ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
                    style={{
                      background: 'var(--card-bg)',
                      border: isCenter ? '1px solid rgba(99,102,241,0.15)' : '1px solid var(--border)',
                      backdropFilter: 'blur(40px)',
                      borderRadius: 32,
                      overflow: 'hidden',
                      transformStyle: 'preserve-3d',
                      transition: 'transform 0.5s cubic-bezier(0.1, 0.8, 0.2, 1)',
                    }}>
                      {/* Image area — no padding */}
                      <div style={{
                        height: 150, width: '100%', background: subjGradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute', inset: 0,
                          backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.1) 0%, transparent 60%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.06) 0%, transparent 50%)',
                        }} />
                        <div style={{
                          fontSize: 48, fontWeight: 900, color: 'rgba(255,255,255,0.12)',
                          letterSpacing: '-0.06em', userSelect: 'none',
                          textTransform: 'uppercase',
                        }}>{t.subjectName}</div>
                      </div>

                      <div style={{ padding: 20 }}>
                        {/* Subject + badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.subjectName}</div>
                          <div style={{ padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: badgeBg, color: badgeColor }}>{badgeLabel}</div>
                        </div>

                        {/* Topic name */}
                        <div style={{ fontSize: isCenter ? 18 : 16, fontWeight: 900, color: 'var(--text)', lineHeight: 1.2, marginTop: 5, letterSpacing: '-0.02em' }}>{t.name}</div>

                        {/* Meta line */}
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5, fontWeight: 500 }}>
                          GS I · L{level}/4 · {reason}
                        </div>

                        {/* Stats row */}
                        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                          {t.total > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Target size={11} color="var(--primary)" />
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{t.accuracy}%</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} color="var(--text-3)" />
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{level === 1 ? '3m' : '5m'}</span>
                          </div>
                        </div>

                        {/* Action */}
                        <div style={{ marginTop: 16 }}>
                          {isCenter ? (
                            <motion.button whileTap={{ scale: 0.97 }} onClick={(e) => { e.stopPropagation(); openRevision(t) }}
                              style={{
                                width: '100%', padding: '13px 0', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                                cursor: 'pointer', border: 'none', background: 'var(--primary)', color: '#fff',
                                borderRadius: 12, letterSpacing: '0.01em',
                              }}
                            >Start Practice</motion.button>
                          ) : (
                            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.02em' }}>Tap to view →</div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )
              })}
            </div>

            {/* Dot indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10 }}>
              {remainingFeed.slice(0, 10).map((_, i) => (
                <div key={i} onClick={() => setFeedIdx(i)} style={{
                  width: i === feedIdx ? 22 : 6, height: 6, borderRadius: 3,
                  background: i === feedIdx ? 'var(--primary)' : 'var(--text-3)',
                  transition: 'all 0.3s', cursor: 'pointer', opacity: i === feedIdx ? 1 : 0.5,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Empty — all done */}
        {dailyMix.length > 0 && remainingCount === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={32} color="#10B981" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>All caught up!</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.5 }}>Check back tomorrow for fresh topics.</div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')}
                style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                Practice More
              </motion.button>
            </div>
          </div>
        )}

        {/* Empty — no mix */}
        {dailyMix.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ textAlign: 'center' }}>
              <FileText size={32} color="var(--text-3)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>No topics yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.5 }}>Practice some questions to get started.</div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')}
                style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                Get Started
              </motion.button>
            </div>
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
