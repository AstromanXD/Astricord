/**
 * useServerPermissions - Prüft ob der aktuelle User Admin-Rechte auf einem Server hat
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBackend, servers } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export function useServerPermissions(serverId: string | null) {
  const { user } = useAuth()
  const backend = useBackend()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (!serverId || !user) {
      setIsAdmin(false)
      setIsOwner(false)
      return
    }

    const check = async () => {
      if (backend) {
        try {
          const { isAdmin: admin } = await servers.getPermissions(serverId)
          setIsAdmin(admin)
          setIsOwner(false)
        } catch {
          setIsAdmin(false)
          setIsOwner(false)
        }
        return
      }
      const { data } = await supabase
        .from('server_member_roles')
        .select('role_id')
        .eq('server_id', serverId)
        .eq('user_id', user.id)

      if (!data?.length) {
        setIsAdmin(false)
        setIsOwner(false)
        return
      }

      const roleIds = data.map((r) => r.role_id)
      const { data: roles } = await supabase
        .from('server_roles')
        .select('name')
        .in('id', roleIds)
        .in('name', ['Admin', 'Owner'])

      setIsAdmin((roles?.length ?? 0) > 0)
      setIsOwner((roles?.some((r) => r.name === 'Owner')) ?? false)
    }

    check()
  }, [serverId, user?.id, backend])

  return { isAdmin, isOwner }
}
