import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { PERMISSIONS, hasPermission, getEffectivePermissions, getChannelPermissions } from '../lib/permissions.js'

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

// GET /categories?serverId=xxx
router.get('/categories', async (req, res) => {
  try {
    const { serverId } = req.query
    if (!serverId) return res.status(400).json({ error: 'serverId erforderlich' })

    const member = await isMember(serverId, req.user.id)
    if (!member) return res.status(403).json({ error: 'Kein Zugriff' })

    const [rows] = await pool.execute(
      'SELECT id, server_id, name, position, created_at FROM channel_categories WHERE server_id = ? ORDER BY position, created_at',
      [serverId]
    )
    res.json(rows.map((r) => ({
      ...r,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    })))
  } catch (err) {
    console.error('Categories list error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// POST /categories
router.post('/categories', async (req, res) => {
  try {
    const { server_id, name, position } = req.body
    if (!server_id || !name?.trim()) return res.status(400).json({ error: 'server_id und name erforderlich' })

    const ok = await checkPerm(server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const [maxPos] = await pool.execute(
      'SELECT COALESCE(MAX(position), 0) as m FROM channel_categories WHERE server_id = ?',
      [server_id]
    )
    const id = uuidv4()
    const pos = position ?? (maxPos[0]?.m ?? 0) + 1
    await pool.execute(
      'INSERT INTO channel_categories (id, server_id, name, position) VALUES (?, ?, ?, ?)',
      [id, server_id, name.trim(), pos]
    )
    const [rows] = await pool.execute(
      'SELECT id, server_id, name, position, created_at FROM channel_categories WHERE id = ?',
      [id]
    )
    const c = rows[0]
    if (c?.created_at) c.created_at = c.created_at.toISOString?.() ?? c.created_at
    res.status(201).json(c)
  } catch (err) {
    console.error('Create category error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// PATCH /categories/:id
router.patch('/categories/:id', async (req, res) => {
  try {
    const [cat] = await pool.execute('SELECT server_id FROM channel_categories WHERE id = ?', [req.params.id])
    if (!cat.length) return res.status(404).json({ error: 'Kategorie nicht gefunden' })

    const ok = await checkPerm(cat[0].server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const { name, position } = req.body
    const updates = []
    const values = []
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (position !== undefined) { updates.push('position = ?'); values.push(position) }
    if (!updates.length) return res.status(400).json({ error: 'Keine Änderungen' })
    values.push(req.params.id)
    await pool.execute(`UPDATE channel_categories SET ${updates.join(', ')} WHERE id = ?`, values)

    const [rows] = await pool.execute(
      'SELECT id, server_id, name, position, created_at FROM channel_categories WHERE id = ?',
      [req.params.id]
    )
    const c = rows[0]
    if (c?.created_at) c.created_at = c.created_at.toISOString?.() ?? c.created_at
    res.json(c)
  } catch (err) {
    console.error('Update category error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// DELETE /categories/:id
router.delete('/categories/:id', async (req, res) => {
  try {
    const [cat] = await pool.execute('SELECT server_id FROM channel_categories WHERE id = ?', [req.params.id])
    if (!cat.length) return res.status(404).json({ error: 'Kategorie nicht gefunden' })

    const ok = await checkPerm(cat[0].server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    await pool.execute('UPDATE channels SET category_id = NULL WHERE category_id = ?', [req.params.id])
    await pool.execute('DELETE FROM channel_categories WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err) {
    console.error('Delete category error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

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
      `SELECT id, server_id, category_id, name, type, position, slow_mode_seconds, created_at
       FROM channels WHERE server_id = ?
       ORDER BY position, created_at`,
      [serverId]
    )

    const visible = []
    for (const r of rows) {
      const chanPerms = await getChannelPermissions(pool, r.id, req.user.id)
      if (hasPermission(chanPerms, PERMISSIONS.VIEW_CHANNEL)) visible.push(r)
    }

    const channels = visible.map((r) => ({
      ...r,
      slow_mode_seconds: r.slow_mode_seconds ?? 0,
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

    const { name, type, category_id, position, slow_mode_seconds } = req.body
    const updates = []
    const values = []
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (type !== undefined) { updates.push('type = ?'); values.push(type) }
    if (category_id !== undefined) { updates.push('category_id = ?'); values.push(category_id) }
    if (position !== undefined) { updates.push('position = ?'); values.push(position) }
    if (slow_mode_seconds !== undefined) { updates.push('slow_mode_seconds = ?'); values.push(Math.max(0, parseInt(slow_mode_seconds, 10) || 0)) }
    if (!updates.length) return res.status(400).json({ error: 'Keine Änderungen' })

    values.push(req.params.id)
    await pool.execute(`UPDATE channels SET ${updates.join(', ')} WHERE id = ?`, values)

    const [rows] = await pool.execute(
      'SELECT id, server_id, category_id, name, type, position, slow_mode_seconds, created_at FROM channels WHERE id = ?',
      [req.params.id]
    )
    const c = rows[0]
    if (c?.created_at) c.created_at = c.created_at.toISOString?.() ?? c.created_at
    c.slow_mode_seconds = c.slow_mode_seconds ?? 0
    res.json(c)
  } catch (err) {
    console.error('Update channel error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// GET /channels/:id/overwrites
router.get('/:id/overwrites', async (req, res) => {
  try {
    const [ch] = await pool.execute('SELECT server_id FROM channels WHERE id = ?', [req.params.id])
    if (!ch.length) return res.status(404).json({ error: 'Kanal nicht gefunden' })
    const ok = await checkPerm(ch[0].server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const [rows] = await pool.execute(
      'SELECT id, channel_id, role_id, user_id, allow, deny, created_at FROM channel_permission_overwrites WHERE channel_id = ?',
      [req.params.id]
    )
    res.json(rows.map((r) => ({ ...r, created_at: r.created_at?.toISOString?.() ?? r.created_at })))
  } catch (err) {
    console.error('Overwrites list error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// POST /channels/:id/overwrites
router.post('/:id/overwrites', async (req, res) => {
  try {
    const [ch] = await pool.execute('SELECT server_id FROM channels WHERE id = ?', [req.params.id])
    if (!ch.length) return res.status(404).json({ error: 'Kanal nicht gefunden' })
    const ok = await checkPerm(ch[0].server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const { role_id, user_id } = req.body
    if ((!role_id && !user_id) || (role_id && user_id)) {
      return res.status(400).json({ error: 'Genau role_id oder user_id erforderlich' })
    }
    const id = uuidv4()
    await pool.execute(
      'INSERT INTO channel_permission_overwrites (id, channel_id, role_id, user_id, allow, deny) VALUES (?, ?, ?, ?, 0, 0)',
      [id, req.params.id, role_id || null, user_id || null]
    )
    const [rows] = await pool.execute(
      'SELECT id, channel_id, role_id, user_id, allow, deny, created_at FROM channel_permission_overwrites WHERE id = ?',
      [id]
    )
    const r = rows[0]
    if (r?.created_at) r.created_at = r.created_at.toISOString?.() ?? r.created_at
    res.status(201).json(r)
  } catch (err) {
    console.error('Overwrite create error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// PATCH /channels/:id/overwrites/:overwriteId
router.patch('/:id/overwrites/:overwriteId', async (req, res) => {
  try {
    const [ch] = await pool.execute('SELECT server_id FROM channels WHERE id = ?', [req.params.id])
    if (!ch.length) return res.status(404).json({ error: 'Kanal nicht gefunden' })
    const ok = await checkPerm(ch[0].server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })

    const { allow, deny } = req.body
    const updates = []
    const values = []
    if (allow !== undefined) { updates.push('allow = ?'); values.push(allow) }
    if (deny !== undefined) { updates.push('deny = ?'); values.push(deny) }
    if (!updates.length) return res.status(400).json({ error: 'Keine Änderungen' })
    values.push(req.params.overwriteId, req.params.id)
    await pool.execute(
      `UPDATE channel_permission_overwrites SET ${updates.join(', ')} WHERE id = ? AND channel_id = ?`,
      values
    )
    const [rows] = await pool.execute(
      'SELECT id, channel_id, role_id, user_id, allow, deny, created_at FROM channel_permission_overwrites WHERE id = ?',
      [req.params.overwriteId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Overwrite nicht gefunden' })
    const r = rows[0]
    if (r?.created_at) r.created_at = r.created_at.toISOString?.() ?? r.created_at
    res.json(r)
  } catch (err) {
    console.error('Overwrite update error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// DELETE /channels/:id/overwrites/:overwriteId
router.delete('/:id/overwrites/:overwriteId', async (req, res) => {
  try {
    const [ch] = await pool.execute('SELECT server_id FROM channels WHERE id = ?', [req.params.id])
    if (!ch.length) return res.status(404).json({ error: 'Kanal nicht gefunden' })
    const ok = await checkPerm(ch[0].server_id, req.user.id, PERMISSIONS.MANAGE_CHANNELS)
    if (!ok) return res.status(403).json({ error: 'Keine Berechtigung' })
    await pool.execute(
      'DELETE FROM channel_permission_overwrites WHERE id = ? AND channel_id = ?',
      [req.params.overwriteId, req.params.id]
    )
    res.status(204).send()
  } catch (err) {
    console.error('Overwrite delete error:', err)
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
