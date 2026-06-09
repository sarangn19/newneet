import { upscMCQs } from '../data/upsc/questions'

// ── PYQ Frequency (Importance) ──
const pyqRaw = {}
upscMCQs.forEach(q => { pyqRaw[q.chapter] = (pyqRaw[q.chapter] || 0) + 1 })
const maxFreq = Math.max(...Object.values(pyqRaw))
const PYQ_IMPORTANCE = {}
Object.keys(pyqRaw).forEach(k => { PYQ_IMPORTANCE[k] = pyqRaw[k] / maxFreq })

export function getImportance(topicId) {
  return PYQ_IMPORTANCE[topicId] || 0.1
}

// ── Forgetting Score ──
export function getForgetting(topicId, revisionSchedule) {
  const entry = revisionSchedule?.[topicId]
  if (!entry?.lastReviewed) return 1.0
  const daysSince = (Date.now() - new Date(entry.lastReviewed).getTime()) / (1000 * 60 * 60 * 24)
  return Math.min(daysSince / 14, 1.0)
}

// ── Weakness Score ──
export function getWeakness(topicId, topicScores) {
  const score = topicScores?.[topicId]
  if (!score || score.total === 0) return 1.0
  const accuracy = score.correct / score.total
  if (accuracy < 0.4) return 0.9
  if (accuracy < 0.5) return 0.75
  if (accuracy < 0.6) return 0.6
  if (accuracy < 0.7) return 0.4
  if (accuracy < 0.8) return 0.25
  return 0.1
}

// ── Priority Score ──
export function calcPriority(topicId, topicScores, revisionSchedule) {
  const importance = getImportance(topicId)
  const forgetting = getForgetting(topicId, revisionSchedule)
  const weakness = getWeakness(topicId, topicScores)
  return { score: importance * forgetting * weakness, importance, forgetting, weakness }
}

// ── Mastery Level ──
export function getMasteryLevel(topicId) {
  const raw = localStorage.getItem('revision_mastery')
  const data = raw ? JSON.parse(raw) : {}
  return data[topicId] || 1
}

export function advanceMastery(topicId, accuracy) {
  const raw = localStorage.getItem('revision_mastery')
  const data = raw ? JSON.parse(raw) : {}
  const current = data[topicId] || 1
  if (accuracy >= 70) {
    data[topicId] = Math.min(current + 1, 4)
  }
  localStorage.setItem('revision_mastery', JSON.stringify(data))
  return data[topicId]
}

// ── Daily Mix (40-30-20-10) ──
export function generateDailyMix(allTopics, topicScores, revisionSchedule, count = 5) {
  const today = new Date().toISOString().slice(0, 10)

  const withPriority = allTopics.map(t => {
    const p = calcPriority(t.id, topicScores, revisionSchedule)
    return { ...t, ...p }
  })

  // Categorize
  const weak = withPriority.filter(t => t.weakness >= 0.6).sort((a, b) => b.score - a.score)
  const forgotten = withPriority.filter(t => t.forgetting >= 0.5 && t.weakness < 0.6).sort((a, b) => b.forgetting - a.forgetting)
  const highYield = withPriority.filter(t => t.importance >= 0.6 && t.weakness < 0.6 && t.forgetting < 0.5).sort((a, b) => b.importance - a.importance)
  const others = withPriority.filter(t =>
    !weak.includes(t) && !forgotten.includes(t) && !highYield.includes(t)
  ).sort((a, b) => Math.random() - 0.5)

  // Daily queue (check localStorage for today's completed)
  const raw = localStorage.getItem('daily_topic_queue')
  const existing = raw ? JSON.parse(raw) : null
  const completed = existing?.date === today ? existing.completed : []

  const pick = (pool, n, takenSet) => pool.filter(t => !takenSet.has(t.id) && !completed.includes(t.id)).slice(0, n)

  const selected = []
  const taken = new Set()

  // 40% weak (2 of 5)
  const w = pick(weak, Math.round(count * 0.4), taken)
  w.forEach(t => { taken.add(t.id); selected.push(t) })

  // 30% forgotten (1-2 of 5)
  const f = pick(forgotten, Math.round(count * 0.3), taken)
  f.forEach(t => { taken.add(t.id); selected.push(t) })

  // 20% high-yield (1 of 5)
  const h = pick(highYield, Math.round(count * 0.2), taken)
  h.forEach(t => { taken.add(t.id); selected.push(t) })

  // 10% random (1 of 5)
  const r = pick(others, Math.max(0, count - selected.length), taken)
  r.forEach(t => { taken.add(t.id); selected.push(t) })

  // Fill remaining slots with highest priority from what's left
  if (selected.length < count) {
    const remaining = withPriority.filter(t => !taken.has(t.id) && !completed.includes(t.id))
      .sort((a, b) => b.score - a.score)
    remaining.slice(0, count - selected.length).forEach(t => { taken.add(t.id); selected.push(t) })
  }

  // Save daily queue
  const queue = { date: today, topicIds: selected.map(t => t.id), completed: [] }
  if (existing?.date === today) queue.completed = existing.completed
  localStorage.setItem('daily_topic_queue', JSON.stringify(queue))

  return selected.slice(0, count)
}

// ── Revision Content Format (based on mastery + day of week) ──
export function getRevisionFormat(masteryLevel, dayOfWeek) {
  const dayFormats = {
    1: { name: 'Flashcards', icon: 'layers', desc: 'Quick recognition' },
    2: { name: 'MCQ Revision', icon: 'check-square', desc: 'Recall & apply' },
    3: { name: 'Mind Maps', icon: 'git-branch', desc: 'Connect concepts' },
    4: { name: 'One-Page Summary', icon: 'file-text', desc: 'Condensed notes' },
    5: { name: 'AI Q&A', icon: 'message-square', desc: 'Deep dive' },
    6: { name: 'Mixed Test', icon: 'zap', desc: 'Comprehensive' },
    0: { name: 'Weekly Review', icon: 'refresh-cw', desc: 'Consolidate' },
  }
  const dayFormat = dayFormats[dayOfWeek] || dayFormats[1]

  const levelFormats = {
    1: { name: 'Recognition', questions: 3, type: 'flashcard' },
    2: { name: 'Recall', questions: 5, type: 'mcq' },
    3: { name: 'Application', questions: 5, type: 'mcq-hard' },
    4: { name: 'Analysis', questions: 1, type: 'mains' },
  }
  const levelFormat = levelFormats[masteryLevel] || levelFormats[1]

  return { dayFormat, levelFormat }
}
