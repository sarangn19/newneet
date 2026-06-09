import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, Users } from 'lucide-react'
import LeaderboardPodium from '../components/LeaderboardPodium'

import useStore from '../store/useStore'
import { useAuth } from '../lib/useAuth'
import { useBattle } from '../lib/useBattle'
import { supabase } from '../lib/supabase'
import useSound from '../lib/useSound'

const AVATAR_COLORS = [
  'linear-gradient(135deg, var(--accent), #FB923C)',
  'linear-gradient(135deg, #A8E6CF, #7ECBA1)',
  'linear-gradient(135deg, #FFB3BA, #FF8A95)',
  'linear-gradient(135deg, #BAE1FF, #80C5F0)',
  'linear-gradient(135deg, #D4A5FF, #B87CE6)',
  'linear-gradient(135deg, #FFD700, #FFC107)',
  'linear-gradient(135deg, #84FAB0, #8FD3F4)',
  'linear-gradient(135deg, #FF6B6B, #EE5A24)',
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getStreak() {
  try { return parseInt(localStorage.getItem('battle_streak') || '0') || 0 } catch { return 0 }
}

function setStreak(won) {
  const current = getStreak()
  try { localStorage.setItem('battle_streak', won ? `${current + 1}` : '0') } catch {}
}

// ── Searching Dots ───────────────────────────────────────────
function SearchingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <motion.span key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }}
        />
      ))}
    </span>
  )
}

// ── Countdown Circle ─────────────────────────────────────────
function CountdownCircle({ value }) {
  const r = 18, circ = 2 * Math.PI * r
  const dash = (value / 15) * circ
  return (
    <svg width={48} height={48} viewBox="0 0 48 48">
      <circle cx={24} cy={24} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={4} />
      <circle cx={24} cy={24} r={r} fill="none" stroke="#fff" strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ - dash}
        transform="rotate(-90 24 24)" style={{ transition: 'stroke-dashoffset 0.3s' }} />
      <text x={24} y={24} textAnchor="middle" dominantBaseline="central"
        fill="#fff" fontSize={16} fontWeight={700} fontFamily="inherit">
        {value}
      </text>
    </svg>
  )
}

// ── Avatar component ─────────────────────────────────────────
function Avatar({ emoji, name, size }) {
  const isImage = typeof emoji === 'string' && emoji.startsWith('/')
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: getAvatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700, color: '#fff',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {isImage
        ? <img src={emoji} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : (emoji || name?.[0]?.toUpperCase() || '?')}
    </div>
  )
}

// ── Animated Podium (SVG + avatars) ──────────────────────────
function Podium({ top3 }) {
  if (!top3 || top3.length === 0) return null

  const players = [
    { ...top3[1], rank: 2 },
    { ...top3[2], rank: 3 },
    { ...top3[0], rank: 1 },
  ]

  const blockVariants = {
    hidden: { y: 300, opacity: 0 },
    visible: (custom) => ({
      y: 0, opacity: 1,
      transition: { delay: custom * 0.3, duration: 0.8, ease: "easeOut" },
    }),
  }

  const headVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: (custom) => ({
      scale: 1, opacity: 1,
      transition: { delay: custom * 0.3 + 0.5, type: "spring", stiffness: 200, damping: 15 },
    }),
  }

  const shadowVariants = {
    hidden: { opacity: 0 },
    visible: (custom) => ({
      opacity: 1,
      transition: { delay: custom * 0.3 + 0.2, duration: 1 },
    }),
  }

  const numberVariants = {
    hidden: { opacity: 0 },
    visible: (custom) => ({
      opacity: 1,
      transition: { delay: custom * 0.3 + 0.6, duration: 0.5 },
    }),
  }

  // Head circle centers in SVG viewBox (440x398 after cropping top 80px)
  const HEAD_SIZE = 73
  const avatarPositions = [
    { rank: 2, cx: 332.3, cy: 145, delayIdx: 1 },
    { rank: 3, cx: 100.0, cy: 181.4, delayIdx: 2 },
    { rank: 1, cx: 213.6, cy: 78.4, delayIdx: 0 },
  ]

  return (
    <div style={{
      width: '100%', display: 'flex', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 260, aspectRatio: '440/398' }}>
        <svg width="100%" height="100%" viewBox="0 80 440 398" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
          <g clipPath="url(#clip0_618_274)">
            <path d="M0 0H440V446C440 463.673 425.673 478 408 478H32C14.3269 478 0 463.673 0 446V0Z" fill="#F8F7F4"/>

            {/* 2nd Place - right */}
            <motion.path variants={shadowVariants} custom={1} initial="hidden" animate="visible"
              d="M368.167 281.502L400 294.852V342.087H250.078V281.502H368.167Z" fill="#9A9A9A" fillOpacity="0.5"/>
            <motion.g variants={blockVariants} custom={1} initial="hidden" animate="visible" filter="url(#filter0_d_618_274)">
              <rect x="280" y="295.543" width="120" height="250.179" fill="#FFDDB7"/>
            </motion.g>
            <motion.path variants={numberVariants} custom={1} initial="hidden" animate="visible"
              d="M317.477 432.937C319.653 431.209 320.645 430.409 320.453 430.537C326.725 425.353 331.653 421.097 335.237 417.769C338.885 414.441 341.957 410.953 344.453 407.305C346.949 403.657 348.197 400.105 348.197 396.649C348.197 394.025 347.589 391.977 346.373 390.505C345.157 389.033 343.333 388.297 340.901 388.297C338.469 388.297 336.549 389.225 335.141 391.081C333.797 392.873 333.125 395.433 333.125 398.761H317.285C317.413 393.321 318.565 388.777 320.741 385.129C322.981 381.481 325.893 378.793 329.477 377.065C333.125 375.337 337.157 374.473 341.573 374.473C349.189 374.473 354.917 376.425 358.757 380.329C362.661 384.233 364.613 389.321 364.613 395.593C364.613 402.441 362.277 408.809 357.605 414.697C352.933 420.521 346.981 426.217 339.749 431.785H365.669V445.129H317.477V432.937Z" fill="var(--accent)"/>

            {/* 3rd Place - left */}
            <motion.path variants={shadowVariants} custom={2} initial="hidden" animate="visible"
              d="M73.3008 317.494L41.4683 330.843V378.078H191.39V317.494H73.3008Z" fill="#9A9A9A" fillOpacity="0.5"/>
            <motion.g variants={blockVariants} custom={2} initial="hidden" animate="visible" filter="url(#filter1_d_618_274)">
              <rect x="40" y="332.087" width="120" height="250.179" fill="#FFDDB7"/>
            </motion.g>
            <motion.path variants={numberVariants} custom={2} initial="hidden" animate="visible"
              d="M82.9854 389.696C83.2414 382.848 85.4814 377.568 89.7054 373.856C93.9294 370.144 99.6574 368.288 106.889 368.288C111.689 368.288 115.785 369.12 119.177 370.784C122.633 372.448 125.225 374.72 126.953 377.6C128.745 380.48 129.641 383.712 129.641 387.296C129.641 391.52 128.585 394.976 126.473 397.664C124.361 400.288 121.897 402.08 119.081 403.04V403.424C122.729 404.64 125.609 406.656 127.721 409.472C129.833 412.288 130.889 415.904 130.889 420.32C130.889 424.288 129.961 427.808 128.105 430.88C126.313 433.888 123.657 436.256 120.137 437.984C116.681 439.712 112.553 440.576 107.753 440.576C100.073 440.576 93.9294 438.688 89.3214 434.912C84.7774 431.136 82.3774 425.44 82.1214 417.824H98.0574C98.1214 420.64 98.9214 422.88 100.457 424.544C101.993 426.144 104.233 426.944 107.177 426.944C109.673 426.944 111.593 426.24 112.937 424.832C114.345 423.36 115.049 421.44 115.049 419.072C115.049 416 114.057 413.792 112.073 412.448C110.153 411.04 107.049 410.336 102.761 410.336H99.6894V396.992H102.761C106.025 396.992 108.649 396.448 110.633 395.36C112.681 394.208 113.705 392.192 113.705 389.312C113.705 387.008 113.065 385.216 111.785 383.936C110.505 382.656 108.745 382.016 106.505 382.016C104.073 382.016 102.249 382.752 101.033 384.224C99.8814 385.696 99.2094 387.52 99.0174 389.696H82.9854Z" fill="var(--accent)"/>

            {/* 1st Place - center */}
            <motion.path variants={shadowVariants} custom={0} initial="hidden" animate="visible"
              d="M254.521 224.959L280 238.308V285.544L160 239.865L178.823 224.959H254.521Z" fill="#9A9A9A" fillOpacity="0.48"/>
            <motion.g variants={blockVariants} custom={0} initial="hidden" animate="visible"
              filter="url(#filter2_d_618_274)">
              <rect x="160" y="239" width="120" height="250.179" fill="#FFB980"/>
            </motion.g>
            <motion.path variants={numberVariants} custom={0} initial="hidden" animate="visible"
              d="M202.728 345.577V327.913H232.296V398.089H212.616V345.577H202.728Z" fill="var(--accent)"/>
          </g>
          <defs>
            <filter id="filter0_d_618_274" x="269.4" y="284.943" width="141.2" height="271.379" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
              <feOffset/><feGaussianBlur stdDeviation="5.3"/>
              <feComposite in2="hardAlpha" operator="out"/>
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_618_274"/>
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_618_274" result="shape"/>
            </filter>
            <filter id="filter1_d_618_274" x="29.4" y="321.487" width="141.2" height="271.379" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
              <feOffset/><feGaussianBlur stdDeviation="5.3"/>
              <feComposite in2="hardAlpha" operator="out"/>
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_618_274"/>
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_618_274" result="shape"/>
            </filter>
            <filter id="filter2_d_618_274" x="143.1" y="222.1" width="153.8" height="283.979" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
              <feOffset/><feGaussianBlur stdDeviation="8.45"/>
              <feComposite in2="hardAlpha" operator="out"/>
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_618_274"/>
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_618_274" result="shape"/>
            </filter>
            <clipPath id="clip0_618_274">
              <path d="M0 0H440V446C440 463.673 425.673 478 408 478H32C14.3269 478 0 463.673 0 446V0Z" fill="white"/>
            </clipPath>
          </defs>
        </svg>

        {/* Player avatars overlaid on head positions */}
        {avatarPositions.map((pos) => {
          const player = players.find(p => p.rank === pos.rank)
          if (!player) return null
          const szPct = (HEAD_SIZE / 440) * 100
          return (
            <div key={pos.rank}>
              {pos.rank === 1 && (
                <div style={{
                  position: 'absolute',
                  left: `${(pos.cx / 440) * 100}%`,
                  top: `${(pos.cy / 398) * 100 - 10}%`,
                  marginLeft: `${-szPct / 2}%`,
                  width: 'clamp(16px, 5vw, 28px)',
                  height: 'clamp(16px, 5vw, 30px)',
                  pointerEvents: 'none',
                }}>
                  <img src="/icons/three glowing stars.png" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              )}
              <motion.div
                custom={pos.delayIdx}
                variants={headVariants}
                initial="hidden"
                animate="visible"
                whileTap={{ scale: 1.1 }}
                style={{
                  position: 'absolute',
                  left: `${(pos.cx / 440) * 100}%`,
                  top: `${(pos.cy / 398) * 100}%`,
                  marginLeft: `${-szPct / 2}%`,
                  marginTop: `${-szPct / 2}%`,
                  width: `${szPct}%`,
                  paddingBottom: `${szPct}%`,
                  borderRadius: '50%',
                  background: getAvatarColor(player.name),
                  overflow: 'hidden',
                  boxShadow: 'none',
                }}
              >
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(14px, 4vw, 22px)', fontWeight: 700, color: '#fff' }}>
                  {player.name?.[0]?.toUpperCase() || '?'}
                </span>
              </motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Countdown 3-2-1 component ────────────────────────────────
const RANKS = [
  { name: 'Scout', min: 0 },
  { name: 'Warrior', min: 15 },
  { name: 'Champion', min: 30 },
  { name: 'Legend', min: 50 },
]

function getRankFromWins(wins) {
  return [...RANKS].reverse().find(r => wins >= r.min) || RANKS[0]
}

function getRankFromLevel(level) {
  if (!level || level <= 3) return RANKS[0]
  if (level <= 6) return RANKS[1]
  if (level <= 9) return RANKS[2]
  return RANKS[3]
}

function CountdownFrom3() {
  const [count, setCount] = useState(3)
  const [isFinished, setIsFinished] = useState(false)
  useEffect(() => {
    if (count > 0) {
      const t = setTimeout(() => setCount(count - 1), 1000)
      return () => clearTimeout(t)
    } else {
      setIsFinished(true)
    }
  }, [count])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {!isFinished ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 12, letterSpacing: 0.5 }}>
            Starting in...
          </div>
          <motion.div
            key={count}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            style={{ fontSize: 72, fontWeight: 900, color: 'var(--primary-dark)', lineHeight: 1 }}
          >
            {count}
          </motion.div>
        </div>
      ) : (
        <motion.div
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={{ fontSize: 60, fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}
        >
          Go!
        </motion.div>
      )}
    </div>
  )
}

// ── Match Found Screen ──────────────────────────────────────
function MatchFoundScreen({ user, opponent, myScore, oppScore, stats }) {
  const play = useSound()
  const [flash, setFlash] = useState(false)

  useEffect(() => { play('intro') }, [])

  const handleClash = useCallback(() => {
    play('clash')
    setFlash(true)
    setTimeout(() => setFlash(false), 400)
  }, [play])

  const playerRank = getRankFromWins(stats?.battlesWon || 0)
  const oppRank = getRankFromLevel(opponent?.level || 1)

  const userAvatar = user?.avatar?.startsWith('/') ? user.avatar : null
  const oppAvatar = opponent?.avatar?.startsWith('/') ? opponent.avatar : null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'relative', overflow: 'hidden',
      background: 'var(--page-bg)',
      minHeight: '100vh',
    }}>
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 50, pointerEvents: 'none' }}
          />
        )}
      </AnimatePresence>

      {/* "Match Found" header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{ paddingTop: 60, paddingBottom: 24, zIndex: 10, textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.5 }}>Match Found</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500, marginTop: 4 }}>Prepare for battle!</div>
      </motion.div>

      {/* Player cards area */}
      <div style={{ flex: 1, width: '100%', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Player card (top) */}
        <motion.div
          initial={{ x: -80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120, damping: 20 }}
          style={{
            background: '#fff', borderRadius: 20,
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            border: '3px solid #FF9944', overflow: 'hidden',
            background: '#FB923C',
          }}>
            {userAvatar
              ? <img src={userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={32} color="#fff" />
                </div>}
          </div>
          {/* Name */}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{user.name}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>YOU</div>
        </motion.div>

        {/* VS + Countdown center */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '20px 0', zIndex: 20,
        }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.4 }}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: '#1a1a1a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, fontWeight: 900, color: '#fff',
              marginBottom: 12,
            }}>VS</motion.div>
          <CountdownFrom3 />
        </div>

        {/* Opponent card (bottom) */}
        <motion.div
          initial={{ x: 80, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 120, damping: 20 }}
          style={{
            background: '#fff', borderRadius: 20,
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            border: '3px solid rgba(255,255,255,0.3)', overflow: 'hidden',
            background: '#78716C',
          }}>
            {oppAvatar
              ? <img src={oppAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={32} color="#fff" />
                </div>}
          </div>
          {/* Name */}
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a' }}>{opponent?.name || '???'}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>OPP</div>
        </motion.div>
      </div>
    </div>
  )
}

// ── Fighter Card (warm card style) ──────────────────────────
function FighterBanner({ side, avatar, name, rank }) {
  const isLeft = side === 'left'
  return (
    <motion.div
      initial={{ x: isLeft ? -120 : 120, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.25 }}
      style={{
        flex: 1, position: 'relative',
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: '18px 10px 14px',
        display: 'flex', flexDirection: 'column', alignItems: isLeft ? 'flex-start' : 'flex-end',
      }}>
      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${isLeft ? 'var(--primary)' : 'var(--yellow)'}, ${isLeft ? 'var(--yellow)' : 'var(--primary)'})`,
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }} />

      {/* Avatar */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.45 }}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: getAvatarColor(name),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflow: 'hidden', flexShrink: 0,
        }}>
        {avatar?.startsWith('/')
          ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (avatar || name?.[0]?.toUpperCase() || '?')}
      </motion.div>

      {/* Name */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 8, lineHeight: 1.2 }}>
        {name}
      </motion.div>

      {/* Rank badge */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'var(--primary-light)',
          borderRadius: 'var(--radius-pill)',
          padding: '3px 10px', marginTop: 6,
        }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)' }}>
          {rank?.name || 'Rookie'}
        </span>
      </motion.div>
    </motion.div>
  )
}

// ── VS Badge (accent style) ─────────────────────────────────
function VsBadge({ onClash }) {
  const [clashed, setClashed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => { setClashed(true); onClash?.() }, 700)
    return () => clearTimeout(t)
  }, [])
  return (
    <motion.div
      initial={{ scale: 0, rotate: -90 }}
      animate={clashed ? { scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] } : { scale: 1, rotate: 0 }}
      transition={clashed
        ? { duration: 0.35, ease: 'easeOut' }
        : { type: 'spring', stiffness: 200, damping: 14, delay: 0.6 }}
      style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: -0.5,
        boxShadow: '0 2px 8px rgba(217,119,6,0.3)',
        position: 'relative', zIndex: 10, flexShrink: 0,
      }}>
      VS
      {clashed && (
        <motion.div
          initial={{ scale: 0.8, opacity: 1 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            border: '2.5px solid var(--primary)',
          }}
        />
      )}
    </motion.div>
  )
}

export default function Battle() {
  const { session } = useAuth()
  const { addXP, addBattleResult, stats, user, setInBattle, setHideNav } = useStore()
  const userId = session?.user?.id

  const examType = useStore(s => s.examType)
  const {
    phase, opponent, questions, myScore, oppScore,
    myCurrent, oppCurrent, searchTime, error,
    startSearch, startAIMatch, cancelSearch, submitAnswer, leaveBattle,
    isAIMatch,
  } = useBattle(userId, user.name, user.level, user.avatar, examType)

  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(15)
  const [resultHandled, setResultHandled] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const timerRef = useRef(null)
  const searchTimerRef = useRef(null)

  // Sync inBattle flag with navbar
  useEffect(() => {
    setInBattle(phase !== 'lobby')
  }, [phase, setInBattle])

  // Reset local state when phase changes
  useEffect(() => {
    if (phase === 'lobby') { setLocalSearching(false); clearTimeout(searchTimerRef.current) }
    if (phase === 'battle') {
      setCurrent(0)
      setSelected(null)
      setSubmitted(false)
      setTimeLeft(15)
      setResultHandled(false)
    }
  }, [phase])

  // Per-question timer
  useEffect(() => {
    if (phase !== 'battle' || questions.length === 0) return
    setTimeLeft(15)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          // Auto-submit wrong answer on timeout
          handleTimeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [current, phase, questions.length])

  // Keyboard shortcuts: 1-4 to select MCQ options
  useEffect(() => {
    if (phase !== 'battle' || questions.length === 0) return
    const onKey = (e) => {
      const n = parseInt(e.key)
      if (n >= 1 && n <= 4) handleSelect(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, questions, current, submitted])

  const handleTimeout = () => {
    if (submitted) return
    setSubmitted(true)
    // Submit a wrong answer (-1), 0 time remaining
    submitAnswer(current, -1, false, 0)
    setTimeout(goNext, 1200)
  }

  const handleSelect = (i) => {
    if (submitted || questions.length === 0) return
    clearInterval(timerRef.current)
    setSelected(i)
    setSubmitted(true)
    const isCorrect = i === questions[current].ans
    submitAnswer(current, i, isCorrect, timeLeft)
    setTimeout(goNext, 1200)
  }

  const goNext = () => {
    if (current + 1 >= questions.length) {
      // We're done — phase will switch to 'result' via realtime
      return
    }
    setCurrent(c => c + 1)
    setSelected(null)
    setSubmitted(false)
  }

  // Handle result — award XP based on points
  useEffect(() => {
    if (phase === 'result' && !resultHandled) {
      setResultHandled(true)
      const won = myScore > oppScore
      if (!isAIMatch) {
        addBattleResult(won)
        setStreak(won)
      }
      // XP: winner gets 100 + bonus for high scores, loser gets 20
      const xpEarned = won ? 100 + Math.round(myScore / 10) : myScore > 0 ? 20 + Math.round(myScore / 20) : 10
      addXP(xpEarned)
    }
  }, [phase, resultHandled, myScore, oppScore, isAIMatch])

  // ════════════════════════════════════════════════════════════
  // LOBBY
  // ════════════════════════════════════════════════════════════
  const [showInfo, setShowInfo] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showArenaList, setShowArenaList] = useState(false)

  useEffect(() => {
    setHideNav(showInfo || showHistory || showArenaList)
  }, [showInfo, showHistory, showArenaList])
  const [leaderboard, setLeaderboard] = useState([])
  const [waitingCount, setWaitingCount] = useState(0)
  const [timeRange, setTimeRange] = useState('weekly')
  const [localSearching, setLocalSearching] = useState(false)
  const TIME_RANGES = [
    { key: 'weekly', label: 'This Week' },
    { key: 'monthly', label: 'This Month' },
    { key: 'alltime', label: 'All Time' },
  ]

  // Fetch leaderboard (monthly wins) and waiting queue count
  useEffect(() => {
    if (!supabase) return
    const fetchData = async () => {
      // Get first day of current month
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      // Leaderboard: count wins from battle_rooms this month
      const { data: rooms } = await supabase
        .from('battle_rooms')
        .select('winner_id, player1_id, player1_name, player1_avatar, player2_id, player2_name, player2_avatar')
        .eq('status', 'finished')
        .not('winner_id', 'is', null)
        .gte('finished_at', monthStart)

      const dummyPlayers = [
        { id: 'd1', name: 'Davis Curtis',   wins: 42 },
        { id: 'd2', name: 'Alena Donin',    wins: 31 },
        { id: 'd3', name: 'Craig Gouse',    wins: 27 },
        { id: 'd4', name: 'Madelyn Dias',   wins: 23 },
        { id: 'd5', name: 'Liam Chen',      wins: 19 },
        { id: 'd6', name: 'Sophia Patel',   wins: 17 },
        { id: 'd7', name: 'Noah Kim',       wins: 14 },
        { id: 'd8', name: 'Emma Johnson',   wins: 12 },
        { id: 'd9', name: 'Oliver Wang',    wins: 9 },
        { id: 'd10', name: 'Ava Martinez',  wins: 7 },
      ]

      if (rooms && rooms.length > 0) {
        const winsMap = {}
        rooms.forEach(r => {
          const wid = r.winner_id
          if (!winsMap[wid]) {
            const name = wid === r.player1_id ? r.player1_name : r.player2_name
            const avatar = wid === r.player1_id ? r.player1_avatar : r.player2_avatar
            winsMap[wid] = { id: wid, name: name || 'Student', avatar: avatar || '', wins: 0 }
          }
          winsMap[wid].wins++
        })
        const realSorted = Object.values(winsMap).sort((a, b) => b.wins - a.wins).slice(0, 10)
        // Merge real + dummy, deduplicate by id
        const merged = [...realSorted]
        dummyPlayers.forEach(d => {
          if (!merged.find(m => m.id === d.id || m.name === d.name)) merged.push(d)
        })
        setLeaderboard(merged.sort((a, b) => b.wins - a.wins))
      } else {
        setLeaderboard(dummyPlayers)
      }

      // Waiting count
      const { count } = await supabase
        .from('matchmaking_queue')
        .select('*', { count: 'exact', head: true })
      setWaitingCount(count || 0)
    }
    fetchData()
    // Refresh every 10s
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [phase])

  // Rank tiers based on wins
  const totalWins = stats.battlesWon
  const ranks = [
    { name: 'Scout', min: 0 },
    { name: 'Warrior', min: 15 },
    { name: 'Champion', min: 30 },
    { name: 'Legend', min: 50 },
  ]
  const currentRank = [...ranks].reverse().find(r => totalWins >= r.min) || ranks[0]
  const nextRank = ranks[ranks.indexOf(currentRank) + 1]
  const rankProgress = nextRank
    ? (totalWins - currentRank.min) / (nextRank.min - currentRank.min)
    : 1

  // Find user entry in leaderboard
  // Ensure user always appears in leaderboard
  const userInLB = leaderboard.find(e => e.id === userId)
  const leaderboardWithUser = userInLB
    ? leaderboard
    : [...leaderboard, { id: userId, name: user.name || 'You', wins: Math.min(stats.battlesWon || 0, 5) }]
  const userRank = userInLB ? leaderboard.indexOf(userInLB) + 1 : null

  if (phase === 'lobby') {
    const userOriginal = leaderboard.find(e => e.id === userId)
    const userRankNum = userOriginal ? leaderboard.indexOf(userOriginal) + 1 : null
    const totalWins = stats.battlesWon || 0
    const totalBattles = stats.battlesTotal || 0
    const winRate = totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0
    const streak = getStreak()

    const TIERS = [
      { name: '🥉 Bronze III', icon: 'bronze-3', wins: 0, group: 0 },
      { name: '🥉 Bronze II', icon: 'bronze-2', wins: 10, group: 0 },
      { name: '🥉 Bronze I', icon: 'bronze-1', wins: 20, group: 0 },
      { name: '🥈 Silver III', icon: 'silver-3', wins: 30, group: 1 },
      { name: '🥈 Silver II', icon: 'silver-2', wins: 40, group: 1 },
      { name: '🥈 Silver I', icon: 'silver-1', wins: 50, group: 1 },
      { name: '🥇 Gold III', icon: 'gold-3', wins: 60, group: 2 },
      { name: '🥇 Gold II', icon: 'gold-2', wins: 70, group: 2 },
      { name: '🥇 Gold I', icon: 'gold-1', wins: 80, group: 2 },
      { name: '💎 Platinum III', icon: 'platinum-3', wins: 90, group: 3 },
      { name: '💎 Platinum II', icon: 'platinum-2', wins: 100, group: 3 },
      { name: '💎 Platinum I', icon: 'platinum-1', wins: 110, group: 3 },
      { name: '👑 Diamond III', icon: 'diamond-3', wins: 120, group: 4 },
      { name: '👑 Diamond II', icon: 'diamond-2', wins: 130, group: 4 },
      { name: '👑 Diamond I', icon: 'diamond-1', wins: 140, group: 4 },
      { name: '🔥 Master', icon: 'master', wins: 150, group: 5 },
      { name: '⚡ Grandmaster', icon: 'grandmaster', wins: 160, group: 6 },
      { name: '🏆 Champion', icon: 'champion', wins: 170, group: 7 },
      { name: '🌟 Legend', icon: 'legend', wins: 180, group: 8 },
      { name: '♾️ Infinity', icon: 'infinity', wins: 190, group: 9 },
    ]
    const currentTierIdx = Math.min(
      TIERS.findLastIndex(t => totalWins >= t.wins),
      TIERS.length - 1
    )
    const tier = TIERS[currentTierIdx]
    const nextTier = TIERS[currentTierIdx + 1]
    const filledBars = Math.min(Math.floor(totalWins / 20), 10)
    const partialBar = totalWins % 20

    return (<>
    <div style={{
      background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', paddingBottom: 100, overflowY: 'auto',
      fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      {/* Top section — stays at top */}
      <div>
      {/* 10-win progress */}
      <div style={{ width: '100%', maxWidth: 400, padding: '24px 20px 12px' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 8, borderRadius: 4, position: 'relative', overflow: 'hidden',
              background: i < filledBars ? '#E58A24' : '#E5E7EB',
              opacity: i < filledBars || i === filledBars ? 1 : 0.4,
              boxShadow: 'none',
            }}>
              {i === filledBars && (
                <div style={{
                  width: `${(partialBar / 20) * 100}%`, height: '100%',
                  background: '#E58A24', borderRadius: 4,
                  transition: 'width 0.3s',
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tier info */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#E58A24', textTransform: 'uppercase', letterSpacing: 1 }}>
          Tier {currentTierIdx + 1} / 20
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a1a', marginTop: 2 }}>
          {tier.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          <Users size={14} color="#9CA3AF" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>{waitingCount} Online</span>
        </div>
      </div>
      </div>

      {/* Center section — fills remaining space */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>

      {/* Tier showcase card */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        style={{ width: '100%', maxWidth: 400, padding: '0 20px', position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 220 }}>
          {/* Tier image */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '440/470', cursor: 'pointer' }} onClick={() => setShowArenaList(true)}>
            <img src={`/tier%20icons/${encodeURIComponent(tier.icon)}.png`} alt={tier.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.src = '/arena%201%20starter%20ground.png' }} />
          </div>
        </div>

        {/* Left floating button — Leaderboard */}
        <div style={{
          position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10,
        }}>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => setShowInfo(true)}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: '#fff', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', overflow: 'hidden',
            }}>
            <img src="/icons/leaderboard icon.png" alt="Leaderboard"
              style={{ width: 48, height: 48, objectFit: 'contain' }} />
          </motion.button>
        </div>

        {/* Right floating button — Battle History */}
        <div style={{
          position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10,
        }}>
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => setShowHistory(true)}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: '#fff', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', overflow: 'hidden',
            }}>
            <img src="/icons/battle history.png" alt="Battle History"
              style={{ width: 48, height: 48, objectFit: 'contain' }} />
          </motion.button>
        </div>
      </motion.div>

      {/* Action buttons */}
      <div style={{ width: '100%', maxWidth: 400, padding: '20px 20px 0', display: 'flex', gap: 12 }}>
        <button
          onClick={startAIMatch}
          style={{
            flex: 1, padding: '16px 0',
            background: '#fff', color: '#1a1a1a',
            fontWeight: 800, fontSize: 15,
            border: '2px solid #E5E7EB', borderRadius: 16,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all 0.15s',
          }}>
          AI Battle
        </button>
        <button
          onClick={() => { setLocalSearching(true); searchTimerRef.current = setTimeout(() => startSearch(), 600) }}
          disabled={localSearching}
          style={{
            flex: 1.3, padding: '16px 0',
            background: localSearching ? '#f5f5f5' : '#E58A24',
            color: localSearching ? '#999' : '#fff',
            fontWeight: 800, fontSize: 15,
            border: 'none', borderRadius: 16,
            cursor: localSearching ? 'default' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: localSearching ? 'none' : '0 4px 0 #BA6B1A',
            opacity: localSearching ? 0.6 : 1,
            transition: 'all 0.15s',
          }}>
          {localSearching ? 'Searching...' : 'Find Opponent'}
        </button>
      </div>
      </div>
    </div>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowInfo(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 400, background: '#fff',
                borderRadius: '24px 24px 0 0', padding: '24px 20px 40px',
                maxHeight: '70vh', overflowY: 'auto',
              }}>
              <div style={{ width: 40, height: 4, background: '#D1D5DB', borderRadius: 99, margin: '0 auto 20px' }} />
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a1a', marginBottom: 16 }}>Leaderboard</div>
              <LeaderboardPodium
                winners={leaderboard.map((e, i) => ({ ...e, rank: i + 1 }))}
                userRank={userRankNum || '–'}
                userWins={totalWins}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowHistory(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 400, background: '#fff',
                borderRadius: '24px 24px 0 0', padding: '24px 20px 40px',
                maxHeight: '70vh', overflowY: 'auto',
              }}>
              <div style={{ width: 40, height: 4, background: '#D1D5DB', borderRadius: 99, margin: '0 auto 20px' }} />
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a1a', marginBottom: 16 }}>Battle History</div>
              <p style={{ color: '#6B7280', fontSize: 14, textAlign: 'center' }}>Coming soon</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arena List Modal */}
      <AnimatePresence>
        {showArenaList && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowArenaList(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 400, background: '#fff',
                borderRadius: '24px 24px 0 0', padding: '24px 20px 40px',
                maxHeight: '75vh', overflowY: 'auto',
              }}>
              <div style={{ width: 40, height: 4, background: '#D1D5DB', borderRadius: 99, margin: '0 auto 20px' }} />
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1a1a1a', marginBottom: 16 }}>All Tiers</div>
              {TIERS.map((t, i) => {
                const unlocked = totalWins >= t.wins
                const isCurrent = i === currentTierIdx
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', marginBottom: 8,
                    borderRadius: 16,
                    background: isCurrent ? '#FFF5EB' : unlocked ? '#F9FAFB' : '#F3F4F6',
                    border: isCurrent ? '1.5px solid #E58A24' : '1px solid transparent',
                    opacity: unlocked ? 1 : 0.5,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: '#E0E3A1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, overflow: 'hidden',
                    }}>
                      <img src={`/tier%20icons/${encodeURIComponent(t.icon)}.png`}
                        alt={t.name}
                        style={{ width: 32, height: 32, objectFit: 'contain' }}
                        onError={e => { e.target.style.display = 'none'; e.target.parentElement.textContent = t.name.match(/^(\S+)/)?.[1] || '🏟️' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Tier {i + 1}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a', marginTop: 1 }}>{t.name}</div>
                      {isCurrent && nextTier && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#E58A24', marginTop: 2 }}>
                          {nextTier.wins - totalWins} wins to next
                        </div>
                      )}
                    </div>
                    {unlocked && !isCurrent && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                )
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )}
  // ════════════════════════════════════════════════════════════
  // SEARCHING
  // ════════════════════════════════════════════════════════════
  if (phase === 'searching') return (
    <div className="screen" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      <div style={{ position: 'relative', marginBottom: 40 }}>
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          style={{
            position: 'absolute', inset: -20, borderRadius: '50%',
            border: '3px solid rgba(0,0,0,0.08)',
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.8, delay: 0.4 }}
          style={{
            position: 'absolute', inset: -10, borderRadius: '50%',
            border: '3px solid rgba(0,0,0,0.06)',
          }}
        />
        <Avatar emoji={user.avatar} size={96} name={user.name} />
      </div>

      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
        Finding Opponent
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 4 }}>
        Waiting for a real player to join...
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>
        {searchTime}s elapsed
      </div>
      <SearchingDots />

      <div style={{ width: '100%', marginTop: 40, textAlign: 'center' }}>
        <div style={{
          background: 'var(--surface-alt)', borderRadius: 12,
          padding: '12px 16px', fontSize: 13, color: 'var(--text-3)',
        }}>
          Searching matchmaking queue...
        </div>
      </div>

      <button className="back-btn-dark" onClick={cancelSearch} style={{ marginTop: 32 }}>
        Cancel
      </button>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // FOUND — opponent reveal with clash
  // ════════════════════════════════════════════════════════════
  if (phase === 'found') return <MatchFoundScreen user={user} opponent={opponent} myScore={myScore} oppScore={oppScore} stats={stats} />

  // ════════════════════════════════════════════════════════════
  // BATTLE
  // ════════════════════════════════════════════════════════════
  if (phase === 'battle' && questions.length > 0 && current < questions.length) {
    const q = questions[current]
    const progress = (current / questions.length) * 100
    return (
      <div className="screen" style={{ background: 'var(--page-bg)' }}>
        {/* Battle header */}
        <div style={{ background: 'var(--card-bg)', padding: '48px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          {/* Back button row */}
          <div style={{ marginBottom: 12 }}>
            <button style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: 'var(--surface-alt)', color: 'var(--text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }} onClick={() => setConfirmLeave(true)}>
              <ChevronLeft size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <Avatar emoji={user.avatar} size={52} name={user.name} />
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{myScore}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <CountdownCircle value={timeLeft} />
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>Q{current + 1}/5</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Avatar emoji={opponent?.avatar || ''} size={52} name={opponent?.name} />
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{oppScore}</div>
            </div>
          </div>

          {/* Opponent progress indicator */}
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <span style={{
              background: 'var(--surface-alt)', borderRadius: 8,
              padding: '3px 10px', fontSize: 11, color: 'var(--text-2)',
            }}>
              {opponent?.name}: Q{Math.min(oppCurrent + 1, 5)}/5
            </span>
          </div>
        </div>

        <div style={{ padding: '14px 16px 0', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }}
                style={{ height: '100%', background: 'var(--primary)', borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>{current + 1}/5</span>
          </div>
        </div>

        <AnimatePresence>
          <motion.div key={current} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            style={{ padding: '14px 16px 100px' }}>
            {/* Question card */}
            <div style={{ background: '#fff', borderRadius: 20, padding: '18px 16px', marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,153,68,0.1)', borderRadius: 8, padding: '2px 10px', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#FF9944' }}>Q{current + 1}</span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.65, color: '#1a1a1a', margin: 0 }}>{q.q}</p>
            </div>
            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {q.options.map((opt, i) => {
                const isCorrect = i === q.ans
                const isWrong = submitted && i === selected && !isCorrect
                const isRight = submitted && isCorrect
                const isSel = !submitted && selected === i
                return (
                  <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => handleSelect(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 20, border: 'none',
                      cursor: submitted ? 'default' : 'pointer',
                      fontFamily: 'inherit', textAlign: 'left', width: '100%',
                      background: isRight ? '#d1fae5' : isWrong ? '#fee2e2' : isSel ? '#fff7ed' : '#fff',
                      boxShadow: isSel ? '0 0 0 2px #FF9944' : isRight ? '0 0 0 2px #10b981' : isWrong ? '0 0 0 2px #ef4444' : '0 2px 8px rgba(0,0,0,0.08)',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isRight ? '#10b981' : isWrong ? '#ef4444' : isSel ? '#FF9944' : '#F3F4F6',
                      color: (isRight || isWrong || isSel) ? '#fff' : '#6B7280',
                      fontSize: 13, fontWeight: 800,
                    }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: isRight ? '#065f46' : isWrong ? '#7f1d1d' : '#1a1a1a', lineHeight: 1.4 }}>{opt}</span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {confirmLeave && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 24, padding: '28px 24px', maxWidth: 300, width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Leave Battle?</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, lineHeight: 1.6 }}>You'll lose your progress in this match.</div>
              <button onClick={() => { clearInterval(timerRef.current); leaveBattle() }}
                style={{
                  width: '100%', padding: '14px 0', marginBottom: 10,
                  background: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: 16,
                  fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 0 #b91c1c',
                }}>
                Leave Match
              </button>
              <button onClick={() => setConfirmLeave(false)}
                style={{
                  width: '100%', padding: '14px 0',
                  background: '#F3F4F6', color: '#1a1a1a',
                  border: 'none', borderRadius: 16,
                  fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 0 #d1d5db',
                }}>
                Keep Playing
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Waiting for questions to load
  if (phase === 'battle' && questions.length === 0) {
    return (
      <div className="screen" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Loading questions...</div>
        <SearchingDots />
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════
  // RESULT
  // ════════════════════════════════════════════════════════════
  if (phase === 'result') {
    const won = myScore > oppScore
    const tied = myScore === oppScore
    return (
      <div className="screen-white">
        <div className="page-header" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>{won ? '' : tied ? '' : ''}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'white', marginBottom: 4 }}>
            {won ? 'Victory!' : tied ? 'Draw!' : 'Defeat!'}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
            {won ? 'You crushed it!' : tied ? 'So close!' : 'Better luck next time!'}
          </div>
        </div>

        <div style={{ padding: '20px 16px' }}>
          <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32, padding: '8px 0' }}>
              <div>
                <Avatar emoji={user.avatar} size={56} name={user.name} />
                <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--primary-alt)', marginTop: 6 }}>{myScore}<span style={{ fontSize: 14, fontWeight: 600 }}> pts</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{user.name}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-3)' }}>vs</div>
              <div>
                <Avatar emoji={opponent?.avatar || ''} size={56} name={opponent?.name} />
                <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--error)', marginTop: 6 }}>{oppScore}<span style={{ fontSize: 14, fontWeight: 600 }}> pts</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{opponent?.name}</div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--primary-alt-light)', border: '1.5px solid var(--primary-alt)',
            borderRadius: 12, padding: '12px 16px', textAlign: 'center',
            fontSize: 15, fontWeight: 700, color: 'var(--primary-alt)', marginBottom: 24,
          }}>
            {(() => {
              const xp = won ? 100 + Math.round(myScore / 10) : myScore > 0 ? 20 + Math.round(myScore / 20) : 10
              return won ? `+${xp} XP earned!` : tied ? `+${xp} XP earned!` : `+${xp} XP earned!`
            })()}
          </div>

          <button className="btn btn-primary" style={{ marginBottom: 10 }} onClick={isAIMatch ? startAIMatch : startSearch}>
            Play Again
          </button>
          <button className="btn btn-secondary" onClick={leaveBattle}>
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  return null
}

