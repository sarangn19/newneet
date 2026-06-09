import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { getModules } from '../data/subjects'
import useStore from '../store/useStore'

export default function SubjectCard({ subject }) {
  const navigate = useNavigate()
  const storeCompleted = useStore(s => s.completedModules)
  const totalModules = subject.chapters.reduce((a, c) => a + c.modules, 0)
  const completedCount = subject.chapters.reduce((a, c) => {
    const mods = getModules(c.id)
    return a + mods.filter(m => storeCompleted.includes(m.id)).length
  }, 0)
  const pct = Math.round((completedCount / totalModules) * 100)

  return (
    <div
      onClick={() => navigate(`/subject/${subject.id}`)}
      className="card"
      style={{
        cursor: 'pointer',
        transition: 'transform 0.2s, border-color 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = subject.color}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: subject.color, opacity: 0.08, filter: 'blur(20px)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: subject.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
        }}>
          {subject.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2, color: 'var(--text)' }}>{subject.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{subject.chapters.length} chapters</div>
        </div>
        <ChevronRight size={18} color="var(--text-3)" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{completedCount}/{totalModules} modules</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: subject.color }}>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: subject.gradient }} />
      </div>
    </div>
  )
}
