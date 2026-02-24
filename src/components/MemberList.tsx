/**
 * MemberList - Rechte Sidebar mit Server-Mitgliedern & Rollen (Discord-ähnlich)
 * Rechtsklick-Kontextmenü wie bei Discord
 */
import { useEffect, useState, useRef } from 'react'
import type { Profile, ServerRole } from '../lib/supabase'
import { servers, blockUser } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../contexts/PresenceContext'
import { useServerPermissions } from '../hooks/useServerPermissions'
import { MemberContextMenu } from './MemberContextMenu'
import { MemberProfilePopover } from './MemberProfilePopover'

interface MemberWithRoles {
  userId: string
  profile: Profile
  roles: ServerRole[]
  nickname?: string | null
  timeout_until?: string | null
}

interface MemberListProps {
  serverId: string | null
  onOpenDm?: (profile: Profile) => void
}

export function MemberList({ serverId, onOpenDm }: MemberListProps) {
  const { user, profile: authProfile } = useAuth()
  const { onlineUserIds } = usePresence()
  const { canManageRoles, canKickMembers, canBanMembers, canModerateMembers, canManageNicknames, canChangeNickname } = useServerPermissions(serverId)
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
      try {
        const data = await servers.getMembersDetail(serverId)
        setRoles((data?.roles ?? []) as ServerRole[])
        setMembers((data?.members ?? []) as MemberWithRoles[])
      } catch {
        setMembers([])
        setRoles([])
      }
      setLoading(false)
    }

    load()
  }, [serverId, user?.id])

  useEffect(() => {
    if (!authProfile || !user) return
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === user.id ? { ...m, profile: { ...m.profile, ...authProfile } } : m
      )
    )
  }, [authProfile, user?.id])

  const handleContextMenu = (e: React.MouseEvent, member: MemberWithRoles) => {
    e.preventDefault()
    e.stopPropagation()
    setProfilePopover(null)
    setContextMenu({ x: e.clientX, y: e.clientY, member })
  }

  const handleKick = async (userId: string) => {
    if (!serverId || !user) return
    try {
      await servers.kickMember(serverId, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      setContextMenu(null)
    } catch (_) {}
  }

  const handleBlock = async (userId: string) => {
    if (!user) return
    try {
      await blockUser(userId)
    } catch (_) {}
    setContextMenu(null)
  }

  const handleBan = async (userId: string) => {
    if (!serverId || !user) return
    try {
      await servers.banMember(serverId, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      setContextMenu(null)
    } catch (_) {}
  }

  const handleTimeout = async (userId: string, durationMinutes: number | null) => {
    if (!serverId || !user) return
    try {
      const until = durationMinutes
        ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
        : null
      await servers.setMemberTimeout(serverId, userId, until)
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, timeout_until: until } : m
        )
      )
      setContextMenu(null)
    } catch (_) {}
  }

  const handleSetNickname = async (userId: string, nickname: string) => {
    if (!serverId || !user) return
    try {
      await servers.setMemberNickname(serverId, userId, nickname)
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, nickname: nickname.trim() || null } : m))
      )
      setContextMenu(null)
    } catch (_) {}
  }

  const handleRoleToggle = async (roleId: string, add: boolean) => {
    if (!serverId || !contextMenu) return
    try {
      await servers.toggleMemberRole(serverId, contextMenu.member.userId, roleId, add)
    } catch (_) {
      return
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

  const statusStyle: Record<string, { bg: string; label: string }> = {
    online: { bg: 'bg-[var(--accent-success)]', label: 'Online' },
    away: { bg: 'bg-yellow-500', label: 'Abwesend' },
    dnd: { bg: 'bg-red-500', label: 'Bitte nicht stören' },
    offline: { bg: 'bg-[var(--text-muted)]', label: 'Offline' },
  }

  const MemberRow = ({ m, color }: { m: MemberWithRoles; color?: string }) => {
    const profile = getEffectiveProfile(m)
    const profileStatus = ((profile as { status?: string | null }).status || 'online') as keyof typeof statusStyle
    const isOffline = !onlineUserIds.has(m.userId) || profileStatus === 'offline'
    const style = isOffline ? statusStyle.offline : (statusStyle[profileStatus] ?? statusStyle.online)
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
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--bg-secondary)] ${style.bg}`}
          title={style.label}
        />
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
            {profile.username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span
        className={`text-sm truncate ${isOffline ? 'opacity-70' : ''}`}
        style={color ? { color } : undefined}
      >
        {(m as MemberWithRoles).nickname ?? profile.username}
      </span>
      {(m as MemberWithRoles).timeout_until && new Date((m as MemberWithRoles).timeout_until!) > new Date() && (
        <svg className="w-3.5 h-3.5 text-[var(--accent-danger)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Im Timeout">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
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

  const getEffectiveProfile = (m: MemberWithRoles) =>
    m.userId === user?.id && authProfile ? { ...m.profile, ...authProfile } : m.profile
  const isDisplayOnline = (m: MemberWithRoles) => {
    const profile = getEffectiveProfile(m)
    return onlineUserIds.has(m.userId) && (profile as { status?: string | null }).status !== 'offline'
  }
  const onlineCount = members.filter(isDisplayOnline).length

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

  const onlineMembers = members.filter(isDisplayOnline)
  const offlineMembers = members.filter((m) => !isDisplayOnline(m))
  const { grouped: onlineByRole, noRole: onlineNoRole } = groupByRole(onlineMembers)

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
            {onlineCount === 1 ? (
              onlineNoRole.length === 1 ? (
                <div className="mb-2">
                  <div className="px-3 py-1 flex items-center gap-1.5 text-[var(--accent-success)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-success)] flex-shrink-0" />
                    <span className="text-xs font-semibold uppercase truncate">Online</span>
                    <span className="text-xs text-[var(--text-muted)]">— 1</span>
                  </div>
                  <MemberRow key={onlineNoRole[0].userId} m={onlineNoRole[0]} />
                </div>
              ) : (
                roleOrder.map((role) => {
                  const roleMembers = onlineByRole.get(role.id) ?? []
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
                        <span className="text-xs text-[var(--text-muted)]">— 1</span>
                      </div>
                      <MemberRow key={roleMembers[0].userId} m={roleMembers[0]} color={role.color} />
                    </div>
                  )
                })
              )
            ) : (
              <>
                <div className="px-3 py-1 flex items-center gap-1.5 text-[var(--accent-success)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-success)] flex-shrink-0" />
                  <span className="text-xs font-semibold uppercase truncate">Online</span>
                  <span className="text-xs text-[var(--text-muted)]">— {onlineCount}</span>
                </div>
                {renderRoleSection(onlineByRole, onlineNoRole, (r) => r.color)}
              </>
            )}
          </div>
        )}
        {offlineMembers.length > 0 && (
          <div>
            <div className="px-3 py-1 flex items-center gap-1.5 text-[var(--text-muted)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)] flex-shrink-0" />
              <span className="text-xs font-semibold uppercase truncate">Offline</span>
              <span className="text-xs">— {offlineMembers.length}</span>
            </div>
            {offlineMembers.map((m) => (
              <MemberRow key={m.userId} m={m} color={([...m.roles].sort((a, b) => b.position - a.position)[0] as ServerRole | undefined)?.color} />
            ))}
          </div>
        )}
      </div>

      {profilePopover && (
        <MemberProfilePopover
          x={profilePopover.x}
          y={profilePopover.y}
          member={profilePopover.member}
          isOnline={isDisplayOnline(profilePopover.member)}
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
          canManageRoles={canManageRoles}
          canKickMembers={canKickMembers}
          canBanMembers={canBanMembers}
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
          onKick={canKickMembers ? handleKick : undefined}
          onBan={canBanMembers ? handleBan : undefined}
          onBlock={handleBlock}
          onTimeout={canModerateMembers ? handleTimeout : undefined}
          onSetNickname={(canManageNicknames || (contextMenu.member.userId === user?.id && canChangeNickname)) ? handleSetNickname : undefined}
        />
      )}
    </div>
  )
}
