import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, BookOpen, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { card as cardStyle } from '../lib/designTokens'

export default function Notes() {
  const navigate = useNavigate()
  const userId = useStore(s => s.userId)
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !userId) { setLoading(false); return }
    supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) console.error('Notes load error:', error); else if (data) setNotes(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const addNote = async () => {
    if (!text.trim() || !supabase || !userId) return
    const { data, error } = await supabase.from('notes').insert({ user_id: userId, title: title.trim() || '', content: text.trim() }).select()
    if (error) { console.error('Notes save error:', error); return }
    if (data) {
      setNotes(p => [data[0], ...p])
      setText('')
      setTitle('')
    }
  }

  const deleteNote = async (id) => {
    if (!supabase) return
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) { console.error('Notes delete error:', error); return }
    setNotes(p => p.filter(n => n.id !== id))
  }

  return (
    <div className="screen" style={{ background: 'var(--page-bg)', paddingBottom: 100 }}>
      {/* ══ HEADER ══ */}
      <div style={{ padding: '52px 18px 14px', background: '#fff', borderBottom: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <ChevronLeft size={20} color="#111827" />
          </button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Saved Notes</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 14px 100px' }}>
        {/* ══ ADD NOTE ══ */}
        <div style={{ ...cardStyle, padding: 16, marginBottom: 14 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title (optional)"
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, fontWeight: 700, marginBottom: 10, fontFamily: 'inherit', color: '#111827', background: 'transparent' }} />
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write your note..."
            rows={4} style={{
              width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: 10,
              fontSize: 13, fontFamily: 'inherit', color: '#111827', resize: 'vertical', outline: 'none', background: '#F9FAFB',
            }} />
          <button onClick={addNote} disabled={!text.trim() || !supabase || !userId} style={{
            marginTop: 10, width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
            cursor: text.trim() && supabase && userId ? 'pointer' : 'default',
            background: text.trim() && supabase && userId ? 'var(--primary)' : '#E5E7EB',
            color: text.trim() && supabase && userId ? '#fff' : '#9CA3AF',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Plus size={15} /> Save Note
          </button>
        </div>

        {/* ══ NOTES LIST ══ */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: 13, fontWeight: 500 }}>Loading...</div>
        ) : notes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <FileText size={36} color="#D1D5DB" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF', marginBottom: 4 }}>No notes yet</div>
            <div style={{ fontSize: 12, color: '#B0B7C3' }}>Start by saving a note above.</div>
          </div>
        ) : (
          notes.map(n => (
            <div key={n.id} style={{ ...cardStyle, padding: 14, marginBottom: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{n.title || 'Note'}</div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.content}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6 }}>{new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <button onClick={() => deleteNote(n.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, color: '#D1D5DB',
              }}><Trash2 size={15} /></button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
