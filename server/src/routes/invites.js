import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { PERMISSIONS, hasPermission, getEffectivePermissions } from '../lib/permissions.js'

const router = Router()
router.use(authMiddleware)

function randomCode() {
  return Math.random().toString(36).slice(2, 10)
}

async function checkPerm(serverId, userId, flag) {
  const perms = await getEffectivePermissions(pool, serverId, userId)
  return hasPermission(perms, flag)
}

router.post('/', async (req, res) => {
  try {
    const { server_id, expires_at, max_uses } = req.body
    if (!server_id) return res.status(400).json({ error: 'server_id erforderlich' })

    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [server_id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    const ok = await checkPerm(server_id, req.user.id, PERMISSIONS.CREATE_INVITE)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung zum Erstellen von Einladungen' })

    const id = uuidv4()
    let code = randomCode()
    let exists = true
    while (exists) {
      const [c] = await pool.execute('SELECT 1 FROM server_invites WHERE code = ?', [code])
      exists = c.length > 0
      if (exists) code = randomCode()
    }

    const expAt = expires_at ? new Date(expires_at) : null
    const maxUses = max_uses != null ? Math.max(0, parseInt(max_uses, 10) || 0) : null

    await pool.execute(
      'INSERT INTO server_invites (id, server_id, code, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?, ?)',
      [id, server_id, code, req.user.id, expAt, maxUses]
    )

    const [rows] = await pool.execute(
      'SELECT id, server_id, code, created_by, created_at, expires_at, max_uses, uses FROM server_invites WHERE id = ?',
      [id]
    )
    const inv = rows[0]
    if (inv?.created_at) inv.created_at = inv.created_at.toISOString?.() ?? inv.created_at
    res.status(201).json(inv)
  } catch (err) {
    console.error('Create invite error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/', async (req, res) => {
  try {
    const { server_id } = req.query
    if (!server_id) return res.status(400).json({ error: 'server_id erforderlich' })

    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [server_id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    const canManage = await checkPerm(server_id, req.user.id, PERMISSIONS.MANAGE_SERVER)
    const canInvite = await checkPerm(server_id, req.user.id, PERMISSIONS.CREATE_INVITE)
    if (!canManage && !canInvite) return res.status(403).json({ error: 'Keine Berechtigung' })

    const [rows] = await pool.execute(
      'SELECT id, server_id, code, created_by, created_at, expires_at, max_uses, uses FROM server_invites WHERE server_id = ? ORDER BY created_at DESC LIMIT 50',
      [server_id]
    )
    const invites = rows.map((r) => ({
      ...r,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
      expires_at: r.expires_at?.toISOString?.() ?? r.expires_at,
    }))
    res.json(invites)
  } catch (err) {
    console.error('List invites error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const [inv] = await pool.execute(
      'SELECT server_id, created_by FROM server_invites WHERE id = ?',
      [req.params.id]
    )
    if (!inv.length) return res.status(404).json({ error: 'Einladung nicht gefunden' })

    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [inv[0].server_id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    const canManage = await checkPerm(inv[0].server_id, req.user.id, PERMISSIONS.MANAGE_SERVER)
    const isCreator = inv[0].created_by === req.user.id
    if (!canManage && !isCreator) return res.status(403).json({ error: 'Keine Berechtigung' })

    await pool.execute('DELETE FROM server_invites WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error('Delete invite error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/code/:code', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT si.server_id, s.name FROM server_invites si JOIN servers s ON s.id = si.server_id WHERE si.code = ?',
      [req.params.code]
    )
    if (!rows.length) return res.status(404).json({ error: 'Einladung ungültig' })
    res.json(rows[0])
  } catch (err) {
    console.error('Get invite error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
