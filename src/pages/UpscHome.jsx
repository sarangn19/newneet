import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { useRecommendations } from '../lib/useRecommendations'
import { usePerformanceAlerts } from '../lib/usePerformanceAlerts'
import { generateRevisionContent } from '../lib/revisionAI'
import { upscMCQs } from '../data/upsc/questions'
import { upscSubjects } from '../data/upsc/subjects'
import { calcPriority as calculatePriorityScore, generateDailyMix as getRevisionMix, getMasteryLevel as getMastery } from '../lib/revisionEngine'
import { Home, BookOpen, User, Flame, BarChart3, AlertTriangle, X, Loader, Lightbulb, CheckCircle, TrendingDown, TrendingUp, Clock, Search, FileText, Zap, Target } from 'lucide-react'
import { useSequentialReveal, easePreset, skeletonBreath } from '../hooks/useSequentialReveal'
import { SkeletonBlock } from '../components/SkeletonBlock'

export default function UpscHome() {
  const navigate = useNavigate()
  const { user, topicScores, saveTopicScore, recordQuestionAttempt, startSession, endSession, updateStats, revisionSchedule, revisionSeenQuestions, markTopicReviewed, revisionMastery, setRevisionMastery, recordSeenQuestion } = useStore()
  const { allTopics } = useRecommendations('upsc')
  const todayStr = new Date().toISOString().slice(0, 10)
  const [pageReady, setPageReady] = useState(false)
  const [dailyMix, setDailyMix] = useState([])
  const [feedIdx, setFeedIdx] = useState(0)
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
  const currentTopic = remainingFeed[feedIdx]
  const remainingCount = remainingFeed.length - feedIdx

  const priorityInfo = useMemo(() => {
    if (!currentTopic) return {}
    return calculatePriorityScore(currentTopic.id, topicScores, revisionSchedule)
  }, [currentTopic, topicScores, revisionSchedule])

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

  const weakestTopic = useMemo(() => {
    let weakest = null
    let lowest = 101
    Object.entries(topicScores).forEach(([id, ts]) => {
      if (ts.total > 0) {
        const acc = Math.round((ts.correct / ts.total) * 100)
        if (acc < lowest) { lowest = acc; weakest = { id, name: allTopics.find(t => t.id === id)?.name || id, accuracy: acc, subjectId: ts.subjectId || '' } }
      }
    })
    return weakest
  }, [topicScores, allTopics])

  const todayDone = useMemo(() =>
    Object.entries(revisionSchedule).filter(([_, v]) => v.lastReviewed === todayStr).length,
  [revisionSchedule, todayStr])

  const insightAlert = alerts[0]
  const insightLabel = insightAlert?.message || 'Keep up the momentum!'
  const insightSubject = weakestTopic?.name || 'your studies'
  const insightAction = remainingFeed[0]?.name || 'the next topic'

  return (
    <div style={{ background: '#F8F9FB', minHeight: '100%', paddingBottom: 90, overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {!pageReady ? (
        <>
          <div style={{ padding: '48px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SkeletonBlock width={100} height={20} />
              <SkeletonBlock width={160} height={12} />
            </div>
            <SkeletonBlock width={48} height={48} radius={99} />
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
        <>
          {/* ─── HEADER ─── */}
          <div style={{ padding: '52px 24px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ color: '#737373', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>UPSC Mentor</span>
                <h1 style={{ fontSize: 32, fontWeight: 600, color: '#000', letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>
                  {greeting()}, <span style={{ fontWeight: 800 }}>{user?.name?.split(' ')[0] || 'Aspirant'}</span>
                </h1>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E5E5E5', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#525252' }}>
                {user?.name?.[0] || 'U'}
              </div>
            </div>
          </div>

          {/* ─── DASHBOARD WIDGETS ─── */}
          <div style={{ padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: 28, padding: 16, border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{weakestTopic?.name?.split(' ')[0] || 'Progress'}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: weakestTopic && weakestTopic.accuracy < 70 ? '#f43f5e' : '#22c55e' }}>
                  {weakestTopic ? `${weakestTopic.accuracy}% ${weakestTopic.accuracy < 70 ? 'Weak' : 'Strong'}` : 'No data'}
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${weakestTopic?.accuracy || 0}%`, height: '100%', background: weakestTopic && weakestTopic.accuracy < 70 ? '#f43f5e' : '#22c55e', borderRadius: 99 }} />
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: 28, padding: 16, border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#737373', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goal</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#262626' }}>{todayDone}/{dailyMix.length || 1} Done</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${dailyMix.length > 0 ? (todayDone / dailyMix.length) * 100 : 0}%`, height: '100%', background: '#262626', borderRadius: 99 }} />
              </div>
            </div>
          </div>

          {/* ─── AI INSIGHT ─── */}
          <div style={{ margin: '16px 24px 0', padding: 24, borderRadius: 32, background: '#000', color: '#fff', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: 10, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>AI Insight</p>
            <p style={{ fontSize: 20, fontWeight: 300, lineHeight: 1.3 }}>
              Your <span style={{ fontWeight: 600 }}>{insightSubject}</span> needs attention.<br />
              <span style={{ fontWeight: 700 }}>Revise {insightAction} today.</span>
            </p>
          </div>

          {/* ─── TODAY'S REVISION CAROUSEL ─── */}
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
                  const badgeBg = pi?.weakness >= 0.6 ? '#fef2f2' : pi?.forgetting >= 0.5 ? '#fffbeb' : '#eef2ff'
                  const badgeColor = pi?.weakness >= 0.6 ? '#dc2626' : pi?.forgetting >= 0.5 ? '#d97706' : '#6366f1'
                  const level = getMastery(t.id, revisionMastery)
                  const subj = upscSubjects.find(s => s.id === t.subjectId)
                  const subjGradient = subj?.gradient || 'linear-gradient(135deg, #4338ca, #6366f1)'
                  return (
                    <motion.div key={t.id}
                      animate={{ x: offset * 200, scale: isCenter ? 1 : 0.85, opacity: isCenter ? 1 : 0.4, zIndex: isCenter ? 10 : 5 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      onClick={() => { if (isCenter) openRevision(t); else setFeedIdx(idx) }}
                      style={{ position: 'absolute', width: 340, cursor: 'pointer', perspective: 1200 }}
                      whileHover={isCenter ? { scale: 1.02 } : {}}
                    >
                      <div style={{
                        background: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(40px)',
                        borderRadius: 32,
                        overflow: 'hidden',
                        boxShadow: isCenter ? '0 30px 60px -15px rgba(0,0,0,0.15)' : '0 8px 20px -8px rgba(0,0,0,0.08)',
                        border: '1px solid rgba(255,255,255,0.3)',
                      }}>
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.subjectName}</div>
                            <div style={{ padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, background: badgeBg, color: badgeColor }}>{badgeLabel}</div>
                          </div>

                          <div style={{ fontSize: isCenter ? 18 : 16, fontWeight: 900, color: '#000', lineHeight: 1.2, marginTop: 5, letterSpacing: '-0.02em' }}>{t.name}</div>

                          <div style={{ fontSize: 11, color: '#737373', marginTop: 5, fontWeight: 500 }}>
                            GS I — L{level}/4 — {reason}
                          </div>

                          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                            {t.total > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Target size={11} color="#6366f1" />
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#525252' }}>{t.accuracy}%</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={11} color="#a3a3a3" />
                              <span style={{ fontSize: 11, color: '#a3a3a3' }}>{level === 1 ? '3m' : '5m'}</span>
                            </div>
                          </div>

                          <div style={{ marginTop: 16 }}>
                            {isCenter ? (
                              <motion.button whileTap={{ scale: 0.97 }} onClick={(e) => { e.stopPropagation(); openRevision(t) }}
                                style={{
                                  width: '100%', padding: '13px 0', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                                  cursor: 'pointer', border: 'none', background: '#000', color: '#fff',
                                  borderRadius: 12, letterSpacing: '0.01em',
                                }}
                              >Start Practice</motion.button>
                            ) : (
                              <div style={{ textAlign: 'center', fontSize: 11, color: '#a3a3a3', letterSpacing: '0.02em' }}>Tap to view</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10 }}>
                {remainingFeed.slice(0, 10).map((_, i) => (
                  <div key={i} onClick={() => setFeedIdx(i)} style={{
                    width: i === feedIdx ? 22 : 6, height: 6, borderRadius: 3,
                    background: i === feedIdx ? '#6366f1' : '#d4d4d4',
                    transition: 'all 0.3s', cursor: 'pointer',
                  }} />
                ))}
              </div>
            </div>
          )}

          {dailyMix.length > 0 && remainingCount === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
              <div style={{ textAlign: 'center' }}>
                <CheckCircle size={32} color="#22c55e" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: '#000' }}>All caught up!</div>
                <div style={{ fontSize: 12, color: '#737373', marginTop: 3, lineHeight: 1.5 }}>Check back tomorrow for fresh topics.</div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')}
                  style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#000', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  Practice More
                </motion.button>
              </div>
            </div>
          )}

          {dailyMix.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
              <div style={{ textAlign: 'center' }}>
                <FileText size={32} color="#a3a3a3" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: '#000' }}>No topics yet</div>
                <div style={{ fontSize: 12, color: '#737373', marginTop: 3, lineHeight: 1.5 }}>Practice some questions to get started.</div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')}
                  style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#000', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  Get Started
                </motion.button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── BOTTOM NAV ─── */}
      <nav style={{
        position: 'fixed', bottom: 16, left: 24, right: 24,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)',
        borderRadius: 32, padding: '12px 20px',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.3)',
        zIndex: 40,
      }}>
        <button onClick={() => navigate('/')} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#000' }}>
          <Home size={22} />
        </button>
        <button onClick={() => navigate('/learn')} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#a3a3a3' }}>
          <BookOpen size={22} />
        </button>
        <button onClick={() => navigate('/pyq-search')} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#a3a3a3' }}>
          <Search size={22} />
        </button>
        <button onClick={() => navigate('/profile')} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#a3a3a3' }}>
          <User size={22} />
        </button>
      </nav>

      {/* ─── REVISION POPUP ─── */}
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
              style={{ width: '100%', maxWidth: 440, maxHeight: '92vh', background: '#fff', borderRadius: '20px 20px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}
            >
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e5e5', flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>{revisionPopupTopic.subjectName}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#000', marginTop: 1 }}>{revisionPopupTopic.name}</div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
                  style={{ background: '#f5f5f5', border: 'none', borderRadius: 12, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <X size={16} color="#a3a3a3" />
                </motion.button>
              </div>

              <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
                {(() => {
                  const ts = topicScores[revisionPopupTopic.id]
                  const acc = ts?.total > 0 ? Math.round((ts.correct / ts.total) * 100) : 0
                  return (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <div style={{ flex: 1, background: acc >= 60 ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: acc >= 60 ? '#16a34a' : '#dc2626' }}>{acc}%</div>
                        <div style={{ fontSize: 10, color: '#737373' }}>Accuracy</div>
                      </div>
                      <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#000' }}>{ts?.total || 0}</div>
                        <div style={{ fontSize: 10, color: '#737373' }}>Questions</div>
                      </div>
                      <div style={{ flex: 1, background: '#eef2ff', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{ts?.correct || 0}</div>
                        <div style={{ fontSize: 10, color: '#737373' }}>Correct</div>
                      </div>
                    </div>
                  )
                })()}

                {!practiceQ.length || practiceDone ? (
                  revisionLoading ? (
                    <div style={{ padding: '24px 0', textAlign: 'center' }}>
                      <Loader size={20} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 12, color: '#a3a3a3', marginTop: 8 }}>Generating personalized content...</div>
                    </div>
                  ) : revisionContent ? (
                    <div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Lightbulb size={14} color="#6366f1" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>Key Concepts</span>
                        </div>
                        {revisionContent.keyPoints?.slice(0, 5).map((p, i) => (
                          <div key={i} style={{ padding: '6px 0 6px 20px', position: 'relative', fontSize: 11, color: '#000', lineHeight: 1.5, borderBottom: '1px solid #e5e5e5' }}>
                            <span style={{ position: 'absolute', left: 0, top: 6, width: 14, height: 14, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#6366f1' }}>{i + 1}</span>
                            <span dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          </div>
                        ))}
                      </div>
                      {revisionContent.commonMistakes?.length > 0 && (
                        <div style={{ marginBottom: 10, background: '#fef2f2', borderRadius: 10, padding: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <AlertTriangle size={12} color="#dc2626" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626' }}>Common Mistakes</span>
                          </div>
                          {revisionContent.commonMistakes.slice(0, 3).map((m, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#dc2626', padding: '3px 0', lineHeight: 1.5 }}>{m}</div>
                          ))}
                        </div>
                      )}
                      {revisionContent.mnemonics?.length > 0 && (
                        <div style={{ background: '#eef2ff', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <TrendingUp size={12} color="#6366f1" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#6366f1' }}>Memory Aids</span>
                          </div>
                          {revisionContent.mnemonics.map((m, i) => (
                            <div key={i} style={{ fontSize: 11, color: '#525252', padding: '2px 0', fontStyle: 'italic', lineHeight: 1.5 }}>{m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null
                ) : null}

                {practiceQ.length > 0 && !practiceDone && (
                  <div style={{ borderTop: revisionContent && !practiceDone ? '1px solid #e5e5e5' : 'none', paddingTop: revisionContent ? 12 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#000' }}>Quick Practice</div>
                      <div style={{ fontSize: 10, color: '#a3a3a3' }}>{practiceIdx + 1}/{practiceQ.length}</div>
                    </div>
                    <div style={{ height: 3, background: '#f5f5f5', borderRadius: 99, marginBottom: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${((practiceIdx + (practiceSubmitted ? 1 : 0)) / practiceQ.length) * 100}%`, height: '100%', background: '#6366f1', borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#000', marginBottom: 8, lineHeight: 1.5 }}>{practiceQ[practiceIdx].q}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                      {practiceQ[practiceIdx].options.map((opt, oi) => {
                        const isAns = practiceQ[practiceIdx].ans === oi
                        const isSel = practiceSelected === oi
                        let bg = '#f5f5f5'; let border = '#e5e5e5'; let color = '#000'
                        if (practiceSubmitted) {
                          if (isAns) { bg = '#f0fdf4'; border = '#22c55e'; color = '#16a34a' }
                          else if (isSel && !isAns) { bg = '#fef2f2'; border = '#ef4444'; color = '#dc2626' }
                          else { bg = '#f5f5f5'; border = '#e5e5e5'; color = '#a3a3a3' }
                        } else if (isSel) { bg = '#eef2ff'; border = '#6366f1'; color = '#6366f1' }
                        return (
                          <motion.div key={oi} onClick={() => handlePracticeAnswer(oi)} whileTap={practiceSubmitted ? {} : { scale: 1.01 }}
                            style={{
                              padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${border}`, cursor: practiceSubmitted ? 'default' : 'pointer',
                              background: bg, fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 8, transition: '0.1s',
                            }}>
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${border}`, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700,
                              background: practiceSubmitted && isAns ? '#22c55e' : isSel ? '#6366f1' : 'transparent',
                              color: practiceSubmitted && isAns ? '#fff' : isSel ? '#fff' : border,
                              borderColor: practiceSubmitted && isAns ? '#22c55e' : isSel ? '#6366f1' : border,
                            }}>
                              {practiceSubmitted && isAns ? String.fromCharCode(10003) : isSel && !isAns ? String.fromCharCode(10005) : String.fromCharCode(65 + oi)}
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
                          background: practiceSelected !== null ? '#000' : '#e5e5e5',
                          color: practiceSelected !== null ? '#fff' : '#a3a3a3',
                          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: practiceSelected !== null ? 'pointer' : 'default',
                        }}>
                        Check Answer
                      </motion.button>
                    ) : (
                      <motion.button onClick={nextPractice} whileTap={{ scale: 0.97 }}
                        style={{ width: '100%', padding: '8px 0', borderRadius: 12, border: 'none', background: '#000', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                        {practiceIdx < practiceQ.length - 1 ? 'Next Question' : 'See Results'}
                      </motion.button>
                    )}
                  </div>
                )}

                {practiceDone && (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <CheckCircle size={28} color="#22c55e" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#000' }}>Practice Complete!</div>
                    <div style={{ fontSize: 12, color: '#737373', marginTop: 4, marginBottom: 10 }}>
                      {practiceAnswers.filter(a => a.correct).length}/{practiceAnswers.length + 1} correct (scores saved)
                    </div>
                    <motion.button onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
                      whileTap={{ scale: 0.97 }}
                      style={{ padding: '8px 20px', borderRadius: 12, border: 'none', background: '#000', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
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
