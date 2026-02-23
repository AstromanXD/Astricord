import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/user/:userId/session', async (req, res) => {
  try {
    const { userId } = req.params
    if (!userId) return res.status(400).json({ error: 'userId erforderlich' })

    const [rows] = await pool.execute(
      `SELECT vs.channel_id, c.name as channel_name
       FROM voice_sessions vs
       JOIN channels c ON c.id = vs.channel_id
       WHERE vs.user_id = ?
       LIMIT 1`,
      [userId]
    )
    if (!rows.length) return res.json(null)
    res.json({ channel_id: rows[0].channel_id, channel_name: rows[0].channel_name })
  } catch (err) {
    console.error('Voice user session error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.get('/sessions', async (req, res) => {
  try {
    const { channelIds } = req.query
    if (!channelIds) return res.status(400).json({ error: 'channelIds erforderlich' })

    const ids = Array.isArray(channelIds) ? channelIds : channelIds.split(',')
    if (!ids.length) return res.json({})

    const placeholders = ids.map(() => '?').join(',')
    const [rows] = await pool.execute(
      `SELECT vs.channel_id, vs.user_id, vs.is_muted, vs.has_video, vs.is_screen_sharing
       FROM voice_sessions vs
       WHERE vs.channel_id IN (${placeholders})`,
      ids
    )

    const userIds = [...new Set(rows.map((r) => r.user_id))]
    const byChannel = {}
    const byUser = {}

    if (userIds.length) {
      const ph = userIds.map(() => '?').join(',')
      const [profiles] = await pool.execute(
        `SELECT id, username, avatar_url FROM profiles WHERE id IN (${ph})`,
        userIds
      )
      profiles.forEach((p) => { byUser[p.id] = p })
    }

    rows.forEach((r) => {
      if (!byChannel[r.channel_id]) byChannel[r.channel_id] = []
      byChannel[r.channel_id].push({
        userId: r.user_id,
        username: byUser[r.user_id]?.username ?? 'Unbekannt',
        avatarUrl: byUser[r.user_id]?.avatar_url ?? null,
        isMuted: !!r.is_muted,
        hasVideo: !!r.has_video,
        isScreenSharing: !!r.is_screen_sharing,
      })
    })

    res.json(byChannel)
  } catch (err) {
    console.error('Voice sessions error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/join', async (req, res) => {
  try {
    const { channel_id } = req.body
    if (!channel_id) return res.status(400).json({ error: 'channel_id erforderlich' })

    const [ch] = await pool.execute(
      'SELECT id FROM channels WHERE id = ? AND type = ?',
      [channel_id, 'voice']
    )
    if (!ch.length) return res.status(404).json({ error: 'Voice-Kanal nicht gefunden' })

    const [member] = await pool.execute(
      'SELECT 1 FROM server_members sm JOIN channels c ON c.server_id = sm.server_id WHERE c.id = ? AND sm.user_id = ?',
      [channel_id, req.user.id]
    )
    if (!member.length) return res.status(403).json({ error: 'Kein Zugriff' })

    await pool.execute(
      `INSERT INTO voice_sessions (id, channel_id, user_id, is_muted, has_video, is_screen_sharing)
       VALUES (?, ?, ?, 0, 0, 0)
       ON DUPLICATE KEY UPDATE joined_at = CURRENT_TIMESTAMP(3), is_muted = 0, has_video = 0, is_screen_sharing = 0`,
      [uuidv4(), channel_id, req.user.id]
    )

    res.status(201).json({ channel_id, user_id: req.user.id })
  } catch (err) {
    console.error('Voice join error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.post('/leave', async (req, res) => {
  try {
    const { channel_id } = req.body
    if (!channel_id) return res.status(400).json({ error: 'channel_id erforderlich' })

    await pool.execute(
      'DELETE FROM voice_sessions WHERE channel_id = ? AND user_id = ?',
      [channel_id, req.user.id]
    )
    res.status(204).send()
  } catch (err) {
    console.error('Voice leave error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/mute', async (req, res) => {
  try {
    const { channel_id, is_muted } = req.body
    if (!channel_id || typeof is_muted !== 'boolean') return res.status(400).json({ error: 'channel_id und is_muted erforderlich' })

    await pool.execute(
      'UPDATE voice_sessions SET is_muted = ? WHERE channel_id = ? AND user_id = ?',
      [is_muted, channel_id, req.user.id]
    )
    res.json({ channel_id, is_muted })
  } catch (err) {
    console.error('Voice mute error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/video', async (req, res) => {
  try {
    const { channel_id, has_video } = req.body
    if (!channel_id || typeof has_video !== 'boolean') return res.status(400).json({ error: 'channel_id und has_video erforderlich' })

    await pool.execute(
      'UPDATE voice_sessions SET has_video = ? WHERE channel_id = ? AND user_id = ?',
      [has_video, channel_id, req.user.id]
    )
    res.json({ channel_id, has_video })
  } catch (err) {
    console.error('Voice video error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

router.patch('/screen', async (req, res) => {
  try {
    const { channel_id, is_screen_sharing } = req.body
    if (!channel_id || typeof is_screen_sharing !== 'boolean') return res.status(400).json({ error: 'channel_id und is_screen_sharing erforderlich' })

    await pool.execute(
      'UPDATE voice_sessions SET is_screen_sharing = ? WHERE channel_id = ? AND user_id = ?',
      [is_screen_sharing, channel_id, req.user.id]
    )
    res.json({ channel_id, is_screen_sharing })
  } catch (err) {
    console.error('Voice screen error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
