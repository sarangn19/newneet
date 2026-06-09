import { useParams, useNavigate } from 'react-router-dom'
import { getChapterData, getModulesForChapter } from '../data/index'
import { ChevronLeft } from 'lucide-react'
import useStore from '../store/useStore'

function getLevelInfo(xp) {
  const level = Math.floor(xp / 100) + 1
  const xpForCurrentLevel = (level - 1) * 100
  const xpForNextLevel = level * 100
  const xpInCurrentLevel = xp - xpForCurrentLevel
  const xpNeededForNext = xpForNextLevel - xpForCurrentLevel
  const progress = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100))
  return { level, xp, xpInCurrentLevel, xpNeededForNext, progress }
}

function XPBadge() {
  const user = useStore(s => s.user)
  const { level } = getLevelInfo(user.xp || 0)
  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--accent) 0%, var(--primary-dark) 100%)',
      color: 'white', borderRadius: 20, padding: '6px 12px',
      fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4,
      boxShadow: 'var(--shadow-button)',
    }}>
      Lv.{level}
    </div>
  )
}

function XPProgress() {
  const user = useStore(s => s.user)
  const { xp, xpInCurrentLevel, xpNeededForNext, progress } = getLevelInfo(user.xp || 0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--primary-light)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'linear-gradient(90deg, #F97316 0%, #FDBA74 100%)',
          borderRadius: 99, transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
        {xpInCurrentLevel}/{xpNeededForNext} XP
      </div>
    </div>
  )
}

const S = 42  // circle size

function MilestoneDot({ state, delay }) {
  const isDone = state === 'done'
  const isActive = state === 'active'
  const isLocked = state === 'locked'

  const shadowC = isDone || isActive ? 'var(--primary-alt-dark)' : 'rgba(0,0,0,0.15)'
  const mainC = isDone || isActive ? 'var(--accent)' : 'var(--border)'

  return (
    <div style={{ position: 'relative', width: S, height: S, flexShrink: 0 }}>
      {/* Pulse ring for active */}
      {isActive && (
        <div style={{
          position: 'absolute', top: -7, left: -7, width: S + 14, height: S + 14,
          borderRadius: '50%',
          background: 'var(--accent)',
          animation: 'pulseRing 2s infinite ease-in-out',
          animationDelay: `${delay + 0.3}s`,
        }} />
      )}

      {/* Shadow */}
      <div style={{
        position: 'absolute', bottom: -4, right: -4,
        width: S, height: S, borderRadius: '50%',
        background: shadowC,
        animation: `fadeIn 0.3s ease-out ${delay + 0.05}s forwards`,
        opacity: 0,
      }} />
      {/* Main circle */}
      <div style={{
        width: S, height: S, borderRadius: '50%',
        background: mainC,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
        animation: `popIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s forwards`,
        opacity: 0,
      }}>
        {isDone && (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 11L9 15L17 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
        {isActive && (
          <svg width="20" height="22" viewBox="0 0 20 22" fill="white"><polygon points="3,1 3,21 19,11" /></svg>
        )}
        {isLocked && (
          <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
            <rect x="2" y="10" width="14" height="11" rx="2" fill="white" />
            <path d="M5 10V6C5 3.5 7 2 9 2C11 2 13 3.5 13 6V10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  )
}

const CHAPTER_IMAGES = {
  p1: '/chapter icon/physical-world.webp',
  p2: '/chapter icon/units-and-measurements.webp',
  p3: '/chapter icon/1d-motion.webp',
  c1: '/chapter icon/basic-concept-of-chemistry.webp',
  c2: '/chapter icon/structure-of-atom.webp',
  b1: '/chapter icon/living-world.webp',
  b2: '/chapter icon/bio-classification.webp',
  b3: '/chapter icon/plant-kingdom.webp',
}

export default function Roadmap() {
  const { subjectId, chapterId } = useParams()
  const navigate = useNavigate()
  const examType = useStore(s => s.examType) || 'neet'
  const isUpsc = examType === 'upsc'
  const chapter = getChapterData(examType, chapterId)
  const completedModules = useStore(s => s.completedModules)
  if (!chapter) return null

  if (isUpsc) {
    navigate(`/pyq-search?chapter=${chapterId}`, { replace: true })
    return null
  }

  const modules = getModulesForChapter(examType, chapterId)

  const getState = (mod, idx) => {
    const isDone = completedModules.includes(mod.id)
    const prevDone = idx === 0 || (completedModules.includes(modules[idx - 1].id) && modules.slice(0, idx).every(m => completedModules.includes(m.id)))
    const isUnlocked = prevDone || isDone
    if (isDone) return 'done'
    if (isUnlocked) return 'active'
    return 'locked'
  }

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100vh', paddingBottom: 100 }}>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes growDown {
          0% { transform: scaleY(0); opacity: 0; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.15); opacity: 0.35; }
          100% { transform: scale(1); opacity: 0.25; }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '60px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={{
            width: 40, height: 40, borderRadius: 12, border: '2px solid var(--border)',
            background: 'var(--card-bg)', color: 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{chapter.name}</span>
        </div>
        {/* XP Progress bar */}
        <XPProgress />
      </div>

      {/* Module list */}
      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {modules.map((mod, idx) => {
          const state = getState(mod, idx)
          const isLocked = state === 'locked'
          const isDone = state === 'done'
          const isActive = state === 'active'

          return (
            <div key={mod.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: 380 }}>
              {/* Module row */}
              <div
                onClick={() => !isLocked && navigate(`/subject/${subjectId}/chapter/${chapterId}/module/${mod.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  width: '100%', cursor: isLocked ? 'default' : 'pointer',
                  padding: '4px 0',
                  opacity: isLocked ? 0.45 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <MilestoneDot state={state} delay={idx * 0.1} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: isActive ? 16 : 14,
                    fontWeight: isActive ? 700 : 500,
                    color: isLocked ? 'var(--text-3)' : 'var(--text)',
                    lineHeight: 1.3,
                  }}>
                    {mod.label}
                  </div>
                  {isDone && (
                    <div style={{ fontSize: 12, color: 'var(--success-dark)', fontWeight: 600, marginTop: 2 }}>✓ Completed</div>
                  )}
                  {isActive && (
                    <div style={{
                      display: 'inline-block', marginTop: 4,
                      background: 'rgba(249,115,22,0.12)', color: 'var(--primary)',
                      fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                    }}>
                      Start
                    </div>
                  )}
                  {isLocked && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Complete previous first</div>
                  )}
                </div>
              </div>

              {/* Connector bar — centered under dot */}
              {idx < modules.length - 1 && (
                <div style={{
                  width: 3, height: 40,
                  background: isDone ? 'var(--accent)' : 'var(--border)',
                  borderRadius: 2,
                  marginLeft: S / 2 - 1.5,
                  animation: `growDown 0.35s ease-out ${0.1 + idx * 0.1}s forwards`,
                  transformOrigin: 'top',
                  opacity: 0,
                }} />
              )}
            </div>
          )
        })}

        {/* Finish flag */}
        {modules.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>🏁 All modules complete!</div>
          </div>
        )}
      </div>
    </div>
  )
}
