// Vercel serverless function: POST /api/revision
// Calls Gemini API (with Groq fallback) to generate personalized revision content
import { callAI } from './lib/ai.js'

const TOPIC_CONTEXT = {
  'gs1-culture': 'Indian Culture & Heritage — UNESCO sites, classical arts, temple architecture, folk traditions',
  'gs1-ancient': 'Ancient & Medieval History — IVC, Vedic Age, Mauryan, Gupta, Delhi Sultanate, Mughals',
  'gs1-modern': 'Modern Indian History — British rule, reforms, national movement 1857-1947',
  'gs1-freedom': 'Indian Freedom Struggle — movements, leaders, ideologies from 1857 to 1947',
  'gs1-society': 'Indian Society — caste, gender, urbanization, demographic dividend, communalism',
  'gs1-physical': 'Physical Geography — geomorphology, climatology, oceanography, biogeography',
  'gs1-indian-geo': 'Indian Geography — drainage, monsoon, soils, vegetation, resources',
  'gs1-world-geo': 'World Geography — continents, climates, time zones, map locations',
  'gs1-social-iss': 'Social Issues — poverty, unemployment, health, education, human development',
  'gs2-constitution': 'Indian Constitution — Preamble, FR, DPSP, amendments, federalism',
  'gs2-polity': 'Polity & Governance — Parliament, executive, judiciary, elections, federalism',
  'gs2-panchayat': 'Panchayati Raj & Local Govt — 73rd/74th amendments, municipalities, PESA',
  'gs2-judiciary': 'Judiciary — SC, HC, PIL, judicial review, writs, legal framework',
  'gs2-welfare': 'Social Welfare — NFSA, MGNREGA, Ayushman Bharat, POSHAN, welfare schemes',
  'gs2-health': 'Health & Education — NHP, immunization, SDGs, NITI Aayog initiatives',
  'gs2-ir': 'International Relations — UN, SAARC, BIMSTEC, QUAD, foreign policy, diaspora',
  'gs2-bilateral': 'Bilateral Relations — Act East, Neighbourhood First, strategic partnerships',
  'gs2-ngos': 'NGOs & Civil Society — FCRA, regulation, accountability, role in development',
  'gs3-indian-econ': 'Indian Economy — GDP, inflation, fiscal deficit, monetary policy, economic reforms',
  'gs3-banking': 'Banking & Finance — RBI, NPAs, Basel, fintech, digital banking, financial inclusion',
  'gs3-budget': 'Budget & Fiscal Policy — FRBM, direct/indirect tax, GST, revenue vs capital',
  'gs3-agriculture': 'Agriculture — Green Revolution, MSP, PM-KISAN, e-NAM, food security',
  'gs3-science': 'Science & Technology — ISRO, DRDO, biotech, nanotech, AI, space missions',
  'gs3-environment': 'Environment — climate change, COP, UNFCCC, carbon footprint, conservation',
  'gs3-biodiversity': 'Biodiversity — National Parks, wildlife sanctuaries, biosphere reserves, REDD+',
  'gs3-disaster': 'Disaster Management — NDMA, disaster cycle, EIA, Sendai Framework',
  'gs3-security': 'Internal Security — Naxalism, insurgency, cyber threats, border security',
  'gs3-cyber': 'Cyber Security — cyber crime, IT Act, CERT-In, data protection, digital security',
  'gs4-ethics': 'Ethics & Integrity — ethical theories, moral reasoning, values in public life',
  'gs4-attitude': 'Attitude & Moral Reasoning — cognitive dissonance, attitude formation, moral development',
  'gs4-aptitude': 'Aptitude & Foundational Values — civil service ethos, impartiality, integrity',
  'gs4-emotional': 'Emotional Intelligence — self-awareness, empathy, management, EI models',
  'gs4-philosophers': 'Thinkers & Philosophers — Aristotle, Kant, Mill, Rawls, Gandhi',
  'gs4-case-studies': 'Case Studies — ethical dilemmas, conflict of interest, whistleblowing',
  'gs4-probity': 'Probity in Governance — transparency, RTI, Lokpal, corruption, accountability',
  'gs4-civil-service': 'Civil Service Values — code of conduct, ethics, service rules, neutrality',
  'essay-tech': 'Essay: Technology & Development',
  'essay-social': 'Essay: Social Issues & Justice',
  'essay-political': 'Essay: Political & Governance',
  'essay-philosophy': 'Essay: Philosophical & Abstract',
  'essay-env': 'Essay: Environment & Society',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { topicId, topicName, subjectName, accuracy, questionsDone } = req.body

  if (!topicName) {
    return res.status(400).json({ error: 'topicName is required' })
  }

  const context = TOPIC_CONTEXT[topicId] || `${topicName} — ${subjectName || 'UPSC topic'}`

  // Build prompt for AI
  const prompt = `You are a UPSC CSE mentor. Generate personalized revision notes for the topic "${topicName}" (context: ${context}).

Student Performance:
- Questions Attempted: ${questionsDone || 0}
- Accuracy: ${accuracy !== undefined ? accuracy + '%' : 'N/A'}

Focus Level based on accuracy:
${accuracy < 40 ? 'CRITICAL: Student needs foundational understanding. Explain basics first.' : accuracy < 60 ? 'INTERMEDIATE: Student has partial understanding. Clear misconceptions.' : 'ADVANCED: Student has good understanding. Provide exam-level insights.'}

Return ONLY a JSON object:
{
  "keyPoints": ["6 concise key concepts with brief explanation"],
  "commonMistakes": ["5 specific mistakes to avoid for this UPSC topic"],
  "examTips": ["4 exam-specific tips tailored to accuracy level"],
  "mnemonics": ["3 memory aids for this topic"],
  "practiceSuggestions": "2-3 sentence actionable practice plan"
}`

  const systemPrompt = `You are a UPSC CSE mentor generating revision notes. Always respond with valid JSON only.`

  const result = await callAI(systemPrompt, prompt, 0.7, 1024)

  if (result.text) {
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return res.json({ source: result.source, ...parsed })
      }
    } catch (e) { /* parse failed */ }
  }

  // Fallback content
  return res.json({
    source: 'fallback',
    keyPoints: [
      `**${topicName}**: Master the core concepts for UPSC CSE.`,
      `**Constitutional/Legal Basis**: Understand the framework governing this area.`,
      `**Current Affairs Linkage**: Connect ${topicName} with recent developments.`,
      `**Comparative Analysis**: Compare Indian context with global perspectives.`,
      `**Exam-Focused Approach**: Prioritize high-weightage subtopics.`,
    ],
    commonMistakes: [
      'Overlooking basic definitions and classifications',
      'Not linking topics with current affairs',
      'Memorizing without understanding concepts',
    ],
    examTips: [
      'Revise with a timer to simulate exam conditions',
      'Focus on weak areas identified from practice tests',
      'Use daily answer writing practice for Mains',
    ],
    mnemonics: ['Create visual mind maps', 'Use acronym chains for lists'],
    practiceSuggestions: `Continue practicing MCQs and answer writing on ${topicName}. Target 70%+ accuracy before moving to the next topic.`,
  })
}
