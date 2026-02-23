/**
 * useMemberRoleColors - Rollenfarben für Chat-Namen (Discord-Style)
 * Gibt die Farbe der höchsten Rolle pro User zurück; ohne Rolle = undefined (grau)
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBackend, servers } from '../lib/api'

export function useMemberRoleColors(serverId: string | null, userIds: string[]) {
  const backend = useBackend()
  const [colors, setColors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!serverId || userIds.length === 0) {
      setColors({})
      return
    }

    const ids = [...new Set(userIds)]
    const load = async () => {
      if (backend) {
        try {
          const result = await servers.getRoleColors(serverId, ids)
          setColors(result ?? {})
        } catch {
          setColors({})
        }
        return
      }
      const { data: memberRoles } = await supabase
        .from('server_member_roles')
        .select('user_id, role_id')
        .eq('server_id', serverId)
        .in('user_id', ids)
      if (!memberRoles?.length) {
        setColors({})
        return
      }
      const roleIds = [...new Set(memberRoles.map((r) => r.role_id))]
      const { data: roles } = await supabase
        .from('server_roles')
        .select('id, color, position')
        .eq('server_id', serverId)
        .in('id', roleIds)
      const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r]))
      const userRoles = new Map<string, { color: string; position: number }[]>()
      for (const mr of memberRoles) {
        const role = roleMap[mr.role_id]
        if (role) {
          const list = userRoles.get(mr.user_id) ?? []
          list.push({ color: role.color, position: role.position })
          userRoles.set(mr.user_id, list)
        }
      }
      const result: Record<string, string> = {}
      userRoles.forEach((rolesList, uid) => {
        const top = rolesList.sort((a, b) => b.position - a.position)[0]
        if (top?.color) result[uid] = top.color
      })
      setColors(result)
    }
    load()
  }, [serverId, [...new Set(userIds)].sort().join(','), backend])

  return colors
}
