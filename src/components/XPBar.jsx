import useStore from '../store/useStore'

export default function XPBar() {
  const { user } = useStore()
  const pct = Math.round((user.xp / user.xpToNext) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 14, color: 'white',
      }}>
        {user.level}
      </div>
      <div style={{ flex: 1 }}>
        <div className="progress-track" style={{ background: 'rgba(255,255,255,0.3)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'white', borderRadius: 4, transition: 'width 0.4s' }} />
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{user.xp} XP</span>
    </div>
  )
}
