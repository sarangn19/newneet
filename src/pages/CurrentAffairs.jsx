import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { fetchCurrentAffairs } from '../lib/currentAffairs'
import { ChevronLeft, Search, RefreshCw, Bookmark, ExternalLink, ChevronRight, BookOpen, X, XCircle, CheckCircle, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react'
import { SkeletonBlock } from '../components/SkeletonBlock'
import { skeletonBreath } from '../hooks/useSequentialReveal'

const CATEGORIES = [
  'All', 'Polity', 'Economy', 'International', 'Environment', 'Science & Tech', 'History & Culture', 'Geography',
]

const categoryColors = {
  Polity: '#3B82F6',
  Economy: '#10B981',
  International: '#8B5CF6',
  Environment: '#059669',
  'Science & Tech': '#0EA5E9',
  'History & Culture': '#2563EB',
  Geography: '#EC4899',
}

export default function CurrentAffairs() {
  const navigate = useNavigate()
  const { userId, caHistory, recordArticleOpened, recordArticleClosed, recordArticleBookmarked, recordNotesGenerated, recordMCQsGenerated, incrementCaFallback, incrementCaRetryAttempt, incrementCaRetrySuccess, incrementCaMcqTimeout, incrementCaMcqFail } = useStore()
  const [articles, setArticles] = useState([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [bookmarked, setBookmarked] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [mcqPractice, setMcqPractice] = useState(null)
  const [mcqQuestions, setMcqQuestions] = useState([])
  const [mcqAnswers, setMcqAnswers] = useState({})
  const [mcqResult, setMcqResult] = useState(null)
  const [mcqCurrent, setMcqCurrent] = useState(0)
  const [mcqLoading, setMcqLoading] = useState(false)
  const [mcqProgress, setMcqProgress] = useState('')
  const [isFallback, setIsFallback] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const articleOpenTime = useRef(null)
  const mcqProgressTimer = useRef(null)
  const mcqSafetyTimer = useRef(null)

  const MCQ_PROGRESS_STEPS = [
    'Analyzing article relevance...',
    'Generating UPSC-style questions...',
    'Creating explanations...',
    'Finalizing practice set...',
  ]

  const clearMcqTimers = () => {
    if (mcqProgressTimer.current) { clearInterval(mcqProgressTimer.current); mcqProgressTimer.current = null }
    if (mcqSafetyTimer.current) { clearTimeout(mcqSafetyTimer.current); mcqSafetyTimer.current = null }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const loadNews = async () => {
    setLoading(true)
    setIsFallback(false)
    try {
      const result = await fetchCurrentAffairs()
      setArticles(result.articles || [])
      if (result.source === 'mock') { setIsFallback(true); incrementCaFallback() }
    } catch {
      setIsFallback(true); incrementCaFallback()
    }
    setLoading(false)
  }

  const retry = async () => {
    if (retrying) return
    setRetrying(true)
    setIsFallback(false)
    incrementCaRetryAttempt()
    try {
      const result = await fetchCurrentAffairs()
      setArticles(result.articles || [])
      if (result.source === 'mock') { setIsFallback(true); incrementCaFallback() }
      else incrementCaRetrySuccess()
    } catch {
      setIsFallback(true); incrementCaFallback()
    }
    setRetrying(false)
  }

  useEffect(() => { loadNews() }, [])

  const loadBookmarks = async () => {
    if (!userId) return
    supabase.from('notes').select('id, title').eq('user_id', userId).then(({ data }) => {
      if (data) setBookmarked(new Set(data.map(n => n.title)))
    })
  }

  useEffect(() => { loadBookmarks() }, [userId])

  const filtered = useMemo(() => {
    let list = articles
    if (activeCategory !== 'All') list = list.filter(a => a.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.title?.toLowerCase().includes(q) || a.summary?.toLowerCase().includes(q))
    }
    return list.slice(0, 30)
  }, [articles, activeCategory, search])

  const readArticles = useMemo(() => {
    const read = new Set()
    caHistory.forEach(e => { if (e.timeSpentSeconds > 0) read.add(e.articleId) })
    return read
  }, [caHistory])

  const toggleBookmark = async (article) => {
    if (!userId) return
    if (bookmarked.has(article.title)) {
      const { data } = await supabase.from('notes').select('id').eq('user_id', userId).eq('title', article.title).single()
      if (data) {
        await supabase.from('notes').delete().eq('id', data.id)
      }
      setBookmarked(prev => { const s = new Set(prev); s.delete(article.title); return s })
      showToast('Bookmark removed')
    } else {
      const content = `**${article.title}**\n\n*Source:* ${article.source || 'News'}\n*Date:* ${article.date || ''}\n*Category:* ${article.category || 'General'}\n\n${article.summary || ''}\n\n[Read more](${article.url || '#'})`
      await supabase.from('notes').insert({
        user_id: userId, title: article.title, content,
      })
      setBookmarked(prev => new Set([...prev, article.title]))
      recordArticleBookmarked(article.title)
      recordNotesGenerated(article.title)
      showToast('Note saved!')
    }
  }

  const generateMCQs = async (article) => {
    setMcqLoading(true)
    setMcqAnswers({})
    setMcqResult(null)
    setMcqCurrent(0)
    setMcqProgress(MCQ_PROGRESS_STEPS[0])
    setMcqPractice(article)
    setMcqQuestions([])

    clearMcqTimers()
    let stepIdx = 0
    mcqProgressTimer.current = setInterval(() => {
      stepIdx = (stepIdx + 1) % MCQ_PROGRESS_STEPS.length
      setMcqProgress(MCQ_PROGRESS_STEPS[stepIdx])
    }, 4000)

    mcqSafetyTimer.current = setTimeout(() => {
      clearMcqTimers()
      setMcqLoading(false)
      setMcqProgress('')
      setMcqPractice(null)
      incrementCaMcqTimeout()
      showToast('MCQ generation timed out. Try again.')
    }, 25000)

    try {
      const res = await fetch('/api/ai-doubt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteContext: `Title: ${article.title}\n${article.summary || ''}`,
          question: 'Generate exactly 5 multiple choice questions (MCQs) based on the above article for UPSC exam preparation. Return ONLY a valid JSON array with no markdown formatting, no code blocks. Each object must have: "q" (question string), "options" (array of 4 strings), "ans" (0-3 index of correct answer), "explanation" (string). Only return the JSON array, nothing else.',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        let questions
        try {
          questions = JSON.parse(data.text)
        } catch {
          const match = data.text.match(/\[[\s\S]*\]/)
          questions = match ? JSON.parse(match[0]) : null
        }
        if (questions && questions.length > 0) {
          clearMcqTimers()
          setMcqQuestions(questions)
          setMcqPractice(article)
          setMcqProgress('')
          recordMCQsGenerated(article.title)
          setMcqLoading(false)
          return
        }
      }
    } catch {}
    clearMcqTimers()
    incrementCaMcqFail()
    showToast('Could not generate MCQs. Try again.')
    setMcqLoading(false)
    setMcqProgress('')
    setMcqPractice(null)
  }

  const answerMcq = (idx) => {
    if (mcqAnswers[mcqCurrent] !== undefined) return
    setMcqAnswers(prev => ({ ...prev, [mcqCurrent]: idx }))
    if (mcqCurrent < mcqQuestions.length - 1) {
      setTimeout(() => setMcqCurrent(prev => prev + 1), 800)
    } else {
      const correct = mcqQuestions.filter((q, i) => mcqAnswers[i] === undefined ? idx === q.ans : mcqAnswers[i] === q.ans).length
      setTimeout(() => setMcqResult({ correct, total: mcqQuestions.length }), 800)
    }
  }

  return (
    <div style={{ background: 'var(--page-bg)', minHeight: '100%', paddingBottom: 100, overflowX: 'hidden' }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 999,
              background: 'var(--surface-alt)', color: 'var(--text)', padding: '8px 20px', borderRadius: 12,
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ background: 'var(--card-bg)', padding: '48px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10 }}>
          <motion.button whileTap={{scale:0.96}} onClick={loadNews} style={{
            width: 34, height: 34, borderRadius: 12, border: '1px solid var(--border)',
            background: 'var(--surface-alt)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RefreshCw size={16} color="var(--text-2)" className={loading ? 'spin' : ''} />
          </motion.button>
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} color="var(--text-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..." style={{
            width: '100%', padding: '8px 8px 8px 32px', borderRadius: 8, border: '1px solid var(--border)',
            fontSize: 12, outline: 'none', fontFamily: 'inherit', background: 'var(--surface-alt)', color: 'var(--text)', boxSizing: 'border-box',
          }} />
        </div>
      </div>

      {/* Fallback warning banner */}
      <AnimatePresence>
        {isFallback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              background: 'var(--warning-light)', borderBottom: '1px solid var(--border)',
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 11, color: 'var(--text)', lineHeight: 1.4 }}>
              Unable to fetch the latest current affairs. Showing archived articles.
            </div>
            <motion.button
              whileTap={{scale:0.96}}
              onClick={retry}
              disabled={retrying}
              style={{
                padding: '5px 12px', borderRadius: 8, border: '1px solid var(--warning)',
                background: 'transparent', color: 'var(--warning)', fontSize: 11, fontWeight: 600,
                cursor: retrying ? 'default' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 4, opacity: retrying ? 0.6 : 1,
              }}
            >
              <RotateCcw size={12} className={retrying ? 'spin' : ''} />
              Retry
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 14px', overflowX: 'auto', scrollbarWidth: 'none',
        background: 'var(--card-bg)', borderBottom: '1px solid var(--border)',
      }}>
        {CATEGORIES.map(cat => (
          <motion.button
            layout
            whileTap={{scale: 0.92}}
            whileHover={{scale: 1.04}}
            key={cat}
            onClick={() => setActiveCategory(cat)}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            style={{
              padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              background: activeCategory === cat ? 'var(--primary)' : 'var(--surface-alt)',
              color: activeCategory === cat ? '#fff' : 'var(--text-3)',
            }}>
            {cat}
          </motion.button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
        {/* Articles grid */}
        <div style={{ flex: 1, padding: '10px 14px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', minWidth: 0 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{
                  background: 'var(--card-bg)', borderRadius: 24, padding: 20,
                  display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <SkeletonBlock width={60} height={10} radius={4} />
                    <SkeletonBlock width={80} height={10} radius={4} />
                  </div>
                  <SkeletonBlock width="85%" height={16} radius={4} style={{ marginBottom: 8 }} />
                  <SkeletonBlock width="60%" height={12} radius={4} style={{ marginBottom: 4 }} />
                  <SkeletonBlock width="70%" height={12} radius={4} style={{ marginBottom: 10 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 2 }}>
                    <SkeletonBlock width={80} height={10} radius={4} />
                    <SkeletonBlock width={20} height={10} radius={4} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📰</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>No articles found</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Try a different category or check back later</div>
            </div>
          ) : (
            <motion.div key={activeCategory} variants={{ visible: { transition: { staggerChildren: 0.08 } } }} initial="hidden" animate="visible"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', minWidth: 0 }}>
              {filtered.map((a) => {
                const catColor = categoryColors[a.category] || '#6B7280'
                const isRead = readArticles.has(a.title)
                return (
                  <motion.div key={a.title}
                    layoutId={`article-${a.title}`}
                    variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { recordArticleOpened(a); articleOpenTime.current = Date.now(); setSelectedArticle(a) }}
                    style={{
                      background: 'var(--card-bg)', borderRadius: 24, padding: 20, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
                      opacity: isRead ? 0.85 : 1,
                    }}
                  >
                    {/* Top row: category chip + date */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: catColor }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: catColor }}>{a.category}</span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>{a.date}</span>
                    </div>
                    {/* Title — max 2 lines */}
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {a.title}
                    </div>
                    {/* Preview — max 3 lines */}
                    {a.summary && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 10 }}>
                        {a.summary}
                      </div>
                    )}
                    {/* Bottom row: continue reading + bookmark */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>
                        Continue reading →
                      </span>
                      <motion.button onClick={e => { e.stopPropagation(); toggleBookmark(a) }} whileTap={{ scale: 0.8 }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                        <Bookmark size={14} color={bookmarked.has(a.title) ? 'var(--primary)' : 'var(--text-3)'} fill={bookmarked.has(a.title) ? 'var(--primary)' : 'none'} />
                      </motion.button>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>

        {/* Article detail popup */}
        {createPortal(
        <AnimatePresence>
        {selectedArticle && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { const elapsed = articleOpenTime.current ? Math.round((Date.now() - articleOpenTime.current) / 1000) : 0; recordArticleClosed(selectedArticle.title, elapsed); setSelectedArticle(null) }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <motion.div layoutId={`article-${selectedArticle.title}`}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--card-bg)', borderRadius: 24,
                width: '100%', maxWidth: 400, maxHeight: '85vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {selectedArticle.category || 'Article'}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <motion.button whileTap={{scale:0.85}} onClick={() => toggleBookmark(selectedArticle)} style={{ background: 'var(--surface-alt)', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, display: 'flex' }}>
                    <Bookmark size={15} color={bookmarked.has(selectedArticle.title) ? 'var(--primary)' : 'var(--text-3)'} fill={bookmarked.has(selectedArticle.title) ? 'var(--primary)' : 'none'} />
                  </motion.button>
                  <motion.button whileTap={{scale:0.85}} onClick={() => { const elapsed = articleOpenTime.current ? Math.round((Date.now() - articleOpenTime.current) / 1000) : 0; recordArticleClosed(selectedArticle.title, elapsed); setSelectedArticle(null) }} style={{ background: 'var(--surface-alt)', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, display: 'flex' }}>
                    <X size={16} color="var(--text-2)" />
                  </motion.button>
                </div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px' }}>
                {/* Title + meta */}
                <div style={{ marginBottom: 12 }}>
                  {selectedArticle.category && (
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                      background: (categoryColors[selectedArticle.category] || '#6B7280') + '15',
                      color: categoryColors[selectedArticle.category] || '#6B7280', marginBottom: 8,
                    }}>
                      {selectedArticle.category}
                    </span>
                  )}
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, marginBottom: 4 }}>{selectedArticle.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {selectedArticle.date} · {selectedArticle.source}
                  </div>
                </div>

                {/* Summary */}
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
                  {selectedArticle.summary || 'Full article content would appear here. Fetch the complete story from the source link below.'}
                </div>

                {/* Tags */}
                {selectedArticle.tags?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Tags</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selectedArticle.tags.map((t, i) => (
                        <span key={i} style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--surface-alt)', padding: '3px 10px', borderRadius: 99 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* UPSC Relevance */}
                <div style={{ background: `${(categoryColors[selectedArticle.category] || '#6B7280')}0D`, borderRadius: 10, padding: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: categoryColors[selectedArticle.category] || 'var(--primary)', marginBottom: 4 }}>UPSC Relevance</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
                    This article is relevant for {selectedArticle.category || 'General Studies'} preparation. Analyze the key facts, government initiatives, and constitutional aspects mentioned. Link with static syllabus topics for Mains answers.
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <motion.button whileTap={{scale:0.96}} onClick={() => generateMCQs(selectedArticle)} disabled={mcqLoading} style={{
                    width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                    background: mcqLoading ? 'var(--surface-alt)' : 'var(--primary)', color: '#fff',
                    fontSize: 12, fontWeight: 700, cursor: mcqLoading ? 'default' : 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <Sparkles size={14} /> {mcqLoading ? 'Generating...' : 'Practice Related MCQs'}
                  </motion.button>
                  {selectedArticle.url && (
                    <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer" style={{
                      width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid var(--border)',
                      background: 'var(--card-bg)', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none',
                    }}>
                      <ExternalLink size={14} /> Read Full Article
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body
      )}
      </div>

      {/* MCQ Practice Modal */}
      <AnimatePresence>
        {mcqPractice && (mcqLoading || mcqQuestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
            onClick={() => { clearMcqTimers(); setMcqLoading(false); setMcqProgress(''); setMcqPractice(null); setMcqQuestions([]); setMcqAnswers({}); setMcqResult(null); setMcqCurrent(0) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--card-bg)', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '80vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="var(--success)" />
                <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {mcqLoading ? 'Generating Practice Set' : mcqResult ? 'Results' : `MCQ ${mcqCurrent + 1}/${mcqQuestions.length}`}
                </div>
                <motion.button whileTap={{scale:0.9}} onClick={() => { clearMcqTimers(); setMcqLoading(false); setMcqProgress(''); setMcqPractice(null); setMcqQuestions([]); setMcqAnswers({}); setMcqResult(null); setMcqCurrent(0) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
                }}>
                  <X size={16} color="var(--text-3)" />
                </motion.button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {mcqLoading ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                    <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, marginBottom: 8 }}>{mcqProgress}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>This may take up to 25 seconds</div>
                  </div>
                ) : mcqResult ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>
                      {mcqResult.correct === mcqResult.total ? '🎉' : mcqResult.correct >= mcqResult.total / 2 ? '👍' : '💪'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                      {mcqResult.correct}/{mcqResult.total}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>Questions correct</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {mcqQuestions.map((q, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'left', background: 'var(--surface-alt)', borderRadius: 10, padding: 10 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4, color: mcqAnswers[i] === q.ans ? 'var(--success)' : 'var(--error)' }}>
                            {mcqAnswers[i] === q.ans ? '✓ Correct' : '✗ Incorrect'} — {q.q}
                          </div>
                          {mcqAnswers[i] !== q.ans && (
                            <div style={{ color: 'var(--success)' }}>Answer: {q.options[q.ans]}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <motion.button onClick={() => { clearMcqTimers(); setMcqLoading(false); setMcqProgress(''); setMcqPractice(null); setMcqQuestions([]); setMcqAnswers({}); setMcqResult(null); setMcqCurrent(0) }} whileTap={{scale:0.97}} style={{
                      marginTop: 16, width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                      background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Close
                    </motion.button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
                      {mcqQuestions[mcqCurrent]?.q}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mcqQuestions[mcqCurrent]?.options.map((opt, oi) => {
                        const answered = mcqAnswers[mcqCurrent] !== undefined
                        const selected = mcqAnswers[mcqCurrent] === oi
                        const isCorrect = mcqQuestions[mcqCurrent]?.ans === oi
                        return (
                          <motion.button key={oi} onClick={() => answerMcq(oi)} whileTap={{ scale: 0.97 }} disabled={answered} style={{
                            width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid',
                            borderColor: answered ? (isCorrect ? 'var(--success)' : selected ? 'var(--error)' : 'var(--border)') : 'var(--border)',
                            background: answered ? (isCorrect ? 'var(--success-light)' : selected ? 'var(--error-light)' : 'var(--card-bg)') : 'var(--card-bg)',
                            color: 'var(--text)', fontSize: 12, fontWeight: 500, cursor: answered ? 'default' : 'pointer',
                            textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            {answered && isCorrect && <CheckCircle size={14} color="var(--success)" />}
                            {answered && selected && !isCorrect && <XCircle size={14} color="var(--error)" />}
                            {!answered && <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--text-3)', display: 'inline-block' }} />}
                            {opt}
                          </motion.button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
