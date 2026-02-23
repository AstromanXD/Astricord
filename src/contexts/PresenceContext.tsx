/**
 * PresenceContext - Online-Status (Supabase Realtime Presence)
 * User ist online wenn eingeloggt und App offen
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const PRESENCE_CHANNEL = 'presence:global'

interface PresenceContextType {
  onlineUserIds: Set<string>
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set())
      return
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

    channel
      .on('presence', { event: 'sync' }, updateOnlineUsers)
      .on('presence', { event: 'join' }, updateOnlineUsers)
      .on('presence', { event: 'leave' }, updateOnlineUsers)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

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
