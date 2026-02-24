/**
 * useMessageReactions - Reaktionen pro Nachricht laden und Updates
 */
import { useEffect, useState, useCallback } from 'react'
import { reactions } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export type ReactionGroup = { emoji: string; count: number; userIds: string[] }

export function useMessageReactions(messageIds: string[]) {
  const { user } = useAuth()
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, ReactionGroup[]>>({})

  const fetchReactions = useCallback(async () => {
    if (messageIds.length === 0) {
      setReactionsByMessage({})
      return
    }
    try {
      const byMessage = await reactions.getByMessages(messageIds)
      const grouped: Record<string, ReactionGroup[]> = {}
      for (const [msgId, list] of Object.entries(byMessage)) {
        grouped[msgId] = []
        for (const r of list ?? []) {
          const existing = grouped[msgId].find((g) => g.emoji === r.emoji)
          if (existing) {
            if (!existing.userIds.includes(r.user_id)) {
              existing.userIds.push(r.user_id)
              existing.count++
            }
          } else {
            grouped[msgId].push({ emoji: r.emoji, count: 1, userIds: [r.user_id] })
          }
        }
      }
      setReactionsByMessage(grouped)
    } catch {
      setReactionsByMessage({})
    }
  }, [messageIds.join(',')])

  useEffect(() => {
    fetchReactions()
  }, [messageIds.join(','), fetchReactions])

  useEffect(() => {
    if (messageIds.length === 0) return
    const id = setInterval(fetchReactions, 2000)
    return () => clearInterval(id)
  }, [messageIds.join(','), fetchReactions])

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return
    const existing = reactionsByMessage[messageId]?.find((g) => g.emoji === emoji)
    const hasReacted = existing?.userIds.includes(user.id)

    const applyOptimistic = (add: boolean) => {
      setReactionsByMessage((prev) => {
        const next = { ...prev }
        const list = next[messageId] ?? []
        if (add) {
          const g = list.find((x) => x.emoji === emoji)
          if (g) {
            if (!g.userIds.includes(user.id)) {
              next[messageId] = list.map((x) =>
                x.emoji === emoji ? { ...x, userIds: [...x.userIds, user.id], count: x.count + 1 } : x
              )
            }
          } else {
            next[messageId] = [...list, { emoji, count: 1, userIds: [user.id] }]
          }
        } else {
          const g = list.find((x) => x.emoji === emoji)
          if (g) {
            const newUserIds = g.userIds.filter((id) => id !== user.id)
            if (newUserIds.length === 0) {
              next[messageId] = list.filter((x) => x.emoji !== emoji)
            } else {
              next[messageId] = list.map((x) =>
                x.emoji === emoji ? { ...x, userIds: newUserIds, count: newUserIds.length } : x
              )
            }
          }
        }
        return next
      })
    }

    try {
      applyOptimistic(!hasReacted)
      await reactions.toggle(messageId, emoji)
    } catch (_) {
      applyOptimistic(hasReacted)
    }
  }

  return { reactionsByMessage, toggleReaction }
}
