/**
 * EmojiPicker - Discord-Style Emoji-Auswahl
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import type { ServerEmoji } from '../lib/supabase'

const STANDARD_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
  '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
  '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
  '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
  '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '🔥', '✨', '💫', '⭐', '🌟', '💥', '💯', '🙏', '🎉', '🎊',
]

interface Sticker {
  id: string
  url: string
  label?: string
}
const TWEMOJI = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72'
const STICKERS: Sticker[] = [
  { id: '1f602', url: `${TWEMOJI}/1f602.png`, label: '😂' },
  { id: '1f62d', url: `${TWEMOJI}/1f62d.png`, label: '😭' },
  { id: '1f60d', url: `${TWEMOJI}/1f60d.png`, label: '😍' },
  { id: '1f60e', url: `${TWEMOJI}/1f60e.png`, label: '😎' },
  { id: '1f923', url: `${TWEMOJI}/1f923.png`, label: '🤣' },
  { id: '1f60a', url: `${TWEMOJI}/1f60a.png`, label: '😊' },
  { id: '1f97a', url: `${TWEMOJI}/1f97a.png`, label: '🥺' },
  { id: '1f622', url: `${TWEMOJI}/1f622.png`, label: '😢' },
  { id: '1f621', url: `${TWEMOJI}/1f621.png`, label: '😡' },
  { id: '1f634', url: `${TWEMOJI}/1f634.png`, label: '😴' },
  { id: '1f9d0', url: `${TWEMOJI}/1f9d0.png`, label: '🧐' },
  { id: '1f914', url: `${TWEMOJI}/1f914.png`, label: '🤔' },
  { id: '1f60f', url: `${TWEMOJI}/1f60f.png`, label: '😏' },
  { id: '1f605', url: `${TWEMOJI}/1f605.png`, label: '😅' },
  { id: '1f643', url: `${TWEMOJI}/1f643.png`, label: '🙃' },
  { id: '1f917', url: `${TWEMOJI}/1f917.png`, label: '🤗' },
  { id: '2764', url: `${TWEMOJI}/2764-fe0f.png`, label: '❤️' },
  { id: '1f525', url: `${TWEMOJI}/1f525.png`, label: '🔥' },
  { id: '2728', url: `${TWEMOJI}/2728.png`, label: '✨' },
  { id: '1f389', url: `${TWEMOJI}/1f389.png`, label: '🎉' },
]

interface EmojiPickerProps {
  serverEmojis: ServerEmoji[]
  serverName?: string
  onSelect: (emoji: string) => void
  onSelectCustom: (name: string) => void
  onInsertGif?: (url: string) => void
  onClose: () => void
  onAddEmoji?: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  /** Tab, der beim Öffnen angezeigt wird */
  initialTab?: 'gifs' | 'sticker' | 'emojis'
}

const GIF_CATEGORIES: { id: string; label: string; search: string; bg: string; icon?: string }[] = [
  { id: 'favoriten', label: 'Favoriten', search: '__featured__', bg: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)' },
  { id: 'trending', label: 'Angesagte GIFs', search: '__featured__', bg: 'linear-gradient(135deg, #ec4899 0%, #9333ea 100%)', icon: '📈' },
  { id: 'faul', label: 'faul', search: 'faul lazy', bg: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)' },
  { id: 'betont', label: 'betont', search: 'betont stressed', bg: 'linear-gradient(135deg, #15803d 0%, #14532d 100%)' },
  { id: 'verlegen', label: 'verlegen', search: 'verlegen embarrassed', bg: 'linear-gradient(135deg, #e11d48 0%, #be185d 100%)' },
  { id: 'beifall', label: 'beifall', search: 'beifall applause', bg: 'linear-gradient(135deg, #475569 0%, #334155 100%)' },
]

interface KlipyFileFormat {
  gif?: { url?: string }
  webp?: { url?: string }
}
interface KlipyGif {
  id: string | number
  file?: {
    hd?: KlipyFileFormat
    md?: KlipyFileFormat
    sm?: KlipyFileFormat
    xs?: KlipyFileFormat
  }
}

export function EmojiPicker({
  serverEmojis,
  serverName,
  onSelect,
  onSelectCustom,
  onInsertGif,
  onClose,
  onAddEmoji,
  anchorRef,
  initialTab = 'emojis',
}: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<'gifs' | 'sticker' | 'emojis'>(initialTab)
  const [search, setSearch] = useState('')
  const [gifSearch, setGifSearch] = useState('')
  const [gifResults, setGifResults] = useState<KlipyGif[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifCategory, setGifCategory] = useState<string | null>(null)
  const [frequentOpen, setFrequentOpen] = useState(true)
  const pickerRef = useRef<HTMLDivElement>(null)

  const klipyKey = import.meta.env.VITE_KLIPY_API_KEY

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const filteredServer = serverEmojis.filter((e) =>
    search ? e.name.toLowerCase().includes(search.toLowerCase()) : true
  )

  const fetchGifs = useCallback(async (query: string) => {
    if (!klipyKey) return
    setGifLoading(true)
    try {
      const isFeatured = query === '__featured__'
      const base = `https://api.klipy.com/api/v1/${klipyKey}/gifs`
      const url = isFeatured
        ? `${base}/trending?per_page=12&rating=g`
        : `${base}/search?q=${encodeURIComponent(query)}&per_page=12&rating=g`
      const res = await fetch(url)
      const json = await res.json()
      const items = json?.data?.data ?? json?.results ?? []
      setGifResults(Array.isArray(items) ? items : [])
    } catch {
      setGifResults([])
    }
    setGifLoading(false)
  }, [klipyKey])

  useEffect(() => {
    if (activeTab === 'gifs' && (gifSearch || gifCategory)) {
      fetchGifs(gifSearch || gifCategory || '')
    } else if (activeTab === 'gifs' && !gifSearch && !gifCategory) {
      setGifResults([])
    }
  }, [activeTab, gifSearch, gifCategory, fetchGifs])

  const handleGifSearch = () => {
    if (klipyKey && gifSearch.trim()) fetchGifs(gifSearch.trim())
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, anchorRef])

  return (
    <div
      ref={pickerRef}
      className="absolute top-full left-0 mt-1 w-[352px] rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] shadow-2xl overflow-hidden z-50"
    >
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {(['gifs', 'sticker', 'emojis'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent)] bg-[var(--bg-modifier-active)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-modifier-hover)]'
            }`}
          >
            {tab === 'gifs' && 'GIFs'}
            {tab === 'sticker' && 'Sticker'}
            {tab === 'emojis' && 'Emojis'}
          </button>
        ))}
      </div>

      {/* GIFs Tab */}
      {activeTab === 'gifs' && (
        <div className="p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--bg-secondary)] mb-3">
            <svg className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGifSearch()}
              placeholder="GIFs durchsuchen"
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
            />
          </div>

          {!gifSearch && !gifCategory ? (
            <div className="grid grid-cols-2 gap-2">
              {GIF_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setGifCategory(cat.search)}
                  className="aspect-[4/3] rounded-lg flex items-end p-2 hover:opacity-90 transition-opacity"
                  style={{ background: cat.bg }}
                >
                  <span className="text-white text-sm font-medium drop-shadow flex items-center gap-1">
                    {cat.icon && <span>{cat.icon}</span>}
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => { setGifCategory(null); setGifSearch(''); setGifResults([]) }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ← Zurück
              </button>
              {gifLoading ? (
                <div className="h-32 flex items-center justify-center text-[var(--text-muted)] text-sm">Laden...</div>
              ) : !klipyKey ? (
                <div className="h-32 flex flex-col items-center justify-center text-[var(--text-muted)] text-sm text-center px-4">
                  <p>Für GIFs: VITE_KLIPY_API_KEY in .env setzen</p>
                  <a href="https://partner.klipy.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] mt-1 text-xs">Kostenlosen API-Key holen</a>
                </div>
              ) : gifResults.length > 0 ? (
                <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                  {gifResults.map((gif) => {
                    const f = gif.file
                    const url = f?.md?.gif?.url || f?.hd?.gif?.url || f?.sm?.gif?.url || f?.xs?.gif?.url
                    const thumbUrl = f?.sm?.gif?.url || f?.xs?.gif?.url || url
                    return (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => {
                          if (url && onInsertGif) {
                            onInsertGif(url)
                            onClose()
                          }
                        }}
                        className="aspect-square rounded overflow-hidden hover:ring-2 ring-[var(--accent)]"
                      >
                        {thumbUrl && <img src={thumbUrl} alt="" className="w-full h-full object-cover" />}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-[var(--text-muted)] text-sm">Keine GIFs gefunden</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticker Tab */}
      {activeTab === 'sticker' && (
        <div className="h-64 overflow-y-auto p-2">
          <div className="grid grid-cols-5 gap-1">
            {STICKERS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (onInsertGif) {
                    onInsertGif(s.url)
                    onClose()
                  }
                }}
                className="w-12 h-12 flex items-center justify-center rounded hover:bg-[var(--bg-modifier-hover)] p-1"
                title={s.label}
              >
                <img src={s.url} alt={s.label ?? ''} className="w-10 h-10 object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emojis Tab */}
      {activeTab === 'emojis' && (
      <div>
        {/* Suche + Emoji hinzufügen */}
        <div className="flex items-center gap-2 p-2 border-b border-[var(--border)]">
            <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--bg-secondary)]">
              <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder=":face_with_symbols_over_mc"
                className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              />
            </div>
            {onAddEmoji && (
              <button
                type="button"
                onClick={onAddEmoji}
                className="px-2 py-1.5 rounded text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10"
              >
                Emoji hinzufügen
              </button>
            )}
        </div>

        {/* Emoji-Grid */}
        <div className="h-64 overflow-y-auto p-2">
          {/* Häufig verwendet */}
          <div className="mb-3">
            <button
                type="button"
                onClick={() => setFrequentOpen(!frequentOpen)}
                className="flex items-center gap-1 w-full text-left py-1.5 px-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${frequentOpen ? '' : '-rotate-90'}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M7 10l5 5 5-5z" />
                </svg>
                Häufig verwendet
            </button>
            {frequentOpen && (
              <div className="grid grid-cols-8 gap-0.5 mt-1">
                  {STANDARD_EMOJIS.slice(0, 48).map((emoji, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSelect(emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-modifier-hover)] text-xl"
                    >
                      {emoji}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Server-Emojis */}
          {(serverEmojis.length > 0 || search) && (
            <div className="mt-3">
              <div className="py-1.5 px-1 text-xs font-semibold text-[var(--text-muted)]">
                {serverName ?? 'Server'}
              </div>
              <div className="grid grid-cols-8 gap-0.5 mt-1">
                {(search ? filteredServer : serverEmojis).map((emoji) => (
                  <button
                    key={emoji.id}
                    type="button"
                    onClick={() => onSelectCustom(emoji.name)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-modifier-hover)] p-0.5"
                    title={`:${emoji.name}:`}
                  >
                    <img src={emoji.image_url} alt={emoji.name} className="w-6 h-6 object-contain" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
