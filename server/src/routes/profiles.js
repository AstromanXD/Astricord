import { Router } from 'express'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function toProfile(row) {
  const p = { ...row }
  if (p.created_at) p.created_at = p.created_at.toISOString?.() ?? p.created_at
  return p
}

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query
    if (!q || String(q).trim().length < 2) return res.json([])
    const search = `%${String(q).trim()}%`
    const [rows] = await pool.execute(
      'SELECT id, username, avatar_url, theme, status, status_message, custom_status, created_at FROM profiles WHERE username LIKE ? LIMIT 20',
      [search]
    )
    res.json(rows.map(toProfile))
  } catch (err) {
    console.error('Profile search error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, avatar_url, theme, status, status_message, custom_status, created_at FROM profiles WHERE id = ?',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Profil nicht gefunden' })
    res.json(toProfile(rows[0]))
  } catch (err) {
    console.error('Get profile error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids erforderlich' })
    const placeholders = ids.map(() => '?').join(',')
    const [rows] = await pool.execute(
      `SELECT id, username, avatar_url, theme, status, status_message, custom_status, created_at FROM profiles WHERE id IN (${placeholders})`,
      ids
    )
    const map = {}
    rows.forEach((r) => { map[r.id] = toProfile(r) })
    res.json(map)
  } catch (err) {
    console.error('Batch profiles error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const { username, avatar_url, theme, status, status_message, custom_status } = req.body
    const updates = []
    const values = []
    if (username !== undefined) { updates.push('username = ?'); values.push(username) }
    if (avatar_url !== undefined) { updates.push('avatar_url = ?'); values.push(avatar_url) }
    if (theme !== undefined) { updates.push('theme = ?'); values.push(theme) }
    if (status !== undefined) { updates.push('status = ?'); values.push(status) }
    if (status_message !== undefined) { updates.push('status_message = ?'); values.push(status_message) }
    if (custom_status !== undefined) { updates.push('custom_status = ?'); values.push(custom_status) }
    if (!updates.length) return res.status(400).json({ error: 'Keine Änderungen' })
    values.push(req.user.id)
    await pool.execute(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`, values)
    const [rows] = await pool.execute(
      'SELECT id, username, avatar_url, theme, status, status_message, custom_status, created_at FROM profiles WHERE id = ?',
      [req.user.id]
    )
    res.json(toProfile(rows[0]))
  } catch (err) {
    console.error('Update profile error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
