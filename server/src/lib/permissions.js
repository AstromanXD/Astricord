/**
 * Berechtigungen (Discord-ähnlich) - Server-seitig
 * Muss mit src/lib/permissions.ts im Frontend übereinstimmen
 */
const b = (n) => 2 ** n

export const PERMISSIONS = {
  VIEW_CHANNEL: b(0),
  MANAGE_CHANNELS: b(1),
  MANAGE_ROLES: b(2),
  MANAGE_WEBHOOKS: b(3),
  MANAGE_SERVER: b(4),
  CREATE_EXPRESSIONS: b(5),
  MANAGE_EXPRESSIONS: b(6),
  VIEW_AUDIT_LOG: b(7),
  CREATE_INVITE: b(8),
  CHANGE_NICKNAME: b(9),
  MANAGE_NICKNAMES: b(10),
  KICK_MEMBERS: b(11),
  BAN_MEMBERS: b(12),
  MODERATE_MEMBERS: b(13),
  SEND_MESSAGES: b(14),
  SEND_MESSAGES_IN_THREADS: b(15),
  CREATE_PUBLIC_THREADS: b(16),
  CREATE_PRIVATE_THREADS: b(17),
  EMBED_LINKS: b(18),
  ATTACH_FILES: b(19),
  ADD_REACTIONS: b(20),
  USE_EXTERNAL_EMOJIS: b(21),
  USE_EXTERNAL_STICKERS: b(22),
  MENTION_EVERYONE: b(23),
  MANAGE_MESSAGES: b(24),
  PIN_MESSAGES: b(25),
  BYPASS_SLOW_MODE: b(26),
  MANAGE_THREADS: b(27),
  READ_MESSAGE_HISTORY: b(28),
  SEND_TTS: b(29),
  SEND_VOICE_MESSAGES: b(30),
  CREATE_POLLS: b(31),
  CONNECT: b(32),
  SPEAK: b(33),
  VIDEO: b(34),
  USE_SOUNDBOARD: b(35),
  USE_EXTERNAL_SOUNDS: b(36),
  USE_VOICE_ACTIVITY: b(37),
  PRIORITY_SPEAKER: b(38),
  MUTE_MEMBERS: b(39),
  DEAFEN_MEMBERS: b(40),
  MOVE_MEMBERS: b(41),
  SET_VOICE_STATUS: b(42),
  USE_APPLICATION_COMMANDS: b(43),
  USE_ACTIVITIES: b(44),
  CREATE_EVENTS: b(45),
  MANAGE_EVENTS: b(46),
  ADMINISTRATOR: b(47),
}

export function hasPermission(perms, flag) {
  if (perms == null) return false
  const p = BigInt(Math.floor(Number(perms)))
  const f = BigInt(flag)
  const admin = BigInt(PERMISSIONS.ADMINISTRATOR)
  if (f === admin) return (p & f) === f
  if ((p & admin) === admin) return true
  return (p & f) === f
}

/**
 * Berechnet die effektiven Berechtigungen eines Users auf einem Server.
 * Server-Owner hat immer volle Rechte (ADMINISTRATOR), unabhängig von Rollen.
 * Kombiniert alle Rollen-Berechtigungen (OR) und berücksichtigt Administrator.
 * Abwärtskompatibilität: Rolle "Admin" mit permissions=0 wird als ADMINISTRATOR behandelt.
 */
export async function getEffectivePermissions(pool, serverId, userId) {
  const [owner] = await pool.execute(
    'SELECT owner_id FROM servers WHERE id = ?',
    [serverId]
  )
  if (owner.length && owner[0].owner_id === userId) {
    return PERMISSIONS.ADMINISTRATOR
  }

  const [rows] = await pool.execute(
    `SELECT COALESCE(BIT_OR(sr.permissions), 0) as perms
     FROM server_members sm
     JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
     JOIN server_roles sr ON sr.id = smr.role_id
     WHERE sm.server_id = ? AND sm.user_id = ?`,
    [serverId, userId]
  )
  if (!rows.length) return 0
  let perms = Number(rows[0].perms ?? 0)
  if (perms === 0) {
    const [legacy] = await pool.execute(
      `SELECT 1 FROM server_members sm
       JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
       JOIN server_roles sr ON smr.role_id = sr.id
       WHERE sm.server_id = ? AND sm.user_id = ? AND sr.name = 'Admin'`,
      [serverId, userId]
    )
    if (legacy.length) perms = PERMISSIONS.ADMINISTRATOR
  }
  return perms
}
