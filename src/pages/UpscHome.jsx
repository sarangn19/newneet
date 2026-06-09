import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { useRecommendations } from '../lib/useRecommendations'
import { usePerformanceAlerts } from '../lib/usePerformanceAlerts'
import { generateRevisionContent } from '../lib/revisionAI'
import { upscMCQs } from '../data/upsc/questions'
import { calcPriority as calculatePriorityScore, generateDailyMix as getRevisionMix, getMasteryLevel as getMastery, advanceMastery as saveMastery } from '../lib/revisionEngine'
import { Flame, BarChart3, AlertTriangle, X, Loader, Lightbulb, CheckCircle, TrendingUp, TrendingDown, Clock, Search, FileText, SkipForward, Zap, Layers, MessageSquare, GitBranch, RefreshCw, Target } from 'lucide-react'
import { card as cardStyle, cardHover, spring, spacing, font, colors, btn } from '../lib/designTokens'

export default function UpscHome() {
  const navigate = useNavigate()
  const { user, topicScores, saveTopicScore, recordQuestionAttempt, startSession, endSession, updateStats, revisionSchedule, markTopicReviewed } = useStore()
  const { allTopics } = useRecommendations('upsc')
  const [dailyMix] = useState(() => getRevisionMix(allTopics, topicScores, revisionSchedule, 5))
  const [feedIdx, setFeedIdx] = useState(0)
  const [feedDone, setFeedDone] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    const raw = localStorage.getItem('daily_topic_queue')
    const existing = raw ? JSON.parse(raw) : null
    return new Set(existing?.date === today ? existing.completed : [])
  })

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
  const dayIcons = { 0: RefreshCw, 1: Layers, 2: Zap, 3: GitBranch, 4: FileText, 5: MessageSquare, 6: BarChart3 }
  const TodayIcon = dayIcons[dayOfWeek] || Layers

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
    const seenRaw = localStorage.getItem('revision_seen_questions')
    const seenData = seenRaw ? JSON.parse(seenRaw) : {}
    const topicSeen = seenData[topicId] || {}
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
  const recordSeenQuestion = (topicId, questionText, isCorrect) => {
    const key = questionText.slice(0, 40)
    const raw = localStorage.getItem('revision_seen_questions')
    const data = raw ? JSON.parse(raw) : {}
    if (!data[topicId]) data[topicId] = {}
    if (!data[topicId][key]) data[topicId][key] = { seen: 0, correct: 0 }
    data[topicId][key].seen++
    if (isCorrect) data[topicId][key].correct++
    localStorage.setItem('revision_seen_questions', JSON.stringify(data))
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
    const level = getMastery(topic.id)
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
      recordSeenQuestion(revisionPopupTopic.id, practiceQ[practiceIdx].q, correct)
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
        saveMastery(revisionPopupTopic.id, pct)
        markTopicReviewed(revisionPopupTopic.id)
        setFeedDone(prev => new Set([...prev, revisionPopupTopic.id]))
        const today = new Date().toISOString().slice(0, 10)
        const raw = localStorage.getItem('daily_topic_queue')
        if (raw) {
          const q = JSON.parse(raw)
          if (q.date === today && !q.completed.includes(revisionPopupTopic.id)) {
            q.completed.push(revisionPopupTopic.id)
            localStorage.setItem('daily_topic_queue', JSON.stringify(q))
          }
        }
      }
      endSession()
      setPracticeDone(true)
    }
  }

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100%', paddingBottom: 100, position: 'relative' }}>
      {/* Dot grid background */}
      <div className="bg-pattern" style={{ position: 'fixed', inset: 0, opacity: 0.4, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* ══ TOP BAR ══ */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', letterSpacing: '-0.03em' }}>
              UPSC<span style={{ color: '#6366f1' }}>.</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="pill-3d" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', cursor: 'pointer', background: '#fff', borderRadius: 9999, border: '2px solid #e2e8f0' }}>
              <Flame size={16} color="#f97316" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{streak}</span>
            </button>
            <button className="pill-3d" onClick={() => navigate('/profile')} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff', borderRadius: 9999, border: '2px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#6366f1', background: '#e0e7ff' }}>
                {user?.name?.[0] || 'U'}
              </div>
            </button>
          </div>
        </header>

        {/* ══ GREETING ══ */}
        <div style={{ padding: '0 20px 24px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
            Ready to conquer, {user?.name?.split(' ')[0] || 'Alex'}?
          </h2>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#64748b', marginTop: 4 }}>
            {remainingCount > 0
              ? `${remainingCount} topics remaining today`
              : 'All done for today!'}
          </p>
        </div>

        {/* ══ QUICK LINKS ══ */}
        <section style={{ padding: '0 20px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <div className="card-3d interactive" onClick={() => navigate('/pyq-search')} style={{ padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14, height: 70 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: '#eef2ff', border: '1px solid #e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Search size={20} color="#6366f1" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>PYQ Search</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>Search previous year questions & create custom tests</div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ PERFORMANCE ALERTS ══ */}
        <section style={{ padding: '0 20px 12px' }}>
          <AnimatePresence>
            {alerts.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alerts.slice(0, 2).map((alert, i) => {
                  const iconMap = { critical: TrendingDown, weak: AlertTriangle, declining: TrendingDown, streak: Flame, inactive: Clock, consistency: BarChart3 }
                  const bgMap = { critical: '#FEF2F2', weak: '#FFF7ED', declining: '#FEF2F2', streak: '#FFF7ED', inactive: '#F3F4F6', consistency: '#EFF6FF' }
                  const borderMap = { critical: '#FCA5A5', weak: '#FDBA74', declining: '#FCA5A5', streak: '#FCD34D', inactive: '#D1D5DB', consistency: '#93C5FD' }
                  const colorMap = { critical: '#DC2626', weak: '#D97706', declining: '#DC2626', streak: '#B45309', inactive: '#6B7280', consistency: '#2563EB' }
                  const Icon = iconMap[alert.type] || AlertTriangle
                  return (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 10,
                      background: bgMap[alert.type],
                      borderLeft: `3px solid ${borderMap[alert.type]}`,
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <Icon size={14} color={colorMap[alert.type]} style={{ marginTop: 1, flexShrink: 0 }} />
                      <div style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.4 }}>{alert.message}</div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ══ TODAY'S REVISION CAROUSEL ══ */}
        {remainingFeed.length > 0 && (
          <div
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TodayIcon size={13} color="#6366f1" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Today's Revision</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{remainingCount} left · {dayLabels[dayOfWeek]}</div>
            </div>

            {/* Cards */}
            <div style={{ position: 'relative', width: '100%', minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {[-1, 0, 1].map((offset) => {
                const idx = feedIdx + offset
                if (idx < 0 || idx >= remainingFeed.length) return null
                const t = remainingFeed[idx]
                const isCenter = offset === 0
                const pi = isCenter ? priorityInfo : calculatePriorityScore(t.id, topicScores, revisionSchedule)
                return (
                  <motion.div
                    key={t.id}
                    animate={{
                      x: offset * 200,
                      scale: isCenter ? 1 : 0.85,
                      zIndex: isCenter ? 10 : 5,
                      opacity: isCenter ? 1 : 0.6,
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    onClick={() => { if (isCenter) openRevision(t); else setFeedIdx(idx) }}
                    className="card-3d"
                    style={{
                      position: 'absolute', width: 280, cursor: 'pointer', overflow: 'hidden', borderBottomWidth: 6, padding: 0,
                    }}
                  >
                    {/* Subject badge */}
                    <div style={{ padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.subjectName}</div>
                        <div style={{ fontSize: isCenter ? 17 : 14, fontWeight: 900, color: '#1e293b', lineHeight: 1.2, marginTop: 2 }}>{t.name}</div>
                      </div>
                      <div style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, whiteSpace: 'nowrap',
                        background: pi?.weakness >= 0.6 ? '#fef2f2' : pi?.forgetting >= 0.5 ? '#fff7ed' : '#f0fdf4',
                        color: pi?.weakness >= 0.6 ? '#dc2626' : pi?.forgetting >= 0.5 ? '#d97706' : '#059669',
                      }}>
                        {pi?.weakness >= 0.6 ? 'Weak' : pi?.forgetting >= 0.5 ? 'Forgotten' : 'Review'}
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ padding: '10px 16px', display: 'flex', gap: 10 }}>
                      {t.total > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Target size={11} color="#6366f1" />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>{t.accuracy}%</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} color="#94a3b8" />
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>{getMastery(t.id) === 1 ? '3m' : '5m'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Zap size={11} color="#94a3b8" />
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>L{getMastery(t.id)}/4</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ padding: '0 16px', flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>Why?</div>
                      <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
                        {pi?.weakness >= 0.6
                          ? `Accuracy ${t.accuracy || 0}% — needs improvement.`
                          : pi?.forgetting >= 0.8
                          ? `Over 2 weeks since review.`
                          : pi?.forgetting >= 0.5
                          ? `Due for reinforcement.`
                          : pi?.importance >= 0.6
                          ? `High-yield UPSC topic.`
                          : `Keep knowledge fresh.`}
                      </div>
                    </div>

                    {/* Action button */}
                    <div style={{ padding: '12px 16px' }}>
                      {isCenter ? (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={(e) => { e.stopPropagation(); openRevision(t) }}
                          className="btn-primary-3d"
                          style={{ width: '100%', padding: '10px 0', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none', letterSpacing: '0.02em' }}
                        >Start Practice</motion.button>
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8' }}>Tap to view</div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Dot indicators */}
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {remainingFeed.slice(0, Math.min(remainingFeed.length, 20)).map((_, i) => (
                <div key={i} onClick={() => setFeedIdx(i)}
                  style={{
                    width: i === feedIdx ? 16 : 5, height: 5, borderRadius: 3,
                    background: i === feedIdx ? '#6366f1' : '#d1d5db',
                    transition: 'all 0.25s', cursor: 'pointer',
                  }}
                />
              ))}
            </div>

            {/* Skip button */}
            {feedIdx < remainingFeed.length - 1 && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={skipTopic}
                style={{ marginTop: 12, padding: '8px 20px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: '#fff', border: '2px solid #e2e8f0', borderRadius: 10, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}
              >Skip <SkipForward size={12} /></motion.button>
            )}
          </div>
        )}

        {/* Empty — all done */}
        {dailyMix.length > 0 && remainingCount === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
            <div className="card-3d" style={{ textAlign: 'center', padding: '40px 20px', borderBottomWidth: 6, maxWidth: 300 }}>
              <CheckCircle size={40} color="#10B981" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>All caught up!</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                You've completed today's revision. Check back tomorrow for your personalized feed.
              </div>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/learn')}
                style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                Practice More
              </motion.button>
            </div>
          </div>
        )}

        {/* Empty — no mix */}
        {dailyMix.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
            <div className="card-3d" style={{ textAlign: 'center', padding: '40px 20px', borderBottomWidth: 6, maxWidth: 300 }}>
              <FileText size={40} color="#94a3b8" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>No topics yet</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
                Start practicing to build your revision feed.
              </div>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/learn')}
                style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
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
