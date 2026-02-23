/**
 * Voice-Einstellungen (localStorage)
 */
const KEY = 'fake-discord-voice-settings'

export interface VoiceSettings {
  inputDeviceId: string
  outputDeviceId: string
  inputVolume: number
  outputVolume: number
  autoSensitivity: boolean
  noiseSuppression: 'none' | 'krisp' | 'standard'
  recordingProfile: 'voice-isolation' | 'studio' | 'custom'
}

const defaults: VoiceSettings = {
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  inputVolume: 100,
  outputVolume: 100,
  autoSensitivity: true,
  noiseSuppression: 'standard',
  recordingProfile: 'custom',
}

export function getVoiceSettings(): VoiceSettings {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) }
    }
  } catch {}
  return { ...defaults }
}

export function setVoiceSettings(partial: Partial<VoiceSettings>) {
  const current = getVoiceSettings()
  const next = { ...current, ...partial }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
