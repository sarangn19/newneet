import { Search } from 'lucide-react'
import './shared.css'

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="shared-search-wrapper">
      <Search size={14} className="shared-search-icon" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="shared-search-input"
      />
    </div>
  )
}