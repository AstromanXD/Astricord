/**
 * Auth Context - Login, Register, Session, Logout
 * Läuft ausschließlich über das Backend
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { auth as apiAuth } from '../lib/api'
import type { Profile } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, username?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function api<T>(path: string): Promise<T> {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const token = localStorage.getItem('astricord_token')
  return fetch(`${url}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  }).then((r) => r.json())
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const p = await api<Profile>(`/api/profiles/${userId}`)
    setProfile(p)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    let cancelled = false

    const initAuth = async () => {
      try {
        const { data } = await apiAuth.getSession()
        if (cancelled) return
        const sess = data?.session
        setSession(sess ? { user: { id: sess.user.id } } as Session : null)
        setUser(sess ? { id: sess.user.id } as User : null)
        if (sess?.user) {
          const p = await api<Profile>(`/api/profiles/${sess.user.id}`)
          setProfile(p)
        } else {
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth init error:', err)
        apiAuth.signOut()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initAuth()
    return () => { cancelled = true }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await apiAuth.login(email, password)
    if (error) return { error }
    if (data?.user) {
      setUser({ id: data.user.id } as User)
      setSession({ user: { id: data.user.id } } as Session)
      if (data.profile) setProfile(data.profile as Profile)
    }
    return { error: null }
  }

  const signUp = async (email: string, password: string, username?: string) => {
    const { data, error } = await apiAuth.register(email, password, username)
    if (error) return { error }
    if (data?.user) {
      setUser({ id: data.user.id } as User)
      setSession({ user: { id: data.user.id } } as Session)
      if (data.profile) setProfile(data.profile as Profile)
    }
    return { error: null }
  }

  const signOut = async () => {
    await apiAuth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
