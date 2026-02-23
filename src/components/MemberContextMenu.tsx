/**
 * MemberContextMenu - Discord-Style Rechtsklick-Menü für Mitglieder
 */
import { useEffect, useRef, useState } from 'react'
import type { Profile, ServerRole } from '../lib/supabase'

interface MemberContextMenuProps {
  x: number
  y: number
  member: { userId: string; profile: Profile; roles: ServerRole[] }
  roles: ServerRole[]
  canManageRoles: boolean
  canKickMembers: boolean
  canBanMembers: boolean
  isSelf: boolean
  onClose: () => void
  onProfil: () => void
  onMention: () => void
  onCopyId: () => void
  onRoleToggle: (roleId: string, add: boolean) => void
  onKick?: (userId: string) => void
  onBan?: (userId: string) => void
  onBlock?: (userId: string) => void
}

export function MemberContextMenu({
  x,
  y,
  member,
  roles,
  canManageRoles,
  canKickMembers,
  canBanMembers,
  isSelf,
  onClose,
  onProfil,
  onMention,
  onCopyId,
  onRoleToggle,
  onKick,
  onBan,
  onBlock,
}: MemberContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [rolesOpen, setRolesOpen] = useState(false)

  useEffect(() => {
    const handleClick = () => onClose()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`
    }
  }, [x, y])

  const memberRoleIds = new Set(member.roles.map((r) => r.id))

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[220px] py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-xl"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Profil */}
      <button
        onClick={() => {
          onProfil()
          onClose()
        }}
        className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Profil
      </button>

      <button
        onClick={() => {
          onMention()
          onClose()
        }}
        className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        Erwähnung
      </button>

      {canManageRoles && (
        <>
          <div className="my-1 border-t border-[var(--border)]" />

          {/* Rollen - Submenu */}
          <div
            className="relative"
            onMouseEnter={() => setRolesOpen(true)}
            onMouseLeave={() => setRolesOpen(false)}
          >
            <button
              className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)] flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Rollen
              </span>
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {rolesOpen && (
              <div className="absolute left-full top-0 ml-1 min-w-[180px] py-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-xl">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-modifier-hover)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={memberRoleIds.has(role.id)}
                      onChange={(e) => {
                        onRoleToggle(role.id, e.target.checked)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-[var(--border)] accent-[var(--accent)]"
                    />
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="text-sm truncate" style={{ color: role.color }}>
                      {role.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!isSelf && ((canKickMembers && onKick) || (canBanMembers && onBan)) && (
        <>
          <div className="my-1 border-t border-[var(--border)]" />
          {onKick && (
            <button
              onClick={() => {
                onKick(member.userId)
                onClose()
              }}
              className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Kicken
            </button>
          )}
          {onBan && (
            <button
              onClick={() => {
                onBan(member.userId)
                onClose()
              }}
              className="w-full px-3 py-2 text-left text-sm text-[var(--accent-danger)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Bannen
            </button>
          )}
        </>
      )}

      <div className="my-1 border-t border-[var(--border)]" />

      {/* Nutzer-ID kopieren */}
      <button
        onClick={() => {
          onCopyId()
          onClose()
        }}
        className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
        </svg>
        Nutzer-ID kopieren
      </button>

      {!isSelf && onBlock && (
        <>
          <div className="my-1 border-t border-[var(--border)]" />
          <button
            onClick={() => {
              onBlock(member.userId)
              onClose()
            }}
            className="w-full px-3 py-2 text-left text-sm text-[var(--accent-danger)] hover:bg-[var(--bg-modifier-hover)] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Blockieren
          </button>
        </>
      )}
    </div>
  )
}
