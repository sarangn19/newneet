import './shared.css'

export default function ProgressBar({ value, max = 100, height = 4, color }) {
  const pct = Math.min(value / max, 1) * 100
  return (
    <div className="shared-progress-track" style={{ '--prog-h': height + 'px' }}>
      <div className="shared-progress-fill" style={{ '--prog-pct': pct + '%', '--prog-color': color }} />
    </div>
  )
}