// Smart revision content generator
// Uses Gemini API if available, falls back to performance-driven templates

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

let lastGeminiCall = 0

async function fetchGeminiWithRetry(body, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const now = Date.now()
    const wait = Math.max(0, 1100 - (now - lastGeminiCall))
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    lastGeminiCall = Date.now()
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
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

const TOPIC_DETAILS = {
  'gs1-culture': { keywords: ['UNESCO', 'tangible heritage', 'intangible heritage', 'classical dance', 'folk art'], commonMistakes: ['Confusing classical vs folk dance forms', 'Mixing up temple architecture styles'] },
  'gs1-ancient': { keywords: ['IVC', 'Vedic age', 'Mauryan', 'Gupta', 'sangam'], commonMistakes: ['IVC and Vedic chronology', 'Mixing Buddhist and Jain councils'] },
  'gs1-modern': { keywords: ['1757', '1857', 'INC', 'partition', 'national movement'], commonMistakes: ['Chronology of acts and reforms', 'Dates of important congress sessions'] },
  'gs1-freedom': { keywords: ['Jallianwala', 'Quit India', 'Non-Cooperation', 'Civil Disobedience'], commonMistakes: ['Sequence of movements', 'Leaders associated with each movement'] },
  'gs1-society': { keywords: ['caste', 'gender', 'urbanization', 'demographic dividend'], commonMistakes: ['Development vs welfare indicators', 'NSSO vs Census data confusion'] },
  'gs1-physical': { keywords: ['geomorphic processes', 'climatology', 'oceanography', 'biogeography'], commonMistakes: ['Plate tectonic theory confusion', 'Types of rocks and their formation'] },
  'gs1-indian-geo': { keywords: ['drainage system', 'monsoon', 'soil types', 'natural vegetation'], commonMistakes: ['River systems and their origins', 'Soil types and distribution'] },
  'gs1-world-geo': { keywords: ['latitudes', 'longitudes', 'time zones', 'climate zones'], commonMistakes: ['Map locations', 'Climate type classification'] },
  'gs1-social-iss': { keywords: ['poverty', 'unemployment', 'education', 'health indicators'], commonMistakes: ['Government scheme names vs objectives', 'International indices confusion'] },
  'gs2-constitution': { keywords: ['preamble', 'fundamental rights', 'DPSP', 'amendments'], commonMistakes: ['Article numbers', 'Difference between FR and DPSP', 'Writ types'] },
  'gs2-polity': { keywords: ['parliament', 'executive', 'judiciary', 'federalism'], commonMistakes: ['Powers of President vs PM', 'Rajya Sabha vs Lok Sabha powers'] },
  'gs2-panchayat': { keywords: ['73rd amendment', '74th amendment', 'PESA', 'municipalities'], commonMistakes: ['73rd vs 74th amendment provisions', 'Schedule areas vs tribal areas'] },
  'gs2-judiciary': { keywords: ['SC', 'HC', 'PIL', 'judicial review', 'writ jurisdiction'], commonMistakes: ['Jurisdiction of SC vs HC', 'Types of writs and their scope'] },
  'gs2-welfare': { keywords: ['NFSA', 'MGNREGA', 'Ayushman Bharat', 'POSHAN'], commonMistakes: ['Scheme implementing ministries', 'Funding patterns (central vs state)'] },
  'gs2-health': { keywords: ['NHP', 'immunization', 'NITI Aayog', 'SDG goals'], commonMistakes: ['Health indices rankings', 'Scheme launch years'] },
  'gs2-ir': { keywords: ['UN', 'SAARC', 'BIMSTEC', 'Quad', 'foreign policy'], commonMistakes: ['International organization headquarters', 'India\'s bilateral relations chronology'] },
  'gs2-bilateral': { keywords: ['Look East', 'Act East', 'Neighbourhood First', ' diaspora'], commonMistakes: ['Regional groupings and member countries', 'Summit locations'] },
  'gs2-ngos': { keywords: ['FCRA', 'NGO regulation', 'civil society', 'accountability'], commonMistakes: ['Registration requirements', 'Foreign funding rules'] },
  'gs3-indian-econ': { keywords: ['GDP', 'inflation', 'fiscal deficit', 'monetary policy'], commonMistakes: ['Real vs nominal GDP', 'Revenue vs fiscal deficit', 'CPI vs WPI'] },
  'gs3-banking': { keywords: ['RBI', 'NPAs', 'Basel norms', 'fintech', 'digital banking'], commonMistakes: ['Repo vs reverse repo rate', 'Types of banks and their functions'] },
  'gs3-budget': { keywords: ['budget', 'FRBM', 'direct tax', 'indirect tax', 'GST'], commonMistakes: ['Revenue vs capital expenditure', 'Tax vs non-tax revenue', 'GST council composition'] },
  'gs3-agriculture': { keywords: ['Green Revolution', 'PM-KISAN', ' MSP', 'e-NAM', 'subsidies'], commonMistakes: ['Crop seasons (Kharif vs Rabi)', 'Agricultural schemes and their beneficiaries'] },
  'gs3-science': { keywords: ['ISRO', 'DRDO', 'biotechnology', 'nanotechnology', 'AI'], commonMistakes: ['Space missions and their objectives', 'Scientific organizations and their parent ministries'] },
  'gs3-environment': { keywords: ['climate change', 'COP', 'UNFCCC', 'carbon footprint'], commonMistakes: ['Environmental conventions and their years', 'Protocols vs treaties'] },
  'gs3-biodiversity': { keywords: ['National Parks', 'wildlife sanctuaries', 'biosphere reserves', 'REDD+'], commonMistakes: ['Protected area categories', 'Flagship vs keystone species'] },
  'gs3-disaster': { keywords: ['NDMA', 'disaster cycle', 'EIA', 'Sendai Framework'], commonMistakes: ['Disaster types (natural vs man-made)', 'NDMA vs NDRF roles'] },
  'gs3-security': { keywords: ['internal security', 'Naxalism', 'insurgency', 'cyber threats'], commonMistakes: ['Internal security threats classification', 'Paramilitary forces and their roles'] },
  'gs3-cyber': { keywords: ['cyber crime', 'IT Act', 'CERT-In', 'data protection'], commonMistakes: ['IT Act sections', 'Types of cyber crimes and applicable laws'] },
  'gs4-ethics': { keywords: ['ethics', 'morality', 'values', 'integrity', 'accountability'], commonMistakes: ['Ethics vs morality distinction', 'Applying ethical theories to case studies'] },
  'gs4-attitude': { keywords: ['moral reasoning', 'cognitive dissonance', 'attitude formation'], commonMistakes: ['Attitude vs aptitude', 'Theories of moral development (Kohlberg)'] },
  'gs4-aptitude': { keywords: ['aptitude', 'foundational values', 'civil service ethos'], commonMistakes: ['Difference between aptitude and attitude', 'Values for civil service'] },
  'gs4-emotional': { keywords: ['emotional intelligence', 'self-awareness', 'empathy', 'management'], commonMistakes: ['EI models (Goleman vs Bar-On)', 'EI vs IQ distinctions'] },
  'gs4-philosophers': { keywords: ['Aristotle', 'Kant', 'Mill', 'Rawls', 'Gandhi'], commonMistakes: ['Mixing up philosophers and their theories', 'Applying frameworks incorrectly'] },
  'gs4-case-studies': { keywords: ['ethical dilemma', 'conflict of interest', 'whistleblowing'], commonMistakes: ['Jumping to conclusions without ethical analysis', 'Ignoring stakeholder mapping'] },
  'gs4-probity': { keywords: ['probity', 'transparency', 'RTI', 'ombudsman', 'corruption'], commonMistakes: ['Lokpal vs CVC jurisdiction', 'RTI act provisions'] },
  'gs4-civil-service': { keywords: ['code of conduct', 'code of ethics', 'service rules', 'neutrality'], commonMistakes: ['Code of conduct vs code of ethics', 'Political neutrality vs committed bureaucracy'] },
  'essay-tech': { keywords: ['technology', 'development', 'innovation', 'digital divide'], commonMistakes: ['Too many examples without analysis', 'Lack of structure in essay'] },
  'essay-social': { keywords: ['social justice', 'equality', 'inclusion', 'rights'], commonMistakes: ['One-sided arguments', 'Lack of data/evidence'] },
  'essay-political': { keywords: ['governance', 'democracy', 'constitution', 'accountability'], commonMistakes: ['Overly descriptive rather than analytical', 'Missing contemporary references'] },
  'essay-philosophy': { keywords: ['philosophy', 'abstract', 'ethics', 'human values'], commonMistakes: ['Being too abstract without concrete examples', 'Losing focus on the topic'] },
  'essay-env': { keywords: ['environment', 'sustainability', 'conservation', 'development'], commonMistakes: ['Development vs environment binary', 'Lack of Indian context'] },
}

export async function generateRevisionContent(topic, examType = 'upsc') {
  const details = TOPIC_DETAILS[topic.id]
  const accuracy = topic.accuracy !== undefined ? topic.accuracy : 0
  const questionsDone = topic.total || 0

  // Try Gemini first if API key is available
  if (GEMINI_API_KEY) {
    try {
      const prompt = `You are a UPSC CSE mentor. Generate personalized revision notes for the topic "${topic.name}" (subject: ${topic.subjectName}).

Student's performance data:
- Questions attempted: ${questionsDone}
- Accuracy: ${accuracy}%

Focus areas based on accuracy:
${accuracy < 40 ? '- Student is struggling with basics. Provide foundational concepts first.' : accuracy < 60 ? '- Student has partial understanding. Focus on clearing misconceptions and strengthening weak areas.' : '- Student has decent understanding. Provide advanced insights and exam-specific tips.'}

Return a JSON object with exactly these fields:
{
  "keyPoints": ["array of 5-6 key concepts with brief explanation"],
  "commonMistakes": ["array of 4-5 mistakes to avoid"],
  "examTips": ["array of 3-4 exam-specific tips"],
  "mnemonics": ["array of 2-3 memory aids"],
  "practiceSuggestions": "2-3 sentence suggestion on what to practice"
}

Make it concise, actionable, and tailored to the student's performance level. Use bullet-style points in the arrays. Return ONLY valid JSON.`

      const res = await fetchGeminiWithRetry({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      })
      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed
      }
    } catch (e) {
      console.warn('Gemini API failed, using fallback:', e)
    }
  }

  return generateFallbackContent(topic, accuracy, details)
}

function generateFallbackContent(topic, accuracy, details) {
  const questionsDone = topic.total || 0
  const k = details?.keywords || ['key concept']
  const m = details?.commonMistakes || ['Review the topic thoroughly']

  const keyPoints = k.slice(0, 5).map(kw =>
    `**${kw}**: Focus on understanding this core concept thoroughly. It frequently appears in UPSC Prelims and Mains.`
  )

  const commonMistakes = accuracy < 60
    ? m.slice(0, 4).map(mm => `${mm} — be especially careful here.`)
    : m.slice(0, 3).map(mm => `Avoid: ${mm}`)

  const examTips = accuracy < 40
    ? [
        'Start with NCERT basics for this topic before moving to advanced sources.',
        'Create a one-page summary with key dates, names, and definitions.',
        'Practice at least 20 MCQs on this topic to build confidence.',
      ]
    : accuracy < 60
    ? [
        'Focus on conceptual clarity — understand the "why" behind each fact.',
        'Link this topic with current affairs for Mains answers.',
        'Practice answer writing — 150-word answers on key aspects.',
      ]
    : [
        'Deep dive into interlinkages with other GS papers.',
        'Practice advanced-level questions from previous years.',
        'Focus on value-addition — quotes, data, committees.',
      ]

  const mnemonics = accuracy < 60
    ? ['Create your own mnemonics using the first letter of each key point.',
       'Use visual memory — draw mind maps connecting related concepts.']
    : ['Use acronym chains to remember lists and sequences.',
       'Associate abstract concepts with real-world examples.']

  const practiceSuggestions = accuracy < 40
    ? `Start with ${questionsDone > 0 ? questionsDone + 10 : 15} easy MCQs on ${topic.name}. Focus on definitions and basic concepts first.`
    : accuracy < 60
    ? `Attempt ${Math.max(20, questionsDone)} MCQs mixing easy and medium difficulty. Review explanations for every wrong answer.`
    : `Practice ${Math.max(15, questionsDone)} advanced MCQs and write 2-3 Mains-style answers on ${topic.name}.`

  return { keyPoints, commonMistakes, examTips, mnemonics, practiceSuggestions }
}
