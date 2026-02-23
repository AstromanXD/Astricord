/**
 * UserSettingsModal - Benutzer-Einstellungen (Discord-Style)
 * Profil, Erscheinungsbild, Sprach- & Videochat
 */
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import type { Theme } from '../lib/supabase'
import {
  getVoiceSettings,
  setVoiceSettings,
  type VoiceSettings,
} from '../lib/voiceSettings'

type Tab =
  | 'profil'
  | 'erscheinungsbild'
  | 'voice'
  | 'chat'
  | 'hotkeys'
  | 'sprache-zeit'
  | 'windows'
  | 'streamer'
  | 'erweitert'
  | 'aktivitaet-privatsphaere'
  | 'aktivitaet-spiele'
  | 'aktivitaet-overlay'
type VoiceSubTab = 'sprachchat' | 'video' | 'streaming' | 'toene' | 'soundboard' | 'erweitert'

interface UserSettingsModalProps {
  onClose: () => void
}

export function UserSettingsModal({ onClose }: UserSettingsModalProps) {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('profil')
  const [voiceSubTab, setVoiceSubTab] = useState<VoiceSubTab>('sprachchat')
  const [voiceSettings, setVoiceSettingsState] = useState<VoiceSettings>(getVoiceSettings)
  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([])
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([])
  const [micTestActive, setMicTestActive] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [profileUsername, setProfileUsername] = useState(profile?.username ?? '')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [customStatus, setCustomStatus] = useState(profile?.custom_status ?? '')
  const micStreamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    setProfileUsername(profile?.username ?? '')
    setProfileAvatarUrl(profile?.avatar_url ?? '')
    setCustomStatus(profile?.custom_status ?? '')
  }, [profile?.username, profile?.avatar_url, profile?.custom_status])

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setInputDevices(devices.filter((d) => d.kind === 'audioinput'))
        setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'))
      } catch {}
    }
    loadDevices()
  }, [])

  const updateVoiceSetting = (partial: Partial<VoiceSettings>) => {
    setVoiceSettingsState((prev) => setVoiceSettings({ ...prev, ...partial }))
  }

  const startMicTest = async () => {
    if (micTestActive) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: voiceSettings.inputDeviceId === 'default' ? undefined : voiceSettings.inputDeviceId },
      })
      micStreamRef.current = stream
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setMicLevel(Math.min(100, (avg / 128) * 100))
        animationRef.current = requestAnimationFrame(tick)
      }
      setMicTestActive(true)
      tick()
    } catch (err) {
      console.error('Mic test failed:', err)
    }
  }

  const stopMicTest = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    setMicTestActive(false)
    setMicLevel(0)
  }

  if (!user || !profile) return null

  const themes: { id: Theme; label: string }[] = [
    { id: 'dark', label: 'Dunkel' },
    { id: 'light', label: 'Hell' },
    { id: 'midnight', label: 'Mitternacht' },
    { id: 'neon', label: 'Neon' },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-[95vw] max-w-[700px] h-[85vh] max-h-[600px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--accent)] flex items-center justify-center">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold">
                  {profile.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {profile.username}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">Profil bearbeiten</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--bg-modifier-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav className="w-52 flex-shrink-0 py-3 px-2 border-r border-[var(--border)] bg-[var(--bg-tertiary)] overflow-y-auto">
            <div className="px-3 py-2">
              <input
                type="text"
                placeholder="Suche"
                className="w-full px-3 py-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]"
              />
            </div>

            <button
              onClick={() => setTab('profil')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'profil' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profil bearbeiten
            </button>

            <button
              onClick={() => setTab('erscheinungsbild')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'erscheinungsbild' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Erscheinungsbild
            </button>

            {/* Sprach- & Videochat */}
            <div className="mt-2">
              <button
                onClick={() => setTab('voice')}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                  tab === 'voice' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Sprach- & Videochat
              </button>
              {tab === 'voice' && (
                <div className="ml-2 mt-1 space-y-0.5">
                  {(['sprachchat', 'video', 'streaming', 'toene', 'soundboard', 'erweitert'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setVoiceSubTab(st)}
                      className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 ${
                        voiceSubTab === st
                          ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)] border-l-2 border-[var(--accent)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
                      }`}
                    >
                      {st === 'sprachchat' && 'Sprachchat'}
                      {st === 'video' && 'Video'}
                      {st === 'streaming' && 'Streaming'}
                      {st === 'toene' && 'Töne'}
                      {st === 'soundboard' && 'Soundboard'}
                      {st === 'erweitert' && 'Erweitert'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="my-2 border-t border-[var(--border)]" />

            {/* Chat */}
            <button
              onClick={() => setTab('chat')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'chat' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </button>

            <button
              onClick={() => setTab('hotkeys')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'hotkeys' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Hotkeys
            </button>

            <button
              onClick={() => setTab('sprache-zeit')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'sprache-zeit' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              Sprache & Zeit
            </button>

            <button
              onClick={() => setTab('windows')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'windows' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Windows-Einstellungen
            </button>

            <button
              onClick={() => setTab('streamer')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'streamer' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Streamer-Modus
            </button>

            <button
              onClick={() => setTab('erweitert')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'erweitert' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
              Erweitert
            </button>

            <div className="my-2 border-t border-[var(--border)]" />

            {/* Aktivitätseinstellungen */}
            <p className="px-3 py-1 text-xs font-semibold text-[var(--text-muted)] uppercase">
              Aktivitätseinstellungen
            </p>
            <button
              onClick={() => setTab('aktivitaet-privatsphaere')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'aktivitaet-privatsphaere' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Privatsphäre deiner Aktivitäten
            </button>

            <button
              onClick={() => setTab('aktivitaet-spiele')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'aktivitaet-spiele' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Registrierte Spiele
            </button>

            <button
              onClick={() => setTab('aktivitaet-overlay')}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                tab === 'aktivitaet-overlay' ? 'bg-[var(--bg-modifier-active)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-modifier-hover)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              Game-Overlay
            </button>

            <div className="my-2 border-t border-[var(--border)]" />

            <button
              onClick={() => {
                signOut()
                onClose()
              }}
              className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 text-[var(--accent-danger)] hover:bg-[var(--accent-danger)]/10"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Abmelden
            </button>
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'profil' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Profil bearbeiten</h3>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                    Benutzername
                  </label>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value)}
                    className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                    Avatar-URL
                  </label>
                  <input
                    type="url"
                    value={profileAvatarUrl}
                    onChange={(e) => setProfileAvatarUrl(e.target.value)}
                    className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                    Custom Status (Rich Presence)
                  </label>
                  <input
                    type="text"
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder="z.B. Am Chillen"
                    maxLength={128}
                    className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!user) return
                    await supabase
                      .from('profiles')
                      .update({
                        username: profileUsername.trim(),
                        avatar_url: profileAvatarUrl.trim() || null,
                        custom_status: customStatus.trim() || null,
                      })
                      .eq('id', user.id)
                    refreshProfile()
                  }}
                  className="px-4 py-2 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium"
                >
                  Änderungen speichern
                </button>
              </div>
            )}

            {tab === 'erscheinungsbild' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Erscheinungsbild</h3>
                <div className="space-y-2">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`w-full text-left px-4 py-3 rounded flex items-center justify-between ${
                        theme === t.id ? 'bg-[var(--bg-modifier-active)]' : 'hover:bg-[var(--bg-modifier-hover)]'
                      }`}
                    >
                      <span className="text-[var(--text-primary)]">{t.label}</span>
                      {theme === t.id && (
                        <span className="text-[var(--accent)]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'voice' && voiceSubTab === 'sprachchat' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Sprach- & Videochat
                  </h3>
                  <h4 className="text-xl font-bold text-[var(--text-primary)] mt-1">
                    Sprachchat
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                    Mikrofon
                  </label>
                  <select
                    value={voiceSettings.inputDeviceId}
                    onChange={(e) => updateVoiceSetting({ inputDeviceId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)]"
                  >
                    <option value="default">System-Standard</option>
                    {inputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Mikrofon ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                    Lautsprecher
                  </label>
                  <select
                    value={voiceSettings.outputDeviceId}
                    onChange={(e) => updateVoiceSetting({ outputDeviceId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)]"
                  >
                    <option value="default">System-Standard</option>
                    {outputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Lautsprecher ${d.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                    Mikrofonlautstärke
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceSettings.inputVolume}
                    onChange={(e) => updateVoiceSetting({ inputVolume: parseInt(e.target.value) })}
                    className="w-full h-2 rounded-full accent-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                    Lautsprecherlautstärke
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={voiceSettings.outputVolume}
                    onChange={(e) => updateVoiceSetting({ outputVolume: parseInt(e.target.value) })}
                    className="w-full h-2 rounded-full accent-[var(--accent)]"
                  />
                </div>

                <div>
                  <button
                    onClick={micTestActive ? stopMicTest : startMicTest}
                    className={`px-4 py-2 rounded font-medium ${
                      micTestActive
                        ? 'bg-[var(--accent-danger)] hover:opacity-90'
                        : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                    } text-white`}
                  >
                    {micTestActive ? 'Test beenden' : 'Mikrofontest'}
                  </button>
                  <div className="flex gap-1 mt-2 h-4">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm transition-colors ${
                          (i / 20) * 100 < micLevel ? 'bg-[var(--accent-success)]' : 'bg-[var(--bg-tertiary)]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Aufnahmeprofil
                  </h4>
                  <div className="space-y-3">
                    {[
                      {
                        id: 'voice-isolation' as const,
                        label: 'Sprachisolation',
                        desc: 'Nur deine Stimme: Lärm wird herausgefiltert.',
                      },
                      {
                        id: 'studio' as const,
                        label: 'Studio',
                        desc: 'Reines Audio: offenes Mikrofon ohne Verarbeitung.',
                      },
                      {
                        id: 'custom' as const,
                        label: 'Benutzerdefiniert',
                        desc: 'Erweiterter Modus: volle Kontrolle.',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className="flex items-start gap-3 p-3 rounded hover:bg-[var(--bg-modifier-hover)] cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="recordingProfile"
                          checked={voiceSettings.recordingProfile === opt.id}
                          onChange={() => updateVoiceSetting({ recordingProfile: opt.id })}
                          className="mt-1 accent-[var(--accent)]"
                        />
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{opt.label}</p>
                          <p className="text-sm text-[var(--text-muted)]">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[var(--text-primary)]">
                      Mikrofonempfindlichkeit automatisch anpassen
                    </label>
                    <button
                      type="button"
                      onClick={() => updateVoiceSetting({ autoSensitivity: !voiceSettings.autoSensitivity })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        voiceSettings.autoSensitivity ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 block w-5 h-5 rounded-full bg-white shadow transition-transform"
                        style={{ transform: voiceSettings.autoSensitivity ? 'translateX(24px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    Bestimmt, wie viel Sound von deinem Mikrofon übertragen wird.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">
                    Hintergrundgeräusche unterdrücken
                  </label>
                  <select
                    value={voiceSettings.noiseSuppression}
                    onChange={(e) =>
                      updateVoiceSetting({
                        noiseSuppression: e.target.value as VoiceSettings['noiseSuppression'],
                      })
                    }
                    className="w-full px-3 py-2.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)]"
                  >
                    <option value="none">Aus</option>
                    <option value="standard">Standard</option>
                    <option value="krisp">Krisp</option>
                  </select>
                </div>
              </div>
            )}

            {tab === 'voice' && voiceSubTab !== 'sprachchat' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Sprach- & Videochat
                  </h3>
                  <h4 className="text-xl font-bold text-[var(--text-primary)] mt-1">
                    {voiceSubTab === 'video' && 'Video'}
                    {voiceSubTab === 'streaming' && 'Streaming'}
                    {voiceSubTab === 'toene' && 'Töne'}
                    {voiceSubTab === 'soundboard' && 'Soundboard'}
                    {voiceSubTab === 'erweitert' && 'Erweitert'}
                  </h4>
                </div>
                {voiceSubTab === 'video' && (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--text-muted)]">
                      Videoeinstellungen für Sprachkanäle. Aktiviere deine Kamera, um dich im Video-Call zu zeigen.
                    </p>
                    <div className="flex items-center justify-between p-3 rounded bg-[var(--bg-tertiary)]">
                      <span className="text-sm font-medium text-[var(--text-primary)]">Kamera aktivieren</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked={false} />
                        <div className="w-11 h-6 rounded-full bg-[var(--bg-secondary)] peer-checked:bg-[var(--accent)] transition-colors" />
                        <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                      </label>
                    </div>
                  </div>
                )}
                {voiceSubTab === 'streaming' && (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--text-muted)]">
                      Streaming-Qualität und Encoder-Einstellungen für Bildschirmübertragung.
                    </p>
                    <div className="p-4 rounded bg-[var(--bg-tertiary)]">
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Stream-Qualität</label>
                      <select className="w-full px-3 py-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]">
                        <option>Automatisch</option>
                        <option>720p 30fps</option>
                        <option>1080p 30fps</option>
                        <option>1080p 60fps</option>
                      </select>
                    </div>
                  </div>
                )}
                {voiceSubTab === 'toene' && (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--text-muted)]">
                      Sound-Effekte und Benachrichtigungstöne für Sprachkanäle.
                    </p>
                    <div className="p-4 rounded bg-[var(--bg-tertiary)]">
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Beitritts-Sound</label>
                      <select className="w-full px-3 py-2 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]">
                        <option>Standard</option>
                        <option>Aus</option>
                      </select>
                    </div>
                  </div>
                )}
                {voiceSubTab === 'soundboard' && (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--text-muted)]">
                      Eigene Sounds für die Soundboard-Funktion. Lade Sounds hoch und spiele sie im Voice-Chat ab.
                    </p>
                    <div className="p-4 rounded bg-[var(--bg-tertiary)] text-center text-[var(--text-muted)]">
                      <p className="text-sm">Noch keine Sounds hinzugefügt.</p>
                      <button type="button" className="mt-2 px-4 py-2 rounded bg-[var(--accent)] text-white text-sm">
                        Sound hinzufügen
                      </button>
                    </div>
                  </div>
                )}
                {voiceSubTab === 'erweitert' && (
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--text-muted)]">
                      Erweiterte Audio-Einstellungen wie Echo-Unterdrückung und Latenz.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded bg-[var(--bg-tertiary)]">
                        <span className="text-sm text-[var(--text-primary)]">Echo-Unterdrückung</span>
                        <select className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)]">
                          <option>Automatisch</option>
                          <option>Aus</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded bg-[var(--bg-tertiary)]">
                        <span className="text-sm text-[var(--text-primary)]">Audio-Subsystem</span>
                        <select className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)]">
                          <option>Standard</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'chat' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Chat</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Chat-Einstellungen wie Schriftgröße, Anzeige von Links und mehr.
                </p>
              </div>
            )}

            {tab === 'hotkeys' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Hotkeys</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Tastenkürzel für schnellen Zugriff auf Funktionen.
                </p>
              </div>
            )}

            {tab === 'sprache-zeit' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Sprache & Zeit</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Sprache der App und Zeitzone einstellen.
                </p>
              </div>
            )}

            {tab === 'windows' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Windows-Einstellungen</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Start beim Systemstart, Minimieren in die Taskleiste und mehr.
                </p>
              </div>
            )}

            {tab === 'streamer' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Streamer-Modus</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Blendet sensible Informationen aus, wenn du streamst.
                </p>
              </div>
            )}

            {tab === 'erweitert' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Erweitert</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Erweiterte Optionen für Entwickler und Power-User.
                </p>
              </div>
            )}

            {tab === 'aktivitaet-privatsphaere' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                  Privatsphäre deiner Aktivitäten
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Steuere, wer deine Aktivität und deinen Status sehen kann.
                </p>
              </div>
            )}

            {tab === 'aktivitaet-spiele' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                  Registrierte Spiele
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Spiele hinzufügen, die in deinem Status angezeigt werden.
                </p>
              </div>
            )}

            {tab === 'aktivitaet-overlay' && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Game-Overlay</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Overlay-Einstellungen für Spiele.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
