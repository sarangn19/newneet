import { useEffect, useState, useCallback } from 'react'
import { supabase, hasDailyStatsTable } from './supabase'
import useStore from '../store/useStore'

const toDateStr = (d = new Date()) => d.toISOString().slice(0, 10)

// Write (upsert) today's stats into daily_stats table
export async function upsertTodayStats({ userId, examType, deltaQ = 0, deltaCorrect = 0, deltaTime = 0, deltaBattles = 0, deltaBattlesWon = 0 }) {
  if (!supabase || !userId || !hasDailyStatsTable) return
  const today = toDateStr()
  try {
    const { data: existing } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .eq('exam_type', examType)
      .maybeSingle()

    if (existing) {
      await supabase.from('daily_stats').update({
        questions:   existing.questions   + deltaQ,
        correct:     existing.correct     + deltaCorrect,
        time_spent:  existing.time_spent  + deltaTime,
        battles:     existing.battles     + deltaBattles,
        battles_won: existing.battles_won + deltaBattlesWon,
      }).eq('id', existing.id)
    } else {
      await supabase.from('daily_stats').insert({
        user_id:     userId,
        date:        today,
        exam_type:   examType,
        questions:   deltaQ,
        correct:     deltaCorrect,
        time_spent:  deltaTime,
        battles:     deltaBattles,
        battles_won: deltaBattlesWon,
      })
    }
  } catch (e) {
    console.warn('useDailyStats upsert error', e)
  }
}

// Hook: fetch last N days of daily_stats for the current user
export function useDailyStats(days = 30) {
  const userId   = useStore(s => s.userId)
  const examType = useStore(s => s.examType) || 'neet'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!supabase || !userId || !hasDailyStatsTable) { setLoading(false); return }
    try {
      const since = toDateStr(new Date(Date.now() - days * 86400000))
      const { data } = await supabase
        .from('daily_stats')
        .select('date, questions, correct, time_spent, battles, battles_won')
        .eq('user_id', userId)
        .eq('exam_type', examType)
        .gte('date', since)
        .order('date', { ascending: true })
      setRows(data || [])
    } catch (e) {
      console.warn('useDailyStats fetch error', e)
    }
    setLoading(false)
  }, [userId, examType, days])

  useEffect(() => { fetch() }, [fetch])

  // Derived helpers
  const totalActiveDays = rows.filter(r => r.questions > 0 || r.time_spent > 0).length
  const last7 = rows.slice(-7)
  const weeklyQuestions = last7.reduce((s, r) => s + r.questions, 0)
  const weeklyAccuracy = (() => {
    const q = last7.reduce((s, r) => s + r.questions, 0)
    const c = last7.reduce((s, r) => s + r.correct, 0)
    return q > 0 ? Math.round((c / q) * 100) : 0
  })()

  return { rows, loading, totalActiveDays, weeklyQuestions, weeklyAccuracy, refetch: fetch }
}
