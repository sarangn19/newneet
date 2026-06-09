import { callAI } from './lib/ai.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { examType, overallAccuracy, predictedAccuracy, consistencyScore, trendDirection, totalQuestions, weakTopics, topicPerformance, studyTimeTotal } = req.body

  const systemPrompt = `You are a UPSC/NEET mentor and performance analyst. Analyze the student's performance data and provide:
1. A 3-4 sentence analysis of their current performance (strengths, weaknesses, patterns)
2. 3-5 specific, actionable recommendations for improvement
3. A predicted outcome/rank estimate if applicable

Be direct, specific, and motivational. Use markdown formatting minimally.`

  const userPrompt = `Student Performance Data:
- Exam: ${examType || 'NEET'}
- Overall Accuracy: ${overallAccuracy || 0}%
- Predicted Accuracy Trend: ${predictedAccuracy || 0}%
- Consistency Score: ${consistencyScore || 0}%
- Trend Direction: ${trendDirection >= 0 ? 'Improving (+' + Math.round(trendDirection) + '%)' : 'Declining (' + Math.round(trendDirection) + '%)'}
- Total Questions Attempted: ${totalQuestions || 0}
- Total Study Time: ${Math.round(studyTimeTotal / 60)} hours
- Weak Topics (low accuracy): ${weakTopics ? weakTopics.map(t => `${t.name} (${t.accuracy}%, ${t.attempts} attempts)`).join(', ') : 'None'}
- Topic Performance: ${topicPerformance ? topicPerformance.map(t => `${t.name}: ${t.accuracy}%`).join(', ') : 'Not enough data'}

Return JSON:
{
  "analysis": "3-4 sentence performance analysis",
  "recommendations": ["rec 1", "rec 2", "rec 3", "rec 4", "rec 5"],
  "predictedRank": "optional one-liner about predicted rank or score"
}`

  const result = await callAI(systemPrompt, userPrompt, 0.7, 1024)

  if (result.text) {
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return res.json({ source: result.source, ...parsed })
      }
    } catch (e) { /* parse failed */ }
  }

  // Fallback
  return res.json({
    source: 'fallback',
    analysis: `Based on your performance data, you've attempted ${totalQuestions || 0} questions with ${overallAccuracy || 0}% accuracy. ${weakTopics && weakTopics.length > 0 ? `Your weakest areas are ${weakTopics.slice(0, 3).map(t => t.name).join(', ')}. Focus on revising these topics first.` : 'Keep building your question base to get more detailed insights.'} ${consistencyScore >= 50 ? 'Your consistency is good — maintain the daily practice habit.' : 'Try to study more regularly to build consistency.'}`,
    recommendations: [
      `Focus on weak areas identified in your performance heatmap`,
      `Practice at least 20 questions daily to maintain consistency`,
      `Review incorrect answers immediately after each practice session`,
      `Take timed mock tests to improve speed and accuracy`,
      `Revise conceptual weak spots using NCERTs or standard textbooks`,
    ],
    predictedRank: `Keep practicing consistently — accuracy of ${overallAccuracy || 0}% with regular improvement is a strong foundation.`,
  })
}
