import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle } from 'lucide-react'

export default function QuizQuestion({
  question,
  onAnswer,
  disabled = false,
  showExplanation = true,
}) {
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setSelected(null)
    setSubmitted(false)
  }, [question])

  const handleSelect = (i) => {
    if (submitted || disabled) return
    setSelected(i)
    setSubmitted(true)
    onAnswer?.(i === question.ans)
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6, marginBottom: 16, color: 'var(--text)' }}>
        {question.q}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {question.options.map((opt, i) => {
          const isCorrect = i === question.ans
          const isWrong = submitted && i === selected && !isCorrect
          const isRight = submitted && isCorrect
          const isSel = !submitted && selected === i
          let bg = 'var(--card-bg)'
          let border = 'var(--border)'
          let textColor = 'var(--text)'
          let badgeColor = 'var(--surface-alt)'
          let badgeTextColor = 'var(--text-2)'
          if (isRight) { bg = 'var(--success-light)'; border = 'var(--success)'; textColor = 'var(--success-dark)'; badgeColor = 'var(--success)'; badgeTextColor = '#fff' }
          else if (isWrong) { bg = 'var(--error-light)'; border = 'var(--error)'; textColor = 'var(--error-dark)'; badgeColor = 'var(--error)'; badgeTextColor = '#fff' }
          else if (isSel) { bg = 'var(--primary-light)'; border = 'var(--primary)'; textColor = 'var(--primary)'; badgeColor = 'var(--primary)'; badgeTextColor = '#fff' }
          return (
            <motion.button
              key={i}
              onClick={() => handleSelect(i)}
              whileTap={submitted ? {} : { scale: 0.98 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${border}`, cursor: submitted ? 'default' : 'pointer',
                background: bg, color: textColor, fontSize: 12, fontWeight: 500,
                textAlign: 'left', fontFamily: 'inherit', lineHeight: 1.4,
                transition: 'all 0.12s', width: '100%',
              }}
            >
              {submitted ? (
                isRight ? <CheckCircle size={14} color="var(--success)" />
                  : isWrong ? <XCircle size={14} color="var(--error)" />
                    : <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--border)', flexShrink: 0, display: 'inline-block' }} />
              ) : (
                <div style={{
                  width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                  background: badgeColor, color: badgeTextColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {String.fromCharCode(65 + i)}
                </div>
              )}
              {opt}
            </motion.button>
          )
        })}
      </div>
      {submitted && showExplanation && question.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)',
            background: selected === question.ans ? 'var(--success-light)' : 'var(--error-light)',
            border: `1px solid ${selected === question.ans ? 'var(--success)' : 'var(--error)'}`,
            fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5,
          }}
        >
          {question.explanation}
        </motion.div>
      )}
    </div>
  )
}
