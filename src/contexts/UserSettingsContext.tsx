/**
 * UserSettingsContext - Benutzer-Einstellungen (Chat, Sounds, etc.)
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getUserSettings, setUserSettings, type UserSettings } from '../lib/userSettings'

interface UserSettingsContextType {
  settings: UserSettings
  updateSettings: (partial: Partial<UserSettings>) => void
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(undefined)

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(getUserSettings)

  useEffect(() => {
    const handler = () => setSettings(getUserSettings())
    window.addEventListener('astricord:user-settings-changed', handler)
    if (typeof (window as { electronAPI?: { syncUserSettings?: (s: object) => void } }).electronAPI?.syncUserSettings === 'function') {
      const s = getUserSettings()
      ;(window as { electronAPI: { syncUserSettings: (s: object) => void } }).electronAPI.syncUserSettings({
        startMinimized: s.startMinimized,
        minimizeToTray: s.minimizeToTray,
      })
    }
    return () => window.removeEventListener('astricord:user-settings-changed', handler)
  }, [])

  const updateSettings = (partial: Partial<UserSettings>) => {
    setUserSettings(partial)
    setSettings(getUserSettings())
    window.dispatchEvent(new CustomEvent('astricord:user-settings-changed'))
    if (typeof (window as { electronAPI?: { syncUserSettings?: (s: object) => void } }).electronAPI?.syncUserSettings === 'function') {
      const s = getUserSettings()
      ;(window as { electronAPI: { syncUserSettings: (s: object) => void } }).electronAPI.syncUserSettings({
        startMinimized: s.startMinimized,
        minimizeToTray: s.minimizeToTray,
      })
    }
  }

  return (
    <UserSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </UserSettingsContext.Provider>
  )
}

export function useUserSettings() {
  const ctx = useContext(UserSettingsContext)
  if (ctx === undefined) {
    return { settings: getUserSettings(), updateSettings: (p: Partial<UserSettings>) => setUserSettings(p) }
  }
  return ctx
}
