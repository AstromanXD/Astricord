/**
 * DmChat - Private Chat (Direktnachrichten)
 */
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Message, Profile } from '../lib/supabase'
import { useBackend, useBackendRealtime, messages, getProfilesByIds } from '../lib/api'
import { Message as MessageComponent } from './Message'
import { InviteToServerModalFromDm } from './InviteToServerModalFromDm'
import { useAuth } from '../contexts/AuthContext'
import { playSoundMessage } from '../lib/sounds'

interface DmChatProps {
  conversationId: string | null
  otherUser: Profile | null
}

export function DmChat({ conversationId, otherUser }: DmChatProps) {
  const { user, profile } = useAuth()
  const backend = useBackend()
  const [messages, setMessages] = useState<Message[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const wsChannel = conversationId ? `messages:dm:${conversationId}` : null
  useBackendRealtime(backend ? wsChannel : null, (event, payload) => {
    const msg = payload as Message
    if (event === 'INSERT') {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        if (msg.user_id !== user?.id) playSoundMessage()
        return [...prev, msg]
      })
    }
    else if (event === 'UPDATE') setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
    else if (event === 'DELETE') setMessages((prev) => prev.filter((m) => m.id !== (payload as { id: string }).id))
  })

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    if (backend) {
      messages.getByDm(conversationId).then((data) => setMessages(data ?? []))
      return
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('dm_conversation_id', conversationId)
        .order('created_at', { ascending: true })
      setMessages(data ?? [])
    }
    fetchMessages()

    const channelSub = supabase
      .channel(`dms:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `dm_conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            if (msg.user_id !== user?.id) playSoundMessage()
            return [...prev, msg]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `dm_conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `dm_conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as { id: string }).id))
        }
      )
      .subscribe()

    return () => channelSub.unsubscribe()
  }, [conversationId, backend])

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

  const sendMessage = async (e?: React.FormEvent, contentOverride?: string) => {
    e?.preventDefault()
    const content = contentOverride ?? input.trim()
    if (!conversationId || !user || !content || sending) return

    if (!contentOverride) setInput('')
    setSending(true)

    if (backend) {
      try {
        const newMessage = await messages.create({
          dm_conversation_id: conversationId,
          content,
        })
        if (newMessage) {
          setMessages((prev) => [...prev, newMessage])
          setProfiles((prev) =>
            profile && !prev[user.id] ? { ...prev, [user.id]: profile } : prev
          )
        }
      } catch (_) {}
    } else {
      const { data: newMessage } = await supabase
        .from('messages')
        .insert({
          dm_conversation_id: conversationId,
          user_id: user.id,
          content,
        })
        .select()
        .single()

      if (newMessage) {
        setMessages((prev) => [...prev, newMessage as Message])
        setProfiles((prev) =>
          profile && !prev[user.id] ? { ...prev, [user.id]: profile } : prev
        )
      }
    }

    setSending(false)
  }

  const handleDeleteMessage = async (msg: Message) => {
    if (msg.user_id !== user?.id) return
    if (backend) {
      try {
        await messages.delete(msg.id)
        setMessages((prev) => prev.filter((m) => m.id !== msg.id))
      } catch (_) {}
    } else {
      await supabase.from('messages').delete().eq('id', msg.id)
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
    }
  }

  const handleInviteSent = (inviteUrl: string) => {
    sendMessage(undefined, `🔗 Einladung zu einem Server: ${inviteUrl}`)
  }

  if (!conversationId || !otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
        Wähle eine Unterhaltung oder starte eine mit einem Freund
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
            {otherUser.avatar_url ? (
              <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              otherUser.username.charAt(0)
            )}
          </div>
          <span className="font-semibold text-[var(--text-primary)] truncate">{otherUser.username}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="flex-shrink-0 px-3 py-1.5 rounded text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10"
          title="In Server einladen"
        >
          In Server einladen
        </button>
      </div>
      {showInviteModal && (
        <InviteToServerModalFromDm
          onClose={() => setShowInviteModal(false)}
          onInviteSent={handleInviteSent}
        />
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <div className="px-4 text-[var(--text-muted)] text-center py-8">
            Noch keine Nachrichten. Starte die Unterhaltung!
          </div>
        ) : (
          messages.map((msg) => (
            <MessageComponent
              key={msg.id}
              message={msg}
              profile={profiles[msg.user_id] ?? null}
              isOwn={msg.user_id === user?.id}
              onDelete={msg.user_id === user?.id ? () => handleDeleteMessage(msg) : undefined}
            />
          ))
        )}
      </div>
      <form onSubmit={(e) => sendMessage(e)} className="p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder={`Nachricht an ${otherUser.username}`}
          maxLength={2000}
          rows={1}
          className="w-full px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none min-h-[40px] max-h-[200px]"
        />
      </form>
    </div>
  )
}
