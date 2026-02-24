/**
 * ChannelModal - Kanal erstellen/bearbeiten (Discord-Style)
 * Linke Sidebar mit Tabs, Berechtigungen mit 3-State (✓ / ✗ / —)
 */
import { useState, useEffect } from 'react'
import type { Channel, ChannelType } from '../lib/supabase'
import { channels as apiChannels } from '../lib/api'
import { ChannelPermissionsSection } from './ChannelPermissionsSection'

interface ChannelModalProps {
  serverId: string
  channel?: Channel | null
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
}

type Tab = 'uebersicht' | 'berechtigungen'

export function ChannelModal({ serverId, channel, onClose, onSaved, onDeleted }: ChannelModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ChannelType>('text')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [slowModeSeconds, setSlowModeSeconds] = useState(0)
  const [tab, setTab] = useState<Tab>('uebersicht')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const isEdit = !!channel

  useEffect(() => {
    if (channel) {
      setName(channel.name)
      setType(channel.type)
      setCategoryId((channel as { category_id?: string | null }).category_id ?? null)
      setSlowModeSeconds((channel as { slow_mode_seconds?: number }).slow_mode_seconds ?? 0)
    }
  }, [channel])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiChannels.listCategories(serverId)
        setCategories((data ?? []).map((c) => ({ id: c.id, name: c.name })))
      } catch {
        setCategories([])
      }
    }
    load()
  }, [serverId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name darf nicht leer sein.')
      setLoading(false)
      return
    }

    try {
      if (isEdit) {
        await apiChannels.update(channel.id, { name: trimmed, type, category_id: categoryId, slow_mode_seconds: slowModeSeconds })
      } else {
        await apiChannels.create({ server_id: serverId, name: trimmed, type, category_id: categoryId ?? undefined })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
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
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-[95vw] max-w-[600px] h-[85vh] max-h-[520px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Discord-Style */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
              {type === 'text' || type === 'forum' ? (
                <span className="text-[var(--text-muted)] text-lg">#</span>
              ) : (
                <svg className="w-5 h-5 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {isEdit ? 'Kanal bearbeiten' : 'Kanal erstellen'}
              </h2>
              {isEdit && (
                <p className="text-xs text-[var(--text-muted)]">#{channel?.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar + Content - Discord-Style */}
        <div className="flex flex-1 min-h-0">
          {/* Linke Sidebar */}
          <nav className="w-40 flex-shrink-0 py-3 px-2 border-r border-[var(--border)] bg-[var(--bg-tertiary)]">
            <button
              onClick={() => setTab('uebersicht')}
              className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${
                tab === 'uebersicht'
                  ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              Übersicht
            </button>
            {isEdit && (
              <button
                onClick={() => setTab('berechtigungen')}
                className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${
                  tab === 'berechtigungen'
                    ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                Berechtigungen
              </button>
            )}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'uebersicht' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {categories.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                      Kategorie
                    </label>
                    <select
                      value={categoryId ?? ''}
                      onChange={(e) => setCategoryId(e.target.value || null)}
                      className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="">Ohne Kategorie</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                    Kanalname
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. allgemein"
                    className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                    Kanaltyp
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="type"
                        value="text"
                        checked={type === 'text'}
                        onChange={() => setType('text')}
                        className="sr-only peer"
                      />
                      <span className="w-4 h-4 rounded-full border-2 border-[var(--border)] group-hover:border-[var(--text-muted)] peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] flex items-center justify-center">
                        {type === 'text' && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="text-[var(--text-primary)]">Textkanal</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="type"
                        value="voice"
                        checked={type === 'voice'}
                        onChange={() => setType('voice')}
                        className="sr-only peer"
                      />
                      <span className="w-4 h-4 rounded-full border-2 border-[var(--border)] group-hover:border-[var(--text-muted)] peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] flex items-center justify-center">
                        {type === 'voice' && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="text-[var(--text-primary)]">Sprachkanal</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="type"
                        value="forum"
                        checked={type === 'forum'}
                        onChange={() => setType('forum')}
                        className="sr-only peer"
                      />
                      <span className="w-4 h-4 rounded-full border-2 border-[var(--border)] group-hover:border-[var(--text-muted)] peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] flex items-center justify-center">
                        {type === 'forum' && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="text-[var(--text-primary)]">Forum</span>
                    </label>
                  </div>
                </div>

                {(type === 'text' || type === 'forum') && isEdit && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
                      Slow-Modus
                    </label>
                    <p className="text-xs text-[var(--text-muted)] mb-2">
                      Mitglieder müssen zwischen Nachrichten warten. 0 = aus.
                    </p>
                    <select
                      value={slowModeSeconds}
                      onChange={(e) => setSlowModeSeconds(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      {[0, 5, 10, 15, 30, 60, 120, 300, 600].map((s) => (
                        <option key={s} value={s}>
                          {s === 0 ? 'Aus' : `${s} Sekunden`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {error && <p className="text-[var(--accent-danger)] text-sm">{error}</p>}

                {deleteConfirm ? (
                  <div className="pt-4 border-t border-[var(--border)]">
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      „{channel?.name}“ wirklich löschen? Alle Nachrichten gehen verloren.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(false)}
                        className="px-4 py-2 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)]"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!channel) return
                          setLoading(true)
                          try {
                            await apiChannels.delete(channel.id)
                            onDeleted?.()
                            onClose()
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Fehler beim Löschen.')
                          } finally {
                            setLoading(false)
                          }
                        }}
                        disabled={loading}
                        className="px-4 py-2 rounded bg-[var(--accent-danger)] hover:opacity-90 text-white font-medium disabled:opacity-50"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                    <div>
                      {isEdit && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(true)}
                          className="text-sm text-[var(--accent-danger)] hover:underline"
                        >
                          Kanal löschen
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)]"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium disabled:opacity-50"
                      >
                        {loading ? 'Speichern...' : isEdit ? 'Änderungen speichern' : 'Kanal erstellen'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {tab === 'berechtigungen' && isEdit && channel && (
              <ChannelPermissionsSection
                channelId={channel.id}
                channelType={type}
                serverId={serverId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
