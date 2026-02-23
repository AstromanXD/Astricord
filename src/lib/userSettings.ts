/**
 * Benutzer-Einstellungen (localStorage)
 * Chat, Hotkeys, Sprache & Zeit, Windows, Streamer, Erweitert, Aktivität
 */
const KEY = 'astricord-user-settings'

export interface UserSettings {
  // Chat
  fontSize: 'small' | 'medium' | 'large'
  showLinkPreview: boolean
  compactMode: boolean

  // Sprache & Zeit
  language: string
  timezone: string

  // Windows (Electron)
  startMinimized: boolean
  minimizeToTray: boolean

  // Streamer-Modus
  streamerMode: boolean

  // Erweitert
  devMode: boolean

  // Aktivität Privatsphäre
  activityVisibility: 'all' | 'friends' | 'none'

  // Töne (Voice)
  joinSound: 'default' | 'off'
  leaveSound: 'default' | 'off'
  messageSound: 'default' | 'off'
}

const defaults: UserSettings = {
  fontSize: 'medium',
  showLinkPreview: true,
  compactMode: false,
  language: 'de',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
  startMinimized: false,
  minimizeToTray: true,
  streamerMode: false,
  devMode: false,
  activityVisibility: 'all',
  joinSound: 'default',
  leaveSound: 'default',
  messageSound: 'default',
}

export function getUserSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) }
    }
  } catch {}
  return { ...defaults }
}

export function setUserSettings(partial: Partial<UserSettings>) {
  const current = getUserSettings()
  const next = { ...current, ...partial }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
