/**
 * MainLayout - Discord-ähnliches Layout
 * [ServerList | ChannelList] + UserBar unten (spannt über beide) | Chat | MemberList
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { invites, servers, dm, channels } from '../lib/api'
import { FRIENDS_ID } from './ServerList'
import { ServerList } from './ServerList'
import { ChannelList } from './ChannelList'
import { ServerSettingsModal } from './ServerSettingsModal'
import type { Server } from '../lib/supabase'
import { FriendsSidebar } from './FriendsSidebar'
import { Chat } from './Chat'
import { DmChat } from './DmChat'
import { MemberList } from './MemberList'
import { VoicePanel } from './VoicePanel'
import { UserBar } from './UserBar'
import { DevModeOverlay } from './DevModeOverlay'
import { TrainingBanner } from './TrainingBanner'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useHotkeys } from '../hooks/useHotkeys'
import { useAuth } from '../contexts/AuthContext'
import type { Channel, Profile } from '../lib/supabase'

export function MainLayout() {
  const { user, profile } = useAuth()
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const lastTextChannelByServer = useRef<Record<string, Channel>>({})
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null)
  const [selectedDmUser, setSelectedDmUser] = useState<Profile | null>(null)
  const [serverSettingsServer, setServerSettingsServer] = useState<Server | null>(null)
  const [serverSettingsInitialTab, setServerSettingsInitialTab] = useState<string | undefined>()
  const [showMemberList, setShowMemberList] = useState(true)
  const [messageIdToScroll, setMessageIdToScroll] = useState<string | null>(null)

  const {
    isInVoice,
    isMuted,
    isVideoOn,
    isScreenSharing,
    localVideoStream,
    remoteStreams,
    currentChannelId,
    voiceUsers,
    speakingUserIds,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  } = useVoiceChat(user?.id, profile?.username ?? 'User', profile?.avatar_url)

  const isFriendsView = selectedServerId === FRIENDS_ID

  useHotkeys({
    onToggleMute: isInVoice ? toggleMute : undefined,
    onOpenSettings: () => window.dispatchEvent(new CustomEvent('astricord:open-user-settings')),
  })

  const [voiceChannelName, setVoiceChannelName] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    const channelsMatch = hash.match(/^#channels\/([^/]+)\/([^/]+)\/([^/]+)$/)
    if (channelsMatch && user) {
      const [, serverIdFromHash, channelIdFromHash, messageIdFromHash] = channelsMatch
      ;(async () => {
        try {
          const { channels } = await import('../lib/api')
          const chList = await channels.list(serverIdFromHash)
          const ch = (chList ?? []).find((c: { id: string }) => c.id === channelIdFromHash)
          if (ch) {
            setSelectedServerId(serverIdFromHash)
            setSelectedChannel(ch)
            setSelectedDmId(null)
            setSelectedDmUser(null)
            setMessageIdToScroll(messageIdFromHash)
            window.history.replaceState(null, '', window.location.pathname)
            setTimeout(() => setMessageIdToScroll(null), 3000)
          }
        } catch (_) {}
      })()
      return
    }
    const m = hash.match(/^#invite\/([a-zA-Z0-9-]+)$/)
    if (!m || !user) return
    const code = m[1]
    ;(async () => {
      try {
        const data = await invites.getByCode(code)
        if (data?.server_id) {
          await servers.join(code)
          setSelectedServerId(data.server_id)
          setSelectedChannel(null)
          setSelectedDmId(null)
          setSelectedDmUser(null)
        }
      } catch (_) {}
      window.history.replaceState(null, '', window.location.pathname)
    })()
  }, [user])

  const [voiceServerName, setVoiceServerName] = useState<string | null>(null)

  useEffect(() => {
    if (!currentChannelId || !isInVoice) {
      setVoiceChannelName(null)
      setVoiceServerName(null)
      return
    }
    const fetch = async () => {
      if (!selectedServerId || selectedServerId === FRIENDS_ID) return
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

  const handleOpenDm = useCallback(async (profile: Profile) => {
    try {
      const { id } = await dm.createConversation(profile.id)
      setSelectedServerId(FRIENDS_ID)
      setSelectedChannel(null)
      setSelectedDmId(id)
      setSelectedDmUser(profile)
    } catch (_) {}
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
      <TrainingBanner />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Linker Bereich: Server-Liste + Channel-Liste + UserBar unten (statisch, keine Scrollbar) */}
        <div className="flex flex-col flex-shrink-0 border-r border-[var(--border)] overflow-hidden">
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <ServerList
              selectedServerId={selectedServerId}
              onSelectServer={async (id) => {
                setSelectedServerId(id)
                setSelectedChannel(null)
                setSelectedDmId(null)
                setSelectedDmUser(null)
              }}
              onOpenServerSettings={(server) => setServerSettingsServer(server)}
            />
            {isFriendsView ? (
              <FriendsSidebar
                selectedDmId={selectedDmId}
                onSelectDm={(convId, otherUser) => {
                  setSelectedDmId(convId)
                  setSelectedDmUser(otherUser)
                }}
              />
            ) : (
              <ChannelList
                serverId={selectedServerId}
                selectedChannelId={selectedChannel?.id ?? null}
                onJoinVoice={joinVoice}
                isInVoice={isInVoice}
                currentVoiceChannelId={currentChannelId}
                onSelectChannel={(ch) => {
                  setSelectedChannel(ch ?? null)
                  setSelectedDmId(null)
                  setSelectedDmUser(null)
                  if (ch && (ch.type === 'text' || ch.type === 'forum')) {
                    lastTextChannelByServer.current[ch.server_id] = ch
                  }
                }}
                speakingUserIds={speakingUserIds}
              />
            )}
          </div>
          {/* UserControlPanel - spannt über ServerBar + Channel-Übersicht */}
          <UserBar
            isInVoice={isInVoice}
            isMuted={isMuted}
            isVideoOn={isVideoOn}
            isScreenSharing={isScreenSharing}
            localVideoStream={localVideoStream}
            remoteStreams={remoteStreams}
            voiceChannelName={voiceChannelName}
            voiceServerName={voiceServerName}
            voiceUsers={voiceUsers}
            speakingUserIds={speakingUserIds}
            selectedChannel={isFriendsView ? null : selectedChannel}
            onJoinVoice={joinVoice}
            onLeaveVoice={leaveVoice}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
          />
        </div>

        {/* Chat-Bereich */}
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)]">
          {isFriendsView ? (
            <DmChat conversationId={selectedDmId} otherUser={selectedDmUser} />
          ) : (
            <Chat
              channel={
                selectedChannel?.type === 'text' || selectedChannel?.type === 'forum'
                  ? selectedChannel
                  : selectedChannel?.type === 'voice' && selectedServerId
                    ? lastTextChannelByServer.current[selectedServerId] ?? null
                    : selectedChannel
              }
              serverId={selectedServerId}
              messageIdToScroll={messageIdToScroll}
              onToggleMembers={() => setShowMemberList((p) => !p)}
              onOpenEmojiSettings={async (serverId) => {
                try {
                  const data = await servers.get(serverId)
                  if (data) {
                    setServerSettingsServer(data)
                    setServerSettingsInitialTab('emoji')
                  }
                } catch (_) {}
              }}
            />
          )}
          {/* VoicePanel unten (bei Voice-Kanal oder wenn in Voice) */}
          <VoicePanel
            channel={isFriendsView ? null : selectedChannel}
            isInVoice={isInVoice}
            isVideoOn={isVideoOn}
            isScreenSharing={isScreenSharing}
            localVideoStream={localVideoStream}
            remoteStreams={remoteStreams}
            voiceUsers={voiceUsers}
            speakingUserIds={speakingUserIds}
            joinVoice={joinVoice}
            leaveVoice={leaveVoice}
            toggleMute={toggleMute}
            toggleVideo={toggleVideo}
            toggleScreenShare={toggleScreenShare}
            isMuted={isMuted}
          />
        </div>

        {/* Rechte Sidebar: Mitglieder (statisch, keine Scrollbar) */}
        {!isFriendsView && selectedServerId && showMemberList && (
          <MemberList serverId={selectedServerId} onOpenDm={handleOpenDm} />
        )}
      </div>

      <DevModeOverlay />

      {/* Modal: Server-Einstellungen (aus Kontextmenü) */}
      {serverSettingsServer && (
        <ServerSettingsModal
          server={serverSettingsServer}
          onClose={() => {
            setServerSettingsServer(null)
            setServerSettingsInitialTab(undefined)
          }}
          initialTab={serverSettingsInitialTab as 'emoji' | undefined}
          onSaved={async () => {
            try {
              const data = await servers.get(serverSettingsServer.id)
              if (data) setServerSettingsServer(data)
            } catch (_) {}
          }}
        />
      )}
    </div>
  )
}
