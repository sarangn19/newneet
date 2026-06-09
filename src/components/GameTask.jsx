import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Zap } from 'lucide-react'
import useStore from '../store/useStore'
import { playSound } from '../lib/useSound'

function getSfxCtx() {
  const C = window.AudioContext || window.webkitAudioContext
  if (!C) return null
  const ctx = new C()
  return ctx
}

let _sfxCtx = null
function sfx(type) {
  if (!_sfxCtx) _sfxCtx = getSfxCtx()
  if (_sfxCtx && _sfxCtx.state === 'suspended') _sfxCtx.resume()
  if (_sfxCtx) playSound(type, _sfxCtx)
}

// MCQ Task
export function MCQTask({ question, onComplete }) {
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const addXP = useStore(s => s.addXP)

  const handleSubmit = () => {
    if (selected === null) return
    setSubmitted(true)
    const isCorrect = selected === question.ans
    if (isCorrect) {
      addXP(25)
      sfx('correct')
    } else {
      sfx('wrong')
    }
    setTimeout(() => onComplete(isCorrect), 1500)
  }

  return (
    <div>
      <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBottom: 20, color: 'var(--text)' }}>
        {question.q}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {question.options.map((opt, i) => {
          let bg = 'var(--card-bg)', border = 'var(--border)', color = 'var(--text)'
          if (submitted) {
            if (i === question.ans) { bg = 'var(--success-light)'; border = 'var(--success)'; color = 'var(--success-dark)' }
            else if (i === selected && selected !== question.ans) { bg = 'var(--error-light)'; border = 'var(--error)'; color = 'var(--error-dark)' }
          } else if (selected === i) {
            bg = 'var(--primary-light)'; border = 'var(--primary)'; color = 'var(--primary)'
          }
          return (
            <button key={i} onClick={() => !submitted && setSelected(i)} style={{
              background: bg, border: `2px solid ${border}`, borderRadius: 12,
              padding: '14px 16px', textAlign: 'left', cursor: submitted ? 'default' : 'pointer',
              color, fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: selected === i ? 'var(--primary)' : 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                color: selected === i ? 'white' : 'var(--text-2)',
              }}>
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
      {!submitted && (
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleSubmit} disabled={selected === null}>
          Check Answer
        </button>
      )}
      {submitted && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 16, padding: 14, borderRadius: 12,
            background: selected === question.ans ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${selected === question.ans ? '#10b981' : '#ef4444'}`,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {selected === question.ans
              ? <CheckCircle size={18} color="#10b981" />
              : <XCircle size={18} color="#ef4444" />}
            <span style={{ fontWeight: 700, color: selected === question.ans ? '#10b981' : '#ef4444' }}>
              {selected === question.ans ? '+25 XP' : 'Incorrect'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{question.explanation}</p>
        </motion.div>
      )}
    </div>
  )
}

// Flashcard Task
export function FlashcardTask({ cards, onComplete }) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const addXP = useStore(s => s.addXP)

  const next = () => {
    if (idx + 1 >= cards.length) { addXP(15); onComplete(true) }
    else { setIdx(idx + 1); setFlipped(false) }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Card {idx + 1} of {cards.length}</p>
      <div onClick={() => setFlipped(!flipped)} style={{
        background: flipped ? 'var(--success-light)' : 'white',
        border: `2px solid ${flipped ? 'var(--success)' : 'var(--border)'}`,
        borderRadius: 20, padding: 32, minHeight: 160,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.3s', marginBottom: 16,
      }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>{flipped ? 'Answer' : 'Question'}</p>
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: flipped ? 'var(--success)' : 'var(--text)' }}>
            {flipped ? cards[idx].answer : cards[idx].question}
          </p>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>Tap card to flip</p>
      {flipped && (
        <button className="btn btn-primary" onClick={next}>
          {idx + 1 >= cards.length ? 'Complete' : 'Next Card'}
        </button>
      )}
    </div>
  )
}

// Match Game Task — tap one term + one definition to pair them
export function MatchTask({ pairs, onComplete }) {
  const addXP = useStore(s => s.addXP)

  // Shuffle each column independently, but keep terms left and definitions right
  const [leftItems] = useState(() => pairs.map((p, i) => ({ id: `t${i}`, text: p.term, pairId: i })).sort(() => Math.random() - 0.5))
  const [rightItems] = useState(() => pairs.map((p, i) => ({ id: `d${i}`, text: p.def, pairId: i })).sort(() => Math.random() - 0.5))

  const [selectedLeft, setSelectedLeft] = useState(null)  // id of selected term
  const [selectedRight, setSelectedRight] = useState(null) // id of selected def
  const [matched, setMatched] = useState([])   // matched pairIds
  const [wrongPair, setWrongPair] = useState(null) // { left, right } for shake animation
  const [mistakes, setMistakes] = useState(0)

  const tryMatch = (leftId, rightId) => {
    const left = leftItems.find(i => i.id === leftId)
    const right = rightItems.find(i => i.id === rightId)
    if (!left || !right) return

    if (left.pairId === right.pairId) {
      // Correct match
      const newMatched = [...matched, left.pairId]
      setMatched(newMatched)
      setSelectedLeft(null)
      setSelectedRight(null)
      if (newMatched.length === pairs.length) {
        addXP(30)
        setTimeout(() => onComplete(mistakes === 0), 900)
      }
    } else {
      // Wrong match
      setMistakes(m => m + 1)
      setWrongPair({ left: leftId, right: rightId })
      setTimeout(() => {
        setWrongPair(null)
        setSelectedLeft(null)
        setSelectedRight(null)
      }, 700)
    }
  }

  const handleLeftTap = (item) => {
    if (matched.includes(item.pairId) || wrongPair) return
    setSelectedLeft(item.id)
    if (selectedRight) tryMatch(item.id, selectedRight)
  }

  const handleRightTap = (item) => {
    if (matched.includes(item.pairId) || wrongPair) return
    setSelectedRight(item.id)
    if (selectedLeft) tryMatch(selectedLeft, item.id)
  }

  const getStyle = (item, side) => {
    const isMatched = matched.includes(item.pairId)
    const isSelected = side === 'left' ? selectedLeft === item.id : selectedRight === item.id
    const isWrong = wrongPair && ((side === 'left' && wrongPair.left === item.id) || (side === 'right' && wrongPair.right === item.id))

    let bg = 'var(--card-bg)', border = 'var(--border)', color = 'var(--text)'
    if (isMatched) { bg = 'var(--success-light)'; border = 'var(--success)'; color = 'var(--success-dark)' }
    else if (isWrong) { bg = 'var(--error-light)'; border = 'var(--error)'; color = 'var(--error-dark)' }
    else if (isSelected) { bg = 'var(--primary-light)'; border = 'var(--primary)'; color = 'var(--primary)' }

    return {
      background: bg, border: `2px solid ${border}`, borderRadius: 12,
      padding: '11px 14px', cursor: isMatched ? 'default' : 'pointer', color,
      fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
      textAlign: 'center', opacity: isMatched ? 0.6 : 1,
      transform: isWrong ? 'translateX(4px)' : undefined,
      animation: isWrong ? 'shake 0.3s ease' : undefined,
    }
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 6 }}>Tap one from each side to match</p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>Terms</span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>Definitions</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Left column — terms */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leftItems.map(item => (
            <motion.button key={item.id} onClick={() => handleLeftTap(item)}
              animate={wrongPair?.left === item.id ? { x: [0, -6, 6, -4, 4, 0] } : {}}
              transition={{ duration: 0.3 }}
              style={getStyle(item, 'left')}>
              {item.text}
              {matched.includes(item.pairId) && <span style={{ marginLeft: 6 }}></span>}
            </motion.button>
          ))}
        </div>
        {/* Right column — definitions */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rightItems.map(item => (
            <motion.button key={item.id} onClick={() => handleRightTap(item)}
              animate={wrongPair?.right === item.id ? { x: [0, 6, -6, 4, -4, 0] } : {}}
              transition={{ duration: 0.3 }}
              style={getStyle(item, 'right')}>
              {item.text}
              {matched.includes(item.pairId) && <span style={{ marginLeft: 6 }}></span>}
            </motion.button>
          ))}
        </div>
      </div>
      {matched.length > 0 && matched.length < pairs.length && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)', textAlign: 'center', fontWeight: 600 }}>
          {matched.length}/{pairs.length} matched
        </div>
      )}
    </div>
  )
}

// Drag to Category Task — real drag & drop with touch support
export function DragCategoryTask({ instruction, categories, items, onComplete }) {
  const [placed, setPlaced] = useState({})
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState(null)
  const [dragging, setDragging] = useState(null) // { id, x, y }
  const [highlight, setHighlight] = useState(null) // catId being hovered
  const catRefs = useRef({})
  const addXP = useStore(s => s.addXP)

  const unplacedItems = items.filter(it => !placed[it.id])

  // Find which category zone the pointer is over
  const getCatAtPoint = (x, y) => {
    for (const catId of Object.keys(catRefs.current)) {
      const el = catRefs.current[catId]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return catId
    }
    return null
  }

  const handlePointerDown = (e, itemId) => {
    if (checking) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    setDragging({ id: itemId, startX: e.clientX, startY: e.clientY, x: 0, y: 0 })
  }

  const handlePointerMove = (e) => {
    if (!dragging) return
    e.preventDefault()
    const dx = e.clientX - dragging.startX
    const dy = e.clientY - dragging.startY
    setDragging(d => ({ ...d, x: dx, y: dy }))
    setHighlight(getCatAtPoint(e.clientX, e.clientY))
  }

  const handlePointerUp = (e) => {
    if (!dragging) return
    e.preventDefault()
    const catId = getCatAtPoint(e.clientX, e.clientY)
    if (catId) {
      setPlaced(p => ({ ...p, [dragging.id]: catId }))
    }
    setDragging(null)
    setHighlight(null)
  }

  // Tap to remove from category (put back in pool)
  const handleRemove = (itemId) => {
    if (checking) return
    setPlaced(p => { const { [itemId]: _, ...rest } = p; return rest })
  }

  const handleCheck = () => {
    if (Object.keys(placed).length < items.length) return
    setChecking(true)
    const correct = items.every(it => placed[it.id] === it.correctCategory)
    setResults(correct)
    if (correct) addXP(25)
    setTimeout(() => onComplete(correct), 1800)
  }

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 16, lineHeight: 1.5 }}>{instruction}</p>

      {/* Drop zones */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {categories.map(cat => {
          const isOver = highlight === cat.id
          return (
            <div key={cat.id} ref={el => { catRefs.current[cat.id] = el }}
              style={{
                flex: 1, background: isOver ? 'rgba(99,102,241,0.08)' : 'var(--bg)',
                borderRadius: 14, padding: 12, minHeight: 110,
                border: `2.5px dashed ${isOver ? '#6366f1' : 'var(--border)'}`,
                textAlign: 'center', transition: 'border-color 0.15s, background 0.15s',
              }}>
              <div style={{
                fontSize: 13, fontWeight: 700, marginBottom: 10,
                color: isOver ? '#6366f1' : 'var(--text-2)',
              }}>{cat.emoji || ''} {cat.label}</div>
              {items.filter(it => placed[it.id] === cat.id).map(it => {
                const isCorrect = it.correctCategory === cat.id
                return (
                  <motion.div key={it.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    onClick={() => handleRemove(it.id)}
                    style={{
                      background: results !== null
                        ? (isCorrect ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)')
                        : 'var(--card-bg)',
                      border: `1.5px solid ${results !== null
                        ? (isCorrect ? '#10b981' : '#ef4444')
                        : 'var(--border)'}`,
                      borderRadius: 10, padding: '7px 10px', fontSize: 13, fontWeight: 600,
                      marginBottom: 5, color: 'var(--text)', cursor: checking ? 'default' : 'pointer',
                    }}>
                    {it.text}
                    {results !== null && (
                      <span style={{ marginLeft: 6 }}>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                    )}
                  </motion.div>
                )
              })}
              {items.filter(it => placed[it.id] === cat.id).length === 0 && !isOver && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, fontStyle: 'italic' }}>
                  Drag items here
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Draggable item pool */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
        {unplacedItems.map(it => {
          const isDragging = dragging?.id === it.id
          return (
            <motion.div key={it.id}
              onPointerDown={e => handlePointerDown(e, it.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              animate={isDragging ? {} : { scale: 1 }}
              style={{
                background: isDragging ? '#6366f1' : 'var(--card-bg)',
                color: isDragging ? 'white' : 'var(--text)',
                border: `1.5px solid ${isDragging ? '#6366f1' : 'var(--border)'}`,
                borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 600,
                cursor: 'grab', userSelect: 'none', touchAction: 'none',
                position: 'relative', zIndex: isDragging ? 100 : 1,
                transform: isDragging ? `translate(${dragging.x}px, ${dragging.y}px)` : undefined,
                boxShadow: isDragging ? '0 8px 24px rgba(99,102,241,0.35)' : '0 1px 4px rgba(0,0,0,0.06)',
                transition: isDragging ? 'none' : 'box-shadow 0.2s, background 0.15s',
              }}>
              {it.text}
            </motion.div>
          )
        })}
      </div>

      {!checking && (
        <button className="btn btn-primary" onClick={handleCheck}
          disabled={Object.keys(placed).length < items.length}>
          Check
        </button>
      )}
      {results !== null && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{
          marginTop: 12, padding: 12, borderRadius: 12,
          background: results ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${results ? '#10b981' : '#ef4444'}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {results ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
          <span style={{ fontWeight: 600, color: results ? '#10b981' : '#ef4444', fontSize: 14 }}>
            {results ? 'Correct! +25 XP' : 'Not quite right'}
          </span>
        </motion.div>
      )}
    </div>
  )
}

// Fill in the Blank Task
export function FillBlankTask({ sentence, blanks, onComplete }) {
  const [answers, setAnswers] = useState(blanks.map(() => ''))
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)
  const addXP = useStore(s => s.addXP)

  const handleCheck = () => {
    const isCorrect = blanks.every((b, i) =>
      answers[i].trim().toLowerCase() === b.answer.toLowerCase()
    )
    setCorrect(isCorrect)
    setSubmitted(true)
    if (isCorrect) addXP(25)
    setTimeout(() => onComplete(isCorrect), 1800)
  }

  // Split sentence by ___ markers
  const parts = sentence.split('___')

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 2.2, color: 'var(--text)', marginBottom: 20 }}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < blanks.length && (
              <input
                value={answers[i]}
                onChange={e => { const a = [...answers]; a[i] = e.target.value; setAnswers(a) }}
                disabled={submitted}
                placeholder={blanks[i].hint || '...'}
                style={{
                  width: Math.max(80, (blanks[i].answer.length + 2) * 10),
                  border: `2px solid ${submitted ? (answers[i].trim().toLowerCase() === blanks[i].answer.toLowerCase() ? '#10b981' : '#ef4444') : 'var(--primary-alt)'}`,
                  borderRadius: 12, padding: '4px 8px', fontSize: 15, fontWeight: 600, textAlign: 'center',
                  background: submitted ? (answers[i].trim().toLowerCase() === blanks[i].answer.toLowerCase() ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)') : 'var(--card-bg)',
                  color: 'var(--text)', outline: 'none', margin: '0 4px',
                }}
              />
            )}
          </span>
        ))}
      </div>
      {submitted && !correct && (
        <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>
          Correct: {blanks.map(b => b.answer).join(', ')}
        </div>
      )}
      {!submitted && (
        <button className="btn btn-primary" onClick={handleCheck}
          disabled={answers.some(a => !a.trim())}>Check</button>
      )}
    </div>
  )
}

// Speed Tap Task — tap correct items before timer ends
export function SpeedTapTask({ instruction, items, timeLimit = 10, onComplete }) {
  const [tapped, setTapped] = useState([])
  const [timeLeft, setTimeLeft] = useState(timeLimit)
  const [done, setDone] = useState(false)
  const timerRef = useRef(null)
  const addXP = useStore(s => s.addXP)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          setDone(true)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (done) {
      const correctItems = items.filter(i => i.correct)
      const allCorrect = correctItems.every(i => tapped.includes(i.id)) && tapped.length === correctItems.length
      if (allCorrect) addXP(30)
      setTimeout(() => onComplete(allCorrect), 1500)
    }
  }, [done])

  const handleTap = (item) => {
    if (done) return
    if (tapped.includes(item.id)) {
      setTapped(t => t.filter(id => id !== item.id))
    } else {
      setTapped(t => [...t, item.id])
      // Check if all correct items are tapped
      const correctItems = items.filter(i => i.correct)
      const newTapped = [...tapped, item.id]
      if (correctItems.every(i => newTapped.includes(i.id)) && newTapped.filter(id => items.find(i => i.id === id)?.correct).length === correctItems.length) {
        clearInterval(timerRef.current)
        setDone(true)
      }
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{instruction}</p>
        <div style={{
          background: timeLeft <= 3 ? '#ef4444' : 'var(--primary-alt)', color: 'white',
          borderRadius: 20, padding: '4px 14px', fontSize: 14, fontWeight: 700,
        }}>
          {timeLeft}s
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {items.map(item => {
          const isTapped = tapped.includes(item.id)
          const showResult = done
          let bg = 'var(--card-bg)', border = 'var(--border)', color = 'var(--text)'
          if (showResult) {
            if (item.correct && isTapped) { bg = 'rgba(16,185,129,0.15)'; border = '#10b981'; color = '#10b981' }
            else if (item.correct && !isTapped) { bg = 'rgba(234,179,8,0.15)'; border = '#eab308'; color = '#eab308' }
            else if (!item.correct && isTapped) { bg = 'rgba(239,68,68,0.15)'; border = '#ef4444'; color = '#ef4444' }
          } else if (isTapped) {
            bg = 'rgba(79,70,229,0.15)'; border = '#4f46e5'; color = '#4f46e5'
          }
          return (
            <motion.button key={item.id} whileTap={{ scale: 0.92 }} onClick={() => handleTap(item)}
              style={{
                background: bg, border: `2px solid ${border}`, borderRadius: 12,
                padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: done ? 'default' : 'pointer',
                color, transition: 'all 0.15s',
              }}>
              {item.text}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// Sequence / Order Task — arrange items in correct order
export function SequenceTask({ instruction, items, onComplete }) {
  const [order, setOrder] = useState([])
  const [remaining, setRemaining] = useState(() => [...items].sort(() => Math.random() - 0.5))
  const [submitted, setSubmitted] = useState(false)
  const [correct, setCorrect] = useState(false)
  const addXP = useStore(s => s.addXP)

  const addItem = (item) => {
    if (submitted) return
    setOrder(o => [...o, item])
    setRemaining(r => r.filter(i => i.id !== item.id))
  }

  const removeItem = (item) => {
    if (submitted) return
    setRemaining(r => [...r, item])
    setOrder(o => o.filter(i => i.id !== item.id))
  }

  const handleCheck = () => {
    const isCorrect = order.every((item, i) => item.order === i + 1)
    setCorrect(isCorrect)
    setSubmitted(true)
    if (isCorrect) addXP(25)
    setTimeout(() => onComplete(isCorrect), 1800)
  }

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>{instruction}</p>
      <div style={{
        minHeight: 60, background: 'var(--bg)', borderRadius: 14, padding: 12,
        border: '2px dashed var(--border)', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 8,
      }}>
        {order.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Tap items below to arrange them...</span>}
        {order.map((item, i) => (
          <motion.button key={item.id} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
            onClick={() => removeItem(item)}
            style={{
              background: submitted ? (item.order === i + 1 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)') : 'var(--card-bg)',
              border: `1.5px solid ${submitted ? (item.order === i + 1 ? '#10b981' : '#ef4444') : 'var(--primary-alt)'}`,
              borderRadius: 12, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: submitted ? 'default' : 'pointer',
              color: 'var(--text)',
            }}>
            {i + 1}. {item.text}
          </motion.button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {remaining.map(item => (
          <button key={item.id} onClick={() => addItem(item)}
            style={{
              background: 'var(--card-bg)', border: '1.5px solid var(--border)', borderRadius: 12,
              padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text)',
            }}>
            {item.text}
          </button>
        ))}
      </div>
      {!submitted && (
        <button className="btn btn-primary" onClick={handleCheck}
          disabled={order.length !== items.length}>Check Order</button>
      )}
      {submitted && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
          marginTop: 8, padding: 12, borderRadius: 12,
          background: correct ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${correct ? '#10b981' : '#ef4444'}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {correct ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
          <span style={{ fontWeight: 600, color: correct ? '#10b981' : '#ef4444', fontSize: 14 }}>
            {correct ? 'Perfect order! +25 XP' : `Correct: ${items.sort((a, b) => a.order - b.order).map(i => i.text).join(' → ')}`}
          </span>
        </motion.div>
      )}
    </div>
  )
}

// Tap to Reveal Task — tap items to see info, like an organ explorer
export function TapRevealTask({ instruction, items, onComplete }) {
  const [revealed, setRevealed] = useState([])
  const addXP = useStore(s => s.addXP)

  const handleTap = (item) => {
    if (revealed.includes(item.id)) return
    const newRevealed = [...revealed, item.id]
    setRevealed(newRevealed)
    if (newRevealed.length === items.length) {
      addXP(15)
      setTimeout(() => onComplete(true), 1500)
    }
  }

  return (
    <div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{instruction}</p>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>Tap each item to explore ({revealed.length}/{items.length})</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => {
          const isRevealed = revealed.includes(item.id)
          return (
            <motion.div key={item.id} whileTap={{ scale: 0.97 }} onClick={() => handleTap(item)}
              style={{
                background: isRevealed ? 'rgba(79,70,229,0.08)' : 'var(--card-bg)',
                border: `2px solid ${isRevealed ? '#4f46e5' : 'var(--border)'}`,
                borderRadius: 14, padding: 14, cursor: 'pointer', transition: 'all 0.2s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{item.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{item.label}</span>
                {isRevealed && <CheckCircle size={16} color="#10b981" style={{ marginLeft: 'auto' }} />}
              </div>
              <AnimatePresence>
                {isRevealed && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.55 }}>{item.detail}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
