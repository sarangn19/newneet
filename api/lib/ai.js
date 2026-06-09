import { generateText } from 'ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

async function callGemini(prompt, temperature = 0.7, maxTokens = 1024) {
  if (!GEMINI_API_KEY) return null
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  })
  if (resp.status === 429) return null
  if (!resp.ok) return null
  const data = await resp.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
}

async function callGroq(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 1024) {
  if (!GROQ_API_KEY) return null
  const url = 'https://api.groq.com/openai/v1/chat/completions'
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })
  if (resp.status === 429) return null
  if (!resp.ok) return null
  const data = await resp.json()
  return data?.choices?.[0]?.message?.content?.trim() || null
}

async function callAIGateway(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 1024) {
  if (!process.env.VERCEL_OIDC_TOKEN) return null
  try {
    const { text } = await generateText({
      model: 'groq/llama-3.3-70b-versatile',
      system: systemPrompt,
      prompt: userPrompt,
      temperature,
      maxTokens,
    })
    return text || null
  } catch { return null }
}

async function callAI(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 1024) {
  const gatewayResult = await callAIGateway(systemPrompt, userPrompt, temperature, maxTokens)
  if (gatewayResult) return { text: gatewayResult, source: 'gateway' }
  const groqResult = await callGroq(systemPrompt, userPrompt, temperature, maxTokens)
  if (groqResult) return { text: groqResult, source: 'groq' }
  const combinedPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt
  const geminiResult = await callGemini(combinedPrompt, temperature, maxTokens)
  if (geminiResult) return { text: geminiResult, source: 'gemini' }
  return { text: null, source: 'none' }
}

export { callAI, callGemini, callGroq }
