/**
 * PresenceContext - Online-Status via Backend WebSocket
 * Deaktiviert wenn kein Backend (VITE_API_URL) konfiguriert ist
 */
import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { createWebSocket } from '../lib/api'

const PRESENCE_CHANNEL = 'presence:global'

interface PresenceContextType {
  onlineUserIds: Set<string>
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const onlineRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set())
      onlineRef.current = new Set()
      return
    }

    if (!import.meta.env.VITE_API_URL) {
      setOnlineUserIds(new Set([user.id]))
      return
    }

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
