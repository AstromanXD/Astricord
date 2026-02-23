import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

async function isAdmin(serverId, userId) {
  const [rows] = await pool.execute(
    `SELECT 1 FROM server_members sm
     JOIN server_member_roles smr ON sm.server_id = smr.server_id AND sm.user_id = smr.user_id
     JOIN server_roles sr ON smr.role_id = sr.id
     WHERE sm.server_id = ? AND sm.user_id = ? AND sr.name = 'Admin'`,
    [serverId, userId]
  )
  return rows.length > 0
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
      'INSERT INTO servers (id, name, icon_url, description, banner_color) VALUES (?, ?, ?, ?, ?)',
      [serverId, name || 'Neuer Server', icon_url || null, description || null, banner_color || '#4f545c']
    )
    await pool.execute(
      'INSERT INTO server_roles (id, server_id, name, color, position) VALUES (?, ?, ?, ?, ?)',
      [adminRoleId, serverId, 'Admin', '#5865f2', 100]
    )
    await pool.execute(
      'INSERT INTO server_roles (id, server_id, name, color, position) VALUES (?, ?, ?, ?, ?)',
      [memberRoleId, serverId, 'Member', '#57f287', 0]
    )
    await pool.execute(
      'INSERT INTO server_members (server_id, user_id) VALUES (?, ?)',
      [serverId, req.user.id]
    )
    await pool.execute(
      'INSERT INTO server_member_roles (server_id, user_id, role_id) VALUES (?, ?, ?)',
      [serverId, req.user.id, adminRoleId]
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

    const [[roles], [members], [memberRoles], [profiles]] = await Promise.all([
      pool.execute(
        'SELECT id, server_id, name, color, position FROM server_roles WHERE server_id = ? ORDER BY position DESC',
        [req.params.id]
      ),
      pool.execute('SELECT user_id FROM server_members WHERE server_id = ?', [req.params.id]),
      pool.execute(
        'SELECT user_id, role_id FROM server_member_roles WHERE server_id = ?',
        [req.params.id]
      ),
      pool.execute(
        `SELECT p.id, p.username, p.avatar_url, p.theme, p.created_at FROM profiles p
         WHERE p.id IN (SELECT user_id FROM server_members WHERE server_id = ?)`,
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

    const result = {
      roles: roles.map((r) => ({ ...r, created_at: r.created_at?.toISOString?.() ?? r.created_at })),
      members: members.map((m) => ({
        userId: m.user_id,
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
    const admin = await isAdmin(req.params.id, req.user.id)
    if (!admin) return res.status(403).json({ error: 'Keine Berechtigung' })
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Kann sich nicht selbst kicken' })

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
    const admin = await isAdmin(req.params.id, req.user.id)
    if (!admin) return res.status(403).json({ error: 'Keine Berechtigung' })
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'Kann sich nicht selbst bannen' })

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

router.patch('/:id/members/:userId/roles', async (req, res) => {
  try {
    const admin = await isAdmin(req.params.id, req.user.id)
    if (!admin) return res.status(403).json({ error: 'Keine Berechtigung' })

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

router.get('/:id/permissions', async (req, res) => {
  try {
    const admin = await isAdmin(req.params.id, req.user.id)
    res.json({ isAdmin: !!admin })
  } catch (err) {
    res.json({ isAdmin: false })
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
    const admin = await isAdmin(req.params.id, req.user.id)
    if (!admin) return res.status(403).json({ error: 'Keine Berechtigung' })

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

router.delete('/:id', async (req, res) => {
  try {
    const admin = await isAdmin(req.params.id, req.user.id)
    if (!admin) return res.status(403).json({ error: 'Keine Berechtigung' })

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
      'SELECT server_id FROM server_invites WHERE code = ?',
      [code]
    )
    if (!invites.length) return res.status(404).json({ error: 'Einladung ungültig' })

    const serverId = invites[0].server_id
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
