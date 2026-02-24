/**
 * LeftSidebar - Server-Liste + UserBar darunter (Discord-Style)
 * Bei Voice: Erweiterte Ansicht mit Sprachchat-Status
 */
import { useState, useEffect } from 'react'
import { channels, servers } from '../lib/api'
import { ServerList } from './ServerList'
import { UserBar } from './UserBar'
import type { Channel } from '../lib/supabase'

interface VoiceUser {
  userId: string
  username: string
  avatarUrl: string | null
  isMuted: boolean
}

interface LeftSidebarProps {
  selectedServerId: string | null
  onSelectServer: (id: string) => void
  selectedChannel: Channel | null
  isInVoice: boolean
  isMuted: boolean
  currentChannelId: string | null
  voiceUsers: VoiceUser[]
  onJoinVoice: (channelId: string) => Promise<void>
  onLeaveVoice: () => Promise<void>
  onToggleMute: () => Promise<void>
}

export function LeftSidebar({
  selectedServerId,
  onSelectServer,
  selectedChannel,
  isInVoice,
  isMuted,
  currentChannelId,
  voiceUsers,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
}: LeftSidebarProps) {

  const [voiceChannelName, setVoiceChannelName] = useState<string | null>(null)
  const [voiceServerName, setVoiceServerName] = useState<string | null>(null)

  useEffect(() => {
    if (!currentChannelId || !isInVoice) {
      setVoiceChannelName(null)
      setVoiceServerName(null)
      return
    }
    const fetch = async () => {
      if (!selectedServerId) return
      try {
        const chList = await channels.list(selectedServerId)
        const ch = chList?.find((c) => c.id === currentChannelId)
        if (ch) {
          setVoiceChannelName(ch.name)
          const srv = await servers.get(ch.server_id)
          setVoiceServerName(srv?.name ?? null)
        }
      } catch {
        setVoiceChannelName(null)
        setVoiceServerName(null)
      }
    }
    fetch()
  }, [currentChannelId, isInVoice, selectedServerId])

  return (
    <div className="w-[72px] flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border)]">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <ServerList selectedServerId={selectedServerId} onSelectServer={onSelectServer} />
      </div>
      <UserBar
        isInVoice={isInVoice}
        isMuted={isMuted}
        voiceChannelName={voiceChannelName}
        voiceServerName={voiceServerName}
        voiceUsers={voiceUsers}
        selectedChannel={selectedChannel}
        onJoinVoice={onJoinVoice}
        onLeaveVoice={onLeaveVoice}
        onToggleMute={onToggleMute}
      />
    </div>
  )
}
