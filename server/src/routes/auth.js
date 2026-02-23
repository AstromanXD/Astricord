import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { pool } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production'

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' })
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length) {
      return res.status(400).json({ error: 'E-Mail bereits registriert' })
    }

    const id = uuidv4()
    const passwordHash = await bcrypt.hash(password, 10)
    const uname = username || email.split('@')[0]

    await pool.execute(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [id, email, passwordHash]
    )
    await pool.execute(
      'INSERT INTO profiles (id, username) VALUES (?, ?)',
      [id, uname]
    )

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' })
    const [profileRows] = await pool.execute(
      'SELECT id, username, avatar_url, theme, status, status_message, custom_status, created_at FROM profiles WHERE id = ?',
      [id]
    )

    res.status(201).json({
      token,
      user: { id, email },
      profile: profileRows[0] ? { ...profileRows[0], created_at: profileRows[0].created_at?.toISOString?.() } : null,
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' })
  }
})

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' })
    }

    const [users] = await pool.execute(
      'SELECT id, email, password_hash FROM users WHERE email = ?',
      [email]
    )
    if (!users.length) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' })
    }

    const valid = await bcrypt.compare(password, users[0].password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' })
    }

    const token = jwt.sign({ userId: users[0].id }, JWT_SECRET, { expiresIn: '7d' })
    const [profileRows] = await pool.execute(
      'SELECT id, username, avatar_url, theme, status, status_message, custom_status, created_at FROM profiles WHERE id = ?',
      [users[0].id]
    )

    const profile = profileRows[0]
    if (profile?.created_at) profile.created_at = profile.created_at.toISOString?.() ?? profile.created_at

    res.json({
      token,
      user: { id: users[0].id, email: users[0].email },
      profile: profile || null,
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Anmeldung fehlgeschlagen' })
  }
})

// GET /auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, avatar_url, theme, status, status_message, custom_status, created_at FROM profiles WHERE id = ?',
      [req.user.id]
    )
    if (!rows.length) {
      return res.status(404).json({ error: 'Profil nicht gefunden' })
    }
    const profile = rows[0]
    if (profile.created_at) profile.created_at = profile.created_at.toISOString?.() ?? profile.created_at
    res.json(profile)
  } catch (err) {
    console.error('Me error:', err)
    res.status(500).json({ error: 'Fehler' })
  }
})

export default router
