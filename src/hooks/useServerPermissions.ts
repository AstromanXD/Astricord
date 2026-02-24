/**
 * useServerPermissions - Effektive Berechtigungen des aktuellen Users auf einem Server
 */
import { useEffect, useState } from 'react'
import { servers } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { hasPermission, PERMISSIONS } from '../lib/permissions'

export function useServerPermissions(serverId: string | null) {
  const { user } = useAuth()
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
    }

    check()
  }, [serverId, user?.id])

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
    canModerateMembers: can(PERMISSIONS.MODERATE_MEMBERS),
    canManageNicknames: can(PERMISSIONS.MANAGE_NICKNAMES),
    canChangeNickname: can(PERMISSIONS.CHANGE_NICKNAME),
  }
}
