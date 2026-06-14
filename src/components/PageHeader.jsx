import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PageHeader({ title, subtitle, backTo, children }) {
  const navigate = useNavigate()
  return (
    <div style={{ padding: '48px 16px 10px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36 }}>
        {backTo && (
          <div onClick={() => navigate(backTo)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--card-bg)', border: '2px solid var(--border)', borderRadius: 9999, padding: 0, flexShrink: 0 }}>
            <ChevronLeft size={18} color="var(--text-2)" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginTop: 1 }}>{subtitle}</div>}
        </div>
        {children && <div style={{ flexShrink: 0 }}>{children}</div>}
      </div>
    </div>
  )
}
