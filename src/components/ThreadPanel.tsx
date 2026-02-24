/**
 * ThreadPanel - Antwort-Thread zu einer Nachricht (Discord-Style)
 */
import { useEffect, useState, useRef } from 'react'
import type { Message, Profile } from '../lib/supabase'
import { useBackendRealtime, messages } from '../lib/api'
import { Message as MessageComponent } from './Message'
import { useAuth } from '../contexts/AuthContext'
import { useServerEmojis } from '../hooks/useServerEmojis'
import { useMemberRoleColors } from '../hooks/useMemberRoleColors'
import { useMessageReactions } from '../hooks/useMessageReactions'

interface ThreadPanelProps {
  parentMessage: Message
  channelId: string
  serverId?: string | null
  profiles: Record<string, Profile>
  onClose: () => void
  onOpenEmojiSettings?: (serverId: string) => void
}

export function ThreadPanel({
  parentMessage,
  channelId,
  serverId,
  profiles,
  onClose,
  onOpenEmojiSettings,
}: ThreadPanelProps) {
  const { user, profile } = useAuth()
  const serverEmojis = useServerEmojis(serverId)
  const [replies, setReplies] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { reactionsByMessage, toggleReaction } = useMessageReactions([parentMessage.id, ...replies.map((r) => r.id)])
  const memberUserIds = [...new Set([parentMessage.user_id, ...replies.map((r) => r.user_id)])]
  const memberRoleColors = useMemberRoleColors(serverId, memberUserIds)

  const wsChannel = `messages:${channelId}`
  useBackendRealtime(wsChannel, (event, payload) => {
    const msg = payload as Message
    if (event === 'INSERT' && msg.parent_message_id === parentMessage.id) setReplies((prev) => [...prev, msg])
  })

  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const data = await messages.getByChannel(channelId, 50, undefined, parentMessage.id)
        setReplies(data ?? [])
      } catch {
        setReplies([])
      }
    }
    fetchReplies()
  }, [parentMessage.id, channelId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [replies])

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    try {
      await messages.create({
        channel_id: channelId,
        content,
        parent_message_id: parentMessage.id,
      })
    } catch (_) {}
    setSending(false)
  }

  const parentProfile = profiles[parentMessage.user_id] ?? null

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="h-12 px-3 flex items-center justify-between border-b border-[var(--border)]">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Thread</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2">
        <div className="px-2 border-b border-[var(--border)] pb-2 mb-2">
          <MessageComponent
            message={parentMessage}
            profile={parentProfile}
            isOwn={parentMessage.user_id === user?.id}
            serverEmojis={serverEmojis}
            roleColor={memberRoleColors[parentMessage.user_id]}
            reactions={reactionsByMessage[parentMessage.id]}
            onToggleReaction={(emoji) => toggleReaction(parentMessage.id, emoji)}
          />
        </div>
        <div className="flex items-center gap-2 px-2 mb-2">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)]">{replies.length} Antworten</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>
        {replies.map((msg) => (
          <MessageComponent
            key={msg.id}
            message={msg}
            profile={profiles[msg.user_id] ?? null}
            isOwn={msg.user_id === user?.id}
            serverEmojis={serverEmojis}
            roleColor={memberRoleColors[msg.user_id]}
            reactions={reactionsByMessage[msg.id]}
            onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
          />
        ))}
      </div>
      <form onSubmit={sendReply} className="p-2 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Antworten..."
            maxLength={2000}
            className="flex-1 px-3 py-2 rounded bg-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] border border-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="px-3 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium disabled:opacity-50"
          >
            Senden
          </button>
        </div>
      </form>
    </div>
  )
}
