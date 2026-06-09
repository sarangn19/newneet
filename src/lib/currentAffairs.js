function guessCategory(title, summary) {
  const t = (title + ' ' + summary).toLowerCase()
  if (t.includes('econom') || t.includes('gdp') || t.includes('budget') || t.includes('fiscal') || t.includes('inflation') || t.includes('rbi') || t.includes('market')) return 'Economy'
  if (t.includes('pollut') || t.includes('climate') || t.includes('forest') || t.includes('wildlife') || t.includes('emission') || t.includes('green') || t.includes('environment')) return 'Environment'
  if (t.includes('isro') || t.includes('space') || t.includes('nuclear') || t.includes('vaccine') || t.includes('tech') || t.includes('digital') || t.includes('science') || t.includes('ai ')) return 'Science'
  if (t.includes('un ') || t.includes('china') || t.includes('us ') || t.includes('russia') || t.includes('uk ') || t.includes('diplomat') || t.includes('treaty') || t.includes('saarc') || t.includes('bilateral')) return 'International'
  if (t.includes('supreme') || t.includes('election') || t.includes('bill') || t.includes('parliament') || t.includes('amendment') || t.includes('judgment') || t.includes('constitution')) return 'Polity'
  return 'Polity'
}

function extractTags(text) {
  const words = text.split(' ').slice(0, 10)
  const tags = []
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z]/g, '')
    if (clean.length > 4 && !tags.includes(clean) && !['this','that','with','from','have','been','their','which','will','what','about'].includes(clean.toLowerCase())) {
      tags.push(clean)
    }
    if (tags.length >= 3) break
  }
  return tags.length > 0 ? tags : ['India', 'UPSC']
}

function getMockArticles() {
  return [
    { date: '2026-05-17', category: 'Economy', title: "India's GDP growth projected at 7.2% for FY26", summary: 'IMF projects India\'s GDP growth at 7.2% for FY 2025-26, making India the fastest-growing major economy.', source: 'Economic Survey', link: '' },
    { date: '2026-05-16', category: 'Polity', title: 'Supreme Court upholds right to privacy as fundamental right', summary: 'Supreme Court reaffirmed that right to privacy is an intrinsic part of Article 21.', source: 'SC India', link: '' },
    { date: '2026-05-15', category: 'Environment', title: 'India pledges net-zero emissions by 2070', summary: 'At the COP Summit, India announced an updated target to achieve net-zero carbon emissions by 2070.', source: 'MoEFCC', link: '' },
    { date: '2026-05-14', category: 'Science', title: 'ISRO successfully launches GSLV-Mk III', summary: 'ISRO\'s GSLV-Mk III successfully placed a next-gen communication satellite in geostationary orbit.', source: 'ISRO', link: '' },
    { date: '2026-05-13', category: 'Polity', title: 'One Nation One Election bill introduced in Parliament', summary: 'Government introduced Constitution Amendment Bill for simultaneous elections.', source: 'Lok Sabha', link: '' },
    { date: '2026-05-12', category: 'International', title: 'India assumes presidency of UN Security Council', summary: 'India began month-long presidency of UN Security Council.', source: 'MEA', link: '' },
    { date: '2026-05-11', category: 'Economy', title: 'RBI keeps repo rate unchanged at 6.50%', summary: 'MPC voted to maintain repo rate citing inflation concerns.', source: 'RBI', link: '' },
    { date: '2026-05-10', category: 'Environment', title: "India's forest cover increases by 2,261 sq km", summary: 'India State of Forest Report 2025 shows increase in forest cover.', source: 'FSI', link: '' },
  ]
}

export async function fetchCurrentAffairs() {
  try {
    const res = await fetch('/api/currentAffairs')
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    if (data.source === 'mock') {
      return data.articles.map(a => ({ ...a, category: guessCategory(a.title, a.summary), tags: extractTags(a.title + ' ' + a.summary) }))
    }
    return data.articles.map(a => ({
      date: a.pubDate ? new Date(a.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      category: guessCategory(a.title, a.summary),
      title: a.title,
      summary: a.summary,
      tags: extractTags(a.title + ' ' + a.summary),
      source: a.source,
      link: a.link,
    }))
  } catch (e) {
    console.warn('Failed to fetch current affairs, using fallback:', e)
    return getMockArticles().map(a => ({ ...a, category: guessCategory(a.title, a.summary), tags: extractTags(a.title + ' ' + a.summary) }))
  }
}
