import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Flame, ClipboardList, BarChart3, BookOpen, Newspaper, Bot } from 'lucide-react';
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
          <motion.nav
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            style={{
              position: 'fixed', bottom: 20, left: 0, right: 0, zIndex: 100,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              padding: '0 16px',
              pointerEvents: 'none',
            }}>
            <div style={{
              display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              padding: 16,
              width: '100%', maxWidth: 388, height: 76,
              background: 'linear-gradient(90deg, #8A38F5 0%, #269ADE 100%)',
              boxShadow: '0px 0px 115px rgba(0,0,0,0.3)',
              borderRadius: 78,
              pointerEvents: 'auto',
            }}>
              {tabs.map((tab, i) => {
                const IconComp = iconMap[tab.icon];
                return (
                  <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} style={{
                    textDecoration: 'none', WebkitTapHighlightColor: 'transparent', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', width: 44, height: 44, borderRadius: 86,
                  }}>
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <div style={{
                            position: 'absolute', width: 60.9, height: 60.9,
                            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            background: '#FFFFFF', borderRadius: '50%',
                          }} />
                        )}
                        <div style={{
                          width: 44, height: 44, borderRadius: 86,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', zIndex: 1,
                        }}>
                          <IconComp size={20}
                            color={isActive ? '#000000' : '#FFFFFF'}
                          />
                        </div>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </motion.nav>
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
