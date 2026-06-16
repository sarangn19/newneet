import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import useStore from '../store/useStore'
import { useRecommendations } from '../lib/useRecommendations'
import { calcPriority } from '../lib/revisionEngine'
import { generateAIRQuestion } from '../lib/generateQuestionAI'

export default function AdaptivePractice() {
  const navigate = useNavigate()
  const { topicScores, saveTopicScore, recordQuestionAttempt, updateStats, recordSeenQuestion } = useStore()
  const { allTopics } = useRecommendations('upsc')

  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [currentTopic, setCurrentTopic] = useState(null)
  const [counts, setCounts] = useState({ total: 0, correct: 0 })

  const qrHistory = useRef({})
  const qrStartTime = useRef(null)
  const masteredTopics = useRef(new Set())

  const pickTopic = useCallback(() => {
    if (currentTopic) return currentTopic
    const scored = allTopics
      .map(t => ({ ...t, ...calcPriority(t.id, topicScores, {}) }))
      .sort((a, b) => b.score - a.score)
    const fresh = scored.filter(t => !masteredTopics.current.has(t.id))
    const pool = fresh.length > 0 ? fresh : scored
    return pool[0] || null
  }, [allTopics, topicScores, currentTopic])

  const loadQuestion = useCallback(async (topicOverride) => {
    setLoading(true)
    setSelected(null)
    setSubmitted(false)
    setCorrect(false)
    qrStartTime.current = Date.now()

    const topic = topicOverride || pickTopic()
    if (!topic) { setLoading(false); return }

    const q = await generateAIRQuestion(topic, topicScores, qrHistory.current)
    setCurrentQuestion(q)
    setCurrentTopic(topic)
    setLoading(false)
  }, [pickTopic, topicScores])

  useEffect(() => { loadQuestion() }, [])

  const handleCheck = () => {
    if (selected === null || submitted || !currentQuestion) return
    const isCorrect = selected === currentQuestion.ans
    setSubmitted(true)
    setCorrect(isCorrect)
    setCounts(p => ({ total: p.total + 1, correct: p.correct + (isCorrect ? 1 : 0) }))

    const timeSpent = qrStartTime.current ? Math.round((Date.now() - qrStartTime.current) / 1000) : 0
    const tid = currentQuestion.topicId
    const prev = qrHistory.current[tid] || []
    qrHistory.current[tid] = [...prev.slice(-4), { q: currentQuestion.q, isCorrect, explanation: currentQuestion.explanation }]
    recordQuestionAttempt(tid, isCorrect, timeSpent, '')
    recordSeenQuestion(tid, currentQuestion.q.slice(0, 40), isCorrect)
    saveTopicScore(tid, isCorrect ? 1 : 0, 1)
    updateStats(isCorrect ? 1 : 0, 1, '')
  }

  const handleNext = () => {
    if (correct) {
      setCurrentTopic(null)
      if (currentQuestion) masteredTopics.current.add(currentQuestion.topicId)
    }
    loadQuestion()
  }

  const accuracy = counts.total > 0 ? Math.round((counts.correct / counts.total) * 100) : 0

  return (
    <div className="screen" style={{ background: 'var(--page-bg)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ padding: '52px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={22} color="var(--text)" />
        </motion.button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Adaptive Practice</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {counts.total} answered &middot; {accuracy}% correct
            {currentTopic && <span> &middot; <strong>{currentTopic.name}</strong></span>}
          </div>
        </div>
      </div>

      {/* Question card */}
      <div style={{ flex: 1, padding: '12px 18px 100px', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Generating adaptive question...</div>
          </div>
        ) : !currentQuestion ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>No questions available</div>
            <button onClick={() => loadQuestion()} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Try Again</button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Topic label */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {currentQuestion.subjectName || currentQuestion.topicName}
            </div>

            {/* Question */}
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)', lineHeight: 1.6 }}>
              {currentQuestion.q}
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {currentQuestion.options.map((opt, oi) => {
                const isSel = selected === oi
                let bg = 'var(--surface-alt)'
                let border = 'var(--border)'
                let color = 'var(--text)'
                if (submitted) {
                  if (currentQuestion.ans === oi) { bg = 'var(--success-light)'; border = 'var(--success)'; color = 'var(--success-dark)' }
                  else if (isSel && selected !== currentQuestion.ans) { bg = 'var(--error-light)'; border = 'var(--error)'; color = 'var(--error)' }
                  else { bg = 'transparent'; border = 'transparent'; color = 'var(--text-3)' }
                } else if (isSel) { bg = 'var(--primary-light)'; border = 'var(--primary)'; color = 'var(--primary)' }
                return (
                  <motion.div key={oi}
                    onClick={() => { if (!submitted) setSelected(oi) }}
                    whileTap={submitted ? {} : { scale: 0.99 }}
                    style={{
                      padding: '12px 14px', borderRadius: 12,
                      border: `1.5px solid ${border}`,
                      background: bg, cursor: submitted ? 'default' : 'pointer',
                      fontSize: 14, color, display: 'flex', alignItems: 'center', gap: 12,
                      fontWeight: isSel && !submitted ? 600 : 400,
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      border: `1.5px solid ${border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                      background: submitted && currentQuestion.ans === oi ? 'var(--success)' : isSel ? 'var(--primary)' : 'transparent',
                      color: submitted && currentQuestion.ans === oi ? '#fff' : isSel ? '#fff' : border,
                    }}>
                      {submitted && currentQuestion.ans === oi ? <CheckCircle size={12} /> : isSel && selected !== currentQuestion.ans ? '✕' : String.fromCharCode(65 + oi)}
                    </div>
                    {opt}
                  </motion.div>
                )
              })}
            </div>

            {/* Feedback */}
            {submitted && (
              <div style={{
                padding: '12px 14px', borderRadius: 12,
                background: correct ? 'var(--success-light)' : 'var(--error-light)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {correct ? <CheckCircle size={16} color="var(--success)" /> : <AlertTriangle size={16} color="var(--error)" />}
                  <span style={{ fontSize: 13, fontWeight: 700, color: correct ? 'var(--success-dark)' : 'var(--error)' }}>
                    {correct ? 'Correct!' : 'Incorrect'}
                  </span>
                </div>
                {currentQuestion.explanation && (
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    {currentQuestion.explanation}
                  </div>
                )}
                {correct ? (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Moving to next topic.</div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6, fontWeight: 500 }}>Staying on this topic — another question to strengthen your understanding.</div>
                )}
              </div>
            )}

            {/* Button */}
            {!submitted ? (
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={handleCheck}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                  background: selected !== null ? 'var(--primary)' : 'var(--border)',
                  color: selected !== null ? '#fff' : 'var(--text-3)',
                  fontSize: 14, fontWeight: 600, cursor: selected !== null ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >Check Answer</motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={handleNext}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                  background: 'var(--primary)', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{correct ? 'Next Topic →' : 'Try Again →'}</motion.button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
