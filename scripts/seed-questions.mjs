import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read .env manually (no dependency needed)
function readEnv() {
  try {
    const text = readFileSync(resolve(__dirname, '..', '.env'), 'utf8')
    const vars = {}
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
    return vars
  } catch { return {} }
}

const env = readEnv()
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
})

// ── Parse questions from questionBank.js ────────────────────────
const src = readFileSync(resolve(__dirname, '..', 'src', 'data', 'questionBank.js'), 'utf8')
const arrays = ['physicsQuestions', 'chemistryQuestions', 'biologyQuestions']
const subjectMap = { physicsQuestions: 'physics', chemistryQuestions: 'chemistry', biologyQuestions: 'biology' }

function parseQuestionObjects(text, arrayName) {
  const subject = subjectMap[arrayName]
  const regex = new RegExp(`export\\s+const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`)
  const match = text.match(regex)
  if (!match) { console.error(`Could not find array ${arrayName}`); return [] }

  const body = match[1]
  const objects = []
  let depth = 0
  let current = ''
  let inString = false
  let escape = false

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (escape) { current += ch; escape = false; continue }
    if (ch === '\\' && inString) { current += ch; escape = true; continue }
    if (ch === '"') { inString = !inString; current += ch; continue }
    if (!inString) {
      if (ch === '{') {
        if (depth === 0) current = ''
        depth++
        current += ch
        continue
      }
      if (ch === '}') {
        depth--
        current += ch
        if (depth === 0) {
          try {
            const parsed = JSON.parse(current)
            objects.push({ ...parsed, subject })
          } catch (e) {
            console.error('JSON parse error:', e.message, current.slice(0, 100))
          }
        }
        continue
      }
    }
    if (depth > 0) current += ch
  }

  return objects
}

function transform(parsed) {
  return {
    subject: parsed.subject,
    chapter: parsed.chapter,
    question: parsed.q,
    option_a: parsed.options[0],
    option_b: parsed.options[1],
    option_c: parsed.options[2],
    option_d: parsed.options[3],
    correct_option: parsed.ans,
    explanation: parsed.explanation || '',
    difficulty: 'medium',
    source: 'questionBank',
    exam_type: 'neet',
  }
}

// ── Seed ────────────────────────────────────────────────────────
async function seed() {
  console.log('Parsing question bank...')
  let total = 0
  let inserted = 0

  for (const name of arrays) {
    const parsed = parseQuestionObjects(src, name)
    const rows = parsed.map(transform)
    total += rows.length
    console.log(`${name}: ${rows.length} questions parsed`)

    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await supabase.from('questions').insert(batch)
      if (error) {
        console.error(`Batch ${i / BATCH + 1} error:`, error.message)
      } else {
        inserted += batch.length
        console.log(`  Inserted ${inserted}/${total}...`)
      }
    }
  }

  console.log(`\nDone! ${inserted} questions inserted.`)
}

seed().catch(err => { console.error(err); process.exit(1) })
