import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { ChevronLeft, Zap, Star } from 'lucide-react'
import { chapterQuestions } from '../data/subjects'
import { moduleLessons } from '../data/lessonData'
import { getAllUpscQuestions } from '../data/upsc/questions'
import { upscSubjects } from '../data/upsc/subjects'
import { MCQTask, FlashcardTask, MatchTask, DragCategoryTask, FillBlankTask, SpeedTapTask, SequenceTask, TapRevealTask } from '../components/GameTask'
import { useRive } from '@rive-app/react-canvas'
import useSound from '../lib/useSound'

// ── Task Renderer ─────────────────────────────────────────────
function TaskRenderer({ task, onComplete }) {
  const key = `${task.type}-${JSON.stringify(task).slice(0, 50)}`
  switch (task.type) {
    case 'mcq': return <MCQTask key={key} question={task.question} onComplete={onComplete} />
    case 'match': return <MatchTask key={key} pairs={task.pairs} onComplete={onComplete} />
    case 'dragCategory': return <DragCategoryTask key={key} instruction={task.instruction} categories={task.categories} items={task.items} onComplete={onComplete} />
    case 'fillBlank': return <FillBlankTask key={key} sentence={task.sentence} blanks={task.blanks} onComplete={onComplete} />
    case 'speedTap': return <SpeedTapTask key={key} instruction={task.instruction} items={task.items} timeLimit={task.timeLimit} onComplete={onComplete} />
    case 'sequence': return <SequenceTask key={key} instruction={task.instruction} items={task.items} onComplete={onComplete} />
    case 'tapReveal': return <TapRevealTask key={key} instruction={task.instruction} items={task.items} onComplete={onComplete} />
    case 'flashcard': return <FlashcardTask key={key} cards={task.cards} onComplete={onComplete} />
    default: return <div style={{ color: 'var(--text-3)' }}>Unknown task type: {task.type}</div>
  }
}

// ── Fallback simple MCQ module ────────────────────────────────
function SimpleMCQModule({ subjectId, chapterId, moduleId }) {
  const isUpsc = chapterId?.startsWith?.('gs')
  const navigate = useNavigate()
  const { addXP, completeModule, saveModuleProgress, clearModuleProgress } = useStore()
  const saved = useStore(s => s.moduleProgress[moduleId])

  const [current, setCurrent] = useState(saved?.taskIdx || 0)
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(saved?.score || 0)
  const [phase, setPhase] = useState('quiz')
  const [mascotMood, setMascotMood] = useState('default')
  const [mascotKey, setMascotKey] = useState(0)
  const play = useSound()

  const upscFallback = useMemo(() => {
    if (!isUpsc) return null
    const all = getAllUpscQuestions()
    const chQuestions = all.filter(q => q.chapter === chapterId)
    if (chQuestions.length >= 3) return chQuestions
    return all.sort(() => Math.random() - 0.5).slice(0, 5)
  }, [isUpsc, chapterId])

  const neetSample = [
    { q: "Which of the following best describes Newton's First Law of Motion?", options: ['Force equals mass times acceleration', 'An object at rest stays at rest unless acted upon by a net force', 'For every action there is an equal and opposite reaction', 'Energy cannot be created or destroyed'], ans: 1, explanation: "Newton's First Law (Law of Inertia): an object remains at rest or in uniform motion unless acted upon by an external net force." },
    { q: 'What is the SI unit of electric current?', options: ['Volt', 'Watt', 'Ampere', 'Ohm'], ans: 2, explanation: 'The SI unit of electric current is the Ampere (A).' },
    { q: 'Which organelle is called the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], ans: 2, explanation: 'Mitochondria produce ATP through cellular respiration.' },
  ]

  const questions = (chapterQuestions[chapterId] && chapterQuestions[chapterId][moduleId]) || (isUpsc ? upscFallback : neetSample) || neetSample
  const q = questions[current]
  const progress = (current / questions.length) * 100

  useEffect(() => {
    if (submitted && selected !== null) {
      const correct = selected === q.ans
      setMascotMood(correct ? 'celebration' : 'sad')
      setMascotKey(k => k + 1)
      play(correct ? 'correct' : 'wrong')
    } else {
      setMascotMood('default')
    }
  }, [submitted])

  useEffect(() => {
    if (mascotMood !== 'default') {
      const timer = setTimeout(() => setMascotMood('default'), 2000)
      return () => clearTimeout(timer)
    }
  }, [mascotKey])

  const handleCheck = () => { 
    if (selected === null) return
    setSubmitted(true)
    const isCorrect = selected === q.ans
    if (isCorrect) {
      setScore(s => s + 1)
    }
  }
  const handleNext = () => {
    const isCorrect = selected === q.ans
    // Record this attempt for Stats page
    const { recordQuestionAttempt, updateStats, userId, examType: et } = useStore.getState()
    recordQuestionAttempt(chapterId || '', isCorrect, 0, subjectId || '')
    if (current + 1 >= questions.length) {
      const finalScore = score + (isCorrect ? 1 : 0)
      updateStats(finalScore, questions.length, subjectId || '')
      addXP(finalScore * 25); completeModule(moduleId); clearModuleProgress(moduleId); setPhase('result')
    } else {
      const next = current + 1
      setCurrent(next); setSelected(null); setSubmitted(false)
      saveModuleProgress(moduleId, { phase: 'quiz', taskIdx: next, score: isCorrect ? score + 1 : score })
    }
  }

  if (phase === 'result') {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="screen-white" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }} style={{ textAlign: 'center', padding: '0 32px' }}>
          <div style={{ fontSize: 68, marginBottom: 16 }}>{pct >= 70 ? '' : ''}</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>{pct >= 70 ? 'Well done!' : 'Keep going!'}</div>
          <div style={{ fontSize: 17, color: 'var(--primary-alt)', fontWeight: 700, marginBottom: 4 }}>{score}/{questions.length} correct</div>
          <div style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 40 }}>+{score * 25} XP earned</div>
          <button className="btn btn-primary" onClick={() => navigate(`/subject/${subjectId}/chapter/${chapterId}`)}>Continue</button>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{
      height: '100dvh', background: 'var(--page-bg)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header — fixed */}
      <div style={{ padding: '44px 20px 12px', flexShrink: 0, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn-dark" onClick={() => navigate(-1)}><ChevronLeft size={18} /></button>
          <div className="progress-track" style={{ flex: 1 }}><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>{current + 1}/{questions.length}</span>
        </div>
      </div>

      <MascotFeedback mood={mascotMood} animKey={mascotKey} />
      {/* Question zone — scrollable, takes remaining space */}
      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
          style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '18px 16px',
            border: '2px solid #e5e5e5', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, textAlign: 'left', lineHeight: 1.65, color: '#1a1a1a', margin: 0 }}>{q.q}</p>
          </div>
          {submitted && q.explanation && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: selected === q.ans ? '#d1fae5' : '#fee2e2',
                border: `1.5px solid ${selected === q.ans ? '#10b981' : '#ef4444'}`,
                borderRadius: 14, padding: '12px 14px', marginTop: 10,
                fontSize: 13, color: '#374151', lineHeight: 1.6,
              }}>{q.explanation}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Options zone — fixed height, 4 equal boxes */}
      <div style={{
        flexShrink: 0, padding: '24px 16px 8px',
        display: 'flex', flexDirection: 'column', gap: 7,
        minHeight: 248, maxHeight: '35vh',
      }}>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.ans
          const isWrong = submitted && i === selected && !isCorrect
          const isRight = submitted && isCorrect
          const isSel = !submitted && selected === i
          return (
            <button key={i}
              onClick={() => !submitted && setSelected(i)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0 14px', borderRadius: 14, border: 'none',
                cursor: submitted ? 'default' : 'pointer',
                fontFamily: 'inherit', textAlign: 'left', width: '100%',
                background: isRight ? '#d1fae5' : isWrong ? '#fee2e2' : isSel ? '#fff7ed' : '#fff',
                boxShadow: isSel ? '0 0 0 2px #FF9944' : isRight ? '0 0 0 2px #10b981' : isWrong ? '0 0 0 2px #ef4444' : '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.15s', overflow: 'hidden',
              }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isRight ? '#10b981' : isWrong ? '#ef4444' : isSel ? '#FF9944' : '#F3F4F6',
                color: (isRight || isWrong || isSel) ? '#fff' : '#6B7280',
                fontSize: 12, fontWeight: 800,
              }}>
                {String.fromCharCode(65 + i)}
              </div>
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: isRight ? '#065f46' : isWrong ? '#7f1d1d' : '#1a1a1a',
                lineHeight: 1.3,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>{opt}</span>
            </button>
          )
        })}
      </div>

      {/* Action button — fixed */}
      <div style={{ flexShrink: 0, padding: '4px 16px 20px' }}>
        {!submitted
          ? <button className="btn btn-primary" onClick={handleCheck} disabled={selected === null}
              style={{ width: '100%', letterSpacing: 0.3 }}>Check</button>
          : <button className="btn btn-primary" onClick={handleNext}
              style={{ width: '100%', letterSpacing: 0.3 }}>
              {current + 1 >= questions.length ? 'Finish' : 'Next →'}
            </button>
        }
      </div>
    </div>
  )
}

function MascotFeedback({ mood, animKey }) {
  const { rive, RiveComponent } = useRive({
    src: '/latest_mascot.riv',
    autoplay: false,
  })
  const defaultAnims = useRef([])
  const animIdx = useRef(0)
  const toggleRef = useRef(null)

  useEffect(() => {
    if (!rive) return
    const names = rive.animationNames
    defaultAnims.current = ['default reading', 'default 2 blink'].filter(n => names?.includes(n))
    if (!defaultAnims.current.length) {
      defaultAnims.current = names?.filter(n => n.includes('default')) || [names?.[0]]
    }
    if (defaultAnims.current.length) {
      rive.play(defaultAnims.current[0], true)
      if (defaultAnims.current.length > 1) {
        toggleRef.current = setInterval(() => {
          animIdx.current = (animIdx.current + 1) % defaultAnims.current.length
          rive.play(defaultAnims.current[animIdx.current], true)
        }, 4000)
      }
    }
    return () => { if (toggleRef.current) clearInterval(toggleRef.current) }
  }, [rive])

  useEffect(() => {
    if (!rive) return
    if (mood === 'celebration') rive.play('celebration')
    else if (mood === 'sad') rive.play('sad')
  }, [animKey])

  useEffect(() => {
    if (!rive || !defaultAnims.current.length) return
    if (mood === 'celebration' || mood === 'sad') {
      const timer = setTimeout(() => {
        if (defaultAnims.current.length) rive.play(defaultAnims.current[0], true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [mood])

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      paddingTop: 4, paddingBottom: 0, flexShrink: 0,
    }}>
      <div style={{ width: 160, height: 160 }}>
        <RiveComponent />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN MODULE COMPONENT — Rich Lesson Player
// ════════════════════════════════════════════════════════════════
export default function Module() {
  const { subjectId, chapterId, moduleId } = useParams()
  const navigate = useNavigate()
  const { addXP, completeModule } = useStore()
  const isUpsc = chapterId?.startsWith?.('gs')

  // Redirect UPSC module to PYQ search
  if (isUpsc) {
    navigate(`/pyq-search?chapter=${chapterId}`, { replace: true })
    return null
  }

  // Check if this module has rich lesson data
  const lessonData = moduleLessons[moduleId]
  if (!lessonData) {
    return <SimpleMCQModule subjectId={subjectId} chapterId={chapterId} moduleId={moduleId} />
  }

  return <LessonPlayer
    lessonData={lessonData}
    subjectId={subjectId}
    chapterId={chapterId}
    moduleId={moduleId}
  />
}

function LessonPlayer({ lessonData, subjectId, chapterId, moduleId }) {
  const navigate = useNavigate()
  const { addXP, completeModule, saveModuleProgress, clearModuleProgress } = useStore()
  const [mascotMood, setMascotMood] = useState('default')
  const [mascotKey, setMascotKey] = useState(0)
  const play = useSound()
  const saved = useStore(s => s.moduleProgress[moduleId])

  // Phase: intro → lesson → reward
  const [phase, setPhase] = useState(saved?.phase === 'lesson' ? 'lesson' : 'intro')
  const [lessonIdx, setLessonIdx] = useState(saved?.lessonIdx || 0)
  const [taskIdx, setTaskIdx] = useState(saved?.taskIdx || 0)
  const [score, setScore] = useState(saved?.score || 0)
  const [totalTasks, setTotalTasks] = useState(saved?.totalTasks || 0)
  const [streak, setStreak] = useState(saved?.streak || 0)

  const lessons = lessonData.lessons
  const currentLesson = lessons[lessonIdx]
  const currentTask = currentLesson?.tasks?.[taskIdx]

  const lessonTaskCount = lessons.reduce((sum, l) => sum + l.tasks.length, 0)
  const totalTaskCount = lessonTaskCount
  const completedTaskCount = lessons.slice(0, lessonIdx).reduce((sum, l) => sum + l.tasks.length, 0) + taskIdx
  const progressPct = lessonTaskCount > 0 ? (completedTaskCount / lessonTaskCount) * 100 : 0
  const allDone = phase === 'lesson' && totalTasks >= lessonTaskCount

  const finishModule = () => {
    addXP(lessonData.xpReward || 100)
    completeModule(moduleId)
    clearModuleProgress(moduleId)
    setPhase('reward')
  }

  // Fallback: if the component unmounts before finishModule runs (e.g. user navigates away),
  // the Zustand store calls below still execute since they aren't tied to React lifecycle.
  // The useEffect handles the normal case where user sees the reward screen.
  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(finishModule, 1800)
      return () => clearTimeout(timer)
    }
  }, [allDone])

  useEffect(() => {
    if (mascotKey > 0) {
      const timer = setTimeout(() => setMascotMood('default'), 2000)
      return () => clearTimeout(timer)
    }
  }, [mascotKey])

  const advanceTask = useCallback((correct) => {
    setTotalTasks(t => t + 1)
    setMascotMood(correct ? 'celebration' : 'sad')
    setMascotKey(k => k + 1)
    play(correct ? 'correct' : 'wrong')
    if (correct) {
      setScore(s => s + 1)
      setStreak(s => s + 1)
    } else {
      setStreak(0)
    }

    const isLastTask = taskIdx + 1 >= currentLesson.tasks.length
    const isLastLesson = lessonIdx + 1 >= lessons.length

    if (isLastTask && isLastLesson) {
      // Directly save to localStorage via Zustand store — works even if component unmounts
      addXP(lessonData.xpReward || 100)
      completeModule(moduleId)
      clearModuleProgress(moduleId)
      setTimeout(() => setPhase('reward'), 1800)
      return
    }

    setTimeout(() => {
      if (!isLastTask) {
        const nextTask = taskIdx + 1
        setTaskIdx(nextTask)
        saveModuleProgress(moduleId, { phase: 'lesson', lessonIdx, taskIdx: nextTask, score: correct ? score + 1 : score, totalTasks: totalTasks + 1, streak: correct ? streak + 1 : 0 })
      } else {
        const nextLesson = lessonIdx + 1
        setLessonIdx(nextLesson)
        setTaskIdx(0)
        saveModuleProgress(moduleId, { phase: 'lesson', lessonIdx: nextLesson, taskIdx: 0, score: correct ? score + 1 : score, totalTasks: totalTasks + 1, streak: correct ? streak + 1 : 0 })
      }
    }, 1800)
  }, [taskIdx, lessonIdx, streak, currentLesson, lessons, lessonData, score, totalTasks, moduleId])

  // ── INTRO SCREEN ──
  if (phase === 'intro') {
    return (
      <div className="screen-white" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }} style={{ textAlign: 'center', padding: '0 28px', maxWidth: 400 }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}
            style={{ fontSize: 72, marginBottom: 16 }}>{lessonData.icon}</motion.div>
          <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: 'var(--text)' }}>{lessonData.title}</div>
          <div style={{
            fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24,
            background: 'var(--bg)', borderRadius: 14, padding: '14px 18px',
          }}>{lessonData.theme}</div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 28 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-alt)' }}>{lessons.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Lessons</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#eab308' }}>{totalTaskCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Tasks</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--yellow)' }}>+{lessonData.xpReward}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>XP</div>
            </div>
          </div>
          {saved ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ fontSize: 16, padding: '14px 48px', width: '100%' }}
                onClick={() => setPhase(saved.phase || 'lesson')}>
                Continue →
              </button>
              <button onClick={() => { clearModuleProgress(moduleId); setLessonIdx(0); setTaskIdx(0); setScore(0); setTotalTasks(0); setStreak(0); setPhase('lesson') }}
                style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-3)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0' }}>
                Restart from beginning
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" style={{ fontSize: 16, padding: '14px 48px' }}
              onClick={() => setPhase('lesson')}>
              Start Adventure →
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  // ── REWARD SCREEN ──
  if (phase === 'reward') {
    const pct = totalTasks > 0 ? Math.round((score / totalTasks) * 100) : 100
    return (
      <div className="screen-white" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring' }} style={{ textAlign: 'center', padding: '0 28px' }}>
          <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.8 }} style={{ fontSize: 72, marginBottom: 16 }}>
            {pct >= 70 ? '' : ''}
          </motion.div>
          <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 6, color: 'var(--text)' }}>
            {pct >= 70 ? 'Module Complete!' : 'Good Try!'}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 20 }}>
            {score}/{totalTasks} tasks correct ({pct}%)
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}
              style={{
                background: 'linear-gradient(135deg, var(--primary-alt), var(--primary-alt-dark))', borderRadius: 14, padding: '12px 20px',
                color: 'white', textAlign: 'center',
              }}>
              <Zap size={18} style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 18, fontWeight: 800 }}>+{lessonData.xpReward}</div>
              <div style={{ fontSize: 11 }}>XP Earned</div>
            </motion.div>
            {lessonData.badge && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }}
                style={{
                  background: 'linear-gradient(135deg, var(--yellow), var(--accent))', borderRadius: 14, padding: '12px 20px',
                  color: 'white', textAlign: 'center',
                }}>
                <Star size={18} style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 13, fontWeight: 700 }}>{lessonData.badge}</div>
                <div style={{ fontSize: 11 }}>Badge</div>
              </motion.div>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => navigate(`/subject/${subjectId}/chapter/${chapterId}`)}>
            Continue →
          </button>
        </motion.div>
      </div>
    )
  }

  // ── LESSON PHASE ──
  return (
    <div className="screen-white">
      {/* Header */}
      <div style={{ padding: '48px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="back-btn-dark" onClick={() => navigate('/')}><ChevronLeft size={18} /></button>
        <div className="progress-track" style={{ flex: 1 }}>
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Zap size={14} color="var(--primary-alt)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-alt)' }}>{score}</span>
        </div>
      </div>

      {/* Lesson title */}
      <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          background: 'var(--primary-alt)', color: 'white', borderRadius: 8,
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800,
        }}>
          {lessonIdx + 1}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{currentLesson.title}</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
          Task {taskIdx + 1}/{currentLesson.tasks.length}
        </span>
      </div>

      <MascotFeedback mood={mascotMood} animKey={mascotKey} />
      {/* Task area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${lessonIdx}-${taskIdx}`}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          style={{ padding: '16px 14px 100px', position: 'relative', zIndex: 1 }}
        >
          {currentTask && <TaskRenderer task={currentTask} onComplete={advanceTask} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
