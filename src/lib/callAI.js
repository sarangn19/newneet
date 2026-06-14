const FALLBACK_RESPONSES = {
  explain: `Topic Overview\n\nThis is an important UPSC topic that requires understanding from multiple angles.\n\nKey Aspects:\n- Focus on definitions and basic concepts first\n- Understand the historical context and evolution\n- Link with current affairs for Mains answers\n- Practice previous year questions on this topic`,
  quiz: `Quiz Time!\n\nQ: What is the primary constitutional basis for this topic?\nA) Article 14\nB) Article 21\nC) Article 32\nD) Article 368\n\nAnswer: Check your notes and try again!`,
  summarise: `Summary\n\nKey Points:\n- Understand the core concept thoroughly\n- Know the constitutional/legal framework\n- Keep up with recent developments\n- Practice answer writing`,
  deepdive: `Deep Dive Analysis\n\nThis topic requires comprehensive understanding across multiple dimensions. Focus on interlinkages with current affairs and other GS papers for a holistic UPSC preparation strategy.`,
}

const requestQueue = []
let processing = false

async function processQueue() {
  if (processing || requestQueue.length === 0) return
  processing = true
  const { resolve } = requestQueue.shift()
  resolve()
  await new Promise(r => setTimeout(r, 1100))
  processing = false
  processQueue()
}

async function waitForSlot() {
  return new Promise(resolve => {
    requestQueue.push({ resolve })
    if (!processing) processQueue()
  })
}

async function fetchWithRetry(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (res.ok) return res
      if (res.status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000))
        continue
      }
      return res
    } catch {
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000))
      else return null
    }
  }
}

export async function callAI({ message, systemPrompt, mode, groqApiKey, geminiApiKey }) {
  let response = ''

  try {
    const apiRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, mode, systemPrompt }),
    })
    if (apiRes.ok) {
      const data = await apiRes.json()
      if (data.response) response = data.response
    }
  } catch {}

  if (!response && groqApiKey) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Topic: ${message}` },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      })
      if (groqRes.ok) {
        const data = await groqRes.json()
        response = data?.choices?.[0]?.message?.content?.trim() || ''
      }
    } catch (e) { console.warn('Groq error:', e) }
  }

  if (!response && geminiApiKey) {
    await waitForSlot()
    try {
      const prompt = `${systemPrompt}\n\nTopic: ${message}`
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        response = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
      }
    } catch (e) { console.warn('Gemini error:', e) }
  }

  if (!response) {
    response = FALLBACK_RESPONSES[mode] || FALLBACK_RESPONSES.explain
  }

  return response
}
