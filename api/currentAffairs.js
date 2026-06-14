const NEWS_API_KEY = process.env.NEWS_API_KEY || ''

function guessCategory(title, summary) {
  const t = (title + ' ' + summary).toLowerCase()
  if (t.includes('econom') || t.includes('gdp') || t.includes('budget') || t.includes('fiscal') || t.includes('inflation') || t.includes('rbi') || t.includes('market') || t.includes('trade') || t.includes('tax')) return 'Economy'
  if (t.includes('pollut') || t.includes('climate') || t.includes('forest') || t.includes('wildlife') || t.includes('emission') || t.includes('green') || t.includes('environment') || t.includes('conservation')) return 'Environment'
  if (t.includes('isro') || t.includes('space') || t.includes('nuclear') || t.includes('vaccine') || t.includes('tech') || t.includes('digital') || t.includes('science') || t.includes('ai ') || t.includes('satellite') || t.includes('launch')) return 'Science'
  if (t.includes('un ') || t.includes('china') || t.includes('us ') || t.includes('russia') || t.includes('uk ') || t.includes('diplomat') || t.includes('treaty') || t.includes('saarc') || t.includes('bilateral') || t.includes('foreign') || t.includes('summit')) return 'International'
  if (t.includes('supreme') || t.includes('election') || t.includes('bill') || t.includes('parliament') || t.includes('amendment') || t.includes('judgment') || t.includes('constitution') || t.includes('governance') || t.includes('policy')) return 'Polity'
  if (t.includes('defence') || t.includes('army') || t.includes('security') || t.includes('border') || t.includes('militar') || t.includes('terror')) return 'Security'
  if (t.includes('health') || t.includes('education') || t.includes('scheme') || t.includes('welfare') || t.includes('rural') || t.includes('agriculture') || t.includes('farmer')) return 'Social'
  return 'Polity'
}

export default async function handler(req, res) {
  let articles = []

  // Try NewsAPI first
  if (NEWS_API_KEY) {
    try {
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const fromDate = weekAgo.toISOString().split('T')[0]
      const url = `https://newsapi.org/v2/everything?q=India&language=en&from=${fromDate}&sortBy=publishedAt&pageSize=30&apiKey=${NEWS_API_KEY}`
      const resp = await fetch(url)
      if (resp.ok) {
        const data = await resp.json()
        if (data.articles && data.articles.length > 0) {
          articles = data.articles.map(a => ({
            date: a.publishedAt ? a.publishedAt.split('T')[0] : today.toISOString().split('T')[0],
            category: guessCategory(a.title || '', a.description || ''),
            title: a.title || '',
            summary: (a.description || '').substring(0, 200),
            source: a.source?.name || 'News',
            link: a.url || '',
            image: a.urlToImage || '',
            tags: [],
          }))
        }
      }
    } catch (e) {
      console.warn('NewsAPI failed:', e)
    }
  }

  // Fallback: RSS feeds
  if (articles.length < 5) {
    const feeds = [
      { url: 'https://www.thehindu.com/news/national/feeder/default.rss', source: 'The Hindu' },
      { url: 'https://pib.gov.in/RssMain.aspx', source: 'PIB' },
      { url: 'https://indianexpress.com/feed/', source: 'Indian Express' },
    ]
    for (const feed of feeds) {
      try {
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 4000)
        const resp = await fetch(feed.url, { signal: ctrl.signal })
        clearTimeout(tid)
        if (!resp.ok) continue
        const xml = await resp.text()
        const itemRegex = /<item>[\s\S]*?<\/item>/gi
        let match
        while ((match = itemRegex.exec(xml)) !== null) {
          const item = match[0]
          const title = (item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim()
          const desc = (item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim()
          const pubDate = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || ''
          const link = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || ''
          if (!title) continue
          articles.push({ date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : '', category: guessCategory(title, desc), title, summary: desc.substring(0, 200), source: feed.source, link, image: '', tags: [] })
        }
      } catch {}
    }
  }

  // Deduplicate
  const seen = new Set()
  const deduped = articles.filter(a => {
    const key = (a.title || '').toLowerCase().slice(0, 40)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (deduped.length < 3) {
    return res.json({ source: 'mock', articles: getMockArticles() })
  }

  return res.json({ source: deduped.length >= 5 && NEWS_API_KEY ? 'newsapi' : 'rss', articles: deduped.slice(0, 30) })
}

function getMockArticles() {
  return [
    { date: '2026-05-17', category: 'Economy', title: "India's GDP growth projected at 7.2% for FY26", summary: 'IMF projects India\'s GDP growth at 7.2% for FY 2025-26, making India the fastest-growing major economy.', source: 'Economic Survey', link: '', image: '' },
    { date: '2026-05-16', category: 'Polity', title: 'Supreme Court upholds right to privacy as fundamental right', summary: 'Supreme Court reaffirmed that right to privacy is an intrinsic part of Article 21.', source: 'SC India', link: '', image: '' },
    { date: '2026-05-15', category: 'Environment', title: 'India pledges net-zero emissions by 2070', summary: 'At the COP Summit, India announced an updated target to achieve net-zero carbon emissions by 2070.', source: 'MoEFCC', link: '', image: '' },
    { date: '2026-05-14', category: 'Science', title: 'ISRO successfully launches GSLV-Mk III', summary: 'ISRO\'s GSLV-Mk III successfully placed a next-gen communication satellite in geostationary orbit.', source: 'ISRO', link: '', image: '' },
    { date: '2026-05-13', category: 'Polity', title: 'One Nation One Election bill introduced in Parliament', summary: 'Government introduced Constitution Amendment Bill for simultaneous elections.', source: 'Lok Sabha', link: '', image: '' },
    { date: '2026-05-12', category: 'International', title: 'India assumes presidency of UN Security Council', summary: 'India began month-long presidency of UN Security Council.', source: 'MEA', link: '', image: '' },
    { date: '2026-05-11', category: 'Economy', title: 'RBI keeps repo rate unchanged at 6.50%', summary: 'MPC voted to maintain repo rate citing inflation concerns.', source: 'RBI', link: '', image: '' },
    { date: '2026-05-10', category: 'Environment', title: "India's forest cover increases by 2,261 sq km", summary: 'India State of Forest Report 2025 shows increase in forest cover.', source: 'FSI', link: '', image: '' },
  ]
}
