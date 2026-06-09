// UPSC rich lesson data — structured interactive modules for GS topics
export const upscModuleLessons = {
  // ═══════════════════════════════════════════════════════════════
  // Indian Constitution — Module 0 (gs2-constitution-m0)
  // ═══════════════════════════════════════════════════════════════
  'gs2-constitution-m0': {
    title: 'Framework of the Constitution',
    icon: '',
    theme: 'Explore the foundational document of Indian democracy — its making, philosophy, and key features.',
    xpReward: 200,
    badge: 'Constitution Scholar',
    lessons: [
      {
        title: 'Making of the Constitution',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Tap the milestones in the making of the Constitution!',
            items: [
              { id: 'c1', icon: '', label: 'Constituent Assembly', detail: 'Formed in 1946 under the Cabinet Mission Plan. 389 members initially, reduced to 299 after Partition. Dr. Sachchidananda Sinha was the temporary President.' },
              { id: 'c2', icon: '', label: 'Objective Resolution', detail: 'Moved by Jawaharlal Nehru on Dec 13, 1946. It outlined the ideals and philosophy of the Constitution. Adopted on Jan 22, 1947.' },
              { id: 'c3', icon: '', label: 'Drafting Committee', detail: 'Chaired by Dr. B.R. Ambedkar. Seven members. Took 2 years 11 months 18 days to draft. Held 11 sessions with 114 days of debate.' },
              { id: 'c4', icon: '', label: 'Adoption & Commencement', detail: 'Adopted on Nov 26, 1949 (Constitution Day). Came into effect on Jan 26, 1950 (Republic Day). Original has 395 Articles in 22 Parts + 8 Schedules.' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'Who was the Chairman of the Drafting Committee of the Indian Constitution?', options: ['Jawaharlal Nehru', 'Rajendra Prasad', 'B.R. Ambedkar', 'Sardar Patel'], ans: 2, explanation: 'Dr. B.R. Ambedkar chaired the Drafting Committee and is regarded as the chief architect of the Indian Constitution.' },
          },
          {
            type: 'match',
            pairs: [
              { term: '1946', def: 'Constituent Assembly formed' },
              { term: 'Dec 13, 1946', def: 'Objective Resolution moved' },
              { term: 'Nov 26, 1949', def: 'Constitution adopted' },
              { term: 'Jan 26, 1950', def: 'Constitution commenced' },
            ],
          },
          {
            type: 'fillBlank',
            sentence: 'The Constituent Assembly took ___ years, ___ months and ___ days to draft the Constitution.',
            blanks: [
              { answer: '2', hint: 'years' },
              { answer: '11', hint: 'months' },
              { answer: '18', hint: 'days' },
            ],
          },
        ],
      },
      {
        title: 'Preamble & Philosophy',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Unpack the Preamble! Tap each keyword.',
            items: [
              { id: 'p1', icon: '', label: 'Sovereign', detail: 'India is internally and externally independent. Not a dominion of any other nation. Free to conduct its own affairs.' },
              { id: 'p2', icon: '', label: 'Socialist', detail: 'Added by 42nd Amendment (1976). Democratic socialism — mixed economy, wealth redistribution, social justice. Not state socialism.' },
              { id: 'p3', icon: '', label: 'Secular', detail: 'Added by 42nd Amendment (1976). State has no official religion. Equal respect for all religions. Article 25-28 guarantee religious freedom.' },
              { id: 'p4', icon: '', label: 'Democratic Republic', detail: 'Government derives authority from people\'s will. President is the head of state (not a hereditary monarch). Universal adult franchise.' },
            ],
          },
          {
            type: 'sequence',
            instruction: ' Arrange the Preamble keywords in their correct order:',
            items: [
              { id: 'po1', text: 'We, THE PEOPLE OF INDIA', order: 1 },
              { id: 'po2', text: 'SOVEREIGN SOCIALIST SECULAR DEMOCRATIC', order: 2 },
              { id: 'po3', text: 'REPUBLIC', order: 3 },
              { id: 'po4', text: 'JUSTICE, LIBERTY, EQUALITY', order: 4 },
              { id: 'po5', text: 'FRATERNITY', order: 5 },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The words "Socialist" and "Secular" were added to the Preamble by which amendment?', options: ['24th Amendment', '42nd Amendment', '44th Amendment', '73rd Amendment'], ans: 1, explanation: 'The 42nd Amendment (1976), also called the Mini-Constitution, added Socialist and Secular to the Preamble.' },
          },
          {
            type: 'mcq',
            question: { q: 'The Preamble declares India as a:', options: ['Federation', 'Unitary state', 'Sovereign Socialist Secular Democratic Republic', 'Union of States'], ans: 2, explanation: 'The Preamble declares India as a Sovereign Socialist Secular Democratic Republic. The phrase "Union of States" appears in Article 1.' },
          },
          {
            type: 'dragCategory',
            instruction: ' Sort these features as SOURCES or NOT sources of the Constitution:',
            categories: [
              { id: 'source', label: ' Source' },
              { id: 'notsource', label: ' Not a Source' },
            ],
            items: [
              { id: 'sr1', text: 'Government of India Act 1935', correctCategory: 'source' },
              { id: 'sr2', text: 'UK Constitution', correctCategory: 'source' },
              { id: 'sr3', text: 'US Constitution', correctCategory: 'source' },
              { id: 'sr4', text: 'French Revolution', correctCategory: 'notsource' },
              { id: 'sr5', text: 'Irish Constitution', correctCategory: 'source' },
              { id: 'sr6', text: 'Magna Carta', correctCategory: 'notsource' },
            ],
          },
        ],
      },
      {
        title: 'Salient Features',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Discover the key features! Tap each one.',
            items: [
              { id: 'f1', icon: '', label: 'Lengthiest Constitution', detail: 'Originally 395 Articles, 22 Parts, 8 Schedules. Now ~470+ Articles, 25 Parts, 12 Schedules. Borrowed from many sources.' },
              { id: 'f2', icon: '', label: 'Federal with Unitary Bias', detail: 'Dual polity (Union + States), written Constitution, supremacy of Constitution. But single citizenship, single judiciary, strong Centre.' },
              { id: 'f3', icon: '', label: 'Fundamental Rights', detail: 'Part III (Article 12-35). Seven FRs originally (now six — Right to Property deleted). Justiciable and enforceable by courts.' },
              { id: 'f4', icon: '', label: 'Directive Principles', detail: 'Part IV (Article 36-51). Non-justiciable but fundamental to governance. Welfare state ideals borrowed from Irish Constitution.' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The Indian Constitution is described as:', options: ['Strictly Federal', 'Unitary', 'Federal with unitary bias', 'Confederal'], ans: 2, explanation: 'India is a federal system with a strong unitary bias. The term "Union of States" (Article 1) emphasizes indestructible unity.' },
          },
          {
            type: 'match',
            pairs: [
              { term: 'Part III', def: 'Fundamental Rights' },
              { term: 'Part IV', def: 'Directive Principles' },
              { term: 'Part IVA', def: 'Fundamental Duties' },
              { term: 'Part VI', def: 'State Governments' },
            ],
          },
          {
            type: 'speedTap',
            instruction: ' Tap all FEDERAL features of the Constitution!',
            timeLimit: 12,
            items: [
              { id: 'fed1', text: 'Written Constitution', correct: true },
              { id: 'fed2', text: 'Single Citizenship', correct: false },
              { id: 'fed3', text: 'Division of Powers', correct: true },
              { id: 'fed4', text: 'Supremacy of Constitution', correct: true },
              { id: 'fed5', text: 'Single Judiciary', correct: false },
              { id: 'fed6', text: 'Bicameral Parliament', correct: true },
              { id: 'fed7', text: 'All-India Services', correct: false },
              { id: 'fed8', text: 'Independent Judiciary', correct: true },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The Constitution of India is the ___ written Constitution in the world.', options: ['Shortest', 'Lengthiest', 'Oldest', 'Most rigid'], ans: 1, explanation: 'The Indian Constitution is the lengthiest written Constitution in the world, covering every aspect of governance in detail.' },
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Modern Indian History — Module 0 (gs1-modern-m0)
  // ═══════════════════════════════════════════════════════════════
  'gs1-modern-m0': {
    title: 'British Expansion in India',
    icon: '',
    theme: 'Trace how the British East India Company transformed from traders to rulers of the Indian subcontinent.',
    xpReward: 200,
    badge: 'History Apprentice',
    lessons: [
      {
        title: 'Carnatic Wars & Bengal',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Explore the early Anglo-French conflicts!',
            items: [
              { id: 'h1', icon: '', label: 'First Carnatic War (1746-48)', detail: 'Part of the Austrian War of Succession in Europe. French captured Madras. Treaty of Aix-la-Chapelle returned Madras to British. First taste of Indian warfare for Europeans.' },
              { id: 'h2', icon: '', label: 'Second Carnatic War (1749-54)', detail: 'Dupleix (French) vs Clive (British). Involved succession disputes in Carnatic and Hyderabad. British emerged stronger after Treaty of Pondicherry.' },
              { id: 'h3', icon: '', label: 'Battle of Plassey (1757)', detail: 'Robert Clive defeated Siraj-ud-Daulah with the help of Mir Jafar\'s betrayal. Marked the beginning of British political influence in India.' },
              { id: 'h4', icon: '', label: 'Battle of Buxar (1764)', detail: 'British defeated combined forces of Mir Qasim, Shuja-ud-Daulah (Awadh), and Shah Alam II (Mughal). Gave British control over Bengal, Bihar, Odisha.' },
            ],
          },
          {
            type: 'sequence',
            instruction: ' Arrange these battles in chronological order:',
            items: [
              { id: 'bt1', text: 'First Carnatic War', order: 1 },
              { id: 'bt2', text: 'Second Carnatic War', order: 2 },
              { id: 'bt3', text: 'Battle of Plassey', order: 3 },
              { id: 'bt4', text: 'Battle of Buxar', order: 4 },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The Battle of Plassey was fought between the British and:', options: ['Mir Qasim', 'Siraj-ud-Daulah', 'Shah Alam II', 'Tipu Sultan'], ans: 1, explanation: 'Battle of Plassey (1757) was fought between Robert Clive (British) and Siraj-ud-Daulah, the Nawab of Bengal.' },
          },
          {
            type: 'match',
            pairs: [
              { term: '1757', def: 'Battle of Plassey' },
              { term: '1764', def: 'Battle of Buxar' },
              { term: '1746', def: 'First Carnatic War' },
              { term: '1749', def: 'Second Carnatic War' },
            ],
          },
          {
            type: 'fillBlank',
            sentence: 'The Battle of Plassey was won by the British due to the betrayal of ___, who was made the Nawab afterwards.',
            blanks: [{ answer: 'Mir Jafar', hint: 'first name Mir' }],
          },
        ],
      },
      {
        title: 'Anglo-Maratha & Anglo-Sikh Wars',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Learn about British expansion through wars!',
            items: [
              { id: 'm1', icon: '', label: 'First Anglo-Maratha War (1775-82)', detail: 'British defeated. Treaty of Salbai (1782) restored status quo. British realized the Maratha power was formidable.' },
              { id: 'm2', icon: '', label: 'Second Anglo-Maratha War (1803-05)', detail: 'British defeated the Maratha confederacy (Scindia, Bhonsle, Holkar). British gained control of Delhi and the Mughal Emperor.' },
              { id: 'm3', icon: '', label: 'Third Anglo-Maratha War (1817-19)', detail: 'Decisive British victory. Peshwa Baji Rao II defeated. Maratha territories annexed. British became the paramount power in India.' },
              { id: 'm4', icon: '', label: 'Anglo-Sikh Wars (1845-46, 1848-49)', detail: 'First war → Treaty of Lahore (lost Jammu & Kashmir). Second war → Punjab annexed. Ranjit Singh\'s kingdom fell to the British.' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The Treaty of Salbai (1782) was signed after which war?', options: ['Battle of Buxar', 'First Anglo-Maratha War', 'Second Anglo-Mysore War', 'First Carnatic War'], ans: 1, explanation: 'The Treaty of Salbai ended the First Anglo-Maratha War. It restored the status quo and established 20 years of peace between the British and Marathas.' },
          },
          {
            type: 'mcq',
            question: { q: 'Who was the last Peshwa of the Maratha Empire?', options: ['Balaji Baji Rao', 'Madhav Rao', 'Baji Rao II', 'Nana Saheb'], ans: 2, explanation: 'Baji Rao II was the last Peshwa (1796-1818). He was defeated in the Third Anglo-Maratha War and pensioned off in Bithoor.' },
          },
          {
            type: 'dragCategory',
            instruction: ' Sort the wars by the century they occurred:',
            categories: [
              { id: '18c', label: ' 18th Century' },
              { id: '19c', label: ' 19th Century' },
            ],
            items: [
              { id: 'w1', text: 'Battle of Plassey', correctCategory: '18c' },
              { id: 'w2', text: 'Third Anglo-Maratha War', correctCategory: '19c' },
              { id: 'w3', text: 'First Carnatic War', correctCategory: '18c' },
              { id: 'w4', text: 'Anglo-Sikh Wars', correctCategory: '19c' },
              { id: 'w5', text: 'Battle of Buxar', correctCategory: '18c' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'Which treaty gave the British control of Delhi after the Second Anglo-Maratha War?', options: ['Treaty of Salbai', 'Treaty of Bassein', 'Treaty of Lahore', 'Treaty of Srirangapatnam'], ans: 1, explanation: 'The Treaty of Bassein (1802) was a subsidiary alliance treaty. The Second Anglo-Maratha War followed, and British gained control of Delhi and the Mughal Emperor.' },
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Indian Economy — Module 0 (gs3-indian-econ-m0)
  // ═══════════════════════════════════════════════════════════════
  'gs3-indian-econ-m0': {
    title: 'Introduction to Indian Economy',
    icon: '',
    theme: 'Understand the fundamentals of the Indian economy — its structure, sectors, and key economic indicators.',
    xpReward: 200,
    badge: 'Economics Learner',
    lessons: [
      {
        title: 'Structure of Indian Economy',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Explore the three sectors of the economy!',
            items: [
              { id: 'e1', icon: '', label: 'Primary Sector', detail: 'Agriculture, forestry, fishing, mining. Employs ~42% of India\'s workforce but contributes only ~16% to GDP. Low productivity due to fragmented landholdings.' },
              { id: 'e2', icon: '', label: 'Secondary Sector', detail: 'Manufacturing, construction, utilities. Contributes ~25% to GDP. Government pushing "Make in India" to increase manufacturing share to 25% of GDP.' },
              { id: 'e3', icon: '', label: 'Tertiary Sector', detail: 'Services — IT, banking, telecom, tourism, healthcare. Largest contributor at ~60% of GDP. India is a services-led economy unlike China (manufacturing-led).' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'Which sector contributes the most to India\'s GDP?', options: ['Primary', 'Secondary', 'Tertiary', 'Quaternary'], ans: 2, explanation: 'The tertiary (services) sector contributes about 60% of India\'s GDP, making it the largest sector.' },
          },
          {
            type: 'match',
            pairs: [
              { term: 'Primary', def: 'Agriculture, mining' },
              { term: 'Secondary', def: 'Manufacturing' },
              { term: 'Tertiary', def: 'Services' },
              { term: 'Quaternary', def: 'Knowledge-based' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'Which sector employs the largest workforce in India?', options: ['Primary', 'Secondary', 'Tertiary', 'Government'], ans: 0, explanation: 'The primary sector (agriculture) employs about 42% of India\'s workforce, despite contributing only ~16% to GDP.' },
          },
          {
            type: 'fillBlank',
            sentence: 'India is a ___ economy, meaning the ___ sector dominates GDP contribution.',
            blanks: [
              { answer: 'services-led', hint: 'type of economy' },
              { answer: 'tertiary', hint: 'sector name' },
            ],
          },
        ],
      },
      {
        title: 'Key Economic Indicators',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Tap each indicator to understand its meaning!',
            items: [
              { id: 'ind1', icon: '', label: 'GDP (Gross Domestic Product)', detail: 'Total value of all final goods and services produced within India\'s borders in a year. Current GDP: ~$3.7 trillion. Growth rate: ~6-7%.' },
              { id: 'ind2', icon: '', label: 'GNP (Gross National Product)', detail: 'GDP + net income from abroad (remittances, dividends). India is a top remittance-receiving country ($100B+ annually).' },
              { id: 'ind3', icon: '', label: 'Inflation (CPI/WPI)', detail: 'CPI measures retail inflation (price at consumer level). RBI targets CPI inflation at 4% (+/- 2%). WPI measures wholesale price changes.' },
              { id: 'ind4', icon: '', label: 'Unemployment Rate', detail: 'Percentage of labour force actively seeking work. India\'s unemployment rate fluctuates 4-8%. PLFS (Periodic Labour Force Survey) tracks it.' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The difference between GDP and GNP is:', options: ['Depreciation', 'Net factor income from abroad', 'Indirect taxes', 'Subsidies'], ans: 1, explanation: 'GNP = GDP + Net factor income from abroad (earnings by residents abroad minus earnings by foreigners in India).' },
          },
          {
            type: 'match',
            pairs: [
              { term: 'GDP', def: 'Goods & services within borders' },
              { term: 'GNP', def: 'GDP + foreign income' },
              { term: 'CPI', def: 'Retail inflation' },
              { term: 'WPI', def: 'Wholesale inflation' },
            ],
          },
          {
            type: 'speedTap',
            instruction: ' Tap all the KEY ECONOMIC INDICATORS!',
            timeLimit: 12,
            items: [
              { id: 'ec1', text: 'GDP', correct: true },
              { id: 'ec2', text: 'Temperature', correct: false },
              { id: 'ec3', text: 'Inflation', correct: true },
              { id: 'ec4', text: 'Wind Speed', correct: false },
              { id: 'ec5', text: 'Unemployment', correct: true },
              { id: 'ec6', text: 'Population', correct: false },
              { id: 'ec7', text: 'GDP Growth Rate', correct: true },
              { id: 'ec8', text: 'Rainfall', correct: false },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'RBI\'s inflation target under the Monetary Policy Framework is:', options: ['2%', '4% +/- 2%', '6%', '5%'], ans: 1, explanation: 'RBI aims to keep CPI inflation at 4% with a tolerance band of +/- 2% (i.e., 2-6%).' },
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Environment & Ecology — Module 0 (gs3-environment-m0)
  // ═══════════════════════════════════════════════════════════════
  'gs3-environment-m0': {
    title: 'Ecology & Ecosystem Basics',
    icon: '',
    theme: 'Understand the fundamental concepts of ecology — the web of life connecting all organisms on Earth.',
    xpReward: 200,
    badge: 'Ecology Explorer',
    lessons: [
      {
        title: 'What is Ecology?',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Explore the levels of ecological organization!',
            items: [
              { id: 'eco1', icon: '', label: 'Organism', detail: 'Individual living being — the basic unit of study in ecology. Adaptations help organisms survive in their environment.' },
              { id: 'eco2', icon: '', label: 'Population', detail: 'Group of individuals of the same species living in a particular area. Studied through density, birth rate, death rate, age distribution.' },
              { id: 'eco3', icon: '', label: 'Community', detail: 'All populations of different species living and interacting in an area. Community ecology studies species interactions.' },
              { id: 'eco4', icon: '', label: 'Ecosystem', detail: 'Biotic community + its abiotic environment (air, water, soil, sunlight). Functional unit of ecology with energy flow and nutrient cycling.' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The term "ecology" was coined by:', options: ['Darwin', 'Haeckel', 'Odum', 'Tansley'], ans: 1, explanation: 'Ernst Haeckel (1869) coined the term "ecology" from the Greek "oikos" (house) + "logos" (study).' },
          },
          {
            type: 'sequence',
            instruction: ' Arrange the ecological levels from smallest to largest:',
            items: [
              { id: 'l1', text: 'Organism', order: 1 },
              { id: 'l2', text: 'Population', order: 2 },
              { id: 'l3', text: 'Community', order: 3 },
              { id: 'l4', text: 'Ecosystem', order: 4 },
              { id: 'l5', text: 'Biome', order: 5 },
              { id: 'l6', text: 'Biosphere', order: 6 },
            ],
          },
          {
            type: 'match',
            pairs: [
              { term: 'Population', def: 'Same species, same area' },
              { term: 'Community', def: 'Different species interacting' },
              { term: 'Ecosystem', def: 'Biotic + Abiotic' },
              { term: 'Biosphere', def: 'All ecosystems on Earth' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'Which of the following is an abiotic component of an ecosystem?', options: ['Bacteria', 'Trees', 'Soil pH', 'Fungi'], ans: 2, explanation: 'Soil pH is an abiotic (non-living) component. Bacteria, trees, and fungi are biotic (living) components.' },
          },
        ],
      },
      {
        title: 'Ecosystem Structure & Function',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Discover how ecosystems function!',
            items: [
              { id: 'ef1', icon: '', label: 'Producers (Autotrophs)', detail: 'Plants, algae, phytoplankton. Convert solar energy into chemical energy via photosynthesis. Form the FIRST trophic level.' },
              { id: 'ef2', icon: '', label: 'Consumers (Heterotrophs)', detail: 'Herbivores (primary), Carnivores (secondary/tertiary), Omnivores. Depend on producers for food energy.' },
              { id: 'ef3', icon: '', label: 'Decomposers', detail: 'Bacteria, fungi. Break down dead organic matter. Release nutrients back to soil. Essential for nutrient cycling.' },
              { id: 'ef4', icon: '', label: 'Energy Flow', detail: 'Unidirectional — sun → producers → consumers → decomposers. Only 10% energy transfers between trophic levels (Lindeman\'s 10% Law).' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'According to the 10% Law of energy transfer, if producers have 10,000 J of energy, how much reaches the secondary consumers?', options: ['1000 J', '100 J', '10 J', '1 J'], ans: 1, explanation: '10% of 10,000 J = 1,000 J (primary consumers). Then 10% of that = 100 J (secondary consumers). Only 100 J reaches secondary consumers.' },
          },
          {
            type: 'dragCategory',
            instruction: ' Sort these organisms by their trophic level:',
            categories: [
              { id: 'prod', label: ' Producers' },
              { id: 'prim', label: ' Primary Consumers' },
              { id: 'sec', label: ' Secondary Consumers' },
            ],
            items: [
              { id: 'tr1', text: 'Grass', correctCategory: 'prod' },
              { id: 'tr2', text: 'Grasshopper', correctCategory: 'prim' },
              { id: 'tr3', text: 'Frog', correctCategory: 'sec' },
              { id: 'tr4', text: 'Mango tree', correctCategory: 'prod' },
              { id: 'tr5', text: 'Caterpillar', correctCategory: 'prim' },
              { id: 'tr6', text: 'Snake', correctCategory: 'sec' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'Which of the following ecosystems has the highest productivity?', options: ['Desert', 'Tropical rainforest', 'Temperate forest', 'Grassland'], ans: 1, explanation: 'Tropical rainforests have the highest primary productivity due to abundant sunlight, rainfall, and warm temperatures year-round.' },
          },
          {
            type: 'fillBlank',
            sentence: 'Energy flow in an ecosystem is ___ while nutrient flow is ___.',
            blanks: [
              { answer: 'unidirectional', hint: 'one direction' },
              { answer: 'cyclic', hint: 'circular' },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Ethics — Module 0 (gs4-ethics-m0)
  // ═══════════════════════════════════════════════════════════════
  'gs4-ethics-m0': {
    title: 'Introduction to Ethics & Human Values',
    icon: '',
    theme: 'Explore the foundational concepts of ethics — the branch of philosophy that guides human conduct and decision-making.',
    xpReward: 200,
    badge: 'Ethics Apprentice',
    lessons: [
      {
        title: 'What is Ethics?',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Unpack the meaning of ethics!',
            items: [
              { id: 'et1', icon: '', label: 'Ethics Defined', detail: 'Derived from Greek "ethos" meaning character. Systematic study of moral principles that govern human behaviour and decision-making.' },
              { id: 'et2', icon: '', label: 'Ethics vs Morality', detail: 'Ethics = external, societal/group norms. Morality = internal, personal principles. Ethics asks "What should I do?" Morality asks "What kind of person should I be?"' },
              { id: 'et3', icon: '', label: 'Applied Ethics', detail: 'Practical application of ethical principles. Includes bioethics, business ethics, environmental ethics, medical ethics, and media ethics.' },
              { id: 'et4', icon: '', label: 'Ethics in Public Life', detail: 'For civil servants, ethics is about integrity, impartiality, accountability, and dedication to public service. UPSC GS Paper IV focuses on this.' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The term "ethics" is derived from the Greek word:', options: ['Pathos', 'Ethos', 'Logos', 'Nomos'], ans: 1, explanation: 'Ethics comes from "ethos" meaning character or custom. It is the study of what is morally right and wrong.' },
          },
          {
            type: 'match',
            pairs: [
              { term: 'Ethics', def: 'Outer societal norms' },
              { term: 'Morality', def: 'Inner personal values' },
              { term: 'Integrity', def: 'Honesty & consistency' },
              { term: 'Accountability', def: 'Responsibility for actions' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'Which of the following is an example of applied ethics in public administration?', options: ['Studying political theory', 'Implementing a welfare scheme with transparency', 'Analysing election data', 'Writing policy memos'], ans: 1, explanation: 'Applied ethics in public administration involves practical moral decisions, such as ensuring transparency and fairness in welfare scheme implementation.' },
          },
          {
            type: 'fillBlank',
            sentence: '___ is the branch of philosophy that deals with moral principles governing human conduct, while ___ deals with what is right and wrong in practice.',
            blanks: [
              { answer: 'Ethics', hint: 'philosophical study' },
              { answer: 'morality', hint: 'practical application' },
            ],
          },
        ],
      },
      {
        title: 'Ethical Theories',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Explore the major ethical frameworks!',
            items: [
              { id: 'th1', icon: '', label: 'Deontology (Kant)', detail: 'Duty-based ethics. Actions are right/wrong based on rules, not consequences. Kant\'s Categorical Imperative: "Act only according to that maxim by which you can at the same time will that it should become universal law."' },
              { id: 'th2', icon: '', label: 'Consequentialism', detail: 'Outcome-based ethics. The morality of an action is judged by its consequences. "Greatest good for the greatest number" (Utilitarianism — Bentham, Mill).' },
              { id: 'th3', icon: '', label: 'Virtue Ethics (Aristotle)', detail: 'Character-based ethics. Focuses on the character of the actor rather than the action. Key virtues: courage, temperance, wisdom, justice.' },
              { id: 'th4', icon: '', label: 'Feminist Ethics (Gilligan)', detail: 'Critiques traditional male-centric ethics. Emphasises care, empathy, relationships over abstract rules. "Ethics of Care" — Carol Gilligan.' },
            ],
          },
          {
            type: 'mcq',
            question: { q: '"Act only according to that maxim which you can at the same time will to become a universal law" is the central idea of:', options: ['Utilitarianism', 'Kantian Deontology', 'Virtue Ethics', 'Feminist Ethics'], ans: 1, explanation: 'This is Immanuel Kant\'s Categorical Imperative — the foundational principle of deontological (duty-based) ethics.' },
          },
          {
            type: 'match',
            pairs: [
              { term: 'Deontology', def: 'Duty-based (Kant)' },
              { term: 'Utilitarianism', def: 'Greatest good (Mill)' },
              { term: 'Virtue Ethics', def: 'Character (Aristotle)' },
              { term: 'Ethics of Care', def: 'Empathy (Gilligan)' },
            ],
          },
          {
            type: 'dragCategory',
            instruction: ' Sort these by whether they focus on DUTY or CONSEQUENCE:',
            categories: [
              { id: 'duty', label: ' Duty-based (Deontology)' },
              { id: 'conseq', label: ' Consequence-based' },
            ],
            items: [
              { id: 'dw1', text: 'Kant\'s Categorical Imperative', correctCategory: 'duty' },
              { id: 'dw2', text: 'Utilitarianism', correctCategory: 'conseq' },
              { id: 'dw3', text: 'Telling truth always', correctCategory: 'duty' },
              { id: 'dw4', text: 'Ends justify means', correctCategory: 'conseq' },
              { id: 'dw5', text: 'Following rules regardless', correctCategory: 'duty' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The "Ethics of Care" was developed by:', options: ['John Rawls', 'Carol Gilligan', 'Peter Singer', 'John Stuart Mill'], ans: 1, explanation: 'Carol Gilligan developed the Ethics of Care, critiquing Kohlberg\'s male-centric theory of moral development and emphasising empathy and relationships.' },
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // Indian Polity — Module 0 (gs2-polity-m0)
  // ═══════════════════════════════════════════════════════════════
  'gs2-polity-m0': {
    title: 'Union & State Executive',
    icon: '',
    theme: 'Understand the structure and powers of the Union and State executives — the President, Prime Minister, Governor, and Chief Minister.',
    xpReward: 200,
    badge: 'Polity Pro',
    lessons: [
      {
        title: 'The President of India',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Explore the powers of the President!',
            items: [
              { id: 'pr1', icon: '', label: 'Executive Powers', detail: 'All executive actions taken in President\'s name. Appoints PM, Council of Ministers, CAG, CEC, Attorney General, Governors, Supreme Court judges.' },
              { id: 'pr2', icon: '', label: 'Legislative Powers', detail: 'Summons/prorogues Parliament. Addresses first session. Nominates 12 Rajya Sabha members + 2 Anglo-Indian MPs (Lok Sabha). Assent to bills.' },
              { id: 'pr3', icon: '', label: 'Judicial Powers', detail: 'Appoints Supreme Court & High Court judges. Pardoning power (Article 72) — can grant pardon, reprieve, respite or remission of punishment.' },
              { id: 'pr4', icon: '', label: 'Emergency Powers', detail: 'Three types — National (Article 352), State/President\'s Rule (Article 356), Financial Emergency (Article 360). "Emergency provisions" borrowed from Weimar Constitution.' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The President of India is elected by:', options: ['Direct popular vote', 'Electoral College', 'Parliament only', 'State Assemblies only'], ans: 1, explanation: 'The President is elected by an Electoral College consisting of elected MPs (Lok Sabha + Rajya Sabha) and elected MLAs. Value of votes is based on population.' },
          },
          {
            type: 'match',
            pairs: [
              { term: 'Article 72', def: 'Pardoning power of President' },
              { term: 'Article 52', def: 'President of India' },
              { term: 'Article 74', def: 'Council of Ministers' },
              { term: 'Article 356', def: 'President\'s Rule' },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'Who administers the oath of office to the President?', options: ['Prime Minister', 'Chief Justice of India', 'Vice President', 'Attorney General'], ans: 1, explanation: 'The Chief Justice of India administers the oath of office to the President. In their absence, the senior-most Supreme Court judge does so.' },
          },
          {
            type: 'fillBlank',
            sentence: 'The President of India can be impeached for violation of the ___.',
            blanks: [{ answer: 'Constitution', hint: 'supreme law' }],
          },
        ],
      },
      {
        title: 'Prime Minister & Council of Ministers',
        tasks: [
          {
            type: 'tapReveal',
            instruction: ' Understand the PM and Cabinet!',
            items: [
              { id: 'pm1', icon: '', label: 'Prime Minister', detail: 'Head of government. Appointed by President. Leader of majority party in Lok Sabha. Real executive authority. "First among equals" in cabinet.' },
              { id: 'pm2', icon: '', label: 'Council of Ministers', detail: 'Aid and advise the President (Article 74). Three categories — Cabinet Ministers (senior, attend all meetings), Ministers of State (junior), Deputy Ministers.' },
              { id: 'pm3', icon: '', label: 'Cabinet', detail: 'Inner circle of senior ministers. Policy-making body. Usually 15-25 members. Collective responsibility to Lok Sabha.' },
              { id: 'pm4', icon: '', label: 'Individual & Collective Responsibility', detail: 'Ministers are individually responsible to President. Council is collectively responsible to Lok Sabha. Lok Sabha can remove them via no-confidence motion.' },
            ],
          },
          {
            type: 'sequence',
            instruction: ' Arrange the process of government formation:',
            items: [
              { id: 'gf1', text: 'General Election held', order: 1 },
              { id: 'gf2', text: 'Majority party elected', order: 2 },
              { id: 'gf3', text: 'President appoints PM', order: 3 },
              { id: 'gf4', text: 'PM forms Council of Ministers', order: 4 },
              { id: 'gf5', text: 'Cabinet meets to govern', order: 5 },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'The principle of "collective responsibility" means:', options: ['Ministers are responsible to the President', 'All ministers are jointly responsible to Lok Sabha', 'Each minister is individually responsible', 'Ministers are responsible to the party'], ans: 1, explanation: 'Collective responsibility (Article 75) means the Council of Ministers is jointly responsible to the Lok Sabha. A no-confidence vote can remove the entire council.' },
          },
          {
            type: 'speedTap',
            instruction: ' Tap all the CORRECT statements about the PM!',
            timeLimit: 12,
            items: [
              { id: 'pmq1', text: 'PM is head of government', correct: true },
              { id: 'pmq2', text: 'PM is elected directly', correct: false },
              { id: 'pmq3', text: 'PM is appointed by President', correct: true },
              { id: 'pmq4', text: 'PM must be a Rajya Sabha member', correct: false },
              { id: 'pmq5', text: 'PM is first among equals', correct: true },
              { id: 'pmq6', text: 'PM can be removed by President', correct: true },
              { id: 'pmq7', text: 'PM must be below 35 years', correct: false },
              { id: 'pmq8', text: 'PM heads the Cabinet', correct: true },
            ],
          },
          {
            type: 'mcq',
            question: { q: 'No-confidence motion against the Council of Ministers can be introduced in:', options: ['Rajya Sabha only', 'Lok Sabha only', 'Both Houses', 'Joint Session'], ans: 1, explanation: 'A no-confidence motion can only be introduced in the Lok Sabha. The Rajya Sabha cannot remove the Council of Ministers.' },
          },
        ],
      },
    ],
  },
}
