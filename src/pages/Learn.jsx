import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { upscSubjects } from '../data/upsc/subjects'
import { getAllUpscQuestions } from '../data/upsc/questions'
import { BookOpen, FileText, Search, ChevronRight, Plus, Zap, CheckCircle, XCircle, RefreshCw, Rotate3D, Star, Bookmark, Check, X } from 'lucide-react'
import { SkeletonBlock } from '../components/SkeletonBlock'
import SearchInput from '../components/SearchInput'
import { easePreset } from '../hooks/useSequentialReveal'
import { card as cardStyle, cardHover, spring, spacing, font, colors, btn } from '../lib/designTokens'

const TABS = [
  { id: 'notes', label: 'Notes', icon: BookOpen },
  { id: 'mcq', label: 'Practice MCQ', icon: FileText },
  { id: 'flashcards', label: 'Flashcards', icon: Rotate3D },
]

export default function Learn() {
  const navigate = useNavigate()
  const { user, userId, completedModules, completeModule } = useStore()
  const [tab, setTab] = useState('notes')
  const segContainerRef = useRef(null)
  const [segIndicator, setSegIndicator] = useState({ left: 0, width: 0 })

  useEffect(() => {
    if (!segContainerRef.current) return
    const el = segContainerRef.current.querySelector(`[data-seg="${tab}"]`)
    if (el) setSegIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [tab])

  return (
    <motion.div layout style={{ background: 'var(--page-bg)', minHeight: '100%', paddingBottom: 100, overflowX: 'hidden' }}>
      {/* Header — premium editorial */}
      <div style={{ padding: '20px 16px 16px' }}>


        {/* Study Mode Switcher — Apple segmented control */}
        <div ref={segContainerRef} style={{
          display: 'flex', background: 'var(--surface-alt)', borderRadius: 8, padding: 2,
          position: 'relative',
        }}>
          <motion.div
            animate={{ left: segIndicator.left, width: segIndicator.width }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'absolute', top: 2, bottom: 2, borderRadius: 6,
              background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          />
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <motion.button key={t.id} data-seg={t.id} onClick={() => setTab(t.id)}
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 600 : 500,
                  color: active ? '#000' : '#666',
                  background: 'transparent', position: 'relative', zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  transition: 'color 0.15s', WebkitTapHighlightColor: 'transparent',
                }}>
                <Icon size={12} strokeWidth={active ? 2.5 : 2} />
                {t.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: spacing.container }}>
        <AnimatePresence mode="wait">
          {tab === 'notes' && <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><NotesTab /></motion.div>}
          {tab === 'mcq' && <motion.div key="mcq" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><PracticeMCQTab /></motion.div>}
          {tab === 'flashcards' && <motion.div key="flashcards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}><FlashcardsTab /></motion.div>}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════ NOTES TAB ═══════════════════════════ */
function NotesTab() {
  const navigate = useNavigate()
  const { userId } = useStore()
  const [notes, setNotes] = useState([])
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const viewMode = 'grid'
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [noteSubject, setNoteSubject] = useState('gs1')
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('bookmarked_notes') || '[]')) } catch { return new Set() }
  })
  const [selectedNote, setSelectedNote] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [notesLoading, setNotesLoading] = useState(true)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchRecentOpen, setSearchRecentOpen] = useState(false)
  const [searchHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('note_search_history') || '["Polity","Laxmikanth","Fundamental Rights"]') } catch { return [] }
  })
  const searchRef = useRef(null)

  const toggleBookmark = (id) => {
    setBookmarkedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      localStorage.setItem('bookmarked_notes', JSON.stringify([...s]))
      return s
    })
  }

  useEffect(() => {
    if (!userId) return
    setNotesLoading(true)
    supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setNotes(data)
      setNotesLoading(false)
    })
  }, [userId])

  const saveNote = async () => {
    if (!content.trim() || !userId) return
    const { data } = await supabase.from('notes').insert({
      user_id: userId, title: title.trim() || 'Untitled', content: content.trim(), subject: noteSubject,
    }).select().single()
    if (data) {
      setNotes(prev => [data, ...prev])
      setTitle('')
      setContent('')
      setShowForm(false)
    }
  }

  const deleteNote = async (id) => {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    setBookmarkedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (selectedNote?.id === id) setSelectedNote(null)
  }

  const startEditing = () => {
    setEditTitle(selectedNote?.title || '')
    setEditContent(selectedNote?.content || '')
    setEditing(true)
  }

  const updateNote = async () => {
    if (!selectedNote) return
    const { data } = await supabase.from('notes').update({ title: editTitle.trim() || 'Untitled', content: editContent.trim() }).eq('id', selectedNote.id).select().single()
    if (data) {
      setNotes(prev => prev.map(n => n.id === data.id ? data : n))
      setSelectedNote(data)
    }
    setEditing(false)
  }

  const cancelEdit = () => { setEditing(false) }

  const handleCloseNote = () => { setSelectedNote(null); setEditing(false) }

  const filteredNotes = useMemo(() => {
    let list = notes
    if (subjectFilter !== 'all') list = list.filter(n => n.subject === subjectFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n => n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q))
    }
    const sorted = [...list].sort((a, b) => {
      const aBm = bookmarkedIds.has(a.id) ? 0 : 1
      const bBm = bookmarkedIds.has(b.id) ? 0 : 1
      if (aBm !== bBm) return aBm - bBm
      return new Date(b.created_at) - new Date(a.created_at)
    })
    return sorted
  }, [notes, subjectFilter, search, bookmarkedIds])

  const subjectCounts = useMemo(() => {
    const counts = { all: notes.length }
    upscSubjects.forEach(s => counts[s.id] = notes.filter(n => n.subject === s.id).length)
    return counts
  }, [notes])

  return (
    <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ overflowX: 'hidden' }}>
      {/* Search + Create Note */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--page-bg)', paddingTop: 4, paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div ref={searchRef} style={{ flex: 1, position: 'relative' }}>
            <SearchInput
              value={search}
              onChange={v => { setSearch(v); setSearchRecentOpen(true) }}
              onFocus={() => { setSearchFocused(true); setSearchRecentOpen(true) }}
              onBlur={() => { setSearchFocused(false); setTimeout(() => setSearchRecentOpen(false), 200) }}
              placeholder="Search notes..."
              size="md"
            />

            {/* Recent searches */}
            <AnimatePresence>
              {searchRecentOpen && !search && searchHistory.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                    background: '#fff', borderRadius: 12, marginTop: 6,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}>
                  <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Recent
                  </div>
                  {searchHistory.map((term, i) => (
                    <motion.button key={term} onClick={() => { setSearch(term); setSearchRecentOpen(false) }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: '100%', padding: '8px 12px', border: 'none', background: 'transparent',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#333',
                        display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                      }}>
                      <Search size={12} color="#999" />
                      {term}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Create Note */}
          <motion.button onClick={() => setShowForm(!showForm)}
            whileTap={{ scale: 0.98 }}
            style={{
              height: 40, padding: '0 16px', borderRadius: 8, border: 'none',
              background: 'var(--primary)', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 4,
              boxShadow: '0 2px 6px rgba(63,125,255,0.2)',
            }}>
            <Plus size={14} strokeWidth={2.5} />
            New
          </motion.button>
        </div>
      </div>

      {/* Subject Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {[{ id: 'all', name: 'All' }, ...upscSubjects].map((s, i) => {
          const active = subjectFilter === s.id
          return (
            <motion.button key={s.id} onClick={() => setSubjectFilter(s.id)}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '8px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: 14, fontWeight: active ? 600 : 500, fontFamily: 'inherit',
                background: active ? 'var(--primary)' : 'var(--surface-alt)',
                color: active ? '#fff' : 'var(--text-2)',
                transition: 'background 0.2s, box-shadow 0.2s',
                boxShadow: active ? '0 2px 8px rgba(63,125,255,0.15)' : 'none',
                display: 'flex', alignItems: 'center', gap: 6,
                minHeight: 36,
              }}>
              {s.name}
              {subjectCounts[s.id] > 0 && (
                <span style={{
                  fontSize: 12, fontWeight: 600, opacity: 0.75,
                }}>
                  {subjectCounts[s.id]}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Add Note form */}
      {showForm && (
        <motion.div style={{ ...cardStyle, padding: 14, marginBottom: 10 }} whileHover={cardHover}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>+ New Note</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" style={{
            width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
            fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box',
          }} />
          <select value={noteSubject} onChange={e => setNoteSubject(e.target.value)} style={{
            width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
            fontSize: 12, outline: 'none', fontFamily: 'inherit', marginBottom: 8, background: 'var(--card-bg)', boxSizing: 'border-box',
          }}>
            {upscSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your note..." rows={5} style={{
            width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
            fontSize: 12, outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: 8, boxSizing: 'border-box',
          }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button onClick={saveNote} disabled={!content.trim()} whileTap={{ scale: 0.97 }} style={{
              flex: 1, padding: '9px 0', borderRadius: 12, border: 'none',
              background: content.trim() ? 'var(--primary)' : 'var(--border)', color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: content.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
            }}>
              Save Note
            </motion.button>
            <motion.button onClick={() => setShowForm(false)} whileTap={{ scale: 0.97 }} style={{
              padding: '9px 14px', borderRadius: 12, border: '1.5px solid var(--border)',
              background: 'var(--card-bg)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Notes */}
      {notesLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 0 40px' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              background: 'var(--card-bg)', borderRadius: 'var(--radius-xl)',
              padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
              ...(i > 1 ? { marginTop: -(100 - i * 12), transform: `scale(${1 - (i * 0.03)})`, opacity: 1 - (i * 0.15) } : {}),
            }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <SkeletonBlock width={60} height={8} radius={4} />
                <SkeletonBlock width={80} height={8} radius={4} />
              </div>
              <SkeletonBlock width="85%" height={16} radius={4} style={{ marginBottom: 8 }} />
              <SkeletonBlock width="60%" height={12} radius={4} style={{ marginBottom: 4 }} />
              <SkeletonBlock width="70%" height={12} radius={4} style={{ marginBottom: 4 }} />
              <SkeletonBlock width="40%" height={12} radius={4} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <SkeletonBlock width={80} height={10} radius={4} />
                <SkeletonBlock width={20} height={10} radius={4} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <BookOpen size={22} color="var(--text-3)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Your knowledge library starts here.</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 20, maxWidth: 260, margin: '0 auto 20px' }}>
            Create your first note, ask the AI Mentor, or import something from Current Affairs.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 200, margin: '0 auto' }}>
            <motion.button onClick={() => setShowForm(true)} whileTap={{ scale: 0.97 }} style={{
              width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
              background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Plus size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Create Note
            </motion.button>
            <motion.button onClick={() => navigate('/mentor')} whileTap={{ scale: 0.97 }} style={{
              width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid var(--border)',
              background: 'var(--card-bg)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Ask AI Mentor
            </motion.button>
            <motion.button onClick={() => navigate('/current-affairs')} whileTap={{ scale: 0.97 }} style={{
              width: '100%', padding: '10px 0', borderRadius: 12, border: '1.5px solid var(--border)',
              background: 'var(--card-bg)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Import Current Affairs
            </motion.button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingBottom: 20 }}>
          {filteredNotes.map((n, index) => {
            const subjectObj = upscSubjects.find(s => s.id === n.subject)
            const subjectColor = subjectObj?.color || 'var(--text-3)'
            return (
              <motion.div key={n.id} layoutId={`note-${n.id}`} onClick={() => setSelectedNote(n)}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                style={{
                  background: '#fff', borderRadius: 12, padding: 16,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
                }}>
                {/* Top row: bookmark */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <motion.button onClick={e => { e.stopPropagation(); toggleBookmark(n.id) }} whileTap={{ scale: 0.8 }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                    <Bookmark size={16} color={bookmarkedIds.has(n.id) ? 'var(--primary)' : '#999'} fill={bookmarkedIds.has(n.id) ? 'var(--primary)' : 'none'} />
                  </motion.button>
                </div>
                {/* Title */}
                <div style={{ fontSize: 14, fontWeight: 700, color: '#333', lineHeight: 1.35, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {n.title || 'Untitled'}
                </div>
                {/* Category chip */}
                {n.subject && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: subjectColor }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: subjectColor }}>
                      {subjectObj?.name || n.subject}
                    </span>
                  </div>
                )}
                {/* Date at bottom */}
                <div style={{ marginTop: 'auto', fontSize: 11, color: '#666', fontWeight: 500 }}>
                  {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>

      {createPortal(
        <AnimatePresence>
          {selectedNote && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCloseNote}
              style={{
                position: 'fixed', inset: 0, zIndex: 100,
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
              }}>
              <motion.div layoutId={`note-${selectedNote.id}`}
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={e => e.stopPropagation()}
                style={{
                  background: 'var(--card-bg)', borderRadius: 'var(--radius-xl)',
                  width: '100%', maxWidth: 400, maxHeight: '85vh',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                }}>
              {/* Close button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {selectedNote.title || 'Untitled'}
                </div>
                <motion.button onClick={handleCloseNote} whileTap={{ scale: 0.85 }}
                  style={{ background: 'var(--surface-alt)', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, display: 'flex', marginLeft: 8 }}>
                  <X size={16} color="var(--text-2)" />
                </motion.button>
              </div>
              {/* Metadata */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.2 }}
                style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedNote.subject && (() => {
                  const subjObj = upscSubjects.find(s => s.id === selectedNote.subject)
                  return (
                    <span style={{ fontSize: 10, fontWeight: 600, color: subjObj?.color || 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: subjObj?.color || 'var(--text-3)' }} />
                      {subjObj?.name || selectedNote.subject}
                    </span>
                  )
                })()}
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {new Date(selectedNote.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </motion.div>
              {/* Body */}
              {editing ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Note title"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit', background: 'var(--surface-alt)', color: 'var(--text)', boxSizing: 'border-box' }} />
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Note content"
                    style={{ flex: 1, width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', background: 'var(--surface-alt)', color: 'var(--text)', resize: 'none', boxSizing: 'border-box', minHeight: 120 }} />
                </div>
              ) : (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25 }}
                style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 16px', fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}>
                {(() => {
                  const raw = selectedNote.content || ''
                  const text = raw.replace(/<[^>]*>/g, '').replace(/==/g, '').replace(/\*\*/g, '').replace(/\[image\]\([^)]*\)/g, '[image]')
                  return text || 'No content'
                })()}
              </motion.div>
              )}
              {/* Actions */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.2 }}
                style={{ padding: '8px 20px 20px', display: 'flex', gap: 8 }}>
                {editing ? (
                  <>
                    <motion.button onClick={updateNote} whileTap={{ scale: 0.95 }}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 12, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Save
                    </motion.button>
                    <motion.button onClick={cancelEdit} whileTap={{ scale: 0.95 }}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </motion.button>
                  </>
                ) : (
                  <>
                    <motion.button onClick={startEditing} whileTap={{ scale: 0.95 }}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Edit
                    </motion.button>
                    <motion.button onClick={() => { toggleBookmark(selectedNote.id); handleCloseNote() }} whileTap={{ scale: 0.95 }}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 12, border: 'none', background: bookmarkedIds.has(selectedNote.id) ? 'var(--primary)' : 'var(--surface-alt)', color: bookmarkedIds.has(selectedNote.id) ? '#fff' : 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Bookmark size={14} fill={bookmarkedIds.has(selectedNote.id) ? '#fff' : 'none'} />
                      {bookmarkedIds.has(selectedNote.id) ? 'Bookmarked' : 'Bookmark'}
                    </motion.button>
                    <motion.button onClick={() => { deleteNote(selectedNote.id) }} whileTap={{ scale: 0.95 }}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 12, border: 'none', background: 'var(--surface-alt)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Delete
                    </motion.button>
                  </>
                )}
              </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

const DECAY_KEY = 'upsc_practice_history'

function tagSkill(q) {
  const text = q.q + ' ' + (q.explanation || '')
  if (/NOT|EXCEPT|incorrect|does not|never|all of the above except/i.test(q.q)) return 'elimination'
  if (/Consider the following|Which of the (above|following).*(is|are) correct|match/i.test(q.q)) return 'analysis'
  if (/refers to|means|is known as|is called|is defined/i.test(q.q)) return 'recall'
  if (/when|sequence|order|chronolog/i.test(q.q)) return 'pattern'
  if (/If|scenario|situation|case study|apply|implication/i.test(q.q)) return 'application'
  if (/who|what|where|which (of the following|one)|the term/i.test(q.q)) return 'recall'
  if (/how|why|explain|reason|because|since/i.test(q.q)) return 'analysis'
  if (/compare|contrast|difference|similarity|relation/i.test(q.q)) return 'analysis'
  return 'recall'
}

const SKILL_LABELS = { recall: 'Recall', elimination: 'Elimination', analysis: 'Analysis', pattern: 'Pattern', application: 'Application' }
const SKILL_COLORS = { recall: 'var(--primary)', elimination: 'var(--phys)', analysis: '#F59E0B', pattern: '#10B981', application: '#EF4444' }

function saveSession(subject, topic, questions, answers, confidence, qTimes, expectedScore, savePracticeDecay) {
  try {
    const now = Date.now()
    questions.forEach((q, i) => {
      const ans = answers[i]
      const conf = confidence[i]
      const t = qTimes[i]
      if (ans === undefined) return
      const entry = { qId: q.id || q.q, chapter: q.chapter || topic || '', subject, skill: tagSkill(q), correct: ans === q.ans, confidence: conf || 0, timeMs: t?.answered && t?.shown ? t.answered - t.shown : 0, ts: now, expectedScore }
      if (savePracticeDecay) {
        savePracticeDecay(q.id || q.q, entry)
      } else {
        const existing = JSON.parse(localStorage.getItem(DECAY_KEY) || '{}')
        const history = existing[q.id || q.q] || []
        history.push(entry)
        existing[q.id || q.q] = history
        localStorage.setItem(DECAY_KEY, JSON.stringify(existing))
      }
    })
  } catch {}
}

function getChapterRetention(chapterId, decayData) {
  try {
    const existing = decayData || (JSON.parse(localStorage.getItem(DECAY_KEY) || '{}'))
    const now = Date.now()
    const DAY = 86400000
    let lastTs = 0; let total = 0; let correct = 0
    Object.values(existing).forEach(entries => entries.forEach(e => {
      if (e.chapter === chapterId || e.chapter?.toLowerCase().trim() === chapterId?.toLowerCase().trim()) {
        if (e.ts > lastTs) lastTs = e.ts; total++; if (e.correct) correct++
      }
    }))
    const daysSince = lastTs > 0 ? Math.floor((now - lastTs) / DAY) : null
    const status = daysSince === null ? 'never' : daysSince >= 7 ? 'decaying' : daysSince >= 3 ? 'aging' : 'fresh'
    return { daysSince, status, total, accuracy: total > 0 ? Math.round(correct / total * 100) : 0 }
  } catch { return { daysSince: null, status: 'never', total: 0, accuracy: 0 } }
}

function getLearnerProfile(decayData) {
  try {
    const existing = decayData || (JSON.parse(localStorage.getItem(DECAY_KEY) || '{}'))
    const entries = Object.values(existing).flat()
    if (entries.length === 0) return null
    const total = entries.length
    const correct = entries.filter(e => e.correct).length
    const accuracy = Math.round(correct / total * 100)
    const avgConf = Math.round(entries.reduce((s, e) => s + e.confidence, 0) / total * 20)
    const guessed = entries.filter(e => e.correct && e.confidence <= 2).length
    const misinformed = entries.filter(e => !e.correct && e.confidence >= 4).length
    const knowledge = entries.filter(e => e.correct && e.confidence >= 4).length
    const guessingTendency = Math.round(guessed / correct * 100)
    // Confidence bias: overconfidence if confident-wrong > unconfident-correct
    const overconfident = entries.filter(e => !e.correct && e.confidence >= 4).length
    const underconfident = entries.filter(e => e.correct && e.confidence <= 2).length
    const bias = overconfident > underconfident ? 'overconfident' : underconfident > overconfident ? 'underconfident' : 'calibrated'
    // Recent sessions: group by approximate session (entries within 5min of each other)
    const sorted = [...entries].sort((a, b) => b.ts - a.ts)
    const recentSessions = []
    let sessionStart = sorted[0].ts
    let sessionEntries = []
    for (const e of sorted) {
      if (sessionStart - e.ts > 300000) {
        if (sessionEntries.length > 0) recentSessions.push(sessionEntries)
        sessionStart = e.ts; sessionEntries = [e]
      } else { sessionEntries.push(e) }
    }
    if (sessionEntries.length > 0) recentSessions.push(sessionEntries)
    const last5 = recentSessions.slice(0, 5).map(s => {
      const c = s.filter(e => e.correct).length
      return { total: s.length, correct: c, pct: Math.round(c / s.length * 100), ts: s[0].ts }
    })
    // Self-awareness from expected scores
    const withExp = entries.filter(e => e.expectedScore !== undefined && e.expectedScore !== null)
    const selfAware = withExp.length > 0
      ? Math.round(withExp.filter(e => Math.abs(e.expectedScore - (e.correct ? 100 : 0)) <= 30).length / withExp.length * 100)
      : null
    // Decaying count
    const now = Date.now(); const DAY = 86400000
    const chapterLast = {}
    entries.forEach(e => {
      const ch = e.chapter; if (!ch) return
      if (!chapterLast[ch] || e.ts > chapterLast[ch]) chapterLast[ch] = e.ts
    })
    const decaying = Object.values(chapterLast).filter(ts => now - ts > 7 * DAY).length
    // Skill breakdown
    const skillStats = {}
    entries.forEach(e => {
      if (!e.skill) return
      if (!skillStats[e.skill]) skillStats[e.skill] = { total: 0, correct: 0 }
      skillStats[e.skill].total++
      if (e.correct) skillStats[e.skill].correct++
    })
    const skills = Object.entries(skillStats).map(([s, v]) => ({
      skill: s, label: SKILL_LABELS[s] || s, color: SKILL_COLORS[s] || 'var(--text-3)',
      accuracy: Math.round(v.correct / v.total * 100), total: v.total,
    })).sort((a, b) => a.accuracy - b.accuracy)
    return { total, accuracy, avgConf, guessed, misinformed, knowledge, guessingTendency, bias, overconfident, underconfident, last5, selfAware, decaying, skills }
  } catch { return null }
}

/* ═══════════════════════════ MCQ TAB ════════════════════════════ */
function PracticeMCQTab() {
  const navigate = useNavigate()
  const saveTopicScore = useStore(s => s.saveTopicScore)
  const practiceDecay = useStore(s => s.practiceDecay)
  const savePracticeDecay = useStore(s => s.savePracticeDecay)
  const [selectedSubjects, setSelectedSubjects] = useState(['gs1'])
  const [selectedChapters, setSelectedChapters] = useState([])
  const [numQ, setNumQ] = useState(10)
  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState('setup')
  const [questions, setQuestions] = useState([])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [confidence, setConfidence] = useState({})
  const [qTimes, setQTimes] = useState({})
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [waitingConfidence, setWaitingConfidence] = useState(false)
  const [expectedScore, setExpectedScore] = useState(50)
  const [showStartModal, setShowStartModal] = useState(false)

  const allQuestions = useMemo(() => getAllUpscQuestions() || [], [])

  const chapterCounts = useMemo(() => {
    const counts = {}
    allQuestions.forEach(q => {
      const key = (q.chapter || '').toLowerCase().trim()
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }, [allQuestions])

  const subjectQuestionCounts = useMemo(() => {
    const counts = {}
    upscSubjects.forEach(s => {
      const chIds = s.chapters.map(c => c.id)
      counts[s.id] = allQuestions.filter(q => chIds.includes(q.chapter)).length
    })
    return counts
  }, [allQuestions])

  const subjectsWithChapters = useMemo(() => {
    return upscSubjects.filter(s => selectedSubjects.includes(s.id)).map(sub => ({
      ...sub,
      chapters: sub.chapters
        .map(ch => ({ ...ch, qCount: chapterCounts[ch.id] || chapterCounts[ch.name.toLowerCase().trim()] || 0 }))
        .filter(ch => ch.qCount > 0 && ch.name.toLowerCase().includes(search.toLowerCase())),
    })).filter(s => s.chapters.length > 0)
  }, [selectedSubjects, allQuestions, search, chapterCounts])

  const selectedQuestions = useMemo(() => {
    if (selectedChapters.length === 0) return allQuestions.filter(q => selectedSubjects.some(sId => upscSubjects.find(s => s.id === sId)?.chapters.some(c => c.id === q.chapter)))
    return allQuestions.filter(q => selectedChapters.includes(q.chapter))
  }, [allQuestions, selectedChapters, selectedSubjects])

  const toggleChapter = (id) => {
    setSelectedChapters(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const toggleAllChapters = () => {
    const allIds = subjectsWithChapters.flatMap(s => s.chapters.map(c => c.id))
    const allSelected = allIds.every(id => selectedChapters.includes(id))
    setSelectedChapters(prev => allSelected ? prev.filter(id => !allIds.includes(id)) : [...new Set([...prev, ...allIds])])
  }

  const startPractice = (count) => {
    const pool = selectedQuestions
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count || numQ, pool.length))
    setQuestions(shuffled)
    setCurrentQ(0)
    setAnswers({})
    setConfidence({})
    setQTimes({ 0: { shown: Date.now(), answered: null } })
    setShowResult(false)
    setScore(0)
    setWaitingConfidence(false)
    setShowStartModal(false)
    setPhase('practice')
  }

  const selectAnswer = (idx) => {
    if (answers[currentQ] !== undefined) return
    setAnswers(prev => ({ ...prev, [currentQ]: idx }))
    setQTimes(prev => ({ ...prev, [currentQ]: { ...prev[currentQ], answered: Date.now() } }))
    if (idx === questions[currentQ]?.ans) setScore(prev => prev + 1)
    setWaitingConfidence(true)
  }

  const setConfidenceRating = (rating) => {
    setConfidence(prev => ({ ...prev, [currentQ]: rating }))
    setWaitingConfidence(false)
  }

  const nextQ = () => {
    if (currentQ < questions.length - 1) {
      const next = currentQ + 1
      setCurrentQ(next)
      setQTimes(prev => ({ ...prev, [next]: { shown: Date.now(), answered: null } }))
    } else {
      // Save per-topic scores for each chapter
      const chaptersInSession = [...new Set(questions.filter(q => q.chapter).map(q => q.chapter))]
      chaptersInSession.forEach(ch => {
        const chQ = questions.filter(q => q.chapter === ch)
        const correct = chQ.filter(q => answers[questions.indexOf(q)] === q.ans).length
        saveTopicScore(ch, correct, chQ.length)
      })
      const allTopics = [...new Set(questions.map(q => q.chapter).filter(Boolean))]
      saveSession(allTopics.join(','), '', questions, answers, confidence, qTimes, expectedScore, savePracticeDecay)
      setShowResult(true)
    }
  }

  if (phase === 'practice') {
    if (showResult) {
      const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0
      // Behavioral metrics
      const hcW = questions.filter((q, i) => answers[i] !== undefined && answers[i] !== q.ans && (confidence[i] || 0) >= 4)
      const hcC = questions.filter((q, i) => answers[i] !== undefined && answers[i] === q.ans && (confidence[i] || 0) >= 4)
      const lcC = questions.filter((q, i) => answers[i] !== undefined && answers[i] === q.ans && (confidence[i] || 0) <= 2)
      const lcW = questions.filter((q, i) => answers[i] !== undefined && answers[i] !== q.ans && (confidence[i] || 0) <= 2)
      const totalWithConf = Object.keys(confidence).length
      const calibration = totalWithConf > 0
        ? Math.round(questions.filter((q, i) => {
            const conf = confidence[i]
            if (conf === undefined) return false
            const correct = answers[i] === q.ans
            return (conf >= 4 && correct) || (conf <= 2 && !correct)
          }).length / totalWithConf * 100)
        : null
      const calibrationLabel = calibration !== null
        ? (calibration >= 80 ? 'Good' : calibration >= 50 ? 'Fair' : 'Needs work')
        : ''
      const avgConf = totalWithConf > 0
        ? Math.round(Object.values(confidence).reduce((a, b) => a + b, 0) / totalWithConf * 20)
        : null
      const predError = questions.length > 0 ? Math.abs(expectedScore - pct) : null
      const selfAwareness = predError !== null ? Math.max(0, 100 - predError) : null

      // Speed and Decision Quality metrics
      const totalWithTimes = Object.values(qTimes).filter(t => t.answered).length
      const avgSpeed = totalWithTimes > 0
        ? Math.round(Object.values(qTimes).filter(t => t.answered).reduce((s, t) => s + (t.answered - t.shown), 0) / totalWithTimes)
        : null
      const decQ = questions.map((q, i) => {
        const cor = answers[i] === q.ans
        const conf = confidence[i] || 0
        const t = qTimes[i]
        const dur = t?.answered ? (t.answered - t.shown) : null
        const fast = dur !== null && dur < 10000
        const slow = dur !== null && dur > 30000
        let cls
        if (cor && conf >= 4 && !slow) cls = 'knowledge'
        else if (cor && conf <= 2) cls = 'guessed'
        else if (!cor && conf >= 4) cls = 'misinformed'
        else if (!cor && (conf <= 2 || slow)) cls = 'beginner'
        else if (cor) cls = 'knowledge'
        else cls = 'beginner'
        const risk = fast && conf <= 2 ? 1 : 0
        return { cls, risk }
      })
      const dCounts = { knowledge: 0, guessed: 0, misinformed: 0, beginner: 0, risk: 0 }
      decQ.forEach(d => { dCounts[d.cls]++; if (d.risk) dCounts.risk++ })
      const riskPct = questions.length > 0 ? Math.round(dCounts.risk / questions.length * 100) : 0

      // Skill breakdown for this session
      const sessionSkills = {}
      questions.forEach((q, i) => {
        if (answers[i] === undefined) return
        const sk = tagSkill(q)
        if (!sessionSkills[sk]) sessionSkills[sk] = { total: 0, correct: 0 }
        sessionSkills[sk].total++
        if (answers[i] === q.ans) sessionSkills[sk].correct++
      })
      const sessionSkillList = Object.entries(sessionSkills).map(([s, v]) => ({
        skill: s, label: SKILL_LABELS[s] || s, color: SKILL_COLORS[s] || '#6B7280',
        accuracy: Math.round(v.correct / v.total * 100), total: v.total,
      })).sort((a, b) => a.accuracy - b.accuracy)

      // Behavioral insight
      let insight = ''
      if (predError !== null && predError > 30) insight = `You predicted ${expectedScore}% but got ${pct}%. The gap is ${predError}%. Self-awareness is the #1 predictor of improvement.`
      else if (hcW.length > 0) insight = `You were highly confident on ${hcW.length} wrong answer(s). Review these topics — misconceptions block learning more than gaps.`
      else if (dCounts.misinformed > dCounts.knowledge) insight = `You have more misconceptions than solid knowledge. Review fundamentals before attempting advanced questions.`
      else if (sessionSkillList.length > 0 && sessionSkillList[0].accuracy < 40) insight = `Weakest skill: ${sessionSkillList[0].label} (${sessionSkillList[0].accuracy}%). Focus on ${sessionSkillList[0].label.toLowerCase()} practice.`
      else if (dCounts.guessed > 0 && dCounts.guessed >= dCounts.knowledge * 0.5) insight = `${dCounts.guessed} correct answers were guesses. Trust your intuition more — you know more than you think.`
      else if (riskPct > 30) insight = `You rushed ${riskPct}% of questions. Slowing down can improve accuracy.`
      else if (lcC.length > 0) insight = `You got some right despite low confidence. Trust your knowledge more.`
      else if (totalWithConf > 0 && avgConf < 50) insight = `Consistently low confidence — you know more than you think.`
      else if (predError !== null) insight = `Good self-awareness! Your expected (${expectedScore}%) was close to actual (${pct}%).`
      else insight = `Practice more to get personalized behavioral insights.`
      return (
        <AnimatePresence mode="wait">
          <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <motion.div style={{ ...cardStyle, padding: 20, textAlign: 'center' }} whileHover={cardHover}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>{pct >= 60 ? '🎉' : pct >= 30 ? '👍' : '💪'}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{score}/{questions.length}</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{pct}% accuracy</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '14px 0' }}>
                <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: '8px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>{score}</div>
                  <div style={{ fontSize: 10, color: 'var(--success)' }}>Correct</div>
                </div>
                <div style={{ background: 'var(--error-light)', borderRadius: 8, padding: '8px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--error)' }}>{questions.length - score}</div>
                  <div style={{ fontSize: 10, color: 'var(--error)' }}>Incorrect</div>
                </div>
              </div>
              {/* Decision Quality */}
              {totalWithConf > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6, textAlign: 'left' }}>
                    Decision Quality
                    {avgSpeed !== null && <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 6 }}>· Avg {Math.round(avgSpeed / 1000)}s/q</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)' }}>{dCounts.knowledge}</div>
                      <div style={{ fontSize: 9, color: 'var(--success)' }}>Knowledge</div>
                    </div>
                    <div style={{ background: 'var(--warning-light)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>{dCounts.guessed}</div>
                      <div style={{ fontSize: 9, color: '#D97706' }}>Guessed</div>
                    </div>
                    <div style={{ background: 'var(--error-light)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--error)' }}>{dCounts.misinformed}</div>
                      <div style={{ fontSize: 9, color: 'var(--error)' }}>Misinformed</div>
                    </div>
                    <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>{dCounts.beginner}</div>
                      <div style={{ fontSize: 9, color: 'var(--primary)' }}>Beginner</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                    <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: '6px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--success)' }}>{calibration}%</div>
                      <div style={{ fontSize: 9, color: 'var(--success)' }}>Calibration</div>
                    </div>
                    <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '6px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>{avgConf}%</div>
                      <div style={{ fontSize: 9, color: 'var(--primary)' }}>Avg Confidence</div>
                    </div>
                    <div style={{ background: riskPct > 30 ? 'var(--error-light)' : 'var(--surface-alt)', borderRadius: 8, padding: '6px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: riskPct > 30 ? '#EF4444' : 'var(--text-2)' }}>{riskPct}%</div>
                      <div style={{ fontSize: 9, color: riskPct > 30 ? '#EF4444' : 'var(--text-2)' }}>Risk (fast+unsure)</div>
                    </div>
                  </div>
                  {predError !== null && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                      background: selfAwareness >= 80 ? 'var(--success-light)' : 'var(--warning-light)',
                      borderRadius: 8, padding: '8px 12px',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: selfAwareness >= 80 ? '#059669' : '#92400E' }}>
                          Prediction Error
                        </div>
                        <div style={{ fontSize: 10, color: selfAwareness >= 80 ? '#065F46' : '#92400E' }}>
                          Expected {expectedScore}% · Got {pct}% · Gap {predError}%
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: selfAwareness >= 80 ? '#059669' : '#D97706' }}>
                        {selfAwareness}%
                      </div>
                    </div>
                  )}
                  {/* Skill breakdown */}
                  {sessionSkillList.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 4, textAlign: 'left' }}>Cognitive Skills</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {sessionSkillList.map(sk => (
                          <div key={sk.skill} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 600, width: 60, color: sk.color }}>{sk.label}</span>
                            <div style={{ flex: 1, height: 6, background: 'var(--surface-alt)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: `${sk.accuracy}%`, height: '100%', background: sk.color, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, color: sk.accuracy >= 60 ? '#059669' : '#EF4444', width: 30, textAlign: 'right' }}>{sk.accuracy}%</span>
                            <span style={{ fontSize: 8, color: 'var(--text-3)', width: 20, textAlign: 'right' }}>{sk.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{
                    background: calibration !== null && calibration >= 80 ? 'var(--success-light)' : 'var(--warning-light)',
                    borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.5,
                    color: calibration !== null && calibration >= 80 ? '#065F46' : '#92400E',
                    textAlign: 'left',
                  }}>
                    <strong>{calibrationLabel}:</strong> {insight}
                  </div>
                </div>
              )}
              <motion.button onClick={() => setPhase('setup')} whileTap={{ scale: 0.97 }} style={{
                width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Practice Again
              </motion.button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )
    }

    const q = questions[currentQ]
    if (!q) return null
    const answered = answers[currentQ] !== undefined
    const isCorrect = answered && answers[currentQ] === q.ans

    return (
      <AnimatePresence mode="wait">
        <motion.div key="practice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Q{currentQ + 1}/{questions.length}</div>
              <div style={{ flex: 1, height: 4, background: 'var(--surface-alt)', borderRadius: 99 }}>
                <div style={{ width: `${((currentQ + 1) / questions.length) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 99 }} />
              </div>
            </div>
            <motion.div style={{ ...cardStyle, padding: 14, marginBottom: 10 }} whileHover={cardHover}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', lineHeight: 1.6, marginBottom: 14 }}>{q.q}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {q.options.map((opt, oi) => {
                  const selected = answers[currentQ] === oi
                  const showCorrect = answered && oi === q.ans
                  const showWrong = answered && selected && oi !== q.ans
                  return (
                    <motion.button key={oi} onClick={() => selectAnswer(oi)} disabled={answered} whileTap={{ scale: 0.97 }} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderRadius: 12, cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12, textAlign: 'left', lineHeight: 1.4,
                      border: showCorrect ? '2px solid #10B981' : showWrong ? '2px solid #EF4444' : selected ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                      background: showCorrect ? 'var(--success-light)' : showWrong ? 'var(--error-light)' : selected ? 'var(--primary-light)' : 'var(--card-bg)',
                      color: 'var(--text)', width: '100%', transition: '0.1s',
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: showCorrect ? '#10B981' : showWrong ? '#EF4444' : selected ? 'var(--primary)' : 'var(--surface-alt)',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                      }}>
                        {showCorrect ? <CheckCircle size={12} /> : showWrong ? <XCircle size={12} /> : String.fromCharCode(65 + oi)}
                      </div>
                      {opt}
                    </motion.button>
                  )
                })}
              </div>
              {answered && q.explanation && (
                <div style={{ marginTop: 10, background: 'var(--primary-light)', borderRadius: 8, padding: 10, fontSize: 11, color: 'var(--primary)', lineHeight: 1.5 }}>
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
              {/* Confidence slider */}
              {answered && waitingConfidence && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>How sure were you? (This self-assessment trains your calibration)</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map(r => (
                      <motion.button key={r} onClick={() => setConfidenceRating(r)} whileTap={{ scale: 0.95 }} style={{
                        flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: confidence[currentQ] === r ? 'var(--primary)' : 'var(--surface-alt)',
                        color: confidence[currentQ] === r ? '#fff' : 'var(--text-3)',
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {r}
                      </motion.button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: 2, padding: '0 4px' }}>
                    <span>Guess</span>
                    <span>Sure</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
            {answered && !waitingConfidence && (
              <motion.button onClick={nextQ} whileTap={{ scale: 0.97 }} style={{
                width: '100%', padding: '11px 0', borderRadius: 12, border: 'none',
                background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {currentQ < questions.length - 1 ? 'Next Question →' : 'See Results'}
              </motion.button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  /* Setup */
  const allSelected = subjectsWithChapters.length > 0 && subjectsWithChapters.every(s => s.chapters.every(c => selectedChapters.includes(c.id)))

  return (
    <>
      <AnimatePresence>
        <motion.div key="setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ paddingBottom: 140 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search chapters..." />

            {/* Cognitive Twin Profile */}
            {(() => {
              const profile = getLearnerProfile(practiceDecay)
              if (!profile || profile.total < 3) return null
              return (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ ...cardStyle, padding: 14, marginBottom: 10 }} whileHover={cardHover}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, background: '#8B5CF615',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>🧠</div>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Your Brain Profile</div>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{profile.total} questions</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                    <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: '5px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>{profile.accuracy}%</div>
                      <div style={{ fontSize: 9, color: 'var(--success)' }}>Mastery</div>
                    </div>
                    <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '5px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>{profile.avgConf}%</div>
                      <div style={{ fontSize: 9, color: 'var(--primary)' }}>Avg Confidence</div>
                    </div>
                    <div style={{ background: profile.bias === 'calibrated' ? 'var(--success-light)' : 'var(--warning-light)', borderRadius: 8, padding: '5px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: profile.bias === 'calibrated' ? '#059669' : '#D97706' }}>{profile.guessingTendency}%</div>
                      <div style={{ fontSize: 9, color: profile.bias === 'calibrated' ? '#059669' : '#D97706' }}>Guess Rate</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: 99,
                      background: profile.bias === 'calibrated' ? 'var(--success-light)' : profile.bias === 'overconfident' ? 'var(--error-light)' : 'var(--primary-light)',
                      color: profile.bias === 'calibrated' ? '#059669' : profile.bias === 'overconfident' ? '#EF4444' : 'var(--primary)',
                      fontWeight: 600,
                    }}>
                      {profile.bias === 'calibrated' ? '✓ Calibrated' : profile.bias === 'overconfident' ? `! ${profile.overconfident} overconfident` : `? ${profile.underconfident} underconfident`}
                    </span>
                    {profile.selfAware !== null && (
                      <span style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 99,
                        background: profile.selfAware >= 70 ? 'var(--success-light)' : 'var(--warning-light)',
                        color: profile.selfAware >= 70 ? '#059669' : '#D97706', fontWeight: 600,
                      }}>
                        Self-aware: {profile.selfAware}%
                      </span>
                    )}
                    {profile.decaying > 0 && (
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: 'var(--error-light)', color: 'var(--error)', fontWeight: 600 }}>
                        {profile.decaying} decaying
                      </span>
                    )}
                  </div>
                  {profile.last5.length >= 2 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-3)', marginBottom: 3 }}>Recent accuracy trend</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
                        {profile.last5.map((s, i) => (
                          <div key={i} style={{
                            flex: 1, height: `${s.pct}%`, minHeight: 8, borderRadius: '4px 4px 0 0',
                            background: s.pct >= 60 ? '#10B981' : s.pct >= 40 ? '#F59E0B' : '#EF4444',
                            position: 'relative',
                          }}>
                            <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                              {s.pct}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.skills.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-3)', marginBottom: 3 }}>Cognitive Skills</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {profile.skills.map(sk => (
                          <div key={sk.skill} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 600, width: 60, color: sk.color }}>{sk.label}</span>
                            <div style={{ flex: 1, height: 6, background: 'var(--surface-alt)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: `${sk.accuracy}%`, height: '100%', background: sk.color, borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, color: sk.accuracy >= 60 ? '#059669' : '#EF4444', width: 30, textAlign: 'right' }}>{sk.accuracy}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })()}

            {/* Subject multi-select */}
            <motion.div style={{ ...cardStyle, padding: 16, marginBottom: 12, marginTop: 12 }} whileHover={cardHover}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 8 }}>Subjects</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {upscSubjects.map(s => {
                  const active = selectedSubjects.includes(s.id)
                  return (
                    <motion.button key={s.id} onClick={() => {
                      setSelectedSubjects(prev => {
                        if (prev.includes(s.id)) return prev.filter(x => x !== s.id)
                        return [...prev, s.id]
                      })
                      setSelectedChapters(prev => prev.filter(chId => {
                        if (prev.includes(s.id)) return true
                        const oldSubCh = upscSubjects.find(x => x.id === s.id)?.chapters.map(c => c.id) || []
                        return !oldSubCh.includes(chId)
                      }))
                    }} whileTap={{ scale: 0.97 }} style={{
                      padding: '8px 14px', borderRadius: 8, border: active ? 'none' : '1px solid #e5e7eb', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: active ? s.color : '#fff',
                      color: active ? '#fff' : '#333',
                      boxShadow: active ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
                    }}>
                      {active && <CheckCircle size={12} />}
                      {s.name}
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
                        background: active ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                        color: active ? '#fff' : '#666',
                      }}>{subjectQuestionCounts[s.id] || 0}Q</span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>

            {/* Retention warning banner */}
            {(() => {
              const decaying = subjectsWithChapters.flatMap(s => s.chapters).filter(ch => getChapterRetention(ch.id, practiceDecay).status === 'decaying')
              if (decaying.length === 0) return null
              return (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
                  marginBottom: 8, padding: '8px 12px', borderRadius: 10,
                  background: 'var(--error-light)', border: '1px solid var(--border)',
                  fontSize: 11, color: 'var(--error-dark)', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Zap size={13} color="#EF4444" />
                  <strong>{decaying.length}</strong> chapter(s) likely forgetting — last practiced 7+ days ago
                </motion.div>
              )
            })()}

            {/* Chapter multi-select cards */}
            {subjectsWithChapters.map(sub => (
              <div key={sub.id} style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 6, marginLeft: 2,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sub.color }}>{sub.name}</div>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    {sub.chapters.filter(c => selectedChapters.includes(c.id)).reduce((s, c) => s + c.qCount, 0)} / {sub.chapters.reduce((s, c) => s + c.qCount, 0)} Q selected
                  </span>
                </div>
                {sub.chapters.map(ch => {
                  const sel = selectedChapters.includes(ch.id)
                  const ret = getChapterRetention(ch.id, practiceDecay)
                  const retColor = ret.status === 'fresh' ? 'var(--success)' : ret.status === 'aging' ? '#F59E0B' : ret.status === 'decaying' ? 'var(--error)' : 'var(--text-3)'
                  return (
                    <motion.div key={ch.id} onClick={() => toggleChapter(ch.id)}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        background: '#fff', padding: '12px 14px',
                        cursor: 'pointer', marginBottom: 6,
                        border: sel ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                        borderRadius: 8,
                        display: 'flex', alignItems: 'center', gap: 10,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        background: sel ? 'var(--primary)' : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: sel ? '#fff' : '#666',
                      }}>
                        {ch.qCount}
                      </div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {ch.name}
                        {ret.daysSince !== null && (
                          <span style={{ fontSize: 11, color: retColor, fontWeight: 500, whiteSpace: 'nowrap' }}>
                            · {ret.daysSince === 0 ? 'today' : ret.daysSince === 1 ? '1d ago' : `${ret.daysSince}d ago`}
                          </span>
                        )}
                      </div>
                      <div style={{
                        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                        background: sel ? 'var(--primary)' : '#fff',
                        border: `1.5px solid ${sel ? 'var(--primary)' : '#e5e7eb'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {sel && <Check size={12} color="#fff" />}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Fixed bottom bar */}
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} style={{
        position: 'fixed', bottom: 116, left: 16, right: 16, zIndex: 100,
        background: 'var(--card-bg)', borderTop: '1px solid var(--border)', padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.3)',
        borderRadius: 16,
      }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>
          <strong style={{ fontSize: 14, color: 'var(--text)' }}>{selectedChapters.length}</strong> chapters · <strong style={{ fontSize: 14, color: 'var(--text)' }}>{selectedQuestions.length}</strong> questions
        </div>
        <motion.button onClick={() => setShowStartModal(true)}
          disabled={selectedChapters.length === 0}
          whileTap={{ scale: 0.97 }} style={{
            padding: '12px 24px', borderRadius: 10, border: '2px solid',
            background: selectedChapters.length > 0 ? 'var(--primary)' : '#fff',
            color: selectedChapters.length > 0 ? '#fff' : '#333',
            fontSize: 14, fontWeight: 700, cursor: selectedChapters.length > 0 ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
            borderColor: selectedChapters.length > 0 ? 'var(--primary)' : '#333',
            boxShadow: selectedChapters.length > 0 ? '0 4px 12px rgba(63,125,255,0.4)' : '0 2px 4px rgba(0,0,0,0.1)',
            position: 'relative', zIndex: 60,
          }}>
          Start Practice
        </motion.button>
      </motion.div>

      {/* Start modal */}
      <AnimatePresence>
        {showStartModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowStartModal(false)} style={{
              position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()} style={{
                background: 'var(--card-bg)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320,
              }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Practice Setup</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
                {selectedChapters.length} chapters · {selectedQuestions.length} questions available
              </div>

              {/* Question count */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Questions</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                {[5, 10, 20, 50].map(n => (
                  <motion.button key={n} onClick={() => setNumQ(n)} whileTap={{ scale: 0.97 }} style={{
                    flex: 1, padding: '8px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                    background: numQ === n ? 'var(--primary)' : 'var(--surface-alt)',
                    color: numQ === n ? '#fff' : 'var(--text-2)',
                  }}>
                    {n}
                  </motion.button>
                ))}
              </div>

              {/* Expected score */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Expected score?</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                {[0, 20, 50, 80, 100].map(v => (
                  <motion.button key={v} onClick={() => setExpectedScore(v)} whileTap={{ scale: 0.95 }} style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: expectedScore === v ? 'var(--phys)' : 'var(--surface-alt)',
                    color: expectedScore === v ? '#fff' : 'var(--text-2)',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {v}%
                  </motion.button>
                ))}
              </div>

              <motion.button onClick={() => startPractice(numQ)} whileTap={{ scale: 0.97 }} style={{
                width: '100%', padding: '11px 0', borderRadius: 12, border: 'none',
                background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Begin Quiz ({Math.min(numQ, selectedQuestions.length)} Q)
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ═══════════════════════════ FLASHCARDS TAB ═══════════════════════ */
function FlashcardsTab() {
  const navigate = useNavigate()
  const [selectedSubjects, setSelectedSubjects] = useState(['gs1'])
  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState('setup')
  const [cards, setCards] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState([])
  const [review, setReview] = useState([])
  const [showSummary, setShowSummary] = useState(false)
  const [selectedChapters, setSelectedChapters] = useState([])

  const allQ = useMemo(() => getAllUpscQuestions(), [])

  const subjectQuestionCounts = useMemo(() => {
    const counts = {}
    upscSubjects.forEach(s => {
      const chIds = s.chapters.map(c => c.id)
      counts[s.id] = allQ.filter(q => chIds.includes(q.chapter)).length
    })
    return counts
  }, [allQ])

  const subjectsWithChapters = useMemo(() => {
    return upscSubjects.filter(s => selectedSubjects.includes(s.id)).map(sub => ({
      ...sub,
      chapters: sub.chapters
        .map(ch => {
          const qs = allQ.filter(q => {
            const qc = (q.chapter || '').toLowerCase().trim()
            return qc === ch.id || qc === ch.name.toLowerCase().trim()
          })
          return { ...ch, qCount: qs.length }
        })
        .filter(ch => ch.qCount > 0 && ch.name.toLowerCase().includes(search.toLowerCase())),
    })).filter(s => s.chapters.length > 0)
  }, [selectedSubjects, allQ, search])

  const startFlashcards = () => {
    const selectedIds = selectedChapters.length > 0 ? selectedChapters
      : subjectsWithChapters.flatMap(s => s.chapters.map(c => c.id))
    const pool = allQ.filter(q => {
      const qc = (q.chapter || '').toLowerCase().trim()
      return selectedIds.some(cid => qc === cid || qc === upscSubjects.flatMap(s => s.chapters).find(c => c.id === cid)?.name.toLowerCase().trim())
    }).sort(() => Math.random() - 0.5).slice(0, 15)
    const cardData = pool.map(q => ({
      term: q.q,
      def: q.options[q.ans] + (q.explanation ? ' — ' + q.explanation : ''),
    }))
    if (cardData.length === 0) return
    setCards(cardData)
    setCurrentIdx(0)
    setFlipped(false)
    setKnown([])
    setReview([])
    setShowSummary(false)
    setPhase('study')
  }

  const markKnown = () => {
    setKnown(prev => [...prev, currentIdx])
    if (currentIdx < cards.length - 1) { setCurrentIdx(prev => prev + 1); setFlipped(false) }
    else setShowSummary(true)
  }

  const markReview = () => {
    setReview(prev => [...prev, cards[currentIdx]])
    if (currentIdx < cards.length - 1) { setCurrentIdx(prev => prev + 1); setFlipped(false) }
    else setShowSummary(true)
  }

  const toggleChapter = (id) => {
    setSelectedChapters(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id])
  }

  if (phase === 'study') {
    if (showSummary) {
      return (
        <AnimatePresence mode="wait">
          <motion.div key="summary" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <motion.div style={{ ...cardStyle, padding: 20, textAlign: 'center' }} whileHover={cardHover}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Session Complete</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }}>
                {known.length} known · {review.length} to review
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{known.length}</div>
                  <div style={{ fontSize: 10, color: 'var(--success)' }}>Know It</div>
                </div>
                <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{review.length}</div>
                  <div style={{ fontSize: 10, color: 'var(--primary)' }}>Review</div>
                </div>
              </div>
              <motion.button onClick={() => setPhase('setup')} whileTap={{ scale: 0.97 }} style={{
                width: '100%', padding: '10px 0', borderRadius: 12, border: 'none',
                background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                New Session
              </motion.button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )
    }

    const card = cards[currentIdx]
    if (!card) return null

    return (
      <AnimatePresence mode="wait">
        <motion.div key="study" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>{currentIdx + 1}/{cards.length}</div>
              <div style={{ flex: 1, height: 4, background: 'var(--surface-alt)', borderRadius: 99 }}>
                <div style={{ width: `${((currentIdx + 1) / cards.length) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: 99 }} />
              </div>
            </div>

            <motion.div onClick={() => setFlipped(!flipped)} style={{
              ...cardStyle, padding: '28px 18px', cursor: 'pointer', minHeight: 180,
              display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
              marginBottom: 10, perspective: 800,
            }} whileHover={cardHover}>
              <motion.div
                key={flipped ? 'back' : 'front'}
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ duration: 0.25 }}
                style={{ width: '100%' }}
              >
                {!flipped ? (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.5 }}>{card.term}</div>
                    <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 500 }}>Tap to reveal</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{card.def}</div>
                )}
              </motion.div>
            </motion.div>

            <div style={{ display: 'flex', gap: 8 }}>
              <motion.button onClick={markReview} whileTap={{ scale: 0.97 }} style={{
                flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid var(--border)',
                background: 'var(--card-bg)', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Need Review
              </motion.button>
              <motion.button onClick={markKnown} whileTap={{ scale: 0.97 }} style={{
                flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
                background: '#10B981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <CheckCircle size={14} /> Know It
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  /* Setup */
  const totalFCards = selectedChapters.length > 0
    ? allQ.filter(q => {
        const qc = (q.chapter || '').toLowerCase().trim()
        return selectedChapters.some(cid => qc === cid || qc === upscSubjects.flatMap(s => s.chapters).find(c => c.id === cid)?.name.toLowerCase().trim())
      }).length
    : subjectsWithChapters.flatMap(s => s.chapters).reduce((s, c) => s + c.qCount, 0)

  return (
    <>
      <AnimatePresence>
        <motion.div key="setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ paddingBottom: 140 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search chapters..." size="md" />

            {/* Subject pills — multi-select */}
            <motion.div style={{ ...cardStyle, padding: 16, marginBottom: 12, marginTop: 12 }} whileHover={cardHover}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 8 }}>Subjects</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {upscSubjects.map(s => {
                  const isActive = selectedSubjects.includes(s.id)
                  return (
                    <motion.button key={s.id} onClick={() => {
                      if (isActive && selectedSubjects.length === 1) return
                      setSelectedSubjects(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])
                    }} whileTap={{ scale: 0.97 }} style={{
                      padding: '8px 14px', borderRadius: 8, border: isActive ? 'none' : '1px solid #e5e7eb', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: isActive ? s.color : '#fff',
                      color: isActive ? '#fff' : '#333',
                      boxShadow: isActive ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
                    }}>
                      {isActive && <CheckCircle size={12} />}
                      {s.name}
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
                        background: isActive ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                        color: isActive ? '#fff' : '#666',
                      }}>{subjectQuestionCounts[s.id] || 0}Q</span>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>

            {/* Chapter cards */}
            {subjectsWithChapters.length > 0 ? (
              <div style={{ marginBottom: 10 }}>
                {subjectsWithChapters.map(sub => (
                  <div key={sub.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: sub.color, marginBottom: 4, marginLeft: 2 }}>
                      {sub.name} — {sub.subtitle}
                    </div>
                    {sub.chapters.map(ch => {
                      const sel = selectedChapters.includes(ch.id)
                      return (
                        <motion.div key={ch.id} onClick={() => toggleChapter(ch.id)}
                          whileTap={{ scale: 0.98 }}
                          style={{
                            background: '#fff', padding: '12px 14px',
                            cursor: 'pointer', marginBottom: 6,
                            border: sel ? '2px solid var(--primary)' : '1px solid #e5e7eb',
                            borderRadius: 8,
                            display: 'flex', alignItems: 'center', gap: 10,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                            background: sel ? 'var(--primary)' : '#f3f4f6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: sel ? '#fff' : '#666',
                          }}>
                            {ch.qCount}
                          </div>
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#333' }}>
                            {ch.name}
                          </div>
                          <div style={{
                            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                            background: sel ? 'var(--primary)' : '#fff',
                            border: `1.5px solid ${sel ? 'var(--primary)' : '#e5e7eb'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {sel && <Check size={12} color="#fff" />}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <motion.div style={{ ...cardStyle, padding: 20, textAlign: 'center', marginBottom: 10 }} whileHover={cardHover}>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {search ? `No chapters match "${search}"` : 'Select a subject to see chapters'}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Fixed bottom bar */}
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} style={{
        position: 'fixed', bottom: 116, left: 16, right: 16, zIndex: 100,
        background: 'var(--card-bg)', borderTop: '1px solid var(--border)', padding: '10px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.3)',
        borderRadius: 16,
      }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>
          <strong style={{ fontSize: 14, color: 'var(--text)' }}>{selectedChapters.length || subjectsWithChapters.flatMap(s => s.chapters).length}</strong> chapters · <strong style={{ fontSize: 14, color: 'var(--text)' }}>{totalFCards}</strong> cards
        </div>
        <motion.button onClick={startFlashcards}
          whileTap={{ scale: 0.97 }} style={{
            padding: '10px 24px', borderRadius: 12, border: 'none',
            background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          <Rotate3D size={16} /> Start
        </motion.button>
      </motion.div>
    </>
  )
}
