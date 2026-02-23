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
  // Video
  cameraEnabled: boolean
  cameraDeviceId: string
  // Streaming
  streamQuality: 'auto' | '720p30' | '1080p30' | '1080p60'
  // Erweitert
  echoCancellation: 'auto' | 'off'
  audioSubsystem: 'default'
}

const defaults: VoiceSettings = {
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  inputVolume: 100,
  outputVolume: 100,
  autoSensitivity: true,
  noiseSuppression: 'standard',
  recordingProfile: 'custom',
  cameraEnabled: false,
  cameraDeviceId: 'default',
  streamQuality: 'auto',
  echoCancellation: 'auto',
  audioSubsystem: 'default',
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
