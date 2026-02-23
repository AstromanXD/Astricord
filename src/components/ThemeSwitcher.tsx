/**
 * ThemeSwitcher - Umschalten zwischen Themes
 */
import { useTheme } from '../contexts/ThemeContext'
import type { Theme } from '../lib/supabase'

const themes: { id: Theme; label: string }[] = [
  { id: 'dark', label: 'Dunkel' },
  { id: 'light', label: 'Hell' },
  { id: 'midnight', label: 'Mitternacht' },
  { id: 'neon', label: 'Neon' },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="py-2">
      <p className="px-3 py-1 text-xs font-semibold text-[var(--text-muted)] uppercase">
        Design
      </p>
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-[var(--bg-hover)] transition-colors ${
            theme === t.id ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
