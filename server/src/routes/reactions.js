import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// GET /reactions?messageIds=id1,id2,id3
router.get('/', async (req, res) => {
  try {
    const { messageIds } = req.query
    if (!messageIds) return res.json({})

    const ids = (typeof messageIds === 'string' ? messageIds.split(',') : messageIds).filter(Boolean)
    if (!ids.length) return res.json({})

    const placeholders = ids.map(() => '?').join(',')
    const [rows] = await pool.execute(
      `SELECT id, message_id, user_id, emoji, created_at FROM message_reactions WHERE message_id IN (${placeholders})`,
      ids
    )

    const byMessage = {}
    rows.forEach((r) => {
      if (!byMessage[r.message_id]) byMessage[r.message_id] = []
      byMessage[r.message_id].push({
        id: r.id,
        message_id: r.message_id,
        user_id: r.user_id,
        emoji: r.emoji,
        created_at: r.created_at?.toISOString?.() ?? r.created_at,
      })
    })
    res.json(byMessage)
  } catch (err) {
    console.error('Reactions error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// POST /reactions - toggle (insert or delete)
router.post('/', async (req, res) => {
  try {
    const { message_id, emoji } = req.body
    if (!message_id || !emoji) return res.status(400).json({ error: 'message_id und emoji erforderlich' })

    const [existing] = await pool.execute(
      'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [message_id, req.user.id, emoji]
    )

    if (existing.length) {
      await pool.execute('DELETE FROM message_reactions WHERE id = ?', [existing[0].id])
      res.json({ action: 'removed' })
    } else {
      const id = uuidv4()
      await pool.execute(
        'INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)',
        [id, message_id, req.user.id, emoji]
      )
      const [rows] = await pool.execute(
        'SELECT id, message_id, user_id, emoji, created_at FROM message_reactions WHERE id = ?',
        [id]
      )
      const r = rows[0]
      if (r?.created_at) r.created_at = r.created_at.toISOString?.() ?? r.created_at
      res.status(201).json({ action: 'added', reaction: r })
    }
  } catch (err) {
    console.error('Toggle reaction error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
