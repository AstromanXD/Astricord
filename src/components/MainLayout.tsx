/**
 * MainLayout - Discord-ähnliches Layout
 * [ServerList | ChannelList] + UserBar unten (spannt über beide) | Chat | MemberList
 */
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBackend, invites, servers, dm } from '../lib/api'
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
import { TrainingBanner } from './TrainingBanner'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useAuth } from '../contexts/AuthContext'
import type { Channel, Profile } from '../lib/supabase'

export function MainLayout() {
  const { user, profile } = useAuth()
  const backend = useBackend()
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null)
  const [selectedDmUser, setSelectedDmUser] = useState<Profile | null>(null)
  const [serverSettingsServer, setServerSettingsServer] = useState<Server | null>(null)
  const [serverSettingsInitialTab, setServerSettingsInitialTab] = useState<string | undefined>()
  const [showMemberList, setShowMemberList] = useState(true)

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

  const [voiceChannelName, setVoiceChannelName] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    const m = hash.match(/^#invite\/([a-zA-Z0-9-]+)$/)
    if (!m || !user) return
    const code = m[1]
    ;(async () => {
      try {
        if (backend) {
          const data = await invites.getByCode(code)
          if (data?.server_id) {
            await servers.join(code)
            setSelectedServerId(data.server_id)
            setSelectedChannel(null)
            setSelectedDmId(null)
            setSelectedDmUser(null)
          }
        } else {
          const { data } = await supabase.from('server_invites').select('server_id').eq('code', code).single()
          if (data?.server_id) {
            await supabase.rpc('join_server', { p_server_id: data.server_id })
            setSelectedServerId(data.server_id)
            setSelectedChannel(null)
            setSelectedDmId(null)
            setSelectedDmUser(null)
          }
        }
      } catch (_) {}
      window.history.replaceState(null, '', window.location.pathname)
    })()
  }, [user, backend])

  const [voiceServerName, setVoiceServerName] = useState<string | null>(null)

  useEffect(() => {
    if (!currentChannelId || !isInVoice) {
      setVoiceChannelName(null)
      setVoiceServerName(null)
      return
    }
    const fetch = async () => {
      if (backend && selectedServerId && selectedServerId !== FRIENDS_ID) {
        try {
          const { channels } = await import('../lib/api')
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
        return
      }
      const { data: ch } = await supabase
        .from('channels')
        .select('name, server_id')
        .eq('id', currentChannelId)
        .single()
      if (ch) {
        setVoiceChannelName(ch.name)
        const { data: srv } = await supabase
          .from('servers')
          .select('name')
          .eq('id', ch.server_id)
          .single()
        setVoiceServerName(srv?.name ?? null)
      }
    }
    fetch()
  }, [currentChannelId, isInVoice, backend, selectedServerId])

  const handleOpenDm = useCallback(
    async (profile: Profile) => {
      if (backend) {
        try {
          const { id } = await dm.createConversation(profile.id)
          setSelectedServerId(FRIENDS_ID)
          setSelectedChannel(null)
          setSelectedDmId(id)
          setSelectedDmUser(profile)
        } catch (_) {}
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: existing } = await supabase
        .from('dm_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      const convIds = (existing ?? []).map((c) => c.conversation_id)
      if (convIds.length > 0) {
        const { data: match } = await supabase
          .from('dm_participants')
          .select('conversation_id')
          .eq('user_id', profile.id)
          .in('conversation_id', convIds)
          .limit(1)
          .single()

        if (match) {
          setSelectedServerId(FRIENDS_ID)
          setSelectedChannel(null)
          setSelectedDmId(match.conversation_id)
          setSelectedDmUser(profile)
          return
        }
      }

      const { data: newConvId, error } = await supabase.rpc('create_dm_conversation', {
        other_user_id: profile.id,
      })

      if (!error && newConvId) {
        setSelectedServerId(FRIENDS_ID)
        setSelectedChannel(null)
        setSelectedDmId(newConvId as string)
        setSelectedDmUser(profile)
      }
    },
    [backend]
  )

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
                onSelectChannel={(ch) => {
                  setSelectedChannel(ch ?? null)
                  setSelectedDmId(null)
                  setSelectedDmUser(null)
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
              channel={selectedChannel}
              serverId={selectedServerId}
              onToggleMembers={() => setShowMemberList((p) => !p)}
              onOpenEmojiSettings={async (serverId) => {
                const { data } = await supabase.from('servers').select('*').eq('id', serverId).single()
                if (data) {
                  setServerSettingsServer(data)
                  setServerSettingsInitialTab('emoji')
                }
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
            const { data } = await supabase
              .from('servers')
              .select('*')
              .eq('id', serverSettingsServer.id)
              .single()
            if (data) setServerSettingsServer(data)
          }}
        />
      )}
    </div>
  )
}
