import { useParams, useNavigate } from 'react-router-dom'
import { getSubjectsForExam, getChaptersForSubject } from '../data/index'
import { ChevronLeft, ChevronRight, Check, Search } from 'lucide-react'
import useStore from '../store/useStore'

export default function Chapters() {
  const { subjectId } = useParams()
  const navigate = useNavigate()
  const examType = useStore(s => s.examType) || 'neet'
  const subjects = getSubjectsForExam(examType)
  const subject = subjects.find(s => s.id === subjectId)
  const completedModules = useStore(s => s.completedModules)
  const isUpsc = examType === 'upsc'
  if (!subject) return null

  const chapters = getChaptersForSubject(examType, subjectId)
  const hasClasses = !isUpsc && chapters.some(ch => ch.class !== null && ch.class !== undefined)

  return (
    <div className="screen-white">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="back-btn" onClick={() => navigate('/')}>
          <ChevronLeft size={18} />
        </button>
        <div>
          <div className="page-header-title">{subject.emoji} {subject.name}</div>
          <div className="page-header-sub">{chapters.length} {examType === 'upsc' ? 'topics' : 'chapters'}</div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {hasClasses ? (
          [11, 12].map(cls => {
            const classChapters = chapters.filter(ch => ch.class === cls)
            if (classChapters.length === 0) return null
            return (
              <div key={cls}>
                <div className="section-label" style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, marginTop: cls === 12 ? 16 : 0, padding: '6px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                  Class {cls} {cls === 11 ? '(Plus One)' : '(Plus Two)'}
                </div>
                {classChapters.map((ch, idx) => {
                  const modIds = Array.from({ length: ch.modules }, (_, i) => `${ch.id}-m${i}`)
                  const chCompleted = modIds.filter(m => completedModules.includes(m)).length
                  const pct  = Math.round((chCompleted / ch.modules) * 100)
                  const done = chCompleted === ch.modules
                  return (
                    <ChapterCard key={ch.id} ch={ch} idx={idx} subjectId={subjectId} navigate={navigate}
                      chCompleted={chCompleted} pct={pct} done={done} isUpsc={false} />
                  )
                })}
              </div>
            )
          })
        ) : isUpsc ? (
          chapters.map((ch, idx) => (
            <ChapterCard key={ch.id} ch={ch} idx={idx} subjectId={subjectId} navigate={navigate} isUpsc={true} />
          ))
        ) : (
          chapters.map((ch, idx) => {
            const modIds = Array.from({ length: ch.modules }, (_, i) => `${ch.id}-m${i}`)
            const chCompleted = modIds.filter(m => completedModules.includes(m)).length
            const pct  = Math.round((chCompleted / ch.modules) * 100)
            const done = chCompleted === ch.modules
            return (
              <ChapterCard key={ch.id} ch={ch} idx={idx} subjectId={subjectId} navigate={navigate}
                chCompleted={chCompleted} pct={pct} done={done} isUpsc={false} />
            )
          })
        )}
      </div>
    </div>
  )
}

function ChapterCard({ ch, idx, subjectId, navigate, chCompleted, pct, done, isUpsc }) {
  if (isUpsc) {
    return (
      <div key={ch.id} onClick={() => navigate(`/pyq-search?chapter=${ch.id}`)}
        className="card"
        style={{ marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
          color: 'var(--text-3)',
        }}>
          <Search size={16} color="var(--accent)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, color: 'var(--text)' }}>{ch.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Browse PYQs</div>
        </div>
        <ChevronRight size={15} color="var(--text-3)" />
      </div>
    )
  }
  return (
    <div key={ch.id} onClick={() => navigate(`/subject/${subjectId}/chapter/${ch.id}`)}
      className="card"
      style={{ marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: done ? 'var(--primary-alt)' : 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13,
        color: done ? 'white' : 'var(--text-3)',
      }}>
        {done ? <Check size={16} strokeWidth={3} /> : idx + 1}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: 'var(--text)' }}>{ch.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="progress-track" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>
            {chCompleted}/{ch.modules}
          </span>
        </div>
      </div>
      <ChevronRight size={15} color="var(--text-3)" />
    </div>
  )
}
