import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { PERMISSIONS, hasPermission, getEffectivePermissions } from '../lib/permissions.js'

const router = Router()
router.use(authMiddleware)

async function isMember(serverId, userId) {
  const [rows] = await pool.execute(
    'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
    [serverId, userId]
  )
  return rows.length > 0
}

async function checkPerm(serverId, userId, flag) {
  const perms = await getEffectivePermissions(pool, serverId, userId)
  return hasPermission(perms, flag)
}

// GET /channels?serverId=xxx
router.get('/', async (req, res) => {
  try {
    const { serverId } = req.query
    if (!serverId) return res.status(400).json({ error: 'serverId erforderlich' })

    const member = await isMember(serverId, req.user.id)
    if (!member) return res.status(403).json({ error: 'Kein Zugriff' })

    const canView = await checkPerm(serverId, req.user.id, PERMISSIONS.VIEW_CHANNEL)
    if (!canView) return res.json([])

    const [rows] = await pool.execute(
      `SELECT id, server_id, category_id, name, type, position, created_at
       FROM channels WHERE server_id = ?
       ORDER BY position, created_at`,
      [serverId]
    )

    const channels = rows.map((r) => ({
      ...r,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    }))
    res.json(channels)
  } catch (err) {
    console.error('Channels list error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// POST /channels
router.post('/', async (req, res) => {
  try {
    const { server_id, name, type, category_id, position } = req.body
    if (!server_id || !name) return res.status(400).json({ error: 'server_id und name erforderlich' })

    const ok = await checkPerm(server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const id = uuidv4()
    await pool.execute(
      'INSERT INTO channels (id, server_id, category_id, name, type, position) VALUES (?, ?, ?, ?, ?, ?)',
      [id, server_id, category_id || null, name, type || 'text', position ?? 0]
    )

    const [rows] = await pool.execute(
      'SELECT id, server_id, category_id, name, type, position, created_at FROM channels WHERE id = ?',
      [id]
    )
    const c = rows[0]
    if (c?.created_at) c.created_at = c.created_at.toISOString?.() ?? c.created_at
    res.status(201).json(c)
  } catch (err) {
    console.error('Create channel error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// PATCH /channels/:id
router.patch('/:id', async (req, res) => {
  try {
    const [ch] = await pool.execute('SELECT server_id FROM channels WHERE id = ?', [req.params.id])
    if (!ch.length) return res.status(404).json({ error: 'Kanal nicht gefunden' })

    const ok = await checkPerm(ch[0].server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const { name, type, category_id, position } = req.body
    const updates = []
    const values = []
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (type !== undefined) { updates.push('type = ?'); values.push(type) }
    if (category_id !== undefined) { updates.push('category_id = ?'); values.push(category_id) }
    if (position !== undefined) { updates.push('position = ?'); values.push(position) }
    if (!updates.length) return res.status(400).json({ error: 'Keine Änderungen' })

    values.push(req.params.id)
    await pool.execute(`UPDATE channels SET ${updates.join(', ')} WHERE id = ?`, values)

    const [rows] = await pool.execute(
      'SELECT id, server_id, category_id, name, type, position, created_at FROM channels WHERE id = ?',
      [req.params.id]
    )
    const c = rows[0]
    if (c?.created_at) c.created_at = c.created_at.toISOString?.() ?? c.created_at
    res.json(c)
  } catch (err) {
    console.error('Update channel error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// DELETE /channels/:id
router.delete('/:id', async (req, res) => {
  try {
    const [ch] = await pool.execute('SELECT server_id FROM channels WHERE id = ?', [req.params.id])
    if (!ch.length) return res.status(404).json({ error: 'Kanal nicht gefunden' })

    const ok = await checkPerm(ch[0].server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    await pool.execute('DELETE FROM channels WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error('Delete channel error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
