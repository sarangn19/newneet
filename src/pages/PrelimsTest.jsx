import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Clock, CheckCircle, XCircle, HelpCircle, Flag, BookOpen, BarChart3 } from 'lucide-react'
import useStore from '../store/useStore'
import { getAllUpscQuestions } from '../data/upsc/questions'
import { upscSubjects } from '../data/upsc/subjects'

const PAPERS = [
  { id: 'full',       name: 'GS Full (All Papers)',     chapters: upscSubjects.flatMap(s => s.chapters.map(c => c.id)) },
  { id: 'gs1',        name: 'GS I',                      chapters: upscSubjects.find(s => s.id === 'gs1')?.chapters.map(c => c.id) || [] },
  { id: 'gs2',        name: 'GS II',                     chapters: upscSubjects.find(s => s.id === 'gs2')?.chapters.map(c => c.id) || [] },
  { id: 'gs3',        name: 'GS III',                    chapters: upscSubjects.find(s => s.id === 'gs3')?.chapters.map(c => c.id) || [] },
  { id: 'gs4',        name: 'GS IV (Ethics)',            chapters: upscSubjects.find(s => s.id === 'gs4')?.chapters.map(c => c.id) || [] },
]

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PrelimsTest() {
  const navigate = useNavigate()
  const { addXP, updateStats } = useStore()
  const allQuestions = useMemo(() => getAllUpscQuestions(), [])

  // Setup state
  const [phase, setPhase] = useState('setup') // setup | test | result
  const [selectedPaper, setSelectedPaper] = useState('full')
  const [numQuestions, setNumQuestions] = useState(50)

  // Test state
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})       // { index: selectedOption }
  const [markedForReview, setMarkedForReview] = useState(new Set())
  const [currentQ, setCurrentQ] = useState(0)
  const [submitted, setSubmitted] = useState({})    // { index: true } - locked answer
  const [timeLeft, setTimeLeft] = useState(0)
  const [testStartTime, setTestStartTime] = useState(null)
  const timerRef = useRef(null)

  // Result state
  const [testResults, setTestResults] = useState(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startTest = () => {
    const paper = PAPERS.find(p => p.id === selectedPaper)
    if (!paper) return
    const pool = allQuestions.filter(q => paper.chapters.includes(q.chapter))
    if (pool.length < numQuestions) {
      alert(`Only ${pool.length} questions available for this paper. Reducing to ${Math.min(pool.length, numQuestions)}.`)
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(numQuestions, pool.length))
    setQuestions(shuffled)
    setAnswers({})
    setSubmitted({})
    setMarkedForReview(new Set())
    setCurrentQ(0)
    const totalTime = shuffled.length <= 50 ? 3600 : 7200 // 60 min for 50, 120 min for 100
    setTimeLeft(totalTime)
    setTestStartTime(Date.now())
    setPhase('test')

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const selectAnswer = (optionIndex) => {
    if (submitted[currentQ]) return
    setAnswers(prev => ({ ...prev, [currentQ]: optionIndex }))
  }

  const toggleReview = () => {
    setMarkedForReview(prev => {
      const next = new Set(prev)
      if (next.has(currentQ)) next.delete(currentQ)
      else next.add(currentQ)
      return next
    })
  }

  const submitTest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const timeSpent = Math.round((Date.now() - testStartTime) / 60000)
    let correct = 0, incorrect = 0, skipped = 0
    const breakdown = {}

    questions.forEach((q, i) => {
      const cat = q.chapter
      if (!breakdown[cat]) breakdown[cat] = { correct: 0, incorrect: 0, skipped: 0, total: 0 }
      breakdown[cat].total++
      if (answers[i] === undefined) { skipped++; breakdown[cat].skipped++ }
      else if (answers[i] === q.ans) { correct++; breakdown[cat].correct++ }
      else { incorrect++; breakdown[cat].incorrect++ }
    })

    const score = correct - (incorrect * 0.33) // UPSC negative marking
    const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0
    setTestResults({ correct, incorrect, skipped, score: Math.max(0, Math.round(score * 100) / 100), pct, timeSpent, breakdown, total: questions.length })
    addXP(correct * 5)
    updateStats(correct, questions.length, 'prelims')
    setPhase('result')
  }, [questions, answers, testStartTime, addXP, updateStats])

  // Auto-submit when time runs out
  useEffect(() => {
    if (phase === 'test' && timeLeft === 0 && questions.length > 0) submitTest()
  }, [timeLeft, phase, questions, submitTest])

  // ── SETUP ──
  if (phase === 'setup') {
    return (
      <div className="screen" style={{ background: 'var(--page-bg)', paddingBottom: 100 }}>
        <div style={{ background: '#fff', padding: '48px 16px 12px', borderBottom: '1px solid #F3F4F6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <ChevronLeft size={18} color="#111827" />
            </button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Prelims Test</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>Full-length GS mock tests</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Select Paper</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {PAPERS.map(p => (
              <button key={p.id} onClick={() => setSelectedPaper(p.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                border: selectedPaper === p.id ? '1.5px solid #3B82F6' : '1px solid #E5E7EB',
                background: selectedPaper === p.id ? '#EFF6FF' : '#fff',
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: selectedPaper === p.id ? '#3B82F6' : '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <BookOpen size={15} color={selectedPaper === p.id ? '#fff' : '#9CA3AF'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.chapters.length} topics</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Number of Questions</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {[50, 100].map(n => (
              <button key={n} onClick={() => setNumQuestions(n)} style={{
                flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: numQuestions === n ? '1.5px solid #3B82F6' : '1px solid #E5E7EB',
                background: numQuestions === n ? '#EFF6FF' : '#fff',
                fontSize: 15, fontWeight: 700, color: numQuestions === n ? '#3B82F6' : '#9CA3AF',
              }}>
                {n}
              </button>
            ))}
          </div>

          <div style={{
            background: '#EFF6FF', borderRadius: 10, padding: '10px 14px', marginBottom: 20,
            fontSize: 12, color: '#6B7280', lineHeight: 1.6, border: '1px solid #BFDBFE',
          }}>
            <strong style={{ color: '#3B82F6' }}>Note:</strong> Each question carries 2 marks. 1/3 mark deducted for wrong answers.
            <br />Time: {numQuestions === 50 ? '60 minutes' : '2 hours'}.
          </div>

          <button onClick={startTest} style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: '#3B82F6', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer',
          }}>
            Start Test ({numQuestions} Q • {numQuestions <= 50 ? '60m' : '2h'})
          </button>
        </div>
      </div>
    )
  }

  // ── TEST ──
  if (phase === 'test') {
    const q = questions[currentQ]
    if (!q) return null
    const answered = answers[currentQ] !== undefined
    const isMarked = markedForReview.has(currentQ)
    const isSubmitted = submitted[currentQ]
    const answeredCount = Object.keys(answers).length
    const markedCount = markedForReview.size
    const progress = ((currentQ + 1) / questions.length) * 100

  return (
    <div className="screen" style={{ background: 'var(--page-bg)', paddingBottom: 100 }}>
      {/* Header with back and progress */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ padding: '48px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <ChevronLeft size={18} color="#111827" />
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Prelims Test</div>
          <div style={{ color: '#6B7280', fontSize: 12, fontWeight: 600 }}>
            {currentQ + 1}/{questions.length}
          </div>
        </div>
        <div style={{ height: 6, background: '#EEECE8', borderRadius: 99, overflow: 'hidden', margin: '4px 16px 8px' }}>
          <div style={{ height: '100%', background: '#3B82F6', borderRadius: 99, transition: 'width 0.3s', width: `${progress}%` }} />
        </div>
      </div>

        {/* Question palette (scrollable chips) */}
        <div style={{
          padding: '8px 12px', background: 'white', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 4, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none',
        }}>
          {questions.map((_, i) => {
            const isAns = answers[i] !== undefined
            const isRev = markedForReview.has(i)
            const isCur = i === currentQ
            return (
              <button key={i} onClick={() => setCurrentQ(i)} style={{
                width: 28, height: 28, borderRadius: 12, flexShrink: 0,
                border: isCur ? '2px solid var(--primary)' : '1px solid #ddd',
                background: isAns ? (isRev ? '#FFEAA7' : '#C8F7C5') : (isRev ? '#FFEAA7' : 'white'),
                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isAns ? '#333' : '#999',
              }}>
                {i + 1}
              </button>
            )
          })}
        </div>

        {/* Question */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, fontWeight: 600 }}>
            Q{currentQ + 1} of {questions.length}
            {isMarked && <span style={{ color: '#f59e0b', marginLeft: 8 }}>Flagged for review</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', lineHeight: 1.6, marginBottom: 20 }}>
            {q.q}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, oi) => {
              const isSelected = answers[currentQ] === oi
              const isCorrectAnswer = submitted[currentQ] && oi === q.ans
              const isWrong = submitted[currentQ] && isSelected && oi !== q.ans
              return (
                <button key={oi} onClick={() => selectAnswer(oi)} disabled={submitted[currentQ]} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  borderRadius: 12, cursor: submitted[currentQ] ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontSize: 13, textAlign: 'left', lineHeight: 1.4,
                  border: isCorrectAnswer ? '2px solid var(--primary-alt)' : isWrong ? '2px solid #e53935' : isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: isCorrectAnswer ? 'var(--primary-alt-light)' : isWrong ? '#fff0f0' : isSelected ? '#FFF8F0' : 'white',
                  color: 'var(--text)',
                  transition: 'all 0.1s', width: '100%',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isCorrectAnswer ? 'var(--primary-alt)' : isWrong ? '#e53935' : isSelected ? 'var(--primary)' : 'var(--bg)',
                    color: 'white', fontSize: 11, fontWeight: 700,
                  }}>
                    {isCorrectAnswer ? <CheckCircle size={14} /> : isWrong ? <XCircle size={14} /> : String.fromCharCode(65 + oi)}
                  </div>
                  {opt}
                </button>
              )
            })}
          </div>

          {submitted[currentQ] && q.explanation && (
            <div style={{
              marginTop: 16, background: '#FFF8F0', borderRadius: 10, padding: '12px 14px',
              fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, border: '1px solid #FFE8CC',
            }}>
              <strong style={{ color: 'var(--primary)' }}>Explanation:</strong> {q.explanation}
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div style={{
          padding: '8px 16px 100px', background: 'white', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8,
        }}>
          <button onClick={toggleReview} style={{
            padding: '10px 14px', borderRadius: 12, border: isMarked ? '2px solid #f59e0b' : '1.5px solid var(--border)',
            background: isMarked ? '#EFF6FF' : 'white', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 11, fontWeight: 600, color: isMarked ? '#f59e0b' : 'var(--text-3)',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            <Flag size={14} fill={isMarked ? '#f59e0b' : 'none'} />
            Review
          </button>
          <button onClick={() => { if (!submitted[currentQ] && answers[currentQ] !== undefined) setSubmitted(prev => ({ ...prev, [currentQ]: true })) }}
            disabled={submitted[currentQ] || answers[currentQ] === undefined}
            style={{
              padding: '10px 14px', borderRadius: 12, border: 'none', cursor: submitted[currentQ] || answers[currentQ] === undefined ? 'default' : 'pointer',
              background: submitted[currentQ] ? '#C8F7C5' : answers[currentQ] === undefined ? '#e0e0e0' : 'var(--primary-alt)',
              color: submitted[currentQ] ? '#2E7D32' : 'white', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            }}>
            {submitted[currentQ] ? 'Saved' : 'Save & Lock'}
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setCurrentQ(prev => Math.max(0, prev - 1))} disabled={currentQ === 0} style={{
            padding: '10px 16px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'white', cursor: currentQ === 0 ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: currentQ === 0 ? '#ccc' : 'var(--text)',
          }}>
            Prev
          </button>
          <button onClick={() => {
            if (currentQ < questions.length - 1) setCurrentQ(prev => prev + 1)
            else if (currentQ === questions.length - 1) submitTest()
          }} style={{
            padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'var(--primary)', color: 'white', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          }}>
            {currentQ === questions.length - 1 ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    )
  }

  // ── RESULT ──
  if (phase === 'result' && testResults) {
    const r = testResults
    return (
      <div className="screen" style={{ background: 'var(--page-bg)', paddingBottom: 100 }}>
        <div style={{ background: '#fff', padding: '48px 16px 16px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>{r.pct >= 60 ? '🏆' : r.pct >= 35 ? '👍' : '💪'}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Test Complete</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Score: {r.score}/{(r.total * 2).toFixed(0)}</div>
        </div>

        <div style={{ padding: '14px 14px 100px' }}>
          {/* Score card */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', marginBottom: 14, textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: r.pct >= 60 ? '#10B981' : r.pct >= 35 ? '#3B82F6' : '#EF4444', marginBottom: 4 }}>
              {r.pct}%
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              {r.correct} Correct • {r.incorrect} Wrong • {r.skipped} Skipped
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ background: '#D1FAE5', borderRadius: 10, padding: '10px 8px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#059669' }}>{r.correct}</div>
                <div style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>Correct</div>
              </div>
              <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '10px 8px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>{r.incorrect}</div>
                <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>Wrong</div>
              </div>
              <div style={{ background: '#F3F4F6', borderRadius: 10, padding: '10px 8px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#9CA3AF' }}>{r.skipped}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>Skipped</div>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', marginBottom: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Subject-wise Breakdown</div>
            {Object.entries(r.breakdown).map(([chapter, data]) => {
              const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
              return (
                <div key={chapter} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 3 }}>
                    <span style={{ color: '#111827' }}>{chapter}</span>
                    <span style={{ color: '#9CA3AF' }}>{data.correct}/{data.total} ({pct}%)</span>
                  </div>
                  <div style={{ height: 5, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3B82F6', borderRadius: 99, transition: 'width 0.3s', width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} color="#6B7280" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.timeSpent}m</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>Time Taken</div>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart3 size={18} color="#6B7280" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.score}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>Weighted Score</div>
              </div>
            </div>
          </div>

          <button onClick={() => setPhase('setup')} style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', marginBottom: 8,
            background: '#3B82F6', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Take Another Test
          </button>
          <button onClick={() => navigate('/')} style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: '1.5px solid #E5E7EB', marginBottom: 8,
            background: '#fff', color: '#6B7280', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return null
}
