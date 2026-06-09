import { createClient } from '@supabase/supabase-js'

const normalizeEnvValue = (value) => {
  if (typeof value !== 'string') return ''
  let cleaned = value.split('\n')[0].trim()
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  const match = cleaned.match(/^(eyJhbG[^.]*\.eyJ[^.]*\.[^.]+)/)
  if (match) cleaned = match[1]
  return cleaned
}

const isValidUrl = (value) => {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' } catch { return false }
}

const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlldnR3enlnbXBsdXpybHR6ZG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzU2MDcsImV4cCI6MjA5MzA1MTYwN30.2jJguAa9uOubqtWUTlfTB7yTWlE_n_3mYMJR5bOyoL8'

const supabaseUrl = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL)
let supabaseKey = normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY)
const FALLBACK_URL = 'https://ievtwzygmpluzrltzdmr.supabase.co'

if (supabaseKey.length > 150 || !supabaseKey) {
  supabaseKey = FALLBACK_KEY
}
const finalUrl = supabaseUrl || FALLBACK_URL

const hasValidConfig = Boolean(supabaseKey) && isValidUrl(finalUrl)

export const supabaseConfigError = hasValidConfig
  ? ''
  : 'Authentication is not configured correctly. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'

if (!hasValidConfig) {
  console.warn(supabaseConfigError)
}

export const supabase = hasValidConfig
  ? createClient(finalUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

export const hasUsersTable = true
export const hasQuestionsTable = true
export const hasDailyStatsTable = true
export const hasTopicScoresTable = true
export const hasQuestionHistoryTable = true
export const hasRevisionScheduleTable = true
