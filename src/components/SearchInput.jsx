import { Search } from 'lucide-react'
import './shared.css'

export default function SearchInput({ value, onChange, placeholder = 'Search...', onFocus, onBlur, size }) {
  const cls = 'shared-search-wrapper' + (size === 'lg' ? ' shared-search-lg' : '')
  return (
    <div className={cls}>
      <Search className="shared-search-icon" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="shared-search-input"
      />
    </div>
  )
}