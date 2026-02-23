/**
 * Theme Context - Theme-System mit CSS Variables
 * Themes: dark | light | midnight | neon
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Theme } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { useBackend, updateProfile } from '../lib/api'
import { useAuth } from './AuthContext'

// CSS Variable Definitionen pro Theme
const themeVariables: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg-primary': '#313338',
    '--bg-secondary': '#2b2d31',
    '--bg-tertiary': '#1e1f22',
    '--bg-sidebar': '#1e1f22',
    '--bg-hover': '#383a40',
    '--bg-active': '#404249',
    '--text-primary': '#f2f3f5',
    '--text-secondary': '#b5bac1',
    '--text-muted': '#80848e',
    '--accent': '#5865f2',
    '--accent-hover': '#4752c4',
    '--border': '#3f4147',
  },
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f2f3f5',
    '--bg-tertiary': '#e3e5e8',
    '--bg-sidebar': '#e3e5e8',
    '--bg-hover': '#e3e5e8',
    '--bg-active': '#d4d7dc',
    '--text-primary': '#060607',
    '--text-secondary': '#4e5058',
    '--text-muted': '#80848e',
    '--accent': '#5865f2',
    '--accent-hover': '#4752c4',
    '--border': '#e3e5e8',
  },
  midnight: {
    '--bg-primary': '#0c0c0e',
    '--bg-secondary': '#111114',
    '--bg-tertiary': '#18191c',
    '--bg-sidebar': '#000000',
    '--bg-hover': '#1e1e22',
    '--bg-active': '#252529',
    '--text-primary': '#f2f3f5',
    '--text-secondary': '#b5bac1',
    '--text-muted': '#80848e',
    '--accent': '#5865f2',
    '--accent-hover': '#4752c4',
    '--border': '#1e1e22',
  },
  neon: {
    '--bg-primary': '#0d1117',
    '--bg-secondary': '#161b22',
    '--bg-tertiary': '#21262d',
    '--bg-sidebar': '#0d1117',
    '--bg-hover': '#30363d',
    '--bg-active': '#484f58',
    '--text-primary': '#f0f6fc',
    '--text-secondary': '#8b949e',
    '--text-muted': '#6e7681',
    '--accent': '#58a6ff',
    '--accent-hover': '#79b8ff',
    '--border': '#30363d',
  },
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  const vars = themeVariables[theme]
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const backend = useBackend()
  const [theme, setThemeState] = useState<Theme>(profile?.theme ?? 'dark')

  useEffect(() => {
    const t = profile?.theme ?? theme
    applyTheme(t)
    if (profile?.theme) setThemeState(profile.theme)
  }, [profile?.theme, theme])

  const setTheme = useCallback(
    async (newTheme: Theme) => {
      setThemeState(newTheme)
      applyTheme(newTheme)
      if (user) {
        if (backend) {
          try {
            await updateProfile({ theme: newTheme })
          } catch (_) {}
        } else {
          await supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id)
        }
      }
    },
    [user, backend]
  )

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
