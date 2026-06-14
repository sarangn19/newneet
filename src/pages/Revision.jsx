import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Zap, AlertTriangle, Lightbulb, Target, CheckCircle, BookOpen, Rotate3D, FileText, TrendingUp, Loader } from 'lucide-react'
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
          <AlertTriangle size={40} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#6B7280' }}>Topic not found</div>
          <motion.button onClick={() => navigate(-1)} whileTap={{ scale: 0.97 }}
            style={{ marginTop: 16, padding: '10px 24px', borderRadius: 12, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            Go Back
          </motion.button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh', paddingBottom: 100, overflowX: 'hidden' }}>
      {/* ══ HEADER ══ */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${colors.borderLight}`, padding: spacing.header }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button onClick={() => navigate(-1)} whileTap={{ scale: 0.9 }}
            style={{ background: '#F3F4F6', border: 'none', borderRadius: 12, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={18} color="#6B7280" />
          </motion.button>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', marginBottom: 1 }}>{topic.subjectName}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{topic.name}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* ══ PERFORMANCE CARD ══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 10 }}>Your Performance</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: accuracy >= 60 ? '#F0FDF4' : '#FEF2F2', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: accuracy >= 60 ? '#059669' : '#DC2626' }}>{accuracy}%</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Accuracy</div>
              </div>
              <div style={{ flex: 1, background: '#F9FAFB', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>{totalQ}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Questions Done</div>
              </div>
              <div style={{ flex: 1, background: '#EFF6FF', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#2563EB' }}>{correctQ}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Correct</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ══ AI REVISION CONTENT ══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={cardStyle}>
          <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} color="#3B82F6" />
            <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111827' }}>Smart Revision Notes</div>
            {loading && <Loader size={14} color="#3B82F6" className="spin" />}
          </div>

          {loading ? (
            <div style={{ padding: '24px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Generating personalized revision content...</div>
            </div>
          ) : content ? (
            <div style={{ padding: '0 0 4px' }}>
              {/* Key Points */}
              <Section title="Key Concepts to Focus" icon={Lightbulb}>
                {content.keyPoints?.map((p, i) => (
                  <div key={i} style={{ padding: '8px 14px 8px 34px', position: 'relative', fontSize: 12, color: '#374151', lineHeight: 1.6, borderBottom: '1px solid #F9FAFB' }}>
                    <span style={{ position: 'absolute', left: 14, top: 8, width: 16, height: 16, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#2563EB' }}>{i + 1}</span>
                    <span dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </div>
                ))}
              </Section>

              {/* Common Mistakes */}
              <Section title="Common Mistakes to Avoid" icon={AlertTriangle} color="#DC2626" bg="#FEF2F2" iconBg="#FEE2E2">
                {content.commonMistakes?.map((m, i) => (
                  <div key={i} style={{ padding: '7px 14px 7px 34px', position: 'relative', fontSize: 12, color: '#7F1D1D', lineHeight: 1.5, borderBottom: '1px solid #FEF2F2' }}>
                    <span style={{ position: 'absolute', left: 14, top: 7, fontSize: 10, color: '#DC2626' }}>⚠</span>
                    {m}
                  </div>
                ))}
              </Section>

              {/* Exam Tips */}
              <Section title="Exam-Specific Tips" icon={Target} color="#059669" bg="#F0FDF4" iconBg="#D1FAE5">
                {content.examTips?.map((t, i) => (
                  <div key={i} style={{ padding: '7px 14px 7px 34px', position: 'relative', fontSize: 12, color: '#065F46', lineHeight: 1.5, borderBottom: '1px solid #F0FDF4' }}>
                    <span style={{ position: 'absolute', left: 14, top: 7, fontSize: 10, color: '#059669' }}>✦</span>
                    {t}
                  </div>
                ))}
              </Section>

              {/* Mnemonics */}
              {content.mnemonics?.length > 0 && (
                <Section title="Memory Aids" icon={TrendingUp} color="#7C3AED" bg="#F5F3FF" iconBg="#EDE9FE">
                  {content.mnemonics?.map((m, i) => (
                    <div key={i} style={{ padding: '7px 14px 7px 34px', position: 'relative', fontSize: 12, color: '#4C1D95', lineHeight: 1.5, borderBottom: '1px solid #F5F3FF', fontStyle: 'italic' }}>
                      <span style={{ position: 'absolute', left: 14, top: 7, fontSize: 10, color: '#7C3AED' }}>🧠</span>
                      {m}
                    </div>
                  ))}
                </Section>
              )}

              {/* Practice Suggestion */}
              <div style={{ padding: '12px 14px', background: '#EFF6FF', borderTop: '1px solid #DBEAFE' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <CheckCircle size={16} color="#2563EB" style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E40AF', marginBottom: 2 }}>Practice Suggestion</div>
                    <div style={{ fontSize: 11, color: '#1D4ED8', lineHeight: 1.6 }}>{content.practiceSuggestions}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* ══ REVISION STEPS ══ */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={cardStyle}>
          <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Quick Revision Steps</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Complete these steps to master this topic</div>
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
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 10, border: '1.5px solid', cursor: 'pointer',
                    borderColor: isActive ? '#3B82F6' : '#F3F4F6',
                    background: isActive ? '#EFF6FF' : '#fff',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#EFF6FF',
                  }}>
                    <Icon size={16} color="#3B82F6" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{stepLabels[i]}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>Step {i + 1} of 3</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#9CA3AF' }}>
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

function Section({ title, icon: Icon, children, color = '#2563EB', bg = '#EFF6FF', iconBg = '#DBEAFE' }) {
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
