/**
 * AudioPlayer - Discord-ähnlicher Audioplayer mit Dateiinfo und Steuerung
 */
import { useRef, useState, useEffect } from 'react'

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

interface AudioPlayerProps {
  src: string
  filename?: string
  fileSize?: number
}

export function AudioPlayer({ src, filename, fileSize }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(1)

  const displayName = filename || 'Audio'
  const sizeStr = formatFileSize(fileSize)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = volume === 0
  }, [volume])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.pause()
    else audio.play()
  }

  const toggleMute = () => {
    if (volume === 0) {
      setVolume(volumeBeforeMute || 1)
    } else {
      setVolumeBeforeMute(volume)
      setVolume(0)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (v > 0) setVolumeBeforeMute(v)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    audio.currentTime = pct * duration
    setCurrentTime(audio.currentTime)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="max-w-sm rounded-lg bg-[#2F3136] p-3 shadow-sm">
      <audio ref={audioRef} src={src} preload="metadata" />
      {/* Dateianzeige */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 rounded bg-[#5865f2]/30 flex items-center justify-center">
          <svg className="w-5 h-5 text-[#5865f2]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[#f2f3f5] font-medium truncate">{displayName}</p>
          {sizeStr && <p className="text-xs text-[#b5bac1]">{sizeStr}</p>}
        </div>
      </div>
      {/* Steuerung */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-[#f2f3f5] hover:bg-white/10 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Abspielen'}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <span className="flex-shrink-0 text-sm text-[#b5bac1] tabular-nums min-w-[4.5rem]">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
        <div
          className="flex-1 h-1.5 rounded-full bg-[#404249] cursor-pointer overflow-hidden group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full rounded-full bg-[#5865f2] transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 w-24">
          <button
            type="button"
            onClick={toggleMute}
            className="w-8 h-8 rounded flex items-center justify-center text-[#b5bac1] hover:text-[#f2f3f5] hover:bg-white/10 transition-colors"
            aria-label={volume === 0 ? 'Stummschaltung aufheben' : 'Stummschalten'}
          >
            {volume === 0 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : volume < 0.5 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 9v6h4l5 5V4l-5 5H7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-14 h-1.5 rounded-full cursor-pointer accent-[#5865f2] bg-[#404249]"
          />
        </div>
      </div>
    </div>
  )
}
