import { useMemo } from 'react'
import useStore from '../store/useStore'
import { upscSubjects } from '../data/upsc/subjects'
import { subjects as neetSubjects } from '../data/subjects'

export function useRecommendations(examType = 'upsc') {
  const topicScores = useStore(s => s.topicScores)

  return useMemo(() => {
    const subjects = examType === 'upsc' ? upscSubjects : neetSubjects
    const topics = subjects.flatMap(sub =>
      (sub.chapters || []).map(ch => ({
        ...ch,
        subjectId: sub.id,
        subjectName: sub.name,
      }))
    )

    const withScores = topics.map(t => {
      const s = topicScores[t.id]
      const correct = s?.correct || 0
      const total = s?.total || 0
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
      return { ...t, correct, total, accuracy }
    })

    const attempted = withScores.filter(t => t.total >= 3)
    const weakTopics = attempted
      .filter(t => t.accuracy < 60)
      .sort((a, b) => a.accuracy - b.accuracy)

    const unattempted = withScores.filter(t => t.total === 0)

    return {
      weakTopics,
      unattempted,
      allTopics: withScores,
      needsRevision: weakTopics.length > 0 || unattempted.length > 0,
    }
  }, [topicScores, examType])
}
