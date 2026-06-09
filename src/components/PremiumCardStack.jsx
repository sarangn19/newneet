import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getModules } from '../data/subjects';

const DEFAULT_CARDS = [
  { chapter: "Chapter 1", title: "What is living?" },
  { chapter: "Chapter 2", title: "How to group?" },
  { chapter: "Chapter 3", title: "Green Life?" },
];

const swipeVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 400 : -400,
    opacity: 0,
    scale: 0.9,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction) => ({
    x: direction < 0 ? 400 : -400,
    opacity: 0,
    scale: 0.9,
  }),
};

export default function PremiumCardStack({ 
  cards = DEFAULT_CARDS,
  autoScroll = false,
  scrollInterval = 3000,
  onCardClick,
  initialIndex = 0,
  onIndexChange
}) {
  const [[activeIndex, direction], setPage] = useState([initialIndex, 0]);
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const lastScrollTime = useRef(0);

  useEffect(() => {
    setPage([initialIndex, 0]);
  }, [initialIndex]);

  useEffect(() => {
    onIndexChange?.(activeIndex);
  }, [activeIndex, onIndexChange]);

  const paginate = (newDirection) => {
    const newIndex = activeIndex + newDirection;
    if (newIndex >= 0 && newIndex < cards.length) {
      setPage([newIndex, newDirection]);
    }
  };

  // Touch handlers for swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) paginate(1);  // swipe left = next
      else paginate(-1);          // swipe right = prev
    }
  };

  // Wheel handler
  const handleWheel = useCallback((e) => {
    const now = Date.now();
    if (now - lastScrollTime.current < 400) return;
    if (e.deltaY > 20 || e.deltaX > 20) {
      paginate(1);
      lastScrollTime.current = now;
    } else if (e.deltaY < -20 || e.deltaX < -20) {
      paginate(-1);
      lastScrollTime.current = now;
    }
  }, [activeIndex, cards.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => { e.preventDefault(); handleWheel(e); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [handleWheel]);

  const currentCard = cards[activeIndex];
  const isLocked = currentCard?.locked || false;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        touchAction: 'none',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 8,
      }}
    >
      {/* Page counter */}
      <div style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 16,
        fontWeight: 500,
      }}>
        {activeIndex + 1} / {cards.length}
      </div>

      {/* Carousel with peek */}
      <div style={{
        width: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        height: '78vw',
        maxHeight: 380,
      }}>
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {/* Previous card peek */}
          {activeIndex > 0 && (
            <motion.div
              key={`prev-${activeIndex}`}
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 0.5, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={() => paginate(-1)}
              style={{
                position: 'absolute',
                left: -10,
                width: '20vw',
                height: '70vw',
                maxHeight: 340,
                borderRadius: '0 20px 20px 0',
                background: cards[activeIndex - 1]?.locked
                  ? 'linear-gradient(180deg, #9CA3AF 0%, #6B7280 100%)'
                  : 'linear-gradient(180deg, #8B3DFF 0%, #5B1DBB 100%)',
                cursor: 'pointer',
                zIndex: 1,
              }}
            />
          )}

          {/* Active card */}
          <motion.div
            key={activeIndex}
            custom={direction}
            initial={{ x: direction > 0 ? 300 : -300, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: direction < 0 ? 300 : -300, opacity: 0, scale: 0.9 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            onClick={() => !isLocked && onCardClick?.(activeIndex)}
            style={{
              width: '78vw',
              maxWidth: 360,
              height: '78vw',
              maxHeight: 360,
              flexShrink: 0,
              borderRadius: 28,
              background: isLocked
                ? 'linear-gradient(180deg, #9CA3AF 0%, #6B7280 100%)'
                : 'linear-gradient(180deg, #8B3DFF 0%, #5B1DBB 100%)',
              boxShadow: !isLocked
                ? '0 25px 50px -12px rgba(139,61,255,0.4), 0 10px 20px -5px rgba(0,0,0,0.3)'
                : '0 4px 15px -5px rgba(0,0,0,0.2)',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              cursor: isLocked ? 'default' : 'pointer',
              zIndex: 2,
            }}
          >
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'white',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
              {currentCard?.chapter}
            </span>

            <h3 style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.15,
              marginTop: 12,
              letterSpacing: -0.5,
            }}>
              {currentCard?.title}
            </h3>

            {isLocked && (
              <div style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            )}

            {!isLocked && (
              <div style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{
                  flex: 1,
                  height: 4,
                  background: 'rgba(255,255,255,0.25)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: '65%',
                    background: 'white',
                    borderRadius: 2,
                  }} />
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                  65%
                </span>
              </div>
            )}
          </motion.div>

          {/* Next card peek */}
          {activeIndex < cards.length - 1 && (
            <motion.div
              key={`next-${activeIndex}`}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 0.5, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={() => paginate(1)}
              style={{
                position: 'absolute',
                right: -10,
                width: '20vw',
                height: '70vw',
                maxHeight: 340,
                borderRadius: '20px 0 0 20px',
                background: cards[activeIndex + 1]?.locked
                  ? 'linear-gradient(180deg, #9CA3AF 0%, #6B7280 100%)'
                  : 'linear-gradient(180deg, #8B3DFF 0%, #5B1DBB 100%)',
                cursor: 'pointer',
                zIndex: 1,
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 8,
      }}>
        {cards.slice(0, Math.min(cards.length, 15)).map((_, i) => (
          <div
            key={i}
            onClick={() => setPage([i, i > activeIndex ? 1 : -1])}
            style={{
              width: i === activeIndex ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === activeIndex ? '#8B3DFF' : 'rgba(255,255,255,0.2)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Usage example with actual chapter data
export function ChapterCardStack({ chapters, subjectData, completedModules }) {
  const cards = chapters?.map((chapter, index) => ({
    chapter: `Chapter ${index + 1}`,
    title: chapter.name,
    id: chapter.id,
    ...chapter,
  })) || [];
  
  const navigate = useNavigate();
  
  const handleCardClick = (index) => {
    const chapter = chapters[index];
    if (chapter) {
      navigate(`/subject/${subjectData?.id}/chapter/${chapter.id}`);
    }
  };
  
  return (
    <PremiumCardStack 
      cards={cards}
      onCardClick={handleCardClick}
      autoScroll={false}
    />
  );
}
