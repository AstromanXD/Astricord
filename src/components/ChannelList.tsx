/**
 * ChannelList - Text- und Voice-Channels (Discord-Style)
 * Einklappbare Kategorien, Nutzer in Voice-Channels, Speaking-Indikator
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Channel, Server } from '../lib/supabase'
import { useBackend, channels as apiChannels, servers as apiServers } from '../lib/api'
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
  const [server, setServer] = useState<Server | null>(null)
  const [textCollapsed, setTextCollapsed] = useState(false)
  const [voiceCollapsed, setVoiceCollapsed] = useState(false)
  const [modalChannel, setModalChannel] = useState<Channel | null | 'create'>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Channel | null>(null)
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [showServerDropdown, setShowServerDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ x: number; y: number } | null>(null)

  const voiceChannels = channels.filter((c) => c.type === 'voice')
  const voiceChannelIds = voiceChannels.map((c) => c.id)
  const voiceSessionsByChannel = useVoiceSessions(serverId, voiceChannelIds)

  const backend = useBackend()
  const { canManageServer, canManageChannels } = useServerPermissions(serverId)

  const fetchChannels = useCallback(async () => {
    if (!serverId) return
    if (backend) {
      try {
        const data = await apiChannels.list(serverId)
        setChannels(data ?? [])
      } catch {
        setChannels([])
      }
      return
    }
    const { data } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', serverId)
      .order('created_at')
    setChannels(data ?? [])
  }, [serverId, backend])

  useEffect(() => {
    if (!serverId) {
      setChannels([])
      setServer(null)
      return
    }
    const fetchServer = async () => {
      if (backend) {
        try {
          const data = await apiServers.get(serverId)
          setServer(data as Server)
        } catch {
          setServer(null)
        }
      } else {
        const { data } = await supabase.from('servers').select('*').eq('id', serverId).single()
        setServer(data ?? null)
      }
    }
    fetchServer()
    fetchChannels()
  }, [serverId, fetchChannels, backend])

  const handleDeleteChannel = async (ch: Channel) => {
    if (backend) {
      try {
        await apiChannels.delete(ch.id)
        setDeleteConfirm(null)
        fetchChannels()
        onSelectChannel(null)
      } catch (_) {}
    } else {
      const { error } = await supabase.from('channels').delete().eq('id', ch.id)
      if (!error) {
        setDeleteConfirm(null)
        fetchChannels()
        onSelectChannel(null)
      }
    }
  }

  const textChannels = channels.filter((c) => c.type === 'text')

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
        />
      )}
      <div className="flex-1 overflow-y-auto hide-scrollbar py-2 min-h-0">
        <ChannelCategory
          title="Textkanäle"
          icon={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.45114 3.10635 8.68672 2.82527 8.99782 2.82527H9.60332C9.91442 2.82527 10.15 3.10635 10.1046 3.41262L9.47001 7H15.76L16.3968 3.41262C16.4511 3.10635 16.6867 2.82527 16.9978 2.82527H17.6033C17.9144 2.82527 18.15 3.10635 18.1046 3.41262L17.47 7H21.4049C21.7155 7 21.951 7.28023 21.8974 7.58619L21.7224 8.58619C21.6805 8.82544 21.4728 9 21.2299 9H17.65L16.59 15H19.9949C20.3055 15 20.541 15.2802 20.4874 15.5862L20.3124 16.5862C20.2705 16.8254 20.0628 17 19.8199 17H16.24L15.6033 20.5874C15.5489 20.8937 15.3133 21.1747 15.0022 21.1747H14.3967C14.0856 21.1747 13.85 20.8937 13.8954 20.5874L14.53 17H8.24001L7.60332 20.5874C7.54895 20.8937 7.31337 21.1747 7.00227 21.1747L6.39677 21L5.88657 21Z" />
            </svg>
          }
          channels={textChannels}
          selectedId={selectedChannelId}
          onSelect={onSelectChannel}
          onEdit={setModalChannel}
          onDelete={setDeleteConfirm}
          collapsed={textCollapsed}
          onToggle={() => setTextCollapsed(!textCollapsed)}
          canManageServer={canManageServer}
          canManageChannels={canManageChannels}
          onServerSettings={() => setShowServerSettings(true)}
          onAddChannel={() => setModalChannel('create')}
        />
        <ChannelCategory
          title="Sprachkanäle"
          icon={
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          }
          channels={voiceChannels}
          selectedId={selectedChannelId}
          onSelect={(ch) => {
            onSelectChannel(ch)
            if (onJoinVoice && (!isInVoice || currentVoiceChannelId !== ch.id)) {
              onJoinVoice(ch.id)
            }
          }}
          onEdit={setModalChannel}
          onDelete={setDeleteConfirm}
          collapsed={voiceCollapsed}
          onToggle={() => setVoiceCollapsed(!voiceCollapsed)}
          canManageServer={canManageServer}
          canManageChannels={canManageChannels}
          onServerSettings={() => setShowServerSettings(true)}
          onAddChannel={() => setModalChannel('create')}
          voiceSessionsByChannel={voiceSessionsByChannel}
          speakingUserIds={speakingUserIds}
        />
        {textChannels.length === 0 && voiceChannels.length === 0 && (
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
            if (backend) {
              try {
                const data = await apiServers.get(serverId)
                setServer(data as Server)
              } catch (_) {}
            } else {
              const { data } = await supabase.from('servers').select('*').eq('id', serverId).single()
              setServer(data ?? null)
            }
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
