import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { ChevronLeft, Save, Highlighter, ImagePlus, MessageSquare, Send, Trash2, Bold, Link2, Mic, Volume2 } from 'lucide-react'

function mdToHtml(md) {
  if (!md) return ''
  let html = md
    .replace(/==(.+?)==/g, '<mark style="background:#FEF3C7;padding:0 2px;border-radius:3px">$1</mark>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[image\]\((.+?)\)/g, '<img src="$1" alt="" style="max-width:100%;border-radius:8px;margin:6px 0;display:block" />')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#3B82F6;text-decoration:underline">$1</a>')
    .replace(/\n/g, '<br />')
  return html
}

function htmlToText(html) {
  const d = document.createElement('div')
  d.innerHTML = html
  return d.textContent || d.innerText || ''
}

export default function NoteEditor() {
  const { noteId } = useParams()
  const navigate = useNavigate()
  const { userId } = useStore()
  const [note, setNote] = useState(null)
  const [title, setTitle] = useState('')
  const [contentHtml, setContentHtml] = useState('')
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const editorRef = useRef(null)
  const fileRef = useRef(null)
  const isDrawing = useRef(false)
  const drawStart = useRef(null)
  const savedSel = useRef(null)
  const savedContent = useRef('')

  const [aiOpen, setAiOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showFloat, setShowFloat] = useState(false)
  const [floatPos, setFloatPos] = useState({ top: 0, left: 0 })
  const [aiListening, setAiListening] = useState(false)
  const [highlighterMode, setHighlighterMode] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!noteId || !userId) return
    supabase.from('notes').select('*').eq('id', noteId).eq('user_id', userId).single().then(({ data }) => {
      let title = '', content = '', subject = ''
      if (data) {
        title = data.title || ''
        content = data.content || ''
        subject = data.subject || ''
      }
      // Try localStorage backup
      if (!content) {
        try {
          const bak = JSON.parse(localStorage.getItem('note_backup_' + noteId))
          if (bak && bak.content) { content = bak.content; title = bak.title || title; subject = bak.subject || subject }
        } catch {}
      }
      if (data || content) {
        setNote(data || { id: noteId })
        setTitle(title)
        const isHtml = /<[a-z][\s\S]*>/i.test(content)
        const html = isHtml ? content : mdToHtml(content)
        setContentHtml(html)
        savedContent.current = html
        if (editorRef.current) editorRef.current.innerHTML = html
        setSubject(subject)
      } else {
        navigate('/learn', { replace: true })
      }
    }).catch(() => {
      // Network error — try localStorage
      try {
        const bak = JSON.parse(localStorage.getItem('note_backup_' + noteId))
        if (bak && bak.content) {
          setTitle(bak.title || '')
          setContentHtml(bak.content)
          savedContent.current = bak.content
          if (editorRef.current) editorRef.current.innerHTML = bak.content
          setSubject(bak.subject || '')
        }
      } catch {}
    })
  }, [noteId, userId])

  const exec = (cmd, val) => {
    const sel = savedSel.current || window.getSelection()
    if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
      const r = sel.getRangeAt(0)
      const s = window.getSelection()
      s.removeAllRanges()
      s.addRange(r)
    }
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    setShowFloat(false)
    savedSel.current = null
  }

  const handleBold = () => exec('bold')
  const handleHighlight = () => exec('hiliteColor', '#FEF3C7')

  const toggleHighlighter = () => {
    setHighlighterMode(prev => !prev)
    setShowFloat(false)
    editorRef.current?.focus()
  }

  const handleMouseUp = (e) => {
    isDrawing.current = false
    drawStart.current = null
    detectSelection(e)
  }

  const handleTouchEnd = (e) => {
    isDrawing.current = false
    drawStart.current = null
    setTimeout(() => detectSelection(e), 10)
  }

  const handleMouseDown = (e) => {
    if (highlighterMode) {
      isDrawing.current = true
      const sel = window.getSelection()
      if (sel && sel.rangeCount) {
        drawStart.current = { node: sel.anchorNode, offset: sel.anchorOffset }
      }
    } else if (editing) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
        savedSel.current = sel
      }
    }
  }

  const handleTouchStart = (e) => {
    if (highlighterMode) {
      isDrawing.current = true
      const touch = e.touches[0]
      const range = document.caretRangeFromPoint(touch.clientX, touch.clientY)
      if (range) {
        drawStart.current = { node: range.startContainer, offset: range.startOffset }
      }
    } else if (editing) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
        savedSel.current = sel
      }
    }
  }

  const handleMouseMove = (e) => {
    if (!isDrawing.current || !highlighterMode) return
    const range = document.caretRangeFromPoint(e.clientX, e.clientY)
    if (!range || !drawStart.current) return
    const sel = window.getSelection()
    if (!sel) return
    const r = document.createRange()
    r.setStart(drawStart.current.node, drawStart.current.offset)
    r.setEnd(range.startContainer, range.startOffset)
    if (r.collapsed) return
    sel.removeAllRanges()
    sel.addRange(r)
    document.execCommand('hiliteColor', false, '#FEF3C7')
    const ns = window.getSelection()
    if (ns && ns.rangeCount) {
      drawStart.current = { node: ns.anchorNode, offset: ns.anchorOffset }
    }
  }

  const handleTouchMove = (e) => {
    if (!isDrawing.current || !highlighterMode) return
    e.preventDefault()
    const touch = e.touches[0]
    const range = document.caretRangeFromPoint(touch.clientX, touch.clientY)
    if (!range || !drawStart.current) return
    const sel = window.getSelection()
    if (!sel) return
    const r = document.createRange()
    r.setStart(drawStart.current.node, drawStart.current.offset)
    r.setEnd(range.startContainer, range.startOffset)
    if (r.collapsed) return
    sel.removeAllRanges()
    sel.addRange(r)
    document.execCommand('hiliteColor', false, '#FEF3C7')
    const ns = window.getSelection()
    if (ns && ns.rangeCount) {
      drawStart.current = { node: ns.anchorNode, offset: ns.anchorOffset }
    }
  }

  const handleLink = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const url = prompt('Enter URL:', 'https://')
    if (!url) return
    exec('createLink', url)
    setShowFloat(false)
  }

  const detectSelection = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) {
      setShowFloat(false)
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const editorRect = editorRef.current.getBoundingClientRect()
    setFloatPos({
      top: rect.top - editorRect.top - 44,
      left: rect.left - editorRect.left + rect.width / 2 - 80,
    })
    setShowFloat(true)
  }

  const handleSave = async () => {
    if (!title.trim() || !userId) return
    setSaving(true)
    try {
      const content = editorRef.current?.innerHTML || ''
      // LocalStorage backup
      try { localStorage.setItem('note_backup_' + noteId, JSON.stringify({ content, title: title.trim(), subject, ts: Date.now() })) } catch {}
      const { error } = await supabase.from('notes').update({
        title: title.trim(), content, subject,
      }).eq('id', noteId).eq('user_id', userId)
      if (error) throw error
      savedContent.current = content
      setContentHtml(content)
      if (editorRef.current) editorRef.current.innerHTML = content
      setNote(prev => ({ ...prev, title: title.trim(), content, subject }))
      setSaved(true)
      setEditing(false)
      setHighlighterMode(false)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Save failed: ' + (err.message || 'Unknown error') + ' - Content saved to device backup')
    }
    setSaving(false)
  }

  const handleCancel = () => {
    setContentHtml(savedContent.current)
    if (editorRef.current) editorRef.current.innerHTML = savedContent.current
    if (note) {
      setTitle(note.title || '')
      setSubject(note.subject || '')
    }
    setEditing(false)
    setHighlighterMode(false)
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this note?')) return
    await supabase.from('notes').delete().eq('id', noteId).eq('user_id', userId)
    navigate('/learn', { replace: true })
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Image too large. Please use images under 2MB.')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result
      if (typeof dataUrl === 'string') {
        const img = new Image()
        img.onload = () => {
          const maxW = 600
          let src = dataUrl
          if (img.width > maxW) {
            const c = document.createElement('canvas')
            const scale = maxW / img.width
            c.width = maxW
            c.height = img.height * scale
            const ctx = c.getContext('2d')
            ctx.drawImage(img, 0, 0, c.width, c.height)
            src = c.toDataURL('image/jpeg', 0.6)
          }
          editorRef.current?.focus()
          document.execCommand('insertHTML', false, `<img src="${src}" alt="" style="max-width:100%;border-radius:8px;margin:6px 0;display:block" />`)
          e.target.value = ''
        }
        img.src = dataUrl
      }
    }
    reader.readAsDataURL(file)
  }

  const startAiVoice = () => {
    setAiOpen(true)
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) {
        setAiMessages(prev => [...prev, { role: 'bot', text: '❗ Voice not supported in this browser. Open in Chrome or Edge.' }])
        return
      }
      if (aiListening) { speechSynthesis.cancel(); setAiListening(false); return }
      const r = new SR()
      r.lang = 'en-US'
      r.interimResults = true
      r.continuous = true
      r.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript.trim()
          if (e.results[i].isFinal) {
            if (!transcript) continue
            const lower = transcript.toLowerCase()
            const cmdMatch = lower.match(/^(bold|highlight)\s+(.+)/)
            if (cmdMatch) {
              const cmd = cmdMatch[1]; const target = cmdMatch[2]; const ed = editorRef.current
              if (ed) {
                const html = ed.innerHTML; const regex = new RegExp(escapeRegex(target), 'gi'); const m = regex.exec(html)
                if (m) {
                  const w = cmd === 'bold' ? `<strong>${m[0]}</strong>` : `<mark style="background:#FEF3C7;padding:0 2px;border-radius:3px">${m[0]}</mark>`
                  ed.innerHTML = html.slice(0, m.index) + w + html.slice(m.index + m[0].length)
                }
              }
            } else {
              r.stop()
              setAiInput(transcript)
              setTimeout(() => askAi(transcript), 50)
            }
          } else {
            setAiInput(transcript)
          }
        }
      }
      r.onerror = (ev) => {
        setAiListening(false)
        const msg = ev.error === 'not-allowed' ? '❗ Mic blocked. Allow microphone access in browser settings and try again.'
          : ev.error === 'audio-capture' ? '❗ No microphone found. Connect a mic and try again.'
          : ev.error === 'network' ? '❗ Network error. Check your connection.'
          : ev.error === 'no-speech' ? '' : `❗ Mic error: ${ev.error}`
        if (msg) setAiMessages(prev => [...prev, { role: 'bot', text: msg }])
      }
      r.onend = () => setAiListening(false)
      setAiListening(true)
      r.start()
    } catch (err) {
      setAiListening(false)
      setAiMessages(prev => [...prev, { role: 'bot', text: '❗ Mic failed to start: ' + err.message }])
    }
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  const askAi = async (voiceText) => {
    const question = (voiceText || aiInput).trim()
    if (!question) return
    setAiMessages(prev => [...prev, { role: 'user', text: question }])
    setAiInput('')
    setAiLoading(true)
    const plainContent = htmlToText(editorRef.current?.innerHTML || '').slice(0, 3000)
    try {
      const res = await fetch('/api/ai-doubt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteContext: plainContent, question }),
      })
      if (res.ok) {
        const data = await res.json()
        const botText = data.text || 'Could not generate response.'
        setAiMessages(prev => [...prev, { role: 'bot', text: botText }])
        const u = new SpeechSynthesisUtterance(botText)
        u.rate = 0.9; speechSynthesis.speak(u)
      } else {
        setAiMessages(prev => [...prev, { role: 'bot', text: 'AI service unavailable. Try again later.' }])
      }
    } catch {
      setAiMessages(prev => [...prev, { role: 'bot', text: 'Network error. Please check your connection.' }])
    }
    setAiLoading(false)
  }

  if (!note) return (
    <div style={{ background: 'var(--page-bg)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Loading note...</div>
    </div>
  )

  return (
    <div style={{ background: 'var(--page-bg)', height: '100%', display: 'flex', flexDirection: 'column', overflowX: 'hidden', paddingBottom: 100, boxSizing: 'border-box' }}>
      <div style={{ background: '#fff', padding: '48px 16px 8px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, minWidth: 0 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/learn')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <ChevronLeft size={20} color="#111827" />
          </motion.button>
          <input value={title} onChange={e => setTitle(e.target.value)} disabled={!editing} style={{
            flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700, color: '#111827', border: 'none', outline: 'none', fontFamily: 'inherit', background: 'transparent',
            cursor: editing ? 'text' : 'default',
          }} placeholder="Note title" />
          <div style={{ display: 'flex', gap: 6 }}>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => { if (!editing) setEditing(true); setTimeout(() => fileRef.current?.click(), 80) }} title="Add image" style={{
              padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: '#F3F4F6', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ImagePlus size={16} />
            </motion.button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            {editing && (<>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving} style={{
              padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: saving ? '#D1D5DB' : '#3B82F6', color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleCancel} style={{
              padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: '#FEE2E2', color: '#DC2626', fontSize: 14, fontWeight: 700,
            }}>
              Cancel
            </motion.button>
            </>)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
          <select value={subject} onChange={e => setSubject(e.target.value)} disabled={!editing} style={{
            fontSize: 13, padding: '3px 10px', borderRadius: 6, border: '1px solid #E5E7EB', fontFamily: 'inherit', background: editing ? '#fff' : '#F9FAFB', color: '#6B7280', outline: 'none',
            cursor: editing ? 'pointer' : 'default',
          }}>
            <option value="">No subject</option>
            {['gs1', 'gs2', 'gs3', 'gs4', 'essay'].map(s => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            {note.created_at ? new Date(note.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
          </div>
          {saved && <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>Saved!</div>}
          {highlighterMode && <div style={{ fontSize: 10, color: '#D97706', fontWeight: 600 }}>Highlight ON</div>}
          <div style={{ flex: 1 }} />
          {!editing && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditing(true)} style={{
              padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: '#F3F4F6', color: '#374151', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={toggleHighlighter} title="Highlight text" style={{
            padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: highlighterMode ? '#FEF3C7' : '#F3F4F6',
            color: highlighterMode ? '#D97706' : '#6B7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: highlighterMode ? '0 0 0 2px #FBBF24' : 'none',
          }}>
            <Highlighter size={13} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleDelete} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex',
          }}>
            <Trash2 size={15} color="#EF4444" />
          </motion.button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div
          ref={editorRef}
          contentEditable={editing || highlighterMode}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: contentHtml }}
          onInput={() => setShowFloat(false)}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleTouchEnd}
          onKeyUp={(e) => {
            detectSelection(e)
            if (e.key === 'Escape') setHighlighterMode(false)
          }}
          onClick={() => setShowFloat(false)}
          style={{
            flex: 1, width: '100%', padding: '20px 18px', border: 'none', outline: 'none', overflowY: 'auto',
            fontSize: 16, lineHeight: 1.8, fontFamily: 'inherit', background: '#fff', color: '#374151', boxSizing: 'border-box',
            minHeight: 300,
            whiteSpace: 'pre-wrap', wordWrap: 'break-word',
            touchAction: highlighterMode ? 'none' : 'auto',
            cursor: highlighterMode ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'30\' viewBox=\'0 0 24 30\'%3E%3Ctext y=\'24\' font-size=\'24\'%3E🖍%3C/text%3E%3C/svg%3E") 0 24, auto' : 'text',
          }}
        />

        <AnimatePresence>
          {showFloat && editing && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} style={{
              position: 'absolute', top: floatPos.top, left: floatPos.left, zIndex: 50,
              background: '#1F2937', borderRadius: 10, padding: '4px 6px',
              display: 'flex', gap: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}>
              <button onMouseDown={() => { const s = window.getSelection(); if (s && s.rangeCount) savedSel.current = s }} onTouchStart={() => { const s = window.getSelection(); if (s && s.rangeCount) savedSel.current = s }} onClick={handleBold} title="Bold" style={{
                padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
              }}><Bold size={14} /></button>
              <button onMouseDown={() => { const s = window.getSelection(); if (s && s.rangeCount) savedSel.current = s }} onTouchStart={() => { const s = window.getSelection(); if (s && s.rangeCount) savedSel.current = s }} onClick={handleHighlight} title="Highlight" style={{
                padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: '#FBBF24',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
              }}><Highlighter size={14} /></button>
              <button onMouseDown={() => { const s = window.getSelection(); if (s && s.rangeCount) savedSel.current = s }} onTouchStart={() => { const s = window.getSelection(); if (s && s.rangeCount) savedSel.current = s }} onClick={handleLink} title="Link" style={{
                padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: '#60A5FA',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
              }}><Link2 size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ padding: '8px 16px 14px', flexShrink: 0, borderTop: '1px solid #E5E7EB', background: '#fff' }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setAiOpen(!aiOpen)} style={{
          width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          background: aiOpen ? '#8B5CF6' : '#F3F4F6', color: aiOpen ? '#fff' : '#6B7280', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <MessageSquare size={16} /> {aiOpen ? 'Close AI Doubt' : 'Ask AI Doubt'}
        </motion.button>
        <AnimatePresence>
          {aiOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
              <div style={{ marginTop: 8, background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', maxHeight: 300 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 10, minHeight: 100 }}>
                  {aiMessages.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
                      Ask a doubt about this note. AI uses the note as context.
                    </div>
                  ) : (
                    aiMessages.map((m, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                        <div style={{
                          maxWidth: '85%', padding: '8px 12px', borderRadius: 12, fontSize: 14, lineHeight: 1.5,
                          background: m.role === 'user' ? '#3B82F6' : '#fff',
                          color: m.role === 'user' ? '#fff' : '#111827',
                          border: m.role === 'user' ? 'none' : '1px solid #E5E7EB', whiteSpace: 'pre-wrap',
                        }}>
                          {m.text}
                          {m.role === 'bot' && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                              <motion.button onClick={() => {
                                const u = new SpeechSynthesisUtterance(m.text)
                                u.rate = 0.9
                                speechSynthesis.speak(u)
                              }} whileTap={{ scale: 0.9 }} title="Read aloud" style={{
                                padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                background: '#F3F4F6', color: '#6B7280', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', gap: 3,
                              }}>
                                <Volume2 size={12} /> Speak
                              </motion.button>
                              <motion.button onClick={() => {
                                document.execCommand('insertHTML', false, '<p>' + m.text.replace(/\n/g, '<br />') + '</p>')
                                editorRef.current?.focus()
                                m.applied = true
                                setAiMessages(prev => [...prev])
                              }} whileTap={{ scale: 0.95 }} style={{
                                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                background: m.applied ? '#D1FAE5' : '#F3F4F6',
                                color: m.applied ? '#059669' : '#6B7280',
                                fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                              }}>
                                {m.applied ? '✓ Applied' : 'Apply'}
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {aiLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '8px 14px' }}>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[0, 1, 2].map(i => (
                            <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} style={{ width: 5, height: 5, borderRadius: '50%', background: '#8B5CF6' }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid #E5E7EB' }}>
                  <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAi() } }} placeholder="Ask a doubt..." style={{
                    flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
                  }} />
                  <motion.button whileTap={{ scale: 0.9 }} onClick={startAiVoice} whileHover={{ scale: 1.05 }} style={{
                    width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0,
                    background: aiListening ? '#EF4444' : '#F3F4F6', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: aiListening ? 'pulse 1s infinite' : 'none',
                  }}>
                    <Mic size={14} color={aiListening ? '#fff' : '#6B7280'} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={askAi} disabled={!aiInput.trim() || aiLoading} style={{
                    width: 34, height: 34, borderRadius: 10, border: 'none',
                    background: aiInput.trim() && !aiLoading ? '#8B5CF6' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: aiInput.trim() && !aiLoading ? 'pointer' : 'default',
                  }}>
                    <Send size={14} color={aiInput.trim() && !aiLoading ? '#fff' : '#9CA3AF'} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
