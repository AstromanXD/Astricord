/**
 * ChannelPermissionsSection - Discord-Style Kanalrechte
 * 3-State: ✓ Erlauben | ✗ Verweigern | — Standard (von Rolle)
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ChannelPermissionOverwrite, ServerRole } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import {
  PERMISSION_LABELS,
  TEXT_CHANNEL_PERMS,
  VOICE_CHANNEL_PERMS,
  hasPermission,
  setAllow,
} from '../lib/permissions'

interface ChannelPermissionsSectionProps {
  channelId: string
  channelType: 'text' | 'voice'
  serverId: string
}

type OverwriteWithTarget = ChannelPermissionOverwrite & {
  targetName: string
  targetColor?: string
}

type PermState = 'allow' | 'deny' | 'default'

function PermToggle({
  state,
  onChange,
  title,
}: {
  state: PermState
  onChange: (next: PermState) => void
  title: string
}) {
  const cycle = () => {
    if (state === 'default') onChange('allow')
    else if (state === 'allow') onChange('deny')
    else onChange('default')
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={title}
      className={`w-8 h-8 rounded flex items-center justify-center text-sm font-medium transition-colors ${
        state === 'allow'
          ? 'bg-[var(--accent-success)]/20 text-[var(--accent-success)] hover:bg-[var(--accent-success)]/30'
          : state === 'deny'
            ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/30'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-secondary)]'
      }`}
    >
      {state === 'allow' ? '✓' : state === 'deny' ? '✗' : '—'}
    </button>
  )
}

export function ChannelPermissionsSection({
  channelId,
  channelType,
  serverId,
}: ChannelPermissionsSectionProps) {
  const [overwrites, setOverwrites] = useState<OverwriteWithTarget[]>([])
  const [roles, setRoles] = useState<ServerRole[]>([])
  const [members, setMembers] = useState<{ user_id: string; username: string }[]>([])
  const [addType, setAddType] = useState<'role' | 'member'>('role')
  const [addRoleId, setAddRoleId] = useState('')
  const [addUserId, setAddUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const perms = channelType === 'text' ? TEXT_CHANNEL_PERMS : VOICE_CHANNEL_PERMS

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false)
      }
    }
    if (showAddDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddDropdown])

  const fetchOverwrites = async () => {
    const { data } = await supabase
      .from('channel_permission_overwrites')
      .select('*')
      .eq('channel_id', channelId)
    if (!data) return

    const withTargets: OverwriteWithTarget[] = []
    for (const ow of data) {
      if (ow.role_id) {
        const { data: role } = await supabase
          .from('server_roles')
          .select('name, color')
          .eq('id', ow.role_id)
          .single()
        withTargets.push({ ...ow, targetName: role?.name ?? '?', targetColor: role?.color })
      } else if (ow.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', ow.user_id)
          .single()
        withTargets.push({ ...ow, targetName: (profile as Profile)?.username ?? '?' })
      }
    }
    setOverwrites(withTargets)
  }

  const fetchRolesAndMembers = async () => {
    const { data: rolesData } = await supabase
      .from('server_roles')
      .select('*')
      .eq('server_id', serverId)
      .order('position', { ascending: false })
    setRoles(rolesData ?? [])

    const { data: membersData } = await supabase
      .from('server_members')
      .select('user_id')
      .eq('server_id', serverId)
    const userIds = (membersData ?? []).map((m) => m.user_id)
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds)
      setMembers(
        (profiles ?? []).map((p) => ({ user_id: p.id, username: (p as { username: string }).username }))
      )
    }
  }

  useEffect(() => {
    fetchOverwrites()
    fetchRolesAndMembers()
  }, [channelId, serverId])

  const handleAddOverwrite = async (roleId?: string, userId?: string) => {
    const rid = roleId ?? addRoleId
    const uid = userId ?? addUserId
    const isRole = rid != null
    if (!rid && !uid) return
    setLoading(true)
    const { error } = await supabase.from('channel_permission_overwrites').insert({
      channel_id: channelId,
      role_id: isRole ? rid : null,
      user_id: !isRole ? uid : null,
      allow: 0,
      deny: 0,
    })
    setLoading(false)
    if (!error) {
      setAddRoleId('')
      setAddUserId('')
      setShowAddDropdown(false)
      fetchOverwrites()
    }
  }

  const getPermState = (ow: OverwriteWithTarget, perm: number): PermState => {
    if (hasPermission(ow.allow, perm)) return 'allow'
    if (hasPermission(ow.deny, perm)) return 'deny'
    return 'default'
  }

  const handlePermChange = async (
    ow: OverwriteWithTarget,
    perm: number,
    nextState: PermState
  ) => {
    if (nextState === 'allow') {
      await supabase
        .from('channel_permission_overwrites')
        .update({
          allow: (ow.allow | perm),
          deny: ow.deny & ~perm,
        })
        .eq('id', ow.id)
    } else if (nextState === 'deny') {
      await supabase
        .from('channel_permission_overwrites')
        .update({
          deny: (ow.deny | perm),
          allow: ow.allow & ~perm,
        })
        .eq('id', ow.id)
    } else {
      await supabase
        .from('channel_permission_overwrites')
        .update({
          allow: ow.allow & ~perm,
          deny: ow.deny & ~perm,
        })
        .eq('id', ow.id)
    }
    fetchOverwrites()
  }

  const handleRemoveOverwrite = async (id: string) => {
    await supabase.from('channel_permission_overwrites').delete().eq('id', id)
    fetchOverwrites()
  }

  const usedRoleIds = overwrites.filter((o) => o.role_id).map((o) => o.role_id!)
  const usedUserIds = overwrites.filter((o) => o.user_id).map((o) => o.user_id!)

  return (
    <div className="space-y-6">
      {/* Header - Discord-Style */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
          Berechtigungen
        </h3>
        <p className="text-sm text-[var(--text-muted)]">
          Füge Mitglieder oder Rollen hinzu, um spezifische Berechtigungen für diesen Kanal zu setzen.
        </p>
      </div>

      {/* Add Button + Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowAddDropdown(!showAddDropdown)}
          className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium"
        >
          Mitglieder oder Rollen hinzufügen
        </button>
        {showAddDropdown && (
          <div className="absolute top-full left-0 mt-2 w-64 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-xl py-2 z-10">
            <div className="flex gap-2 px-3 py-2 border-b border-[var(--border)]">
              <button
                onClick={() => setAddType('role')}
                className={`flex-1 py-1.5 rounded text-sm font-medium ${
                  addType === 'role' ? 'bg-[var(--bg-modifier-active)]' : 'hover:bg-[var(--bg-modifier-hover)]'
                }`}
              >
                Rolle
              </button>
              <button
                onClick={() => setAddType('member')}
                className={`flex-1 py-1.5 rounded text-sm font-medium ${
                  addType === 'member' ? 'bg-[var(--bg-modifier-active)]' : 'hover:bg-[var(--bg-modifier-hover)]'
                }`}
              >
                Mitglied
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto py-2">
              {(addType === 'role'
                ? roles.filter((r) => !usedRoleIds.includes(r.id))
                : members.filter((m) => !usedUserIds.includes(m.user_id))
              ).length === 0 ? (
                <p className="px-3 py-4 text-sm text-[var(--text-muted)]">
                  {addType === 'role' ? 'Alle Rollen bereits hinzugefügt' : 'Alle Mitglieder bereits hinzugefügt'}
                </p>
              ) : addType === 'role' ? (
                roles
                  .filter((r) => !usedRoleIds.includes(r.id))
                  .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleAddOverwrite(r.id, undefined)}
                        className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--bg-modifier-hover)]"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: r.color }}
                        />
                        <span className="text-sm text-[var(--text-primary)] truncate">{r.name}</span>
                      </button>
                    ))
              ) : (
                members
                  .filter((m) => !usedUserIds.includes(m.user_id))
                  .map((m) => (
                      <button
                        key={m.user_id}
                        onClick={() => handleAddOverwrite(undefined, m.user_id)}
                        className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)] truncate"
                      >
                        {m.username}
                      </button>
                    ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Permission Table - Discord-Style */}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              <th className="text-left px-4 py-3 font-semibold">Berechtigung</th>
              {overwrites.map((ow) => (
                <th key={ow.id} className="px-4 py-3 font-medium text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-2">
                    {ow.targetColor && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ow.targetColor }}
                      />
                    )}
                    <span className="truncate">{ow.targetName}</span>
                    <button
                      onClick={() => handleRemoveOverwrite(ow.id)}
                      className="p-1 rounded hover:bg-[var(--accent-danger)]/20 text-[var(--text-muted)] hover:text-[var(--accent-danger)]"
                      title="Entfernen"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perms.map((perm) => (
              <tr
                key={perm}
                className="border-t border-[var(--border)] hover:bg-[var(--bg-modifier-hover)]/50"
              >
                <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                  {PERMISSION_LABELS[perm]}
                </td>
                {overwrites.map((ow) => (
                  <td key={ow.id} className="px-4 py-2.5 text-center">
                    <div className="flex justify-center gap-1">
                      <PermToggle
                        state={getPermState(ow, perm)}
                        onChange={(next) => handlePermChange(ow, perm, next)}
                        title={PERMISSION_LABELS[perm]}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {overwrites.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          Füge Mitglieder oder Rollen hinzu, um spezifische Berechtigungen zu setzen. — = Standard (von Rolle).
        </p>
      )}
    </div>
  )
}
