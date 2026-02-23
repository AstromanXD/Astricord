/**
 * Datums- und Zeitformatierung mit Sprache & Zeitzone aus UserSettings
 */
import { getUserSettings } from './userSettings'

const localeMap: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
}

export function getFormatLocale(): string {
  const { language } = getUserSettings()
  return localeMap[language] ?? localeMap.de
}

export function getFormatTimezone(): string {
  return getUserSettings().timezone
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const locale = getFormatLocale()
  const tz = getFormatTimezone()
  const opts: Intl.DateTimeFormatOptions = { timeZone: tz }
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString(locale, { ...opts, hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(locale, {
    ...opts,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(getFormatLocale(), {
    timeZone: getFormatTimezone(),
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString(getFormatLocale(), {
    timeZone: getFormatTimezone(),
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
