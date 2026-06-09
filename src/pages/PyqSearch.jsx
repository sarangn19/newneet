import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Search, Filter, Clock, CheckCircle, XCircle, Sliders, Shuffle, BookOpen, FileText } from 'lucide-react'
import useStore from '../store/useStore'
import { upscMCQs, getAllUpscQuestions } from '../data/upsc/questions'
import { upscSubjects } from '../data/upsc/subjects'

const CHAPTER_NAMES = {}
upscSubjects.forEach(s => s.chapters.forEach(c => { CHAPTER_NAMES[c.id] = c.name }))

const SUBJECT_NAMES = {}
upscSubjects.forEach(s => { SUBJECT_NAMES[s.id] = s.name })

export default function PyqSearch() {
  const navigate = useNavigate()
  const { saveTopicScore, recordQuestionAttempt, updateStats } = useStore()
  const allQuestions = useMemo(() => getAllUpscQuestions(), [])

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const urlChapter = params.get('chapter') || 'all'

  const [tab, setTab] = useState('browse')
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [chapterFilter, setChapterFilter] = useState(urlChapter)
  const [showFilters, setShowFilters] = useState(false)
  const [resultLimit, setResultLimit] = useState(20)

  const [testPhase, setTestPhase] = useState('setup')
  const [testQuestions, setTestQuestions] = useState([])
  const [testIdx, setTestIdx] = useState(0)
  const [testAnswers, setTestAnswers] = useState([])
  const [testSelected, setTestSelected] = useState(null)
  const [testSubmitted, setTestSubmitted] = useState(false)
  const [testStartTime, setTestStartTime] = useState(null)
  const [testTime, setTestTime] = useState(0)
  const [testConfig, setTestConfig] = useState({ subject: 'all', chapters: 'all', count: 10 })

  useEffect(() => {
    if (urlChapter !== 'all') {
      const ch = upscSubjects.flatMap(s => s.chapters).find(c => c.id === urlChapter)
      if (ch) {
        const sub = upscSubjects.find(s => s.chapters.some(c => c.id === urlChapter))
        if (sub) setSubjectFilter(sub.id)
      }
    }
  }, [])

  const chapters = useMemo(() => {
    if (subjectFilter === 'all') return upscSubjects.flatMap(s => s.chapters)
    const sub = upscSubjects.find(s => s.id === subjectFilter)
    return sub?.chapters || []
  }, [subjectFilter])

  const filtered = useMemo(() => {
    let qs = allQuestions
    if (search.trim()) {
      const q = search.toLowerCase()
      qs = qs.filter(item => item.q.toLowerCase().includes(q) || item.explanation?.toLowerCase().includes(q))
    }
    if (subjectFilter !== 'all') {
      const subChapters = new Set(upscSubjects.find(s => s.id === subjectFilter)?.chapters.map(c => c.id) || [])
      qs = qs.filter(item => subChapters.has(item.chapter))
    }
    if (chapterFilter !== 'all') {
      qs = qs.filter(item => item.chapter === chapterFilter)
    }
    return qs.slice(0, resultLimit)
  }, [allQuestions, search, subjectFilter, chapterFilter, resultLimit])

  const startTest = () => {
    let pool = [...allQuestions]
    if (testConfig.subject !== 'all') {
      const subChapters = new Set(upscSubjects.find(s => s.id === testConfig.subject)?.chapters.map(c => c.id) || [])
      pool = pool.filter(item => subChapters.has(item.chapter))
    }
    if (testConfig.chapters !== 'all') {
      pool = pool.filter(item => item.chapter === testConfig.chapters)
    }
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, Math.min(testConfig.count, pool.length))
    setTestQuestions(shuffled)
    setTestIdx(0)
    setTestAnswers([])
    setTestSelected(null)
    setTestSubmitted(false)
    setTestStartTime(Date.now())
    setTestTime(0)
    setTestPhase('test')
  }

  const submitAnswer = () => {
    if (testSelected === null || testSubmitted) return
    setTestSubmitted(true)
    const correct = testSelected === testQuestions[testIdx].ans
    setTestAnswers(prev => [...prev, { correct, selected: testSelected, question: testQuestions[testIdx] }])
    const timeSpent = testStartTime ? Math.round((Date.now() - testStartTime) / 1000) : 0
    recordQuestionAttempt(testQuestions[testIdx].chapter, correct, timeSpent, '')
  }

  const nextQuestion = () => {
    if (testIdx < testQuestions.length - 1) {
      setTestIdx(p => p + 1)
      setTestSelected(null)
      setTestSubmitted(false)
      setTestStartTime(Date.now())
    } else {
      finishTest()
    }
  }

  const finishTest = () => {
    const correctCount = testAnswers.filter(a => a.correct).length + (testSubmitted ? (testSelected === testQuestions[testIdx].ans ? 1 : 0) : 0)
    const totalCount = testAnswers.length + (testSubmitted ? 1 : 0)
    const correct = testAnswers.filter(a => a.correct).length
    const total = testAnswers.length
    updateStats(correct, total, 'prelims')
    setTestPhase('result')
  }

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100vh', paddingBottom: 100, position: 'relative' }}>
      <div className="bg-pattern" style={{ position: 'fixed', inset: 0, opacity: 0.4, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ padding: '48px 16px 10px', background: '#fff', borderBottom: '2px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="pill-3d" onClick={() => navigate('/')} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff', border: '2px solid #e2e8f0', borderRadius: 9999, padding: 0 }}>
            <ChevronLeft size={18} color="#475569" />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>PYQ Search</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 1 }}>{allQuestions.length} questions</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {['browse', 'test'].map(t => (
            <motion.button key={t} whileTap={{scale:0.96}} onClick={() => { setTab(t); setTestPhase('setup') }} style={{
              flex: 1, padding: '8px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 700,
              background: tab === t ? '#6366f1' : '#f1f5f9',
              color: tab === t ? '#fff' : '#64748b',
            }}>
              {t === 'browse' ? 'Browse PYQs' : 'Custom Test'}
            </motion.button>
          ))}
        </div>
      </div>

      {tab === 'browse' ? (
        <div style={{ padding: '12px 14px' }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..." style={{
              width: '100%', padding: '8px 8px 8px 32px', borderRadius: 10, border: '1px solid var(--border)',
              fontSize: 12, outline: 'none', fontFamily: 'inherit', background: 'var(--card-bg)', boxSizing: 'border-box',
              color: 'var(--text)',
            }} />
          </div>

          <motion.button whileTap={{scale:0.96}} onClick={() => setShowFilters(!showFilters)} style={{
            width: '100%', padding: '8px 0', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10,
            fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
          }}>
            <Filter size={14} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
          </motion.button>

          <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={subjectFilter} onChange={e => { setSubjectFilter(e.target.value); setChapterFilter('all') }} style={{
                  flex: 1, padding: '8px', borderRadius: 10, border: '1px solid var(--border)',
                  fontSize: 11, fontFamily: 'inherit', background: 'var(--card-bg)', color: 'var(--text)',
                }}>
                  <option value="all">All Subjects</option>
                  {upscSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)} style={{
                  flex: 1, padding: '8px', borderRadius: 10, border: '1px solid var(--border)',
                  fontSize: 11, fontFamily: 'inherit', background: 'var(--card-bg)', color: 'var(--text)',
                }}>
                  <option value="all">All Chapters</option>
                  {chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
              </div>
              <select value={resultLimit} onChange={e => setResultLimit(Number(e.target.value))} style={{
                width: '100%', padding: '8px', borderRadius: 10, border: '1px solid var(--border)',
                fontSize: 11, fontFamily: 'inherit', background: 'var(--card-bg)', color: 'var(--text)',
              }}>
                <option value={10}>Show 10 results</option>
                <option value={20}>Show 20 results</option>
                <option value={50}>Show 50 results</option>
                <option value={198}>Show all</option>
              </select>
            </motion.div>
          )}
          </AnimatePresence>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <FileText size={36} color="var(--text-3)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>No questions found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((q, i) => {
                const subId = Object.keys(SUBJECT_NAMES).find(sid => upscSubjects.find(s => s.id === sid)?.chapters.some(c => c.id === q.chapter))
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} style={{
                    background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)', padding: 12,
                  }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      {subId && <span style={{ padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 700, background: '#EFF6FF', color: '#3B82F6' }}>{SUBJECT_NAMES[subId]}</span>}
                      <span style={{ padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 600, background: '#F3F4F6', color: '#6B7280' }}>{CHAPTER_NAMES[q.chapter] || q.chapter}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8, lineHeight: 1.5 }}>{q.q}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {q.options.map((opt, oi) => (
                        <div key={oi} style={{
                          padding: '6px 10px', borderRadius: 8, fontSize: 11,
                          background: oi === q.ans ? '#D1FAE5' : '#F9FAFB',
                          color: oi === q.ans ? '#065F46' : '#6B7280',
                          border: oi === q.ans ? '1px solid #6EE7B7' : '1px solid transparent',
                          fontWeight: oi === q.ans ? 600 : 400,
                        }}>
                          {String.fromCharCode(65 + oi)}) {opt}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, padding: '8px 10px', background: '#F9FAFB', borderRadius: 8 }}>
                        {q.explanation}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      ) : testPhase === 'setup' ? (
        <div style={{ padding: '12px 14px' }}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
            background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)', padding: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Custom Test Setup</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Subject</div>
              <select value={testConfig.subject} onChange={e => setTestConfig(p => ({ ...p, subject: e.target.value, chapters: 'all' }))} style={{
                width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)',
                fontSize: 12, fontFamily: 'inherit', background: 'var(--card-bg)', color: 'var(--text)',
              }}>
                <option value="all">All Subjects</option>
                {upscSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {testConfig.subject !== 'all' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Chapter</div>
                <select value={testConfig.chapters} onChange={e => setTestConfig(p => ({ ...p, chapters: e.target.value }))} style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)',
                  fontSize: 12, fontFamily: 'inherit', background: 'var(--card-bg)', color: 'var(--text)',
                }}>
                  <option value="all">All Chapters</option>
                  {upscSubjects.find(s => s.id === testConfig.subject)?.chapters.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Number of Questions</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[5, 10, 20, 30].map(n => (
                  <motion.button key={n} whileTap={{scale:0.96}} onClick={() => setTestConfig(p => ({ ...p, count: n }))} style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, fontWeight: 700,
                    background: testConfig.count === n ? '#3B82F6' : '#F3F4F6',
                    color: testConfig.count === n ? '#fff' : '#6B7280',
                  }}>
                    {n}
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.button whileTap={{scale:0.96}} onClick={startTest} style={{
              width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
              background: '#3B82F6', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Shuffle size={16} /> Start Custom Test
            </motion.button>
          </motion.div>
        </div>
      ) : testPhase === 'test' ? (
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6' }}>{testIdx + 1}/{testQuestions.length}</div>
            <div style={{ flex: 1, height: 4, background: '#F3F4F6', borderRadius: 99 }}>
              <div style={{ width: `${((testIdx + 1) / testQuestions.length) * 100}%`, height: '100%', background: '#3B82F6', borderRadius: 99 }} />
            </div>
          </div>

          <motion.div key={testIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{
            background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)', padding: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.6, marginBottom: 12 }}>
              {testQuestions[testIdx].q}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {testQuestions[testIdx].options.map((opt, oi) => {
                let bg = 'var(--card-bg)'
                let border = '1px solid var(--border)'
                let textColor = 'var(--text)'
                if (testSubmitted) {
                  if (oi === testQuestions[testIdx].ans) { bg = '#D1FAE5'; border = '1px solid #6EE7B7'; textColor = '#065F46' }
                  else if (oi === testSelected) { bg = '#FEE2E2'; border = '1px solid #FCA5A5'; textColor = '#991B1B' }
                } else if (oi === testSelected) {
                  bg = '#EFF6FF'; border = '1px solid #93C5FD'; textColor = '#1E40AF'
                }
                return (
                  <motion.div key={oi} whileTap={testSubmitted ? {} : { scale: 0.98 }}
                    onClick={() => { if (!testSubmitted) setTestSelected(oi) }}
                    style={{ padding: '10px 12px', borderRadius: 10, border, background: bg, cursor: testSubmitted ? 'default' : 'pointer', fontSize: 12, color: textColor, fontWeight: testSubmitted && oi === testQuestions[testIdx].ans ? 700 : 400 }}
                  >
                    {String.fromCharCode(65 + oi)}) {opt}
                  </motion.div>
                )
              })}
            </div>

            {testSubmitted && testQuestions[testIdx].explanation && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: '#F9FAFB', borderRadius: 8, fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {testQuestions[testIdx].explanation}
              </div>
            )}
          </motion.div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {!testSubmitted ? (
              <motion.button whileTap={{scale:0.96}} onClick={submitAnswer} disabled={testSelected === null} style={{
                flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
                background: testSelected !== null ? '#3B82F6' : '#E5E7EB',
                color: testSelected !== null ? '#fff' : '#9CA3AF',
                fontSize: 12, fontWeight: 700, cursor: testSelected !== null ? 'pointer' : 'default', fontFamily: 'inherit',
              }}>
                Submit Answer
              </motion.button>
            ) : (
              <motion.button whileTap={{scale:0.96}} onClick={nextQuestion} style={{
                flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
                background: '#3B82F6', color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {testIdx < testQuestions.length - 1 ? 'Next Question' : 'See Results'}
              </motion.button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 14px' }}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
            background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)', padding: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Test Complete</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }}>
              {testAnswers.filter(a => a.correct).length}/{testAnswers.length} correct
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ background: '#D1FAE5', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>{testAnswers.filter(a => a.correct).length}</div>
                <div style={{ fontSize: 10, color: '#059669' }}>Correct</div>
              </div>
              <div style={{ background: '#FEE2E2', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#DC2626' }}>{testAnswers.filter(a => !a.correct).length}</div>
                <div style={{ fontSize: 10, color: '#DC2626' }}>Wrong</div>
              </div>
            </div>
            <motion.button whileTap={{scale:0.96}} onClick={() => { setTestPhase('setup'); setTab('browse') }} style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: '#3B82F6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Back to Search
            </motion.button>
          </motion.div>
        </div>
      )}
        </div>
      </div>
  )
}
