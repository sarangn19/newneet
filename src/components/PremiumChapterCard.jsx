import { Star, ChevronRight, Trophy } from 'lucide-react'

export default function PremiumChapterCard({
  chapterNum = "Chapter 1",
  title = "The Living World",
  completed = 0,
  total = 5,
  stars = 0,
  illustration = null,
  locked = false,
  onStart = () => {}
}) {
  const DefaultIllustration = () => (
    <svg viewBox="0 0 400 300" style={{ width: '100%', height: '100%', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="#EDE9FE" rx="16" />
      <circle cx="200" cy="150" r="90" fill="#DDD6FE" opacity="0.7" />
      <path d="M200,260 Q190,190 170,160 T200,80" stroke="#8B5CF6" strokeWidth="4" fill="none" />
      <path d="M200,260 Q210,190 230,160 T200,80" stroke="#8B5CF6" strokeWidth="4" fill="none" />
      <circle cx="170" cy="160" r="16" fill="#F43F5E" />
      <circle cx="230" cy="160" r="16" fill="#10B981" />
      <circle cx="200" cy="100" r="16" fill="#F59E0B" />
    </svg>
  )

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#ffffff',
      borderRadius: 28,
      padding: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      border: '1px solid rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        position: 'relative',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 8,
        background: '#F8F7FF',
        width: '100%',
      }}>
        {typeof illustration === 'string'
          ? <img src={illustration} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
          : <div style={{ width: '100%', aspectRatio: '4/3' }}><DefaultIllustration /></div>
        }
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: 'rgba(30,20,60,0.75)',
          backdropFilter: 'blur(8px)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 9,
          padding: '4px 8px',
          borderRadius: 999,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: locked ? '#94A3B8' : '#34D399' }} />
          {locked ? 'Locked' : 'Active'}
        </div>
      </div>

      <div style={{ padding: '0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', color: '#94A3B8', textTransform: 'uppercase' }}>
            {chapterNum}
          </span>
          <div style={{ display: 'flex', gap: 1 }}>
            {[...Array(3)].map((_, i) => (
              <Star key={i} size={11} style={{
                color: i < stars ? '#FBBF24' : '#CBD5E1',
                fill: i < stars ? '#FBBF24' : 'none',
              }} />
            ))}
          </div>
        </div>

        <h2 style={{
          fontSize: 16, fontWeight: 800, color: '#0F172A',
          marginBottom: 6, lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </h2>

        <div style={{ marginTop: 'auto', marginBottom: 6 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[...Array(Math.min(total, 8))].map((_, idx) => (
              <div key={idx} style={{
                height: 4, flex: 1, borderRadius: 999,
                background: idx < completed ? '#7C3AED' : '#E2E8F0',
                transition: 'background 0.4s',
              }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trophy size={11} color="#94A3B8" />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>
              {completed}/{total}
            </span>
          </div>
          <button
            onClick={() => { if (!locked) onStart() }}
            style={{
              padding: '7px 14px',
              border: 'none',
              borderRadius: 12,
              background: locked ? '#CBD5E1' : 'var(--primary, #7C3AED)',
              color: locked ? '#94A3B8' : '#fff',
              fontWeight: 800,
              fontSize: 11,
              cursor: locked ? 'not-allowed' : 'pointer', letterSpacing: 0.3,
              display: 'flex', alignItems: 'center', gap: 3,
              boxShadow: locked ? 'none' : '0 3px 0 var(--primary-dark, #5B21B6)',
              fontFamily: 'inherit',
              transition: 'transform 0.08s, box-shadow 0.08s',
            }}
            onMouseDown={e => { if (locked) return; e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 1px 0 var(--primary-dark, #5B21B6)' }}
            onMouseUp={e => { if (locked) return; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 0 var(--primary-dark, #5B21B6)' }}
            onMouseLeave={e => { if (locked) return; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 0 var(--primary-dark, #5B21B6)' }}
            onTouchStart={e => { if (locked) return; e.currentTarget.style.transform = 'translateY(2px)'; e.currentTarget.style.boxShadow = '0 1px 0 var(--primary-dark, #5B21B6)' }}
            onTouchEnd={e => { if (locked) return; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 0 var(--primary-dark, #5B21B6)' }}
          >
            {locked ? 'Locked' : 'Start'} {!locked && <ChevronRight size={11} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  )
}
