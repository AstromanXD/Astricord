/**
 * Kanalrechte (Discord-ähnlich)
 * Bitweise Permissions
 */
export const CHANNEL_PERMISSIONS = {
  VIEW_CHANNEL: 1024,
  SEND_MESSAGES: 2048,
  MANAGE_CHANNEL: 16,
  CONNECT: 1048576,
  SPEAK: 2097152,
  ADMINISTRATOR: 8,
} as const

export const PERMISSION_LABELS: Record<number, string> = {
  [CHANNEL_PERMISSIONS.VIEW_CHANNEL]: 'Kanal anzeigen',
  [CHANNEL_PERMISSIONS.SEND_MESSAGES]: 'Nachrichten senden',
  [CHANNEL_PERMISSIONS.MANAGE_CHANNEL]: 'Kanal verwalten',
  [CHANNEL_PERMISSIONS.CONNECT]: 'Beitreten (Voice)',
  [CHANNEL_PERMISSIONS.SPEAK]: 'Sprechen (Voice)',
  [CHANNEL_PERMISSIONS.ADMINISTRATOR]: 'Administrator',
}

/** Relevante Rechte für Textkanäle */
export const TEXT_CHANNEL_PERMS = [
  CHANNEL_PERMISSIONS.VIEW_CHANNEL,
  CHANNEL_PERMISSIONS.SEND_MESSAGES,
  CHANNEL_PERMISSIONS.MANAGE_CHANNEL,
] as const

/** Relevante Rechte für Sprachkanäle */
export const VOICE_CHANNEL_PERMS = [
  CHANNEL_PERMISSIONS.VIEW_CHANNEL,
  CHANNEL_PERMISSIONS.CONNECT,
  CHANNEL_PERMISSIONS.SPEAK,
  CHANNEL_PERMISSIONS.MANAGE_CHANNEL,
] as const

export function hasPermission(perms: number, flag: number): boolean {
  return (perms & flag) === flag
}

export function setAllow(perms: number, flag: number, value: boolean): number {
  if (value) return perms | flag
  return perms & ~flag
}
