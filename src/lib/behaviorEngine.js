// Behavior Engine v2 — translates student profile into AI behavior instructions
// No student data reaches the LLM. Only natural-language behavior rules.

const DAY = 86400000
const SCAFFOLD_LEVELS = {
  1: { label: 'foundational concepts and simple explanations', check: 'Ask a simple comprehension check after.' },
  2: { label: 'structured teaching with hierarchy and examples', check: 'Ask the student to explain the concept back.' },
  3: { label: 'broader frameworks, interlinkages and application', check: 'Ask an application-level question.' },
}

function computeScaffoldLevel(profile, topicId) {
  const topic = (profile.topicAccs || []).find(t => t.id === topicId)
  if (!topic) return 0
  const accuracy = (topic.accuracy || 50) / 100
  const accuracyScore = Math.max(0, Math.round((1 - accuracy * 1.5) * 10) / 10)
  const lastAttempted = profile.topicScores?.[topicId]?.lastAttempted
  let daysSince = 999
  if (lastAttempted) daysSince = Math.floor((Date.now() - new Date(lastAttempted).getTime()) / DAY)
  const recencyScore = Math.min(1, Math.round((daysSince / 60) * 10) / 10)
  const confidenceScore = Math.min(1, (topic.total || 0) / 20)
  const intensity = Math.round((accuracyScore * 0.5 + recencyScore * 0.3 + confidenceScore * 0.2) * 10) / 10
  return Math.min(1, Math.max(0, intensity))
}

export function createSession() {
  return {
    behaviorsFired: new Map(),
    topicDepth: new Map(),
    skillStrategyGiven: new Set(),
    strugglingAcknowledged: false,
    exchangeCount: 0,
    createdAt: Date.now(),
  }
}

function getInteractionMode(profile) {
  if (!profile) return 'UNKNOWN'
  const tq = (profile.overall?.totalQuestions || 0)
  if (tq < 20) return 'UNKNOWN'
  if (tq < 100) return 'EMERGING'
  return 'ESTABLISHED'
}

function trustFilter(behaviorName) {
  const rules = {
    SCAFFOLD:    { safety: 1, agency: 1, growth: 1 },
    DEEPEN:      { safety: 1, agency: 0, growth: 1 },
    CALIBRATE:   { safety: 0, agency: 1, growth: 1 },
    ENCOURAGE:   { safety: 1, agency: 0, growth: 1 },
    STRATEGIZE:  { safety: 1, agency: 0, growth: 1 },
    REFRESH:     { safety: 1, agency: 1, growth: 0 },
    SUPPORT:     { safety: 1, agency: 0, growth: 0 },
    PROGRESS:    { safety: 1, agency: 1, growth: 1 },
    CELEBRATE:   { safety: 1, agency: 0, growth: 1 },
    STRATEGY_CHECK: { safety: 1, agency: 1, growth: 1 },
  }
  const r = rules[behaviorName]
  return r ? (r.safety + r.agency + r.growth) >= 2 : true
}

function getModeBehaviorFilter(modeId) {
  const defaults = { activated: [], suppressed: [] }
  const map = {
    explain: {
      suppressed: ['CALIBRATE'],
    },
    quiz: {
      suppressed: ['SCAFFOLD', 'DEEPEN', 'REFRESH'],
    },
    summarise: {
      activated: ['REFRESHER'],
      suppressed: ['SCAFFOLD', 'CALIBRATE', 'ENCOURAGE', 'DEEPEN', 'STRATEGIZE', 'REFRESH'],
    },
    deepdive: {
      suppressed: ['REFRESH'],
    },
  }
  return map[modeId] || defaults
}

export function buildRules(profile, session, lastMessage, modeId) {
  const rules = []
  const mode = getInteractionMode(profile)
  const modeFilter = getModeBehaviorFilter(modeId)
  if (mode === 'UNKNOWN') return rules
  if (mode === 'EMERGING') {
    const baseRules = buildEmergingRules(profile, session)
    const count = 0
    for (const r of baseRules) {
      if (count >= 1) break
      rules.push(r); rules.push('PRIORITY: Place these instructions above the main prompt. Keep responses supportive and simple.')
    }
    return rules
  }

  const candidates = []

  // P1 — SAFETY
  if (detectStruggle(lastMessage) && !session.strugglingAcknowledged) {
    candidates.push({ name: 'ACKNOWLEDGE_STRUGGLE', priority: 1,
      text: 'If the student expresses doubt or frustration, normalize it without dismissing their concern. Offer to continue or take a break — their choice.' })
  }

  // P2 — STATE
  if (profile.trend === 'declining' && (profile.overall?.totalQuestions || 0) > 20) {
    candidates.push({ name: 'SUPPORT', priority: 2,
      text: 'LEAD: Start with encouraging, achievable questions. Build confidence gradually. Do not reference trends, percentages, or declines.' })
  }
  if (profile.calibration?.bias === 'overconfident' && !session.behaviorsFired.has('calibrate')) {
    candidates.push({ name: 'CALIBRATE', priority: 2,
      text: 'PROBE: On any incorrect answer, ask "What led you to that choice?" At most once per session. Never label the student.' })
  }
  if (profile.calibration?.bias === 'underconfident' && !session.behaviorsFired.has('encourage')) {
    candidates.push({ name: 'ENCOURAGE', priority: 2,
      text: 'AFFIRM: When the student answers correctly, acknowledge it. If they express doubt, say "You\'ve got this right." At most once per session.' })
  }

  // P3 — SCAFFOLD (adaptive intensity, computed fresh each session)
  if ((profile.weakTopics?.length || 0) > 0 && !session.behaviorsFired.has('scaffold')) {
    for (const t of profile.weakTopics || []) {
      const intensity = computeScaffoldLevel(profile, t.id)
      if (intensity < 0.2) continue
      const level = intensity >= 0.7 ? 1 : intensity >= 0.4 ? 2 : 3
      candidates.push({ name: 'SCAFFOLD', priority: 3,
        text: `SCAFFOLD(L${level}): For topic [${t.id}], use ${SCAFFOLD_LEVELS[level].label}. ${SCAFFOLD_LEVELS[level].check} Do not reference accuracy.` })
      break
    }
  }
  // P3 — REFRESHER (stale topics that haven't been practiced in >30 days)
  if (!session.behaviorsFired.has('refresher') && profile.topicAccs?.length) {
    const weakIds = new Set((profile.weakTopics || []).map(t => t.id))
    for (const t of profile.topicAccs) {
      if (t.total < 5) continue
      if (weakIds.has(t.id) && modeId !== 'summarise') continue
      const last = profile.topicScores?.[t.id]?.lastAttempted
      if (!last) continue
      const daysSince = Math.floor((Date.now() - new Date(last).getTime()) / DAY)
      if (daysSince > 30) {
        candidates.push({ name: 'REFRESHER', priority: 3,
          text: `REFRESHER: If the user asks about [${t.id}], start with a brief refresher before diving deeper.` })
        break
      }
    }
  }
  // P3 — DEEPEN
  if ((profile.strongTopics?.length || 0) > 0 && !session.behaviorsFired.has('deepen')) {
    candidates.push({ name: 'DEEPEN', priority: 3,
      text: 'DEEPEN: When the student asks about a topic they know well, provide advanced analysis, interlinkages and critical framing. Challenge them.' })
  }
  // P3 — STRATEGIZE
  if ((profile.skills?.filter(s => s.accuracy < 60).length || 0) > 0 && !session.behaviorsFired.has('strategize')) {
    candidates.push({ name: 'STRATEGIZE', priority: 3,
      text: 'STRATEGIZE: When the question type matches a skill where the student needs improvement, suggest a solving approach before they answer. Do not reference accuracy.' })
  }
  // P3 — REFRESH (review offer)
  const needsRefresh = (profile.decayingChapters || 0) + (profile.overdueRevisions || 0) > 0
  if (needsRefresh && !session.behaviorsFired.has('refresh')) {
    candidates.push({ name: 'REFRESH', priority: 3,
      text: 'OFFER: At the first natural moment, offer: "I can mix in review questions or focus on new material — your call." Do not mention time elapsed.' })
  }

  // P4 — EVENT (progress, celebrate, strategy_check)
  if (detectProgressQuery(lastMessage)) {
    candidates.push({ name: 'PROGRESS', priority: 4,
      text: 'FEEDBACK: Student is asking about their progress. Give directional feedback only: areas of strength, areas with most room to grow, and one actionable next step. No percentages, no labels, no comparisons.' })
  }

  // Mode filter: remove suppressed behaviors per mode
  const filtered = modeFilter.suppressed.length
    ? candidates.filter(c => !modeFilter.suppressed.includes(c.name))
    : candidates

  // Select: up to P1 + 2 P2 + rest P3+P4, max 4 total
  const selected = []
  const p1 = filtered.find(c => c.priority === 1)
  if (p1) { selected.push(p1); session.strugglingAcknowledged = true }
  const p2 = filtered.filter(c => c.priority === 2)
  for (const c of p2) {
    if (selected.length >= 3) break
    selected.push(c)
  }
  const p3 = filtered.filter(c => c.priority === 3)
  for (const c of p3) {
    if (selected.length >= 4) break
    selected.push(c)
  }
  const p4 = filtered.filter(c => c.priority === 4)
  for (const c of p4) {
    if (selected.length >= 4) break
    selected.push(c)
  }

  // Apply trust filter
  for (const c of selected) {
    if (!trustFilter(c.name)) continue
    session.behaviorsFired.set(c.name, Date.now())
    rules.push(c.text)
  }

  return rules
}

export function formatPrompt(basePrompt, rules) {
  if (rules.length === 0) return basePrompt
  return '[BEHAVIOR]\n' + rules.join('\n') + '\n\n' + basePrompt
}

function buildEmergingRules(profile, session) {
  const r = []
  if (profile.weakTopics?.length > 0) {
    r.push('EXPLAIN: Provide clear, structured explanations. Check understanding frequently.')
  }
  return r
}

function detectStruggle(msg) {
  const words = msg.toLowerCase()
  return /(?:i don't understand|confus|frustrat|too hard|can't do|give up|never|not improving|hopeless|struggl|stress|overwhelm)/.test(words)
}

function detectProgressQuery(msg) {
  const words = msg.toLowerCase()
  return /(?:how am i doing|am i on track|my progress|how is my|am i ready|how am i performing|tell me about my|what are my weak|what are my strong)/.test(words)
}


