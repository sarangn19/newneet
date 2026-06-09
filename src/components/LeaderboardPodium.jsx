import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User } from 'lucide-react'

function Counter({ value }) {
  const [displayValue, setDisplayValue] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayValue((prev) => (prev < value ? prev + 1 : value))
    }, 40)
    return () => clearInterval(timer)
  }, [value])
  return <>{displayValue}</>
}

export default function LeaderboardPodium({ winners, userRank, userWins }) {
  const topThree = [...winners].sort((a, b) => a.rank - b.rank)

  return (
    <div style={{
      width: '100%', maxWidth: 360, margin: '0 auto', marginTop: 16,
      padding: '36px 16px 16px', background: '#fff', borderRadius: 32,
      boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
      border: '1px solid #F3F4F6',
    }}>
      <h2 style={{
        fontSize: 18, fontWeight: 700, color: '#111827',
        marginBottom: 16, textAlign: 'center',
      }}>Leaderboard</h2>

      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        gap: 8, height: 192, marginBottom: 24,
      }}>
        {[1, 0, 2].map((idx, i) => {
          const heights = ['120px', '100px', '80px']
          const barColors = ['var(--primary)', '#78716C', 'var(--primary-dark)']
          const avatarColors = ['var(--primary)', '#78716C', 'var(--primary-dark)']
          return (
            <motion.div
              key={idx}
              initial={{ height: 0 }}
              animate={{ height: heights[idx] }}
              transition={{ type: 'spring', stiffness: 120, delay: i * 0.15 }}
              style={{
                width: 80, borderRadius: '12px 12px 0 0',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-end',
                paddingBottom: 16, fontWeight: 600, color: '#fff',
                overflow: 'visible', position: 'relative',
                background: barColors[idx],
              }}
            >
              {/* Avatar */}
              <div style={{
                position: 'absolute', top: -74,
                width: 48, height: 48, borderRadius: '50%',
                background: avatarColors[idx], border: '4px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {topThree[idx]?.avatar?.startsWith('/')
                  ? <img src={topThree[idx].avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <User size={24} color="#fff" />}
              </div>

              <span style={{
                fontSize: 11, fontWeight: 500,
                position: 'absolute', top: -16,
                width: '100%', textAlign: 'center',
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', padding: '0 4px',
                color: '#374151',
              }}>
                {topThree[idx]?.name || '---'}
              </span>
              <span style={{ fontSize: 24 }}>{idx + 1}</span>
            </motion.div>
          )
        })}
      </div>

      <div style={{
        marginTop: 16, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', background: '#F9FAFB',
        borderRadius: 16, padding: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: '#fff', borderRadius: 8, padding: 8,
            color: 'var(--primary)', display: 'flex',
          }}>
            <User size={16} />
          </div>
          <div>
            <p style={{
              fontSize: 9, color: '#9CA3AF', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.5, margin: 0,
            }}>Your Rank</p>
            <p style={{ fontSize: 12, color: '#374151', margin: '2px 0 0', fontWeight: 500 }}>
              {userWins} wins
            </p>
          </div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>
          #<Counter value={userRank} />
        </div>
      </div>
    </div>
  )
}
