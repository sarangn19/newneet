export const colors = {
  primary: 'var(--primary)',
  primaryDark: 'var(--primary-dark)',
  primaryLight: 'var(--primary-light)',
  text: 'var(--text)',
  textSecondary: 'var(--text-2)',
  textMuted: 'var(--text-3)',
  border: 'var(--border)',
  borderLight: 'var(--border)',
  bg: 'var(--page-bg)',
  surface: 'var(--surface-alt)',
  success: 'var(--success)',
  successLight: 'var(--success-light)',
  error: 'var(--error)',
  errorLight: 'var(--error-light)',
  warning: 'var(--warning)',
  warningLight: 'var(--warning-light)',
  purple: '#7C3AED',
  purpleLight: 'rgba(124,58,237,0.1)',
  cardBg: 'var(--card-bg)',
  white: '#ffffff',
}

export const card = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
}

export const cardHover = {
  y: -1,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
}

export const spring = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
}

export const spacing = {
  header: '48px 16px 12px',
  container: '16px',
  cardBody: 16,
  cardBodySmall: 12,
}

export const font = {
  pageTitle: { fontSize: 20, fontWeight: 700, color: colors.text },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: colors.text },
  cardTitle: { fontSize: 12, fontWeight: 600, color: colors.text },
  body: { fontSize: 12, color: colors.textSecondary },
  small: { fontSize: 10, color: colors.textMuted },
  muted: { fontSize: 11, color: colors.textMuted },
  label: { fontSize: 11, fontWeight: 600 },
}

export const btn = {
  primary: {
    padding: '12px 20px', borderRadius: 10, border: 'none',
    background: colors.primary, color: colors.white,
    fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(63,125,255,0.25)',
  },
  secondary: {
    padding: '12px 20px', borderRadius: 10, border: '1.5px solid #e5e7eb',
    background: '#fff', color: '#333',
    fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  },
  small: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: colors.primary, color: colors.white,
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
  },
}
