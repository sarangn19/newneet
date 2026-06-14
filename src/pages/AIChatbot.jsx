import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { buildRules, formatPrompt, createSession, buildStudentProfile } from '../lib/behaviorEngine'
import { callAI } from '../lib/callAI'
import { ChevronLeft, Send, Sparkles, BookOpen, MessageSquare, ClipboardList, Search, Trash2, Mic, Volume2, Zap, Rotate3D, ChevronDown, Bookmark } from 'lucide-react'

const MODES = [
  { id: 'explain', label: 'Explain', icon: BookOpen, color: '#3F7DFF', subtitle: 'Understand any topic' },
  { id: 'challenge', label: 'Challenge Me', icon: Zap, color: '#AF52DE', subtitle: 'Test your knowledge' },
  { id: 'debate', label: 'Debate', icon: MessageSquare, color: '#34C759', subtitle: 'Explore perspectives' },
  { id: 'revise', label: 'Revise', icon: Rotate3D, color: '#D4A853', subtitle: 'Quick revision' },
  { id: 'summarise', label: 'Summarise', icon: Search, color: '#3F7DFF', subtitle: 'Concise overview' },
]

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''

const MODE_PROMPTS = {
  explain: `You are a UPSC CSE mentor. Explain the given topic in detail with a structured breakdown including definition, key features, historical background, contemporary relevance, and exam perspective. Use plain text only - no stars, no hashes, no markdown. Use numbered sections and dashes for lists.`,
  challenge: `You are a UPSC CSE mentor. Generate a challenging multiple-choice question on the given topic. Include 4 options (A, B, C, D) and indicate the correct answer after the question. Use plain text only - no stars, no hashes, no markdown.`,
  debate: `You are a UPSC CSE mentor. Present multiple perspectives on the given topic covering different schools of thought, ideological positions, and academic debates. Encourage critical thinking by highlighting areas of agreement and disagreement. Use plain text only - no stars, no hashes, no markdown.`,
  revise: `You are a UPSC CSE mentor. Provide a rapid revision summary of the given topic covering must-know facts, key data points, previous year question patterns, and quick memory aids. Make it concise and exam-focused. Use plain text only - no stars, no hashes, no markdown.`,
  summarise: `You are a UPSC CSE mentor. Provide a concise summary of the given topic covering key points, must-know facts, and UPSC angle. Use dashes for bullet points, no stars, no hashes, no markdown.`,
}

export default function AIChatbot() {
  const navigate = useNavigate()
  const { userId, user } = useStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('explain')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [savedNotes, setSavedNotes] = useState(new Set())
  const [quizState, setQuizState] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(0)
  const [showModePicker, setShowModePicker] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const chatStarted = messages.length > 0 || loading

  const modeObj = MODES.find(m => m.id === mode)
  const ModeIcon = modeObj?.icon || BookOpen

  const dynamicPlaceholders = [
    `Explain ${modeObj?.label === 'Challenge Me' ? 'federalism' : modeObj?.label === 'Revise' ? 'Medieval History' : 'Fundamental Rights'}...`,
    `${modeObj?.label === 'Challenge Me' ? 'Challenge' : modeObj?.label === 'Debate' ? 'Debate' : 'Explain'} ${['Polity','Economy','Environment','History'][placeholderIdx % 4]}...`,
  ]

  useEffect(() => {
    if (chatStarted || loading) return
    const t = setInterval(() => setPlaceholderIdx(i => i + 1), 3000)
    return () => clearInterval(t)
  }, [chatStarted, loading])
  const statusPhrases = {
    explain: ['Understanding your question…', 'Organizing relevant concepts…', 'Preparing explanation…'],
    challenge: ['Analyzing your knowledge gaps…', 'Generating challenging questions…', 'Preparing practice set…'],
    debate: ['Identifying perspectives…', 'Gathering counterarguments…', 'Structuring debate…'],
    revise: ['Scanning key points…', 'Compiling must-know facts…', 'Formatting revision notes…'],
    summarise: ['Extracting key ideas…', 'Condensing information…', 'Writing summary…'],
  }
  const inputRef = useRef(null)
  const endRef = useRef(null)
  const sessionRef = useRef(null)
  if (!sessionRef.current) {
    sessionRef.current = createSession()
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!userId) return
    supabase.from('chat_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10).then(({ data }) => {
      if (data) setHistory(data)
    })
  }, [userId])

  useEffect(() => {
    if (!loading) { setLoadingStatus(0); return }
    const phrases = statusPhrases[mode] || statusPhrases.explain
    const interval = setInterval(() => {
      setLoadingStatus(i => (i + 1) % phrases.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [loading, mode])

  const sendMessage = async (voiceText) => {
    const text = (voiceText || input).trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)

    const profile = buildStudentProfile(useStore.getState())
    const behaviorRules = buildRules(profile, sessionRef.current, text, mode)
    const systemPrompt = formatPrompt(MODE_PROMPTS[mode], behaviorRules)

    const response = await callAI({
      message: text,
      systemPrompt,
      mode,
      groqApiKey: GROQ_API_KEY,
      geminiApiKey: GEMINI_API_KEY,
    })

    setMessages(prev => [...prev, { role: 'bot', text: response }])
    setLoading(false)

    if (mode === 'quiz') {
      const optMatch = response.match(/([A-D]\)\s*[^\n]+)/g)
      const ansMatch = response.match(/Answer\s*:\s*([A-D])/i)
      if (optMatch && ansMatch) {
        setQuizState({
          question: response.split('\n')[0].replace(/^Q[.:]?\s*/i, ''),
          options: optMatch.map(o => o.replace(/^[A-D]\)\s*/, '')),
          correct: ansMatch[1].toUpperCase(),
          answered: null,
        })
      } else {
        setQuizState(null)
      }
    }

    if (userId) {
      supabase.from('chat_history').insert({
        user_id: userId, message: text, response, mode,
      }).then(({ data }) => {
        if (data?.[0]) setHistory(prev => [data[0], ...prev.slice(0, 19)])
      })
    }
  }

  const saveAsNote = async (content, userQuestion) => {
    if (!userId) return
    await supabase.from('notes').insert({
      user_id: userId, title: userQuestion || 'AI Chat Note', content,
    })
    setSavedNotes(prev => new Set([...prev, content.slice(0, 50)]))
  }

  const startVoice = () => {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) {
        setMessages(prev => [...prev, { role: 'bot', text: '❗ Voice not supported. Open in Chrome or Edge.' }])
        return
      }
      if (listening) { speechSynthesis.cancel(); setListening(false); return }
      const r = new SR()
      r.lang = 'en-US'
      r.interimResults = true
      r.continuous = true
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript.trim()
          if (e.results[i].isFinal) {
            if (!transcript) continue
            r.stop()
            sendMessage(transcript)
          } else {
            setInput(transcript)
          }
        }
      }
      r.onerror = (ev) => {
        setListening(false)
        const msg = ev.error === 'not-allowed' ? '❗ Mic blocked. Allow mic access in browser settings.'
          : ev.error === 'audio-capture' ? '❗ No mic found. Connect a microphone.'
          : ev.error === 'no-speech' ? '' : `❗ Mic error: ${ev.error}`
        if (msg) setMessages(prev => [...prev, { role: 'bot', text: msg }])
      }
      r.onend = () => setListening(false)
      setListening(true)
      r.start()
    } catch (err) {
      setListening(false)
      setMessages(prev => [...prev, { role: 'bot', text: '❗ Mic failed: ' + err.message }])
    }
  }

  const [flashcards, setFlashcards] = useState(null)
  const [flashcardIdx, setFlashcardIdx] = useState(0)
  const [flashcardFlipped, setFlashcardFlipped] = useState(false)
  const [genFlashcards, setGenFlashcards] = useState(false)

  const generateFlashcards = async (content) => {
    if (!GROQ_API_KEY) return
    setGenFlashcards(true)
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'Generate 5-8 flashcard question-answer pairs from the given text. Return ONLY a JSON array like: [{"q":"Question?","a":"Answer."}]. No other text.' },
            { role: 'user', content },
          ],
          temperature: 0.5,
          max_tokens: 2048,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data?.choices?.[0]?.message?.content?.trim() || ''
        const json = JSON.parse(text.replace(/```json|```/g, '').trim())
        if (Array.isArray(json)) {
          setFlashcards(json)
          setFlashcardIdx(0)
          setFlashcardFlipped(false)
        }
      }
    } catch (e) { console.warn('Flashcard gen error:', e) }
    setGenFlashcards(false)
  }

  const clearHistory = async () => {
    if (!userId) return
    await supabase.from('chat_history').delete().eq('user_id', userId)
    setHistory([])
    setMessages([
      { role: 'bot', text: 'Chat history cleared. Start fresh!' },
    ])
  }

  return (
    <motion.div layout style={{ background: 'var(--page-bg)', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <style>{`.chat-input::placeholder { color: var(--text-3) }`}</style>

      {/* Header */}
      <div style={{ background: 'var(--card-bg)', padding: '48px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{scale:0.96}} onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <ChevronLeft size={18} color="var(--text)" />
          </motion.button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>AI Mentor</div>
            {!chatStarted ? (
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Your intelligent UPSC study companion</div>
            ) : (
              <motion.button onClick={() => setShowModePicker(true)} whileTap={{ scale: 0.97 }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-2)', fontFamily: 'inherit' }}>
                {modeObj?.label}
                <ChevronDown size={10} />
              </motion.button>
            )}
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={() => setShowHistory(!showHistory)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', position: 'relative',
          }}>
            <MessageSquare size={18} color="var(--text-2)" />
            {history.length > 0 && (
              <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />
            )}
          </motion.button>
        </div>
      </div>

      {/* ═══════ DISCOVERY MODE — empty chat ═══════ */}
      {!chatStarted && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Premium mode cards */}
          <div style={{ padding: '16px 14px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MODES.map((m, i) => {
              const Icon = m.icon
              const active = mode === m.id
              return (
                <motion.button key={m.id} onClick={() => setMode(m.id)}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 12px',
                    borderRadius: 16, border: active ? `1.5px solid ${m.color}` : '1px solid var(--border)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    background: active ? `${m.color}0D` : 'var(--card-bg)',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: active ? m.color : 'var(--surface-alt)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'background 0.2s',
                  }}>
                    <Icon size={16} color={active ? '#fff' : 'var(--text-3)'} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: active ? m.color : 'var(--text)' }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{m.subtitle}</div>
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Suggested prompts */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 20px 20px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14, fontWeight: 500 }}>
              Ask your mentor anything
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
              {['Explain federalism', 'Quiz me on Polity', 'Revise Ancient India'].map((s, i) => (
                <motion.button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.08 } }}
                  style={{
                    padding: '12px 16px', borderRadius: 14, border: '1px solid var(--border)',
                    background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 14, color: 'var(--text-2)', fontWeight: 500, textAlign: 'left',
                    width: '100%',
                  }}>
                  {s}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ACTIVE CONVERSATION MODE ═══════ */}
      {chatStarted && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {/* Compact mode pills — max 48px */}
          <div style={{ padding: '6px 14px', display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid var(--border)', minHeight: 48, alignItems: 'center' }}>
            {MODES.map(m => {
              const Icon = m.icon
              const active = mode === m.id
              return (
                <motion.button key={m.id} onClick={() => setMode(m.id)}
                  whileTap={{ scale: 0.97 }}
                  layout
                  style={{
                    padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
                    background: active ? m.color : 'var(--surface-alt)',
                    color: active ? '#fff' : 'var(--text-2)',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'background 0.2s, color 0.2s',
                    flexShrink: 0,
                  }}>
                  <Icon size={13} />
                  {m.label}
                </motion.button>
              )
            })}
          </div>

          {/* Messages area — fills remaining space */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', minHeight: 0 }}>
            <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{ marginBottom: 12 }}
              >
                {msg.role === 'user' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '80%', padding: '12px 16px', borderRadius: 16, fontSize: 14, lineHeight: 1.5,
                      background: 'var(--primary)', color: '#fff',
                      borderBottomRightRadius: 4,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{
                      background: 'var(--card-bg)', borderRadius: 16, padding: 16,
                      border: '1px solid var(--border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      maxWidth: '88%',
                    }}>
                      <div style={{
                        fontSize: 14, lineHeight: 1.7, color: 'var(--text)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {msg.text}
                      </div>
                      {/* Contextual actions */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                        <motion.button whileTap={{scale:0.96}} onClick={() => saveAsNote(msg.text, messages[i-1]?.text)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: 'none',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: savedNotes.has(msg.text.slice(0, 50)) ? 'var(--success-light)' : 'var(--surface-alt)',
                            color: savedNotes.has(msg.text.slice(0, 50)) ? 'var(--success)' : 'var(--text-2)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                          <Bookmark size={12} />
                          {savedNotes.has(msg.text.slice(0, 50)) ? 'Saved' : 'Save'}
                        </motion.button>
                        <motion.button whileTap={{scale:0.96}} onClick={() => generateFlashcards(msg.text)}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: 'none',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: 'var(--surface-alt)', color: 'var(--text-2)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                          <Rotate3D size={12} />
                          Flashcards
                        </motion.button>
                        <motion.button whileTap={{scale:0.96}} onClick={() => { const u = new SpeechSynthesisUtterance(msg.text); u.rate = 0.9; speechSynthesis.speak(u) }}
                          style={{
                            padding: '6px 12px', borderRadius: 8, border: 'none',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: 'var(--surface-alt)', color: 'var(--text-2)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                          <Volume2 size={12} />
                          Listen
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                <div style={{
                  background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16,
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                    {(statusPhrases[mode] || statusPhrases.explain)[loadingStatus]}
                  </span>
                </div>
              </motion.div>
            )}
            <div ref={endRef} />

            {quizState && (
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16,
                padding: 16, marginTop: 4,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{quizState.question}</div>
                {quizState.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx)
                  const isSelected = quizState.answered === letter
                  const isCorrect = quizState.correct === letter
                  const showResult = quizState.answered !== null
                  let bg = 'var(--surface-alt)'
                  let border = '1px solid var(--border)'
                  let color = 'var(--text)'
                  if (showResult) {
                    if (isCorrect) { bg = 'var(--success-light)'; border = '1px solid var(--success)'; color = 'var(--success-dark)' }
                    else if (isSelected) { bg = 'var(--error-light)'; border = '1px solid var(--error)'; color = 'var(--error-dark)' }
                  } else if (isSelected) { bg = 'var(--primary-light)'; border = '1px solid var(--primary)'; color = 'var(--primary)' }
                  return (
                    <motion.button key={idx} whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (quizState.answered !== null) return
                        setQuizState(s => ({ ...s, answered: letter }))
                      }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '9px 12px', borderRadius: 10, marginBottom: 6,
                        fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: quizState.answered ? 'default' : 'pointer',
                        background: bg, border, color, boxSizing: 'border-box',
                      }}>
                      <strong style={{ marginRight: 8 }}>{letter}.</strong> {opt}
                    </motion.button>
                  )
                })}
                {quizState.answered && (
                  <div style={{
                    fontSize: 12, textAlign: 'center', marginTop: 8, fontWeight: 600,
                    color: quizState.answered === quizState.correct ? 'var(--success)' : 'var(--error)',
                  }}>
                    {quizState.answered === quizState.correct ? 'Correct!' : 'Incorrect. The answer was ' + quizState.correct}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Premium input bar — always visible */}
      <div style={{ padding: '8px 14px', background: 'var(--card-bg)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={startVoice} style={{
            width: 44, height: 44, borderRadius: 12, border: 'none', flexShrink: 0,
            background: listening ? 'var(--error)' : 'var(--surface-alt)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={18} color={listening ? '#fff' : 'var(--text-2)'} />
          </motion.button>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              className="chat-input"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={dynamicPlaceholders[0] || 'Ask your mentor anything...'}
              style={{
                width: '100%', height: 44, padding: '0 14px', borderRadius: 12,
                border: '1px solid var(--border)', fontSize: 15, outline: 'none',
                fontFamily: 'inherit', background: 'var(--surface-alt)', color: 'var(--text)',
                boxSizing: 'border-box', transition: 'box-shadow 0.2s',
              }}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px var(--primary)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
            />
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
            width: 44, height: 44, borderRadius: 12, border: 'none', flexShrink: 0,
            background: input.trim() && !loading ? 'var(--primary)' : 'var(--border)',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: input.trim() && !loading ? '0 2px 8px rgba(63,125,255,0.2)' : 'none',
            transition: 'box-shadow 0.2s',
          }}>
            <Send size={18} color={input.trim() && !loading ? '#fff' : 'var(--text-3)'} />
          </motion.button>
        </div>
      </div>

      {/* Mode picker bottom sheet */}
      <AnimatePresence>
      {showModePicker && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setShowModePicker(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200,
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', background: 'var(--card-bg)', borderRadius: '20px 20px 0 0',
              padding: '20px 16px calc(20px + 40px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Learning Mode
            </div>
            {MODES.map(m => {
              const Icon = m.icon
              const active = mode === m.id
              return (
                <motion.button key={m.id} onClick={() => { setMode(m.id); setShowModePicker(false) }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? `${m.color}0D` : 'transparent',
                    marginBottom: 4, textAlign: 'left',
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: active ? m.color : 'var(--surface-alt)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={16} color={active ? '#fff' : 'var(--text-3)'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: active ? m.color : 'var(--text)' }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{m.subtitle}</div>
                  </div>
                  {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />}
                </motion.button>
              )
            })}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* History sidebar overlay */}
      <AnimatePresence>
      {showHistory && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setShowHistory(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 150,
          }}
        >
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 280, background: 'var(--card-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>History</div>
              <motion.button whileTap={{scale:0.96}} onClick={clearHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <Trash2 size={14} color="var(--error)" />
              </motion.button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 10px' }}>
                  <MessageSquare size={20} color="var(--text-3)" style={{ marginBottom: 10, opacity: 0.4 }} />
                  <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>No history yet</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    Your past questions and AI responses will appear here.
                  </div>
                </div>
              ) : (
                history.map((h, i) => (
                  <div key={h.id || i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{h.message}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{h.mode} · {new Date(h.created_at).toLocaleDateString()}</div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Flashcard overlay */}
      <AnimatePresence>
      {flashcards && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => setFlashcards(null)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 40 }} animate={{ scale: 1, y: 0 }}
            style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 340, padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            {flashcardIdx < flashcards.length ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Flashcards</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{flashcardIdx + 1}/{flashcards.length}</div>
                </div>
                <div style={{ height: 4, background: 'var(--surface-alt)', borderRadius: 99, marginBottom: 16 }}>
                  <div style={{ width: `${((flashcardIdx + 1) / flashcards.length) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 99 }} />
                </div>
                <motion.div
                  key={flashcardIdx}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                  style={{
                    minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', cursor: 'pointer', padding: '20px 0',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                      {flashcardFlipped ? flashcards[flashcardIdx].a : flashcards[flashcardIdx].q}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {flashcardFlipped ? 'Tap to see question' : 'Tap to see answer'}
                    </div>
                  </div>
                </motion.div>
                <motion.button whileTap={{scale:0.96}} onClick={() => {
                  if (flashcardIdx < flashcards.length - 1) { setFlashcardIdx(p => p + 1); setFlashcardFlipped(false) }
                  else setFlashcards(null)
                }} style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                  background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {flashcardIdx < flashcards.length - 1 ? 'Next' : 'Done'}
                </motion.button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>All done!</div>
                <motion.button whileTap={{scale:0.96}} onClick={() => setFlashcards(null)} style={{
                  marginTop: 12, padding: '12px 24px', borderRadius: 12, border: 'none',
                  background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>Close</motion.button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {genFlashcards && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Generating flashcards...</div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
