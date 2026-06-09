import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Rotate3D, CheckCircle, Clock, AlertCircle, BookOpen } from 'lucide-react'
import useStore from '../store/useStore'
import { upscSubjects } from '../data/upsc/subjects'
import { subjects as neetSubjects } from '../data/subjects'

function getInterval(accuracy) {
  if (accuracy >= 80) return 7
  if (accuracy >= 60) return 4
  if (accuracy >= 40) return 2
  return 1
}

export default function RevisionSchedule() {
  const navigate = useNavigate()
  const { topicScores, revisionSchedule, markTopicReviewed, examType } = useStore()

  const dueTopics = useMemo(() => {
    const subjects = examType === 'neet' ? neetSubjects : upscSubjects
    const topics = subjects.flatMap(sub =>
      (sub.chapters || []).map(ch => ({
        ...ch, subjectId: sub.id, subjectName: sub.name, subjectColor: sub.color || '#3B82F6',
      }))
    )

    const today = new Date()

    return topics.map(t => {
      const score = topicScores[t.id]
      const correct = score?.correct || 0
      const total = score?.total || 0
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
      const review = revisionSchedule[t.id]
      const lastReviewed = review?.lastReviewed || null
      const interval = review?.interval || getInterval(accuracy)

      let daysSinceReview = Infinity
      if (lastReviewed) {
        const d = new Date(lastReviewed)
        daysSinceReview = Math.floor((today - d) / (1000 * 60 * 60 * 24))
      }

      const isDue = daysSinceReview >= interval
      const daysOverdue = daysSinceReview === Infinity ? 0 : Math.max(0, daysSinceReview - interval)
      const isCompleted = lastReviewed && !isDue && daysSinceReview !== Infinity
      const daysUntilDue = interval - daysSinceReview

      return {
        ...t, accuracy, total, correct, lastReviewed, interval,
        daysSinceReview, isDue, daysOverdue, isCompleted, daysUntilDue,
      }
    }).filter(t => t.total > 0)
  }, [topicScores, revisionSchedule, examType])

  const dueToday = useMemo(() => dueTopics.filter(t => t.isDue).sort((a, b) => b.daysOverdue - a.daysOverdue), [dueTopics])
  const upcoming = useMemo(() => dueTopics.filter(t => !t.isDue && !t.isCompleted).sort((a, b) => a.daysUntilDue - b.daysUntilDue), [dueTopics])
  const recentCompleted = useMemo(() => dueTopics.filter(t => t.isCompleted).sort((a, b) => {
    const da = new Date(a.lastReviewed), db = new Date(b.lastReviewed)
    return db - da
  }), [dueTopics])
  const unattempted = useMemo(() => {
    const subjects = examType === 'neet' ? neetSubjects : upscSubjects
    return subjects.flatMap(sub =>
      (sub.chapters || []).map(ch => ({ ...ch, subjectId: sub.id, subjectName: sub.name, subjectColor: sub.color || '#6366f1' }))
    ).filter(t => !topicScores[t.id]?.total)
  }, [topicScores, examType])

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100vh', paddingBottom: 100, position: 'relative' }}>
      <div className="bg-pattern" style={{ position: 'fixed', inset: 0, opacity: 0.4, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ padding: '48px 16px 14px', background: '#fff', borderBottom: '2px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button whileTap={{scale:0.96}} onClick={() => navigate('/')} className="pill-3d" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff', border: '2px solid #e2e8f0', borderRadius: 9999, padding: 0 }}>
              <ChevronLeft size={18} color="#475569" />
            </motion.button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Revision Schedule</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 1 }}>Smart spaced repetition</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Overview stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            <div className="card-3d" style={{ padding: '12px 4px', textAlign: 'center', borderBottomWidth: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>{dueToday.length}</div>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, marginTop: 4 }}>Due</div>
            </div>
            <div className="card-3d" style={{ padding: '12px 4px', textAlign: 'center', borderBottomWidth: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#d97706', lineHeight: 1 }}>{upcoming.length}</div>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, marginTop: 4 }}>Upcoming</div>
            </div>
            <div className="card-3d" style={{ padding: '12px 4px', textAlign: 'center', borderBottomWidth: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#059669', lineHeight: 1 }}>{recentCompleted.length}</div>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, marginTop: 4 }}>Reviewed</div>
            </div>
            <div className="card-3d" style={{ padding: '12px 4px', textAlign: 'center', borderBottomWidth: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#94a3b8', lineHeight: 1 }}>{unattempted.length}</div>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, marginTop: 4 }}>New</div>
            </div>
          </div>

          {/* Due Today */}
          {dueToday.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertCircle size={14} color="#dc2626" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Due for Revision ({dueToday.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dueToday.slice(0, 10).map(t => <TopicCard key={t.id} topic={t} onReview={markTopicReviewed} navigate={navigate} />)}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Clock size={14} color="#3B82F6" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Next Reviews ({upcoming.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.slice(0, 10).map(t => (
                  <TopicCard key={t.id} topic={t} onReview={markTopicReviewed} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {/* Recently Reviewed */}
          {recentCompleted.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <CheckCircle size={14} color="#10B981" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Recently Reviewed ({recentCompleted.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentCompleted.slice(0, 5).map(t => (
                  <div key={t.id} className="card-3d" style={{ padding: 12, opacity: 0.7, borderBottomWidth: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: t.subjectColor || '#6366f1', marginBottom: 2 }}>{t.subjectName}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <CheckCircle size={14} color="#10B981" />
                        <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>Reviewed</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                      <div style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: t.accuracy >= 60 ? '#F0FDF4' : '#FEF2F2', color: t.accuracy >= 60 ? '#059669' : '#DC2626' }}>{t.accuracy}%</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Next review in {t.daysUntilDue}d</div>
                    </div>
                  </div>
                ))}
                {recentCompleted.length > 5 && (
                  <div style={{ padding: '6px 4px', fontSize: 11, color: '#94a3b8', textAlign: 'center', fontWeight: 500 }}>
                    +{recentCompleted.length - 5} more reviewed topics
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Unattempted */}
          {unattempted.length > 0 && dueToday.length === 0 && upcoming.length === 0 && recentCompleted.length === 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <BookOpen size={14} color="#94a3b8" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Topics to Start ({unattempted.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unattempted.slice(0, 10).map(t => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-3d interactive" style={{
                    padding: 12, cursor: 'pointer', borderBottomWidth: 3,
                  }} onClick={() => navigate(`/learn`)}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: t.subjectColor || '#6366f1', marginBottom: 2 }}>{t.subjectName}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>No questions attempted yet</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {dueToday.length === 0 && upcoming.length === 0 && recentCompleted.length === 0 && unattempted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Rotate3D size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                {Object.keys(topicScores).length === 0 ? 'No practice data yet' : 'All caught up!'}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 16 }}>
                {Object.keys(topicScores).length === 0
                  ? 'Answer MCQs to build your revision schedule automatically.'
                  : 'Your reviewed topics will appear here.'}
              </div>
              {Object.keys(topicScores).length === 0 && (
                <button className="btn-primary-3d" onClick={() => navigate('/learn')} style={{
                  padding: '10px 24px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', border: 'none', letterSpacing: '0.02em',
                }}>
                  Start Practice
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TopicCard({ topic: t, onReview, navigate }) {
  const statusColor = t.accuracy < 40 ? '#DC2626' : t.accuracy < 60 ? '#F59E0B' : '#6366f1'
  const todayStr = new Date().toISOString().slice(0, 10)
  const reviewedToday = t.lastReviewed === todayStr

  return (
    <div className="card-3d interactive" style={{ padding: 12, cursor: 'pointer' }} onClick={() => navigate(`/revision/${t.id}`, { state: { topic: t } })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.subjectColor || '#6366f1', marginBottom: 2 }}>{t.subjectName}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); onReview(t.id) }} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0,
        }} title={reviewedToday ? 'Reviewed today' : 'Mark as reviewed'}>
          <CheckCircle size={18} color={reviewedToday ? '#10B981' : '#D1D5DB'} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: statusColor + '15', color: statusColor }}>
          {t.accuracy}%
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          {reviewedToday ? 'Reviewed today' : t.daysSinceReview === Infinity ? 'Never reviewed' : `${t.daysSinceReview}d since review`}
        </div>
        {t.daysOverdue > 0 && (
          <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>{t.daysOverdue}d overdue</div>
        )}
      </div>
    </div>
  )
}
