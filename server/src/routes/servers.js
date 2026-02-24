import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { PERMISSIONS, hasPermission, getEffectivePermissions } from '../lib/permissions.js'

const router = Router()
router.use(authMiddleware)

async function checkPerm(serverId, userId, flag) {
  const perms = await getEffectivePermissions(pool, serverId, userId)
  return hasPermission(perms, flag)
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.id, s.name, s.icon_url, s.description, s.banner_color, s.created_at
       FROM servers s
       JOIN server_members sm ON s.id = sm.server_id
       WHERE sm.user_id = ?
       ORDER BY s.created_at`,
      [req.user.id]
    )
    const servers = rows.map((r) => ({
      ...r,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    }))
    res.json(servers)
  } catch (err) {
    console.error('Servers list error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, icon_url, description, banner_color } = req.body
    const serverId = uuidv4()
    const adminRoleId = uuidv4()
    const memberRoleId = uuidv4()
    const channelId = uuidv4()

    await pool.query('START TRANSACTION')
    await pool.execute(
      'INSERT INTO servers (id, name, icon_url, description, banner_color, owner_id) VALUES (?, ?, ?, ?, ?, ?)',
      [serverId, name || 'Neuer Server', icon_url || null, description || null, banner_color || '#4f545c', req.user.id]
    )
    const defaultMemberPerms =
      PERMISSIONS.VIEW_CHANNEL | PERMISSIONS.SEND_MESSAGES | PERMISSIONS.READ_MESSAGE_HISTORY |
      PERMISSIONS.ADD_REACTIONS | PERMISSIONS.CONNECT | PERMISSIONS.SPEAK |
      PERMISSIONS.ATTACH_FILES | PERMISSIONS.EMBED_LINKS
    await pool.execute(
      'INSERT INTO server_roles (id, server_id, name, color, position, permissions) VALUES (?, ?, ?, ?, ?, ?)',
      [adminRoleId, serverId, 'Admin', '#5865f2', 100, PERMISSIONS.ADMINISTRATOR]
    )
    await pool.execute(
      'INSERT INTO server_roles (id, server_id, name, color, position, permissions) VALUES (?, ?, ?, ?, ?, ?)',
      [memberRoleId, serverId, 'Member', '#57f287', 0, defaultMemberPerms]
    )
    await pool.execute(
      'INSERT INTO server_members (server_id, user_id) VALUES (?, ?)',
      [serverId, req.user.id]
    )
    await pool.execute(
      'INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)',
      [serverId, req.user.id, memberRoleId]
    )
    await pool.execute(
      'INSERT INTO channels (id, server_id, name, type, position) VALUES (?, ?, ?, ?, ?)',
      [channelId, serverId, 'allgemein', 'text', 0]
    )
    await pool.query('COMMIT')

    const [newServer] = await pool.execute(
      'SELECT id, name, icon_url, description, banner_color, created_at FROM servers WHERE id = ?',
      [serverId]
    )
    const s = newServer[0]
    if (s?.created_at) s.created_at = s.created_at.toISOString?.() ?? s.created_at
    res.status(201).json(s)
  } catch (err) {
    await pool.query('ROLLBACK')
    console.error('Create server error:', err)
    res.status(500).json({ error: 'Server erstellen fehlgeschlagen' })
  }
})

router.get('/:id/role-colors', async (req, res) => {
  try {
    const { userIds } = req.query
    const ids = (typeof userIds === 'string' ? userIds.split(',') : userIds || []).filter(Boolean)
    if (!ids.length) return res.json({})

    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    const ph = ids.map(() => '?').join(',')
    const [rows] = await pool.execute(
      `SELECT smr.user_id, sr.color, sr.position
       FROM server_member_roles smr
       JOIN server_roles sr ON sr.id = smr.role_id
       WHERE smr.server_id = ? AND smr.user_id IN (${ph})`,
      [req.params.id, ...ids]
    )

    const byUser = {}
    rows.forEach((r) => {
      if (!byUser[r.user_id] || (byUser[r.user_id].position ?? 0) < (r.position ?? 0)) {
        byUser[r.user_id] = { color: r.color, position: r.position }
      }
    })
    const result = {}
    Object.entries(byUser).forEach(([uid, v]) => {
      if (v?.color) result[uid] = v.color
    })
    res.json(result)
  } catch (err) {
    console.error('Role colors error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/:id/members', async (req, res) => {
  try {
    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })
    const [rows] = await pool.execute(
      'SELECT user_id FROM server_members WHERE server_id = ?',
      [req.params.id]
    )
    res.json(rows.map((r) => r.user_id))
  } catch (err) {
    console.error('Members error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/:id/members-detail', async (req, res) => {
  try {
    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    const [[roles], [members], [memberRoles], [profiles], [nicknames]] = await Promise.all([
      pool.execute(
        'SELECT id, server_id, name, color, position FROM server_roles WHERE server_id = ? ORDER BY position DESC',
        [req.params.id]
      ),
      pool.execute('SELECT user_id, timeout_until FROM server_members WHERE server_id = ?', [req.params.id]),
      pool.execute(
        'SELECT user_id, role_id FROM server_member_roles WHERE server_id = ?',
        [req.params.id]
      ),
      pool.execute(
        `SELECT p.id, p.username, p.avatar_url, p.theme, p.status, p.created_at FROM profiles p
         WHERE p.id IN (SELECT user_id FROM server_members WHERE server_id = ?)`,
        [req.params.id]
      ),
      pool.execute(
        'SELECT user_id, nickname FROM server_member_nicknames WHERE server_id = ?',
        [req.params.id]
      ),
    ])

    const profileMap = Object.fromEntries(
      profiles.map((p) => [
        p.id,
        { ...p, created_at: p.created_at?.toISOString?.() ?? p.created_at },
      ])
    )
    const roleMap = Object.fromEntries(
      roles.map((r) => [r.id, { ...r, created_at: r.created_at?.toISOString?.() ?? r.created_at }])
    )
    const rolesByUser = new Map()
    memberRoles.forEach((mr) => {
      const role = roleMap[mr.role_id]
      if (role) {
        const list = rolesByUser.get(mr.user_id) ?? []
        if (!list.find((x) => x.id === role.id)) list.push(role)
        rolesByUser.set(mr.user_id, list)
      }
    })
    const nicknameMap = Object.fromEntries((nicknames ?? []).map((n) => [n.user_id, n.nickname]))

    const result = {
      roles: roles.map((r) => ({ ...r, created_at: r.created_at?.toISOString?.() ?? r.created_at })),
      members: members.map((m) => ({
        userId: m.user_id,
        nickname: nicknameMap[m.user_id] ?? null,
        timeout_until: m.timeout_until?.toISOString?.() ?? null,
        profile: profileMap[m.user_id] ?? {
          id: m.user_id,
          username: 'Unbekannt',
          avatar_url: null,
          theme: 'dark',
          created_at: '',
        },
        roles: rolesByUser.get(m.user_id) ?? [],
      })),
    }
    res.json(result)
  } catch (err) {
    console.error('Members detail error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.KICK_MEMBERS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Kann sich nicht selbst kicken' })

    const [[prof]] = await pool.execute('SELECT username FROM profiles WHERE id = ?', [req.params.userId])
    await pool.execute(
      'INSERT INTO audit_log (id, server_id, user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, req.user.id, 'member_kicked', 'user', req.params.userId, JSON.stringify({ username: prof?.username })]
    )
    await pool.execute(
      'DELETE FROM server_member_roles WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    )
    await pool.execute(
      'DELETE FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    )
    res.status(204).send()
  } catch (err) {
    console.error('Kick error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/:id/members/:userId/ban', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.BAN_MEMBERS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Kann sich nicht selbst bannen' })

    const [[prof]] = await pool.execute('SELECT username FROM profiles WHERE id = ?', [req.params.userId])
    await pool.execute(
      'INSERT INTO audit_log (id, server_id, user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.params.id, req.user.id, 'member_banned', 'user', req.params.userId, JSON.stringify({ username: prof?.username })]
    )
    await pool.execute(
      'INSERT INTO server_bans (server_id, user_id, banned_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE banned_by = ?',
      [req.params.id, req.params.userId, req.user.id, req.user.id]
    )
    await pool.execute(
      'DELETE FROM server_member_roles WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    )
    await pool.execute(
      'DELETE FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    )
    res.status(204).send()
  } catch (err) {
    console.error('Ban error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/:id/members/:userId/timeout', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.MODERATE_MEMBERS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Kann sich nicht selbst in Timeout setzen' })

    const [srv] = await pool.execute('SELECT owner_id FROM servers WHERE id = ?', [req.params.id])
    if (srv.length && srv[0].owner_id === req.params.userId) {
      return res.status(400).json({ error: 'Owner kann nicht in Timeout gesetzt werden' })
    }

    const { timeout_until } = req.body
    const until = timeout_until ? new Date(timeout_until) : null
    if (until && until.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Timeout muss in der Zukunft liegen' })
    }

    await pool.execute(
      'UPDATE server_members SET timeout_until = ? WHERE server_id = ? AND user_id = ?',
      [until, req.params.id, req.params.userId]
    )
    res.status(204).send()
  } catch (err) {
    console.error('Timeout error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/:id/members/:userId/nickname', async (req, res) => {
  try {
    const { nickname } = req.body
    const isSelf = req.params.userId === req.user.id
    const canManage = await checkPerm(req.params.id, req.user.id, PERMISSIONS.MANAGE_NICKNAMES)
    const canChangeOwn = await checkPerm(req.params.id, req.user.id, PERMISSIONS.CHANGE_NICKNAME)
    if (!isSelf && !canManage) return res.status(403).json({ error: 'Keine Berechtigung' })
    if (isSelf && !canChangeOwn && !canManage) return res.status(403).json({ error: 'Keine Berechtigung' })

    const trimmed = (nickname ?? '').trim().slice(0, 32)
    if (trimmed.length === 0) {
      await pool.execute(
        'DELETE FROM server_member_nicknames WHERE server_id = ? AND user_id = ?',
        [req.params.id, req.params.userId]
      )
    } else {
      await pool.execute(
        'INSERT INTO server_member_nicknames (server_id, user_id, nickname) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nickname = ?',
        [req.params.id, req.params.userId, trimmed, trimmed]
      )
    }
    res.status(204).send()
  } catch (err) {
    console.error('Nickname error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/:id/transfer-ownership', async (req, res) => {
  try {
    const [srv] = await pool.execute('SELECT owner_id FROM servers WHERE id = ?', [req.params.id])
    if (!srv.length || srv[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Nur der Owner kann die Besitzrechte übertragen' })
    }
    const { new_owner_id } = req.body
    if (!new_owner_id) return res.status(400).json({ error: 'new_owner_id erforderlich' })
    if (new_owner_id === req.user.id) return res.status(400).json({ error: 'Du bist bereits Owner' })

    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.id, new_owner_id]
    )
    if (!member.length) return res.status(400).json({ error: 'Neuer Owner muss Server-Mitglied sein' })

    await pool.execute('UPDATE servers SET owner_id = ? WHERE id = ?', [new_owner_id, req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error('Transfer ownership error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/:id/members/:userId/roles', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.MANAGE_ROLES)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const { role_id, add } = req.body
    if (!role_id || typeof add !== 'boolean') return res.status(400).json({ error: 'role_id und add erforderlich' })

    const [role] = await pool.execute(
      'SELECT id FROM server_roles WHERE server_id = ? AND id = ?',
      [req.params.id, role_id]
    )
    if (!role.length) return res.status(404).json({ error: 'Rolle nicht gefunden' })

    if (add) {
      await pool.execute(
        'INSERT IGNORE INTO server_member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)',
        [req.params.id, req.params.userId, role_id]
      )
    } else {
      await pool.execute(
        'DELETE FROM server_member_roles WHERE server_id = ? AND user_id = ? AND role_id = ?',
        [req.params.id, req.params.userId, role_id]
      )
    }
    res.status(204).send()
  } catch (err) {
    console.error('Role toggle error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/:id/roles', async (req, res) => {
  try {
    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    const [rows] = await pool.execute(
      'SELECT id, server_id, name, color, position, permissions, created_at FROM server_roles WHERE server_id = ? ORDER BY position DESC',
      [req.params.id]
    )
    const roles = rows.map((r) => ({
      ...r,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    }))
    res.json(roles)
  } catch (err) {
    console.error('Roles error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/:id/roles', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.MANAGE_ROLES)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const { name, color, position } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name erforderlich' })

    const [maxPos] = await pool.execute(
      'SELECT COALESCE(MAX(position), 0) as m FROM server_roles WHERE server_id = ?',
      [req.params.id]
    )
    const defaultRolePerms =
      PERMISSIONS.VIEW_CHANNEL | PERMISSIONS.SEND_MESSAGES | PERMISSIONS.READ_MESSAGE_HISTORY |
      PERMISSIONS.ADD_REACTIONS | PERMISSIONS.CONNECT | PERMISSIONS.SPEAK |
      PERMISSIONS.ATTACH_FILES | PERMISSIONS.EMBED_LINKS
    const pos = position ?? (maxPos[0]?.m ?? 0) + 1
    const roleId = uuidv4()
    await pool.execute(
      'INSERT INTO server_roles (id, server_id, name, color, position, permissions) VALUES (?, ?, ?, ?, ?, ?)',
      [roleId, req.params.id, name.trim(), color || '#99aab5', pos, defaultRolePerms]
    )
    const [rows] = await pool.execute(
      'SELECT id, server_id, name, color, position, permissions, created_at FROM server_roles WHERE id = ?',
      [roleId]
    )
    const r = rows[0]
    if (r?.created_at) r.created_at = r.created_at.toISOString?.() ?? r.created_at
    res.status(201).json(r)
  } catch (err) {
    console.error('Create role error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/:id/roles/:roleId', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.MANAGE_ROLES)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const [role] = await pool.execute(
      'SELECT id FROM server_roles WHERE server_id = ? AND id = ?',
      [req.params.id, req.params.roleId]
    )
    if (!role.length) return res.status(404).json({ error: 'Rolle nicht gefunden' })

    const { name, color, position, permissions } = req.body
    const updates = []
    const values = []
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (color !== undefined) { updates.push('color = ?'); values.push(color) }
    if (position !== undefined) { updates.push('position = ?'); values.push(position) }
    if (permissions !== undefined) { updates.push('permissions = ?'); values.push(permissions) }
    if (!updates.length) return res.status(400).json({ error: 'Keine Änderungen' })

    values.push(req.params.roleId)
    await pool.execute(`UPDATE server_roles SET ${updates.join(', ')} WHERE id = ?`, values)
    const [rows] = await pool.execute(
      'SELECT id, server_id, name, color, position, permissions, created_at FROM server_roles WHERE id = ?',
      [req.params.roleId]
    )
    const r = rows[0]
    if (r?.created_at) r.created_at = r.created_at.toISOString?.() ?? r.created_at
    res.json(r)
  } catch (err) {
    console.error('Update role error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.delete('/:id/roles/:roleId', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.MANAGE_ROLES)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const [role] = await pool.execute(
      'SELECT name FROM server_roles WHERE server_id = ? AND id = ?',
      [req.params.id, req.params.roleId]
    )
    if (!role.length) return res.status(404).json({ error: 'Rolle nicht gefunden' })
    if (role[0].name === 'Admin' || role[0].name === 'Member') {
      return res.status(400).json({ error: 'Admin- und Member-Rollen können nicht gelöscht werden' })
    }

    await pool.execute('DELETE FROM server_roles WHERE id = ?', [req.params.roleId])
    res.status(204).send()
  } catch (err) {
    console.error('Delete role error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/:id/permissions', async (req, res) => {
  try {
    const [srv] = await pool.execute('SELECT owner_id FROM servers WHERE id = ?', [req.params.id])
    const isOwner = srv.length && srv[0].owner_id === req.user.id
    const perms = await getEffectivePermissions(pool, req.params.id, req.user.id)
    const isAdmin = hasPermission(perms, PERMISSIONS.ADMINISTRATOR)
    res.json({ isAdmin: !!isAdmin, isOwner: !!isOwner, permissions: perms })
  } catch (err) {
    res.json({ isAdmin: false, isOwner: false, permissions: 0 })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, icon_url, description, banner_color, created_at FROM servers WHERE id = ?',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Server nicht gefunden' })

    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    const s = rows[0]
    if (s.created_at) s.created_at = s.created_at.toISOString?.() ?? s.created_at
    res.json(s)
  } catch (err) {
    console.error('Get server error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.MANAGE_SERVER)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const { name, icon_url, description, banner_color } = req.body
    const updates = []
    const values = []
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (icon_url !== undefined) { updates.push('icon_url = ?'); values.push(icon_url) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (banner_color !== undefined) { updates.push('banner_color = ?'); values.push(banner_color) }
    if (!updates.length) return res.status(400).json({ error: 'Keine Änderungen' })

    values.push(req.params.id)
    await pool.execute(
      `UPDATE servers SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    const [rows] = await pool.execute(
      'SELECT id, name, icon_url, description, banner_color, created_at FROM servers WHERE id = ?',
      [req.params.id]
    )
    const s = rows[0]
    if (s?.created_at) s.created_at = s.created_at.toISOString?.() ?? s.created_at
    res.json(s)
  } catch (err) {
    console.error('Update server error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/:id/bans', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.BAN_MEMBERS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const [rows] = await pool.execute(
      `SELECT sb.user_id, sb.banned_by, sb.created_at, p.username, p.avatar_url
       FROM server_bans sb
       LEFT JOIN profiles p ON p.id = sb.user_id
       WHERE sb.server_id = ?
       ORDER BY sb.created_at DESC`,
      [req.params.id]
    )
    res.json(rows.map((r) => ({
      user_id: r.user_id,
      banned_by: r.banned_by,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
      username: r.username ?? 'Unbekannt',
      avatar_url: r.avatar_url,
    })))
  } catch (err) {
    console.error('Bans list error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.delete('/:id/bans/:userId', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.BAN_MEMBERS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })
    await pool.execute(
      'DELETE FROM server_bans WHERE server_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    )
    res.status(204).send()
  } catch (err) {
    console.error('Unban error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/:id/audit-log', async (req, res) => {
  try {
    const ok = await checkPerm(req.params.id, req.user.id, PERMISSIONS.VIEW_AUDIT_LOG)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const [rows] = await pool.execute(
      `SELECT id, server_id, user_id, action, target_type, target_id, details, created_at
       FROM audit_log WHERE server_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    )
    const log = rows.map((r) => ({
      ...r,
      details: r.details ? (typeof r.details === 'string' ? JSON.parse(r.details) : r.details) : {},
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    }))
    res.json(log)
  } catch (err) {
    console.error('Audit log error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const [srv] = await pool.execute('SELECT owner_id FROM servers WHERE id = ?', [req.params.id])
    if (!srv.length || srv[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Nur der Server-Owner kann den Server löschen' })
    }

    await pool.execute('DELETE FROM servers WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error('Delete server error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/join', async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ error: 'Code erforderlich' })

    const [invites] = await pool.execute(
      'SELECT server_id, expires_at, max_uses, uses FROM server_invites WHERE code = ?',
      [code]
    )
    if (!invites.length) return res.status(404).json({ error: 'Einladung ungültig' })

    const inv = invites[0]
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Einladung abgelaufen' })
    }
    if (inv.max_uses != null && (inv.uses ?? 0) >= inv.max_uses) {
      return res.status(410).json({ error: 'Einladung ausgeschöpft' })
    }

    const serverId = inv.server_id
    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [serverId, req.user.id]
    )
    if (member.length) return res.status(400).json({ error: 'Bereits Mitglied' })

    const [memberRole] = await pool.execute(
      "SELECT id FROM server_roles WHERE server_id = ? AND name = 'Member'",
      [serverId]
    )
    await pool.execute(
      'INSERT INTO server_members (server_id, user_id) VALUES (?, ?)',
      [serverId, req.user.id]
    )
    if (memberRole.length) {
      await pool.execute(
        'INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)',
        [serverId, req.user.id, memberRole[0].id]
      )
    }
    await pool.execute(
      'UPDATE server_invites SET uses = uses + 1 WHERE code = ?',
      [code]
    )

    const [server] = await pool.execute(
      'SELECT id, name, icon_url, description, banner_color, created_at FROM servers WHERE id = ?',
      [serverId]
    )
    const s = server[0]
    if (s?.created_at) s.created_at = s.created_at.toISOString?.() ?? s.created_at
    res.status(201).json(s)
  } catch (err) {
    console.error('Join server error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
