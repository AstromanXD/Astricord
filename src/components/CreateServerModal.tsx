/**
 * CreateServerModal - Server erstellen (Discord-Style)
 * Creator wird automatisch Server-Owner
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBackend, servers } from '../lib/api'

interface CreateServerModalProps {
  onClose: () => void
  onCreated: (serverId: string) => void
}

export function CreateServerModal({ onClose, onCreated }: CreateServerModalProps) {
  const backend = useBackend()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Servername darf nicht leer sein.')
      setLoading(false)
      return
    }

    try {
      if (backend) {
        const data = await servers.create({ name: trimmed })
        if (data?.id) {
          onCreated(data.id)
          onClose()
        }
      } else {
        const { data, error: err } = await supabase.rpc('create_server', {
          p_name: trimmed,
          p_icon_url: null,
        })
        if (err) throw err
        if (data) {
          onCreated(data as string)
          onClose()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-[95vw] max-w-[440px] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Server erstellen</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Du wirst automatisch als Server-Besitzer hinzugefügt.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
            Servername
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mein cooler Server"
            maxLength={100}
            className="w-full px-4 py-2.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] mb-4"
            autoFocus
          />

          {error && (
            <p className="text-sm text-[var(--accent-danger)] mb-4">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {loading ? 'Erstellen…' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
