import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { broadcast } from '../lib/realtime.js'
import { PERMISSIONS, hasPermission, getEffectivePermissions } from '../lib/permissions.js'

const router = Router()
router.use(authMiddleware)

async function canAccessChannel(channelId, userId, requiredPerm = PERMISSIONS.VIEW_CHANNEL) {
  const [ch] = await pool.execute(
    'SELECT server_id FROM channels WHERE id = ?',
    [channelId]
  )
  if (!ch.length) return false
  const [m] = await pool.execute(
    'SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?',
    [ch[0].server_id, userId]
  )
  if (m.length === 0) return false
  const perms = await getEffectivePermissions(pool, ch[0].server_id, userId)
  return hasPermission(perms, requiredPerm)
}

async function canAccessDm(conversationId, userId) {
  const [p] = await pool.execute(
    'SELECT 1 FROM dm_participants WHERE conversation_id = ? AND user_id = ?',
    [conversationId, userId]
  )
  return p.length > 0
}

function toMessage(row) {
  const m = { ...row }
  if (m.created_at) m.created_at = m.created_at.toISOString?.() ?? m.created_at
  if (m.edited_at) m.edited_at = m.edited_at.toISOString?.() ?? m.edited_at
  if (typeof m.attachments === 'string') m.attachments = JSON.parse(m.attachments || '[]')
  return m
}

// GET /messages?channelId=xxx&limit=50&before=xxx
// GET /messages?dmConversationId=xxx&limit=50
router.get('/', async (req, res) => {
  try {
    const { channelId, dmConversationId, limit = 50, before, parentMessageId } = req.query

    if (channelId) {
      const access = await canAccessChannel(channelId, req.user.id)
      if (!access) return res.status(403).json({ error: 'Kein Zugriff' })

      let sql = `SELECT id, channel_id, dm_conversation_id, user_id, content, attachments, is_pinned, edited_at, parent_message_id, created_at
                 FROM messages WHERE channel_id = ?`
      const params = [channelId]
      if (parentMessageId) {
        sql += ' AND parent_message_id = ?'
        params.push(parentMessageId)
      }
      /* Ohne parentMessageId: alle Nachrichten im Channel (inkl. Antworten) */

      if (before) {
        sql += ' AND created_at < ?'
        params.push(before)
      }
      sql += ' ORDER BY created_at DESC LIMIT ?'
      params.push(parseInt(limit, 10) || 50)

      const [rows] = await pool.execute(sql, params)
      res.json(rows.map(toMessage).reverse())
      return
    }

    if (dmConversationId) {
      const access = await canAccessDm(dmConversationId, req.user.id)
      if (!access) return res.status(403).json({ error: 'Kein Zugriff' })

      let sql = `SELECT id, channel_id, dm_conversation_id, user_id, content, attachments, is_pinned, edited_at, parent_message_id, created_at
                 FROM messages WHERE dm_conversation_id = ?`
      const params = [dmConversationId]
      if (before) {
        sql += ' AND created_at < ?'
        params.push(before)
      }
      sql += ' ORDER BY created_at ASC LIMIT ?'
      params.push(parseInt(limit, 10) || 50)

      const [rows] = await pool.execute(sql, params)
      res.json(rows.map(toMessage))
      return
    }

    res.status(400).json({ error: 'channelId oder dmConversationId erforderlich' })
  } catch (err) {
    console.error('Messages list error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// POST /messages
router.post('/', async (req, res) => {
  try {
    const { channel_id, dm_conversation_id, content, attachments, parent_message_id } = req.body

    if (!content?.trim() && (!attachments || !attachments.length)) {
      return res.status(400).json({ error: 'Inhalt erforderlich' })
    }

    const id = uuidv4()
    const atts = attachments ? JSON.stringify(attachments) : '[]'

    if (channel_id) {
      const canSend = await canAccessChannel(channel_id, req.user.id, PERMISSIONS.SEND_MESSAGES)
      if (!canSend) return res.status(403).json({ error: 'Keine Berechtigung zum Senden' })

      await pool.execute(
        'INSERT INTO messages (id, channel_id, user_id, content, attachments, parent_message_id) VALUES (?, ?, ?, ?, ?, ?)',
        [id, channel_id, req.user.id, content?.trim() || ' ', atts, parent_message_id || null]
      )
    } else if (dm_conversation_id) {
      const access = await canAccessDm(dm_conversation_id, req.user.id)
      if (!access) return res.status(403).json({ error: 'Kein Zugriff' })

      await pool.execute(
        'INSERT INTO messages (id, dm_conversation_id, user_id, content, attachments) VALUES (?, ?, ?, ?, ?)',
        [id, dm_conversation_id, req.user.id, content?.trim() || ' ', atts]
      )
    } else {
      return res.status(400).json({ error: 'channel_id oder dm_conversation_id erforderlich' })
    }

    const [rows] = await pool.execute(
      'SELECT id, channel_id, dm_conversation_id, user_id, content, attachments, is_pinned, edited_at, parent_message_id, created_at FROM messages WHERE id = ?',
      [id]
    )
    const msg = toMessage(rows[0])
    if (channel_id) broadcast(`messages:${channel_id}`, 'INSERT', msg)
    else if (dm_conversation_id) broadcast(`messages:dm:${dm_conversation_id}`, 'INSERT', msg)
    res.status(201).json(msg)
  } catch (err) {
    console.error('Create message error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// PATCH /messages/:id
router.patch('/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT m.user_id, m.channel_id FROM messages m WHERE m.id = ?',
      [req.params.id]
    )
    if (!existing.length) return res.status(404).json({ error: 'Nachricht nicht gefunden' })
    const isOwn = existing[0].user_id === req.user.id
    const { content, is_pinned } = req.body

    if (existing[0].channel_id) {
      const [ch] = await pool.execute('SELECT server_id FROM channels WHERE id = ?', [existing[0].channel_id])
      if (ch.length) {
        const perms = await getEffectivePermissions(pool, ch[0].server_id, req.user.id)
        if (is_pinned !== undefined && !hasPermission(perms, PERMISSIONS.PIN_MESSAGES) && !hasPermission(perms, PERMISSIONS.MANAGE_MESSAGES)) {
          return res.status(403).json({ error: 'Keine Berechtigung zum Anpinnen' })
        }
        if (!isOwn && content !== undefined && !hasPermission(perms, PERMISSIONS.MANAGE_MESSAGES)) {
          return res.status(403).json({ error: 'Keine Berechtigung zum Bearbeiten fremder Nachrichten' })
        }
      }
    }
    const updates = []
    const values = []
    if (content !== undefined) {
      updates.push('content = ?', 'edited_at = CURRENT_TIMESTAMP(3)')
      values.push(content)
    }
    if (is_pinned !== undefined) {
      updates.push('is_pinned = ?')
      values.push(is_pinned)
    }
    if (!updates.length) return res.status(400).json({ error: 'Keine Änderungen' })

    values.push(req.params.id)
    await pool.execute(`UPDATE messages SET ${updates.join(', ')} WHERE id = ?`, values)

    const [rows] = await pool.execute(
      'SELECT id, channel_id, dm_conversation_id, user_id, content, attachments, is_pinned, edited_at, parent_message_id, created_at FROM messages WHERE id = ?',
      [req.params.id]
    )
    const msg = toMessage(rows[0])
    if (msg.channel_id) broadcast(`messages:${msg.channel_id}`, 'UPDATE', msg)
    else if (msg.dm_conversation_id) broadcast(`messages:dm:${msg.dm_conversation_id}`, 'UPDATE', msg)
    res.json(msg)
  } catch (err) {
    console.error('Update message error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

// DELETE /messages/:id
router.delete('/:id', async (req, res) => {
  try {
    const [existing] = await pool.execute(
      'SELECT m.user_id, m.channel_id FROM messages m WHERE m.id = ?',
      [req.params.id]
    )
    if (!existing.length) return res.status(404).json({ error: 'Nachricht nicht gefunden' })
    const isOwn = existing[0].user_id === req.user.id
    if (!isOwn && existing[0].channel_id) {
      const [ch] = await pool.execute('SELECT server_id FROM channels WHERE id = ?', [existing[0].channel_id])
      if (ch.length) {
        const perms = await getEffectivePermissions(pool, ch[0].server_id, req.user.id)
        if (!hasPermission(perms, PERMISSIONS.MANAGE_MESSAGES)) {
          return res.status(403).json({ error: 'Keine Berechtigung zum Löschen fremder Nachrichten' })
        }
      }
    } else if (!isOwn && !existing[0].channel_id) {
      return res.status(403).json({ error: 'Keine Berechtigung' })
    }

    const [old] = await pool.execute('SELECT channel_id, dm_conversation_id FROM messages WHERE id = ?', [req.params.id])
    await pool.execute('DELETE FROM messages WHERE id = ?', [req.params.id])
    if (old.length) {
      if (old[0].channel_id) broadcast(`messages:${old[0].channel_id}`, 'DELETE', { id: req.params.id })
      else if (old[0].dm_conversation_id) broadcast(`messages:dm:${old[0].dm_conversation_id}`, 'DELETE', { id: req.params.id })
    }
    res.status(204).send()
  } catch (err) {
    console.error('Delete message error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
