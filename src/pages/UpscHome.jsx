import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { useRecommendations } from '../lib/useRecommendations'
import { usePerformanceAlerts } from '../lib/usePerformanceAlerts'
import { generateRevisionContent } from '../lib/revisionAI'
import { upscMCQs } from '../data/upsc/questions'
import { calcPriority as calculatePriorityScore, generateDailyMix as getRevisionMix, getMasteryLevel as getMastery } from '../lib/revisionEngine'
import { Flame, BarChart3, AlertTriangle, X, Loader, Lightbulb, CheckCircle, TrendingDown, TrendingUp, Clock, Search, FileText, SkipForward, Zap, Target } from 'lucide-react'

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
    <div style={{ background: '#f4f6f8', minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* ══ TOP BAR ══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 20px 8px' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.03em', margin: 0 }}>
              UPSC<span style={{ color: '#6366f1' }}>.</span>
            </h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', fontWeight: 500 }}>
              {remainingCount > 0 ? `${remainingCount} topics today` : 'All done!'} · {dayLabels[dayOfWeek]}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="pill-3d" onClick={() => navigate('/pyq-search')} style={{ padding: '6px 10px', cursor: 'pointer', background: '#fff', borderRadius: 9999, border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Search size={14} color="#6366f1" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>PYQs</span>
            </button>
            <button className="pill-3d" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', cursor: 'pointer', background: '#fff', borderRadius: 9999, border: '2px solid #e2e8f0' }}>
              <Flame size={14} color="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{streak}</span>
            </button>
            <button className="pill-3d" onClick={() => navigate('/profile')} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#e0e7ff', borderRadius: 9999, border: '2px solid #e2e8f0', overflow: 'hidden', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>
              {user?.name?.[0] || 'U'}
            </button>
          </div>
        </div>

        {/* ══ ALERTS ══ */}
        {alerts.length > 0 && (
          <div style={{ padding: '12px 20px 0' }}>
            <AnimatePresence>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {alerts.slice(0, 1).map((alert, i) => {
                  const iconMap = { critical: TrendingDown, weak: AlertTriangle, declining: TrendingDown, streak: Flame, inactive: Clock, consistency: BarChart3 }
                  const colorMap = { critical: '#DC2626', weak: '#D97706', declining: '#DC2626', streak: '#B45309', inactive: '#6B7280', consistency: '#2563EB' }
                  const bgMap = { critical: '#FEF2F2', weak: '#FFF7ED', declining: '#FEF2F2', streak: '#FFF7ED', inactive: '#F3F4F6', consistency: '#EFF6FF' }
                  const Icon = iconMap[alert.type] || AlertTriangle
                  return (
                    <div key={i} style={{ padding: '6px 10px', borderRadius: 8, background: bgMap[alert.type], display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#4B5563', lineHeight: 1.4 }}>
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
            <div style={{ position: 'relative', width: '100%', minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {[-1, 0, 1].map((offset) => {
                const idx = feedIdx + offset
                if (idx < 0 || idx >= remainingFeed.length) return null
                const t = remainingFeed[idx]
                const isCenter = offset === 0
                const pi = isCenter ? priorityInfo : calculatePriorityScore(t.id, topicScores, revisionSchedule)
                const reason = pi?.weakness >= 0.6 ? `Weak — ${t.accuracy || 0}% accuracy` : pi?.forgetting >= 0.8 ? 'Over 2 weeks since review' : pi?.forgetting >= 0.5 ? 'Due for review' : pi?.importance >= 0.6 ? 'High-yield topic' : 'Keep fresh'
                return (
                  <motion.div key={t.id}
                    animate={{ x: offset * 180, scale: isCenter ? 1 : 0.88, opacity: isCenter ? 1 : 0.5, zIndex: isCenter ? 10 : 5 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    onClick={() => { if (isCenter) openRevision(t); else setFeedIdx(idx) }}
                    style={{ position: 'absolute', width: 290, cursor: 'pointer', overflow: 'hidden', background: '#fff', borderRadius: 16, boxShadow: isCenter ? '0 8px 32px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.06)' }}
                  >
                    {/* Top accent bar */}
                    <div style={{ height: 4, background: pi?.weakness >= 0.6 ? '#ef4444' : pi?.forgetting >= 0.5 ? '#f59e0b' : '#6366f1' }} />

                    {/* Subject + badge */}
                    <div style={{ padding: '14px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.subjectName}</div>
                        <div style={{ fontSize: isCenter ? 16 : 14, fontWeight: 800, color: '#1e293b', lineHeight: 1.2, marginTop: 2 }}>{t.name}</div>
                      </div>
                      <div style={{ padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', background: pi?.weakness >= 0.6 ? '#fef2f2' : pi?.forgetting >= 0.5 ? '#fff7ed' : '#eef2ff', color: pi?.weakness >= 0.6 ? '#dc2626' : pi?.forgetting >= 0.5 ? '#d97706' : '#6366f1' }}>
                        {pi?.weakness >= 0.6 ? 'Weak' : pi?.forgetting >= 0.5 ? 'Forgotten' : 'Review'}
                      </div>
                    </div>

                    {/* Reason */}
                    <div style={{ padding: '4px 16px 0', fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{reason}</div>

                    {/* Stats row */}
                    <div style={{ padding: '8px 16px 0', display: 'flex', gap: 14 }}>
                      {t.total > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Target size={10} color="#6366f1" /><span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>{t.accuracy}%</span></div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} color="#94a3b8" /><span style={{ fontSize: 10, color: '#94a3b8' }}>{getMastery(t.id, revisionMastery) === 1 ? '3m' : '5m'}</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Zap size={10} color="#94a3b8" /><span style={{ fontSize: 10, color: '#94a3b8' }}>L{getMastery(t.id, revisionMastery)}/4</span></div>
                    </div>

                    {/* Action */}
                    <div style={{ padding: '12px 16px' }}>
                      {isCenter ? (
                        <motion.button whileTap={{ scale: 0.97 }} onClick={(e) => { e.stopPropagation(); openRevision(t) }}
                          style={{ width: '100%', padding: '9px 0', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', borderRadius: 10, letterSpacing: '0.02em' }}
                        >Start Practice</motion.button>
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#cbd5e1' }}>Tap to view</div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Dot indicators + Skip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {remainingFeed.slice(0, 10).map((_, i) => (
                  <div key={i} onClick={() => setFeedIdx(i)} style={{ width: i === feedIdx ? 18 : 5, height: 5, borderRadius: 3, background: i === feedIdx ? '#6366f1' : '#d1d5db', transition: 'all 0.2s', cursor: 'pointer' }} />
                ))}
              </div>
              {feedIdx < remainingFeed.length - 1 && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={skipTopic}
                  style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3 }}
                >Skip <SkipForward size={11} /></motion.button>
              )}
            </div>
          </div>
        )}

        {/* Empty — all done */}
        {dailyMix.length > 0 && remainingCount === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={32} color="#10B981" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>All caught up!</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, lineHeight: 1.5 }}>Check back tomorrow for fresh topics.</div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')}
                style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                Practice More
              </motion.button>
            </div>
          </div>
        )}

        {/* Empty — no mix */}
        {dailyMix.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ textAlign: 'center' }}>
              <FileText size={32} color="#94a3b8" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>No topics yet</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3, lineHeight: 1.5 }}>Practice some questions to get started.</div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')}
                style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
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
            onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            >
              {/* Header */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>{revisionPopupTopic.subjectName}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 1 }}>{revisionPopupTopic.name}</div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
                  style={{ background: '#F3F4F6', border: 'none', borderRadius: 12, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <X size={16} color="#6B7280" />
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
                      <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: acc >= 60 ? '#059669' : '#DC2626' }}>{acc}%</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>Accuracy</div>
                      </div>
                      <div style={{ flex: 1, background: '#F9FAFB', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{ts?.total || 0}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>Questions</div>
                      </div>
                      <div style={{ flex: 1, background: '#EFF6FF', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#2563EB' }}>{ts?.correct || 0}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>Correct</div>
                      </div>
                    </div>
                  )
                })()}

                {/* AI Content */}
                {!practiceQ.length || practiceDone ? (
                  revisionLoading ? (
                    <div style={{ padding: '24px 0', textAlign: 'center' }}>
                      <Loader size={20} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>Generating personalized content...</div>
                    </div>
                  ) : revisionContent ? (
                    <div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Lightbulb size={14} color="#6366f1" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>Key Concepts</span>
                        </div>
                        {revisionContent.keyPoints?.slice(0, 5).map((p, i) => (
                          <div key={i} style={{ padding: '6px 0 6px 20px', position: 'relative', fontSize: 11, color: '#374151', lineHeight: 1.5, borderBottom: '1px solid #F9FAFB' }}>
                            <span style={{ position: 'absolute', left: 0, top: 6, width: 14, height: 14, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#6366f1' }}>{i + 1}</span>
                            <span dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          </div>
                        ))}
                      </div>
                      {revisionContent.commonMistakes?.length > 0 && (
                        <div style={{ marginBottom: 10, background: '#FEF2F2', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <AlertTriangle size={12} color="#DC2626" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>Common Mistakes</span>
                          </div>
                          {revisionContent.commonMistakes.slice(0, 3).map((m, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#7F1D1D', padding: '3px 0', lineHeight: 1.5 }}>• {m}</div>
                          ))}
                        </div>
                      )}
                      {revisionContent.mnemonics?.length > 0 && (
                        <div style={{ background: '#F5F3FF', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <TrendingUp size={12} color="#7C3AED" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED' }}>Memory Aids</span>
                          </div>
                          {revisionContent.mnemonics.map((m, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#4C1D95', padding: '2px 0', fontStyle: 'italic', lineHeight: 1.5 }}>🧠 {m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null
                ) : null}

                {/* Inline Practice */}
                {practiceQ.length > 0 && !practiceDone && (
                  <div style={{ borderTop: revisionContent && !practiceDone ? '1px solid #F3F4F6' : 'none', paddingTop: revisionContent ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Quick Practice</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{practiceIdx + 1}/{practiceQ.length}</div>
                    </div>
                    <div style={{ height: 3, background: '#F3F4F6', borderRadius: 99, marginBottom: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${((practiceIdx + (practiceSubmitted ? 1 : 0)) / practiceQ.length) * 100}%`, height: '100%', background: '#6366f1', borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 8, lineHeight: 1.5 }}>{practiceQ[practiceIdx].q}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                      {practiceQ[practiceIdx].options.map((opt, oi) => {
                        const isAns = practiceQ[practiceIdx].ans === oi
                        const isSel = practiceSelected === oi
                        let bg = '#F9FAFB'
                        let border = '#E5E7EB'
                        let color = '#374151'
                        if (practiceSubmitted) {
                          if (isAns) { bg = '#F0FDF4'; border = '#10B981'; color = '#065F46' }
                          else if (isSel && !isAns) { bg = '#FEF2F2'; border = '#EF4444'; color = '#991B1B' }
                          else { bg = '#F9FAFB'; border = '#E5E7EB'; color = '#9CA3AF' }
                        } else if (isSel) { bg = '#EEF2FF'; border = '#6366f1'; color = '#4338ca' }
                        return (
                          <motion.div key={oi} onClick={() => handlePracticeAnswer(oi)} whileTap={practiceSubmitted ? {} : { scale: 1.01 }}
                            style={{
                              padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${border}`, cursor: practiceSubmitted ? 'default' : 'pointer',
                              background: bg, fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 8, transition: '0.1s',
                            }}>
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${border}`, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700,
                              background: practiceSubmitted && isAns ? '#10B981' : isSel ? '#6366f1' : 'transparent',
                              color: practiceSubmitted && isAns ? '#fff' : isSel ? '#fff' : border,
                              borderColor: practiceSubmitted && isAns ? '#10B981' : isSel ? '#6366f1' : border,
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
                          background: practiceSelected !== null ? '#6366f1' : '#E5E7EB',
                          color: practiceSelected !== null ? '#fff' : '#9CA3AF',
                          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: practiceSelected !== null ? 'pointer' : 'default',
                        }}>
                        Check Answer
                      </motion.button>
                    ) : (
                      <motion.button onClick={nextPractice} whileTap={{ scale: 0.97 }}
                        style={{ width: '100%', padding: '8px 0', borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                        {practiceIdx < practiceQ.length - 1 ? 'Next Question →' : 'See Results'}
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Practice Results */}
                {practiceDone && (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <CheckCircle size={28} color="#10B981" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Practice Complete!</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 10 }}>
                      {practiceAnswers.filter(a => a.correct).length}/{practiceAnswers.length + 1} correct (scores saved)
                    </div>
                    <motion.button onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
                      whileTap={{ scale: 0.97 }}
                      style={{ padding: '8px 20px', borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
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
