/**
 * MemberProfilePopover - Discord-Style Profil-Popup bei Linksklick auf Mitglied
 */
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Profile, ServerRole } from '../lib/supabase'

interface MemberProfilePopoverProps {
  x: number
  y: number
  member: { userId: string; profile: Profile; roles: ServerRole[] }
  isOnline: boolean
  isSelf: boolean
  onClose: () => void
  onOpenDm?: (profile: Profile) => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export function MemberProfilePopover({
  x,
  y,
  member,
  isOnline,
  isSelf,
  onClose,
  onOpenDm,
  anchorRef,
}: MemberProfilePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [voiceChannel, setVoiceChannel] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (anchorRef?.current && anchorRef.current.contains(e.target as Node)) return
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, anchorRef])

  useEffect(() => {
    const fetchVoiceSession = async () => {
      try {
        const data = await api<{ channel_id: string; channel_name: string } | null>(
          `/api/voice/user/${member.userId}/session`
        )
        if (data) setVoiceChannel({ id: data.channel_id, name: data.channel_name })
      } catch {
        setVoiceChannel(null)
      }
    }
    fetchVoiceSession()
  }, [member.userId])

  useEffect(() => {
    const el = popoverRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth) el.style.left = `${x - rect.width}px`
    if (rect.bottom > window.innerHeight) el.style.top = `${y - rect.height}px`
    if (rect.left < 0) el.style.left = '8px'
    if (rect.top < 0) el.style.top = '8px'
  }, [x, y])

  const handleEditProfile = () => {
    if (isSelf) {
      window.dispatchEvent(new CustomEvent('astricord:open-user-settings'))
    }
    onClose()
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-[100] w-80 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-2xl overflow-hidden"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header: Avatar + Status */}
      <div className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--bg-secondary)]">
              {member.profile.avatar_url ? (
                <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-[var(--text-muted)]">
                  {member.profile.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[var(--bg-tertiary)] ${
                isOnline ? 'bg-[var(--accent-success)]' : 'bg-[var(--text-muted)]'
              }`}
              title={isOnline ? 'Online' : 'Offline'}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">{member.profile.username}</h3>
            <p className="text-sm text-[var(--text-muted)] truncate">{member.profile.username}</p>
            {member.roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {member.roles.slice(0, 5).map((r) => (
                  <span
                    key={r.id}
                    className="rounded px-1.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${r.color}20`, color: r.color }}
                  >
                    {r.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Custom Status */}
        {(member.profile.custom_status || member.profile.status_message) && (
          <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--bg-secondary)]/50">
            <span className="text-lg">💬</span>
            <span className="text-sm text-[var(--text-secondary)] truncate">
              {member.profile.custom_status || member.profile.status_message}
            </span>
          </div>
        )}
      </div>

      {/* Sprachstatus */}
      {voiceChannel && (
        <div className="px-4 py-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="font-medium">Sprachstatus</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--bg-secondary)] flex-shrink-0">
              {member.profile.avatar_url ? (
                <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                  {member.profile.username.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-[var(--text-muted)]">→</span>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            <span className="text-sm text-[var(--text-primary)] truncate">{voiceChannel.name}</span>
          </div>
        </div>
      )}

      {/* Peppe dein Profil auf - nur für eigenes Profil */}
      {isSelf && (
        <div className="px-4 py-2 border-t border-[var(--border)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--text-primary)]">Peppe dein Profil auf</span>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-modifier-hover)] text-sm text-[var(--text-primary)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Vorteile anzeigen
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-modifier-hover)] text-sm text-[var(--text-primary)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Shop
            </button>
          </div>
        </div>
      )}

      {/* Aktionen */}
      <div className="p-4 pt-2 border-t border-[var(--border)]">
        {isSelf ? (
          <button
            onClick={handleEditProfile}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Profil bearbeiten
          </button>
        ) : (
          onOpenDm && (
            <button
              onClick={() => {
                onOpenDm(member.profile)
                onClose()
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Nachricht senden
            </button>
          )
        )}
      </div>
    </div>
  )
}
