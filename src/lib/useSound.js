import { useCallback, useRef } from 'react'

function getCtx() {
  const C = window.AudioContext || window.webkitAudioContext
  if (!C) return null
  const ctx = new C()
  return ctx
}

function tone(ctx, freq, duration, type = 'sine', gain = 0.08, delay = 0) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
  g.gain.setValueAtTime(gain, ctx.currentTime + delay)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + duration)
}

export function playSound(sound, ctx) {
  if (!ctx) return
  switch (sound) {
    case 'correct':
      tone(ctx, 523.25, 0.12, 'sine', 0.15, 0)
      tone(ctx, 659.25, 0.12, 'sine', 0.15, 0.08)
      tone(ctx, 783.99, 0.18, 'sine', 0.15, 0.16)
      break
    case 'wrong':
      tone(ctx, 200, 0.15, 'sawtooth', 0.1, 0)
      tone(ctx, 150, 0.2, 'sawtooth', 0.08, 0.1)
      break
    case 'click':
      tone(ctx, 800, 0.04, 'sine', 0.06, 0)
      break
    case 'celebration':
      tone(ctx, 523, 0.15, 'sine', 0.12, 0)
      tone(ctx, 659, 0.15, 'sine', 0.12, 0.1)
      tone(ctx, 784, 0.15, 'sine', 0.12, 0.2)
      tone(ctx, 1047, 0.3, 'sine', 0.15, 0.3)
      break
    case 'sad':
      tone(ctx, 300, 0.2, 'triangle', 0.1, 0)
      tone(ctx, 250, 0.2, 'triangle', 0.08, 0.15)
      tone(ctx, 200, 0.3, 'triangle', 0.06, 0.3)
      break
    case 'intro':
      tone(ctx, 523, 0.3, 'sine', 0.06, 0)
      tone(ctx, 659, 0.3, 'sine', 0.06, 0.12)
      tone(ctx, 784, 0.3, 'sine', 0.06, 0.24)
      tone(ctx, 1047, 0.5, 'sine', 0.08, 0.36)
      break
    case 'clash':
      tone(ctx, 220, 0.25, 'triangle', 0.12, 0)
      tone(ctx, 330, 0.25, 'triangle', 0.08, 0.08)
      tone(ctx, 440, 0.3, 'triangle', 0.06, 0.16)
      break
    default:
      break
  }
}

export default function useSound() {
  const ctxRef = useRef(null)
  const ensure = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = getCtx()
    if (ctxRef.current && ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const play = useCallback((sound) => {
    const ctx = ensure()
    if (ctx) playSound(sound, ctx)
  }, [ensure])

  return play
}
