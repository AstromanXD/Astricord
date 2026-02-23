/**
 * PresenceContext - Online-Status
 * Supabase Realtime Presence ODER Backend WebSocket
 */
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { createWebSocket, useBackend } from '../lib/api'
import { useUserSettings } from './UserSettingsContext'

const PRESENCE_CHANNEL = 'presence:global'

interface PresenceContextType {
  onlineUserIds: Set<string>
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const backend = useBackend()
  const { settings } = useUserSettings()
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const onlineRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set())
      onlineRef.current = new Set()
      return
    }

    if (backend) {
      onlineRef.current = new Set([user.id])
      setOnlineUserIds(onlineRef.current)
      const ws = createWebSocket(PRESENCE_CHANNEL)
      const handler = (e: MessageEvent) => {
        try {
          const { event, payload } = JSON.parse(e.data as string)
          if (event === 'PRESENCE_JOIN' && payload?.userId) {
            onlineRef.current = new Set(onlineRef.current).add(payload.userId)
            setOnlineUserIds(onlineRef.current)
          } else if (event === 'PRESENCE_LEAVE' && payload?.userId) {
            onlineRef.current = new Set(onlineRef.current)
            onlineRef.current.delete(payload.userId)
            setOnlineUserIds(onlineRef.current)
          }
        } catch (_) {}
      }
      ws.addEventListener('message', handler)
      return () => {
        ws.removeEventListener('message', handler)
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'unsubscribe', channel: PRESENCE_CHANNEL }))
        }
        ws.close()
      }
    }

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    })

    const updateOnlineUsers = () => {
      const state = channel.presenceState()
      const ids = new Set<string>()
      Object.values(state).forEach((presences) => {
        presences.forEach((p: { user_id?: string }) => {
          if (p.user_id) ids.add(p.user_id)
        })
      })
      setOnlineUserIds(ids)
    }

    if (settings.activityVisibility === 'none') {
      channel
        .on('presence', { event: 'sync' }, updateOnlineUsers)
        .on('presence', { event: 'join' }, updateOnlineUsers)
        .on('presence', { event: 'leave' }, updateOnlineUsers)
        .subscribe()
    } else {
      channel
        .on('presence', { event: 'sync' }, updateOnlineUsers)
        .on('presence', { event: 'join' }, updateOnlineUsers)
        .on('presence', { event: 'leave' }, updateOnlineUsers)
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ user_id: user.id })
          }
        })
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, backend, settings.activityVisibility])

  return (
    <PresenceContext.Provider value={{ onlineUserIds }}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  const ctx = useContext(PresenceContext)
  if (!ctx) {
    throw new Error('usePresence must be used within PresenceProvider')
  }
  return ctx
}
