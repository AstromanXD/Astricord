/**
 * UserProfilePopup - Discord-Style Profil-Popup beim Klick auf die UserBar
 * Zeigt Avatar, Username, Status, Sprachstatus und Profil-Aktionen
 */
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { UserSettingsModal } from './UserSettingsModal'

interface VoiceUser {
  userId: string
  username: string
  avatarUrl: string | null
  isMuted: boolean
}

interface UserProfilePopupProps {
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  isInVoice?: boolean
  isMuted?: boolean
  voiceChannelName?: string | null
  voiceServerName?: string | null
  voiceUsers?: VoiceUser[]
}

const PROMO_DISMISSED_KEY = 'astricord-profile-promo-dismissed'

export function UserProfilePopup({
  onClose,
  anchorRef,
  isInVoice = false,
  isMuted = false,
  voiceChannelName = null,
  voiceServerName = null,
  voiceUsers = [],
}: UserProfilePopupProps) {
  const { user, profile, signOut } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [promoDismissed, setPromoDismissed] = useState(() => {
    try {
      return localStorage.getItem(PROMO_DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        popupRef.current &&
        !popupRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, anchorRef])

  const dismissPromo = () => {
    setPromoDismissed(true)
    try {
      localStorage.setItem(PROMO_DISMISSED_KEY, '1')
    } catch {}
  }

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id)
      onClose()
    }
  }

  if (!user || !profile) return null

  const customStatus = (profile as { custom_status?: string | null }).custom_status
  const statusText = customStatus?.trim() || 'am Chillen'

  return (
    <>
      <div
        ref={popupRef}
        className="absolute bottom-full left-2 mb-1 w-72 rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl z-50"
      >
        {/* Profil-Header mit dunklem Hintergrund */}
        <div className="relative px-4 pt-6 pb-4 bg-gradient-to-b from-[#2c2f33] to-[var(--bg-secondary)]">
          <div className="flex gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--accent)] ring-4 ring-[var(--bg-secondary)]">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span
                className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[var(--bg-secondary)] bg-[var(--accent-success)]"
                title="Online"
              />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-lg font-bold text-[var(--accent)] truncate">{profile.username}</h3>
              <p className="text-sm text-[var(--text-muted)] truncate">{profile.username.toLowerCase()}</p>
              {/* Platzhalter-Badges */}
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded bg-[var(--bg-tertiary)]/80 flex items-center justify-center"
                    title="Badge"
                  >
                    <span className="text-[10px] text-[var(--text-muted)]">?</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Peppe dein Profil auf - dismissible */}
        {!promoDismissed && (
          <div className="relative mx-3 mt-3 px-3 py-2.5 rounded-lg bg-[var(--accent)]/20 border border-[var(--accent)]/30">
            <button
              onClick={dismissPromo}
              className="absolute top-2 right-2 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Schließen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <p className="text-sm font-medium text-[var(--text-primary)] pr-6">Peppe dein Profil auf</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { onClose(); setSettingsOpen(true) }}
                className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] flex items-center justify-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Vorteile anzeigen
              </button>
              <button className="flex-1 px-2 py-1.5 rounded text-xs font-medium bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] flex items-center justify-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Shop
              </button>
            </div>
          </div>
        )}

        {/* Sprachstatus */}
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Sprachstatus</span>
            <div className="flex items-center gap-1">
              <button className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Info">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Mehr">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-sm text-[var(--text-muted)] flex items-center gap-1.5">
            <span className="text-base">🛋️</span>
            {statusText}
          </p>
          {isInVoice && (
            <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-[var(--accent)] flex-shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                    {profile.username.charAt(0)}
                  </div>
                )}
              </div>
              <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {isMuted ? (
                <svg className="w-4 h-4 text-[var(--accent-danger)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[var(--accent-success)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
              <span className="text-sm text-[var(--text-primary)] truncate flex-1">
                {voiceChannelName ?? 'Sprachkanal'}
                {voiceServerName && ` · ${voiceServerName}`}
              </span>
              {voiceUsers.length > 0 && (
                <div className="flex -space-x-2">
                  {voiceUsers.slice(0, 3).map((u) => (
                    <div
                      key={u.userId}
                      className="w-5 h-5 rounded-full overflow-hidden border-2 border-[var(--bg-tertiary)] bg-[var(--accent)]"
                      title={u.username}
                    >
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">
                          {u.username.charAt(0)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profil-Aktionen */}
        <div className="p-2 space-y-0.5">
          <button
            onClick={() => { onClose(); setSettingsOpen(true) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] text-left transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="flex-1 text-sm font-medium">Profil bearbeiten</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/80 text-white">NEU</span>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] text-left transition-colors"
          >
            <span className="w-3 h-3 rounded-full bg-[var(--accent-success)] flex-shrink-0" />
            <span className="flex-1 text-sm font-medium">Online</span>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] text-left transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="flex-1 text-sm font-medium">Account wechseln</span>
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={copyUserId}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] text-left transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
            <span className="flex-1 text-sm font-medium">Nutzer-ID kopieren</span>
          </button>
          <div className="border-t border-[var(--border)] my-1" />
          <button
            onClick={() => { onClose(); signOut() }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--accent-danger)]/10 text-[var(--accent-danger)] text-left transition-colors"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="flex-1 text-sm font-medium">Abmelden</span>
          </button>
        </div>
      </div>

      {settingsOpen && (
        <UserSettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </>
  )
}
