/**
 * useVoiceSessions - Nutzer pro Voice-Channel (für ChannelList)
 * Lädt voice_sessions für alle Voice-Channels eines Servers + Realtime-Updates
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBackend, voice } from '../lib/api'

export interface VoiceSessionUser {
  userId: string
  username: string
  avatarUrl: string | null
  isMuted: boolean
  hasVideo?: boolean
  isScreenSharing?: boolean
}

export type VoiceSessionsByChannel = Map<string, VoiceSessionUser[]>

export function useVoiceSessions(serverId: string | null, channelIds: string[]): VoiceSessionsByChannel {
  const backend = useBackend()
  const [sessionsByChannel, setSessionsByChannel] = useState<VoiceSessionsByChannel>(new Map())

  const fetchSessions = useCallback(async () => {
    if (!serverId || channelIds.length === 0) {
      setSessionsByChannel(new Map())
      return
    }
    if (backend) {
      try {
        const data = await voice.getSessions(channelIds)
        const byChannel = new Map<string, VoiceSessionUser[]>()
        for (const [chId, users] of Object.entries(data ?? {})) {
          byChannel.set(chId, users.map((u) => ({
            userId: u.userId,
            username: u.username,
            avatarUrl: u.avatarUrl,
            isMuted: u.isMuted,
            hasVideo: u.hasVideo,
            isScreenSharing: u.isScreenSharing,
          })))
        }
        setSessionsByChannel(byChannel)
      } catch {
        setSessionsByChannel(new Map())
      }
      return
    }
    const { data: sessions } = await supabase
      .from('voice_sessions')
      .select('channel_id, user_id, is_muted, has_video, is_screen_sharing')
      .in('channel_id', channelIds)
    if (!sessions || sessions.length === 0) {
      setSessionsByChannel(new Map())
      return
    }
    const userIds = [...new Set(sessions.map((s) => s.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds)
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const byChannel = new Map<string, VoiceSessionUser[]>()
    for (const s of sessions) {
      const p = profileMap.get(s.user_id)
      const user: VoiceSessionUser = {
        userId: s.user_id,
        username: p?.username ?? 'Unbekannt',
        avatarUrl: p?.avatar_url ?? null,
        isMuted: s.is_muted,
        hasVideo: s.has_video ?? false,
        isScreenSharing: s.is_screen_sharing ?? false,
      }
      const list = byChannel.get(s.channel_id) ?? []
      list.push(user)
      byChannel.set(s.channel_id, list)
    }
    setSessionsByChannel(byChannel)
  }, [serverId, channelIds.join(','), backend])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    if (!serverId || channelIds.length === 0 || backend) return
    const channelIdSet = new Set(channelIds)
    const channel = supabase
      .channel(`voice_sessions:${serverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_sessions' },
        (payload: { new?: { channel_id?: string }; old?: { channel_id?: string } }) => {
          const chId = (payload.new ?? payload.old)?.channel_id
          if (chId && channelIdSet.has(chId)) fetchSessions()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [serverId, channelIds.join(','), fetchSessions, backend])

  useEffect(() => {
    if (!backend || channelIds.length === 0) return
    const id = setInterval(fetchSessions, 3000)
    return () => clearInterval(id)
  }, [backend, channelIds.join(','), fetchSessions])

  return sessionsByChannel
}
