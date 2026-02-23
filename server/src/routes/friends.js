import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at, p.username, p.avatar_url
       FROM friend_requests fr
       JOIN profiles p ON p.id = IF(fr.from_user_id = ?, fr.to_user_id, fr.from_user_id)
       WHERE (fr.from_user_id = ? OR fr.to_user_id = ?) AND fr.status IN ('pending', 'accepted')`,
      [req.user.id, req.user.id, req.user.id]
    )
    const friends = rows.map((r) => ({
      id: r.id,
      userId: r.from_user_id === req.user.id ? r.to_user_id : r.from_user_id,
      username: r.username,
      avatarUrl: r.avatar_url,
      status: r.status,
      isIncoming: r.to_user_id === req.user.id,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    }))
    res.json(friends)
  } catch (err) {
    console.error('Friends list error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/request', async (req, res) => {
  try {
    const { to_user_id } = req.body
    if (!to_user_id) return res.status(400).json({ error: 'to_user_id erforderlich' })
    if (to_user_id === req.user.id) return res.status(400).json({ error: 'Keine Selbst-Anfrage' })
    const [existing] = await pool.execute(
      'SELECT id, status FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)',
      [req.user.id, to_user_id, to_user_id, req.user.id]
    )
    if (existing.length) {
      if (existing[0].status === 'accepted') return res.status(400).json({ error: 'Bereits befreundet' })
      if (existing[0].status === 'blocked') return res.status(400).json({ error: 'Blockiert' })
      return res.status(400).json({ error: 'Anfrage bereits vorhanden' })
    }
    const id = uuidv4()
    await pool.execute(
      'INSERT INTO friend_requests (id, from_user_id, to_user_id, status) VALUES (?, ?, ?, ?)',
      [id, req.user.id, to_user_id, 'pending']
    )
    res.status(201).json({ id, from_user_id: req.user.id, to_user_id, status: 'pending' })
  } catch (err) {
    console.error('Friend request error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body
    if (!['accepted', 'blocked'].includes(status)) return res.status(400).json({ error: 'Ungültiger Status' })
    const [fr] = await pool.execute('SELECT id, to_user_id FROM friend_requests WHERE id = ?', [req.params.id])
    if (!fr.length) return res.status(404).json({ error: 'Anfrage nicht gefunden' })
    if (fr[0].to_user_id !== req.user.id) return res.status(403).json({ error: 'Keine Berechtigung' })
    await pool.execute('UPDATE friend_requests SET status = ? WHERE id = ?', [status, req.params.id])
    res.json({ id: req.params.id, status })
  } catch (err) {
    console.error('Update friend error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
