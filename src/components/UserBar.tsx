/**
 * UserBar - Unter Server-Liste (Discord-Style)
 * Normal: Avatar, Name, Status, Mikro/Lautsprecher/Einstellungen
 * In Voice: Erweiterte Ansicht mit "Sprachchat verbunden", Kanal, Steuerelemente
 */
import { useState, useRef, useEffect } from 'react'

function VideoPreview({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = videoRef.current
    if (el && stream) {
      el.srcObject = stream
      el.play()
    }
    return () => {
      if (el) el.srcObject = null
    }
  }, [stream])
  return (
    <div className="w-24 h-16 rounded overflow-hidden bg-black flex-shrink-0">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
    </div>
  )
}
import { useAuth } from '../contexts/AuthContext'
import { UserSettingsModal } from './UserSettingsModal'
import { UserProfilePopup } from './UserProfilePopup'
import type { Channel } from '../lib/supabase'

interface VoiceUser {
  userId: string
  username: string
  avatarUrl: string | null
  isMuted: boolean
}

interface UserBarProps {
  isInVoice?: boolean
  isMuted?: boolean
  isVideoOn?: boolean
  isScreenSharing?: boolean
  localVideoStream?: MediaStream | null
  remoteStreams?: Map<string, MediaStream>
  voiceChannelName?: string | null
  voiceServerName?: string | null
  voiceUsers?: VoiceUser[]
  speakingUserIds?: Set<string>
  selectedChannel?: Channel | null
  onJoinVoice?: (channelId: string) => Promise<void>
  onLeaveVoice?: () => Promise<void>
  onToggleMute?: () => Promise<void>
  onToggleVideo?: () => Promise<void>
  onToggleScreenShare?: () => Promise<void>
}

export function UserBar({
  isInVoice = false,
  isMuted = false,
  isVideoOn: _isVideoOn = false,
  isScreenSharing: _isScreenSharing = false,
  localVideoStream = null,
  remoteStreams: _remoteStreams = new Map(),
  voiceChannelName = null,
  voiceServerName = null,
  voiceUsers: _voiceUsers = [],
  speakingUserIds: _speakingUserIds,
  selectedChannel = null,
  onJoinVoice,
  onLeaveVoice: _onLeaveVoice,
  onToggleMute,
  onToggleVideo: _onToggleVideo,
  onToggleScreenShare: _onToggleScreenShare,
}: UserBarProps) {
  const { user, profile } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [_comingSoonMsg, setComingSoonMsg] = useState<string | null>(null)
  const userAreaRef = useRef<HTMLDivElement>(null)

  const showComingSoon = (msg: string) => {
    setComingSoonMsg(msg)
    setTimeout(() => setComingSoonMsg(null), 2000)
  }


  useEffect(() => {
    const handler = () => setSettingsOpen(true)
    window.addEventListener('astricord:open-user-settings', handler)
    return () => window.removeEventListener('astricord:open-user-settings', handler)
  }, [])

  if (!user || !profile) return null

  const isVoiceChannel = selectedChannel?.type === 'voice'
  const canJoinVoice = isVoiceChannel && !isInVoice && onJoinVoice

  const customStatus = (profile as { custom_status?: string | null }).custom_status
  const statusText = customStatus?.trim() || 'am Chillen'

  const IconBtn = ({
    onClick,
    title,
    active,
    danger,
    muted,
    children,
  }: {
    onClick: () => void
    title: string
    active?: boolean
    danger?: boolean
    muted?: boolean
    children: React.ReactNode
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        danger ? 'text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/20' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]'
      } ${active ? 'text-[var(--text-primary)]' : ''} ${muted ? 'opacity-60' : ''}`}
    >
      {children}
    </button>
  )

  return (
    <div className="flex flex-col bg-[var(--bg-tertiary)] border-t border-[var(--border)]">
      {/* Voice-Status (nur wenn in Voice) - Discord-Style */}
      {isInVoice && (
        <div className="px-2 py-2 border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--accent-success)] truncate">Sprachchat verbunden</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">
                {voiceChannelName} / {voiceServerName ?? 'Server'}
              </p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {onToggleMute !== undefined && (
                <IconBtn onClick={onToggleMute} title={isMuted ? 'Stummschaltung aufheben' : 'Mikrofon stummschalten'} muted={isMuted}>
                  {isMuted ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  )}
                </IconBtn>
              )}
              <IconBtn onClick={() => showComingSoon('Lautsprecher – bald verfügbar')} title="Lautsprecher">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              </IconBtn>
              <button
                onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}
                className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]"
                title="Einstellungen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
          {localVideoStream && (
            <div className="mt-2">
              <VideoPreview stream={localVideoStream} />
            </div>
          )}
        </div>
      )}

      {/* Join-Button (wenn Voice-Kanal ausgewählt, aber nicht verbunden) */}
      {canJoinVoice && selectedChannel && (
        <div className="px-2 py-2 border-b border-[var(--border)]">
          <button
            onClick={() => onJoinVoice(selectedChannel.id)}
            className="w-full px-2 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium"
          >
            Beitreten
          </button>
        </div>
      )}

      {/* User-Bereich - Discord-Style: Avatar, Name, Status, Icons in einer Zeile */}
      <div ref={userAreaRef} className="relative flex items-center gap-2 px-2 py-2 min-h-[52px] min-w-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="relative w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-[var(--accent)] ring-2 ring-transparent hover:ring-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-tertiary)] bg-[var(--accent-success)]"
            title="Online"
          />
        </button>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="font-semibold text-[var(--text-primary)] truncate text-sm">{profile.username}</p>
          <p className="text-xs text-[var(--text-muted)] truncate">
            {statusText.startsWith('@') ? statusText : `@${statusText}`}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onToggleMute !== undefined && (
            <IconBtn onClick={onToggleMute} title={isMuted ? 'Stummschaltung aufheben' : 'Mikrofon stummschalten'} muted={isMuted}>
              {isMuted ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </IconBtn>
          )}
          <IconBtn onClick={() => showComingSoon('Lautsprecher – bald verfügbar')} title="Lautsprecher">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </IconBtn>
          <button
            onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}
            className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]"
            title="Einstellungen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {menuOpen && (
        <UserProfilePopup
          onClose={() => setMenuOpen(false)}
          anchorRef={userAreaRef}
          isInVoice={isInVoice}
          isMuted={isMuted}
          voiceChannelName={voiceChannelName}
          voiceServerName={voiceServerName}
          voiceUsers={_voiceUsers}
        />
        )}
      </div>

      {settingsOpen && (
        <UserSettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
