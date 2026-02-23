/**
 * VoicePanel - Voice-Control-Bar (Teilnehmer, Mute, Verlassen)
 * Zeigt sich bei Voice-Kanal oder wenn in Voice
 */
import { useState } from 'react'
import type { Channel } from '../lib/supabase'
import { VoiceVideoOverlay } from './VoiceVideoOverlay'

interface VoiceUser {
  userId: string
  username: string
  avatarUrl: string | null
  isMuted: boolean
  hasVideo?: boolean
  isScreenSharing?: boolean
}

interface VoicePanelProps {
  channel: Channel | null
  isInVoice: boolean
  voiceUsers: VoiceUser[]
  speakingUserIds?: Set<string>
  joinVoice: (channelId: string) => Promise<void>
  leaveVoice: () => Promise<void>
  toggleMute: () => Promise<void>
  isMuted: boolean
  isVideoOn?: boolean
  isScreenSharing?: boolean
  localVideoStream?: MediaStream | null
  remoteStreams?: Map<string, MediaStream>
  toggleVideo?: () => Promise<void>
  toggleScreenShare?: () => Promise<void>
}

export function VoicePanel({
  channel,
  isInVoice,
  voiceUsers,
  speakingUserIds = new Set(),
  joinVoice,
  leaveVoice,
  toggleMute,
  isMuted,
  localVideoStream,
  remoteStreams = new Map(),
  toggleVideo,
  toggleScreenShare,
}: VoicePanelProps) {
  const [showVideoOverlay, setShowVideoOverlay] = useState(true)
  const isVoiceChannel = channel?.type === 'voice'
  const showPanel = isVoiceChannel || isInVoice

  if (!showPanel) return null

  return (
    <div className="relative">
      {isInVoice && (localVideoStream || remoteStreams.size > 0) && showVideoOverlay && (
        <VoiceVideoOverlay
          localStream={localVideoStream ?? null}
          remoteStreams={remoteStreams}
          voiceUsers={voiceUsers}
          onClose={() => setShowVideoOverlay(false)}
        />
      )}
      {isInVoice && !showVideoOverlay && (localVideoStream || remoteStreams.size > 0) && (
        <button
          type="button"
          onClick={() => setShowVideoOverlay(true)}
          className="absolute bottom-full left-4 mb-1 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          Video anzeigen
        </button>
      )}
    <div className="h-14 px-4 flex items-center justify-between bg-[var(--bg-secondary)] border-t border-[var(--border)] flex-shrink-0">
      <div className="flex items-center gap-2 overflow-x-auto min-w-0">
        {voiceUsers.map((u) => {
          const isSpeaking = speakingUserIds.has(u.userId)
          return (
            <div
              key={u.userId}
              className={`flex items-center gap-2 px-2 py-1 rounded flex-shrink-0 transition-all duration-200 ${
                isSpeaking ? 'bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="relative w-6 h-6 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-xs overflow-hidden">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  u.username.charAt(0)
                )}
                {isSpeaking && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-transparent" />
                )}
              </div>
              <span className={`text-sm ${isSpeaking ? 'text-white' : 'text-[var(--text-secondary)]'}`}>{u.username}</span>
              {u.hasVideo && (
                <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Kamera an">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {u.isScreenSharing && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white flex-shrink-0" title="Bildschirm teilen">
                  LIVE
                </span>
              )}
              {u.isMuted && <span className="text-xs text-[var(--text-muted)]">(stumm)</span>}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isInVoice ? (
          <>
            {toggleVideo && (
              <button
                onClick={toggleVideo}
                className="p-2 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-primary)]"
                title="Video"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            {toggleScreenShare && (
              <button
                onClick={toggleScreenShare}
                className="p-2 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-primary)]"
                title="Bildschirm teilen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-full transition-colors ${
                isMuted ? 'bg-red-500/20 text-red-400' : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-primary)]'
              }`}
              title={isMuted ? 'Stummschaltung aufheben' : 'Stummschalten'}
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => leaveVoice().catch((e) => console.error('Leave voice failed:', e))}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-medium"
              title="Voice verlassen"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.86-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.68-1.37-2.66-1.86-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
              </svg>
              <span className="text-sm">Verlassen</span>
            </button>
          </>
        ) : isVoiceChannel && channel ? (
          <button
            onClick={() => joinVoice(channel.id)}
            className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors"
          >
            Voice beitreten
          </button>
        ) : null}
      </div>
    </div>
    </div>
  )
}
