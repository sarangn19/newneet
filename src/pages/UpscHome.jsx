import { useNavigate } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import useStore from '../store/useStore'
import { useRecommendations } from '../lib/useRecommendations'
import { usePerformanceAlerts } from '../lib/usePerformanceAlerts'
import { generateRevisionContent } from '../lib/revisionAI'
import { upscMCQs } from '../data/upsc/questions'
import { upscSubjects } from '../data/upsc/subjects'
import { calcPriority as calculatePriorityScore, generateDailyMix as getRevisionMix, getMasteryLevel as getMastery } from '../lib/revisionEngine'
import { ChevronRight, AlertTriangle, X, Loader, Lightbulb, CheckCircle, FileText, TrendingUp } from 'lucide-react'
import { SkeletonBlock } from '../components/SkeletonBlock'

const fallbackSubjects = [
  { id: 'fb1', name: 'Indian Freedom Struggle', subjectId: 'gs1' },
  { id: 'fb2', name: 'Judiciary & Legal Framework', subjectId: 'gs1' },
  { id: 'fb3', name: 'Indian Culture & Heritage', subjectId: 'gs1' },
  { id: 'fb4', name: 'Modern Indian History', subjectId: 'gs1' },
]

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
  const displayTopics = useMemo(() => remainingFeed.length > 0 ? remainingFeed : fallbackSubjects, [remainingFeed])

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

  const todayDone = useMemo(() =>
    Object.entries(revisionSchedule).filter(([_, v]) => v.lastReviewed === todayStr).length,
  [revisionSchedule, todayStr])

  const insightAlert = alerts[0]
  const weakestTopic = useMemo(() => {
    let weakest = null; let lowest = 101
    Object.entries(topicScores).forEach(([id, ts]) => {
      if (ts.total > 0) {
        const acc = Math.round((ts.correct / ts.total) * 100)
        if (acc < lowest) { lowest = acc; weakest = { id, name: allTopics.find(t => t.id === id)?.name || id, accuracy: acc, subjectId: ts.subjectId || '' } }
      }
    })
    return weakest
  }, [topicScores, allTopics])
  const insightSubject = weakestTopic?.name || 'your studies'
  const insightAction = remainingFeed[0]?.name || 'the next topic'
  const insightMessage = useMemo(() => {
    const a = insightAlert
    if (!a) return null
    switch (a.type) {
      case 'critical':
      case 'weak': {
        const topicName = a.topicId && allTopics.find(t => t.id === a.topicId)?.name
        return `Your ${topicName || 'studies'} need improvement. Revise ${insightAction} today.`
      }
      case 'declining':
        return `Your overall accuracy has declined. Revise ${insightAction} today.`
      case 'streak':
        return `Your streak is at risk. Answer 1 question today.`
      case 'inactive':
        return `You haven't studied in a while. Revise ${insightAction} today.`
      case 'consistency':
        return `Your consistency is low. Aim for 20+ questions daily.`
      default:
        return a.message
    }
  }, [insightAlert, allTopics, insightAction])

  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetY = useMotionValue(450);

  const drawerHeight = 500;
  const closedY = 450;
  const openY = 50;

  const toggleSheet = () => {
    const target = sheetOpen ? closedY : openY;
    animate(sheetY, target, { type: 'spring', damping: 25, stiffness: 200 });
    setSheetOpen(!sheetOpen);
  }

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100%', overflow: 'hidden', position: 'relative', fontFamily: "'Stack Sans Headline', sans-serif" }}>
      {!pageReady ? (
        <>
          <div style={{ padding: '52px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><SkeletonBlock width={120} height={20} /><SkeletonBlock width={160} height={12} /></div>
            <SkeletonBlock width={48} height={48} radius={99} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '0 24px' }}>
            {[1,2,3,4].map(i => <SkeletonBlock key={i} width={'100%'} height={134} radius={16} />)}
          </div>
        </>
      ) : (
        <div style={{ height: '100vh', position: 'relative', overflow: 'hidden' }}>
          {/* ─── GRADIENT BACKGROUND ─── */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(165.65deg, #ED661D 1.18%, #4B46DC 30.46%, rgba(255,255,255,0) 76.76%)',
            opacity: 0.2, pointerEvents: 'none',
          }} />

          {/* ─── FADE GRADIENT ABOVE SHEET ─── */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 380, height: 100,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #F0F0F0 100%)',
            pointerEvents: 'none', zIndex: 25,
          }} />

          {/* ─── TOP CONTENT (normal flow) ─── */}
          <div style={{ padding: '56px 24px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 64 }}>
              <h1 style={{ fontSize: 16, fontWeight: 200, color: '#000', lineHeight: 1.2 }}>
                Hello<br /><span style={{ fontWeight: 800 }}>{user?.name?.split(' ')[0] || 'Aspirant'}</span>
              </h1>
              <div style={{ width: 64, height: 64, borderRadius: 60, background: '#fff', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#525252' }}>
                {user?.name?.[0] || 'U'}
              </div>
            </div>

            {/* AI Mentor card */}
            {insightMessage && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, borderRadius: 12, background: '#fff' }}>
                <div style={{ fontSize: 20, fontWeight: 200, lineHeight: '26px', color: '#000', opacity: 0.36 }}>AI Mentor</div>
                <div style={{ fontSize: 20, fontWeight: 200, lineHeight: '26px', color: '#000' }}>{insightMessage}</div>
              </div>
            )}
          </div>

          {/* ─── DRAGGABLE REVISION SHEET ─── */}
          <motion.div
            style={{ y: sheetY, position: 'absolute', top: 0, left: 0, right: 0, height: '100%', zIndex: 20, background: '#F0F0F0', borderRadius: '32px 32px 0 0', boxShadow: '0px 0px 24.4px rgba(0,0,0,0.15)' }}
            drag="y"
            dragConstraints={{ top: openY, bottom: closedY }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y < -100) {
                animate(sheetY, openY, { type: 'spring', stiffness: 200, damping: 25 });
                setSheetOpen(true);
              } else {
                animate(sheetY, closedY, { type: 'spring', stiffness: 200, damping: 25 });
                setSheetOpen(false);
              }
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }} onClick={toggleSheet}>
              <div style={{ width: 32, height: 4, background: '#D4D4D4', borderRadius: 99 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', marginBottom: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 500, color: '#000', margin: 0, fontFamily: "'Stack Sans Headline', sans-serif" }}>Revision</h2>
              <div style={{ fontSize: 13, color: '#838383', fontWeight: 500 }}>{dailyMix.length > 0 ? remainingFeed.length : '4'} left</div>
            </div>

            {/* List — cascading stack (closed) / spread (open) */}
            <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column' }}>
              {dailyMix.length > 0 && remainingFeed.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <CheckCircle size={32} color="#22c55e" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#000' }}>All caught up!</div>
                  <div style={{ fontSize: 12, color: '#737373', marginTop: 3 }}>Check back tomorrow for fresh topics.</div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')}
                    style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#000', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                    Practice More
                  </motion.button>
                </div>
              )}

              {displayTopics.slice(0, sheetOpen ? displayTopics.length : 3).map((t, i) => {
                const pi = calculatePriorityScore(t.id, topicScores, revisionSchedule)
                const badgeLabel = pi?.weakness >= 0.6 ? 'Weak' : pi?.forgetting >= 0.8 ? 'Forgotten' : pi?.forgetting >= 0.5 ? 'Due' : 'Review'
                const subj = upscSubjects.find(s => s.id === t.subjectId)
                const subjCode = subj?.id?.toUpperCase() || 'GS'
                const closedMargin = i === 1 ? -103 : i === 2 ? -91 : -102
                return (
                  <motion.div key={t.id}
                    onClick={() => openRevision(t)}
                    animate={{
                      height: sheetOpen ? 178 : 134,
                      marginTop: i === 0 ? 0 : sheetOpen ? 19 : closedMargin,
                    }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    style={{
                      width: '100%', borderRadius: 16, background: '#FFFFFF',
                      boxShadow: '0px 1px 30.2px rgba(0,0,0,0.08)',
                      padding: '24px 16px 16px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      cursor: 'pointer',
                      position: 'relative', zIndex: i + 1,
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 200, color: '#000', lineHeight: '26px' }}>{t.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, gap: 64 }}>
                      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <span style={{ padding: '0 12px', background: '#F5F5F5', borderRadius: 25, fontSize: 14, fontWeight: 500, lineHeight: '26px', color: '#838383', height: 26 }}>{subjCode}</span>
                        <span style={{ padding: '0 12px', background: '#F4F4F4', borderRadius: 25, fontSize: 14, fontWeight: 500, lineHeight: '26px', color: '#838383', height: 26 }}>{badgeLabel}</span>
                      </div>
                      <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F6F6F6', borderRadius: 41 }}>
                        <ChevronRight size={20} color="#000" />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        </div>

      )}

      {/* ─── REVISION POPUP ─── */}
      <AnimatePresence>
        {revisionPopupTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35, mass: 1 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', background: '#fff', borderRadius: '32px 32px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(0,0,0,0.25)' }}
            >
              {/* Header */}
              <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#6366f1', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{revisionPopupTopic.subjectName}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#000', lineHeight: 1.2 }}>{revisionPopupTopic.name}</div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
                  style={{ background: '#e5e5e5', border: 'none', borderRadius: 12, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <X size={16} color="#525252" />
                </motion.button>
              </div>

              {/* Content scroll area */}
              <div style={{ padding: '0 24px 24px', overflowY: 'auto', flex: 1 }}>
                {/* Stats row */}
                {(() => {
                  const ts = topicScores[revisionPopupTopic.id]
                  const acc = ts?.total > 0 ? Math.round((ts.correct / ts.total) * 100) : 0
                  return (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '12px 8px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: acc >= 60 ? '#16a34a' : '#dc2626' }}>{acc}%</div>
                        <div style={{ fontSize: 10, color: '#838383', marginTop: 2 }}>Accuracy</div>
                      </div>
                      <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '12px 8px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#000' }}>{ts?.total || 0}</div>
                        <div style={{ fontSize: 10, color: '#838383', marginTop: 2 }}>Questions</div>
                      </div>
                      <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '12px 8px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#6366f1' }}>{ts?.correct || 0}</div>
                        <div style={{ fontSize: 10, color: '#838383', marginTop: 2 }}>Correct</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Content or Loading */}
                {!practiceQ.length || practiceDone ? (
                  revisionLoading ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <Loader size={24} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 14, color: '#838383', marginTop: 12, fontWeight: 500 }}>Generating personalized content...</div>
                    </div>
                  ) : revisionContent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Key Concepts */}
                      <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Lightbulb size={14} color="#6366f1" />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>Key Concepts</span>
                        </div>
                        {revisionContent.keyPoints?.slice(0, 5).map((p, i) => (
                          <div key={i} style={{ padding: '8px 0 8px 24px', position: 'relative', fontSize: 12, color: '#000', lineHeight: 1.5, borderBottom: i < revisionContent.keyPoints.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                            <span style={{ position: 'absolute', left: 0, top: 8, width: 16, height: 16, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#6366f1' }}>{i + 1}</span>
                            <span dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          </div>
                        ))}
                      </div>

                      {/* Common Mistakes */}
                      {revisionContent.commonMistakes?.length > 0 && (
                        <div style={{ background: '#fef2f2', borderRadius: 16, padding: 16, border: '1px solid #fecaca' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <AlertTriangle size={14} color="#dc2626" />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>Common Mistakes</span>
                          </div>
                          {revisionContent.commonMistakes.slice(0, 3).map((m, i) => (
                            <div key={i} style={{ fontSize: 12, color: '#991b1b', padding: '4px 0', lineHeight: 1.5, borderBottom: i < Math.min(revisionContent.commonMistakes.length, 3) - 1 ? '1px solid #fecaca' : 'none' }}>{m}</div>
                          ))}
                        </div>
                      )}

                      {/* Memory Aids */}
                      {revisionContent.mnemonics?.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <TrendingUp size={14} color="#6366f1" />
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>Memory Aids</span>
                          </div>
                          {revisionContent.mnemonics.map((m, i) => (
                            <div key={i} style={{ fontSize: 12, color: '#525252', padding: '4px 0', fontStyle: 'italic', lineHeight: 1.5, borderBottom: i < revisionContent.mnemonics.length - 1 ? '1px solid #f0f0f0' : 'none' }}>{m}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null
                ) : null}

                {/* Practice questions */}
                {practiceQ.length > 0 && !practiceDone && (
                  <div style={{ marginTop: 14, background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={14} color="#525252" />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>Quick Practice</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#838383', fontWeight: 500 }}>{practiceIdx + 1}/{practiceQ.length}</div>
                    </div>
                    <div style={{ height: 4, background: '#f0f0f0', borderRadius: 99, marginBottom: 14, overflow: 'hidden' }}>
                      <div style={{ width: `${((practiceIdx + (practiceSubmitted ? 1 : 0)) / practiceQ.length) * 100}%`, height: '100%', background: '#6366f1', borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#000', marginBottom: 12, lineHeight: 1.5 }}>{practiceQ[practiceIdx].q}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {practiceQ[practiceIdx].options.map((opt, oi) => {
                        const isAns = practiceQ[practiceIdx].ans === oi
                        const isSel = practiceSelected === oi
                        let bg = '#f5f5f5'; let border = '#e5e5e5'; let color = '#000'
                        if (practiceSubmitted) {
                          if (isAns) { bg = '#f0fdf4'; border = '#22c55e'; color = '#16a34a' }
                          else if (isSel && !isAns) { bg = '#fef2f2'; border = '#ef4444'; color = '#dc2626' }
                          else { bg = '#f9f9f9'; border = '#e5e5e5'; color = '#a3a3a3' }
                        } else if (isSel) { bg = '#eef2ff'; border = '#6366f1'; color = '#6366f1' }
                        return (
                          <motion.div key={oi} onClick={() => handlePracticeAnswer(oi)} whileTap={practiceSubmitted ? {} : { scale: 1.01 }}
                            style={{
                              padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${border}`, cursor: practiceSubmitted ? 'default' : 'pointer',
                              background: bg, fontSize: 12, color, display: 'flex', alignItems: 'center', gap: 10, transition: '0.1s',
                            }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${border}`, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
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
                          width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                          background: practiceSelected !== null ? '#000' : '#e5e5e5',
                          color: practiceSelected !== null ? '#fff' : '#a3a3a3',
                          fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: practiceSelected !== null ? 'pointer' : 'default',
                        }}>
                        Check Answer
                      </motion.button>
                    ) : (
                      <motion.button onClick={nextPractice} whileTap={{ scale: 0.97 }}
                        style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: '#000', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                        {practiceIdx < practiceQ.length - 1 ? 'Next Question' : 'See Results'}
                      </motion.button>
                    )}
                  </div>
                )}

                {/* Practice complete */}
                {practiceDone && (
                  <div style={{ textAlign: 'center', padding: '24px 0', background: '#fff', borderRadius: 16, marginTop: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <CheckCircle size={36} color="#22c55e" style={{ marginBottom: 10 }} />
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#000' }}>Practice Complete!</div>
                    <div style={{ fontSize: 13, color: '#838383', marginTop: 6, marginBottom: 16 }}>
                      {practiceAnswers.filter(a => a.correct).length}/{practiceAnswers.length + 1} correct (scores saved)
                    </div>
                    <motion.button onClick={() => { setRevisionPopupTopic(null); setRevisionContent(null) }}
                      whileTap={{ scale: 0.97 }}
                      style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#000', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
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
