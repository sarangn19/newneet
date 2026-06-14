import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './shared.css'

export default function PageHeader({ title, subtitle, backTo, children }) {
  const navigate = useNavigate()
  return (
    <div className="shared-page-header">
      <div className="shared-page-header-inner">
        {backTo && (
          <div onClick={() => navigate(backTo)} className="shared-back-btn">
            <ChevronLeft size={18} color="var(--text-2)" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="shared-page-header-title">{title}</div>
          {subtitle && <div className="shared-page-header-subtitle">{subtitle}</div>}
        </div>
        {children && <div style={{ flexShrink: 0 }}>{children}</div>}
      </div>
    </div>
  )
}
