/**
 * FriendsSidebar - Freunde, Anfragen, Private Chats
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { useBackend, friends, dm, searchProfiles } from '../lib/api'
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
  const backend = useBackend()
  const [tab, setTab] = useState<FriendsTab>('alle')
  const [friendsList, setFriendsList] = useState<FriendWithProfile[]>([])
  const [dms, setDms] = useState<DmWithProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)

  const fetchFriends = async () => {
    if (!user) return
    if (backend) {
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
      return
    }
    const { data } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .in('status', ['pending', 'accepted'])
    if (!data?.length) {
      setFriendsList([])
      return
    }
    const userIds = [...new Set(data.flatMap((f) => [f.from_user_id, f.to_user_id]).filter((id) => id !== user.id))]
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
    setFriendsList(
      data.map((f) => {
        const otherId = f.from_user_id === user.id ? f.to_user_id : f.from_user_id
        const p = profileMap[otherId]
        return {
          id: f.id,
          userId: otherId,
          username: p?.username ?? 'Unbekannt',
          avatarUrl: p?.avatar_url ?? null,
          status: f.status,
          isIncoming: f.to_user_id === user.id,
        }
      })
    )
  }

  useEffect(() => {
    fetchFriends()
  }, [user?.id, backend])

  useEffect(() => {
    if (!user) return
    if (backend) {
      dm.getConversations().then((data) => {
        setDms(
          (data ?? []).map((c) => ({
            conversationId: c.conversationId,
            otherUser: c.otherUser as Profile,
          }))
        )
      }).catch(() => setDms([]))
      return
    }
    const fetchDms = async () => {
      const { data: convs } = await supabase
        .from('dm_participants')
        .select('conversation_id')
        .eq('user_id', user.id)
      if (!convs?.length) {
        setDms([])
        return
      }
      const convIds = convs.map((c) => c.conversation_id)
      const { data: participants } = await supabase
        .from('dm_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds)
        .neq('user_id', user.id)
      const otherUserIds = [...new Set((participants ?? []).map((p) => p.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', otherUserIds)
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
      const convToUser = Object.fromEntries(
        (participants ?? []).map((p) => [p.conversation_id, profileMap[p.user_id]])
      )
      setDms(
        convIds.map((id) => ({
          conversationId: id,
          otherUser: convToUser[id] ?? { id: '', username: 'Unbekannt', avatar_url: null, theme: 'dark', created_at: '' },
        }))
      )
    }
    fetchDms()
  }, [user?.id, backend])

  const searchUsers = async () => {
    if (!searchQuery.trim()) return
    setLoading(true)
    if (backend) {
      try {
        const results = await searchProfiles(searchQuery.trim())
        const existingIds = new Set(friendsList.map((f) => f.userId))
        setSearchResults(results.filter((p) => p.id !== user?.id && !existingIds.has(p.id)))
      } catch {
        setSearchResults([])
      }
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchQuery.trim()}%`)
        .neq('id', user?.id ?? '')
        .limit(10)
      const results = data ?? []
      const existingIds = new Set(friendsList.map((f) => f.userId))
      setSearchResults(results.filter((p) => !existingIds.has(p.id)))
    }
    setLoading(false)
  }

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return
    if (backend) {
      try {
        await friends.request(toUserId)
        setSearchQuery('')
        setSearchResults([])
        fetchFriends()
      } catch (_) {}
      return
    }
    const { error } = await supabase.from('friend_requests').insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      status: 'pending',
    })
    if (!error) {
      setSearchQuery('')
      setSearchResults([])
      fetchFriends()
    }
  }

  const acceptFriendRequest = async (requestId: string) => {
    if (backend) {
      try {
        await friends.accept(requestId)
        fetchFriends()
      } catch (_) {}
      return
    }
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId)
    fetchFriends()
  }

  const openOrCreateDm = async (otherUser: Profile) => {
    if (!user) return
    if (backend) {
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
      return
    }
    const { data: existing } = await supabase
      .from('dm_participants')
      .select('conversation_id')
      .eq('user_id', user.id)
    const convIds = (existing ?? []).map((c) => c.conversation_id)
    if (convIds.length > 0) {
      const { data: match } = await supabase
        .from('dm_participants')
        .select('conversation_id')
        .eq('user_id', otherUser.id)
        .in('conversation_id', convIds)
        .limit(1)
        .single()
      if (match) {
        onSelectDm(match.conversation_id, otherUser)
        return
      }
    }
    const { data: newConvId, error } = await supabase.rpc('create_dm_conversation', {
      other_user_id: otherUser.id,
    })
    if (error || !newConvId) {
      console.error('DM erstellen fehlgeschlagen:', error?.message ?? 'Nur Freunde können DMs starten')
      return
    }
    setDms((prev) => [...prev, { conversationId: newConvId, otherUser }])
    onSelectDm(newConvId, otherUser)
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
