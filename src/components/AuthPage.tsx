/**
 * AuthPage - Login & Register
 */
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

type AuthMode = 'login' | 'register'

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { signIn, signUp } = useAuth()

  const clearStoredSession = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k))
    window.location.reload()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else {
        const { error } = await signUp(email, password, username || undefined)
        if (error) setError(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-tertiary)]">
      <div className="w-full max-w-md p-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
        <div className="flex justify-center mb-4">
          <img
            src="/astricord-logo.png"
            alt="Astricord"
            className="max-w-[280px] w-full h-auto object-contain"
          />
        </div>
        <p className="text-center text-amber-400/90 text-sm mb-6 font-medium">
          Nur für Schulungszwecke — Kein echtes Produkt
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Benutzername
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Dein Name"
                className="w-full px-4 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              E-Mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="email@beispiel.de"
              className="w-full px-4 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full px-4 py-2 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? 'Bitte warten...' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </button>
        </form>

        <p className="mt-4 text-center">
          <button
            type="button"
            onClick={clearStoredSession}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
          >
            Gespeicherte Anmeldung löschen
          </button>
        </p>
        <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
          {mode === 'login' ? (
            <>
              Noch kein Konto?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-[var(--accent)] hover:underline"
              >
                Registrieren
              </button>
            </>
          ) : (
            <>
              Bereits registriert?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-[var(--accent)] hover:underline"
              >
                Anmelden
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
