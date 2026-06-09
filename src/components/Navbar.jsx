import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Flame, ClipboardList, BarChart3, BookOpen, Newspaper, Bot, Circle } from 'lucide-react';
import useStore from '../store/useStore';

const iconMap = {
  Home, Flame, ClipboardList, BarChart3, BookOpen, Newspaper, Bot,
};

const neetImages = {
  Home: '/icons/home.png',
  Flame: '/icons/battle.png',
  ClipboardList: '/icons/mcq.png',
  BarChart3: '/icons/statistics.png',
};

const neetTabs = [
  { to: '/',        icon: 'Home',          label: 'Home' },
  { to: '/battle',  icon: 'Flame',         label: 'Battle' },
  { to: '/mcq',     icon: 'ClipboardList', label: 'MCQ' },
  { to: '/stats',   icon: 'BarChart3',     label: 'Stats' },
];

const upscTabs = [
  { to: '/',                icon: 'Home',      label: 'Home' },
  { to: '/learn',           icon: 'BookOpen',  label: 'Learn' },
  { to: '/current-affairs', icon: 'Newspaper', label: 'CA' },
  { to: '/ai-chatbot',      icon: 'Bot',       label: 'AI' },
  { to: '/stats',           icon: 'BarChart3', label: 'Stats' },
];

export default function Navbar() {
  const location = useLocation();
  const examType = useStore(s => s.examType) || 'neet';
  const inBattle = useStore(s => s.inBattle);
  const hideNavStore = useStore(s => s.hideNav);
  const isUpsc = examType === 'upsc';
  const tabs = isUpsc ? upscTabs : neetTabs;
  const hideNav = location.pathname.startsWith('/subject/') || hideNavStore;

  if (isUpsc) {
    return (
      <AnimatePresence>
        {!inBattle && !hideNav && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
              display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
              background: 'linear-gradient(180deg, rgba(10,10,15,0) 0%, rgba(10,10,15,0.95) 100%)',
              pointerEvents: 'none',
            }}
          >
            <div style={{
              display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
              padding: '72px 0 28px', gap: 32,
              width: 440, maxWidth: '100%',
              pointerEvents: 'auto',
            }}>
              {tabs.map((tab) => (
                <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} style={{
                  textDecoration: 'none', WebkitTapHighlightColor: 'transparent', fontFamily: 'inherit',
                }}>
                  {({ isActive }) => (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, cursor: 'pointer',
                    }}>
                      <Circle
                        size={24}
                        strokeWidth={2}
                        color={isActive ? '#FFFFFF' : '#606060'}
                        fill={isActive ? '#FFFFFF' : 'none'}
                      />
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // NEET mode — existing style
  return (
    <AnimatePresence>
      {!inBattle && !hideNav && (
        <motion.nav
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          style={{
            display: 'flex', justifyContent: 'space-around', alignItems: 'center',
            height: 56, flexShrink: 0,
            background: 'var(--nav-bg)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '0 4px',
          }}
        >
          {tabs.map((tab) => {
            const IconComp = iconMap[tab.icon];
            return (
              <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 48, height: '100%',
                textDecoration: 'none', position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}>
                {({ isActive }) => (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {isUpsc ? (
                      <IconComp size={24} strokeWidth={isActive ? 2.5 : 1.8}
                        color={isActive ? 'var(--primary)' : 'var(--text-3)'}
                      />
                    ) : (
                      <img src={neetImages[tab.icon]} alt={tab.label}
                        style={{
                          width: 24, height: 24, objectFit: 'contain',
                          filter: isActive ? 'brightness(0) saturate(100%) invert(41%) sepia(27%) saturate(1010%) hue-rotate(212deg) brightness(91%)' : 'brightness(0) saturate(100%) invert(50%)',
                          opacity: isActive ? 1 : 0.5,
                          transition: 'all 0.15s',
                        }}
                      />
                    )}
                    <div style={{
                      fontSize: 10, fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--primary)' : 'var(--text-3)',
                      letterSpacing: '0.02em',
                    }}>
                      {tab.label}
                    </div>
                    {isActive && (
                      <motion.div layoutId="navDot" style={{
                        width: 18, height: 3, borderRadius: 2,
                        background: 'var(--primary)', marginTop: 1,
                      }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
