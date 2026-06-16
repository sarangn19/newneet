import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Zap, AlertTriangle, Lightbulb, Target, CheckCircle, BookOpen, Rotate3D, FileText, TrendingUp, Loader, Star, Brain } from 'lucide-react'
import useStore from '../store/useStore'
import { upscSubjects } from '../data/upsc/subjects'
import { generateRevisionContent } from '../lib/revisionAI'
import { card as cardStyle, cardHover, spring, spacing, font, colors, btn } from '../lib/designTokens'

export default function Revision() {
  const navigate = useNavigate()
  const { topicId } = useParams()
  const location = useLocation()
  const topicScores = useStore(s => s.topicScores)

  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState(null)

  const topic = useMemo(() => {
    if (location.state?.topic) return location.state.topic
    for (const sub of upscSubjects) {
      const ch = sub.chapters.find(c => c.id === topicId)
      if (ch) return { ...ch, subjectId: sub.id, subjectName: sub.name, subjectColor: sub.color }
    }
    return null
  }, [topicId, location.state])

  const score = topic ? topicScores[topic.id] : null
  const accuracy = score?.total > 0 ? Math.round((score.correct / score.total) * 100) : 0
  const totalQ = score?.total || 0
  const correctQ = score?.correct || 0

  useEffect(() => {
    if (!topic) return
    setLoading(true)
    generateRevisionContent({ ...topic, accuracy, total: totalQ }).then(result => {
      setContent(result)
      setLoading(false)
    })
  }, [topic?.id])

  const steps = ['mcq', 'flashcards', 'notes']
  const stepLabels = ['Practice MCQ', 'Review Flashcards', 'Read Notes']
  const stepIcons = [FileText, Rotate3D, BookOpen]

  if (!topic) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <AlertTriangle size={40} color="var(--text-3)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>Topic not found</div>
          <motion.button onClick={() => navigate(-1)} whileTap={{ scale: 0.97 }}
            style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            Go Back
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh', paddingBottom: 100, overflowX: 'hidden' }}>
      {/* ══ HEADER ══ */}
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: spacing.header }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button onClick={() => navigate(-1)} whileTap={{ scale: 0.9 }}
            style={{ background: 'var(--surface-alt)', border: 'none', borderRadius: 12, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={18} color="var(--text-2)" />
          </motion.button>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 1 }}>{topic.subjectName}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{topic.name}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ══ PERFORMANCE CARD ══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, borderRadius: 'var(--radius-xl)' }}>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>Your Performance</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: accuracy >= 60 ? 'var(--success-light)' : 'var(--error-light)', borderRadius: 'var(--radius-sm)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: accuracy >= 60 ? 'var(--success)' : 'var(--error)' }}>{accuracy}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>Accuracy</div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{totalQ}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>Questions Done</div>
              </div>
              <div style={{ flex: 1, background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-dark)' }}>{correctQ}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>Correct</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ══ AI REVISION CONTENT ══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ ...cardStyle, borderRadius: 'var(--radius-xl)' }}>
          <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="var(--primary)" />
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Smart Revision Notes</div>
            {loading && <Loader size={14} color="var(--primary)" className="spin" />}
          </div>

          {loading ? (
            <div style={{ padding: '24px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Generating personalized revision content...</div>
            </div>
          ) : content ? (
            <div style={{ padding: '0 0 4px' }}>
              {/* Key Points */}
              <Section title="Key Concepts to Focus" icon={Lightbulb}>
                {content.keyPoints?.map((p, i) => (
                  <div key={i} style={{ padding: '8px 14px 8px 34px', position: 'relative', fontSize: 12, color: 'var(--text)', lineHeight: 1.6, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ position: 'absolute', left: 14, top: 8, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--primary-dark)' }}>{i + 1}</span>
                    <span dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </div>
                ))}
              </Section>

              {/* Common Mistakes */}
              <Section title="Common Mistakes to Avoid" icon={AlertTriangle} color="var(--error)" bg="var(--error-light)" iconBg="var(--error-light)">
                {content.commonMistakes?.map((m, i) => (
                  <div key={i} style={{ padding: '7px 14px 7px 34px', position: 'relative', fontSize: 12, color: 'var(--error-dark)', lineHeight: 1.5, borderBottom: '1px solid var(--error-light)' }}>
                    <AlertTriangle size={12} color="var(--error)" style={{ position: 'absolute', left: 14, top: 9 }} />
                    {m}
                  </div>
                ))}
              </Section>

              {/* Exam Tips */}
              <Section title="Exam-Specific Tips" icon={Target} color="var(--success)" bg="var(--success-light)" iconBg="var(--success-light)">
                {content.examTips?.map((t, i) => (
                  <div key={i} style={{ padding: '7px 14px 7px 34px', position: 'relative', fontSize: 12, color: 'var(--success-dark)', lineHeight: 1.5, borderBottom: '1px solid var(--success-light)' }}>
                    <Star size={12} color="var(--success)" style={{ position: 'absolute', left: 14, top: 9 }} />
                    {t}
                  </div>
                ))}
              </Section>

              {/* Mnemonics */}
              {content.mnemonics?.length > 0 && (
                <Section title="Memory Aids" icon={TrendingUp} color="var(--phys)" bg="var(--phys-light)" iconBg="var(--phys-light)">
                  {content.mnemonics?.map((m, i) => (
                    <div key={i} style={{ padding: '7px 14px 7px 34px', position: 'relative', fontSize: 12, color: 'var(--text)', lineHeight: 1.5, borderBottom: '1px solid var(--phys-light)', fontStyle: 'italic' }}>
                      <Brain size={12} color="var(--phys)" style={{ position: 'absolute', left: 14, top: 9 }} />
                      {m}
                    </div>
                  ))}
                </Section>
              )}

              {/* Practice Suggestion */}
              <div style={{ padding: '12px 14px', background: 'var(--primary-light)', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <CheckCircle size={16} color="var(--primary-dark)" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 2 }}>Practice Suggestion</div>
                    <div style={{ fontSize: 11, color: 'var(--primary-dark)', lineHeight: 1.6 }}>{content.practiceSuggestions}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* ══ REVISION STEPS ══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ ...cardStyle, borderRadius: 'var(--radius-xl)' }}>
          <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Quick Revision Steps</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>Complete these steps to master this topic</div>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map((step, i) => {
              const Icon = stepIcons[i]
              const isActive = activeStep === step
              return (
                <motion.div
                  key={step}
                  onClick={() => navigate(`/subject/${topic.subjectId}/chapter/${topic.id}`)}
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.02, borderColor: 'var(--primary)' }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)', border: '1.5px solid', cursor: 'pointer',
                    borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                    background: isActive ? 'var(--primary-light)' : 'var(--card-bg)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? 'var(--primary-light)' : 'var(--surface-alt)',
                  }}>
                    <Icon size={16} color={isActive ? 'var(--primary)' : 'var(--text-2)'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--text)' : 'var(--text-2)' }}>{stepLabels[i]}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>Step {i + 1} of 3</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-3)' }}>
                    {i + 1}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children, color = 'var(--primary)', bg = 'var(--primary-light)', iconBg = 'var(--primary-light)' }) {
  return (
    <div>
      <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={12} color={color} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{title}</span>
      </div>
      {children}
    </div>
  )
}
