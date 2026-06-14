import { Search } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div style={{ position: 'relative' }}>
      <Search size={14} color="var(--text-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '8px 8px 8px 32px',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
          fontSize: 12, outline: 'none', fontFamily: 'inherit',
          background: 'var(--surface-alt)', color: 'var(--text)',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
