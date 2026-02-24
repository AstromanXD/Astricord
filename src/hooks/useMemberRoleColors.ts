/**
 * useMemberRoleColors - Rollenfarben für Chat-Namen (Discord-Style)
 * Gibt die Farbe der höchsten Rolle pro User zurück; ohne Rolle = undefined (grau)
 */
import { useEffect, useState } from 'react'
import { servers } from '../lib/api'

export function useMemberRoleColors(serverId: string | null, userIds: string[]) {
  const [colors, setColors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!serverId || userIds.length === 0) {
      setColors({})
      return
    }

    const ids = [...new Set(userIds)]
    const load = async () => {
      try {
        const result = await servers.getRoleColors(serverId, ids)
        setColors(result ?? {})
      } catch {
        setColors({})
      }
    }
    load()
  }, [serverId, [...new Set(userIds)].sort().join(',')])

  return colors
}
