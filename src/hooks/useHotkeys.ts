/**
 * useHotkeys - Globale Tastenkürzel
 * Enter/Shift+Enter: Chat (wird in Chat.tsx behandelt)
 * Ctrl+M: Mikrofon stummschalten
 * Ctrl+,: Einstellungen öffnen
 */
import { useEffect } from 'react'

export interface HotkeysConfig {
  onToggleMute?: () => void
  onOpenSettings?: () => void
}

export function useHotkeys(config: HotkeysConfig) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        config.onOpenSettings?.()
      }
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault()
        config.onToggleMute?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [config.onToggleMute, config.onOpenSettings])
}
