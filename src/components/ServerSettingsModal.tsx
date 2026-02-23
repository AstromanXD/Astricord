/**
 * ServerSettingsModal - Server-Einstellungen (Discord-Style)
 * Erweiterte Sidebar-Navigation, Serverprofil mit Vorschau
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Server, ServerRole, ServerEmoji, Profile, ServerInvite, AuditLogEntry } from '../lib/supabase'
import {
  hasPermission,
  setAllow,
  PERMISSION_GROUPS,
} from '../lib/permissions'
import { useServerPermissions } from '../hooks/useServerPermissions'
import { useUserSettings } from '../contexts/UserSettingsContext'
import { useBackend, servers, invites, emojis, uploadServerEmoji } from '../lib/api'
import { formatDateShort, formatDateTime } from '../lib/formatDate'

const BANNER_COLORS = [
  '#4f545c', '#f47b67', '#ed4245', '#faa61a', '#fee75c',
  '#9b59b6', '#5865f2', '#57f287', '#43b581', '#3ba55d',
]

const ROLE_COLORS = [
  '#99aab5', '#95a5a6', '#7f8c8d', '#7289da', '#5865f2',
  '#57f287', '#43b581', '#3ba55d', '#faa61a', '#faa81a',
  '#f47b67', '#ed4245', '#eb459e', '#9b59b6', '#5865f2',
  '#3ba55d', '#57f287', '#fee75c', '#faa61a', '#ed4245',
]

type Tab =
  | 'serverprofil'
  | 'server-tag'
  | 'beteiligung'
  | 'boost-vorteile'
  | 'emoji'
  | 'sticker'
  | 'soundboard'
  | 'mitglieder'
  | 'rollen'
  | 'einladungen'
  | 'zugriff'
  | 'integrationen'
  | 'app-verzeichnis'
  | 'sicherheitseinrichtung'
  | 'audit-log'
  | 'gebannte-mitglieder'
  | 'automod'
  | 'community-aktivieren'
  | 'servervorlage'
  | 'server-loeschen'

interface ServerSettingsModalProps {
  server: Server
  onClose: () => void
  onSaved: () => void
  initialTab?: Tab
}

export function ServerSettingsModal({ server, onClose, onSaved, initialTab }: ServerSettingsModalProps) {
  const backend = useBackend()
  const { isOwner } = useServerPermissions(server.id)
  const { settings: userSettings } = useUserSettings()
  const [tab, setTab] = useState<Tab>(initialTab ?? 'serverprofil')

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])
  const [name, setName] = useState(server.name)
  const [iconUrl, setIconUrl] = useState(server.icon_url ?? '')
  const [description, setDescription] = useState(server.description ?? '')
  const [bannerColor, setBannerColor] = useState(server.banner_color ?? '#4f545c')
  const [properties, setProperties] = useState<string[]>(['', '', '', '', ''])
  const [roles, setRoles] = useState<ServerRole[]>([])
  const [selectedRole, setSelectedRole] = useState<ServerRole | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleColor, setNewRoleColor] = useState('#99aab5')
  const [memberCount, setMemberCount] = useState(0)
  const [emojis, setEmojis] = useState<ServerEmoji[]>([])
  const [emojiUploading, setEmojiUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<{ profile: Profile; roles: ServerRole[] }[]>([])
  const [invites, setInvites] = useState<ServerInvite[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [roleEditTab, setRoleEditTab] = useState<'anzeige' | 'berechtigungen' | 'links' | 'mitglieder'>('anzeige')

  const fetchRoles = async () => {
    if (backend) {
      try {
        const data = await servers.getRoles(server.id)
        setRoles(data ?? [])
        if (!selectedRole && (data?.length ?? 0) > 0) setSelectedRole(data?.[0] ?? null)
      } catch {
        setRoles([])
      }
      return
    }
    const { data } = await supabase
      .from('server_roles')
      .select('*')
      .eq('server_id', server.id)
      .order('position', { ascending: false })
    setRoles(data ?? [])
    if (!selectedRole && (data?.length ?? 0) > 0) setSelectedRole(data?.[0] ?? null)
  }

  const fetchMemberCount = async () => {
    if (backend) {
      try {
        const memberIds = await servers.getMembers(server.id)
        setMemberCount(memberIds?.length ?? 0)
      } catch {
        setMemberCount(0)
      }
      return
    }
    const { count } = await supabase
      .from('server_members')
      .select('*', { count: 'exact', head: true })
      .eq('server_id', server.id)
    setMemberCount(count ?? 0)
  }

  const fetchEmojis = async () => {
    if (backend) {
      try {
        const data = await emojis.list(server.id)
        setEmojis(data ?? [])
      } catch {
        setEmojis([])
      }
      return
    }
    const { data } = await supabase
      .from('server_emojis')
      .select('*')
      .eq('server_id', server.id)
      .order('created_at')
    setEmojis(data ?? [])
  }

  useEffect(() => {
    setName(server.name)
    setIconUrl(server.icon_url ?? '')
    setDescription(server.description ?? '')
    setBannerColor(server.banner_color ?? '#4f545c')
  }, [server])

  useEffect(() => {
    fetchRoles()
    fetchMemberCount()
    fetchEmojis()
  }, [server.id])

  const fetchMembers = async () => {
    if (backend) {
      try {
        const data = await servers.getMembersDetail(server.id)
        setMembers((data?.members ?? []).map((m) => ({ profile: m.profile as Profile, roles: m.roles })))
      } catch {
        setMembers([])
      }
      return
    }
    const [membersRes, memberRolesRes, rolesRes] = await Promise.all([
      supabase.from('server_members').select('user_id').eq('server_id', server.id),
      supabase.from('server_member_roles').select('user_id, role_id').eq('server_id', server.id),
      supabase.from('server_roles').select('*').eq('server_id', server.id),
    ])
    const memberIds = [...new Set((membersRes.data ?? []).map((m) => m.user_id))]
    const rolesList = (rolesRes.data ?? []) as ServerRole[]
    const roleMap = Object.fromEntries(rolesList.map((r) => [r.id, r]))
    const rolesByUser = new Map<string, ServerRole[]>()
    ;(memberRolesRes.data ?? []).forEach((mr) => {
      const role = roleMap[mr.role_id]
      if (role) {
        const existing = rolesByUser.get(mr.user_id) ?? []
        if (!existing.find((r) => r.id === role.id)) rolesByUser.set(mr.user_id, [...existing, role])
      }
    })
    if (memberIds.length === 0) {
      setMembers([])
      return
    }
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', memberIds)
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
    setMembers(
      memberIds.map((uid) => ({
        profile: profileMap[uid] ?? { id: uid, username: 'Unbekannt', avatar_url: null, theme: 'dark', created_at: '' },
        roles: rolesByUser.get(uid) ?? [],
      }))
    )
  }

  const fetchInvites = async () => {
    if (backend) {
      try {
        const data = await invites.list(server.id)
        setInvites(data ?? [])
      } catch {
        setInvites([])
      }
      return
    }
    const { data } = await supabase.from('server_invites').select('*').eq('server_id', server.id).order('created_at', { ascending: false })
    setInvites(data ?? [])
  }

  const fetchAuditLog = async () => {
    if (backend) {
      try {
        const data = await servers.getAuditLog(server.id)
        setAuditLog((data ?? []) as AuditLogEntry[])
      } catch {
        setAuditLog([])
      }
      return
    }
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .eq('server_id', server.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setAuditLog((data ?? []) as AuditLogEntry[])
  }

  useEffect(() => {
    if (tab === 'mitglieder') fetchMembers()
    if (tab === 'einladungen') fetchInvites()
    if (tab === 'audit-log') fetchAuditLog()
  }, [tab, server.id])

  const createInvite = async () => {
    if (backend) {
      try {
        const inv = await invites.create(server.id)
        setInviteCode(`${window.location.origin}/#invite/${inv.code}`)
        fetchInvites()
      } catch (_) {}
      return
    }
    const code = crypto.randomUUID().slice(0, 8)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('server_invites').insert({
      server_id: server.id,
      code,
      created_by: user?.id ?? null,
    })
    if (!err) {
      setInviteCode(`${window.location.origin}/#invite/${code}`)
      fetchInvites()
    }
  }

  const copyInviteLink = (code: string) => {
    const url = `${window.location.origin}/#invite/${code}`
    navigator.clipboard.writeText(url)
  }

  const deleteServer = async () => {
    if (deleteConfirm !== server.name) return
    setError(null)
    if (backend) {
      try {
        await servers.delete(server.id)
        onSaved()
        onClose()
      } catch (e) {
        setError((e as Error).message || 'Server konnte nicht gelöscht werden.')
      }
      return
    }
    const { error: err } = await supabase.from('servers').delete().eq('id', server.id)
    if (!err) {
      onSaved()
      onClose()
    } else {
      setError(err.message || 'Server konnte nicht gelöscht werden. Bist du Owner oder Admin?')
    }
  }

  const handleSaveProfile = async () => {
    setError(null)
    setLoading(true)
    if (backend) {
      try {
        await servers.update(server.id, {
          name: name.trim(),
          icon_url: iconUrl.trim() || null,
          description: description.trim() || null,
          banner_color: bannerColor,
        })
        onSaved()
      } catch (e) {
        setError((e as Error).message)
      }
      setLoading(false)
      return
    }
    const { error: err } = await supabase
      .from('servers')
      .update({
        name: name.trim(),
        icon_url: iconUrl.trim() || null,
        description: description.trim() || null,
        banner_color: bannerColor,
      })
      .eq('id', server.id)
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      onSaved()
    }
  }

  const handleCreateRole = async (name?: string, color?: string) => {
    const roleName = (name ?? newRoleName).trim()
    const roleColor = color ?? newRoleColor
    if (!roleName) return
    setError(null)
    setLoading(true)
    if (backend) {
      try {
        const created = await servers.createRole(server.id, { name: roleName, color: roleColor })
        setNewRoleName('')
        setNewRoleColor('#99aab5')
        await fetchRoles()
        if (created) setSelectedRole(created as ServerRole)
      } catch (e) {
        setError((e as Error).message)
      }
      setLoading(false)
      return
    }
    const maxPos = Math.max(0, ...roles.map((r) => r.position))
    const { data: created, error: err } = await supabase.from('server_roles').insert({
      server_id: server.id,
      name: roleName,
      color: roleColor,
      position: maxPos + 1,
      permissions: 3147264,
    }).select().single()
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setNewRoleName('')
      setNewRoleColor('#99aab5')
      await fetchRoles()
      if (created) setSelectedRole(created as ServerRole)
    }
  }

  const handleUpdateRole = async (role: ServerRole, updates: Partial<ServerRole>) => {
    setError(null)
    if (backend) {
      try {
        await servers.updateRole(server.id, role.id, updates)
        setSelectedRole((prev) => (prev?.id === role.id ? { ...prev, ...updates } : prev))
        fetchRoles()
      } catch (e) {
        setError((e as Error).message)
      }
      return
    }
    const { error: err } = await supabase
      .from('server_roles')
      .update(updates)
      .eq('id', role.id)
    if (err) setError(err.message)
    else {
      setSelectedRole((prev) => (prev?.id === role.id ? { ...prev, ...updates } : prev))
      fetchRoles()
    }
  }

  const handleUpdateRolePermission = async (
    role: ServerRole,
    perm: number,
    value: boolean
  ) => {
    const perms = role.permissions ?? 0
    const newPerms = setAllow(perms, perm, value)
    await handleUpdateRole(role, { permissions: newPerms })
  }

  const handleDeleteRole = async (role: ServerRole) => {
    if (role.name === 'Admin' || role.name === 'Member') {
      setError('Admin- und Member-Rollen können nicht gelöscht werden.')
      return
    }
    setError(null)
    if (backend) {
      try {
        await servers.deleteRole(server.id, role.id)
        setSelectedRole(null)
        fetchRoles()
      } catch (e) {
        setError((e as Error).message)
      }
      return
    }
    const { error: err } = await supabase.from('server_roles').delete().eq('id', role.id)
    if (err) setError(err.message)
    else {
      setSelectedRole(null)
      fetchRoles()
    }
  }

  const handleUploadEmoji = async (files: FileList | File[]) => {
    const fileList = Array.from(files)
    if (fileList.length === 0 || emojis.length + fileList.length > 50) return

    setError(null)
    setEmojiUploading(true)

    if (backend) {
      for (const file of fileList) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
        if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) continue
        const emojiName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'emoji'
        const url = await uploadServerEmoji(file)
        if (url) {
          try {
            await emojis.create(server.id, emojiName, url)
          } catch (e) {
            setError((e as Error).message)
          }
        }
      }
      setEmojiUploading(false)
      fetchEmojis()
      return
    }

    for (const file of fileList) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const validExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
      if (!validExt) continue

      const emojiName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || 'emoji'
      const path = `${server.id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('server-emojis')
        .upload(path, file, { upsert: false })

      if (uploadErr) {
        setError(uploadErr.message)
        continue
      }

      const { data: urlData } = supabase.storage.from('server-emojis').getPublicUrl(path)
      const { error: insertErr } = await supabase.from('server_emojis').insert({
        server_id: server.id,
        name: emojiName,
        image_url: urlData.publicUrl,
      })

      if (insertErr) setError(insertErr.message)
    }

    setEmojiUploading(false)
    fetchEmojis()
  }

  const handleDeleteEmoji = async (emoji: ServerEmoji) => {
    setError(null)
    if (backend) {
      try {
        await emojis.delete(emoji.id)
        fetchEmojis()
      } catch (e) {
        setError((e as Error).message)
      }
      return
    }
    const { error: err } = await supabase.from('server_emojis').delete().eq('id', emoji.id)
    if (err) setError(err.message)
    else fetchEmojis()
  }

  const handleRemoveIcon = async () => {
    setIconUrl('')
    setError(null)
    setLoading(true)
    if (backend) {
      try {
        await servers.update(server.id, { icon_url: null })
        onSaved()
      } catch (_) {}
      setLoading(false)
      return
    }
    const { error: err } = await supabase
      .from('servers')
      .update({ icon_url: null })
      .eq('id', server.id)
    setLoading(false)
    if (!err) onSaved()
  }

  const createdDate = server.created_at
    ? formatDateShort(server.created_at)
    : ''

  const NavSection = ({
    title,
    children,
  }: {
    title: string
    children: React.ReactNode
  }) => (
    <div className="mb-4">
      <h3 className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {title}
      </h3>
      {children}
    </div>
  )

  const NavItem = ({
    id,
    label,
    external,
  }: {
    id: Tab
    label: string
    external?: boolean
  }) => (
    <button
      onClick={() => setTab(id)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-colors ${
        tab === id
          ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]'
      }`}
    >
      {label}
      {external && (
        <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      )}
    </button>
  )

  const NavItemDanger = ({ id, label }: { id: Tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      {label}
    </button>
  )

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-[95vw] max-w-[900px] h-[85vh] max-h-[700px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-tertiary)] flex-shrink-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Server-Einstellungen
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar + Content + Preview */}
        <div className="flex flex-1 min-h-0">
          {/* Linke Navigationsleiste */}
          <nav className="w-52 flex-shrink-0 py-3 px-2 border-r border-[var(--border)] bg-[var(--bg-tertiary)] overflow-y-auto">
            <NavSection title="Unser Server">
              <NavItem id="serverprofil" label="Serverprofil" />
              <NavItem id="server-tag" label="Server-Tag" />
              <NavItem id="beteiligung" label="Beteiligung" />
              <NavItem id="boost-vorteile" label="Boost-Vorteile" />
            </NavSection>
            <NavSection title="Ausdruck">
              <NavItem id="emoji" label="Emoji" />
              <NavItem id="sticker" label="Sticker" />
              <NavItem id="soundboard" label="Soundboard" />
            </NavSection>
            <NavSection title="Personen">
              <NavItem id="mitglieder" label="Mitglieder" />
              <NavItem id="rollen" label="Rollen" />
              <NavItem id="einladungen" label="Einladungen" />
              <NavItem id="zugriff" label="Zugriff" />
            </NavSection>
            <NavSection title="Apps">
              <NavItem id="integrationen" label="Integrationen" />
              <NavItem id="app-verzeichnis" label="App-Verzeichnis" external />
            </NavSection>
            <NavSection title="Moderation">
              <NavItem id="sicherheitseinrichtung" label="Sicherheitseinrichtung" />
              <NavItem id="audit-log" label="Audit-Log" />
              <NavItem id="gebannte-mitglieder" label="Gebannte Mitglieder" />
              <NavItem id="automod" label="AutoMod" />
              <NavItem id="community-aktivieren" label="Community aktivieren" />
            </NavSection>
            <div className="mt-4 pt-2 border-t border-[var(--border)]">
              <NavItem id="servervorlage" label="Servervorlage" />
              {isOwner && <NavItemDanger id="server-loeschen" label="Server löschen" />}
            </div>
          </nav>

          {/* Hauptinhalt */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto min-w-0">
              {tab === 'serverprofil' && (
                <div className="p-6 max-w-xl">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                    Serverprofil
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mb-6">
                    Passe an, wie dein Server in Einladungslinks und, falls aktiviert, in „Server entdecken“ und Ankündigungskanal-Nachrichten erscheint
                  </p>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        placeholder="Unser Server"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Icon
                      </label>
                      <p className="text-xs text-[var(--text-muted)] mb-2">
                        Wir empfehlen ein Bild von mindestens 512x512 px.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={iconUrl}
                          onChange={(e) => setIconUrl(e.target.value)}
                          className="flex-1 px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] text-sm"
                          placeholder="https://..."
                        />
                        <button
                          onClick={handleSaveProfile}
                          disabled={loading}
                          className="px-4 py-2.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50"
                        >
                          Server-Icon ändern
                        </button>
                        <button
                          onClick={handleRemoveIcon}
                          className="px-4 py-2.5 rounded border border-[var(--accent-danger)] text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10 text-sm font-medium"
                        >
                          Icon entfernen
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Banner
                      </label>
                      <div className="grid grid-cols-5 gap-4">
                        {BANNER_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setBannerColor(color)}
                            className={`aspect-[2/1] rounded border-2 transition-all ${
                              bannerColor === color
                                ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30'
                                : 'border-transparent hover:border-[var(--border)]'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Eigenschaften
                      </label>
                      <p className="text-xs text-[var(--text-muted)] mb-2">
                        Füge bis zu 5 Eigenschaften hinzu, um die Interessen und die Persönlichkeit deines Servers zu zeigen.
                      </p>
                      <div className="space-y-2">
                        {properties.map((p, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-lg">😊</span>
                            <input
                              type="text"
                              value={p}
                              onChange={(e) => {
                                const next = [...properties]
                                next[i] = e.target.value
                                setProperties(next)
                              }}
                              className="flex-1 px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                              placeholder="Eigenschaft hinzufügen"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                        Beschreibung
                      </label>
                      <p className="text-xs text-[var(--text-muted)] mb-2">
                        Wie hat dein Server angefangen? Warum sollten Personen beitreten?
                      </p>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                        placeholder="Wie hat dein Server angefangen? Warum sollten Personen beitreten?"
                      />
                    </div>

                    {error && <p className="text-[var(--accent-danger)] text-sm">{error}</p>}
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium disabled:opacity-50"
                    >
                      Änderungen speichern
                    </button>
                  </div>
                </div>
              )}

              {tab === 'emoji' && (
                <div className="p-6 max-w-xl">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                    Emoji
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    Füge bis zu 50 personalisierte Emojis hinzu, die jeder auf diesem Server verwenden kann.
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mb-6">
                    Animierte GIF-Emojis sind Mitgliedern mit Discord Nitro vorbehalten.
                  </p>

                  <div
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-[var(--accent)]') }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-[var(--accent)]') }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('ring-2', 'ring-[var(--accent)]')
                      if (e.dataTransfer.files.length && emojis.length < 50) {
                        handleUploadEmoji(e.dataTransfer.files)
                      }
                    }}
                    className="border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center"
                  >
                    <input
                      type="file"
                      id="emoji-upload"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files
                        if (files?.length && emojis.length + files.length <= 50) {
                          handleUploadEmoji(files)
                        }
                        e.target.value = ''
                      }}
                    />
                    <label
                      htmlFor="emoji-upload"
                      className="cursor-pointer block"
                    >
                      <button
                        type="button"
                        onClick={() => document.getElementById('emoji-upload')?.click()}
                        disabled={emojiUploading || emojis.length >= 50}
                        className="px-6 py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium disabled:opacity-50"
                      >
                        Emoji hochladen
                      </button>
                    </label>
                    <p className="text-xs text-[var(--text-muted)] mt-3">
                      Du kannst mehrere Emojis hochladen oder per Drag & Drop hierher ziehen. Die Emojis werden nach dem Dateinamen benannt.
                    </p>
                  </div>

                  {emojis.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                        Hochgeladene Emojis ({emojis.length}/50)
                      </h4>
                      <div className="grid grid-cols-8 gap-2">
                        {emojis.map((emoji) => (
                          <div
                            key={emoji.id}
                            className="group relative aspect-square rounded bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden"
                          >
                            <img
                              src={emoji.image_url}
                              alt={emoji.name}
                              className="w-10 h-10 object-contain"
                              title={`:${emoji.name}:`}
                            />
                            <button
                              onClick={() => handleDeleteEmoji(emoji)}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                            >
                              Löschen
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && <p className="mt-4 text-[var(--accent-danger)] text-sm">{error}</p>}
                </div>
              )}

              {tab === 'rollen' && (
                <div className="flex h-full">
                  {/* Linke Sidebar: ZURÜCK, +, Rollenliste */}
                  <div className="w-48 flex-shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-tertiary)]">
                    <div className="p-3 border-b border-[var(--border)] flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRole(null)}
                        className="p-1.5 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Zurück"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Zurück</span>
                      <button
                        onClick={() => handleCreateRole('Neue Rolle', '#99aab5')}
                        disabled={loading}
                        className="ml-auto p-1.5 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
                        title="Neue Rolle"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-2">
                      {roles.map((role) => (
                        <button
                          key={role.id}
                          onClick={() => { setSelectedRole(role); setRoleEditTab('anzeige') }}
                          className={`w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-[var(--bg-modifier-hover)] ${
                            selectedRole?.id === role.id ? 'bg-[var(--bg-modifier-active)]' : ''
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: role.color }}
                          />
                          <span className="text-sm font-medium truncate" style={{ color: role.color }}>
                            {role.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Rechtes Panel: Rolle bearbeiten */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {selectedRole ? (
                      <>
                        {/* Header mit Tabs */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
                          <h3 className="text-lg font-semibold text-[var(--text-primary)] truncate">
                            Rolle bearbeiten — {selectedRole.name}
                          </h3>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
                              {(['anzeige', 'berechtigungen', 'links', 'mitglieder'] as const).map((t) => (
                                <button
                                  key={t}
                                  onClick={() => setRoleEditTab(t)}
                                  className={`px-3 py-2 text-sm font-medium ${
                                    roleEditTab === t
                                      ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)] -mb-px'
                                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                  }`}
                                >
                                  {t === 'anzeige' && 'Anzeige'}
                                  {t === 'berechtigungen' && 'Berechtigungen'}
                                  {t === 'links' && 'Links'}
                                  {t === 'mitglieder' && `Mitglieder verwalten (${members.filter((m) => m.roles.some((r) => r.id === selectedRole.id)).length})`}
                                </button>
                              ))}
                            </div>
                            {selectedRole.name !== 'Admin' && selectedRole.name !== 'Member' && (
                              <button
                                onClick={() => handleDeleteRole(selectedRole)}
                                className="p-2 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--accent-danger)]"
                                title="Rolle löschen"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                          {roleEditTab === 'anzeige' && (
                            <div className="flex flex-col gap-6 max-w-xl">
                              <div>
                                <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">Rollenname *</label>
                                <input
                                  type="text"
                                  value={selectedRole.name}
                                  onChange={(e) => setSelectedRole({ ...selectedRole, name: e.target.value })}
                                  onBlur={() => handleUpdateRole(selectedRole, { name: selectedRole.name })}
                                  className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)]"
                                />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Rollenstil</h4>
                                <div className="flex gap-3">
                                  <div className="flex-1 p-4 rounded-lg border-2 border-[var(--accent)] bg-[var(--bg-tertiary)]">
                                    <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-2" style={{ backgroundColor: `${selectedRole.color}40` }}>
                                      <span className="text-2xl">👤</span>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)] mb-2">Beispiel</p>
                                    <span className="inline-block px-3 py-1 rounded text-sm font-medium" style={{ backgroundColor: `${selectedRole.color}30`, color: selectedRole.color }}>Fest</span>
                                  </div>
                                  <div className="flex-1 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] opacity-50">
                                    <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-2" style={{ background: `linear-gradient(135deg, ${selectedRole.color}, #999)` }}>
                                      <span className="text-2xl">👤</span>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)] mb-2">Beispiel</p>
                                    <span className="inline-block px-3 py-1 rounded text-sm text-[var(--text-muted)]">Farbverlauf</span>
                                  </div>
                                  <div className="flex-1 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] opacity-50">
                                    <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-2">
                                      <span className="text-2xl">👤</span>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)] mb-2">Beispiel</p>
                                    <span className="inline-block px-3 py-1 rounded text-sm text-[var(--text-muted)]">Holografisch</span>
                                  </div>
                                </div>
                                <p className="text-[var(--text-muted)] text-sm mt-2">Bestimmte Rollen magisch machen</p>
                                <p className="text-[var(--text-muted)] text-sm">Schalte neue Rollenstile mit Boosts frei.</p>
                                <button type="button" className="mt-2 px-4 py-2 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)] text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                                  Mit Boosts freischalten
                                </button>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">Farbe der Rolle *</label>
                                <p className="text-sm text-[var(--text-muted)] mb-3">Mitglieder verwenden die Farbe der höchsten Rolle, der sie zugeordnet sind.</p>
                                <div className="flex flex-wrap gap-2">
                                  <input
                                    type="color"
                                    value={selectedRole.color}
                                    onChange={(e) => handleUpdateRole(selectedRole, { color: e.target.value })}
                                    className="w-10 h-10 rounded cursor-pointer border-2 border-[var(--accent)] flex-shrink-0"
                                  />
                                  {ROLE_COLORS.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => handleUpdateRole(selectedRole, { color: c })}
                                      className={`w-8 h-8 rounded flex-shrink-0 ${
                                        selectedRole.color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-secondary)]' : ''
                                      }`}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">Rollenicon <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]">LVL 2</span></label>
                                <p className="text-sm text-[var(--text-muted)] mb-3">Lade ein Bild hoch, das kleiner als 256 kB ist, oder wähle ein benutzerdefiniertes Emoji von diesem Server aus. Wir raten dir, ein Bild mit mindestens 64x64 Pixeln zu verwenden.</p>
                                <button type="button" className="px-4 py-2 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)] text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  Bild auswählen
                                </button>
                              </div>
                              <div className="flex items-center justify-between p-3 rounded bg-[var(--bg-tertiary)]">
                                <span className="text-sm text-[var(--text-primary)]">Mitglieder in der rechten Anzeige anhand ihrer Rollen gruppieren</span>
                                <button type="button" className="relative w-12 h-6 rounded-full bg-[var(--accent)]">
                                  <span className="absolute top-0.5 left-0.5 block w-5 h-5 rounded-full bg-white shadow transition-transform translate-x-6" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between p-3 rounded bg-[var(--bg-tertiary)]">
                                <div>
                                  <span className="text-sm text-[var(--text-primary)]">Jedem erlauben, diese Rolle zu @Erwähnen</span>
                                  <p className="text-xs text-[var(--text-muted)] mt-1">Mitglieder mit der Berechtigung, @everyone, @here und alle Rollen zu erwähnen, können auch diese Rolle anpingen.</p>
                                </div>
                                <button type="button" className="relative w-12 h-6 rounded-full bg-[var(--bg-secondary)] flex-shrink-0">
                                  <span className="absolute top-0.5 left-0.5 block w-5 h-5 rounded-full bg-white shadow transition-transform" />
                                </button>
                              </div>
                              <div className="p-4 rounded bg-[var(--bg-tertiary)]">
                                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Server mit Rolle betrachten</h4>
                                <p className="text-sm text-[var(--text-muted)] mb-3">Dadurch kannst du ausprobieren, welche Aktionen diese Rolle ausführen kann und welche Kanäle für sie sichtbar sind. Nur für Servereigentümer und Administratoren verfügbar.</p>
                                <button type="button" className="px-4 py-2 rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-modifier-hover)] text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                                  Server mit Rolle betrachten
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                              </div>
                            </div>
                          )}
                          {roleEditTab === 'berechtigungen' && (
                            <div className="max-w-xl space-y-6">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Berechtigungen</h4>
                                <button type="button" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                                  Berechtigungen löschen
                                </button>
                              </div>
                              {PERMISSION_GROUPS.map((group) => (
                                <div key={group.title}>
                                  <h5 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{group.title}</h5>
                                  <div className="space-y-2">
                                    {group.permissions.map((perm) => (
                                      <div
                                        key={perm.key}
                                        className="flex items-start justify-between gap-4 p-3 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)]"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-[var(--text-primary)]">{perm.label}</span>
                                            <label className="relative w-12 h-6 rounded-full flex-shrink-0 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={hasPermission(selectedRole.permissions ?? 0, perm.value)}
                                                onChange={(e) =>
                                                  handleUpdateRolePermission(selectedRole, perm.value, e.target.checked)
                                                }
                                                className="sr-only peer"
                                              />
                                              <span className="block w-full h-full rounded-full bg-[var(--bg-secondary)] peer-checked:bg-[var(--accent)] transition-colors" />
                                              <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-7" />
                                            </label>
                                          </div>
                                          <p className="text-xs text-[var(--text-muted)] mt-1">{perm.description}</p>
                                          {perm.warning && (
                                            <div className="flex items-start gap-2 mt-2 p-2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                              </svg>
                                              <span className="text-xs">{perm.warning}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {roleEditTab === 'links' && (
                            <div className="max-w-xl">
                              <p className="text-sm text-[var(--text-muted)]">Rollen-Links werden in einer späteren Version unterstützt.</p>
                            </div>
                          )}
                          {roleEditTab === 'mitglieder' && (
                            <div className="max-w-xl">
                              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Mitglieder mit dieser Rolle</h4>
                              <div className="space-y-2">
                                {members.filter((m) => m.roles.some((r) => r.id === selectedRole.id)).map(({ profile }) => (
                                  <div key={profile.id} className="flex items-center gap-3 px-3 py-2 rounded bg-[var(--bg-tertiary)]">
                                    <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--bg-secondary)] flex-shrink-0">
                                      {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                                          {profile.username.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-sm font-medium text-[var(--text-primary)]">{profile.username}</span>
                                  </div>
                                ))}
                                {members.filter((m) => m.roles.some((r) => r.id === selectedRole.id)).length === 0 && (
                                  <p className="text-sm text-[var(--text-muted)]">Keine Mitglieder mit dieser Rolle.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-muted)]">
                        <p className="text-sm mb-2">Wähle eine Rolle zum Bearbeiten</p>
                        <p className="text-xs">Oder klicke auf + um eine neue Rolle zu erstellen</p>
                        <div className="mt-4 flex gap-2">
                          <input
                            type="text"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="Rollenname"
                            className="px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm text-[var(--text-primary)] w-40"
                          />
                          <input type="color" value={newRoleColor} onChange={(e) => setNewRoleColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]" />
                          <button
                            onClick={handleCreateRole}
                            disabled={loading || !newRoleName.trim()}
                            className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50"
                          >
                            Rolle erstellen
                          </button>
                        </div>
                      </div>
                    )}
                    {error && <p className="px-6 pb-4 text-[var(--accent-danger)] text-sm">{error}</p>}
                  </div>
                </div>
              )}

              {tab === 'mitglieder' && (
                <div className="p-6 max-w-xl">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Mitglieder</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-6">
                    {memberCount} Mitglieder auf diesem Server
                  </p>
                  <div className="space-y-2">
                    {members.map(({ profile, roles }) => (
                      <div
                        key={profile.id}
                        className="flex items-center gap-3 px-3 py-2 rounded bg-[var(--bg-tertiary)]"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-secondary)] flex-shrink-0">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[var(--text-muted)]">
                              {profile.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--text-primary)] truncate">{profile.username}</p>
                          {roles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {roles.map((r) => (
                                <span
                                  key={r.id}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: `${r.color}20`, color: r.color }}
                                >
                                  {r.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'einladungen' && (
                <div className="p-6 max-w-xl">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Einladungen</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-6">
                    Erstelle Einladungslinks, damit andere deinem Server beitreten können.
                  </p>
                  <button
                    onClick={createInvite}
                    className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium mb-4"
                  >
                    Einladung erstellen
                  </button>
                  {inviteCode && (
                    <div className="flex items-center gap-2 mb-4 p-3 rounded bg-[var(--bg-tertiary)]">
                      <code className="flex-1 text-sm text-[var(--text-primary)] truncate">{inviteCode}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(inviteCode)}
                        className="px-2 py-1 rounded bg-[var(--accent)] text-white text-sm"
                      >
                        Kopieren
                      </button>
                    </div>
                  )}
                  {invites.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Aktive Einladungen</h4>
                      <div className="space-y-2">
                        {invites.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-tertiary)]">
                            <code className="text-sm text-[var(--text-muted)]">{inv.code}</code>
                            <button
                              onClick={() => copyInviteLink(inv.code)}
                              className="text-sm text-[var(--accent)] hover:underline"
                            >
                              Link kopieren
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'server-loeschen' && (
                <div className="p-6 max-w-xl">
                  {isOwner ? (
                    <>
                      <h3 className="text-lg font-semibold text-[var(--accent-danger)] mb-1">Server löschen</h3>
                      <p className="text-sm text-[var(--text-muted)] mb-4">
                        Diese Aktion kann nicht rückgängig gemacht werden. Alle Kanäle, Nachrichten und Einstellungen werden entfernt.
                      </p>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                          Gib den Servernamen <strong>{server.name}</strong> ein, um zu bestätigen:
                        </label>
                        <input
                          type="text"
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          placeholder={server.name}
                          className="w-full px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-danger)]"
                        />
                      </div>
                      {error && <p className="text-[var(--accent-danger)] text-sm mb-2">{error}</p>}
                      <button
                        onClick={deleteServer}
                        disabled={deleteConfirm !== server.name}
                        className="px-4 py-2 rounded bg-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/90 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Server endgültig löschen
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">
                      Nur der Server-Besitzer kann den Server löschen.
                    </p>
                  )}
                </div>
              )}

              {tab === 'audit-log' && (
                <div className="p-6 max-w-xl">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Audit-Log</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">
                    Protokoll der Server-Aktionen (Kick, Ban, Rollenänderungen, etc.)
                  </p>
                  {auditLog.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">Noch keine Einträge.</p>
                  ) : (
                    <div className="space-y-2">
                      {auditLog.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 px-3 py-2 rounded bg-[var(--bg-tertiary)]"
                        >
                          <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                            {formatDateTime(entry.created_at)}
                          </span>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{entry.action}</span>
                            {entry.target_type && (
                              <span className="text-sm text-[var(--text-muted)]">
                                {' '}→ {entry.target_type}
                              </span>
                            )}
                            {entry.details && Object.keys(entry.details).length > 0 && (
                              <pre className="text-xs text-[var(--text-muted)] mt-1 truncate">
                                {userSettings.streamerMode ? '*** (Streamer-Modus)' : JSON.stringify(entry.details)}
                              </pre>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!['serverprofil', 'rollen', 'emoji', 'mitglieder', 'einladungen', 'server-loeschen', 'audit-log'].includes(tab) && (
                <div className="p-6 flex flex-col items-center justify-center min-h-[200px] text-center text-[var(--text-muted)]">
                  <p className="text-sm">Dieser Bereich wird bald verfügbar sein.</p>
                </div>
              )}
            </div>

            {/* Rechte Vorschau-Karte (nur bei Serverprofil) */}
            {tab === 'serverprofil' && (
              <div className="w-56 flex-shrink-0 p-6 flex justify-center">
                <div className="w-full max-w-[200px] rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-tertiary)]">
                  <div
                    className="h-16 flex items-center justify-center"
                    style={{ backgroundColor: bannerColor }}
                  />
                  <div className="p-4 flex flex-col items-center">
                    <div className="w-16 h-16 -mt-10 rounded-full border-4 border-[var(--bg-tertiary)] overflow-hidden bg-[var(--bg-secondary)] flex items-center justify-center">
                      {iconUrl ? (
                        <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-[var(--text-muted)]">
                          {name.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-[var(--text-primary)] mt-2 truncate w-full text-center">
                      {name || 'Server'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      • {memberCount} Mitglieder
                    </p>
                    {createdDate && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Gegründet am {createdDate}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
