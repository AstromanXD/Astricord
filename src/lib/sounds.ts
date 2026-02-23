/**
 * Kurze Sounds für Voice-Aktionen und Nachrichten (Web Audio API, keine externen Dateien)
 */
import { getUserSettings } from './userSettings'

let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) audioContext = new AudioContext()
  return audioContext
}

function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine', volume = 0.15) {
  const ctx = getContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq
    osc.type = type
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000)
  } catch (_) {}
}

/** Sound beim Voice-Beitritt (aufsteigend) */
export function playSoundVoiceJoin() {
  if (getUserSettings().joinSound === 'off') return
  const ctx = getContext()
  if (!ctx) return
  playTone(440, 80)
  setTimeout(() => playTone(554, 80), 60)
  setTimeout(() => playTone(659, 100), 120)
}

/** Sound beim Voice-Verlassen (absteigend) */
export function playSoundVoiceLeave() {
  if (getUserSettings().leaveSound === 'off') return
  playTone(659, 80)
  setTimeout(() => playTone(554, 80), 60)
  setTimeout(() => playTone(440, 100), 120)
}

/** Sound beim Mikrofon stummschalten */
export function playSoundMute() {
  playTone(330, 120, 'sine', 0.12)
}

/** Sound beim Mikrofon-Stummschaltung aufheben */
export function playSoundUnmute() {
  playTone(523, 120, 'sine', 0.12)
}

/** Sound bei neuer Nachricht */
export function playSoundMessage() {
  if (getUserSettings().messageSound === 'off') return
  playTone(880, 60)
  setTimeout(() => playTone(1109, 80), 80)
}
