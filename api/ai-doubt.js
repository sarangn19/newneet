import { callAI } from './lib/ai.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { noteContext, question } = req.body || {}
  if (!question) return res.status(400).json({ error: 'Missing question' })

  const systemPrompt = 'You are a UPSC CSE mentor. Answer concisely with plain text - no stars, no hashes, no markdown.'
  const userPrompt = 'Note context:\n' + (noteContext || '').slice(0, 3000) + '\n\nUser doubt: ' + question

  const result = await callAI(systemPrompt, userPrompt, 0.7, 512)
  return res.status(200).json({ text: result.text || 'Could not generate response.', source: result.source })
}
