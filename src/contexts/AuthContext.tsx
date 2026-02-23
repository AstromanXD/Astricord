/**
 * Auth Context - Login, Register, Session, Logout
 * Unterstützt Supabase (Standard) und eigenes Backend (VITE_API_URL gesetzt)
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
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

const useBackend = !!import.meta.env.VITE_API_URL

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    if (useBackend) {
      const p = await api<Profile>(`/api/profiles/${userId}`)
      setProfile(p)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    let cancelled = false

    const initAuth = async () => {
      try {
        if (useBackend) {
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
        } else if (!import.meta.env.VITE_SUPABASE_URL) {
          setLoading(false)
          return
        } else {
          const { data: { session } } = await supabase.auth.getSession()
          if (cancelled) return
          setSession(session)
          setUser(session?.user ?? null)
          if (session?.user) {
            const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
            setProfile(data)
          } else {
            setProfile(null)
          }
        }
      } catch (err) {
        console.error('Auth init error:', err)
        if (useBackend) apiAuth.signOut()
        else await supabase.auth.signOut()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initAuth()

    if (!useBackend) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
          setProfile(data)
        } else {
          setProfile(null)
        }
      })
      return () => {
        cancelled = true
        subscription.unsubscribe()
      }
    }

    return () => { cancelled = true }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (useBackend) {
      const { data, error } = await apiAuth.login(email, password)
      if (error) return { error }
      if (data?.user) {
        setUser({ id: data.user.id } as User)
        setSession({ user: { id: data.user.id } } as Session)
        if (data.profile) setProfile(data.profile as Profile)
      }
      return { error: null }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string, username?: string) => {
    if (useBackend) {
      const { data, error } = await apiAuth.register(email, password, username)
      if (error) return { error }
      if (data?.user) {
        setUser({ id: data.user.id } as User)
        setSession({ user: { id: data.user.id } } as Session)
        if (data.profile) setProfile(data.profile as Profile)
      }
      return { error: null }
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username ?? email.split('@')[0] } },
    })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    if (useBackend) {
      await apiAuth.signOut()
      setUser(null)
      setProfile(null)
      setSession(null)
      return
    }
    await supabase.auth.signOut()
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

function api<T>(path: string): Promise<T> {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const token = localStorage.getItem('astricord_token')
  return fetch(`${url}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  }).then((r) => r.json())
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
