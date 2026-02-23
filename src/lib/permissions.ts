/**
 * Berechtigungen (Discord-ähnlich)
 * Bitweise Permissions
 */
const b = (n: number) => 2 ** n

export const PERMISSIONS = {
  // Allgemeine Serverberechtigungen
  VIEW_CHANNEL: b(0),           // Kanäle ansehen
  MANAGE_CHANNELS: b(1),        // Kanäle verwalten
  MANAGE_ROLES: b(2),           // Rollen verwalten
  MANAGE_WEBHOOKS: b(3),        // WebHooks verwalten
  MANAGE_SERVER: b(4),          // Server verwalten
  CREATE_EXPRESSIONS: b(5),     // Ausdrücke erstellen (Emoji, Sticker, Sounds)
  MANAGE_EXPRESSIONS: b(6),     // Ausdrücke verwalten
  VIEW_AUDIT_LOG: b(7),         // Audit-Log einsehen

  // Mitgliedschaftsberechtigungen
  CREATE_INVITE: b(8),          // Einladung erstellen
  CHANGE_NICKNAME: b(9),        // Nickname ändern (eigener)
  MANAGE_NICKNAMES: b(10),      // Nicknames verwalten (andere)
  KICK_MEMBERS: b(11),          // Mitglieder kicken
  BAN_MEMBERS: b(12),           // Mitglieder bannen
  MODERATE_MEMBERS: b(13),      // Mitglieder im Timeout

  // Textkanalberechtigungen
  SEND_MESSAGES: b(14),         // Nachrichten versenden und Posts erstellen
  SEND_MESSAGES_IN_THREADS: b(15),   // Nachrichten in Threads und Posts senden
  CREATE_PUBLIC_THREADS: b(16),      // Öffentliche Threads erstellen
  CREATE_PRIVATE_THREADS: b(17),     // Private Threads erstellen
  EMBED_LINKS: b(18),           // Links einbetten
  ATTACH_FILES: b(19),          // Dateien anhängen
  ADD_REACTIONS: b(20),         // Reaktionen hinzufügen
  USE_EXTERNAL_EMOJIS: b(21),   // Externe Emojis verwenden
  USE_EXTERNAL_STICKERS: b(22),      // Externe Sticker verwenden
  MENTION_EVERYONE: b(23),      // @everyone, @here, Alle Rollen erwähnen
  MANAGE_MESSAGES: b(24),       // Nachrichten verwalten
  PIN_MESSAGES: b(25),          // Nachrichten anpinnen
  BYPASS_SLOW_MODE: b(26),      // Slow-Modus umgehen
  MANAGE_THREADS: b(27),        // Threads und Posts verwalten
  READ_MESSAGE_HISTORY: b(28),  // Nachrichtenverlauf anzeigen
  SEND_TTS: b(29),              // Text-zu-Sprache-Nachrichten senden
  SEND_VOICE_MESSAGES: b(30),   // Sprachnachrichten senden
  CREATE_POLLS: b(31),          // Umfragen erstellen

  // Sprachkanalberechtigungen
  CONNECT: b(32),               // Verbinden (Voice)
  SPEAK: b(33),                 // Sprechen
  VIDEO: b(34),                 // Video teilen
  USE_SOUNDBOARD: b(35),        // Soundboard verwenden
  USE_EXTERNAL_SOUNDS: b(36),   // Externe Sounds verwenden
  USE_VOICE_ACTIVITY: b(37),    // Sprachaktivierung verwenden
  PRIORITY_SPEAKER: b(38),      // Very Important Speaker
  MUTE_MEMBERS: b(39),          // Mitglieder stummschalten
  DEAFEN_MEMBERS: b(40),        // Ein- und Ausgabe deaktivieren
  MOVE_MEMBERS: b(41),          // Mitglieder verschieben
  SET_VOICE_STATUS: b(42),      // Status des Sprachkanals festlegen

  // Apps-Berechtigungen
  USE_APPLICATION_COMMANDS: b(43),  // Anwendungsbefehle verwenden
  USE_ACTIVITIES: b(44),        // Aktivitäten nutzen

  // Event-Berechtigungen
  CREATE_EVENTS: b(45),         // Events erstellen
  MANAGE_EVENTS: b(46),         // Events verwalten

  // Erweiterte Berechtigungen
  ADMINISTRATOR: b(47),         // Administrator (alle Rechte)
} as const

// Legacy aliases für Abwärtskompatibilität
export const CHANNEL_PERMISSIONS = {
  VIEW_CHANNEL: PERMISSIONS.VIEW_CHANNEL,
  SEND_MESSAGES: PERMISSIONS.SEND_MESSAGES,
  MANAGE_CHANNEL: PERMISSIONS.MANAGE_CHANNELS,
  CONNECT: PERMISSIONS.CONNECT,
  SPEAK: PERMISSIONS.SPEAK,
  ADMINISTRATOR: PERMISSIONS.ADMINISTRATOR,
} as const

export const PERMISSION_LABELS: Record<number, string> = {
  [PERMISSIONS.VIEW_CHANNEL]: 'Kanal anzeigen',
  [PERMISSIONS.SEND_MESSAGES]: 'Nachrichten senden',
  [PERMISSIONS.MANAGE_CHANNELS]: 'Kanal verwalten',
  [PERMISSIONS.CONNECT]: 'Beitreten (Voice)',
  [PERMISSIONS.SPEAK]: 'Sprechen (Voice)',
  [PERMISSIONS.ADMINISTRATOR]: 'Administrator',
  [PERMISSIONS.READ_MESSAGE_HISTORY]: 'Nachrichtenverlauf anzeigen',
  [PERMISSIONS.ADD_REACTIONS]: 'Reaktionen hinzufügen',
  [PERMISSIONS.ATTACH_FILES]: 'Dateien anhängen',
  [PERMISSIONS.EMBED_LINKS]: 'Links einbetten',
  [PERMISSIONS.MANAGE_MESSAGES]: 'Nachrichten verwalten',
  [PERMISSIONS.MUTE_MEMBERS]: 'Mitglieder stummschalten',
  [PERMISSIONS.MOVE_MEMBERS]: 'Mitglieder verschieben',
}

export const TEXT_CHANNEL_PERMS = [
  PERMISSIONS.VIEW_CHANNEL,
  PERMISSIONS.SEND_MESSAGES,
  PERMISSIONS.READ_MESSAGE_HISTORY,
  PERMISSIONS.ADD_REACTIONS,
  PERMISSIONS.ATTACH_FILES,
  PERMISSIONS.EMBED_LINKS,
  PERMISSIONS.MANAGE_MESSAGES,
  PERMISSIONS.MANAGE_CHANNELS,
] as const

export const VOICE_CHANNEL_PERMS = [
  PERMISSIONS.VIEW_CHANNEL,
  PERMISSIONS.CONNECT,
  PERMISSIONS.SPEAK,
  PERMISSIONS.MUTE_MEMBERS,
  PERMISSIONS.MOVE_MEMBERS,
  PERMISSIONS.MANAGE_CHANNELS,
] as const

export interface PermissionItem {
  key: keyof typeof PERMISSIONS
  value: number
  label: string
  description: string
  warning?: string
}

export const PERMISSION_GROUPS: { title: string; permissions: PermissionItem[] }[] = [
  {
    title: 'Allgemeine Serverberechtigungen',
    permissions: [
      { key: 'VIEW_CHANNEL', value: PERMISSIONS.VIEW_CHANNEL, label: 'Kanäle ansehen', description: 'Erlaubt Mitgliedern, sich Kanäle standardmäßig anzuschauen (ausgenommen private Kanäle).' },
      { key: 'MANAGE_CHANNELS', value: PERMISSIONS.MANAGE_CHANNELS, label: 'Kanäle verwalten', description: 'Erlaubt Mitgliedern, Kanäle zu erstellen, zu bearbeiten oder zu löschen.', warning: 'Diese Berechtigung wird es bald nicht mehr ermöglichen, den Slow-Modus zu umgehen.' },
      { key: 'MANAGE_ROLES', value: PERMISSIONS.MANAGE_ROLES, label: 'Rollen verwalten', description: 'Erlaubt Mitgliedern, neue Rollen zu erstellen und Rollen zu bearbeiten oder zu löschen, die niedriger sind als ihre höchste Rolle. Erlaubt Mitgliedern außerdem, die Berechtigungen einzelner Kanäle zu ändern, auf die sie Zugriff haben.' },
      { key: 'CREATE_EXPRESSIONS', value: PERMISSIONS.CREATE_EXPRESSIONS, label: 'Ausdrücke erstellen', description: 'Erlaubt Mitgliedern, personalisierte Emojis, Sticker und Sounds auf diesem Server hinzuzufügen.' },
      { key: 'MANAGE_EXPRESSIONS', value: PERMISSIONS.MANAGE_EXPRESSIONS, label: 'Ausdrücke verwalten', description: 'Erlaubt Mitgliedern, personalisierte Emojis, Sticker und Sounds auf diesem Server zu bearbeiten oder zu entfernen.' },
      { key: 'VIEW_AUDIT_LOG', value: PERMISSIONS.VIEW_AUDIT_LOG, label: 'Audit-Log einsehen', description: 'Erlaubt Mitgliedern, sich ein Verzeichnis über alle Änderungen von Mitgliedern auf diesem Server anzusehen.' },
    ],
  },
  {
    title: 'Weitere Serverberechtigungen',
    permissions: [
      { key: 'MANAGE_WEBHOOKS', value: PERMISSIONS.MANAGE_WEBHOOKS, label: 'WebHooks verwalten', description: 'Erlaubt Mitgliedern, WebHooks zu erstellen, zu bearbeiten oder zu löschen, die Nachrichten von anderen Apps oder Seiten auf diesem Server posten können.' },
      { key: 'MANAGE_SERVER', value: PERMISSIONS.MANAGE_SERVER, label: 'Server verwalten', description: 'Erlaubt Mitgliedern, den Namen des Servers oder die Region zu ändern, alle Einladungen zu sehen, dem Server Bots hinzuzufügen und AutoMod-Regeln zu erstellen und zu aktualisieren.' },
    ],
  },
  {
    title: 'Mitgliedschaftsberechtigungen',
    permissions: [
      { key: 'CREATE_INVITE', value: PERMISSIONS.CREATE_INVITE, label: 'Einladung erstellen', description: 'Erlaubt Mitgliedern, neue Leute auf diesen Server einzuladen.' },
      { key: 'CHANGE_NICKNAME', value: PERMISSIONS.CHANGE_NICKNAME, label: 'Nickname ändern', description: 'Erlaubt Mitgliedern, ihren eigenen Nickname (ein benutzerdefinierter Name nur für diesen Server) zu ändern.' },
      { key: 'MANAGE_NICKNAMES', value: PERMISSIONS.MANAGE_NICKNAMES, label: 'Nicknames verwalten', description: 'Erlaubt Mitgliedern, die Nicknames anderer Mitglieder zu ändern.' },
      { key: 'KICK_MEMBERS', value: PERMISSIONS.KICK_MEMBERS, label: 'Mitglieder kicken, annehmen und ablehnen', description: 'Durch „Kicken" werden andere Mitglieder von diesem Server entfernt. Gekickte Mitglieder können erneut beitreten, wenn sie eine weitere Einladung erhalten. Wenn im Server Beitrittsvoraussetzungen aktiviert sind, können Mitglieder, die beitreten möchten, angenommen oder abgelehnt werden.' },
      { key: 'BAN_MEMBERS', value: PERMISSIONS.BAN_MEMBERS, label: 'Mitglieder bannen', description: 'Erlaubt Mitgliedern, andere Mitglieder dauerhaft von diesem Server zu bannen und deren Nachrichtenverlauf zu löschen.' },
      { key: 'MODERATE_MEMBERS', value: PERMISSIONS.MODERATE_MEMBERS, label: 'Mitglieder im Timeout', description: 'Wenn du jemandem ein Timeout gibst, kann diese Person weder Chatnachrichten senden noch auf Threads antworten, auf Nachrichten reagieren oder in Sprach- oder Stage-Kanälen sprechen.' },
    ],
  },
  {
    title: 'Textkanalberechtigungen',
    permissions: [
      { key: 'SEND_MESSAGES', value: PERMISSIONS.SEND_MESSAGES, label: 'Nachrichten versenden und Posts erstellen', description: 'Erlaubt Mitgliedern, Nachrichten in Textkanälen zu senden und Posts in Forenkanälen zu erstellen.' },
      { key: 'SEND_MESSAGES_IN_THREADS', value: PERMISSIONS.SEND_MESSAGES_IN_THREADS, label: 'Nachrichten in Threads und Posts senden', description: 'Erlaubt Mitgliedern, Nachrichten in Threads und in Posts in Forenkanälen zu senden.' },
      { key: 'CREATE_PUBLIC_THREADS', value: PERMISSIONS.CREATE_PUBLIC_THREADS, label: 'Öffentliche Threads erstellen', description: 'Erlaubt Mitgliedern, Threads zu erstellen, die alle Mitglieder in einem Kanal sehen können.' },
      { key: 'CREATE_PRIVATE_THREADS', value: PERMISSIONS.CREATE_PRIVATE_THREADS, label: 'Private Threads erstellen', description: 'Erlaubt Mitgliedern, Threads zu erstellen, die eine Einladung erfordern.' },
      { key: 'EMBED_LINKS', value: PERMISSIONS.EMBED_LINKS, label: 'Links einbetten', description: 'Erlaubt Links, die Mitglieder teilen, eingebettete Inhalte in Textkanälen anzuzeigen.' },
      { key: 'ATTACH_FILES', value: PERMISSIONS.ATTACH_FILES, label: 'Dateien anhängen', description: 'Erlaubt Mitgliedern, Dateien oder Medien in Textkanälen hochzuladen.' },
      { key: 'ADD_REACTIONS', value: PERMISSIONS.ADD_REACTIONS, label: 'Reaktionen hinzufügen', description: 'Erlaubt Mitgliedern, einer Nachricht neue Emoji-Reaktionen hinzuzufügen. Wenn diese Berechtigung deaktiviert ist, können Mitglieder immer noch mit bereits existierenden Reaktionen auf eine Nachricht reagieren.' },
      { key: 'USE_EXTERNAL_EMOJIS', value: PERMISSIONS.USE_EXTERNAL_EMOJIS, label: 'Externe Emojis verwenden', description: 'Erlaubt Mitgliedern, Emojis von anderen Servern zu verwenden, wenn sie Nitro-Mitglieder sind.' },
      { key: 'USE_EXTERNAL_STICKERS', value: PERMISSIONS.USE_EXTERNAL_STICKERS, label: 'Externe Sticker verwenden', description: 'Erlaubt Mitgliedern, Sticker von anderen Servern zu verwenden, wenn sie Nitro abonniert haben.' },
      { key: 'MENTION_EVERYONE', value: PERMISSIONS.MENTION_EVERYONE, label: 'Erwähne @everyone, @here und „Alle Rollen"', description: 'Erlaubt Mitgliedern, @everyone (jeder auf dem Server) oder @here (nur Mitglieder, die gerade online sind) zu verwenden. Sie können auch alle Rollen @erwähnen.' },
      { key: 'MANAGE_MESSAGES', value: PERMISSIONS.MANAGE_MESSAGES, label: 'Nachrichten verwalten', description: 'Erlaubt Mitgliedern, Einbettungen aus Nachrichten anderer Mitglieder zu löschen oder zu entfernen.', warning: 'Diese Berechtigung wird es bald nicht mehr ermöglichen, Nachrichten anzupinnen oder den Slow-Modus zu umgehen.' },
      { key: 'PIN_MESSAGES', value: PERMISSIONS.PIN_MESSAGES, label: 'Nachrichten anpinnen', description: 'Erlaubt Mitgliedern, beliebige Nachrichten anzupinnen oder loszulösen.' },
      { key: 'BYPASS_SLOW_MODE', value: PERMISSIONS.BYPASS_SLOW_MODE, label: 'Slow-Modus umgehen', description: 'Erlaubt Mitgliedern das Senden von Nachrichten, ohne vom Slow-Modus betroffen zu sein.' },
      { key: 'MANAGE_THREADS', value: PERMISSIONS.MANAGE_THREADS, label: 'Threads und Posts verwalten', description: 'Erlaubt Mitgliedern, Threads und Posts umzubenennen, zu löschen, zu schließen und den Slow-Modus zu aktivieren. Sie können außerdem private Threads sehen.', warning: 'Diese Berechtigung wird es bald nicht mehr ermöglichen, den Slow-Modus zu umgehen.' },
      { key: 'READ_MESSAGE_HISTORY', value: PERMISSIONS.READ_MESSAGE_HISTORY, label: 'Nachrichtenverlauf anzeigen', description: 'Erlaubt Mitgliedern, vorherige Nachrichten in Kanälen zu lesen. Wenn diese Berechtigung deaktiviert ist, sehen Mitglieder nur die Nachrichten, die gesendet werden, während sie online sind.' },
      { key: 'SEND_TTS', value: PERMISSIONS.SEND_TTS, label: 'Text-zu-Sprache-Nachrichten senden', description: 'Erlaubt Mitgliedern, Text-zu-Sprache-Nachrichten zu schicken, indem sie eine Nachricht mit /tts beginnen. Diese Nachrichten können von jedem im Kanal gehört werden.' },
      { key: 'SEND_VOICE_MESSAGES', value: PERMISSIONS.SEND_VOICE_MESSAGES, label: 'Sprachnachrichten senden', description: 'Erlaubt Mitgliedern, Sprachnachrichten zu senden.' },
      { key: 'CREATE_POLLS', value: PERMISSIONS.CREATE_POLLS, label: 'Umfragen erstellen', description: 'Erlaubt Mitgliedern, Umfragen zu erstellen.' },
    ],
  },
  {
    title: 'Sprachkanalberechtigungen',
    permissions: [
      { key: 'CONNECT', value: PERMISSIONS.CONNECT, label: 'Verbinden', description: 'Erlaubt Mitgliedern, Sprachkanälen beizutreten und andere zu hören.' },
      { key: 'SPEAK', value: PERMISSIONS.SPEAK, label: 'Sprechen', description: 'Erlaubt Mitgliedern, in Sprachkanälen zu reden. Wenn diese Berechtigung deaktiviert ist, sind Mitglieder standardmäßig stummgeschaltet, bis jemand mit der Berechtigung „Mitglieder stummschalten" die Stummschaltung aufhebt.' },
      { key: 'VIDEO', value: PERMISSIONS.VIDEO, label: 'Video', description: 'Erlaubt Mitgliedern, auf diesem Server ihre Videos zu teilen, die Bildschirmübertragung zu starten oder ein Spiel zu streamen.' },
      { key: 'USE_SOUNDBOARD', value: PERMISSIONS.USE_SOUNDBOARD, label: 'Soundboard verwenden', description: 'Erlaubt Mitgliedern, Sounds vom Server-Soundboard zu senden.' },
      { key: 'USE_EXTERNAL_SOUNDS', value: PERMISSIONS.USE_EXTERNAL_SOUNDS, label: 'Externe Sounds verwenden', description: 'Erlaubt Mitgliedern, Sounds von anderen Servern zu verwenden, wenn sie Nitro abonniert haben.' },
      { key: 'USE_VOICE_ACTIVITY', value: PERMISSIONS.USE_VOICE_ACTIVITY, label: 'Sprachaktivierung verwenden', description: 'Erlaubt Mitgliedern, in Sprachkanälen zu reden, indem sie einfach sprechen. Wenn diese Berechtigung deaktiviert ist, müssen Mitglieder Push-to-Talk verwenden.' },
      { key: 'PRIORITY_SPEAKER', value: PERMISSIONS.PRIORITY_SPEAKER, label: 'Very Important Speaker', description: 'Erlaubt Mitgliedern, in Sprachkanälen besser gehört zu werden. Wenn aktiviert, werden andere Mitglieder ohne diese Berechtigung automatisch leiser.' },
      { key: 'MUTE_MEMBERS', value: PERMISSIONS.MUTE_MEMBERS, label: 'Mitglieder stummschalten', description: 'Erlaubt Mitgliedern, andere Mitglieder in Sprachkanälen für alle stummzuschalten.' },
      { key: 'DEAFEN_MEMBERS', value: PERMISSIONS.DEAFEN_MEMBERS, label: 'Ein- und Ausgabe von Mitgliedern deaktivieren', description: 'Erlaubt Mitgliedern, die Ein- und Ausgabe anderer Mitglieder in Sprachkanälen zu deaktivieren. Diese Mitglieder können dann weder sprechen noch andere hören.' },
      { key: 'MOVE_MEMBERS', value: PERMISSIONS.MOVE_MEMBERS, label: 'Mitglieder verschieben', description: 'Erlaubt Mitgliedern, andere Mitglieder zu trennen oder zwischen Sprachkanälen zu verschieben, auf die sie Zugriff haben.' },
      { key: 'SET_VOICE_STATUS', value: PERMISSIONS.SET_VOICE_STATUS, label: 'Status des Sprachkanals festlegen', description: 'Erlaubt Mitgliedern, den Status eines Sprachkanals zu erstellen und zu bearbeiten.' },
    ],
  },
  {
    title: 'Apps-Berechtigungen',
    permissions: [
      { key: 'USE_APPLICATION_COMMANDS', value: PERMISSIONS.USE_APPLICATION_COMMANDS, label: 'Anwendungsbefehle verwenden', description: 'Erlaubt Mitgliedern, Befehle von Anwendungen zu verwenden, einschließlich Kontextmenü und Slash-Befehle.' },
      { key: 'USE_ACTIVITIES', value: PERMISSIONS.USE_ACTIVITIES, label: 'Aktivitäten nutzen', description: 'Erlaubt Mitgliedern, Aktivitäten zu nutzen.' },
    ],
  },
  {
    title: 'Event-Berechtigungen',
    permissions: [
      { key: 'CREATE_EVENTS', value: PERMISSIONS.CREATE_EVENTS, label: 'Events erstellen', description: 'Erlaubt Mitgliedern, Events zu erstellen.' },
      { key: 'MANAGE_EVENTS', value: PERMISSIONS.MANAGE_EVENTS, label: 'Events verwalten', description: 'Erlaubt Mitgliedern, Events zu bearbeiten und abzubrechen.' },
    ],
  },
  {
    title: 'Erweiterte Berechtigungen',
    permissions: [
      { key: 'ADMINISTRATOR', value: PERMISSIONS.ADMINISTRATOR, label: 'Administrator', description: 'Mitglieder mit dieser Berechtigung haben jede Berechtigung und können kanalspezifische Berechtigungen umgehen (sie haben zum Beispiel Zugriff auf alle privaten Kanäle). Mit dieser Berechtigung ist vorsichtig umzugehen.' },
    ],
  },
]

function toBigInt(n: number) { return BigInt(Math.floor(n)) }

export function hasPermission(perms: number, flag: number): boolean {
  const p = toBigInt(perms)
  const f = toBigInt(flag)
  const admin = toBigInt(PERMISSIONS.ADMINISTRATOR)
  if (f === admin) return (p & f) === f
  if ((p & admin) === admin) return true
  return (p & f) === f
}

export function setAllow(perms: number, flag: number, value: boolean): number {
  const p = toBigInt(perms)
  const f = toBigInt(flag)
  const next = value ? p | f : p & ~f
  return Number(next)
}
