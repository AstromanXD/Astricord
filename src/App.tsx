/**
 * Astricord - Haupt-App
 * Auth Guard, Layout, Provider
 */
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PresenceProvider } from './contexts/PresenceContext'
import { AuthPage } from './components/AuthPage'
import { MainLayout } from './components/MainLayout'
import { TrainingBanner } from './components/TrainingBanner'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg-tertiary)]">
        <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <button
          type="button"
          onClick={() => {
            Object.keys(localStorage)
              .filter((k) => k.startsWith('sb-'))
              .forEach((k) => localStorage.removeItem(k))
            window.location.reload()
          }}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
        >
          Gespeicherte Anmeldung löschen
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <TrainingBanner />
        <AuthPage />
      </>
    )
  }

  return (
    <PresenceProvider>
      <MainLayout />
    </PresenceProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  )
}
