import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Plus, Trash2, FileText, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Card from '../components/Card'

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
        <Card style={{ marginBottom: 14 }}>
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
        </Card>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {notes.map(n => (
              <motion.div key={n.id}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/note/' + n.id)}
                style={{ marginBottom: 10, cursor: 'pointer' }}
              >
                <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 15, fontWeight: 700, color: 'var(--text)',
                        lineHeight: 1.35,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {n.title || 'Untitled Note'}
                      </div>
                    </div>
                    <div onClick={e => { e.stopPropagation(); deleteNote(n.id) }}
                      style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--surface-alt)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0,
                      }}>
                      <Trash2 size={13} color="var(--text-3)" />
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {n.content}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>
                      {new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>
                      Open Note →
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
