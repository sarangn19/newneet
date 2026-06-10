import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRive } from '@rive-app/react-canvas'
import { subjects as neetSubjects, getMcqBank } from '../data/subjects'
import { upscSubjects } from '../data/upsc/subjects'
import { upscMCQs } from '../data/upsc/questions'
import { supabase, hasQuestionsTable } from '../lib/supabase'
import { ChevronLeft, Search } from 'lucide-react'
import useStore from '../store/useStore'
import useSound from '../lib/useSound'
import { upsertTodayStats } from '../lib/useDailyStats'

const neetAllChapterIds = neetSubjects.flatMap(s => s.chapters.map(c => c.id))
const upscAllChapterIds = upscSubjects.flatMap(s => s.chapters.map(c => c.id))
const ENABLED_CHAPTERS = new Set([...neetAllChapterIds, ...upscAllChapterIds])
const neetAllChapters = neetSubjects.flatMap(s => s.chapters.map(c => ({ ...c, subject: s.id })))
const upscAllChapters = upscSubjects.flatMap(s => s.chapters.map(c => ({ ...c, subject: s.id })))
const chapterIdToName = Object.fromEntries(neetAllChapters.map(c => [c.id, c.name]))

const chapterNameToIdMap = {
  'Physical World': 'p1', 'Units and Measurements': 'p2',
  'Kinematics': ['p3', 'p4'], 'Motion in a Straight Line': 'p3', 'Motion in a Plane': 'p4',
  'Laws of Motion': 'p5', 'Work, Energy and Power': 'p6', 'Work Energy and Power': 'p6',
  'System of Particles & Rotational Motion': 'p7', 'System of Particles and Rotational Motion': 'p7', 'Gravitation': 'p8',
  'Mechanical Properties of Solids': 'p9', 'Mechanical Properties of Fluids': 'p10',
  'Thermal Properties of Matter': 'p11', 'Thermodynamics': ['p12', 'c5'], 'Kinetic Theory': 'p13',
  'Oscillations': 'p14', 'Waves': 'p15',
  'Electric Charges and Fields': 'p16', 'Electrostatics': ['p16', 'p17'],
  'Electrostatic Potential and Capacitance': 'p17', 'Current Electricity': 'p18',
  'Moving Charges and Magnetism': 'p19', 'Magnetism and Matter': 'p20',
  'Electromagnetic Induction': 'p21', 'Alternating Current': 'p22',
  'Electromagnetic Waves': 'p23', 'Ray Optics and Optical Instruments': 'p24',
  'Wave Optics': 'p25', 'Optics': ['p24', 'p25'],
  'Dual Nature of Radiation and Matter': 'p26', 'Atoms': 'p27',
  'Nuclei': 'p28', 'Semiconductor Electronics': 'p29',
  'Some Basic Concepts of Chemistry': 'c1', 'Structure of Atom': 'c2',
  'Classification of Elements': 'c3', 'Periodic Table': 'c3', 'Classification of Elements and Periodicity': 'c3',
  'Chemical Bonding': 'c4', 'Chemical Bonding and Molecular Structure': 'c4',
  'States of Matter': 'c5', 'Chemical Thermodynamics': 'c5',
  'Equilibrium': 'c6', 'Redox Reactions': 'c7',
  'Organic Chemistry Basics': 'c8', 'Organic Chemistry - Basic Principles': 'c8', 'Organic Chemistry: Some Basic Principles': 'c8',
  'Hydrocarbons': 'c9',
  'Solutions': 'c10', 'Electrochemistry': 'c11', 'Chemical Kinetics': 'c12',
  'Surface Chemistry': 'c13', 'p-Block Elements': 'c14', 'The p-Block Elements': 'c15',
  'd-Block Elements': 'c15', 'The d-and f-Block Elements': 'c16', 'd- and f-Block Elements': 'c16',
  'Coordination Compounds': 'c17',
  'Haloalkanes and Haloarenes': 'c18',
  'Alcohols, Phenols and Ethers': 'c19', 'Alcohols Phenols and Ethers': 'c19',
  'Aldehydes, Ketones and Carboxylic Acids': 'c20', 'Aldehydes Ketones and Carboxylic Acids': 'c20',
  'Amines': 'c21',
  'Biomolecules': ['b9', 'c22'],
  'Polymers': 'c23', 'Chemistry in Everyday Life': 'c24',
  'The Living World': 'b1', 'Biological Classification': 'b2',
  'Plant Kingdom': 'b3', 'Animal Kingdom': 'b4',
  'Morphology of Flowering Plants': 'b5', 'Anatomy of Flowering Plants': 'b6',
  'Structural Organisation in Animals': 'b7', 'Cell: The Unit of Life': 'b8',
  'Cell Cycle and Cell Division': 'b10',
  'Photosynthesis in Higher Plants': 'b11', 'Photosynthesis': 'b11',
  'Respiration in Plants': 'b12', 'Plant Growth and Development': 'b13',
  'Digestion and Absorption': 'b14', 'Breathing and Exchange of Gases': 'b15',
  'Body Fluids and Circulation': 'b16', 'Excretory Products and their Elimination': 'b17',
  'Locomotion and Movement': 'b18', 'Neural Control and Coordination': 'b19',
  'Chemical Coordination and Integration': 'b20',
  'Reproduction in Organisms': 'b21', 'Sexual Reproduction in Flowering Plants': 'b22',
  'Human Reproduction': 'b23', 'Reproductive Health': 'b24',
  'Principles of Inheritance and Variation': 'b25', 'Molecular Basis of Inheritance': 'b26',
  'Evolution': 'b27', 'Human Health and Disease': 'b28',
  'Strategies for Enhancement in Food Production': 'b29', 'Microbes in Human Welfare': 'b30',
  'Biotechnology: Principles and Processes': 'b31', 'Biotechnology and its Applications': 'b32',
  'Organisms and Populations': 'b33', 'Ecosystem': 'b34',
  'Biodiversity and Conservation': 'b35', 'Environmental Issues': 'b36',
  'Cell: Structure & Function': ['b8', 'b10'],
  'Genetics & Evolution': ['b25', 'b26', 'b27'],
  'Human Physiology': ['b16', 'b17', 'b18', 'b19', 'b20'],
  'Reproduction': ['b21', 'b22', 'b23', 'b24'],
}

const getQCount = (chapterId, questions) => {
  const name = chapterIdToName[chapterId]
  return questions.filter(q => q.chapter === (name || chapterId)).length
}

export default function MCQPractice() {
  const navigate = useNavigate()
  const examType = useStore(s => s.examType) || 'neet'
  const isUpsc = examType === 'upsc'
  const subjects = isUpsc ? upscSubjects : neetSubjects
  const allChapters = isUpsc ? upscAllChapters : neetAllChapters
  const [phase, setPhase] = useState('setup')
  useEffect(() => { setHideNav(phase === 'quiz' || phase === 'result'); return () => setHideNav(false) }, [phase])
  const [selectedSubjects, setSelectedSubjects] = useState(isUpsc ? ['gs1'] : ['biology'])
  const [selectedChapters, setSelectedChapters] = useState([])
  const [numQ, setNumQ] = useState(10)
  const [search, setSearch] = useState('')
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [answers, setAnswers] = useState([])
  const [mascotMood, setMascotMood] = useState('default')
  const [mascotKey, setMascotKey] = useState(0)
  const [dbQuestions, setDbQuestions] = useState([])
  const [dbLoaded, setDbLoaded] = useState(false)
  const [poolWarning, setPoolWarning] = useState(null)
  const { addXP, updateStats, stats, setHideNav, user } = useStore()
  const play = useSound()
  const [localQ, setLocalQ] = useState([])

  const [prediction, setPrediction] = useState(null)
  const streakRef = useRef(0)
  const answeredRef = useRef(0)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [expandedCards, setExpandedCards] = useState([])

  useEffect(() => {
    if (isUpsc) {
      setLocalQ(upscMCQs.map((q, i) => ({ ...q, id: `upsc-${i}` })))
    } else {
      getMcqBank().then(bank => {
        const all = []
        for (const subject of ['physics', 'chemistry', 'biology']) {
          (bank[subject] || []).forEach(q => all.push({ ...q, subject }))
        }
        setLocalQ(all)
      })
    }
  }, [isUpsc])

  useEffect(() => {
    const fetchDb = async () => {
      if (!supabase || !hasQuestionsTable) { setDbLoaded(true); return }
      try {
        const examFilter = isUpsc ? 'upsc' : 'neet'
        const { data } = await supabase.from('questions').select('*').eq('exam_type', examFilter)
        if (data) {
          const mapped = data.map(q => ({
            id: q.id, chapter: q.chapter, subject: q.subject, q: q.question,
            options: [q.option_a, q.option_b, q.option_c, q.option_d],
            ans: q.correct_option, explanation: q.explanation || '',
            difficulty: q.difficulty, source: q.source,
          }))
          setDbQuestions(mapped)
        }
      } catch (e) { console.warn('DB fetch error', e) }
      setDbLoaded(true)
    }
    fetchDb()
  }, [])

  useEffect(() => {
    if (phase !== 'quiz') return
    const onKey = (e) => {
      const n = parseInt(e.key)
      if (n >= 1 && n <= 4 && !submitted) setSelected(n - 1)
      if (e.key === 'Enter') {
        if (submitted) handleNext()
        else if (selected !== null) setSubmitted(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, submitted, selected, current])

  // Mascot mood based on answer correctness
  useEffect(() => {
    if (submitted && selected !== null) {
      const correct = selected === questions[current]?.ans
      setMascotMood(correct ? 'celebration' : 'sad')
      setMascotKey(k => k + 1)
      play(correct ? 'correct' : 'wrong')
    } else {
      setMascotMood('default')
    }
  }, [submitted, current])

  // Track answer streak & question count
  useEffect(() => {
    if (!submitted || selected === null || !questions[current]) return
    const correct = selected === questions[current].ans
    streakRef.current = correct ? streakRef.current + 1 : 0
    answeredRef.current++
  }, [submitted])

  const allQ = useMemo(() => localQ.length ? localQ : dbQuestions, [dbQuestions, localQ])

  const subjectChapters = subjects.filter(s => selectedSubjects.includes(s.id)).flatMap(s => s.chapters) || []
  // chapters grouped by their parent subject
  const subjectChaptersGrouped = subjects.filter(s => selectedSubjects.includes(s.id)).map(s => ({
    subject: s,
    chapters: s.chapters.filter(c => ENABLED_CHAPTERS.has(c.id) && c.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
      const aE = ENABLED_CHAPTERS.has(a.id) ? 0 : 1
      const bE = ENABLED_CHAPTERS.has(b.id) ? 0 : 1
      return aE - bE
    }),
  })).filter(g => g.chapters.length > 0)
  const sortedChapters = [...subjectChapters].sort((a, b) => {
    const aE = ENABLED_CHAPTERS.has(a.id) ? 0 : 1
    const bE = ENABLED_CHAPTERS.has(b.id) ? 0 : 1
    return aE - bE
  })
  const filtered = sortedChapters.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const totalQInSelected = useMemo(() => {
    return selectedChapters.reduce((sum, cid) => sum + getQCount(cid, allQ), 0)
  }, [selectedChapters, allQ])

  const toggle = (id) => {
    if (!ENABLED_CHAPTERS.has(id)) return
    setPoolWarning(null)
    setSelectedChapters(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])
  }

  const startQuiz = (count) => {
    const n = count || numQ
    setPoolWarning(null)
    let pool = allQ
    if (selectedChapters.length > 0) {
      pool = allQ.filter(q => {
        const qcOrig = (q.chapter || '').trim()
        const qc = qcOrig.toLowerCase().trim()
        return selectedChapters.some(cid => {
          const ch = allChapters.find(c => c.id === cid)
          if (!ch) return false
          const cn = ch.name.toLowerCase().trim()
          if (qc === cn || qc === cn.replace('&', 'and')) {
            const sameSubj = !allChapters.some(c => c.name.toLowerCase().trim() === qc && c.subject !== ch.subject)
            return sameSubj || q.subject === ch.subject
          }
          const mapped = chapterNameToIdMap[qcOrig]
          if (mapped) {
            const ids = Array.isArray(mapped) ? mapped : [mapped]
            if (ids.includes(cid)) {
              const mappedSubj = allChapters.find(c => c.id === cid)?.subject
              if (mappedSubj === ch.subject) return true
            }
          }
          return false
        })
      })
    }
    if (!pool.length) { setPoolWarning('no_questions'); return }
    if (pool.length < n) setPoolWarning(`only_${pool.length}`)
    const qs = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(n, pool.length))
    setQuestions(qs); setAnswers([]); setCurrent(0); setSelected(null); setSubmitted(false); setPhase('quiz')
    streakRef.current = 0; answeredRef.current = 0
  }

  const [oneMore, setOneMore] = useState(false)

  const finishQuiz = (finalAnswers) => {
    const correct = finalAnswers.filter(a => a.correct).length
    addXP(correct * 10); updateStats(correct, finalAnswers.length, selectedSubjects[0] || 'upsc')
    const { userId, examType: et, saveTopicScore, recordQuestionAttempt } = useStore.getState()
    finalAnswers.forEach(a => {
      recordQuestionAttempt(a.q.topicId || a.q.chapter_id || a.q.chapter || '', a.correct, 0, selectedSubjects[0] || 'upsc')
    })
    upsertTodayStats({ userId, examType: et || 'neet', deltaQ: finalAnswers.length, deltaCorrect: correct })
    const pct = Math.round((correct / finalAnswers.length) * 100)
    const chapterStats = {}
    finalAnswers.forEach(a => {
      const ch = a.q.chapter || a.q.chapter_id || ''
      if (!ch) return
      if (!chapterStats[ch]) chapterStats[ch] = { correct: 0, total: 0 }
      chapterStats[ch].total++
      if (a.correct) chapterStats[ch].correct++
    })
    selectedChapters.forEach(cid => {
      try {
        const prevCorrect = parseInt(localStorage.getItem(`mcq_correct_${cid}`) || '0') || 0
        const prevTotal = parseInt(localStorage.getItem(`mcq_total_${cid}`) || '0') || 0
        const chStat = chapterStats[cid]
        const addCorrect = chStat ? chStat.correct : 0
        const addTotal = chStat ? chStat.total : 0
        const cumCorrect = prevCorrect + addCorrect
        const cumTotal = prevTotal + addTotal
        localStorage.setItem(`mcq_correct_${cid}`, `${cumCorrect}`)
        localStorage.setItem(`mcq_total_${cid}`, `${cumTotal}`)
        localStorage.setItem(`mcq_score_${cid}`, `${cumTotal > 0 ? Math.round((cumCorrect / cumTotal) * 100) : 0}`)
        const prev = parseInt(localStorage.getItem(`mcq_progress_${cid}`) || '0') || 0
        localStorage.setItem(`mcq_progress_${cid}`, `${prev + finalAnswers.length}`)
      } catch {}
    })
    Object.entries(chapterStats).forEach(([chId, st]) => {
      saveTopicScore(chId, st.correct, st.total)
    })
    setPhase('result')
  }

  const handleNext = () => {
    const newAnswers = [...answers, { q: questions[current], selected, correct: selected === questions[current].ans }]
    setAnswers(newAnswers)
    if (current + 1 >= questions.length) {
      const streak = streakRef.current
      if (streak >= 3 && streak % 5 !== 0) {
        setOneMore(true)
        return
      }
      finishQuiz(newAnswers)
    } else {
      setCurrent(c => c + 1); setSelected(null); setSubmitted(false)
    }
  }

  const handleOneMore = () => {
    setOneMore(false)
    const remaining = allQ.filter(q => !answers.some(a => a.q.id === q.id))
    if (remaining.length === 0) { finishQuiz(answers); return }
    const extra = remaining.sort(() => Math.random() - 0.5).slice(0, 1)
    setQuestions([...questions, ...extra])
    setCurrent(current + 1); setSelected(null); setSubmitted(false)
  }

  const enabledFiltered = filtered.filter(c => ENABLED_CHAPTERS.has(c.id))
  const allCurrentSelected = enabledFiltered.length > 0 && enabledFiltered.every(c => selectedChapters.includes(c.id))
  const toggleAll = () => {
    if (allCurrentSelected) setSelectedChapters(p => p.filter(id => !enabledFiltered.some(c => c.id === id)))
    else setSelectedChapters(p => [...new Set([...p, ...enabledFiltered.map(c => c.id)])])
  }

  const subjectsWithChapters = useMemo(() => {
    if (!allQ.length) return []
    return subjects.filter(s => selectedSubjects.includes(s.id)).map(sub => ({
      ...sub,
      chapters: sub.chapters
        .map(ch => {
          const qc = getQCount(ch.id, allQ)
          return { ...ch, qCount: qc }
        })
        .filter(ch => ch.name.toLowerCase().includes(search.toLowerCase()) && ch.qCount > 0),
    })).filter(s => s.chapters.length > 0)
  }, [selectedSubjects, allQ, search])

  const selectedQuestions = useMemo(() => {
    let sum = 0
    subjectsWithChapters.forEach(s => s.chapters.forEach(ch => { if (selectedChapters.includes(ch.id)) sum += ch.qCount }))
    return sum
  }, [subjectsWithChapters, selectedChapters])

  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  const [questCount, setQuestCount] = useState(20)

  // ── SETUP ──
  if (phase === 'setup') return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', overflowX: 'hidden', paddingBottom: 140 }}>
      <div className="page-header-light" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <div style={{ width: '100%', textAlign: 'center' }}>
          <div className="page-header-title" style={{ color: 'var(--text)' }}>
            MCQ Practice
          </div>
        </div>

        {/* Search bar */}
        <div style={{ width: '100%', maxWidth: '100%' }}>
          <div style={{
            width: '100%', height: 52,
            background: '#fff',
            border: '2px solid #e5e5e5',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
            boxSizing: 'border-box',
          }}>
            <Search size={17} color="#afafaf" style={{ flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search chapter name..."
              style={{
                border: 'none', outline: 'none', flex: 1,
                fontSize: 15, fontFamily: 'Satoshi, sans-serif',
                color: '#333', background: 'transparent',
              }}
            />
          </div>
        </div>

        {/* Subject pills — multi-select */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, width: '100%' }}>
          {subjects.map(s => {
            const isActive = selectedSubjects.includes(s.id)
            return (
              <button key={s.id}
                onClick={() => {
                  if (isActive && selectedSubjects.length === 1) return
                  setSelectedSubjects(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])
                }}
                onMouseDown={e => {
                  e.currentTarget.style.transform = 'translateY(3px)'
                  e.currentTarget.style.boxShadow = isActive ? '0 1px 0 #b35c00' : '0 1px 0 rgba(0,0,0,0.2)'
                }}
                onMouseUp={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = isActive ? '0 4px 0 #b35c00' : '0 4px 0 rgba(0,0,0,0.2)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = isActive ? '0 4px 0 #b35c00' : '0 4px 0 rgba(0,0,0,0.2)'
                }}
                onTouchStart={e => {
                  e.currentTarget.style.transform = 'translateY(3px)'
                  e.currentTarget.style.boxShadow = isActive ? '0 1px 0 #b35c00' : '0 1px 0 rgba(0,0,0,0.2)'
                }}
                onTouchEnd={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = isActive ? '0 4px 0 #b35c00' : '0 4px 0 rgba(0,0,0,0.2)'
                }}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  cursor: 'pointer',
                  fontFamily: 'Satoshi, sans-serif',
                  fontSize: 14,
                  fontWeight: 800,
                  textAlign: 'center',
                  letterSpacing: '0.3px',
                  transition: 'transform 0.08s, box-shadow 0.08s',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  ...(isActive ? {
                    background: '#FF9944',
                    color: '#fff',
                    border: '2px solid #FF9944',
                    boxShadow: '0 4px 0 #b35c00',
                  } : {
                    background: 'transparent',
                    color: 'var(--text-2)',
                    border: '2px solid var(--border)',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.2)',
                  }),
                }}>
                {s.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px', marginTop: -4 }}>
        {!allQ.length ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Loading questions...</div>
          </div>
        ) : (
        <>
        {/* Select all row */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          gap: 10, height: 40, marginBottom: 8,
        }}>
          <span className="section-label">Select all</span>
          <div onClick={toggleAll} style={{
            width: 22, height: 22,
            borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: allCurrentSelected ? 'var(--accent)' : 'var(--surface-alt)',
            border: `1.5px solid ${allCurrentSelected ? 'var(--accent)' : 'var(--border)'}`,
            transition: 'all 0.15s',
          }}>
            {allCurrentSelected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>

        {/* Chapter cards grid — grouped by subject */}
        {subjectsWithChapters.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subjectsWithChapters.map((sub, si) => (
              <div key={sub.id}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: sub.color,
                  marginBottom: 6, marginLeft: 2, letterSpacing: 0.5,
                }}>
                  {sub.name} · {sub.subtitle}
                </div>
                {sub.chapters.map((ch, cardIdx) => {
                  const sel = selectedChapters.includes(ch.id)
                  const lastScore = getLastScore(ch.id)
                  const progress = getProgress(ch.id)
                  const isWeak = lastScore !== null && lastScore < 60

                  return (
                    <motion.div
                      key={ch.id}
                      onClick={() => toggle(ch.id)}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        border: sel ? '2px solid #FF9944' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 6,
                        transition: 'all 0.2s',
                        boxShadow: sel 
                          ? '0 2px 8px rgba(255,153,68,0.2)' 
                          : '0 1px 4px rgba(0,0,0,0.06)',
                      }}
                    >
                      {/* Chapter number badge */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: sel ? '#FF9944' : '#F3F4F6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                        color: sel ? '#fff' : '#6B7280',
                        fontFamily: 'Satoshi, sans-serif',
                        transition: 'all 0.2s',
                      }}>
                        {ch.qCount}
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 700, color: '#1a1a1a',
                          fontFamily: 'Satoshi, sans-serif', lineHeight: 1.3,
                          marginBottom: 4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {ch.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {progress > 0 && (
                            <div style={{ flex: 1, height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 99, overflow: 'hidden', maxWidth: 80 }}>
                              <div style={{ height: '100%', width: `${progress}%`, background: sub.color, borderRadius: 99 }} />
                            </div>
                          )}
                          {isWeak && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.15)', padding: '2px 7px', borderRadius: 99 }}>
                              Weak
                            </span>
                          )}
                          {lastScore && !isWeak && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.12)', padding: '2px 7px', borderRadius: 99 }}>
                              {lastScore}%
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{ch.qCount}Q</span>
                        </div>
                      </div>

                      {/* Selection indicator */}
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        background: sel ? 'var(--accent)' : 'var(--surface-alt)',
                        border: `2px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {sel && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>No chapters found</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {search ? `Nothing matches "${search}".` : 'No questions available for the selected subjects.'}
            </div>
          </div>
        )}
        </>)}
      </div>

      {/* Fixed bottom action bar */}
      <div style={{
        position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '0 20px',
        zIndex: 50,
      }}>
        {poolWarning === 'no_questions' && (
          <div style={{
            background: 'var(--error-light)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 8,
            fontSize: 12, color: 'var(--error-dark)', fontWeight: 600, border: '1px solid var(--error)',
          }}>
            No questions found for the selected chapters.
          </div>
        )}
        {poolWarning && poolWarning.startsWith('only_') && (
          <div style={{
            background: 'var(--surface-alt)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 8,
            fontSize: 12, color: 'var(--text-2)', fontWeight: 600, border: '1px solid var(--border)',
          }}>
            Only {poolWarning.replace('only_', '')} questions available.
          </div>
        )}
        <div style={{
          background: 'var(--card-bg)', backdropFilter: 'blur(16px)',
          borderRadius: 28, padding: '18px 18px 24px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-float)',
          display: selectedChapters.length === 0 ? 'none' : 'block',
        }}>
          {selectedChapters.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 14 }}>{selectedChapters.length}</span>
              <span>chapters</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border)' }} />
              <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 14 }}>{selectedQuestions}</span>
              <span>questions</span>
            </div>
          )}
          {selectedChapters.length === 0 ? (
            <div style={{
              width: '100%', padding: '14px 0', borderRadius: 14,
              background: 'var(--surface-alt)', border: '1px solid var(--border)',
              textAlign: 'center', fontSize: 13, fontWeight: 600,
              color: 'var(--text-3)', cursor: 'default', fontFamily: 'Satoshi, sans-serif',
            }}>
              Select chapters to begin
            </div>
          ) : (
            <button
              disabled={selectedQuestions === 0}
              onClick={() => { if (selectedQuestions === 0) return; setCampaignModalOpen(true) }}
              className="btn btn-primary"
              style={{
                cursor: selectedQuestions === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                letterSpacing: 0.3, fontSize: 15,
              }}>
              Begin Quiz
              {selectedQuestions > 0 && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>}
            </button>
          )}
        </div>
      </div>

      {/* Start modal */}
      {campaignModalOpen && (
        <div onClick={() => setCampaignModalOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card-bg)', borderRadius: 28, padding: 28, width: '100%', maxWidth: 320,
              boxShadow: 'var(--shadow-strong)',
              border: '1px solid var(--border)',
            }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4, textAlign: 'center' }}>
              Ready to practice
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 22, textAlign: 'center' }}>
              How many questions?
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
              {[10, 25, 50, selectedQuestions].filter((v, i, a) => a.indexOf(v) === i).map(n => (
                <button key={n} onClick={() => setQuestCount(n)} style={{
                  flex: 1, padding: '10px 0',
                  border: `1.5px solid ${questCount === n ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12,
                  background: questCount === n ? 'var(--primary-alt-light)' : 'var(--surface-alt)',
                  color: questCount === n ? 'var(--accent)' : 'var(--text-3)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Satoshi, sans-serif',
                  transition: 'all 0.12s',
                }}>
                  {n === selectedQuestions ? 'All' : n}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12, textAlign: 'center' }}>
              How many will you get right?
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
              {[questCount, Math.round(questCount * 0.8), Math.round(questCount * 0.6), Math.round(questCount * 0.4)].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a).map(n => (
                <button key={n} onClick={() => setPrediction(n)} style={{
                  flex: 1, padding: '10px 0',
                  border: `1.5px solid ${prediction === n ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12,
                  background: prediction === n ? 'var(--primary-alt-light)' : 'var(--surface-alt)',
                  color: prediction === n ? 'var(--accent)' : 'var(--text-3)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Satoshi, sans-serif',
                  transition: 'all 0.12s',
                }}>
                  {n}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCampaignModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={() => { setCampaignModalOpen(false); startQuiz(questCount) }}
                className="btn btn-primary"
                style={{
                flex: 1, padding: '13px', fontSize: 14, letterSpacing: 0.3,
              }}>
                Start
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )

  // ── RESULT ──
  if (phase === 'result') {
    const correct = answers.filter(a => a.correct).length
    const pct = Math.round((correct / answers.length) * 100)
    const perfect = pct === 100
    const good = pct >= 80
    const wrong = answers.filter(a => !a.correct)

    const chapterName = selectedChapters.length > 0
      ? allChapters.find(c => c.id === selectedChapters[0])?.name || ''
      : ''

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
        onClick={() => { setPhase('setup'); setAnswers([]); setSelectedChapters([]) }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: 24, width: '100%', maxWidth: 360,
          maxHeight: '90vh', overflowY: 'auto', padding: '32px 24px 24px',
        }}>
          {/* Score */}
          <div style={{ textAlign: 'center' }}>
            {perfect && (
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FF9600', marginBottom: 4 }}>
                🎉 PERFECT SCORE
              </div>
            )}
            <div style={{ fontSize: 56, fontWeight: 900, color: '#1A1A1A', letterSpacing: -3, lineHeight: 1 }}>
              {pct}%
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#777', marginTop: 4 }}>
              {correct}/{answers.length} Correct
            </div>
          </div>

          {/* Mascot */}
          <div style={{ height: 140, marginTop: 2, display: 'flex', justifyContent: 'center' }}>
            <MascotFeedback mood={perfect || good ? 'celebration' : 'sad'} animKey={Date.now()} />
          </div>

          {/* Insight: mastery */}
          <div style={{
            background: '#F7F7F7', borderRadius: 14, padding: '12px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
              🧠 {subjects.find(s => s.id === selectedSubjects[0])?.name || selectedSubjects[0]} Mastery +{correct * 2}%
            </div>
            {chapterName && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{chapterName}</div>}
          </div>

          {/* Review mistakes */}
          {wrong.length > 0 && !reviewOpen && (
            <button onClick={() => setReviewOpen(true)}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, marginTop: 12,
                border: '1.5px solid #E8E8E8', background: '#fff',
                cursor: 'pointer', fontFamily: 'Satoshi, sans-serif',
                fontSize: 13, fontWeight: 700, color: '#FF4B4B',
              }}>
              Review {wrong.length} {wrong.length === 1 ? 'Mistake' : 'Mistakes'}
            </button>
          )}

          {/* Continue */}
          <button onClick={() => { setPhase('setup'); setAnswers([]); setSelectedChapters([]) }}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none', marginTop: 10,
              background: good || perfect ? '#FF9600' : '#CCC',
              color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'Satoshi, sans-serif',
              boxShadow: good || perfect ? '0 4px 0 #CC7A00' : 'none',
              transition: 'transform 0.08s, box-shadow 0.08s',
            }}
            onMouseDown={e => { if (good || perfect) { e.currentTarget.style.transform = 'translateY(3px)'; e.currentTarget.style.boxShadow = '0 1px 0 #CC7A00' } }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = good || perfect ? '0 4px 0 #CC7A00' : 'none' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = good || perfect ? '0 4px 0 #CC7A00' : 'none' }}>
            {perfect ? 'Next Challenge →' : good ? 'Continue →' : 'Try Again'}
          </button>

          {/* Review panel */}
          {reviewOpen && (
            <div style={{ marginTop: 12, maxHeight: '35vh', overflowY: 'auto' }}>
              {wrong.map((a, i) => {
                const selLetter = String.fromCharCode(65 + a.selected)
                const ansLetter = String.fromCharCode(65 + a.q.ans)
                return (
                  <div key={i} style={{ padding: '12px 14px', background: '#FFF0F0', borderRadius: 14, marginBottom: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#333', lineHeight: 1.5, margin: '0 0 6px' }}>{a.q.q}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,75,75,0.1)', color: '#FF4B4B' }}>
                        ✗ {selLetter}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,150,0,0.1)', color: '#FF9600' }}>
                        ✓ {ansLetter}
                      </span>
                    </div>
                    {a.q.explanation && (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: '#fff', borderRadius: 10, fontSize: 11, color: '#666', lineHeight: 1.6 }}>
                        {a.q.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={() => setReviewOpen(false)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 12, border: 'none',
                  background: 'transparent', cursor: 'pointer', fontFamily: 'Satoshi, sans-serif',
                  fontSize: 12, fontWeight: 600, color: '#999', marginBottom: 8,
                }}>
                Hide Review ▲
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── QUIZ ──
  const q = questions[current]
  const progress = ((current + (submitted ? 1 : 0)) / questions.length) * 100
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--page-bg)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header — fixed height */}
      <div style={{ padding: '44px 16px 12px', flexShrink: 0, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn-dark" onClick={() => { setPhase('setup'); setQuestions([]); setCurrent(0); setSelected(null); setSubmitted(false); setAnswers([]) }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }}
              style={{ height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {streakRef.current >= 2 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: 'rgba(255,150,0,0.15)', borderRadius: 99,
                padding: '4px 8px',
              }}>
                <span style={{ fontSize: 13 }}>🔥</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#FF9600' }}>{streakRef.current}</span>
              </div>
            )}
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>{current + 1}/{questions.length}</span>
          </div>
        </div>
      </div>

      <MascotFeedback mood={mascotMood} animKey={mascotKey} />

      {/* Question zone — scrollable, takes remaining space */}
      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
          style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '18px 16px',
            border: '2px solid #e5e5e5', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.65, color: '#1a1a1a', margin: 0 }}>{q.q}</p>
          </div>
          {submitted && q.explanation && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: selected === q.ans ? '#d1fae5' : '#fee2e2',
                border: `1.5px solid ${selected === q.ans ? '#10b981' : '#ef4444'}`,
                borderRadius: 14, padding: '12px 14px', marginTop: 10,
                fontSize: 13, color: '#374151', lineHeight: 1.6,
              }}>
              {q.explanation}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <div style={{
        flexShrink: 0, padding: '24px 16px 8px',
        display: 'flex', flexDirection: 'column', gap: 7,
        minHeight: 248, maxHeight: '35vh',
      }}>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.ans
          const isWrong = submitted && i === selected && !isCorrect
          const isRight = submitted && isCorrect
          const isSel = !submitted && selected === i
          return (
            <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => !submitted && setSelected(i)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0 14px', borderRadius: 14, border: 'none',
                cursor: submitted ? 'default' : 'pointer',
                fontFamily: 'inherit', textAlign: 'left', width: '100%',
                background: isRight ? '#d1fae5' : isWrong ? '#fee2e2' : isSel ? '#fff7ed' : '#fff',
                boxShadow: isSel ? '0 0 0 2px #FF9944' : isRight ? '0 0 0 2px #10b981' : isWrong ? '0 0 0 2px #ef4444' : '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.15s', overflow: 'hidden',
              }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isRight ? '#10b981' : isWrong ? '#ef4444' : isSel ? '#FF9944' : '#F3F4F6',
                color: (isRight || isWrong || isSel) ? '#fff' : '#6B7280',
                fontSize: 12, fontWeight: 800,
              }}>
                {String.fromCharCode(65 + i)}
              </div>
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: isRight ? '#065f46' : isWrong ? '#7f1d1d' : '#1a1a1a',
                lineHeight: 1.3,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>{opt}</span>
            </motion.button>
          )
        })}
      </div>

      {/* Action button — fixed height */}
      <div style={{ flexShrink: 0, padding: '4px 16px 16px' }}>
        {oneMore ? (
          <div style={{
            background: 'var(--accent)', borderRadius: 20, padding: '16px 18px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
              You're on a {streakRef.current}-answer streak.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>
              One more question for {streakRef.current + 1}?
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={handleOneMore} style={{
                padding: '8px 20px', borderRadius: 12, border: 'none',
                background: '#fff', color: 'var(--accent)',
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Satoshi, sans-serif',
              }}>
                One more
              </button>
              <button onClick={() => { setOneMore(false); finishQuiz(answers) }} style={{
                padding: '8px 20px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.4)',
                background: 'transparent', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Satoshi, sans-serif',
              }}>
                See Results
              </button>
            </div>
          </div>
        ) : !submitted
          ? <button className="btn btn-primary"
              style={{ letterSpacing: 0.3, cursor: selected === null ? 'not-allowed' : 'pointer', width: '100%' }}
              onClick={() => { setSubmitted(true) }}
              disabled={selected === null}>
              Check
            </button>
          : <button className="btn btn-primary" style={{ letterSpacing: 0.3, width: '100%' }}
              onClick={handleNext}>
              {current + 1 >= questions.length ? 'See Results' : 'Next →'}
            </button>
        }
      </div>
    </div>
  )
}

// Mascot Feedback
function MascotFeedback({ mood, animKey }) {
  const { rive, RiveComponent } = useRive({
    src: '/latest_mascot.riv',
    autoplay: false,
  })
  const defaultAnims = useRef([])
  const animIdx = useRef(0)
  const toggleRef = useRef(null)

  useEffect(() => {
    if (!rive) return
    const names = rive.animationNames
    defaultAnims.current = ['default reading', 'default 2 blink'].filter(n => names?.includes(n))
    if (!defaultAnims.current.length) {
      defaultAnims.current = names?.filter(n => n.includes('default')) || [names?.[0]]
    }
    if (defaultAnims.current.length) {
      rive.play(defaultAnims.current[0], true)
      if (defaultAnims.current.length > 1) {
        toggleRef.current = setInterval(() => {
          animIdx.current = (animIdx.current + 1) % defaultAnims.current.length
          rive.play(defaultAnims.current[animIdx.current], true)
        }, 4000)
      }
    }
    return () => { if (toggleRef.current) clearInterval(toggleRef.current) }
  }, [rive])

  useEffect(() => {
    if (!rive) return
    if (mood === 'celebration') rive.play('celebration')
    else if (mood === 'sad') rive.play('sad')
  }, [animKey])

  useEffect(() => {
    if (!rive || !defaultAnims.current.length) return
    if (mood === 'default') {
      rive.play(defaultAnims.current[0], true)
    } else if (mood === 'celebration' || mood === 'sad') {
      const timer = setTimeout(() => {
        if (defaultAnims.current.length) rive.play(defaultAnims.current[0], true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [mood])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: 4, paddingBottom: 0, flexShrink: 0 }}>
      <div style={{ width: 160, height: 160 }}>
        <RiveComponent />
      </div>
    </div>
  )
}
