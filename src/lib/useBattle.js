import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import neetBattleQuestions from '../data/battleQuestions'
import upscBattleQuestions from '../data/upsc/battleQuestions'

const POOLS = { neet: neetBattleQuestions, upsc: upscBattleQuestions }
let recentQuestionIds = []

function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function generateQuestions(examType) {
  const pool = POOLS[examType] || neetBattleQuestions
  const available = pool.filter(q => !recentQuestionIds.includes(q.q))
  const source = available.length >= 5 ? available : pool
  const shuffled = fisherYatesShuffle([...source])
  const picked = shuffled.slice(0, 5).map((q, i) => ({ ...q, id: `battle-q-${i}` }))
  recentQuestionIds = [...recentQuestionIds, ...picked.map(q => q.q)].slice(-15)
  return picked
}

const AI_NAMES = [
  'Rocket_Roshi', 'Sage_Mighto', 'Hokage_Minato', 'Pirate_King', 'Saiyan_God',
  'Shinobi_Pro', 'Z Fighter', 'Kaio_Ken', 'Genin_Blue', 'Chunin_Ace',
  'Jounin_Star', 'Kage_Shadow', 'Sensei_Wise', 'Ninja_way', 'Rasen_Shuriken',
]

export function useBattle(userId, userName, userLevel, userAvatar, examType = 'neet') {
  const [phase, setPhase] = useState('lobby') // lobby | searching | found | battle | result
  const [room, setRoom] = useState(null)
  const [opponent, setOpponent] = useState(null)
  const [questions, setQuestions] = useState([])
  const [myScore, setMyScore] = useState(0)
  const [oppScore, setOppScore] = useState(0)
  const [myCurrent, setMyCurrent] = useState(0)
  const [oppCurrent, setOppCurrent] = useState(0)
  const [searchTime, setSearchTime] = useState(0)
  const [error, setError] = useState(null)
  const [isAIMatch, setIsAIMatch] = useState(false)

  const searchRef = useRef(null)
  const pollRef = useRef(null)
  const roomSubRef = useRef(null)
  const isPlayer1Ref = useRef(false)
  const aiTimerRef = useRef(null)
  const userDoneRef = useRef(false)
  const aiDoneRef = useRef(false)

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    if (searchRef.current) clearInterval(searchRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
    if (roomSubRef.current) {
      supabase.removeChannel(roomSubRef.current)
      roomSubRef.current = null
    }
    if (aiTimerRef.current) clearInterval(aiTimerRef.current)
  }, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  // ── Subscribe to a battle room for real-time updates ──
  const subscribeToRoom = useCallback((roomId) => {
    if (!supabase || roomSubRef.current) return

    const channel = supabase
      .channel(`battle-room-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'battle_rooms',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        const r = payload.new
        const isP1 = isPlayer1Ref.current

        // Update opponent's score and progress
        setOppScore(isP1 ? r.player2_score : r.player1_score)
        setOppCurrent(isP1 ? r.player2_current : r.player1_current)

        // Update own score from server (authoritative)
        setMyScore(isP1 ? r.player1_score : r.player2_score)

        // Check if battle finished
        if (r.status === 'finished') {
          setRoom(r)
          setPhase('result')
        }
      })
      .subscribe()

    roomSubRef.current = channel
  }, [])

  // ── Start searching for a match ──
  const startSearch = useCallback(async () => {
    if (!supabase || !userId) return

    setPhase('searching')
    setSearchTime(0)
    setError(null)

    // Start search timer
    searchRef.current = setInterval(() => setSearchTime(t => t + 1), 1000)

    try {
      // Call the matchmaking function
      const { data, error: rpcError } = await supabase.rpc('find_match', {
        p_user_id: userId,
        p_user_name: userName || 'Student',
        p_user_level: userLevel || 1,
        p_user_avatar: userAvatar || '',
      })

      console.log('[Battle] find_match response:', data, rpcError)

      if (rpcError) {
        console.error('Matchmaking error:', rpcError)
        setError('Matchmaking failed. Try again.')
        setPhase('lobby')
        clearInterval(searchRef.current)
        return
      }

      if (data.status === 'matched' || data.status === 'existing') {
        // Matched immediately!
        clearInterval(searchRef.current)
        await joinRoom(data.room_id)
      } else {
        // Queued — poll for match
        startPolling()
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Connection error. Try again.')
      setPhase('lobby')
      clearInterval(searchRef.current)
    }
  }, [userId, userName, userLevel, userAvatar])

  // ── Poll for a match by re-calling find_match ──
  const startPolling = useCallback(() => {
    let attempts = 0
    const maxAttempts = 30 // 30 seconds timeout

    pollRef.current = setInterval(async () => {
      attempts++

      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current)
        clearInterval(searchRef.current)
        if (supabase) {
          try { await supabase.from('matchmaking_queue').delete().eq('user_id', userId) } catch {}
        }
        setError('No opponents found. Try again later.')
        setPhase('lobby')
        return
      }

      // Re-call find_match each poll — this lets us find opponents who joined after us
      let data, rpcError
      try {
        const res = await supabase.rpc('find_match', {
          p_user_id: userId,
          p_user_name: userName || 'Student',
          p_user_level: userLevel || 1,
          p_user_avatar: userAvatar || '',
        })
        data = res.data
        rpcError = res.error
      } catch {
        data = null
        rpcError = null
      }

      console.log('[Battle] poll find_match:', data, 'attempt:', attempts)

      if (rpcError) {
        console.error('[Battle] poll error:', rpcError)
        return
      }

      if (data && (data.status === 'matched' || data.status === 'existing')) {
        clearInterval(pollRef.current)
        clearInterval(searchRef.current)
        await joinRoom(data.room_id)
        return
      }

      // Also check if we were matched by the other player's find_match call
      const { data: activeRoom } = await supabase
        .from('battle_rooms')
        .select('*')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .in('status', ['waiting', 'playing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeRoom) {
        clearInterval(pollRef.current)
        clearInterval(searchRef.current)
        await joinRoom(activeRoom.id)
      }
    }, 2000) // Poll every 2 seconds
  }, [userId, userName, userLevel, userAvatar])

  // ── Join a battle room ──
  const joinRoom = useCallback(async (roomId) => {
    const { data: roomData, error: roomError } = await supabase
      .from('battle_rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    if (roomError || !roomData) {
      setError('Could not join room.')
      setPhase('lobby')
      return
    }

    setRoom(roomData)
    const isP1 = roomData.player1_id === userId
    isPlayer1Ref.current = isP1

    // Set opponent info
    setOpponent({
      name: isP1 ? roomData.player2_name : roomData.player1_name,
      avatar: isP1 ? roomData.player2_avatar : roomData.player1_avatar,
      level: isP1 ? roomData.player2_level : roomData.player1_level,
    })

    // If we're player1, generate and set questions
    if (isP1 && (!roomData.questions || roomData.questions.length === 0)) {
      const qs = await generateQuestions(examType)
      await supabase
        .from('battle_rooms')
        .update({ questions: qs })
        .eq('id', roomId)
      setQuestions(qs)
    } else if (roomData.questions && roomData.questions.length > 0) {
      setQuestions(roomData.questions)
    } else {
      // Player 2 — wait for questions to appear
      let retries = 0
      const waitForQs = setInterval(async () => {
        retries++
        const { data: updated } = await supabase
          .from('battle_rooms')
          .select('questions')
          .eq('id', roomId)
          .single()
        if (updated?.questions && updated.questions.length > 0) {
          clearInterval(waitForQs)
          setQuestions(updated.questions)
        }
        if (retries > 10) clearInterval(waitForQs)
      }, 500)
    }

    setMyScore(isP1 ? roomData.player1_score : roomData.player2_score)
    setOppScore(isP1 ? roomData.player2_score : roomData.player1_score)
    setMyCurrent(0)
    setOppCurrent(0)

    // Subscribe to real-time updates
    subscribeToRoom(roomId)

    // Show "found" phase then transition to battle
    setPhase('found')
    setTimeout(() => setPhase('battle'), 3000)
  }, [userId, subscribeToRoom])

  // ── Submit an answer ──
  const submitAnswer = useCallback(async (questionIndex, answerIndex, isCorrect, timeRemaining = 0) => {
    // Points: 100 base + time bonus (up to 100) for correct, 0 for wrong
    const points = isCorrect ? 100 + Math.round((timeRemaining / 15) * 100) : 0

    // Optimistic update
    setMyScore(s => s + points)
    setMyCurrent(questionIndex + 1)

    // AI match — handle locally, no Supabase
    if (isAIMatch) {
      if (questionIndex + 1 >= 5) {
        userDoneRef.current = true
        if (aiDoneRef.current) setPhase('result')
      }
      return
    }

    if (!supabase || !room) return

    const { data, error: submitError } = await supabase.rpc('submit_battle_answer', {
      p_room_id: room.id,
      p_user_id: userId,
      p_question_index: questionIndex,
      p_answer: answerIndex,
      p_correct: isCorrect,
      p_time_remaining: timeRemaining,
    })

    if (submitError) {
      console.error('Submit answer error:', submitError)
    }

    // Check if we've answered all questions
    if (questionIndex + 1 >= 5) {
      // Wait a bit for the other player, then check
      setTimeout(async () => {
        const { data: finalRoom } = await supabase
          .from('battle_rooms')
          .select('*')
          .eq('id', room.id)
          .single()

        if (finalRoom) {
          setRoom(finalRoom)
          const isP1 = isPlayer1Ref.current
          setMyScore(isP1 ? finalRoom.player1_score : finalRoom.player2_score)
          setOppScore(isP1 ? finalRoom.player2_score : finalRoom.player1_score)

          if (finalRoom.status === 'finished') {
            setPhase('result')
          } else {
            // Force finish after 20s if opponent hasn't finished
            setTimeout(async () => {
              const { data: checkRoom } = await supabase
                .from('battle_rooms')
                .select('*')
                .eq('id', room.id)
                .single()

              if (checkRoom && checkRoom.status !== 'finished') {
                await supabase
                  .from('battle_rooms')
                  .update({
                    status: 'finished',
                    finished_at: new Date().toISOString(),
                    winner_id: checkRoom.player1_score > checkRoom.player2_score
                      ? checkRoom.player1_id
                      : checkRoom.player2_score > checkRoom.player1_score
                        ? checkRoom.player2_id
                        : null,
                  })
                  .eq('id', room.id)

                setRoom({ ...checkRoom, status: 'finished' })
                setPhase('result')
              }
            }, 20000)
          }
        }
      }, 2000)
    }
  }, [room, userId, isAIMatch])

  // ── Start AI match (local, no Supabase) ──
  const startAIMatch = useCallback(() => {
    setIsAIMatch(true)
    userDoneRef.current = false
    aiDoneRef.current = false
    const qs = generateQuestions(examType)
    setQuestions(qs)

    // Pick random AI opponent with a random profile pic
    const aiName = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)]
    const picNum = Math.floor(Math.random() * 6) + 1
    const aiAvatar = `/profile-pics/${picNum}/${picNum}.png`
    setOpponent({ name: aiName, avatar: aiAvatar, level: Math.floor(Math.random() * 5) + 1 })

    setMyScore(0)
    setOppScore(0)
    setMyCurrent(0)
    setOppCurrent(0)

    setPhase('found')
    setTimeout(() => {
      setPhase('battle')

      let aiQ = 0
      aiTimerRef.current = setInterval(() => {
        if (aiQ >= 5) {
          clearInterval(aiTimerRef.current)
          return
        }
        const correct = Math.random() < 0.6
        const pts = correct ? 100 + Math.floor(Math.random() * 100) : 0
        setOppScore(s => s + pts)
        setOppCurrent(aiQ + 1)
        aiQ++
        if (aiQ >= 5) {
          clearInterval(aiTimerRef.current)
          aiDoneRef.current = true
          if (userDoneRef.current) setPhase('result')
        }
      }, 2000 + Math.random() * 3000)
    }, 2500)
  }, [])

  // ── Cancel search ──
  const cancelSearch = useCallback(async () => {
    cleanup()
    if (supabase) {
      await supabase.from('matchmaking_queue').delete().eq('user_id', userId)
    }
    setPhase('lobby')
    setError(null)
  }, [userId, cleanup])

  // ── Leave / reset ──
  const leaveBattle = useCallback(() => {
    cleanup()
    if (aiTimerRef.current) clearInterval(aiTimerRef.current)
    setPhase('lobby')
    setIsAIMatch(false)
    setRoom(null)
    setOpponent(null)
    setQuestions([])
    setMyScore(0)
    setOppScore(0)
    setMyCurrent(0)
    setOppCurrent(0)
    setSearchTime(0)
    setError(null)
  }, [cleanup])

  return {
    phase,
    room,
    opponent,
    questions,
    myScore,
    oppScore,
    myCurrent,
    oppCurrent,
    searchTime,
    error,
    isPlayer1: isPlayer1Ref.current,
    isAIMatch,
    startSearch,
    startAIMatch,
    cancelSearch,
    submitAnswer,
    leaveBattle,
  }
}
