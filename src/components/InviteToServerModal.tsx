/**
 * InviteToServerModal - Freunde zu Server einladen (Discord-Style)
 */
import { useEffect, useState } from 'react'
import type { Server, Channel } from '../lib/supabase'
import { friends, servers, invites, dm, messages } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface FriendProfile {
  id: string
  username: string
  avatar_url: string | null
}

interface InviteToServerModalProps {
  server: Server
  channel?: Channel | null
  onClose: () => void
  /** Wenn aus DM geöffnet: Callback um Link in Chat zu senden */
  onInviteSent?: (inviteUrl: string) => void
}

export function InviteToServerModal({
  server,
  channel,
  onClose,
  onInviteSent,
}: InviteToServerModalProps) {
  const { user } = useAuth()
  const [friendsList, setFriendsList] = useState<FriendProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [invitingId, setInvitingId] = useState<string | null>(null)

  const defaultChannel = channel?.name ?? 'allgemein'

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const [friendsData, memberIds] = await Promise.all([
          friends.list(),
          servers.getMembers(server.id),
        ])
        const memberSet = new Set(memberIds ?? [])
        const accepted = (friendsData ?? []).filter((f) => f.status === 'accepted')
        const invitees = accepted.filter((f) => !memberSet.has(f.userId))
        setFriendsList(
          invitees.map((f) => ({
            id: f.userId,
            username: f.username,
            avatar_url: f.avatarUrl,
          }))
        )
      } catch {
        setFriendsList([])
      }
      setLoading(false)
    }
    load()
  }, [user?.id, server.id])

  const getOrCreateInviteLink = async (): Promise<string> => {
    if (inviteLink) return inviteLink
    const inv = await invites.create(server.id)
    const url = `${window.location.origin}/#invite/${inv.code}`
    setInviteLink(url)
    return url
  }

  const sendInviteToFriend = async (friend: FriendProfile) => {
    if (!user) return
    setInvitingId(friend.id)
    try {
      const url = await getOrCreateInviteLink()
      const { id: dmConvId } = await dm.createConversation(friend.id)
      await messages.create({
        dm_conversation_id: dmConvId,
        content: `🔗 Einladung zu ${server.name}: ${url}`,
      })
    } finally {
      setInvitingId(null)
    }
  }

  const copyInviteLink = async () => {
    const url = await getOrCreateInviteLink()
    await navigator.clipboard.writeText(url)
    if (onInviteSent) onInviteSent(url)
  }

  const filteredFriends = searchQuery.trim()
    ? friendsList.filter((f) =>
        f.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : friendsList

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                Freunde zu {server.name} einladen
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-1">
                Empfänger landen in # {defaultChannel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Suche */}
        <div className="px-4 py-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-[var(--bg-tertiary)]">
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nach Freunden suchen"
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
          </div>
        </div>

        {/* Freundesliste */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-8 text-center text-[var(--text-muted)]">Laden…</div>
          ) : filteredFriends.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)] text-sm">
              {friendsList.length === 0
                ? 'Keine Freunde zum Einladen. Alle Freunde sind bereits auf dem Server.'
                : 'Keine Freunde gefunden.'}
            </div>
          ) : (
            <div className="py-2">
              {filteredFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-modifier-hover)]"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0">
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[var(--text-muted)]">
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">{friend.username}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{friend.username}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendInviteToFriend(friend)}
                    disabled={invitingId === friend.id}
                    className="px-4 py-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] text-sm font-medium disabled:opacity-50"
                  >
                    {invitingId === friend.id ? '…' : 'Einladen'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Einladungslink */}
        <div className="px-4 py-4 border-t border-[var(--border)] flex-shrink-0">
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Oder schick einen Server-Einladungslink an einen Freund
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink ?? 'Link wird erstellt…'}
              className="flex-1 px-3 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={copyInviteLink}
              className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium"
            >
              Kopieren
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Dein Einladungslink läuft in 7 Tagen ab.{' '}
            <button type="button" className="text-[var(--text-link)] hover:underline">
              Einladungslink bearbeiten
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
