import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSubjectsForExam, getModulesForChapter } from '../data/index';
import useStore from '../store/useStore';
import useTranslation from '../lib/useTranslation';
import PremiumChapterCard from '../components/PremiumChapterCard';
import { useState, useEffect, useRef, useCallback } from 'react';

const CATEGORIES = ['Biology', 'Physics', 'Chemistry'];
const categoryToSubject = { Biology: 'biology', Physics: 'physics', Chemistry: 'chemistry' };

const CHAPTER_IMAGES = {
  p1: '/chapter icon/physical-world.webp',
  p2: '/chapter icon/units-and-measurements.webp',
  p3: '/chapter icon/1d-motion.webp',
  c1: '/chapter icon/basic-concept-of-chemistry.webp',
  c2: '/chapter icon/structure-of-atom.webp',
  b1: '/chapter icon/living-world.webp',
  b2: '/chapter icon/bio-classification.webp',
  b3: '/chapter icon/plant-kingdom.webp',
};

export default function Home() {
  const navigate = useNavigate();
  const { completedModules, stats, user } = useStore();
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState('Biology');
  const [subjectDir, setSubjectDir] = useState(0);
  const [showBeta, setShowBeta] = useState(true);
  const [[cardIndex, dir], setCard] = useState([0, 0]);
  const touchStartX = useRef(0);

  const switchSubject = (cat) => {
    const oldIdx = CATEGORIES.indexOf(activeCategory);
    const newIdx = CATEGORIES.indexOf(cat);
    setSubjectDir(newIdx > oldIdx ? 1 : -1);
    setActiveCategory(cat);
  };

  useEffect(() => {
    const seen = sessionStorage.getItem('beta_notice_seen');
    if (seen) setShowBeta(false);
  }, []);

  const dismissBeta = () => { sessionStorage.setItem('beta_notice_seen', '1'); setShowBeta(false); };

  const subjects = getSubjectsForExam('neet')
  const subjectData = subjects.find((s) => s.id === categoryToSubject[activeCategory]);
  const chapters = subjectData?.chapters || [];

  // Reset card index on subject change
  useEffect(() => { setCard([0, 0]); }, [activeCategory]);

  const goTo = (i, d) => {
    if (i >= 0 && i < chapters.length) setCard([i, d]);
  };

  // Swipe
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) goTo(cardIndex + 1, 1);
    else if (diff < -50) goTo(cardIndex - 1, -1);
  };

  const chapter = chapters[cardIndex];
  const mods = chapter ? getModulesForChapter('neet', chapter.id) : [];
  const done = mods.filter((m) => completedModules.includes(m.id)).length;
  const pct = mods.length > 0 ? Math.round((done / mods.length) * 100) : 0;
  const isLocked = (idx) => {
    if (idx === 0) return false;
    const prev = chapters[idx - 1];
    if (!prev) return true;
    return !getModulesForChapter('neet', prev.id).every(m => completedModules.includes(m.id));
  };

  return (
    <div className="screen" style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100dvh',
    }}>
      {/* Profile picture top-left */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 500 }}>
        <button
          onClick={() => navigate('/profile')}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            padding: 0, overflow: 'hidden',
            background: 'var(--card-bg)',
            border: '3px solid rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-2)' }}>
              {(user?.name?.[0] || 'S').toUpperCase()}
            </div>
          )}
        </button>
      </div>

      {/* Beta notice */}
      {showBeta && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={dismissBeta}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 24, maxWidth: 320, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}></div>
            <h3 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>{t('home_building_title')}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 20 }}>
              {t('home_building_desc')}
            </p>
            <button onClick={dismissBeta} className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 14 }}>
              {t('home_got_it')}
            </button>
          </div>
        </div>
      )}

      {/* Social proof */}
      <div style={{
        padding: '16px 20px 2px', textAlign: 'center',
        color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 500,
        lineHeight: 1.5,
      }}>
        {stats?.totalQuestions > 0
          ? `Students like you solved ${stats.totalQuestions.toLocaleString()} questions across NEET Physics, Chemistry & Biology.`
          : 'Join 2,400+ students preparing for NEET.'}
      </div>

      {/* ===== CARD AREA ===== */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          paddingBottom: 0,
        }}
      >
        <AnimatePresence mode="wait" custom={subjectDir}>
          <motion.div
            key={activeCategory}
            initial={{ x: subjectDir > 0 ? 400 : -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: subjectDir > 0 ? -400 : 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
        {/* Carousel */}
        <div style={{
          position: 'relative',
          width: '100%',
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {[-1, 0, 1].map((offset) => {
            const idx = cardIndex + offset;
            if (idx < 0 || idx >= chapters.length) return null;
            const ch = chapters[idx];
            const locked = isLocked(idx);
            const chMods = ch ? getModulesForChapter('neet', ch.id) : [];
            const chDone = chMods.filter((m) => completedModules.includes(m.id)).length;
            const isCenter = offset === 0;

            return (
              <motion.div
                key={idx}
                animate={{
                  x: offset * 220,
                  scale: isCenter ? 1 : 0.82,
                  zIndex: isCenter ? 10 : 5,
                  opacity: isCenter ? 1 : 0.7,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={() => {
                  if (isCenter && !locked && ch) navigate(`/subject/${subjectData.id}/chapter/${ch.id}`);
                  else if (offset !== 0) goTo(idx, offset);
                }}
                style={{
                  position: 'absolute',
                  width: 280,
                  height: 350,
                  cursor: 'pointer',
                  willChange: 'transform',
                  transform: isCenter ? 'translateZ(0)' : undefined,
                }}
              >
                <PremiumChapterCard
                  chapterNum={`${t('home_chapter')} ${idx + 1}`}
                  title={ch?.name || ''}
                  completed={chDone}
                  total={chMods.length}
                  stars={chMods.length > 0 ? Math.min(3, Math.floor((chDone / chMods.length) * 3)) : 0}
                  locked={locked}
                  illustration={CHAPTER_IMAGES[ch.id] || null}
                  onStart={() => navigate(`/subject/${subjectData.id}/chapter/${ch.id}`)}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 5, marginTop: 16 }}>
          {chapters.slice(0, 20).map((_, i) => (
            <div
              key={i}
              onClick={() => goTo(i, i > cardIndex ? 1 : -1)}
              style={{
                width: i === cardIndex ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === cardIndex ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
                transition: 'all 0.3s',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ===== SUBJECT SELECTOR ===== */}
      <div style={{
        position: 'fixed',
        bottom: 110,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 2000,
      }}>
        <div style={{ position: 'relative', display: 'flex', background: 'var(--accent)', borderRadius: 99, height: 42, minWidth: 280 }}>
          {/* Sliding white pill */}
          <div style={{
            position: 'absolute',
            top: 3, bottom: 3, left: 3,
            width: `calc(${100 / CATEGORIES.length}% - 3px)`,
            background: '#fff',
            borderRadius: 999,
            transform: `translateX(calc(${CATEGORIES.indexOf(activeCategory)} * (100% + 2px)))`,
            transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
          }} />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => switchSubject(cat)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: activeCategory === cat ? '#000' : '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                position: 'relative', zIndex: 1,
                padding: 0, textAlign: 'center',
                transition: 'color 0.22s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}