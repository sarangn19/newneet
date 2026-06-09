import { useState } from 'react'

export default function SearchBar({
  placeholder = 'Search...',
  onSearch,
  value: controlledValue,
  onChange: controlledOnChange,
  buttonLabel = 'Search',
  disabled = false,
}) {
  const [internalValue, setInternalValue] = useState('')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const handleChange = (e) => {
    if (isControlled) controlledOnChange?.(e)
    else setInternalValue(e.target.value)
  }

  const handleSearch = () => {
    if (!disabled) onSearch?.(value)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
    }}>
      <div style={{
        flex: 1,
        background: 'rgba(255,255,255,0.18)',
        border: '2px solid rgba(255,255,255,0.25)',
        borderRadius: 14,
        padding: '0 16px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15)',
      }}>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: 'inherit',
            color: 'var(--text)',
            '::placeholder': { color: 'var(--text-3)' },
          }}
        />
      </div>

      <button
        onClick={handleSearch}
        disabled={disabled}
        style={{
          flexShrink: 0,
          height: 52,
          padding: '0 22px',
          borderRadius: 12,
          border: 'none',
          background: 'var(--accent-secondary)',
          color: '#fff',
          fontSize: 15,
          fontWeight: 800,
          fontFamily: 'inherit',
          letterSpacing: 0.3,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: disabled
            ? 'none'
            : '0 5px 0 var(--accent-secondary-dark), 0 6px 16px rgba(59,130,246,0.25)',
          opacity: disabled ? 0.5 : 1,
          transition: 'transform 0.08s, box-shadow 0.08s',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseDown={e => {
          if (disabled) return
          e.currentTarget.style.transform = 'translateY(4px)'
          e.currentTarget.style.boxShadow = '0 1px 0 var(--accent-secondary-dark)'
        }}
        onMouseUp={e => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = '0 5px 0 var(--accent-secondary-dark), 0 6px 16px rgba(59,130,246,0.25)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = disabled ? 'none' : '0 5px 0 var(--accent-secondary-dark), 0 6px 16px rgba(59,130,246,0.25)'
        }}
        onTouchStart={e => {
          if (disabled) return
          e.currentTarget.style.transform = 'translateY(4px)'
          e.currentTarget.style.boxShadow = '0 1px 0 var(--accent-secondary-dark)'
        }}
        onTouchEnd={e => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = '0 5px 0 var(--accent-secondary-dark), 0 6px 16px rgba(59,130,246,0.25)'
        }}
      >
        {buttonLabel}
      </button>
    </div>
  )
}
