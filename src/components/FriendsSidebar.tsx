/**
 * FriendsSidebar - Freunde, Anfragen, Private Chats
 */
import { useEffect, useState } from 'react'
import type { Profile } from '../lib/supabase'
import { friends, dm, searchProfiles } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export type FriendsTab = 'online' | 'alle' | 'ausstehend' | 'blockiert'

interface FriendWithProfile {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  status: 'pending' | 'accepted'
  isIncoming: boolean
}

interface DmWithProfile {
  conversationId: string
  otherUser: Profile
}

interface FriendsSidebarProps {
  selectedDmId: string | null
  onSelectDm: (conversationId: string, otherUser: Profile) => void
}

export function FriendsSidebar({ selectedDmId, onSelectDm }: FriendsSidebarProps) {
  const { user } = useAuth()
  const [tab, setTab] = useState<FriendsTab>('alle')
  const [friendsList, setFriendsList] = useState<FriendWithProfile[]>([])
  const [dms, setDms] = useState<DmWithProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  const fetchFriends = async () => {
    if (!user) return
    try {
      const data = await friends.list()
      setFriendsList(
        (data ?? []).map((f) => ({
          id: f.id,
          userId: f.userId,
          username: f.username,
          avatarUrl: f.avatarUrl,
          status: f.status as 'pending' | 'accepted',
          isIncoming: f.isIncoming ?? false,
        }))
      )
    } catch {
      setFriendsList([])
    }
  }

  useEffect(() => {
    fetchFriends()
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    dm.getConversations()
      .then((data) => {
        setDms(
          (data ?? []).map((c) => ({
            conversationId: c.conversationId,
            otherUser: c.otherUser as Profile,
          }))
        )
      })
      .catch(() => setDms([]))
  }, [user?.id])

  const searchUsers = async () => {
    if (!searchQuery.trim()) return
    setLoading(true)
    try {
      const results = await searchProfiles(searchQuery.trim())
      const existingIds = new Set(friendsList.map((f) => f.userId))
      setSearchResults(results.filter((p) => p.id !== user?.id && !existingIds.has(p.id)))
    } catch {
      setSearchResults([])
    }
    setLoading(false)
  }

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return
    try {
      await friends.request(toUserId)
      setSearchQuery('')
      setSearchResults([])
      fetchFriends()
    } catch (_) {}
  }

  const acceptFriendRequest = async (requestId: string) => {
    try {
      await friends.accept(requestId)
      fetchFriends()
    } catch (_) {}
  }

  const openOrCreateDm = async (otherUser: Profile) => {
    if (!user) return
    try {
      const existing = dms.find((d) => d.otherUser.id === otherUser.id)
      if (existing) {
        onSelectDm(existing.conversationId, otherUser)
        return
      }
      const { id } = await dm.createConversation(otherUser.id)
      setDms((prev) => [...prev, { conversationId: id, otherUser }])
      onSelectDm(id, otherUser)
    } catch (_) {}
  }

  const acceptedFriends = friendsList.filter((f) => f.status === 'accepted')
  const pendingIncoming = friendsList.filter((f) => f.status === 'pending' && f.isIncoming)
  const pendingOutgoing = friendsList.filter((f) => f.status === 'pending' && !f.isIncoming)

  return (
    <div className="w-60 flex flex-col overflow-hidden bg-[var(--bg-secondary)]">
      <div className="h-12 px-4 flex items-center border-b border-[var(--border)]">
        <h2 className="font-semibold text-[var(--text-primary)]">Freunde</h2>
      </div>

      <div className="p-2 border-b border-[var(--border)]">
        <div className="flex gap-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            placeholder="Benutzer suchen..."
            className="flex-1 px-3 py-1.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            onClick={searchUsers}
            disabled={loading}
            className="px-2 py-1.5 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 cursor-pointer"
          >
            Suchen
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 space-y-1">
            {searchResults.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <span className="text-sm text-[var(--text-primary)]">{p.username}</span>
                <button
                  onClick={() => sendFriendRequest(p.id)}
                  className="text-xs px-2 py-0.5 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] cursor-pointer"
                >
                  Hinzufügen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-1 p-2 border-b border-[var(--border)]">
        {(['alle', 'ausstehend'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2 py-1 rounded text-sm cursor-pointer ${
              tab === t ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t === 'alle' ? 'Alle' : 'Ausstehend'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
        {tab === 'alle' && (
          <>
            <p className="px-3 py-1 text-xs font-semibold text-[var(--text-muted)] uppercase">
              Direktnachrichten
            </p>
            {dms.map((dm) => (
              <button
                key={dm.conversationId}
                onClick={() => onSelectDm(dm.conversationId, dm.otherUser)}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] cursor-pointer ${
                  selectedDmId === dm.conversationId ? 'bg-[var(--bg-hover)]' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold">
                  {dm.otherUser.avatar_url ? (
                    <img src={dm.otherUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    dm.otherUser.username.charAt(0)
                  )}
                </div>
                <span className="text-sm text-[var(--text-primary)] truncate">{dm.otherUser.username}</span>
              </button>
            ))}
            <p className="px-3 py-1 mt-2 text-xs font-semibold text-[var(--text-muted)] uppercase">
              Freunde ({acceptedFriends.length})
            </p>
            {acceptedFriends.map((f) => (
              <button
                key={f.id}
                onClick={() =>
                  openOrCreateDm({
                    id: f.userId,
                    username: f.username,
                    avatar_url: f.avatarUrl,
                    theme: 'dark',
                    created_at: new Date().toISOString(),
                  })
                }
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] text-sm">
                  {f.avatarUrl ? (
                    <img src={f.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    f.username.charAt(0)
                  )}
                </div>
                <span className="text-sm text-[var(--text-primary)] truncate">{f.username}</span>
              </button>
            ))}
          </>
        )}
        {tab === 'ausstehend' && (
          <>
            {pendingIncoming.length > 0 && (
              <>
                <p className="px-3 py-1 text-xs font-semibold text-[var(--text-muted)] uppercase">
                  Eingehend
                </p>
                {pendingIncoming.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    <span className="text-sm text-[var(--text-primary)]">{f.username}</span>
                    <button
                      onClick={() => acceptFriendRequest(f.id)}
                      className="text-xs px-2 py-0.5 rounded bg-[var(--accent)] text-white cursor-pointer"
                    >
                      Annehmen
                    </button>
                  </div>
                ))}
              </>
            )}
            {pendingOutgoing.length > 0 && (
              <>
                <p className="px-3 py-1 text-xs font-semibold text-[var(--text-muted)] uppercase">
                  Gesendet
                </p>
                {pendingOutgoing.map((f) => (
                  <div key={f.id} className="px-3 py-2 text-sm text-[var(--text-muted)]">
                    {f.username} (ausstehend)
                  </div>
                ))}
              </>
            )}
            {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
              <p className="px-3 py-4 text-sm text-[var(--text-muted)]">Keine ausstehenden Anfragen</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
