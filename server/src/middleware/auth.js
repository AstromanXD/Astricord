import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Nicht authentifiziert' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const [rows] = await pool.execute(
      'SELECT id, email FROM users WHERE id = ?',
      [decoded.userId]
    )
    if (!rows.length) {
      return res.status(401).json({ error: 'Benutzer nicht gefunden' })
    }
    req.user = { id: rows[0].id, email: rows[0].email }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Ungültiges Token' })
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    req.user = null
    return next()
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null
    } else {
      req.user = { id: decoded.userId }
    }
    next()
  })
}
