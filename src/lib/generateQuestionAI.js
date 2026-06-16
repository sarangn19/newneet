const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

let lastGeminiCall = 0

async function waitForGeminiSlot() {
  const now = Date.now()
  const gap = 1100 - (now - lastGeminiCall)
  if (gap > 0) await new Promise(r => setTimeout(r, gap))
  lastGeminiCall = Date.now()
}

async function callGroq(systemPrompt, userPrompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() || null
}

async function callGemini(systemPrompt, userPrompt) {
  await waitForGeminiSlot()
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        }),
      }
    )
    if (res.ok) {
      const data = await res.json()
      return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null
    }
    if (res.status === 429 && attempt === 0) {
      await new Promise(r => setTimeout(r, 2000))
      continue
    }
    return null
  }
  return null
}

function parseJSON(text) {
  try { return JSON.parse(text) }
  catch { const m = text.match(/\{[\s\S]*?\}/); if (m) try { return JSON.parse(m[0]) } catch {} }
  return null
}

export async function generateAIRQuestion(topic, topicScores) {
  const score = topicScores?.[topic.id]
  const accuracy = score?.total > 0 ? Math.round((score.correct / score.total) * 100) : null
  const isWeak = accuracy !== null && accuracy < 60
  const isUnattempted = accuracy === null
  const isStrong = accuracy !== null && accuracy >= 80

  const systemPrompt =
`You are a UPSC CSE question generator. Generate EXACTLY ONE multiple choice question about "${topic.name}" for UPSC exam preparation.

Return ONLY a valid JSON object with NO markdown formatting, NO code blocks, NO extra text:
{"q":"question text","options":["A","B","C","D"],"ans":0,"explanation":"detailed explanation"}

The ans field is the 0-based index of the correct option. Make the question test conceptual understanding.`

  const difficulty = isWeak ? 'easy-medium — build confidence and strengthen the core concept' :
    isUnattempted ? 'medium — introduce the topic with a clear foundational question' :
    isStrong ? 'medium-hard — test deeper application-level understanding' :
    'medium — test both conceptual clarity and application'

  const focus = isWeak ? 'Focus on the CORE CONCEPT. Help the student understand the foundation they are missing.' :
    isUnattempted ? 'Introduce the topic with a clear conceptual question that builds interest.' :
    isStrong ? 'Test application-level understanding with a question that requires connecting multiple ideas.' :
    'Test conceptual clarity with a moderate-difficulty question.'

  const userPrompt =
`Generate a UPSC MCQ about "${topic.name}" (${topic.subjectName}).

Student's accuracy on this topic: ${accuracy !== null ? accuracy + '%' : 'not attempted yet'}
Difficulty target: ${difficulty}
Instruction: ${focus}

Requirements:
- Question must be specifically about ${topic.name}
- Pick a different subtopic or angle than the most obvious/common one
- All four options must be plausible but only one correct
- Explanation must clarify WHY the correct answer is right and why the others are wrong
- Keep the question concise (under 25 words if possible)
- Seed: ${Date.now() % 100000}`

  let text = null
  if (GROQ_API_KEY) text = await callGroq(systemPrompt, userPrompt)
  if (!text && GEMINI_API_KEY) text = await callGemini(systemPrompt, userPrompt)

  const parsed = text ? parseJSON(text) : null
  if (parsed && parsed.q && Array.isArray(parsed.options) && parsed.options.length === 4 && typeof parsed.ans === 'number') {
    return { ...parsed, topicId: topic.id, topicName: topic.name, subjectName: topic.subjectName }
  }

  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)](topic)
}

const FALLBACKS = [
  (t) => ({
    q: `Which of the following best describes the principle of 'Separation of Powers' in the Indian Constitution?`,
    options: ['Complete separation between the three organs of government',
              'Functional distinction with a system of checks and balances',
              'Absolute supremacy of the legislature over the other organs',
              'Concentration of all governmental powers in the executive'],
    ans: 1,
    explanation: 'The Indian Constitution provides for separation of powers with functional distinction but incorporates checks and balances, unlike the US system of strict separation.',
    topicId: t.id, topicName: t.name, subjectName: t.subjectName,
  }),
  (t) => ({
    q: `The Indus Valley Civilization was primarily a:`,
    options: ['Rural civilization', 'Urban civilization', 'Pastoral civilization', 'Maritime civilization'],
    ans: 1,
    explanation: 'The IVC was an urban civilization characterized by well-planned cities like Mohenjo-Daro and Harappa with advanced drainage systems and grid layouts.',
    topicId: t.id, topicName: t.name, subjectName: t.subjectName,
  }),
  (t) => ({
    q: `Which of the following is NOT a fundamental right under the Indian Constitution?`,
    options: ['Right to Equality', 'Right to Freedom', 'Right to Property', 'Right to Constitutional Remedies'],
    ans: 2,
    explanation: 'Right to Property was originally a fundamental right but was removed by the 44th Amendment Act, 1978. It is now a legal right under Article 300A.',
    topicId: t.id, topicName: t.name, subjectName: t.subjectName,
  }),
  (t) => ({
    q: `The concept of 'Basic Structure' of the Constitution was propounded in which landmark case?`,
    options: ['A.K. Gopalan v. State of Madras', 'Kesavananda Bharati v. State of Kerala', 'Golaknath v. State of Punjab', 'Minerva Mills v. Union of India'],
    ans: 1,
    explanation: 'The Basic Structure doctrine was established in Kesavananda Bharati (1973), holding that Parliament cannot amend the fundamental structure of the Constitution.',
    topicId: t.id, topicName: t.name, subjectName: t.subjectName,
  }),
  (t) => ({
    q: `Which of the following gases is primarily responsible for the greenhouse effect?`,
    options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
    ans: 2,
    explanation: 'Carbon dioxide is the primary greenhouse gas emitted through human activities. It traps heat in the atmosphere, contributing to global warming.',
    topicId: t.id, topicName: t.name, subjectName: t.subjectName,
  }),
]
