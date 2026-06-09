import { callAI } from './lib/ai.js'

const MODE_PROMPTS = {
  explain: `You are a UPSC CSE mentor. Explain the given topic in detail with a structured breakdown including definition, key features, historical background, contemporary relevance, and exam perspective. Use plain text only - no stars, no hashes, no markdown. Use numbered sections and dashes for lists.`,
  quiz: `You are a UPSC CSE mentor. Generate a multiple-choice quiz question on the given topic. Include 4 options (A, B, C, D) and indicate the correct answer after the question. Use plain text only - no stars, no hashes, no markdown.`,
  summarise: `You are a UPSC CSE mentor. Provide a concise summary of the given topic covering key points, must-know facts, and UPSC angle. Use dashes for bullet points, no stars, no hashes, no markdown.`,
  deepdive: `You are a UPSC CSE mentor. Provide a comprehensive deep dive analysis of the given topic covering multiple dimensions (historical, constitutional, administrative, social, economic), case studies, critical analysis, and interlinkages with other GS papers. Use plain text only - no stars, no hashes, no markdown.`,
}

const FALLBACK = {
  explain: 'Topic Overview\n\nThis is an important UPSC topic. Focus on definitions, historical context, and link with current affairs for Mains answers.',
  quiz: 'Quiz Time\n\nQ: What is the primary constitutional basis for this topic?\nA) Article 14\nB) Article 21\nC) Article 32\nD) Article 368',
  summarise: 'Summary\n\nUnderstand the core concept, constitutional framework, recent developments, and practice answer writing.',
  deepdive: 'Deep Dive Analysis\n\nThis topic requires comprehensive understanding across multiple dimensions. Focus on interlinkages with current affairs.',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, mode, behaviorRules } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })

  const modeKey = mode || 'explain'
  let systemPrompt = MODE_PROMPTS[modeKey] || MODE_PROMPTS.explain
  if (behaviorRules) {
    systemPrompt = '[BEHAVIOR]\n' + behaviorRules.split('||').join('\n') + '\n\n' + systemPrompt
  }
  const userPrompt = `Topic: ${message}`

  const result = await callAI(systemPrompt, userPrompt, 0.7, 1280)

  const response = result.text || (FALLBACK[modeKey] || FALLBACK.explain)

  return res.json({ response, source: result.source })
}
