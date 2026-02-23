/**
 * Chat - Text-Chat mit Realtime-Nachrichten, Emojis und Bildern
 */
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Channel, Message, Server } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { api, useBackend, useBackendRealtime, messages as messagesApi, getProfilesByIds, uploadFile as apiUploadFile } from '../lib/api'
import { InviteToServerModal } from './InviteToServerModal'
import { Message as MessageComponent } from './Message'
import { ThreadPanel } from './ThreadPanel'
import { EmojiPicker } from './EmojiPicker'
import { useAuth } from '../contexts/AuthContext'
import { playSoundMessage } from '../lib/sounds'
import { useServerEmojis } from '../hooks/useServerEmojis'
import { useMemberRoleColors } from '../hooks/useMemberRoleColors'
import { useMessageReactions } from '../hooks/useMessageReactions'

interface ChatProps {
  channel: Channel | null
  serverId?: string | null
  onOpenEmojiSettings?: (serverId: string) => void
  onToggleMembers?: () => void
}

export function Chat({ channel, serverId, onOpenEmojiSettings, onToggleMembers }: ChatProps) {
  const { user, profile } = useAuth()
  const backend = useBackend()
  const serverEmojis = useServerEmojis(channel?.server_id ?? serverId ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const { reactionsByMessage, toggleReaction } = useMessageReactions(messages.map((m) => m.id))
  const memberUserIds = [...new Set(messages.map((m) => m.user_id))]
  const memberRoleColors = useMemberRoleColors(channel?.server_id ?? serverId ?? null, memberUserIds)
  const [serverName, setServerName] = useState<string>('')
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const gifButtonRef = useRef<HTMLButtonElement>(null)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<{ url: string; type: 'image' | 'audio' | 'video'; filename?: string; fileSize?: number }[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiPickerTab, setEmojiPickerTab] = useState<'gifs' | 'sticker' | 'emojis'>('emojis')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPinned, setShowPinned] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteServer, setInviteServer] = useState<Server | null>(null)
  const [threadMessage, setThreadMessage] = useState<Message | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)

  const wsChannel = channel && (channel.type === 'text' || channel.type === 'forum') ? `messages:${channel.id}` : null
  useBackendRealtime(backend ? wsChannel : null, (event, payload) => {
    const msg = payload as Message
    if (event === 'INSERT' && !msg.parent_message_id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        if (msg.user_id !== user?.id) playSoundMessage()
        return [...prev, msg]
      })
    } else if (event === 'UPDATE') setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
    else if (event === 'DELETE') setMessages((prev) => prev.filter((m) => m.id !== (payload as { id: string }).id))
  })

  useEffect(() => {
    if (!channel || (channel.type !== 'text' && channel.type !== 'forum')) {
      setMessages([])
      return
    }

    if (backend) {
      messagesApi.getByChannel(channel.id).then((data) => {
        setMessages(data ?? [])
        setHasMore((data?.length ?? 0) >= 50)
      })
      return
    }

    const fetchMessages = async (olderThan?: string) => {
      let q = supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channel.id)
        .is('parent_message_id', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (olderThan) q = q.lt('created_at', olderThan)
      const { data } = await q
      const ordered = (data ?? []).reverse()
      if (olderThan) {
        setMessages((prev) => [...ordered, ...prev])
      } else {
        setMessages(ordered)
      }
      setHasMore((data?.length ?? 0) >= 50)
    }
    fetchMessages()

    const channelSub = supabase
      .channel(`messages:${channel.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          const msg = payload.new as Message
          if (!msg.parent_message_id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev
              if (msg.user_id !== user?.id) playSoundMessage()
              return [...prev, msg]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as { id: string }).id))
        }
      )
      .subscribe()

    return () => {
      channelSub.unsubscribe()
    }
  }, [channel?.id, backend])

  useEffect(() => {
    const userIds = [...new Set(messages.map((m) => m.user_id))]
    if (userIds.length === 0) return

    if (backend) {
      getProfilesByIds(userIds).then((data) => {
        const map: Record<string, Profile> = {}
        data?.forEach((p) => (map[p.id] = p))
        setProfiles(map)
      })
    } else {
      supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)
        .then(({ data }) => {
          const map: Record<string, Profile> = {}
          data?.forEach((p) => (map[p.id] = p))
          setProfiles(map)
        })
    }
  }, [messages, backend])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const sid = channel?.server_id ?? serverId
    if (!sid) return
    if (backend) {
      api<{ name: string }>(`/api/servers/${sid}`).then((s) => setServerName(s?.name ?? '')).catch(() => {})
    } else {
      supabase.from('servers').select('name').eq('id', sid).single().then(({ data }) => {
        setServerName(data?.name ?? '')
      })
    }
  }, [channel?.server_id, serverId, backend])

  const openInviteModal = async () => {
    const sid = channel?.server_id ?? serverId
    if (!sid) return
    if (backend) {
      try {
        const data = await api<Server>(`/api/servers/${sid}`)
        if (data) {
          setInviteServer(data)
          setShowInviteModal(true)
        }
      } catch (_) {}
    } else {
      const { data } = await supabase.from('servers').select('*').eq('id', sid).single()
      if (data) {
        setInviteServer(data)
        setShowInviteModal(true)
      }
    }
  }

  const getAttachmentType = (file: File): 'image' | 'audio' | 'video' | null => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    return null
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    if (backend) {
      return apiUploadFile(file)
    }
    const ext = file.name.split('.').pop() || 'bin'
    const path = `${channel!.id}/${crypto.randomUUID()}.${ext}`
    const contentType = file.type || (ext === 'mp3' ? 'audio/mpeg' : undefined)
    const { error } = await supabase.storage
      .from('message-attachments')
      .upload(path, file, { upsert: false, contentType: contentType || undefined })
    if (error) return null
    const { data } = supabase.storage.from('message-attachments').getPublicUrl(path)
    return data.publicUrl
  }

  const processFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files)
    if (!arr.length || !channel || uploading) return
    setUploading(true)
    for (const file of arr) {
      const type = getAttachmentType(file)
      if (!type) continue
      const url = await uploadFile(file)
      if (url) {
        const att: { url: string; type: 'image' | 'audio' | 'video'; filename?: string; fileSize?: number } = { url, type }
        if (type === 'audio') {
          att.filename = file.name
          att.fileSize = file.size
        }
        setAttachments((prev) => [...prev, att])
      }
    }
    setUploading(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    await processFiles(files)
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.dataTransfer.types.includes('Files')) return
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const related = e.relatedTarget as Node | null
    if (!related || !e.currentTarget.contains(related)) setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (!files?.length) return
    await processFiles(files)
  }

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!channel || !user || (!input.trim() && attachments.length === 0) || sendingRef.current) return

    const content = input.trim() || ' '
    setInput('')
    const atts = [...attachments]
    setAttachments([])
    setShowEmojiPicker(false)
    sendingRef.current = true
    setSending(true)

    if (backend) {
      try {
        const newMessage = await messagesApi.create({
          channel_id: channel.id,
          content,
          attachments: atts.length ? atts : undefined,
        })
        if (newMessage) {
          setMessages((prev) =>
            prev.some((m) => m.id === newMessage.id) ? prev : [...prev, { ...newMessage, attachments: atts }]
          )
          setProfiles((prev) =>
            profile && !prev[user.id] ? { ...prev, [user.id]: profile } : prev
          )
        }
      } catch (_) {
        setInput(content)
        setAttachments(atts)
      }
    } else {
      const { data: newMessage } = await supabase
        .from('messages')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          content,
          attachments: atts.length ? atts : undefined,
        })
        .select()
        .single()

      if (newMessage) {
        const msg = { ...(newMessage as Message), attachments: atts }
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        setProfiles((prev) =>
          profile && !prev[user.id] ? { ...prev, [user.id]: profile } : prev
        )
      }
    }

    setSending(false)
    sendingRef.current = false
  }

  const filteredMessages = searchQuery.trim()
    ? messages.filter(
        (m) =>
          m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.attachments ?? []).some((a) => a.filename?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : messages

  const pinnedMessages = messages.filter((m) => m.is_pinned)

  const togglePin = async (msg: Message) => {
    if (msg.user_id !== user?.id) return
    if (backend) {
      try {
        await messagesApi.update(msg.id, { is_pinned: !msg.is_pinned })
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, is_pinned: !m.is_pinned } : m))
        )
      } catch (_) {}
    } else {
      await supabase
        .from('messages')
        .update({ is_pinned: !msg.is_pinned })
        .eq('id', msg.id)
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_pinned: !m.is_pinned } : m))
      )
    }
  }

  const handleEditMessage = async (msg: Message, newContent: string) => {
    if (msg.user_id !== user?.id) return
    if (backend) {
      try {
        await messagesApi.update(msg.id, { content: newContent })
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, content: newContent, edited_at: new Date().toISOString() } : m))
        )
      } catch (_) {}
    } else {
      await supabase
        .from('messages')
        .update({ content: newContent, edited_at: new Date().toISOString() })
        .eq('id', msg.id)
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, content: newContent, edited_at: new Date().toISOString() } : m))
      )
    }
  }

  const handleDeleteMessage = async (msg: Message) => {
    if (msg.user_id !== user?.id) return
    if (backend) {
      try {
        await messagesApi.delete(msg.id)
        setMessages((prev) => prev.filter((m) => m.id !== msg.id))
      } catch (_) {}
    } else {
      await supabase.from('messages').delete().eq('id', msg.id)
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
    }
  }

  const loadMore = async () => {
    if (!channel || !hasMore || loadingMore || messages.length === 0) return
    setLoadingMore(true)
    const oldest = messages[0]
    if (backend) {
      try {
        const data = await messagesApi.getByChannel(channel.id, 50, oldest.created_at)
        const ordered = (data ?? []).reverse()
        setMessages((prev) => [...ordered, ...prev])
        setHasMore((data?.length ?? 0) >= 50)
      } catch (_) {}
    } else {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channel.id)
        .is('parent_message_id', null)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .limit(50)
      const ordered = (data ?? []).reverse()
      setMessages((prev) => [...ordered, ...prev])
      setHasMore((data?.length ?? 0) >= 50)
    }
    setLoadingMore(false)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop < 100 && hasMore && !loadingMore) loadMore()
  }

  const insertEmoji = (name: string) => {
    setInput((prev) => prev + `:${name}:`)
    setShowEmojiPicker(false)
  }

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
        Wähle einen Channel
      </div>
    )
  }

  if (channel.type !== 'text' && channel.type !== 'forum') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
        <p className="text-lg mb-2">🔊 Voice Channel</p>
        <p className="text-sm">Klicke unten auf „Voice beitreten“, um zu sprechen.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {showInviteModal && inviteServer && channel && (
        <InviteToServerModal
          server={inviteServer}
          channel={channel}
          onClose={() => {
            setShowInviteModal(false)
            setInviteServer(null)
          }}
        />
      )}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border)] gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--text-muted)]">#</span>
          <span className="font-semibold text-[var(--text-primary)] truncate">{channel.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={openInviteModal}
            className="p-2 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Freunde einladen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
          <button className="p-2 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Benachrichtigungen">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
          </button>
          <button
            type="button"
            onClick={() => setShowPinned((p) => !p)}
            className={`p-2 rounded hover:bg-[var(--bg-modifier-hover)] ${showPinned ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} hover:text-[var(--text-primary)]`}
            title={pinnedMessages.length > 0 ? `Angeheftet (${pinnedMessages.length})` : 'Angeheftete Nachrichten'}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/></svg>
          </button>
          <button
            type="button"
            onClick={onToggleMembers}
            className="p-2 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Mitglieder"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </button>
          <input
            type="text"
            placeholder="Suchen"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-28 px-2 py-1 rounded bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 flex min-w-0 min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-4 relative min-w-0 min-h-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onScroll={handleScroll}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/90 border-2 border-dashed border-[var(--accent)] rounded-lg m-2">
            <div className="text-center text-[var(--text-primary)]">
              <p className="text-lg font-medium">Dateien hier ablegen</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Bilder, Audio, Video</p>
            </div>
          </div>
        )}
        {showPinned ? (
          <div className="px-4 py-4">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-6">
              Angeheftete Nachrichten
            </h3>
            {pinnedMessages.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Keine angehefteten Nachrichten</p>
            ) : (
              <div className="space-y-0">
                {pinnedMessages.map((msg) => (
                  <MessageComponent
                    key={msg.id}
                    message={msg}
                    profile={profiles[msg.user_id] ?? null}
                    isOwn={msg.user_id === user?.id}
                    serverEmojis={serverEmojis}
                    roleColor={memberRoleColors[msg.user_id]}
                    onUnpin={() => togglePin(msg)}
                    reactions={reactionsByMessage[msg.id]}
                    onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                    onEdit={(c) => handleEditMessage(msg, c)}
                    onReply={() => setThreadMessage(msg)}
                    onDelete={msg.user_id === user?.id ? () => handleDeleteMessage(msg) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="px-4 text-[var(--text-muted)] text-center py-8">
            {searchQuery.length > 0 ? 'Keine Nachrichten gefunden.' : 'Noch keine Nachrichten. Starte die Unterhaltung!'}
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="px-4 py-2 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm text-[var(--accent)] hover:underline disabled:opacity-50"
                >
                  {loadingMore ? 'Laden…' : 'Ältere Nachrichten laden'}
                </button>
              </div>
            )}
            {filteredMessages.map((msg) => (
              <MessageComponent
                key={msg.id}
                message={msg}
                profile={profiles[msg.user_id] ?? null}
                isOwn={msg.user_id === user?.id}
                serverEmojis={serverEmojis}
                roleColor={memberRoleColors[msg.user_id]}
                onPin={() => togglePin(msg)}
                onUnpin={() => togglePin(msg)}
                reactions={reactionsByMessage[msg.id]}
                onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                onEdit={(c) => handleEditMessage(msg, c)}
                onReply={() => setThreadMessage(msg)}
                onDelete={msg.user_id === user?.id ? () => handleDeleteMessage(msg) : undefined}
              />
            ))}
          </>
        )}
      </div>
      {threadMessage && channel && (
        <ThreadPanel
          parentMessage={threadMessage}
          channelId={channel.id}
          serverId={channel.server_id ?? serverId}
          profiles={profiles}
          onClose={() => setThreadMessage(null)}
          onOpenEmojiSettings={serverId ? onOpenEmojiSettings : undefined}
        />
      )}
      </div>
      <form onSubmit={sendMessage} className="px-4 pb-4">
        {attachments.length > 0 && (
          <div className="flex gap-2 px-4 py-2 flex-wrap">
            {attachments.map((att, i) => (
              <div key={i} className="relative">
                {att.type === 'image' && (
                  <img src={att.url} alt="" className="w-20 h-20 object-cover rounded" />
                )}
                {att.type === 'audio' && (
                  <div className="w-48 min-h-12 rounded bg-[var(--bg-secondary)] flex items-center gap-2 px-2 py-2">
                    <span className="text-[var(--text-muted)] flex-shrink-0">🎵</span>
                    <span className="text-xs text-[var(--text-primary)] truncate" title={att.filename}>
                      {att.filename || 'Audio'}
                    </span>
                  </div>
                )}
                {att.type === 'video' && (
                  <div className="w-32 h-20 rounded bg-[var(--bg-secondary)] flex items-center justify-center">
                    <span className="text-2xl text-[var(--text-muted)]">🎬</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--accent-danger)] text-white text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-tertiary)]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
            title="Bild, Audio oder Video anhängen"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          </button>
          <button
            ref={gifButtonRef}
            type="button"
            onClick={() => {
              setEmojiPickerTab('gifs')
              setShowEmojiPicker(true)
            }}
            className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="GIF einfügen"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.5 9H13v6h-1.5V9zM9 9H6c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h3c.6 0 1-.5 1-1v-2H8.5v1.5h-2v-5H9V9zm3.5 1.5h1.5V15H13v-4.5zM19 9h-4c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1.5h-1.5V14h-2v-1.5h-1.5v-2H19v-1c0-.5-.4-1-1-1z"/></svg>
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={`Nachricht an #${channel.name}`}
            maxLength={2000}
            rows={1}
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none text-[15px] resize-none min-h-[24px] max-h-[200px] py-1"
          />
          <div className="relative">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => {
                setEmojiPickerTab('emojis')
                setShowEmojiPicker((p) => !p)
              }}
              className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              title="Emoji"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                serverEmojis={serverEmojis}
                serverName={serverName}
                initialTab={emojiPickerTab}
                onSelect={(emoji) => {
                  setInput((prev) => prev + emoji)
                  setShowEmojiPicker(false)
                }}
                onSelectCustom={insertEmoji}
                onInsertGif={(url) => {
                  setAttachments((prev) => [...prev, { url, type: 'image' }])
                  setShowEmojiPicker(false)
                }}
                onClose={() => setShowEmojiPicker(false)}
                onAddEmoji={
                  (channel?.server_id ?? serverId) && onOpenEmojiSettings
                    ? () => onOpenEmojiSettings(channel?.server_id ?? serverId!)
                    : undefined
                }
                anchorRef={emojiButtonRef}
              />
            )}
          </div>
          <button type="submit" disabled={sending} className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed" title="Senden">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </form>
    </div>
  )
}
