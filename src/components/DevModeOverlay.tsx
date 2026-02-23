/**
 * DevModeOverlay - Debug-Infos wenn Entwicklermodus aktiv
 */
import { useUserSettings } from '../contexts/UserSettingsContext'
import { useAuth } from '../contexts/AuthContext'

export function DevModeOverlay() {
  const { settings } = useUserSettings()
  const { user } = useAuth()

  if (!settings.devMode) return null

  return (
    <div className="fixed bottom-14 left-2 z-[9999] px-2 py-1.5 rounded bg-black/80 text-[10px] font-mono text-green-400 max-w-[200px] truncate">
      <div title={user?.id ?? ''}>User: {user?.id?.slice(0, 8)}…</div>
      <div>Backend: {import.meta.env.VITE_API_URL ? '✓' : '✗'}</div>
    </div>
  )
}
