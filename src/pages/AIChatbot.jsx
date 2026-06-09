import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { ChevronLeft, Send, Sparkles, BookOpen, MessageSquare, ClipboardList, Search, Trash2, Mic, Volume2 } from 'lucide-react'

const MODES = [
  { id: 'explain', label: 'Explain', icon: BookOpen, color: '#3B82F6' },
  { id: 'quiz', label: 'Quiz Me', icon: ClipboardList, color: '#8B5CF6' },
  { id: 'summarise', label: 'Summarise', icon: Search, color: '#10B981' },
  { id: 'deepdive', label: 'Deep Dive', icon: Sparkles, color: '#3B82F6' },
]

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''

const MODE_PROMPTS = {
  explain: `You are a UPSC CSE mentor. Explain the given topic in detail with a structured breakdown including definition, key features, historical background, contemporary relevance, and exam perspective. Use plain text only - no stars, no hashes, no markdown. Use numbered sections and dashes for lists.`,
  quiz: `You are a UPSC CSE mentor. Generate a multiple-choice quiz question on the given topic. Include 4 options (A, B, C, D) and indicate the correct answer after the question. Use plain text only - no stars, no hashes, no markdown.`,
  summarise: `You are a UPSC CSE mentor. Provide a concise summary of the given topic covering key points, must-know facts, and UPSC angle. Use dashes for bullet points, no stars, no hashes, no markdown.`,
  deepdive: `You are a UPSC CSE mentor. Provide a comprehensive deep dive analysis of the given topic covering multiple dimensions (historical, constitutional, administrative, social, economic), case studies, critical analysis, and interlinkages with other GS papers. Use plain text only - no stars, no hashes, no markdown.`,
}

const FALLBACK_RESPONSES = {
  explain: `Topic Overview\n\nThis is an important UPSC topic that requires understanding from multiple angles.\n\nKey Aspects:\n- Focus on definitions and basic concepts first\n- Understand the historical context and evolution\n- Link with current affairs for Mains answers\n- Practice previous year questions on this topic`,
  quiz: `Quiz Time!\n\nQ: What is the primary constitutional basis for this topic?\nA) Article 14\nB) Article 21\nC) Article 32\nD) Article 368\n\nAnswer: Check your notes and try again!`,
  summarise: `Summary\n\nKey Points:\n- Understand the core concept thoroughly\n- Know the constitutional/legal framework\n- Keep up with recent developments\n- Practice answer writing`,
  deepdive: `Deep Dive Analysis\n\nThis topic requires comprehensive understanding across multiple dimensions. Focus on interlinkages with current affairs and other GS papers for a holistic UPSC preparation strategy.`,
}

export default function AIChatbot() {
  const navigate = useNavigate()
  const { userId } = useStore()
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

    let response = ''

    // Try server API route first (works on Vercel — has Gemini + Groq fallback)
    try {
      const apiRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode }),
      })
      if (apiRes.ok) {
        const data = await apiRes.json()
        if (data.response) response = data.response
      }
    } catch {}

    // Fallback: direct Groq from browser
    if (!response && GROQ_API_KEY) {
      try {
        const systemPrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.explain
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Topic: ${text}` },
            ],
            temperature: 0.7,
            max_tokens: 1024,
          }),
        })
        if (groqRes.ok) {
          const data = await groqRes.json()
          response = data?.choices?.[0]?.message?.content?.trim() || ''
        }
      } catch (e) {
        console.warn('Groq API error:', e)
      }
    }

    // Fallback: direct Gemini from browser
    if (!response && GEMINI_API_KEY) {
      try {
        const systemPrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.explain
        const prompt = `${systemPrompt}\n\nTopic: ${text}`
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        })
        if (res.ok) {
          const data = await res.json()
          response = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
        }
      } catch (e) {
        console.warn('Gemini API error:', e)
      }
    }

    if (!response) {
      response = FALLBACK_RESPONSES[mode] || FALLBACK_RESPONSES.explain
    }

    setMessages(prev => [...prev, { role: 'bot', text: response }])
    const u = new SpeechSynthesisUtterance(response.replace(/[A-D]\)/g, '').replace(/Answer.*/i, ''))
    u.rate = 0.9; speechSynthesis.speak(u)
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
      {/* Header */}
      <div style={{ background: 'var(--card-bg)', padding: '48px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{scale:0.96}} onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <ChevronLeft size={18} color="var(--text)" />
          </motion.button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>AI Chatbot</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Your UPSC study assistant</div>
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

      {/* Mode chips */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 14px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {MODES.map(m => {
          const Icon = m.icon
          const active = mode === m.id
          return (
              <motion.button whileTap={{scale:0.96}} key={m.id} onClick={() => setMode(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', borderRadius: 12, border: 'none',
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                background: active ? m.color + '25' : 'var(--surface-alt)',
                color: active ? m.color : 'var(--text-3)', fontSize: 12, fontWeight: 600,
              }}>
                <Icon size={15} />
                {m.label}
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
                        fontSize: 10, color: 'var(--text-3)', fontWeight: 600, padding: 0, fontFamily: 'inherit',
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
                      style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
            {quizState && (
              <div style={{
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14,
                padding: 14, marginTop: 4,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 10 }}>{quizState.question}</div>
                {quizState.options.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx)
                  const isSelected = quizState.answered === letter
                  const isCorrect = quizState.correct === letter
                  const showResult = quizState.answered !== null
                  let bg = '#F9FAFB'
                  let border = '1px solid #E5E7EB'
                  let color = '#111827'
                  if (showResult) {
                    if (isCorrect) { bg = '#D1FAE5'; border = '1px solid #10B981'; color = '#065F46' }
                    else if (isSelected) { bg = '#FEE2E2'; border = '1px solid #EF4444'; color = '#991B1B' }
                  } else if (isSelected) { bg = '#DBEAFE'; border = '1px solid #3B82F6'; color = '#1E40AF' }
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
                    color: quizState.answered === quizState.correct ? '#10B981' : '#EF4444',
                  }}>
                    {quizState.answered === quizState.correct ? 'Correct!' : 'Incorrect. The answer was ' + quizState.correct}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '8px 14px 14px', background: 'var(--card-bg)', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
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
                background: listening ? '#EF4444' : 'var(--surface-alt)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Mic size={15} color={listening ? '#fff' : 'var(--text-3)'} />
              </motion.button>
              <motion.button whileTap={{scale:0.96}} onClick={sendMessage} disabled={!input.trim() || loading} style={{
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
              width: 260, background: '#fff', borderLeft: '1px solid #F3F4F6',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10,
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>History</div>
              <motion.button whileTap={{scale:0.96}} onClick={clearHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <Trash2 size={14} color="#EF4444" />
              </motion.button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {history.length === 0 ? (
                <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', paddingTop: 20 }}>No history yet</div>
              ) : (
                history.map((h, i) => (
                  <div key={h.id || i} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{h.message}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>{h.mode} · {new Date(h.created_at).toLocaleDateString()}</div>
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
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 340, padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            {flashcardIdx < flashcards.length ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8B5CF6' }}>AI Flashcards</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{flashcardIdx + 1}/{flashcards.length}</div>
                </div>
                <div style={{ height: 4, background: '#F3F4F6', borderRadius: 99, marginBottom: 14 }}>
                  <div style={{ width: `${((flashcardIdx + 1) / flashcards.length) * 100}%`, height: '100%', background: '#8B5CF6', borderRadius: 99 }} />
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                      {flashcardFlipped ? flashcards[flashcardIdx].a : flashcards[flashcardIdx].q}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>
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
                    background: '#8B5CF6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {flashcardIdx < flashcards.length - 1 ? 'Next' : 'Done'}
                  </motion.button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>All done!</div>
                <motion.button whileTap={{scale:0.96}} onClick={() => setFlashcards(null)} style={{
                  marginTop: 12, padding: '10px 24px', borderRadius: 12, border: 'none',
                  background: '#8B5CF6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
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
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #E5E7EB', borderTopColor: '#8B5CF6', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, color: '#6B7280' }}>Generating flashcards...</div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
