import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, hasTopicScoresTable, hasQuestionHistoryTable, hasRevisionScheduleTable, hasRevisionMasteryTable, hasRevisionSeenQuestionsTable, hasPracticeDecayHistoryTable } from '../lib/supabase'
import { upsertTodayStats } from '../lib/useDailyStats'

const MAX_HISTORY = 2000
const toDateStr = (d = new Date()) => d.toISOString().slice(0, 10)

const updateUser = async (userId, patch) => {
  if (!supabase) return
  try {
    await supabase.from('users').update(patch).eq('id', userId)
  } catch (e) {
    console.warn('updateUser failed:', e)
  }
}

const patchUserStats = async (userId, patch) => {
  if (!supabase) return
  try {
    await supabase.from('user_stats').upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
  } catch (e) {
    console.warn('patchUserStats failed:', e)
  }
}

// ── Cross-device sync helpers ────────────────────────────────────
const syncTopicScoresFromSupabase = async (userId) => {
  if (!supabase || !hasTopicScoresTable || !userId) return null
  try {
    const { data } = await supabase
      .from('topic_scores')
      .select('*')
      .eq('user_id', userId)
    if (data && data.length > 0) {
      const scores = {}
      data.forEach(row => {
        scores[row.topic_id] = {
          correct: row.correct || 0,
          total: row.total || 0,
          lastAttempted: row.last_attempted || '',
        }
      })
      return scores
    }
  } catch (e) {
    console.warn('syncTopicScoresFromSupabase failed:', e)
  }
  return null
}

const pushTopicScoreToSupabase = async (userId, topicId, correct, total, lastAttempted, examType) => {
  if (!supabase || !hasTopicScoresTable || !userId) return
  try {
    await supabase.from('topic_scores').upsert({
      user_id: userId,
      topic_id: topicId,
      correct,
      total,
      last_attempted: lastAttempted,
      exam_type: examType || 'upsc',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,topic_id' })
  } catch (e) {
    console.warn('pushTopicScoreToSupabase failed:', e)
  }
}

const syncQuestionHistoryFromSupabase = async (userId) => {
  if (!supabase || !hasQuestionHistoryTable || !userId) return null
  try {
    const { data } = await supabase
      .from('question_history')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(MAX_HISTORY)
    if (data && data.length > 0) {
      return data.map(row => ({
        id: row.id,
        topicId: row.topic_id,
        correct: row.correct,
        timeSpent: row.time_spent || 0,
        timestamp: row.timestamp,
        examType: row.exam_type || 'upsc',
        subjectId: row.subject_id || '',
      }))
    }
  } catch (e) {
    console.warn('syncQuestionHistoryFromSupabase failed:', e)
  }
  return null
}

const pushQuestionToSupabase = async (userId, entry) => {
  if (!supabase || !hasQuestionHistoryTable || !userId) return
  try {
    await supabase.from('question_history').upsert({
      id: entry.id,
      user_id: userId,
      topic_id: entry.topicId,
      correct: entry.correct,
      time_spent: entry.timeSpent || 0,
      timestamp: entry.timestamp,
      exam_type: entry.examType || 'upsc',
      subject_id: entry.subjectId || '',
    }, { onConflict: 'id' })
  } catch (e) {
    console.warn('pushQuestionToSupabase failed:', e)
  }
}

const syncRevisionScheduleFromSupabase = async (userId) => {
  if (!supabase || !hasRevisionScheduleTable || !userId) return null
  try {
    const { data } = await supabase
      .from('revision_schedule')
      .select('*')
      .eq('user_id', userId)
    if (data && data.length > 0) {
      const schedule = {}
      data.forEach(row => {
        schedule[row.topic_id] = {
          lastReviewed: row.last_reviewed,
          interval: row.interval,
        }
      })
      return schedule
    }
  } catch (e) {
    console.warn('syncRevisionScheduleFromSupabase failed:', e)
  }
  return null
}

const pushRevisionToSupabase = async (userId, topicId, lastReviewed, interval) => {
  if (!supabase || !hasRevisionScheduleTable || !userId) return
  try {
    await supabase.from('revision_schedule').upsert({
      user_id: userId,
      topic_id: topicId,
      last_reviewed: lastReviewed,
      interval,
    }, { onConflict: 'user_id,topic_id' })
  } catch (e) {
    console.warn('pushRevisionToSupabase failed:', e)
  }
}

// ── Revision Mastery sync ──────────────────────────────────────────
const syncRevisionMasteryFromSupabase = async (userId) => {
  if (!supabase || !hasRevisionMasteryTable || !userId) return null
  try {
    const { data } = await supabase
      .from('revision_mastery')
      .select('*')
      .eq('user_id', userId)
    if (data && data.length > 0) {
      const mastery = {}
      data.forEach(row => { mastery[row.topic_id] = row.level })
      return mastery
    }
  } catch (e) {
    console.warn('syncRevisionMasteryFromSupabase failed:', e)
  }
  return null
}

const pushRevisionMasteryToSupabase = async (userId, topicId, level) => {
  if (!supabase || !hasRevisionMasteryTable || !userId) return
  try {
    await supabase.from('revision_mastery').upsert({
      user_id: userId,
      topic_id: topicId,
      level,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,topic_id' })
  } catch (e) {
    console.warn('pushRevisionMasteryToSupabase failed:', e)
  }
}

// ── Revision Seen Questions sync ───────────────────────────────────
const syncRevisionSeenQuestionsFromSupabase = async (userId) => {
  if (!supabase || !hasRevisionSeenQuestionsTable || !userId) return null
  try {
    const { data } = await supabase
      .from('revision_seen_questions')
      .select('*')
      .eq('user_id', userId)
    if (data && data.length > 0) {
      const seen = {}
      data.forEach(row => {
        if (!seen[row.topic_id]) seen[row.topic_id] = {}
        seen[row.topic_id][row.question_key] = { seen: row.seen, correct: row.correct }
      })
      return seen
    }
  } catch (e) {
    console.warn('syncRevisionSeenQuestionsFromSupabase failed:', e)
  }
  return null
}

const pushRevisionSeenQuestionToSupabase = async (userId, topicId, questionKey, seen, correct) => {
  if (!supabase || !hasRevisionSeenQuestionsTable || !userId) return
  try {
    await supabase.from('revision_seen_questions').upsert({
      user_id: userId,
      topic_id: topicId,
      question_key: questionKey,
      seen,
      correct,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,topic_id,question_key' })
  } catch (e) {
    console.warn('pushRevisionSeenQuestionToSupabase failed:', e)
  }
}

// ── Practice Decay History sync ────────────────────────────────────
const syncPracticeDecayFromSupabase = async (userId) => {
  if (!supabase || !hasPracticeDecayHistoryTable || !userId) return null
  try {
    const { data } = await supabase
      .from('practice_decay_history')
      .select('*')
      .eq('user_id', userId)
    if (data && data.length > 0) {
      const decay = {}
      data.forEach(row => {
        if (!decay[row.question_id]) decay[row.question_id] = []
        decay[row.question_id].push({
          qId: row.question_id,
          chapter: row.chapter,
          subject: row.subject,
          skill: row.skill,
          correct: row.correct,
          confidence: row.confidence,
          timeMs: row.time_ms,
          ts: row.ts,
          expectedScore: row.expected_score,
        })
      })
      return decay
    }
  } catch (e) {
    console.warn('syncPracticeDecayFromSupabase failed:', e)
  }
  return null
}

const pushPracticeDecayToSupabase = async (userId, questionId, entry) => {
  if (!supabase || !hasPracticeDecayHistoryTable || !userId) return
  try {
    await supabase.from('practice_decay_history').insert({
      user_id: userId,
      question_id: questionId,
      chapter: entry.chapter || '',
      subject: entry.subject || '',
      skill: entry.skill || '',
      correct: entry.correct,
      confidence: entry.confidence || 0,
      time_ms: entry.timeMs || 0,
      ts: entry.ts || Date.now(),
      expected_score: entry.expectedScore || 0,
    })
  } catch (e) {
    console.warn('pushPracticeDecayToSupabase failed:', e)
  }
}

// ── store ─────────────────────────────────────────────────────────
const useStore = create(
  persist(
    (set, get) => ({
      userId: null,
      examType: null, // 'neet' | 'upsc'
      isDemo: false,

      user: {
        name: 'Student',
        avatar: '',
        level: 1,
        xp: 0,          // mapped from tokens
        xpToNext: 500,
        streak: 0,
        coins: 0,       // mapped from gems
        rank: 'Bronze',
      },

      streakProtection: {
        shields: 2,
        weekendFreeze: true,
        recoveryDay: true,
      },

      setStreakProtection: (patch) => {
        const newVal = { ...get().streakProtection, ...patch }
        set({ streakProtection: newVal })
        const { userId } = get()
        if (userId) patchUserStats(userId, { streak_protection: newVal })
      },

      stats: {
        totalQuestions: 0,
        correct: 0,
        timeSpent: 0,
        battlesWon: 0,
        battlesPlayed: 0,
        subjectProgress: { physics: 0, chemistry: 0, biology: 0 },
        subjectCorrect: { physics: 0, chemistry: 0, biology: 0 },
        subjectTotal: { physics: 0, chemistry: 0, biology: 0 },
        // Per-exam global counts to prevent NEET accuracy leaking into UPSC view
        neetCorrect: 0, neetTotal: 0,
        upscCorrect: 0, upscTotal: 0,
      },

      inBattle: false,
      hideNav: false,

      setInBattle: (val) => set({ inBattle: val }),
      setHideNav: (val) => set({ hideNav: val }),

      completedModules: [],
      moduleProgress: {},  // { [moduleId]: { lessonIdx, taskIdx, score, streak, phase } }

      topicScores: {},  // { [topicId]: { correct: 0, total: 0, lastAttempted: 'date' } }

      revisionSchedule: {}, // { [topicId]: { lastReviewed: '2026-06-07', interval: 1 } }

      revisionMastery: {}, // { [topicId]: 1-4 }
      revisionSeenQuestions: {}, // { [topicId]: { [questionKey]: { seen, correct } } }
      practiceDecay: {}, // { [questionId]: [{ qId, chapter, subject, skill, correct, confidence, timeMs, ts, expectedScore }] }

      markTopicReviewed: (topicId) => {
        const { revisionSchedule, topicScores, userId } = get()
        const score = topicScores[topicId]
        const accuracy = score?.total > 0 ? (score.correct / score.total) * 100 : 0
        let interval = 1
        if (accuracy >= 80) interval = 7
        else if (accuracy >= 60) interval = 4
        else if (accuracy >= 40) interval = 2
        const lastReviewed = new Date().toISOString().slice(0, 10)
        set({
          revisionSchedule: {
            ...revisionSchedule,
            [topicId]: { lastReviewed, interval }
          }
        })
        if (userId) pushRevisionToSupabase(userId, topicId, lastReviewed, interval)
      },

      // ── Revision Mastery ──────────────────────────────────────────
      setRevisionMastery: (topicId, level) => {
        set(state => ({
          revisionMastery: { ...state.revisionMastery, [topicId]: level }
        }))
        const { userId } = get()
        if (userId) pushRevisionMasteryToSupabase(userId, topicId, level)
      },

      // ── Revision Seen Questions ───────────────────────────────────
      recordSeenQuestion: (topicId, questionKey, isCorrect) => {
        set(state => {
          const topic = state.revisionSeenQuestions[topicId] || {}
          const prev = topic[questionKey] || { seen: 0, correct: 0 }
          const updated = { seen: prev.seen + 1, correct: prev.correct + (isCorrect ? 1 : 0) }
          return {
            revisionSeenQuestions: {
              ...state.revisionSeenQuestions,
              [topicId]: { ...topic, [questionKey]: updated }
            }
          }
        })
        const { userId } = get()
        if (userId) {
          const state = get()
          const entry = state.revisionSeenQuestions[topicId]?.[questionKey] || { seen: 0, correct: 0 }
          pushRevisionSeenQuestionToSupabase(userId, topicId, questionKey, entry.seen, entry.correct)
        }
      },

      // ── Practice Decay History ────────────────────────────────────
      savePracticeDecay: (questionId, entry) => {
        set(state => {
          const existing = state.practiceDecay[questionId] || []
          return {
            practiceDecay: {
              ...state.practiceDecay,
              [questionId]: [...existing, entry]
            }
          }
        })
        const { userId } = get()
        if (userId) pushPracticeDecayToSupabase(userId, questionId, entry)
      },

      // ── Second Brain tracking ────────────────────────────────────
      questionHistory: [], // [{ id, topicId, correct, timeSpent, timestamp, examType, subjectId }]
      dailyBreakdown: {},  // { [date]: { attempted, correct, timeSpent, topics: { [topicId]: { attempted, correct, timeSpent } } } }
      sessionStart: null,  // timestamp when current session started

      // ── Current Affairs reading history ──────────────────────────
      caHistory: [], // [{ articleId, articleTitle, category, openedAt, timeSpentSeconds, bookmarked, generatedNotes, generatedFlashcards, generatedMCQs, addedToRevision }]

      recordArticleOpened: (article) => {
        const { caHistory } = get()
        set({
          caHistory: [...caHistory, {
            articleId: article.title,
            articleTitle: article.title,
            category: article.category || 'General',
            openedAt: new Date().toISOString(),
            timeSpentSeconds: 0,
            bookmarked: false,
            generatedNotes: false,
            generatedFlashcards: false,
            generatedMCQs: false,
            addedToRevision: false,
          }]
        })
      },

      recordArticleClosed: (articleTitle, timeSpent) => {
        const { caHistory } = get()
        set({
          caHistory: caHistory.map(e =>
            e.articleId === articleTitle && e.timeSpentSeconds === 0
              ? { ...e, timeSpentSeconds: timeSpent }
              : e
          )
        })
      },

      recordArticleBookmarked: (articleTitle) => {
        set(state => ({
          caHistory: state.caHistory.map(e =>
            e.articleId === articleTitle ? { ...e, bookmarked: true } : e
          )
        }))
      },

      recordNotesGenerated: (articleTitle) => {
        set(state => ({
          caHistory: state.caHistory.map(e =>
            e.articleId === articleTitle ? { ...e, generatedNotes: true } : e
          )
        }))
      },

      recordFlashcardsGenerated: (articleTitle) => {
        set(state => ({
          caHistory: state.caHistory.map(e =>
            e.articleId === articleTitle ? { ...e, generatedFlashcards: true } : e
          )
        }))
      },

      recordMCQsGenerated: (articleTitle) => {
        set(state => ({
          caHistory: state.caHistory.map(e =>
            e.articleId === articleTitle ? { ...e, generatedMCQs: true } : e
          )
        }))
      },

      recordAddedToRevision: (articleTitle) => {
        set(state => ({
          caHistory: state.caHistory.map(e =>
            e.articleId === articleTitle ? { ...e, addedToRevision: true } : e
          )
        }))
      },

      // ── Current Affairs infrastructure telemetry ──────────────────
      caFallbackCount: 0,
      caRetryAttempts: 0,
      caRetrySuccess: 0,
      caMcqTimeoutCount: 0,
      caMcqFailCount: 0,

      incrementCaFallback: () => set(state => ({ caFallbackCount: state.caFallbackCount + 1 })),
      incrementCaRetryAttempt: () => set(state => ({ caRetryAttempts: state.caRetryAttempts + 1 })),
      incrementCaRetrySuccess: () => set(state => ({ caRetrySuccess: state.caRetrySuccess + 1 })),
      incrementCaMcqTimeout: () => set(state => ({ caMcqTimeoutCount: state.caMcqTimeoutCount + 1 })),
      incrementCaMcqFail: () => set(state => ({ caMcqFailCount: state.caMcqFailCount + 1 })),

      // ── sync from Supabase on login ──────────────────────────────
      syncFromSupabase: async (userId) => {
        if (!supabase) return

        let u = null
        try { const res = await supabase.from('users').select('*').eq('id', userId).maybeSingle(); u = res.data } catch {}

        let us = null
        try { const res = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle(); us = res.data } catch {}

        let lessons = null
        try { const res = await supabase.from('lesson_progress').select('lesson_id').eq('user_id', userId).eq('completed', true); lessons = res.data } catch {}

        let battles = null
        try { const res = await supabase.from('battle_history').select('winner_id').or(`player1_id.eq.${userId},player2_id.eq.${userId}`); battles = res.data } catch {}

        if (u) {
          const level   = u.level || 1
          const tokens  = u.tokens || 0
          const xpToNext = level * 500
          const rank    = level >= 20 ? 'Diamond' : level >= 15 ? 'Platinum' : level >= 10 ? 'Gold' : level >= 5 ? 'Silver' : 'Bronze'

          set({
            userId,
            examType: u.exam_type || 'upsc',
            user: {
              name:     u.name     || 'Student',
              avatar:   u.avatar   || '',
              level,
              xp:       tokens % xpToNext,
              xpToNext,
              streak:   u.streak   || 0,
              coins:    u.gems     || 0,
              rank,
            }
          })
        } else {
          set({ userId })
        }

        if (lessons) {
          set({ completedModules: lessons.map(l => l.lesson_id) })
        }

        if (battles) {
          const played = battles.length
          const won    = battles.filter(b => b.winner_id === userId).length
          set(state => ({
            stats: { ...state.stats, battlesPlayed: played, battlesWon: won }
          }))
        }

        // Sync revision schedule from Supabase
        const remoteRevision = await syncRevisionScheduleFromSupabase(userId)
        if (remoteRevision) {
          set({ revisionSchedule: remoteRevision })
        }

        // Sync revision mastery from Supabase
        const remoteMastery = await syncRevisionMasteryFromSupabase(userId)
        if (remoteMastery) {
          set(state => ({
            revisionMastery: { ...state.revisionMastery, ...remoteMastery }
          }))
        }

        // Sync revision seen questions from Supabase
        const remoteSeen = await syncRevisionSeenQuestionsFromSupabase(userId)
        if (remoteSeen) {
          set(state => ({
            revisionSeenQuestions: { ...state.revisionSeenQuestions, ...remoteSeen }
          }))
        }

        // Sync practice decay from Supabase
        const remoteDecay = await syncPracticeDecayFromSupabase(userId)
        if (remoteDecay) {
          set(state => ({
            practiceDecay: { ...state.practiceDecay, ...remoteDecay }
          }))
        }

        // Sync streak protection from user_stats
        if (us?.streak_protection) {
          set({ streakProtection: us.streak_protection })
        }

        // Sync topicScores and questionHistory from Supabase
        const [remoteScores, remoteHistory] = await Promise.all([
          syncTopicScoresFromSupabase(userId),
          syncQuestionHistoryFromSupabase(userId),
        ])

        if (remoteScores) {
          set(state => {
            const merged = { ...state.topicScores }
            // Merge remote into local — keep whichever has newer lastAttempted
            for (const [topicId, score] of Object.entries(remoteScores)) {
              const local = merged[topicId]
              if (!local || (score.lastAttempted && score.lastAttempted >= (local.lastAttempted || ''))) {
                merged[topicId] = score
              }
            }
            return { topicScores: merged }
          })
        }

        if (remoteHistory && remoteHistory.length > 0) {
          set(state => {
            const localById = new Map(state.questionHistory.map(e => [e.id, e]))
            // Merge remote entries missing locally
            let merged = [...state.questionHistory]
            for (const entry of remoteHistory) {
              if (!localById.has(entry.id)) {
                merged.push(entry)
              }
            }
            // Sort by timestamp, cap at MAX_HISTORY
            merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            if (merged.length > MAX_HISTORY) merged.splice(0, merged.length - MAX_HISTORY)
            return { questionHistory: merged }
          })
        }

        if (us) {
          set(state => ({
            stats: {
              ...state.stats,
              totalQuestions: us.total_questions || 0,
              correct:        us.correct || 0,
              timeSpent:      us.time_spent || 0,
              neetCorrect:    us.neet_correct || 0,
              neetTotal:      us.neet_total || 0,
              upscCorrect:    us.upsc_correct || 0,
              upscTotal:      us.upsc_total || 0,
              subjectProgress: {
                physics:   us.physics_progress || 0,
                chemistry: us.chemistry_progress || 0,
                biology:   us.biology_progress || 0,
              },
              subjectCorrect: {
                physics:   us.physics_correct || 0,
                chemistry: us.chemistry_correct || 0,
                biology:   us.biology_correct || 0,
              },
              subjectTotal: {
                physics:   us.physics_total || 0,
                chemistry: us.chemistry_total || 0,
                biology:   us.biology_total || 0,
              },
            }
          }))
        }

      },

      // ── addXP (tokens in DB) ─────────────────────────────────────
      addXP: async (amount) => {
        const { user, userId } = get()
        const newTokens  = (user.xp + amount)
        const levelUp    = newTokens >= user.xpToNext
        const newLevel   = levelUp ? user.level + 1 : user.level
        const finalXP    = levelUp ? newTokens - user.xpToNext : newTokens
        const newXPToNext = newLevel * 500
        const newCoins   = user.coins + Math.floor(amount / 5)
        const newRank    = newLevel >= 20 ? 'Diamond' : newLevel >= 15 ? 'Platinum' : newLevel >= 10 ? 'Gold' : newLevel >= 5 ? 'Silver' : 'Bronze'

        set({ user: { ...user, xp: finalXP, level: newLevel, xpToNext: newXPToNext, coins: newCoins, rank: newRank } })

        if (userId && supabase) {
          await updateUser(userId, {
            tokens: finalXP,
            level:  newLevel,
            gems:   newCoins,
          })
        }
      },

      // ── saveModuleProgress ─────────────────────────────────────
      saveModuleProgress: (moduleId, progress) => {
        set(state => ({
          moduleProgress: { ...state.moduleProgress, [moduleId]: progress }
        }))
      },

      clearModuleProgress: (moduleId) => {
        set(state => {
          const { [moduleId]: _, ...rest } = state.moduleProgress
          return { moduleProgress: rest }
        })
      },

      // ── completeModule (Supabase only) ─────────────────────────
      completeModule: async (moduleId) => {
        const { completedModules, userId } = get()
        if (completedModules.includes(moduleId)) return
        set({ completedModules: [...completedModules, moduleId] })

        if (userId && supabase) {
          try {
            await supabase.from('lesson_progress').upsert({
              user_id:      userId,
              lesson_id:    moduleId,
              completed:    true,
              completed_at: new Date().toISOString(),
            }, { onConflict: 'user_id,lesson_id' })
          } catch (e) {
            console.warn('completeModule upsert failed:', e)
          }
        }
      },

      // ── updateStats ──────────────────────────────────────────────
      updateStats: async (correct, total, subjectId) => {
        const { stats, userId, examType } = get()
        const et = examType || 'neet'
        const etCorrect = et === 'neet' ? 'neetCorrect' : 'upscCorrect'
        const etTotal   = et === 'neet' ? 'neetTotal'   : 'upscTotal'
        const newTotalQ = stats.totalQuestions + total
        const newCorrect = stats.correct + correct
        const newEtCorrect = (stats[etCorrect] || 0) + correct
        const newEtTotal   = (stats[etTotal]   || 0) + total
        const prevSubCorrect = stats.subjectCorrect?.[subjectId] || 0
        const prevSubTotal = stats.subjectTotal?.[subjectId] || 0
        const newSubCorrect = { ...stats.subjectCorrect, [subjectId]: prevSubCorrect + correct }
        const newSubTotal = { ...stats.subjectTotal, [subjectId]: prevSubTotal + total }
        const newProgress = { ...stats.subjectProgress, [subjectId]: Math.round(((prevSubCorrect + correct) / Math.max(prevSubTotal + total, 1)) * 100) }
        set({
          stats: {
            ...stats,
            totalQuestions: newTotalQ,
            correct:        newCorrect,
            [etCorrect]:    newEtCorrect,
            [etTotal]:      newEtTotal,
            subjectProgress: newProgress,
            subjectCorrect:  newSubCorrect,
            subjectTotal:    newSubTotal,
          }
        })
        if (userId) {
          const neetSubjects = ['physics', 'chemistry', 'biology']
          const isNeetSubject = neetSubjects.includes(subjectId)
          try {
            const { data: remote } = await supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle()
            if (remote) {
              const r = remote
              const patch = {
                total_questions:   (r.total_questions   || 0) + total,
                correct:           (r.correct           || 0) + correct,
                [et === 'neet' ? 'neet_correct' : 'upsc_correct']: (r[et === 'neet' ? 'neet_correct' : 'upsc_correct'] || 0) + correct,
                [et === 'neet' ? 'neet_total'   : 'upsc_total']:   (r[et === 'neet' ? 'neet_total'   : 'upsc_total']   || 0) + total,
              }
              // Only sync NEET subject fields for NEET questions
              if (isNeetSubject) {
                patch.physics_progress   = ((r.physics_correct || 0) + (subjectId === 'physics' ? correct : 0)) / Math.max((r.physics_total || 0) + (subjectId === 'physics' ? total : 0), 1) * 100
                patch.chemistry_progress = ((r.chemistry_correct || 0) + (subjectId === 'chemistry' ? correct : 0)) / Math.max((r.chemistry_total || 0) + (subjectId === 'chemistry' ? total : 0), 1) * 100
                patch.biology_progress   = ((r.biology_correct || 0) + (subjectId === 'biology' ? correct : 0)) / Math.max((r.biology_total || 0) + (subjectId === 'biology' ? total : 0), 1) * 100
                patch.physics_correct    = (r.physics_correct   || 0) + (subjectId === 'physics' ? correct : 0)
                patch.chemistry_correct  = (r.chemistry_correct || 0) + (subjectId === 'chemistry' ? correct : 0)
                patch.biology_correct    = (r.biology_correct   || 0) + (subjectId === 'biology' ? correct : 0)
                patch.physics_total      = (r.physics_total     || 0) + (subjectId === 'physics' ? total : 0)
                patch.chemistry_total    = (r.chemistry_total   || 0) + (subjectId === 'chemistry' ? total : 0)
                patch.biology_total      = (r.biology_total     || 0) + (subjectId === 'biology' ? total : 0)
              }
              patchUserStats(userId, patch)
              return
            }
          } catch {}
          // Fallback: push local cumulative (first-time user or fetch failed)
          const patch = {
            total_questions:   newTotalQ,
            correct:           newCorrect,
            [et === 'neet' ? 'neet_correct' : 'upsc_correct']: newEtCorrect,
            [et === 'neet' ? 'neet_total'   : 'upsc_total']:   newEtTotal,
          }
          if (isNeetSubject) {
            patch.physics_progress   = newProgress.physics
            patch.chemistry_progress = newProgress.chemistry
            patch.biology_progress   = newProgress.biology
            patch.physics_correct    = newSubCorrect.physics
            patch.chemistry_correct  = newSubCorrect.chemistry
            patch.biology_correct    = newSubCorrect.biology
            patch.physics_total      = newSubTotal.physics
            patch.chemistry_total    = newSubTotal.chemistry
            patch.biology_total      = newSubTotal.biology
          }
          patchUserStats(userId, patch)
        }
      },

      // ── updateTimeSpent ──────────────────────────────────────────
      updateTimeSpent: (minutes) => {
        const { stats, userId } = get()
        const newTime = stats.timeSpent + minutes
        set({ stats: { ...stats, timeSpent: newTime } })
        if (userId) patchUserStats(userId, { time_spent: newTime })
      },

      // ── addBattleResult ──────────────────────────────────────────
      addBattleResult: (won) => {
        const { stats, userId, examType } = get()
        const newPlayed = stats.battlesPlayed + 1
        const newWon    = won ? stats.battlesWon + 1 : stats.battlesWon
        set({
          stats: {
            ...stats,
            battlesPlayed: newPlayed,
            battlesWon:    newWon,
          }
        })
        if (userId) {
          patchUserStats(userId, {
            battles_played: newPlayed,
            battles_won:    newWon,
          })
          upsertTodayStats({ userId, examType: examType || 'neet', deltaBattles: 1, deltaBattlesWon: won ? 1 : 0 })
        }
      },

      // ── saveTopicScore ────────────────────────────────────────────
      saveTopicScore: (topicId, correct, total) => {
        const { topicScores, userId, examType } = get()
        const prev = topicScores[topicId] || { correct: 0, total: 0 }
        const updated = {
          correct: (prev.correct || 0) + correct,
          total: (prev.total || 0) + total,
          lastAttempted: new Date().toISOString().slice(0, 10),
        }
        set({ topicScores: { ...topicScores, [topicId]: updated } })
        // Push to Supabase for cross-device sync
        if (userId) {
          pushTopicScoreToSupabase(userId, topicId, updated.correct, updated.total, updated.lastAttempted, examType)
        }
      },

      // ── Second Brain actions ─────────────────────────────────────

      // Record every single question attempt with time tracking
      recordQuestionAttempt: (topicId, correct, timeSpent, subjectId) => {
        const { questionHistory, dailyBreakdown, examType, userId } = get()
        const et = examType || 'neet'
        const today = toDateStr()
        const entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          topicId,
          correct,
          timeSpent, // seconds
          timestamp: new Date().toISOString(),
          examType: et,
          subjectId: subjectId || '',
        }

        // Add to history, cap at MAX_HISTORY
        const newHistory = [...questionHistory, entry]
        if (newHistory.length > MAX_HISTORY) newHistory.splice(0, newHistory.length - MAX_HISTORY)

        // Update daily breakdown
        const day = dailyBreakdown[today] || { attempted: 0, correct: 0, timeSpent: 0, topics: {} }
        const topicDay = day.topics[topicId] || { attempted: 0, correct: 0, timeSpent: 0 }

        set({
          questionHistory: newHistory,
          dailyBreakdown: {
            ...dailyBreakdown,
            [today]: {
              attempted: day.attempted + 1,
              correct: day.correct + (correct ? 1 : 0),
              timeSpent: (day.timeSpent || 0) + timeSpent,
              topics: {
                ...day.topics,
                [topicId]: {
                  attempted: topicDay.attempted + 1,
                  correct: topicDay.correct + (correct ? 1 : 0),
                  timeSpent: (topicDay.timeSpent || 0) + timeSpent,
                },
              },
            },
          },
        })

        // Push to Supabase for cross-device sync
        if (userId) {
          pushQuestionToSupabase(userId, entry)
        }
      },

      // Session tracking
      startSession: () => {
        set({ sessionStart: Date.now() })
      },

      endSession: () => {
        set({ sessionStart: null })
      },

      getSessionDuration: () => {
        const { sessionStart } = get()
        if (!sessionStart) return 0
        return Math.round((Date.now() - sessionStart) / 1000) // seconds
      },

      // ── updateName ───────────────────────────────────────────────
      updateName: (name) => {
        const { user, userId } = get()
        set({ user: { ...user, name } })
        if (userId && supabase) updateUser(userId, { name })
      },

      // ── setAvatar ──────────────────────────────────────────────
      setAvatar: (avatar) => {
        const { user, userId } = get()
        set({ user: { ...user, avatar } })
        if (userId && supabase) updateUser(userId, { avatar })
      },

      // ── setExamType ──────────────────────────────────────────────
      setExamType: (examType) => set({ examType }),

      // ── setDemoMode ──────────────────────────────────────────────
      setDemoMode: (examType) => set({
        isDemo: true,
        examType,
        userId: 'demo-user',
        user: {
          name: 'Demo User',
          avatar: '',
          level: 1,
          xp: 0,
          xpToNext: 500,
          streak: 0,
          coins: 0,
          rank: 'Bronze',
        },
      }),

      // ── language ─────────────────────────────────────────────────
      language: 'en',
      setLanguage: (language) => set({ language }),

      onboardingComplete: false,
      setOnboardingComplete: (val) => set({ onboardingComplete: val }),
    }),
    {
      name: 'neet-prep-store',
      partialize: (s) => ({
        user:             s.user,
        stats:            s.stats,
        completedModules: s.completedModules,
        moduleProgress:   s.moduleProgress,
        topicScores:      s.topicScores,
        revisionSchedule: s.revisionSchedule,
        revisionMastery:  s.revisionMastery,
        revisionSeenQuestions: s.revisionSeenQuestions,
        practiceDecay:    s.practiceDecay,
        questionHistory:  s.questionHistory,
        dailyBreakdown:   s.dailyBreakdown,
        caHistory:        s.caHistory,
        caFallbackCount:  s.caFallbackCount,
        caRetryAttempts:  s.caRetryAttempts,
        caRetrySuccess:   s.caRetrySuccess,
        caMcqTimeoutCount:s.caMcqTimeoutCount,
        caMcqFailCount:   s.caMcqFailCount,
        userId:           s.userId,
        language:         s.language,
        streakProtection: s.streakProtection,
        examType:         s.examType,
      }),
      merge: (persisted, current) => ({ ...current, ...persisted }),
    }
  )
)

export default useStore
