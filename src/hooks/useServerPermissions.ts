/**
 * useServerPermissions - Effektive Berechtigungen des aktuellen Users auf einem Server
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBackend, servers } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission, PERMISSIONS } from '../lib/permissions'

export function useServerPermissions(serverId: string | null) {
  const { user } = useAuth()
  const backend = useBackend()
  const [permissions, setPermissions] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (!serverId || !user) {
      setPermissions(0)
      setIsAdmin(false)
      setIsOwner(false)
      return
    }

    const check = async () => {
      if (backend) {
        try {
          const { isAdmin: admin, isOwner: owner, permissions: perms } = await servers.getPermissions(serverId)
          setIsAdmin(!!admin)
          setPermissions(perms ?? 0)
          setIsOwner(!!owner)
        } catch {
          setPermissions(0)
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
        setPermissions(0)
        setIsAdmin(false)
        setIsOwner(false)
        return
      }

      const roleIds = data.map((r) => r.role_id)
      const { data: roles } = await supabase
        .from('server_roles')
        .select('name, permissions')
        .in('id', roleIds)

      let combined = 0
      for (const r of roles ?? []) {
        combined |= Number(r.permissions ?? 0)
      }
      setPermissions(combined)
      setIsAdmin(hasPermission(combined, PERMISSIONS.ADMINISTRATOR))
      setIsOwner(roles?.some((r) => r.name === 'Owner') ?? false)
    }

    check()
  }, [serverId, user?.id, backend])

  const can = (flag: number) => hasPermission(permissions, flag)

  return {
    isAdmin,
    isOwner,
    permissions,
    hasPermission: can,
    canManageServer: can(PERMISSIONS.MANAGE_SERVER),
    canManageChannels: can(PERMISSIONS.MANAGE_CHANNELS),
    canManageRoles: can(PERMISSIONS.MANAGE_ROLES),
    canKickMembers: can(PERMISSIONS.KICK_MEMBERS),
    canBanMembers: can(PERMISSIONS.BAN_MEMBERS),
    canViewAuditLog: can(PERMISSIONS.VIEW_AUDIT_LOG),
    canCreateInvite: can(PERMISSIONS.CREATE_INVITE),
    canManageExpressions: can(PERMISSIONS.MANAGE_EXPRESSIONS),
    canCreateExpressions: can(PERMISSIONS.CREATE_EXPRESSIONS),
  }
}
