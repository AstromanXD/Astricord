import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.post('/conversation', async (req, res) => {
  try {
    const { other_user_id } = req.body
    if (!other_user_id) return res.status(400).json({ error: 'other_user_id erforderlich' })
    if (other_user_id === req.user.id) return res.status(400).json({ error: 'Keine DM mit dir selbst' })

    const [friends] = await pool.execute(
      `SELECT 1 FROM friend_requests WHERE status = 'accepted'
       AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))`,
      [req.user.id, other_user_id, other_user_id, req.user.id]
    )
    if (!friends.length) return res.status(403).json({ error: 'Nur mit Freunden möglich' })

    const [existing] = await pool.execute(
      `SELECT dc.id FROM dm_conversations dc
       JOIN dm_participants dp1 ON dp1.conversation_id = dc.id AND dp1.user_id = ?
       JOIN dm_participants dp2 ON dp2.conversation_id = dc.id AND dp2.user_id = ?`,
      [req.user.id, other_user_id]
    )
    if (existing.length) {
      return res.json({ id: existing[0].id, created: false })
    }

    const convId = uuidv4()
    await pool.execute('INSERT INTO dm_conversations (id) VALUES (?)', [convId])
    await pool.execute(
      'INSERT INTO dm_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)',
      [convId, req.user.id, convId, other_user_id]
    )
    res.status(201).json({ id: convId, created: true })
  } catch (err) {
    console.error('Create DM error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/conversations', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT dc.id as conversation_id, dp.user_id as other_user_id
       FROM dm_conversations dc
       JOIN dm_participants dp ON dp.conversation_id = dc.id AND dp.user_id != ?
       WHERE dc.id IN (SELECT conversation_id FROM dm_participants WHERE user_id = ?)`,
      [req.user.id, req.user.id]
    )
    const ids = rows.map((r) => r.other_user_id)
    if (!ids.length) return res.json([])
    const ph = ids.map(() => '?').join(',')
    const [profiles] = await pool.execute(
      `SELECT id, username, avatar_url, theme, status, status_message, custom_status, created_at FROM profiles WHERE id IN (${ph})`,
      ids
    )
    const byId = {}
    profiles.forEach((p) => {
      byId[p.id] = { ...p, created_at: p.created_at?.toISOString?.() ?? p.created_at }
    })
    const result = rows.map((r) => ({
      conversationId: r.conversation_id,
      otherUser: byId[r.other_user_id] ?? null,
    }))
    res.json(result)
  } catch (err) {
    console.error('DM conversations error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
