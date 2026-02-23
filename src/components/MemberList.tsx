/**
 * MemberList - Rechte Sidebar mit Server-Mitgliedern & Rollen (Discord-ähnlich)
 * Rechtsklick-Kontextmenü wie bei Discord
 */
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, ServerRole } from '../lib/supabase'
import { useBackend, servers, blockUser } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../contexts/PresenceContext'
import { useServerPermissions } from '../hooks/useServerPermissions'
import { MemberContextMenu } from './MemberContextMenu'
import { MemberProfilePopover } from './MemberProfilePopover'

interface MemberWithRoles {
  userId: string
  profile: Profile
  roles: ServerRole[]
}

interface MemberListProps {
  serverId: string | null
  onOpenDm?: (profile: Profile) => void
}

export function MemberList({ serverId, onOpenDm }: MemberListProps) {
  const { user } = useAuth()
  const backend = useBackend()
  const { onlineUserIds } = usePresence()
  const { isAdmin } = useServerPermissions(serverId)
  const [members, setMembers] = useState<MemberWithRoles[]>([])
  const [roles, setRoles] = useState<ServerRole[]>([])
  const [loading, setLoading] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    member: MemberWithRoles
  } | null>(null)
  const [profilePopover, setProfilePopover] = useState<{
    x: number
    y: number
    member: MemberWithRoles
    anchorRef: React.RefObject<HTMLDivElement>
  } | null>(null)

  useEffect(() => {
    if (!serverId || !user) {
      setMembers([])
      setRoles([])
      return
    }

    const load = async () => {
      setLoading(true)

      if (backend) {
        try {
          const data = await servers.getMembersDetail(serverId)
          setRoles((data?.roles ?? []) as ServerRole[])
          setMembers((data?.members ?? []) as MemberWithRoles[])
        } catch {
          setMembers([])
          setRoles([])
        }
      } else {
        const [rolesRes, membersRes, memberRolesRes] = await Promise.all([
          supabase.from('server_roles').select('*').eq('server_id', serverId).order('position', { ascending: false }),
          supabase.from('server_members').select('user_id').eq('server_id', serverId),
          supabase.from('server_member_roles').select('user_id, role_id').eq('server_id', serverId),
        ])

        const rolesList = (rolesRes.data ?? []) as ServerRole[]
        setRoles(rolesList)
        const roleMap = Object.fromEntries(rolesList.map((r) => [r.id, r]))

        const memberIds = [...new Set((membersRes.data ?? []).map((m) => m.user_id))]
        const rolesByUser = new Map<string, ServerRole[]>()
        ;(memberRolesRes.data ?? []).forEach((mr) => {
          const role = roleMap[mr.role_id]
          if (role) {
            const existing = rolesByUser.get(mr.user_id) ?? []
            if (!existing.find((r) => r.id === role.id)) {
              rolesByUser.set(mr.user_id, [...existing, role])
            }
          }
        })

        if (memberIds.length === 0) {
          setMembers([])
          setLoading(false)
          return
        }

        const { data: profiles } = await supabase.from('profiles').select('*').in('id', memberIds)
        const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

        const memberList: MemberWithRoles[] = memberIds.map((uid) => ({
          userId: uid,
          profile: profileMap[uid] ?? {
            id: uid,
            username: 'Unbekannt',
            avatar_url: null,
            theme: 'dark',
            created_at: '',
          },
          roles: rolesByUser.get(uid) ?? [],
        }))

        setMembers(memberList)
      }
      setLoading(false)
    }

    load()
  }, [serverId, user?.id, backend])

  const handleContextMenu = (e: React.MouseEvent, member: MemberWithRoles) => {
    e.preventDefault()
    e.stopPropagation()
    setProfilePopover(null)
    setContextMenu({ x: e.clientX, y: e.clientY, member })
  }

  const handleKick = async (userId: string) => {
    if (!serverId || !user) return
    if (backend) {
      try {
        await servers.kickMember(serverId, userId)
        setMembers((prev) => prev.filter((m) => m.userId !== userId))
        setContextMenu(null)
      } catch (_) {}
    } else {
      await supabase.from('server_member_roles').delete().eq('server_id', serverId).eq('user_id', userId)
      await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', userId)
      await supabase.from('audit_log').insert({
        server_id: serverId,
        user_id: user.id,
        action: 'member_kicked',
        target_type: 'user',
        target_id: userId,
        details: { username: members.find((m) => m.userId === userId)?.profile.username },
      })
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      setContextMenu(null)
    }
  }

  const handleBlock = async (userId: string) => {
    if (!user) return
    if (backend) {
      try {
        await blockUser(userId)
      } catch (_) {}
    } else {
      await supabase.from('blocked_users').insert({ user_id: user.id, blocked_user_id: userId })
    }
    setContextMenu(null)
  }

  const handleBan = async (userId: string) => {
    if (!serverId || !user) return
    if (backend) {
      try {
        await servers.banMember(serverId, userId)
        setMembers((prev) => prev.filter((m) => m.userId !== userId))
        setContextMenu(null)
      } catch (_) {}
    } else {
      await supabase.from('server_bans').insert({
        server_id: serverId,
        user_id: userId,
        banned_by: user.id,
      })
      await supabase.from('server_member_roles').delete().eq('server_id', serverId).eq('user_id', userId)
      await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', userId)
      await supabase.from('audit_log').insert({
        server_id: serverId,
        user_id: user.id,
        action: 'member_banned',
        target_type: 'user',
        target_id: userId,
        details: { username: members.find((m) => m.userId === userId)?.profile.username },
      })
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      setContextMenu(null)
    }
  }

  const handleRoleToggle = async (roleId: string, add: boolean) => {
    if (!serverId || !contextMenu) return
    if (backend) {
      try {
        await servers.toggleMemberRole(serverId, contextMenu.member.userId, roleId, add)
      } catch (_) {
        return
      }
    } else {
      if (add) {
        await supabase.from('server_member_roles').insert({
          server_id: serverId,
          user_id: contextMenu.member.userId,
          role_id: roleId,
        })
      } else {
        await supabase.from('server_member_roles').delete().match({
          server_id: serverId,
          user_id: contextMenu.member.userId,
          role_id: roleId,
        })
      }
    }
    setMembers((prev) =>
      prev.map((m) => {
        if (m.userId !== contextMenu.member.userId) return m
        const role = roles.find((r) => r.id === roleId)
        if (!role) return m
        if (add) {
          return { ...m, roles: [...m.roles, role] }
        }
        return { ...m, roles: m.roles.filter((r) => r.id !== roleId) }
      })
    )
    setContextMenu((prev) =>
      prev
        ? {
            ...prev,
            member: {
              ...prev.member,
              roles: add
                ? [...prev.member.roles, roles.find((r) => r.id === roleId)!]
                : prev.member.roles.filter((r) => r.id !== roleId),
            },
          }
        : null
    )
  }

  const MemberRow = ({ m, color }: { m: MemberWithRoles; color?: string }) => {
    const profileStatus = (m.profile as { status?: string | null }).status
    const isOnline = onlineUserIds.has(m.userId) && profileStatus !== 'offline'
    const rowRef = useRef<HTMLDivElement>(null)
    return (
    <div
      ref={rowRef}
      key={m.userId}
      onClick={(e) => {
        setContextMenu(null)
        setProfilePopover({ x: e.clientX, y: e.clientY, member: m, anchorRef: rowRef })
      }}
      onContextMenu={(e) => handleContextMenu(e, m)}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-modifier-hover)] group cursor-pointer"
    >
      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--bg-secondary)] ${isOnline ? 'bg-[var(--accent-success)]' : 'bg-[var(--text-muted)]'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
        {m.profile.avatar_url ? (
          <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
            {m.profile.username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span
        className={`text-sm truncate ${!isOnline ? 'opacity-70' : ''}`}
        style={color ? { color } : undefined}
      >
        {m.profile.username}
      </span>
    </div>
  )}

  if (!serverId) return null

  if (loading) {
    return (
      <div className="w-60 flex-shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const onlineCount = members.filter(
    (m) => onlineUserIds.has(m.userId) && (m.profile as { status?: string | null }).status !== 'offline'
  ).length

  const groupByRole = (list: MemberWithRoles[]) => {
    const grouped = new Map<string, MemberWithRoles[]>()
    const noRole: MemberWithRoles[] = []
    list.forEach((m) => {
      const topRole = [...m.roles].sort((a, b) => b.position - a.position)[0]
      if (topRole) {
        const listForRole = grouped.get(topRole.id) ?? []
        listForRole.push(m)
        grouped.set(topRole.id, listForRole)
      } else {
        noRole.push(m)
      }
    })
    return { grouped, noRole }
  }

  const isDisplayOnline = (m: MemberWithRoles) =>
    onlineUserIds.has(m.userId) && (m.profile as { status?: string | null }).status !== 'offline'
  const onlineMembers = members.filter(isDisplayOnline)
  const offlineMembers = members.filter((m) => !isDisplayOnline(m))
  const { grouped: onlineByRole, noRole: onlineNoRole } = groupByRole(onlineMembers)
  const { grouped: offlineByRole, noRole: offlineNoRole } = groupByRole(offlineMembers)

  const roleOrder = [...roles].sort((a, b) => b.position - a.position)

  const renderRoleSection = (
    grouped: Map<string, MemberWithRoles[]>,
    noRole: MemberWithRoles[],
    getColor: (role: ServerRole) => string | undefined
  ) => (
    <>
      {roleOrder.map((role) => {
        const roleMembers = grouped.get(role.id) ?? []
        if (roleMembers.length === 0) return null
        return (
          <div key={role.id} className="mb-2">
            <div
              className="px-3 py-1 flex items-center gap-1.5 cursor-default"
              style={{ color: role.color }}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: role.color }}
              />
              <span className="text-xs font-semibold uppercase truncate">{role.name}</span>
              <span className="text-xs text-[var(--text-muted)]">— {roleMembers.length}</span>
            </div>
            {roleMembers.map((m) => (
              <MemberRow key={m.userId} m={m} color={getColor(role)} />
            ))}
          </div>
        )
      })}
      {noRole.length > 0 && (
        <div className="mb-2">
          <div className="px-3 py-1 flex items-center gap-1.5 text-[var(--text-muted)]">
            <span className="w-3 h-3 rounded-full bg-[var(--text-muted)] flex-shrink-0" />
            <span className="text-xs font-semibold uppercase truncate">Ohne Rolle</span>
            <span className="text-xs">— {noRole.length}</span>
          </div>
          {noRole.map((m) => (
            <MemberRow key={m.userId} m={m} />
          ))}
        </div>
      )}
    </>
  )

  return (
    <div className="w-60 flex-shrink-0 flex flex-col overflow-hidden bg-[var(--bg-secondary)] border-l border-[var(--border)]">
      <div className="h-12 px-3 flex items-center border-b border-[var(--border)]">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Mitglieder — {members.length}
          {onlineCount > 0 && (
            <span className="text-[var(--text-muted)] font-normal"> ({onlineCount} online)</span>
          )}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
        {onlineCount > 0 && (
          <div className="mb-3">
            <div className="px-3 py-1 flex items-center gap-1.5 text-[var(--accent-success)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-success)] flex-shrink-0" />
              <span className="text-xs font-semibold uppercase truncate">Online</span>
              <span className="text-xs text-[var(--text-muted)]">— {onlineCount}</span>
            </div>
            {renderRoleSection(onlineByRole, onlineNoRole, (r) => r.color)}
          </div>
        )}
        {offlineMembers.length > 0 && (
          <div>
            <div className="px-3 py-1 flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)] flex-shrink-0" />
              <span className="text-xs font-semibold uppercase truncate">Offline</span>
              <span className="text-xs">— {offlineMembers.length}</span>
            </div>
            {renderRoleSection(offlineByRole, offlineNoRole, (r) => r.color)}
          </div>
        )}
      </div>

      {profilePopover && (
        <MemberProfilePopover
          x={profilePopover.x}
          y={profilePopover.y}
          member={profilePopover.member}
          isOnline={
            onlineUserIds.has(profilePopover.member.userId) &&
            (profilePopover.member.profile as { status?: string | null }).status !== 'offline'
          }
          isSelf={profilePopover.member.userId === user?.id}
          onClose={() => setProfilePopover(null)}
          onOpenDm={onOpenDm}
          anchorRef={profilePopover.anchorRef}
        />
      )}
      {contextMenu && (
        <MemberContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          member={contextMenu.member}
          roles={roles}
          isAdmin={isAdmin}
          isSelf={contextMenu.member.userId === user?.id}
          onClose={() => setContextMenu(null)}
          onProfil={() => {
            onOpenDm?.(contextMenu.member.profile)
          }}
          onMention={() => {
            navigator.clipboard.writeText(`@${contextMenu.member.profile.username}`)
          }}
          onCopyId={() => {
            navigator.clipboard.writeText(contextMenu.member.userId)
          }}
          onRoleToggle={handleRoleToggle}
          onKick={isAdmin ? handleKick : undefined}
          onBan={isAdmin ? handleBan : undefined}
          onBlock={handleBlock}
        />
      )}
    </div>
  )
}
