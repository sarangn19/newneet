import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { useRecommendations } from '../lib/useRecommendations'
import { generateRevisionContent } from '../lib/revisionAI'
import { upscSubjects } from '../data/upsc/subjects'
import { upscMCQs } from '../data/upsc/questions'
import { calcPriority as calculatePriorityScore, generateDailyMix as getRevisionMix, getMasteryLevel as getMastery } from '../lib/revisionEngine'
import { generateAIRQuestion } from '../lib/generateQuestionAI'
import { Flame, AlertTriangle, X, Loader, Lightbulb, CheckCircle, TrendingUp, Search, FileText } from 'lucide-react'
import { useSequentialReveal, easePreset, skeletonBreath } from '../hooks/useSequentialReveal'
import { SkeletonBlock } from '../components/SkeletonBlock'

export default function UpscHome() {
  const navigate = useNavigate()
  const { user, topicScores, saveTopicScore, recordQuestionAttempt, startSession, endSession, updateStats, revisionSchedule, revisionSeenQuestions, markTopicReviewed, revisionMastery, setRevisionMastery, recordSeenQuestion } = useStore()
  const { allTopics } = useRecommendations('upsc')
  const todayStr = new Date().toISOString().slice(0, 10)
  const [pageReady, setPageReady] = useState(false)
  const [dailyMix, setDailyMix] = useState([])
  const [feedDone, setFeedDone] = useState(() => new Set(
    Object.entries(revisionSchedule)
      .filter(([_, v]) => v.lastReviewed === todayStr)
      .map(([k]) => k)
  ))

  useEffect(() => {
    const mix = getRevisionMix(allTopics, topicScores, revisionSchedule, 5)
    setDailyMix(mix)
    const t = setTimeout(() => setPageReady(true), 100)
    return () => clearTimeout(t)
  }, [allTopics, topicScores, revisionSchedule])

  const remainingFeed = useMemo(() => dailyMix.filter(t => !feedDone.has(t.id)), [dailyMix, feedDone])
  const remainingCount = remainingFeed.length

  // Today's Question — AI-generated, based on performance
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [questionLoading, setQuestionLoading] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [qrSelected, setQrSelected] = useState(null)
  const [qrSubmitted, setQrSubmitted] = useState(false)
  const [qrCorrect, setQrCorrect] = useState(false)
  const usedTopicIds = useRef(new Set())
  const qrStartTime = useRef(null)
  const recentTopics = useRef([])
  const qrHistory = useRef({})

  const pickNextTopic = () => {
    const scored = allTopics
      .map(t => ({ ...t, ...calculatePriorityScore(t.id, topicScores, revisionSchedule) }))
    let candidates = scored.filter(t => !usedTopicIds.current.has(t.id))
    if (candidates.length === 0) candidates = scored

    const recent = recentTopics.current
    candidates = candidates.map(t => ({
      ...t,
      adjustedScore: recent.includes(t.id) ? t.score * 0.3 : t.score,
    }))

    const totalScore = candidates.reduce((s, t) => s + t.adjustedScore, 0)
    if (totalScore <= 0) return candidates[0]
    let r = Math.random() * totalScore
    for (const t of candidates) {
      r -= t.adjustedScore
      if (r <= 0) return t
    }
    return candidates[candidates.length - 1]
  }

  const loadQuestion = async () => {
    const topic = pickNextTopic()
    if (!topic) { setSessionDone(true); return }
    usedTopicIds.current.add(topic.id)
    recentTopics.current = [...recentTopics.current.slice(-3), topic.id]
    setQuestionLoading(true)
    setQrSelected(null)
    setQrSubmitted(false)
    setQrCorrect(false)
    qrStartTime.current = Date.now()
    const q = await generateAIRQuestion(topic, topicScores, qrHistory.current)
    setCurrentQuestion(q)
    setQuestionLoading(false)
  }

  const beginSession = () => {
    usedTopicIds.current = new Set()
    setSessionCount(0)
    setSessionDone(false)
    setCurrentQuestion(null)
  }

  const initialized = useRef(false)

  useEffect(() => {
    if (allTopics.length > 0 && !initialized.current) {
      initialized.current = true
      beginSession()
      loadQuestion()
    }
  }, [allTopics.length])

  const advanceQuestion = () => {
    const next = sessionCount + 1
    if (next < 5) {
      setSessionCount(next)
      loadQuestion()
    } else {
      setSessionDone(true)
      setCurrentQuestion(null)
    }
  }
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
    <div style={{ background: 'var(--page-bg)', minHeight: '100%', paddingBottom: 100, overflowX: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {!pageReady ? (
          <>
            <div style={{ padding: '48px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <SkeletonBlock width={100} height={20} />
                <SkeletonBlock width={160} height={12} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <SkeletonBlock width={34} height={34} radius={99} />
                <SkeletonBlock width={34} height={34} radius={99} />
                <SkeletonBlock width={34} height={34} radius={99} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: 12 }}>
              <SkeletonBlock width={340} height={150} radius={32} />
              <SkeletonBlock width={340} height={160} radius={32} />
              <div style={{ display: 'flex', gap: 5 }}>
                {[1,2,3,4].map(i => <SkeletonBlock key={i} width={i === 1 ? 22 : 6} height={6} radius={3} />)}
              </div>
            </div>
          </>
        ) : (
          <>{/* G��G�� TOP BAR G��G�� */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 20px 8px' }}>

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

        {/* Quick Revision — AI-generated performance-based */}
        <AnimatePresence>
          {(currentQuestion || sessionDone || questionLoading) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{ padding: '12px 20px 0' }}
            >
              <div style={{
                background: 'var(--card-bg)', borderRadius: 16,
                padding: 16, border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                {questionLoading && !currentQuestion ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', padding: '16px 0' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Generating question for you...</div>
                  </div>
                ) : currentQuestion ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--primary)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {currentQuestion.subjectName || currentQuestion.topicName || 'Revision'}
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={advanceQuestion}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 11, color: 'var(--text-3)', fontFamily: 'inherit',
                          fontWeight: 500, padding: '2px 6px',
                        }}
                      >
                        Skip →
                      </motion.button>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.5 }}>
                      {currentQuestion.q}
                    </div>

                    {!qrSubmitted ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {currentQuestion.options.map((opt, oi) => {
                            const isSel = qrSelected === oi
                            return (
                              <motion.div
                                key={oi}
                                onClick={() => setQrSelected(oi)}
                                whileTap={{ scale: 0.98 }}
                                style={{
                                  padding: '10px 12px', borderRadius: 10,
                                  border: `1.5px solid ${isSel ? 'var(--primary)' : 'var(--border)'}`,
                                  background: isSel ? 'var(--primary-light)' : 'var(--surface-alt)',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                                  fontSize: 12, color: isSel ? 'var(--primary)' : 'var(--text)',
                                  fontWeight: isSel ? 600 : 400,
                                }}
                              >
                                <div style={{
                                  width: 18, height: 18, borderRadius: '50%',
                                  border: `1.5px solid ${isSel ? 'var(--primary)' : 'var(--border)'}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 9, fontWeight: 700,
                                  background: isSel ? 'var(--primary)' : 'transparent',
                                  color: isSel ? '#fff' : 'var(--text-3)',
                                  flexShrink: 0,
                                }}>
                                  {String.fromCharCode(65 + oi)}
                                </div>
                                {opt}
                              </motion.div>
                            )
                          })}
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            if (qrSelected === null) return
                            const correct = qrSelected === currentQuestion.ans
                            setQrSubmitted(true)
                            setQrCorrect(correct)
                            const timeSpent = qrStartTime.current ? Math.round((Date.now() - qrStartTime.current) / 1000) : 0
                            const tid = currentQuestion.topicId
                            const prev = qrHistory.current[tid] || []
                            qrHistory.current[tid] = [...prev.slice(-4), { q: currentQuestion.q, isCorrect: correct, explanation: currentQuestion.explanation }]
                            recordQuestionAttempt(tid, correct, timeSpent, '')
                            recordSeenQuestionLocal(tid, currentQuestion.q, correct)
                            saveTopicScore(tid, correct ? 1 : 0, 1)
                            updateStats(correct ? 1 : 0, 1, '')
                          }}
                          style={{
                            width: '100%', padding: '10px 0', borderRadius: 10,
                            border: 'none',
                            background: qrSelected !== null ? 'var(--primary)' : 'var(--border)',
                            color: qrSelected !== null ? '#fff' : 'var(--text-3)',
                            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                            cursor: qrSelected !== null ? 'pointer' : 'default',
                          }}
                        >
                          Check Answer
                        </motion.button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{
                          padding: '10px 12px', borderRadius: 10,
                          background: qrCorrect ? 'var(--success-light)' : 'var(--error-light)',
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                        }}>
                          {qrCorrect ? (
                            <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
                          ) : (
                            <AlertTriangle size={16} color="var(--error)" style={{ flexShrink: 0, marginTop: 2 }} />
                          )}
                          <div>
                            <div style={{
                              fontSize: 13, fontWeight: 700,
                              color: qrCorrect ? 'var(--success-dark)' : 'var(--error)',
                            }}>
                              {qrCorrect ? 'Correct' : 'Incorrect'}
                            </div>
                            {!qrCorrect && (
                              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                                Answer: {String.fromCharCode(65 + currentQuestion.ans)}
                              </div>
                            )}
                          </div>
                        </div>

                        {currentQuestion.explanation && (
                          <div style={{
                            fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6,
                          }}>
                            {currentQuestion.explanation}
                          </div>
                        )}

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={advanceQuestion}
                          style={{
                            width: '100%', padding: '10px 0', borderRadius: 10,
                            border: 'none', background: 'var(--primary)', color: '#fff',
                            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          {sessionCount < 4 ? 'Next \u2192' : 'Finish'}
                        </motion.button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', padding: '8px 0' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={22} color="var(--success)" />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>
                      Session complete!
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center' }}>
                      You've answered 5 questions targeting your weak areas.
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { beginSession(); loadQuestion() }}
                      style={{
                        padding: '10px 24px', borderRadius: 10,
                        border: 'none', background: 'var(--primary)', color: '#fff',
                        fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                        cursor: 'pointer', marginTop: 4,
                      }}
                    >
                      Generate More Questions
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Revision Cards — horizontal scroll */}
        {remainingFeed.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0 4px 20px' }}>
            <div className="hide-scrollbar" style={{
              display: 'flex', gap: 24, overflowX: 'auto',
              paddingRight: 20, scrollbarWidth: 'none', msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}>
              {remainingFeed.map((t, idx) => {
                const pi = calculatePriorityScore(t.id, topicScores, revisionSchedule)
                const badgeLabel = pi?.weakness >= 0.6 ? 'Weak' : pi?.forgetting >= 0.5 ? 'Forgotten' : 'Review'
                const badgeStyle = pi?.weakness >= 0.6 ? { background: 'var(--error-light)', color: 'var(--error)' } :
                  pi?.forgetting >= 0.5 ? { background: 'var(--warning-light)', color: 'var(--warning)' } :
                  { background: 'var(--surface-alt)', color: 'var(--text-2)' }
                const subj = upscSubjects.find(s => s.id === t.subjectId)
                const subjGradient = subj?.gradient || 'linear-gradient(135deg, var(--primary-dark), var(--primary))'
                return (
                  <motion.div key={t.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28, delay: idx * 0.05 }}
                    style={{
                      width: 213, flexShrink: 0,
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      borderRadius: 16, display: 'flex', flexDirection: 'column',
                      overflow: 'hidden',
                    }}>
                    <div style={{
                      height: 125, background: subjGradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.1) 0%, transparent 60%)',
                      }} />
                      <div style={{
                        fontSize: 32, fontWeight: 900, color: 'rgba(255,255,255,0.13)',
                        textTransform: 'uppercase', userSelect: 'none',
                      }}>
                        {subj?.name || ''}
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      <div style={{
                        fontFamily: "'Stack Sans Headline'", fontWeight: 200,
                        fontSize: 15, color: 'var(--text)', lineHeight: 1.3,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {t.name}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <div style={{
                            padding: '0 10px', height: 24,
                            background: 'var(--surface-alt)', borderRadius: 25,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 500, color: 'var(--text-2)',
                            fontFamily: "'Stack Sans Headline'",
                          }}>
                            {subj?.name || ''}
                          </div>
                          <div style={{
                            padding: '0 10px', height: 24, borderRadius: 25,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 500,
                            fontFamily: "'Stack Sans Headline'",
                            ...badgeStyle,
                          }}>
                            {badgeLabel}
                          </div>
                        </div>
                        <motion.div
                          whileTap={{ scale: 0.85 }}
                          onClick={(e) => { e.stopPropagation(); openRevision(t) }}
                          style={{
                            width: 36, height: 36, background: 'var(--surface-alt)',
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M4 2L8 6L4 10" stroke="var(--text-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* All done */}
        {dailyMix.length > 0 && remainingCount === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={32} color="var(--success)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>All caught up!</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.5 }}>Check back tomorrow for fresh topics.</div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')}
                style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                Practice More
              </motion.button>
            </div>
          </div>
        )}

        {/* Empty G�� no mix */}
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
          </>
        )}

      </div>

      {/* G��G�� REVISION POPUP G��G�� */}
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
                        <div style={{ fontSize: 20, fontWeight: 800, color: acc >= 60 ? 'var(--success-dark)' : 'var(--error)' }}>{acc}%</div>
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
                            <AlertTriangle size={12} color="var(--error)" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--error)' }}>Common Mistakes</span>
                          </div>
                          {revisionContent.commonMistakes.slice(0, 3).map((m, i) => (
                            <div key={i} style={{ fontSize: 11, color: 'var(--error)', padding: '3px 0', lineHeight: 1.5 }}>G�� {m}</div>
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
                            <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', padding: '2px 0', fontStyle: 'italic', lineHeight: 1.5 }}>=��� {m}</div>
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
                          if (isAns) { bg = 'var(--success-light)'; border = 'var(--success)'; color = 'var(--success-dark)' }
                          else if (isSel && !isAns) { bg = 'var(--error-light)'; border = 'var(--error)'; color = 'var(--error-dark)' }
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
                              {practiceSubmitted && isAns ? 'G��' : isSel && !isAns ? 'G��' : String.fromCharCode(65 + oi)}
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
                        {practiceIdx < practiceQ.length - 1 ? 'Next Question G��' : 'See Results'}
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Practice Results */}
                {practiceDone && (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <CheckCircle size={28} color="var(--success)" style={{ marginBottom: 8 }} />
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
