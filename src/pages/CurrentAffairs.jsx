import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { fetchCurrentAffairs } from '../lib/currentAffairs'
import { ChevronLeft, Search, RefreshCw, Bookmark, ExternalLink, ChevronRight, BookOpen, X, XCircle, CheckCircle, Sparkles } from 'lucide-react'

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
  const { userId } = useStore()
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

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const loadNews = async () => {
    setLoading(true)
    try {
      const data = await fetchCurrentAffairs()
      setArticles(data || [])
    } catch { /* use mock fallback */ }
    setLoading(false)
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
      showToast('Note saved!')
    }
  }

  const generateMCQs = async (article) => {
    setMcqLoading(true)
    setMcqAnswers({})
    setMcqResult(null)
    setMcqCurrent(0)
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
          setMcqQuestions(questions)
          setMcqPractice(article)
          setMcqLoading(false)
          return
        }
      }
    } catch {}
    showToast('Could not generate MCQs. Try again.')
    setMcqLoading(false)
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
    <div style={{ background: 'var(--page-bg)', minHeight: '100%', paddingBottom: 100 }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 999,
              background: '#1F2937', color: '#fff', padding: '8px 20px', borderRadius: 12,
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ background: '#fff', padding: '48px 16px 10px', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <motion.button whileTap={{scale:0.96}} onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <ChevronLeft size={18} color="#111827" />
          </motion.button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Current Affairs</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>UPSC-focused news feed</div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={loadNews} style={{
            width: 34, height: 34, borderRadius: 12, border: '1px solid #E5E7EB',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RefreshCw size={16} color="#6B7280" className={loading ? 'spin' : ''} />
          </motion.button>
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..." style={{
            width: '100%', padding: '8px 8px 8px 32px', borderRadius: 8, border: '1px solid #E5E7EB',
            fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#F9FAFB', boxSizing: 'border-box',
          }} />
        </div>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 14px', overflowX: 'auto', scrollbarWidth: 'none',
        background: '#fff', borderBottom: '1px solid #F3F4F6',
      }}>
        {CATEGORIES.map(cat => (
          <motion.button whileTap={{scale:0.96}} key={cat} onClick={() => setActiveCategory(cat)} style={{
            padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            background: activeCategory === cat ? '#3B82F6' : '#F3F4F6',
            color: activeCategory === cat ? '#fff' : '#6B7280',
          }}>
            {cat}
          </motion.button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
        {/* Articles grid */}
        <div style={{ flex: 1, padding: '10px 14px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E5E7EB', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Loading news...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📰</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6B7280' }}>No articles found</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Try a different category or check back later</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {filtered.map((a, i) => {
                const catColor = categoryColors[a.category] || '#6B7280'
                const gradient = `linear-gradient(135deg, ${catColor}22, ${catColor}08)`
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    whileHover={{ y: -3 }}
                    onClick={() => setSelectedArticle(a)}
                    style={{
                      background: '#fff', borderRadius: 14, border: selectedArticle?.title === a.title ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                      cursor: 'pointer', overflow: 'hidden', transition: '0.15s',
                    }}
                  >
                    {/* Colored placeholder */}
                    <div style={{
                      height: 80, background: gradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, position: 'relative',
                    }}>
                      <span style={{ opacity: 0.3 }}>📰</span>
                      <span style={{
                        position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 99, background: '#fff', color: catColor,
                      }}>
                        {a.category}
                      </span>
                    </div>
                    <div style={{ padding: '10px 12px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.4, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {a.title}
                      </div>
                      {a.summary && (
                        <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 6 }}>
                          {a.summary}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{a.date}</div>
                        <motion.button whileTap={{scale:0.9}} onClick={e => { e.stopPropagation(); toggleBookmark(a) }} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
                        }}>
                          <Bookmark size={13} color={bookmarked.has(a.title) ? '#3B82F6' : '#D1D5DB'} fill={bookmarked.has(a.title) ? '#3B82F6' : 'none'} />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
        {selectedArticle && (
          <motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: 'tween', duration: 0.25 }}
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: 400,
              background: '#fff', zIndex: 200, boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '50px 14px 10px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.button whileTap={{scale:0.96}} onClick={() => setSelectedArticle(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <ChevronLeft size={18} color="#111827" />
              </motion.button>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Article</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 100px' }}>
              {/* Category-colored header */}
              <div style={{
                height: 100, borderRadius: 12, marginBottom: 12,
                background: `linear-gradient(135deg, ${(categoryColors[selectedArticle.category] || '#6B7280')}30, ${(categoryColors[selectedArticle.category] || '#6B7280')}10)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
              }}>
                📰
              </div>
              {selectedArticle.category && (
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                  background: (categoryColors[selectedArticle.category] || '#6B7280') + '15',
                  color: categoryColors[selectedArticle.category] || '#6B7280', marginBottom: 8,
                }}>
                  {selectedArticle.category}
                </span>
              )}
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.4, marginBottom: 6 }}>{selectedArticle.title}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
                {selectedArticle.date} · {selectedArticle.source}
              </div>
              {/* Detailed analysis sections */}
              <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.8, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
                {selectedArticle.summary || 'Full article content would appear here. Fetch the complete story from the source link below.'}
              </div>
              {selectedArticle.tags?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Tags</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedArticle.tags.map((t, i) => (
                      <span key={i} style={{ fontSize: 10, color: '#6B7280', background: '#F3F4F6', padding: '3px 10px', borderRadius: 99 }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* UPSC Relevance */}
              <div style={{ background: '#F0FDF4', borderRadius: 10, padding: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 4 }}>UPSC Relevance</div>
                <div style={{ fontSize: 11, color: '#065F46', lineHeight: 1.5 }}>
                  This article is relevant for {selectedArticle.category || 'General Studies'} preparation. Analyze the key facts, government initiatives, and constitutional aspects mentioned. Link with static syllabus topics for Mains answers.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <motion.button whileTap={{scale:0.96}} onClick={() => toggleBookmark(selectedArticle)} style={{
                  width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                  background: bookmarked.has(selectedArticle.title) ? '#EF4444' : '#3B82F6',
                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {bookmarked.has(selectedArticle.title) ? <><X size={14} /> Remove Bookmark</> : <><BookOpen size={14} /> Save as Note</>}
                </motion.button>
                <motion.button whileTap={{scale:0.96}} onClick={() => generateMCQs(selectedArticle)} disabled={mcqLoading} style={{
                  width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                  background: mcqLoading ? '#D1D5DB' : '#059669', color: '#fff',
                  fontSize: 12, fontWeight: 700, cursor: mcqLoading ? 'default' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Sparkles size={14} /> {mcqLoading ? 'Generating...' : 'Practice Related MCQs'}
                </motion.button>
                {selectedArticle.url && (
                  <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer" style={{
                    width: '100%', padding: '10px 0', borderRadius: 8, border: '1.5px solid #E5E7EB',
                    background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none',
                  }}>
                    <ExternalLink size={14} /> Read Full Article
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* MCQ Practice Modal */}
      <AnimatePresence>
        {mcqPractice && mcqQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
            onClick={() => { setMcqPractice(null); setMcqQuestions([]); setMcqAnswers({}); setMcqResult(null); setMcqCurrent(0) }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '80vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#059669" />
                <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {mcqResult ? 'Results' : `MCQ ${mcqCurrent + 1}/${mcqQuestions.length}`}
                </div>
                <motion.button whileTap={{scale:0.9}} onClick={() => { setMcqPractice(null); setMcqQuestions([]); setMcqAnswers({}); setMcqResult(null); setMcqCurrent(0) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
                }}>
                  <X size={16} color="#9CA3AF" />
                </motion.button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {mcqResult ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>
                      {mcqResult.correct === mcqResult.total ? '🎉' : mcqResult.correct >= mcqResult.total / 2 ? '👍' : '💪'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                      {mcqResult.correct}/{mcqResult.total}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Questions correct</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {mcqQuestions.map((q, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#4B5563', textAlign: 'left', background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4, color: mcqAnswers[i] === q.ans ? '#059669' : '#EF4444' }}>
                            {mcqAnswers[i] === q.ans ? '✓ Correct' : '✗ Incorrect'} — {q.q}
                          </div>
                          {mcqAnswers[i] !== q.ans && (
                            <div style={{ color: '#059669' }}>Answer: {q.options[q.ans]}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <motion.button onClick={() => { setMcqPractice(null); setMcqQuestions([]); setMcqAnswers({}); setMcqResult(null); setMcqCurrent(0) }} whileTap={{scale:0.97}} style={{
                      marginTop: 16, width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                      background: '#3B82F6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Close
                    </motion.button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 12 }}>
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
                            borderColor: answered ? (isCorrect ? '#10B981' : selected ? '#EF4444' : '#E5E7EB') : '#E5E7EB',
                            background: answered ? (isCorrect ? '#F0FDF4' : selected ? '#FEF2F2' : '#fff') : '#fff',
                            color: '#111827', fontSize: 12, fontWeight: 500, cursor: answered ? 'default' : 'pointer',
                            textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            {answered && isCorrect && <CheckCircle size={14} color="#10B981" />}
                            {answered && selected && !isCorrect && <XCircle size={14} color="#EF4444" />}
                            {!answered && <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #D1D5DB', display: 'inline-block' }} />}
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
