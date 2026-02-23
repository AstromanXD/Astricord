/**
 * ServerSettingsModal - Server-Einstellungen (Discord-Style)
 * Erweiterte Sidebar-Navigation, Serverprofil mit Vorschau
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Server, ServerRole, ServerEmoji, Profile, ServerInvite, AuditLogEntry } from '../lib/supabase'
import {
  CHANNEL_PERMISSIONS,
  PERMISSION_LABELS,
  hasPermission,
  setAllow,
} from '../lib/permissions'
import { useServerPermissions } from '../hooks/useServerPermissions'

const ROLE_PERMISSIONS = [
  CHANNEL_PERMISSIONS.VIEW_CHANNEL,
  CHANNEL_PERMISSIONS.SEND_MESSAGES,
  CHANNEL_PERMISSIONS.MANAGE_CHANNEL,
  CHANNEL_PERMISSIONS.CONNECT,
  CHANNEL_PERMISSIONS.SPEAK,
  CHANNEL_PERMISSIONS.ADMINISTRATOR,
] as const

const BANNER_COLORS = [
  '#4f545c', '#f47b67', '#ed4245', '#faa61a', '#fee75c',
  '#9b59b6', '#5865f2', '#57f287', '#43b581', '#3ba55d',
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
  const { isOwner } = useServerPermissions(server.id)
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

  const fetchRoles = async () => {
    const { data } = await supabase
      .from('server_roles')
      .select('*')
      .eq('server_id', server.id)
      .order('position', { ascending: false })
    setRoles(data ?? [])
    if (!selectedRole && (data?.length ?? 0) > 0) {
      setSelectedRole(data?.[0] ?? null)
    }
  }

  const fetchMemberCount = async () => {
    const { count } = await supabase
      .from('server_members')
      .select('*', { count: 'exact', head: true })
      .eq('server_id', server.id)
    setMemberCount(count ?? 0)
  }

  const fetchEmojis = async () => {
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
    const { data } = await supabase.from('server_invites').select('*').eq('server_id', server.id).order('created_at', { ascending: false })
    setInvites(data ?? [])
  }

  const fetchAuditLog = async () => {
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

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return
    setError(null)
    setLoading(true)
    const maxPos = Math.max(0, ...roles.map((r) => r.position))
    const { error: err } = await supabase.from('server_roles').insert({
      server_id: server.id,
      name: newRoleName.trim(),
      color: newRoleColor,
      position: maxPos + 1,
      permissions: 3147264,
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setNewRoleName('')
      setNewRoleColor('#99aab5')
      fetchRoles()
    }
  }

  const handleUpdateRole = async (role: ServerRole, updates: Partial<ServerRole>) => {
    setError(null)
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
    const { error: err } = await supabase.from('server_emojis').delete().eq('id', emoji.id)
    if (err) setError(err.message)
    else fetchEmojis()
  }

  const handleRemoveIcon = async () => {
    setIconUrl('')
    setError(null)
    setLoading(true)
    const { error: err } = await supabase
      .from('servers')
      .update({ icon_url: null })
      .eq('id', server.id)
    setLoading(false)
    if (!err) onSaved()
  }

  const createdDate = server.created_at
    ? new Date(server.created_at).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })
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
                  <div className="w-48 flex-shrink-0 border-r border-[var(--border)] flex flex-col">
                    <div className="p-3 border-b border-[var(--border)] space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="Neue Rolle"
                          className="flex-1 px-2 py-1.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm text-[var(--text-primary)]"
                        />
                        <input
                          type="color"
                          value={newRoleColor}
                          onChange={(e) => setNewRoleColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-[var(--border)] flex-shrink-0"
                        />
                      </div>
                      <button
                        onClick={handleCreateRole}
                        disabled={loading || !newRoleName.trim()}
                        className="w-full px-3 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Rolle erstellen
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-2">
                      {roles.map((role) => (
                        <button
                          key={role.id}
                          onClick={() => setSelectedRole(role)}
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
                  <div className="flex-1 overflow-y-auto p-6">
                    {selectedRole ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={selectedRole.color}
                              onChange={(e) =>
                                handleUpdateRole(selectedRole, { color: e.target.value })
                              }
                              className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]"
                            />
                            <input
                              type="text"
                              value={selectedRole.name}
                              onChange={(e) =>
                                setSelectedRole({ ...selectedRole, name: e.target.value })
                              }
                              onBlur={() =>
                                handleUpdateRole(selectedRole, { name: selectedRole.name })
                              }
                              className="px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] font-medium"
                            />
                          </div>
                          {selectedRole.name !== 'Admin' && selectedRole.name !== 'Member' && (
                            <button
                              onClick={() => handleDeleteRole(selectedRole)}
                              className="px-3 py-1.5 rounded text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/20 text-sm font-medium"
                            >
                              Rolle löschen
                            </button>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-3">
                            Berechtigungen
                          </h4>
                          <div className="space-y-2">
                            {ROLE_PERMISSIONS.map((perm) => (
                              <label
                                key={perm}
                                className="flex items-center gap-3 p-2 rounded hover:bg-[var(--bg-modifier-hover)] cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={hasPermission(selectedRole.permissions ?? 0, perm)}
                                  onChange={(e) =>
                                    handleUpdateRolePermission(
                                      selectedRole,
                                      perm,
                                      e.target.checked
                                    )
                                  }
                                  className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
                                />
                                <span className="text-sm text-[var(--text-secondary)]">
                                  {PERMISSION_LABELS[perm] ?? 'Administrator'}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-muted)]">
                        <p className="text-sm">Wähle eine Rolle zum Bearbeiten</p>
                      </div>
                    )}
                    {error && <p className="mt-4 text-[var(--accent-danger)] text-sm">{error}</p>}
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
                            {new Date(entry.created_at).toLocaleString('de-DE')}
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
                                {JSON.stringify(entry.details)}
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
