/**
 * InviteToServerModalFromDm - Server auswählen, dann Freunde einladen (aus DM)
 */
import { useEffect, useState } from 'react'
import type { Server, Channel } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { InviteToServerModal } from './InviteToServerModal'
import { servers, channels } from '../lib/api'

interface InviteToServerModalFromDmProps {
  onClose: () => void
  onInviteSent: (inviteUrl: string) => void
}

export function InviteToServerModalFromDm({ onClose, onInviteSent }: InviteToServerModalFromDmProps) {
  const { user } = useAuth()
  const [serversList, setServersList] = useState<Server[]>([])
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [defaultChannel, setDefaultChannel] = useState<Channel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const data = await servers.list()
        setServersList(data ?? [])
      } catch {
        setServersList([])
      }
      setLoading(false)
    }
    load()
  }, [user?.id])

  useEffect(() => {
    if (!selectedServer) return
    channels.list(selectedServer.id).then((data) => {
      const textCh = (data ?? []).find((c) => c.type === 'text')
      setDefaultChannel(textCh ?? null)
    }).catch(() => setDefaultChannel(null))
  }, [selectedServer?.id])

  if (selectedServer) {
    return (
      <InviteToServerModal
        server={selectedServer}
        channel={defaultChannel}
        onClose={onClose}
        onInviteSent={onInviteSent}
      />
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Server auswählen
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Wähle den Server, zu dem du einladen möchtest.
          </p>
        </div>
        <div className="overflow-y-auto max-h-96 p-2">
          {loading ? (
            <div className="py-8 text-center text-[var(--text-muted)]">Laden…</div>
          ) : serversList.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              Du bist auf keinem Server. Erstelle zuerst einen Server.
            </div>
          ) : (
            <div className="space-y-1">
              {serversList.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => setSelectedServer(server)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-[var(--bg-modifier-hover)] text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-tertiary)] flex-shrink-0 flex items-center justify-center">
                    {server.icon_url ? (
                      <img src={server.icon_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-[var(--text-muted)]">
                        {server.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-[var(--text-primary)]">{server.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-modifier-hover)] text-[var(--text-primary)] font-medium"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
