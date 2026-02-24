/**
 * ChannelList - Text- und Voice-Channels (Discord-Style)
 * Einklappbare Kategorien, Nutzer in Voice-Channels, Speaking-Indikator
 */
import { useEffect, useState, useCallback } from 'react'
import type { Channel, Server } from '../lib/supabase'
import type { ApiChannelCategory } from '../lib/api'

type ChannelCategory = ApiChannelCategory
import { channels as apiChannels, servers as apiServers } from '../lib/api'
import { useServerPermissions } from '../hooks/useServerPermissions'
import { useVoiceSessions } from '../hooks/useVoiceSessions'
import { ChannelModal } from './ChannelModal'
import { ServerSettingsModal } from './ServerSettingsModal'
import { ServerContextMenu } from './ServerContextMenu'

interface ChannelListProps {
  serverId: string | null
  selectedChannelId: string | null
  onSelectChannel: (channel: Channel | null) => void
  onJoinVoice?: (channelId: string) => Promise<void>
  isInVoice?: boolean
  currentVoiceChannelId?: string | null
  speakingUserIds?: Set<string>
}

function ChannelCategory({
  title,
  icon,
  channels,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  collapsed,
  onToggle,
  canManageServer,
  canManageChannels,
  onServerSettings,
  onAddChannel,
  voiceSessionsByChannel,
  speakingUserIds,
}: {
  title: string
  icon: React.ReactNode
  channels: Channel[]
  selectedId: string | null
  onSelect: (ch: Channel) => void
  onEdit: (ch: Channel) => void
  onDelete: (ch: Channel) => void
  collapsed: boolean
  onToggle: () => void
  canManageServer: boolean
  canManageChannels: boolean
  onServerSettings?: () => void
  onAddChannel?: () => void
  voiceSessionsByChannel?: Map<string, { userId: string; username: string; avatarUrl: string | null; isMuted: boolean; hasVideo?: boolean; isScreenSharing?: boolean }[]>
  speakingUserIds?: Set<string>
}) {
  if (channels.length === 0) return null
  const isVoice = channels[0]?.type === 'voice'

  return (
    <div className="mb-1 group/cat">
      <div className="flex items-center gap-1 px-2 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 cursor-pointer select-none flex-1 min-w-0 text-left"
        >
          <svg
            className={`w-4 h-4 transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M7 10l5 5 5-5z" />
          </svg>
          {icon}
          <span className="text-xs font-semibold uppercase truncate">{title}</span>
        </button>
        {(canManageServer || canManageChannels) && (onServerSettings || onAddChannel) && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity flex-shrink-0">
            {onServerSettings && canManageServer && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onServerSettings()
                }}
                className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Server-Einstellungen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
            {onAddChannel && canManageChannels && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAddChannel()
                }}
                className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                title="Kanal erstellen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      {!collapsed &&
        channels.map((ch) => {
          const users = isVoice ? (voiceSessionsByChannel?.get(ch.id) ?? []) : []
          return (
            <div key={ch.id} className="mx-2">
              <div
                className={`group rounded flex items-center gap-2 text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)] cursor-pointer ${
                  selectedId === ch.id ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : ''
                }`}
              >
                <button
                  onClick={() => onSelect(ch)}
                  className="flex-1 min-w-0 text-left px-2 py-1.5 flex items-center gap-2 truncate"
                >
                  {ch.type === 'text' ? (
                    <span className="text-[var(--text-muted)] flex-shrink-0">#</span>
                  ) : (
                    <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  )}
                  <span className="truncate">{ch.name}</span>
                </button>
                {canManageChannels && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(ch)
                      }}
                      className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      title="Bearbeiten"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(ch)
                      }}
                      className="p-1 rounded hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                      title="Löschen"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              {/* Nutzer im Voice-Channel */}
              {isVoice && users.length > 0 && (
                <div className="ml-4 pl-2 border-l border-[var(--border)] space-y-0.5 py-1">
                  {users.map((u) => {
                    const isSpeaking = speakingUserIds?.has(u.userId)
                    return (
                      <div
                        key={u.userId}
                        className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-200 ${
                          isSpeaking ? 'text-white bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                        }`}
                      >
                        <div className="relative w-5 h-5 rounded-full overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {isSpeaking && (
                            <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-[var(--bg-secondary)]" />
                          )}
                        </div>
                        <span className="text-xs truncate flex-1 min-w-0">{u.username}</span>
                        {u.hasVideo && (
                          <svg className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Kamera an">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                        {u.isScreenSharing && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white flex-shrink-0" title="Bildschirm teilen">
                            LIVE
                          </span>
                        )}
                        {u.isMuted && (
                          <svg className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63z" />
                          </svg>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

export function ChannelList({ serverId, selectedChannelId, onSelectChannel, onJoinVoice, isInVoice, currentVoiceChannelId, speakingUserIds = new Set() }: ChannelListProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [categories, setCategories] = useState<ChannelCategory[]>([])
  const [server, setServer] = useState<Server | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [modalChannel, setModalChannel] = useState<Channel | null | 'create'>(null)
  const [showCategoryPrompt, setShowCategoryPrompt] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Channel | null>(null)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [showServerDropdown, setShowServerDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ x: number; y: number } | null>(null)

  const voiceChannelIds = channels.filter((c) => c.type === 'voice').map((c) => c.id)
  const voiceSessionsByChannel = useVoiceSessions(serverId, voiceChannelIds)

  const toggleCategory = (id: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const groupChannelsByCategory = () => {
    const byCat = new Map<string | null, Channel[]>()
    byCat.set(null, [])
    categories.forEach((c) => byCat.set(c.id, []))
    channels.forEach((ch) => {
      const list = byCat.get(ch.category_id ?? null) ?? []
      list.push(ch)
      byCat.set(ch.category_id ?? null, list)
    })
    byCat.forEach((list, catId) => {
      list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    })
    return byCat
  }

  const { canManageServer, canManageChannels } = useServerPermissions(serverId)

  const fetchChannels = useCallback(async () => {
    if (!serverId) return
    try {
      const [chData, catData] = await Promise.all([
        apiChannels.list(serverId),
        apiChannels.listCategories(serverId),
      ])
      setChannels(chData ?? [])
      setCategories((catData ?? []) as ChannelCategory[])
    } catch {
      setChannels([])
      setCategories([])
    }
  }, [serverId])

  useEffect(() => {
    if (!serverId) {
      setChannels([])
      setServer(null)
      return
    }
    const fetchServer = async () => {
      try {
        const data = await apiServers.get(serverId)
        setServer(data as Server)
      } catch {
        setServer(null)
      }
    }
    fetchServer()
    fetchChannels()
  }, [serverId, fetchChannels])

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!serverId || !name) return
    try {
      await apiChannels.createCategory({ server_id: serverId, name })
      fetchChannels()
    } catch (_) {}
    setShowCategoryPrompt(false)
    setNewCategoryName('')
  }

  const handleDeleteChannel = async (ch: Channel) => {
    try {
      await apiChannels.delete(ch.id)
      setDeleteConfirm(null)
      fetchChannels()
      onSelectChannel(null)
    } catch (_) {}
  }

  const channelsByCategory = groupChannelsByCategory()
  const sortedCategories = [...categories].sort((a, b) => a.position - b.position)

  if (!serverId) {
    return (
      <div className="w-60 flex flex-col items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-muted)] text-sm p-4">
        <p>Wähle einen Server</p>
      </div>
    )
  }

  return (
    <div className="w-60 flex flex-col overflow-hidden bg-[var(--bg-secondary)]">
      <div className="h-12 px-4 flex items-center justify-between gap-2 border-b border-[var(--border)] shadow-sm">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setDropdownPos({ x: rect.left, y: rect.bottom })
                setShowServerDropdown((prev) => !prev)
              }}
              className="flex items-center gap-1 min-w-0 flex-1 text-left group/name hover:text-[var(--text-primary)] cursor-pointer"
            >
          <span className="font-semibold text-[var(--text-primary)] truncate">
            {server?.name ?? 'Server'}
          </span>
          <svg
            className={`w-4 h-4 flex-shrink-0 text-[var(--text-muted)] group-hover/name:text-[var(--text-primary)] transition-transform ${showServerDropdown ? 'rotate-180' : ''}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </button>
        <button
          className="w-8 h-8 rounded flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)] flex-shrink-0 cursor-pointer"
          title="Zu Server einladen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </button>
      </div>

      {/* Dropdown-Menü unter Servername */}
      {showServerDropdown && server && dropdownPos && (
        <ServerContextMenu
          x={dropdownPos.x}
          y={dropdownPos.y}
          server={server}
          canManageServer={canManageServer}
          canManageChannels={canManageChannels}
          onClose={() => setShowServerDropdown(false)}
          onServerSettings={() => setShowServerSettings(true)}
          onAddChannel={() => setModalChannel('create')}
          onAddCategory={() => setShowCategoryPrompt(true)}
        />
      )}
      <div className="flex-1 overflow-y-auto hide-scrollbar py-2 min-h-0">
        {/* Ohne Kategorie */}
        {(channelsByCategory.get(null)?.length ?? 0) > 0 && (
          <ChannelCategory
            title="Ohne Kategorie"
            icon={
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
              </svg>
            }
            channels={channelsByCategory.get(null) ?? []}
            selectedId={selectedChannelId}
            onSelect={(ch) => {
              onSelectChannel(ch)
              if (ch.type === 'voice' && onJoinVoice && (!isInVoice || currentVoiceChannelId !== ch.id)) {
                onJoinVoice(ch.id)
              }
            }}
            onEdit={setModalChannel}
            onDelete={setDeleteConfirm}
            collapsed={collapsedCategories.has('__none__')}
            onToggle={() => toggleCategory('__none__')}
            canManageServer={canManageServer}
            canManageChannels={canManageChannels}
            onServerSettings={() => setShowServerSettings(true)}
            onAddChannel={() => setModalChannel('create')}
            voiceSessionsByChannel={voiceSessionsByChannel}
            speakingUserIds={speakingUserIds}
          />
        )}
        {sortedCategories.map((cat) => {
          const catChannels = channelsByCategory.get(cat.id) ?? []
          if (catChannels.length === 0) return null
          return (
            <ChannelCategory
              key={cat.id}
              title={cat.name}
              icon={
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              }
              channels={catChannels}
              selectedId={selectedChannelId}
              onSelect={(ch) => {
                onSelectChannel(ch)
                if (ch.type === 'voice' && onJoinVoice && (!isInVoice || currentVoiceChannelId !== ch.id)) {
                  onJoinVoice(ch.id)
                }
              }}
              onEdit={setModalChannel}
              onDelete={setDeleteConfirm}
              collapsed={collapsedCategories.has(cat.id)}
              onToggle={() => toggleCategory(cat.id)}
              canManageServer={canManageServer}
              canManageChannels={canManageChannels}
              onServerSettings={() => setShowServerSettings(true)}
              onAddChannel={() => setModalChannel('create')}
              voiceSessionsByChannel={voiceSessionsByChannel}
              speakingUserIds={speakingUserIds}
            />
          )
        })}
        {channels.length === 0 && (
          <p className="px-4 py-2 text-sm text-[var(--text-muted)]">
            {canManageChannels ? 'Keine Channels — Klicke + um einen zu erstellen' : 'Keine Channels'}
          </p>
        )}
      </div>

      {/* Modal: Server-Einstellungen */}
      {showServerSettings && server && (
        <ServerSettingsModal
          server={server}
          onClose={() => setShowServerSettings(false)}
          onSaved={async () => {
            if (!serverId) return
            try {
              const data = await apiServers.get(serverId)
              setServer(data as Server)
            } catch (_) {}
          }}
        />
      )}

      {/* Modal: Kanal erstellen / bearbeiten */}
      {modalChannel && serverId && (
        <ChannelModal
          serverId={serverId}
          channel={modalChannel === 'create' ? null : modalChannel}
          onClose={() => setModalChannel(null)}
          onSaved={fetchChannels}
          onDeleted={() => {
            fetchChannels()
            onSelectChannel(null)
          }}
        />
      )}

      {/* Kategorie erstellen Prompt */}
      {showCategoryPrompt && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowCategoryPrompt(false)}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Kategorie erstellen</h3>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Kategoriename"
              className="w-full px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory()
                if (e.key === 'Escape') { setShowCategoryPrompt(false); setNewCategoryName('') }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCategoryPrompt(false); setNewCategoryName('') }}
                className="px-4 py-2 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)]"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium disabled:opacity-50"
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Löschen-Bestätigung */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Kanal löschen?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              „{deleteConfirm.name}“ wird unwiderruflich gelöscht. Alle Nachrichten gehen verloren.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)]"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDeleteChannel(deleteConfirm)}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
