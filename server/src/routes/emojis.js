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

// GET /emojis?serverId=xxx
router.get('/', async (req, res) => {
  try {
    const { serverId } = req.query
    if (!serverId) return res.status(400).json({ error: 'serverId erforderlich' })

    const [member] = await pool.execute(
      'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
      [serverId, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    const [rows] = await pool.execute(
      'SELECT id, server_id, name, image_url, created_at FROM server_emojis WHERE server_id = ? ORDER BY name',
      [serverId]
    )
    res.json(rows.map((r) => ({ ...r, created_at: r.created_at?.toISOString?.() ?? r.created_at })))
  } catch (err) {
    console.error('Emojis error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// POST /emojis
router.post('/', async (req, res) => {
  try {
    const { server_id, name, image_url } = req.body
    if (!server_id || !name || !image_url) return res.status(400).json({ error: 'server_id, name und image_url erforderlich' })

    const ok = await checkPerm(server_id, req.user.id, PERMISSIONS.CREATE_EXPRESSIONS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const id = uuidv4()
    await pool.execute(
      'INSERT INTO server_emojis (id, server_id, name, image_url) VALUES (?, ?, ?, ?)',
      [id, server_id, name, image_url]
    )
    const [rows] = await pool.execute(
      'SELECT id, server_id, name, image_url, created_at FROM server_emojis WHERE id = ?',
      [id]
    )
    const r = rows[0]
    if (r?.created_at) r.created_at = r.created_at.toISOString?.() ?? r.created_at
    res.status(201).json(r)
  } catch (err) {
    console.error('Create emoji error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// DELETE /emojis/:id
router.delete('/:id', async (req, res) => {
  try {
    const [em] = await pool.execute('SELECT server_id FROM server_emojis WHERE id = ?', [req.params.id])
    if (!em.length) return res.status(404).json({ error: 'Emoji nicht gefunden' })

    const ok = await checkPerm(em[0].server_id, req.user.id, PERMISSIONS.MANAGE_EXPRESSIONS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    await pool.execute('DELETE FROM server_emojis WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error('Delete emoji error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
