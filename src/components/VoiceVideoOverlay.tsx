/**
 * VoiceVideoOverlay - Zeigt lokales und Remote-Video im Voice-Chat
 */
import { useRef, useEffect } from 'react'

interface VoiceVideoOverlayProps {
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  voiceUsers: { userId: string; username: string }[]
  onClose?: () => void
}

function VideoTile({ stream, label, muted }: { stream: MediaStream; label: string; muted?: boolean }) {
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
    <div className="relative rounded-lg overflow-hidden bg-black aspect-video min-w-[160px] max-w-[240px]">
      <video ref={videoRef} autoPlay muted={muted} playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-white truncate">
        {label}
      </div>
    </div>
  )
}

export function VoiceVideoOverlay({
  localStream,
  remoteStreams,
  voiceUsers,
  onClose,
}: VoiceVideoOverlayProps) {
  const hasContent = localStream || remoteStreams.size > 0
  if (!hasContent) return null

  const userMap = Object.fromEntries(voiceUsers.map((u) => [u.userId, u.username]))

  return (
    <div className="absolute bottom-16 left-4 right-4 z-30 flex gap-2 flex-wrap p-2 rounded-lg bg-[var(--bg-tertiary)]/95 border border-[var(--border)] shadow-xl">
      {localStream && (
        <VideoTile stream={localStream} label="Du" muted />
      )}
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
        <VideoTile
          key={userId}
          stream={stream}
          label={userMap[userId] ?? 'Unbekannt'}
        />
      ))}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded bg-black/30 hover:bg-black/50 text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
