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
import { ThemeSwitcher } from './ThemeSwitcher'
import { UserSettingsModal } from './UserSettingsModal'
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
  isVideoOn = false,
  isScreenSharing = false,
  localVideoStream = null,
  remoteStreams: _remoteStreams = new Map(),
  voiceChannelName = null,
  voiceServerName = null,
  voiceUsers: _voiceUsers = [],
  speakingUserIds: _speakingUserIds,
  selectedChannel = null,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
}: UserBarProps) {
  const { user, profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [comingSoonMsg, setComingSoonMsg] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const showComingSoon = (msg: string) => {
    setComingSoonMsg(msg)
    setTimeout(() => setComingSoonMsg(null), 2000)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handler = () => setSettingsOpen(true)
    window.addEventListener('astricord:open-user-settings', handler)
    return () => window.removeEventListener('astricord:open-user-settings', handler)
  }, [])

  if (!user || !profile) return null

  const isVoiceChannel = selectedChannel?.type === 'voice'
  const canJoinVoice = isVoiceChannel && !isInVoice && onJoinVoice

  const IconBtn = ({
    onClick,
    title,
    active,
    danger,
    children,
  }: {
    onClick: () => void
    title: string
    active?: boolean
    danger?: boolean
    children: React.ReactNode
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded flex items-center gap-0.5 transition-colors ${
        danger ? 'text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/20' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]'
      } ${active ? 'text-[var(--text-primary)]' : ''}`}
    >
      {children}
      <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  return (
    <div className="flex flex-col bg-[var(--bg-tertiary)] border-t border-[var(--border)]">
      {/* Voice-Status (nur wenn in Voice) */}
      {isInVoice && (
        <div className="px-2 py-2 space-y-2 border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <svg className="w-4 h-4 text-[var(--accent-success)] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              <span className="text-xs font-medium text-[var(--accent-success)] truncate">
                Sprachchat verbunden
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-colors ${
                      !isMuted ? 'bg-[var(--accent-success)]' : 'bg-[var(--text-muted)]/30'
                    }`}
                    style={{ height: `${8 + i * 2}px` }}
                  />
                ))}
              </div>
              {onLeaveVoice && (
                <button
                  onClick={onLeaveVoice}
                  className="p-1 rounded text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/20"
                  title="Verlassen"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.86-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.68-1.37-2.66-1.86-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] truncate">
            {voiceChannelName} / {voiceServerName ?? 'Server'}
          </p>
          {localVideoStream && (
            <VideoPreview stream={localVideoStream} />
          )}
          <div className="flex gap-1 relative">
            {comingSoonMsg && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs text-[var(--text-primary)] whitespace-nowrap shadow-lg z-10">
                {comingSoonMsg}
              </div>
            )}
            {onToggleVideo && (
              <button
                type="button"
                onClick={onToggleVideo}
                className={`p-1.5 rounded ${isVideoOn ? 'bg-[var(--accent)]/30 text-[var(--accent)]' : 'bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)]'} hover:bg-[var(--bg-modifier-hover)]`}
                title={isVideoOn ? 'Video aus' : 'Video'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            {onToggleScreenShare && (
              <button
                type="button"
                onClick={onToggleScreenShare}
                className={`p-1.5 rounded ${isScreenSharing ? 'bg-[var(--accent)]/30 text-[var(--accent)]' : 'bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)]'} hover:bg-[var(--bg-modifier-hover)]`}
                title={isScreenSharing ? 'Bildschirm teilen beenden' : 'Bildschirm teilen'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => showComingSoon('Aktivitäten – bald verfügbar')}
              className="p-1.5 rounded bg-[var(--bg-secondary)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]"
              title="Aktivitäten"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
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

      {/* User-Bereich */}
      <div className="relative px-2 py-2">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[var(--accent)] flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-tertiary)] bg-[var(--accent-success)]" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-medium text-[var(--text-primary)] truncate text-sm">{profile.username}</p>
            <p className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1">
              {isMuted && (
                <svg className="w-3 h-3 text-[var(--accent-danger)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              )}
              <span>am Chillen</span>
            </p>
          </div>
        </button>

        {/* Voice-Controls + Einstellungen */}
        <div className="flex items-center justify-end gap-0.5 mt-1">
          {onToggleMute !== undefined && (
            <IconBtn
              onClick={onToggleMute}
              title={isMuted ? 'Stummschaltung aufheben' : 'Mikrofon stummschalten'}
              active={!isMuted}
            >
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
            onClick={() => {
              setMenuOpen(false)
              setSettingsOpen(true)
            }}
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

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-2 mb-1 w-56 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl z-50"
        >
          <button
            onClick={() => {
              setMenuOpen(false)
              setSettingsOpen(true)
            }}
            className="w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Einstellungen
          </button>
          <ThemeSwitcher />
          <div className="border-t border-[var(--border)] my-2" />
          <button
            onClick={() => {
              signOut()
              setMenuOpen(false)
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-[var(--bg-hover)] transition-colors"
          >
            Abmelden
          </button>
        </div>
      )}

      {settingsOpen && (
        <UserSettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
