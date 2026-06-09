import { subjects, getModules, getMcqBank, chapterQuestions } from './subjects'
import { upscSubjects, getUpscChapters, getUpscChapter } from './upsc/subjects'

export function getSubjectsForExam(examType) {
  return examType === 'upsc' ? upscSubjects : subjects
}

export function getChaptersForSubject(examType, subjectId) {
  if (examType === 'upsc') return getUpscChapters(subjectId)
  const sub = subjects.find(s => s.id === subjectId)
  return sub?.chapters || []
}

export function getChapterData(examType, chapterId) {
  if (examType === 'upsc') return getUpscChapter(chapterId)
  for (const sub of subjects) {
    const ch = sub.chapters.find(c => c.id === chapterId)
    if (ch) return { ...ch, subjectId: sub.id, subjectName: sub.name }
  }
  return null
}

export function getModulesForChapter(examType, chapterId) {
  if (examType === 'upsc') {
    const ch = getUpscChapter(chapterId)
    if (!ch) return []
    const count = ch.modules || 5
    return Array.from({ length: count }, (_, i) => ({
      id: `${chapterId}-m${i}`,
      type: ['learn', 'learn', 'quiz', 'challenge', 'flashcard'][i % 5],
      label: `Module ${i + 1}`,
      icon: '',
      xp: 20 + (i * 5),
    }))
  }
  return getModules(chapterId)
}

export async function getQuestionBank(examType) {
  if (examType === 'upsc') return []
  return getMcqBank()
}

export { chapterQuestions }
export { upscSubjects }
