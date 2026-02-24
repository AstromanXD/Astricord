import { useEffect, useState, useCallback } from 'react'
import type { ServerEmoji } from '../lib/supabase'
import { emojis } from '../lib/api'

export function useServerEmojis(serverId: string | null) {
  const [emojisList, setEmojisList] = useState<ServerEmoji[]>([])

  const fetch = useCallback(async () => {
    if (!serverId) {
      setEmojisList([])
      return
    }
    try {
      const data = await emojis.list(serverId)
      setEmojisList(data ?? [])
    } catch {
      setEmojisList([])
    }
  }, [serverId])

  useEffect(() => {
    fetch()
    if (!serverId) return
    const id = setInterval(fetch, 5000)
    return () => clearInterval(id)
  }, [serverId, fetch])

  return emojisList
}
