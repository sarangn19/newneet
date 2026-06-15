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

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
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
    let weakest = null; let lowest = 101
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
  const insightSubject = weakestTopic?.name || 'your studies'
  const insightAction = remainingFeed[0]?.name || 'the next topic'

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
    <div style={{ background: '#FFFFFF', minHeight: '100%', overflow: 'hidden', position: 'relative' }}>
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

          {/* ─── TOP CONTENT (normal flow) ─── */}
          <div style={{ padding: '52px 24px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ color: '#737373', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>UPSC Mentor</span>
                <h1 style={{ fontSize: 20, fontWeight: 600, color: '#000', letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>
                  {greeting()}, <span style={{ fontWeight: 800 }}>{user?.name?.split(' ')[0] || 'Aspirant'}</span>
                </h1>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E5E5E5', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#525252' }}>
                {user?.name?.[0] || 'U'}
              </div>
            </div>

            {/* AI Mentor insight */}
            {insightAlert && (
              <div style={{ marginTop: 20, padding: '24px 16px 16px', background: '#fff', borderRadius: 16, boxShadow: '0 1px 30.2px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: 14, fontWeight: 200, color: '#000', opacity: 0.36, marginBottom: 4 }}>AI Mentor</div>
                <div style={{ fontSize: 15, fontWeight: 200, color: '#000', lineHeight: 1.3 }}>
                  Your <span style={{ fontWeight: 400 }}>{insightSubject}</span> needs attention.<br />
                  <span style={{ fontWeight: 600 }}>Revise {insightAction} today.</span>
                </div>
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

              {displayTopics.map((t, i) => {
                const pi = calculatePriorityScore(t.id, topicScores, revisionSchedule)
                const badgeLabel = pi?.weakness >= 0.6 ? 'Weak' : pi?.forgetting >= 0.8 ? 'Forgotten' : pi?.forgetting >= 0.5 ? 'Due' : 'Review'
                const subj = upscSubjects.find(s => s.id === t.subjectId)
                const subjCode = subj?.id?.toUpperCase() || 'GS'
                return (
                  <motion.div key={t.id}
                    onClick={() => openRevision(t)}
                    animate={{
                      height: sheetOpen ? 178 : 148,
                      marginTop: i === 0 ? 0 : sheetOpen ? 19 : -115,
                    }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    style={{
                      width: '100%', borderRadius: 24, background: '#FFFFFF',
                      boxShadow: '0px 0px 16.9px rgba(0,0,0,0.15)',
                      padding: '20px 16px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      cursor: 'pointer',
                      position: 'relative', zIndex: displayTopics.length - i,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: '#000', fontFamily: "'Stack Sans Headline', sans-serif" }}>{t.name}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <span style={{ padding: '2px 10px', background: '#F5F5F5', borderRadius: 25, fontSize: 10, fontWeight: 700, color: '#838383' }}>{subjCode}</span>
                        <span style={{ padding: '2px 10px', background: '#F4F4F4', borderRadius: 25, fontSize: 10, fontWeight: 700, color: '#838383' }}>{badgeLabel}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F6F6F6', borderRadius: '50%' }}>
                        <ChevronRight size={18} color="#000" />
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
