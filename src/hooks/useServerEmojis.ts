import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { ServerEmoji } from '../lib/supabase'
import { useBackend, emojis } from '../lib/api'

export function useServerEmojis(serverId: string | null) {
  const backend = useBackend()
  const [emojisList, setEmojisList] = useState<ServerEmoji[]>([])

  const fetch = useCallback(async () => {
    if (!serverId) {
      setEmojisList([])
      return
    }
    if (backend) {
      try {
        const data = await emojis.list(serverId)
        setEmojisList(data ?? [])
      } catch {
        setEmojisList([])
      }
      return
    }
    const { data } = await supabase
      .from('server_emojis')
      .select('*')
      .eq('server_id', serverId)
      .order('name')
    setEmojisList(data ?? [])
  }, [serverId, backend])

  useEffect(() => {
    fetch()
    if (backend) return
    const sub = supabase
      .channel(`server_emojis:${serverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'server_emojis', filter: `server_id=eq.${serverId}` },
        () => fetch()
      )
      .subscribe()
    return () => { sub.unsubscribe() }
  }, [serverId, fetch, backend])

  useEffect(() => {
    if (!backend || !serverId) return
    const id = setInterval(fetch, 5000)
    return () => clearInterval(id)
  }, [backend, serverId, fetch])

  return emojisList
}
