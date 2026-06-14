import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { buildRules, formatPrompt, createSession, buildStudentProfile } from '../lib/behaviorEngine'
import { callAI } from '../lib/callAI'
import { ChevronLeft, Send, Sparkles, BookOpen, MessageSquare, ClipboardList, Search, Trash2, Mic, Volume2, Zap, Rotate3D } from 'lucide-react'

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
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hello! I\'m your AI study assistant. Ask me anything about UPSC topics, or pick a mode below.' },
  ])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('explain')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [savedNotes, setSavedNotes] = useState(new Set())
  const [quizState, setQuizState] = useState(null)
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
    <motion.div layout style={{ background: 'var(--page-bg)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`.chat-input::placeholder { color: var(--text-3) }`}</style>
      {/* Header */}
      <div style={{ background: 'var(--card-bg)', padding: '48px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{scale:0.96}} onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <ChevronLeft size={18} color="var(--text)" />
          </motion.button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>AI Mentor</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Your intelligent study companion</div>
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

      {/* Mode action cards */}
      <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'var(--page-bg)' }}>
        {MODES.map(m => {
          const Icon = m.icon
          const active = mode === m.id
          return (
            <motion.button key={m.id} onClick={() => setMode(m.id)}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 12, border: active ? `1.5px solid ${m.color}` : '1px solid var(--border)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                background: active ? `${m.color}0D` : 'var(--card-bg)',
              }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: active ? m.color : 'var(--surface-alt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={15} color={active ? '#fff' : 'var(--text-3)'} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? m.color : 'var(--text)' }}>{m.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{m.subtitle}</div>
              </div>
            </motion.button>
          )
        })}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', minHeight: 0 }}>
            <AnimatePresence>
            {messages.length === 1 && messages[0].role === 'bot' && (
              <div style={{ textAlign: 'center', padding: '40px 20px 20px' }}>
                <Sparkles size={28} color="var(--primary)" style={{ marginBottom: 10, opacity: 0.6 }} />
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
                  Pick a mode above, then type your question. I can explain concepts, challenge you, debate perspectives, or help revise.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 240, margin: '0 auto' }}>
                  {['What is federalism?', 'Explain Fundamental Rights', 'Challenge me on Polity'].map((suggestion, i) => (
                    <motion.button key={i} whileTap={{ scale: 0.97 }}
                      onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                      style={{
                        padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)',
                        background: 'var(--card-bg)', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 11, color: 'var(--text-2)', fontWeight: 500,
                      }}>
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 10,
                }}
              >
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: 14, fontSize: 12, lineHeight: 1.6,
                  background: msg.role === 'user' ? 'var(--primary)' : 'var(--card-bg)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.text}
                  {msg.role === 'bot' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <motion.button whileTap={{scale:0.96}} onClick={() => { const u = new SpeechSynthesisUtterance(msg.text); u.rate = 0.9; speechSynthesis.speak(u) }} title="Read aloud" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 10, color: 'var(--text-2)', fontWeight: 600, padding: 0, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        <Volume2 size={12} /> Speak
                      </motion.button>
                      <motion.button whileTap={{scale:0.96}} onClick={() => saveAsNote(msg.text, messages[i-1]?.text)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 10, color: savedNotes.has(msg.text.slice(0, 50)) ? 'var(--success)' : 'var(--primary)',
                        fontWeight: 600, padding: 0, fontFamily: 'inherit',
                      }}>
                        {savedNotes.has(msg.text.slice(0, 50)) ? 'Saved' : 'Save as note'}
                      </motion.button>
                      <motion.button whileTap={{scale:0.96}} onClick={() => generateFlashcards(msg.text)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 10, color: 'var(--phys)', fontWeight: 600, padding: 0, fontFamily: 'inherit',
                      }}>
                        Flashcards
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                <div style={{
                  background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14,
                  padding: '10px 16px', display: 'flex', gap: 4,
                }}>
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
            {quizState && (
              <div style={{
                background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14,
                padding: 14, marginTop: 4,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>{quizState.question}</div>
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
                        padding: '8px 10px', borderRadius: 10, marginBottom: 6,
                        fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: quizState.answered ? 'default' : 'pointer',
                        background: bg, border, color, boxSizing: 'border-box',
                      }}>
                      <strong style={{ marginRight: 6 }}>{letter}.</strong> {opt}
                    </motion.button>
                  )
                })}
                {quizState.answered && (
                  <div style={{
                    fontSize: 11, textAlign: 'center', marginTop: 6, fontWeight: 600,
                    color: quizState.answered === quizState.correct ? 'var(--success)' : 'var(--error)',
                  }}>
                    {quizState.answered === quizState.correct ? 'Correct!' : 'Incorrect. The answer was ' + quizState.correct}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '8px 14px calc(14px + 56px)', background: 'var(--card-bg)', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="chat-input"
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Ask a question..."
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)',
                    fontSize: 12, outline: 'none', fontFamily: 'inherit', background: 'var(--surface-alt)', color: 'var(--text)', boxSizing: 'border-box',
                  }}
                />
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={startVoice} whileHover={{ scale: 1.05 }} style={{
                width: 36, height: 36, borderRadius: 12, border: 'none', flexShrink: 0,
                background: listening ? 'var(--error)' : 'var(--surface-alt)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Mic size={15} color={listening ? '#fff' : 'var(--text-2)'} />
              </motion.button>
              <motion.button whileTap={{scale:0.96}} onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
                width: 36, height: 36, borderRadius: 12, border: 'none',
                background: input.trim() && !loading ? 'var(--primary)' : 'var(--border)',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Send size={16} color={input.trim() && !loading ? '#fff' : 'var(--text-3)'} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* History sidebar - absolute overlay */}
        <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 260, background: 'var(--card-bg)', borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10,
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>History</div>
              <motion.button whileTap={{scale:0.96}} onClick={clearHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <Trash2 size={14} color="var(--error)" />
              </motion.button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <MessageSquare size={20} color="var(--text-3)" style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>No history yet</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    Your past questions and AI responses will appear here for quick reference.
                  </div>
                </div>
              ) : (
                history.map((h, i) => (
                  <div key={h.id || i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{h.message}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{h.mode} · {new Date(h.created_at).toLocaleDateString()}</div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Flashcard overlay */}
      <AnimatePresence>
      {flashcards && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => setFlashcards(null)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            style={{ background: 'var(--card-bg)', borderRadius: 16, width: '100%', maxWidth: 340, padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {flashcardIdx < flashcards.length ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--phys)' }}>AI Flashcards</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{flashcardIdx + 1}/{flashcards.length}</div>
                </div>
                <div style={{ height: 4, background: 'var(--surface-alt)', borderRadius: 99, marginBottom: 14 }}>
                  <div style={{ width: `${((flashcardIdx + 1) / flashcards.length) * 100}%`, height: '100%', background: 'var(--phys)', borderRadius: 99 }} />
                </div>
                <motion.div
                  key={flashcardIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                  style={{
                    minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', cursor: 'pointer', padding: '16px 0',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                      {flashcardFlipped ? flashcards[flashcardIdx].a : flashcards[flashcardIdx].q}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      {flashcardFlipped ? 'Tap to see question' : 'Tap to see answer'}
                    </div>
                  </div>
                </motion.div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button whileTap={{scale:0.96}} onClick={() => {
                    if (flashcardIdx < flashcards.length - 1) { setFlashcardIdx(p => p + 1); setFlashcardFlipped(false) }
                    else setFlashcards(null)
                  }} style={{
                    flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
                    background: 'var(--phys)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {flashcardIdx < flashcards.length - 1 ? 'Next' : 'Done'}
                  </motion.button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>All done!</div>
                <motion.button whileTap={{scale:0.96}} onClick={() => setFlashcards(null)} style={{
                  marginTop: 12, padding: '10px 24px', borderRadius: 12, border: 'none',
                  background: 'var(--phys)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--phys)', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Generating flashcards...</div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
