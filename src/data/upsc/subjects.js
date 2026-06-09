export const upscSubjects = [
  {
    id: 'gs1',
    name: 'GS I',
    subtitle: 'Indian Heritage & Culture, History & Geography',
    emoji: '',
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #6D28D9, #8B5CF6)',
    chapters: [
      { id: 'gs1-culture',    name: 'Indian Culture & Heritage' },
      { id: 'gs1-ancient',    name: 'Ancient & Medieval History' },
      { id: 'gs1-modern',     name: 'Modern Indian History' },
      { id: 'gs1-freedom',    name: 'Indian Freedom Struggle' },
      { id: 'gs1-society',    name: 'Indian Society' },
      { id: 'gs1-physical',   name: 'Physical Geography' },
      { id: 'gs1-indian-geo', name: 'Indian Geography' },
      { id: 'gs1-world-geo',  name: 'World Geography' },
      { id: 'gs1-social-iss', name: 'Social Issues' },
    ]
  },
  {
    id: 'gs2',
    name: 'GS II',
    subtitle: 'Governance, Constitution, Polity & International Relations',
    emoji: '',
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #BE185D, #EC4899)',
    chapters: [
      { id: 'gs2-constitution', name: 'Indian Constitution' },
      { id: 'gs2-polity',       name: 'Indian Polity & Governance' },
      { id: 'gs2-panchayat',    name: 'Panchayati Raj & Local Govt' },
      { id: 'gs2-judiciary',    name: 'Judiciary & Legal Framework' },
      { id: 'gs2-welfare',      name: 'Social Welfare & Schemes' },
      { id: 'gs2-health',       name: 'Health & Education Policies' },
      { id: 'gs2-ir',           name: 'International Relations' },
      { id: 'gs2-bilateral',    name: 'Bilateral & Regional Groupings' },
      { id: 'gs2-ngos',         name: 'Role of NGOs & Civil Society' },
    ]
  },
  {
    id: 'gs3',
    name: 'GS III',
    subtitle: 'Economy, Science & Technology, Environment & Security',
    emoji: '',
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #065F46, #10B981)',
    chapters: [
      { id: 'gs3-indian-econ',  name: 'Indian Economy & Planning' },
      { id: 'gs3-banking',      name: 'Banking & Financial System' },
      { id: 'gs3-budget',       name: 'Budget & Fiscal Policy' },
      { id: 'gs3-agriculture',  name: 'Agriculture & Food Security' },
      { id: 'gs3-science',      name: 'Science & Technology' },
      { id: 'gs3-environment',  name: 'Environment & Ecology' },
      { id: 'gs3-biodiversity', name: 'Biodiversity & Conservation' },
      { id: 'gs3-disaster',     name: 'Disaster Management' },
      { id: 'gs3-security',     name: 'Internal Security' },
      { id: 'gs3-cyber',        name: 'Cyber Security' },
    ]
  },
  {
    id: 'gs4',
    name: 'GS IV',
    subtitle: 'Ethics, Integrity & Aptitude',
    emoji: '',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)',
    chapters: [
      { id: 'gs4-ethics',       name: 'Ethics & Human Interface' },
      { id: 'gs4-attitude',     name: 'Attitude & Moral Reasoning' },
      { id: 'gs4-aptitude',     name: 'Aptitude & Foundational Values' },
      { id: 'gs4-emotional',    name: 'Emotional Intelligence' },
      { id: 'gs4-philosophers', name: 'Thinkers & Philosophers' },
      { id: 'gs4-case-studies', name: 'Case Studies on Ethics' },
      { id: 'gs4-probity',      name: 'Probity in Governance' },
      { id: 'gs4-civil-service',name: 'Civil Service Values' },
    ]
  },
  {
    id: 'essay',
    name: 'Essay',
    subtitle: 'Essay Writing Practice',
    emoji: '',
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
    chapters: [
      { id: 'essay-tech',       name: 'Technology & Development' },
      { id: 'essay-social',     name: 'Social Issues & Justice' },
      { id: 'essay-political',  name: 'Political & Governance' },
      { id: 'essay-philosophy', name: 'Philosophical & Abstract' },
      { id: 'essay-env',        name: 'Environment & Society' },
    ]
  },
]

export function getUpscChapters(subjectId) {
  const sub = upscSubjects.find(s => s.id === subjectId)
  return sub?.chapters || []
}

export function getUpscChapter(id) {
  for (const sub of upscSubjects) {
    const ch = sub.chapters.find(c => c.id === id)
    if (ch) return { ...ch, subjectId: sub.id, subjectName: sub.name }
  }
  return null
}
