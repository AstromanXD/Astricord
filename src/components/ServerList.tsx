/**
 * ServerList - Server-Sidebar (links)
 * Zeigt nur Server, bei denen der User Mitglied ist
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Server } from '../lib/supabase'
import { useBackend, servers as apiServers } from '../lib/api'
import { useServerPermissions } from '../hooks/useServerPermissions'
import { ServerContextMenu } from './ServerContextMenu'
import { CreateServerModal } from './CreateServerModal'
import { useAuth } from '../contexts/AuthContext'

interface ServerListProps {
  selectedServerId: string | null
  onSelectServer: (serverId: string) => void
  onOpenServerSettings?: (server: Server) => void
}

export const FRIENDS_ID = '__friends__'

export function ServerList({ selectedServerId, onSelectServer, onOpenServerSettings }: ServerListProps) {
  const { user } = useAuth()
  const backend = useBackend()
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; server: Server } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const contextMenuServerId = contextMenu?.server.id ?? null
  const { canManageServer, canManageChannels } = useServerPermissions(contextMenuServerId)
  const hasAutoSelected = useRef(false)

  const loadServers = useCallback(async () => {
    if (!user) {
      setServers([])
      setLoading(false)
      return
    }
    if (backend) {
      try {
        const data = await apiServers.list()
        setServers(data ?? [])
        setLoading(false)
        if (data?.length && !hasAutoSelected.current) {
          hasAutoSelected.current = true
          onSelectServer(data[0].id)
        } else if (!data?.length && !hasAutoSelected.current) {
          hasAutoSelected.current = true
          onSelectServer(FRIENDS_ID)
        }
      } catch {
        setServers([])
        setLoading(false)
        if (!hasAutoSelected.current) {
          hasAutoSelected.current = true
          onSelectServer(FRIENDS_ID)
        }
      }
      return
    }
    const { data: memberships } = await supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', user.id)
    const serverIds = (memberships ?? []).map((m) => m.server_id)
    if (serverIds.length === 0) {
      setServers([])
      setLoading(false)
      if (!hasAutoSelected.current) {
        hasAutoSelected.current = true
        onSelectServer(FRIENDS_ID)
      }
      return
    }
    const { data } = await supabase
      .from('servers')
      .select('*')
      .in('id', serverIds)
      .order('created_at')
    setServers(data ?? [])
    setLoading(false)
    if (data?.length && !hasAutoSelected.current) {
      hasAutoSelected.current = true
      onSelectServer(data[0].id)
    }
  }, [user?.id, onSelectServer, backend])

  useEffect(() => {
    if (!user) hasAutoSelected.current = false
    loadServers()
  }, [loadServers])

  const handleServerCreated = useCallback(
    (serverId: string) => {
      loadServers()
      onSelectServer(serverId)
    },
    [onSelectServer, loadServers]
  )

  if (loading) {
    return (
      <div className="w-[72px] flex flex-col items-center py-3 bg-[var(--bg-sidebar)] border-r border-[var(--border)]">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-hover)] animate-pulse" />
      </div>
    )
  }

  const ServerButton = ({
    id,
    selected,
    onClick,
    onContextMenu,
    children,
    title,
  }: {
    id: string
    selected: boolean
    onClick: () => void
    onContextMenu?: (e: React.MouseEvent) => void
    children: React.ReactNode
    title: string
  }) => (
    <div className="relative flex items-center justify-center w-full group">
      <div
        className={`absolute left-0 w-1 h-2 rounded-r-full bg-white transition-all duration-200 ${
          selected ? 'h-8 opacity-100' : 'h-0 opacity-0 group-hover:h-5'
        }`}
      />
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`w-12 h-12 flex items-center justify-center text-lg font-bold transition-all duration-200 cursor-pointer ${
          selected
            ? 'rounded-xl bg-[var(--accent)] text-white'
            : 'rounded-[24px] bg-[var(--bg-tertiary)] text-[var(--text-primary)] group-hover:rounded-xl group-hover:bg-[var(--accent)] group-hover:text-white'
        }`}
        title={title}
      >
        {children}
      </button>
    </div>
  )

  return (
    <div className="w-[72px] flex flex-col items-center py-3 gap-2 bg-[var(--bg-sidebar)]">
      <ServerButton
        id={FRIENDS_ID}
        selected={selectedServerId === FRIENDS_ID}
        onClick={() => onSelectServer(FRIENDS_ID)}
        title="Freunde / DMs"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292 14.68 14.68 0 0 0 4.328-2.758.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c1.42 1.1 2.868 1.98 4.328 2.758a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
      </ServerButton>
      <div className="w-8 h-0.5 rounded-full bg-[var(--border)]" />
      <ServerButton
        id="__add__"
        selected={false}
        onClick={() => setShowCreateModal(true)}
        title="Server hinzufügen"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 11h-7V4h-2v7H4v2h7v7h2v-7h7z" />
        </svg>
      </ServerButton>
      {servers.map((server) => (
        <ServerButton
          key={server.id}
          id={server.id}
          selected={selectedServerId === server.id}
          onClick={() => onSelectServer(server.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, server })
          }}
          title={server.name}
        >
          {server.icon_url ? (
            <img src={server.icon_url} alt="" className="w-full h-full rounded-[inherit] object-cover" />
          ) : (
            <span className="text-[15px] font-semibold">{server.name.charAt(0).toUpperCase()}</span>
          )}
        </ServerButton>
      ))}

      {contextMenu && onOpenServerSettings && (
        <ServerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          server={contextMenu.server}
          canManageServer={canManageServer}
          canManageChannels={canManageChannels}
          onClose={() => setContextMenu(null)}
          onServerSettings={() => onOpenServerSettings(contextMenu.server)}
        />
      )}
      {showCreateModal && (
        <CreateServerModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleServerCreated}
        />
      )}
    </div>
  )
}
