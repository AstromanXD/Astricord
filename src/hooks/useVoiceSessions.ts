/**
 * useVoiceSessions - Nutzer pro Voice-Channel (für ChannelList)
 * Lädt voice_sessions über Backend-API
 */
import { useState, useEffect, useCallback } from 'react'
import { voice } from '../lib/api'

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
  const [sessionsByChannel, setSessionsByChannel] = useState<VoiceSessionsByChannel>(new Map())

  const fetchSessions = useCallback(async () => {
    if (!serverId || channelIds.length === 0) {
      setSessionsByChannel(new Map())
      return
    }
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
  }, [serverId, channelIds.join(',')])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    if (channelIds.length === 0) return
    const id = setInterval(fetchSessions, 3000)
    return () => clearInterval(id)
  }, [channelIds.join(','), fetchSessions])

  return sessionsByChannel
}
