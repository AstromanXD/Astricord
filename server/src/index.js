import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

import { subscribe, unsubscribe, broadcast } from './lib/realtime.js'
import authRoutes from './routes/auth.js'
import profilesRoutes from './routes/profiles.js'
import serversRoutes from './routes/servers.js'
import channelsRoutes from './routes/channels.js'
import messagesRoutes from './routes/messages.js'
import friendsRoutes from './routes/friends.js'
import dmRoutes from './routes/dm.js'
import voiceRoutes from './routes/voice.js'
import invitesRoutes from './routes/invites.js'
import reactionsRoutes from './routes/reactions.js'
import emojisRoutes from './routes/emojis.js'
import uploadRoutes from './routes/upload.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'

// Bei Electron-Desktop-App: origin = * (keine Frontend-URL nötig)
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/profiles', profilesRoutes)
app.use('/api/servers', serversRoutes)
app.use('/api/channels', channelsRoutes)
app.use('/api/messages', messagesRoutes)
app.use('/api/friends', friendsRoutes)
app.use('/api/dm', dmRoutes)
app.use('/api/voice', voiceRoutes)
app.use('/api/invites', invitesRoutes)
app.use('/api/reactions', reactionsRoutes)
app.use('/api/emojis', emojisRoutes)
app.use('/api/upload', uploadRoutes)

app.use('/uploads', express.static(uploadsDir))

app.get('/api/health', (_, res) => res.json({ ok: true }))
app.get('/api', (_, res) => res.json({ name: 'Astricord API', version: 1 }))

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path })
})

const httpServer = createServer(app)

const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const token = url.searchParams.get('token')
  let userId = null
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      userId = decoded.userId
    } catch (_) {}
  }
  ws.userId = userId
  ws.subscriptions = new Set()

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'subscribe' && msg.channel) {
        ws.subscriptions.add(msg.channel)
        subscribe(msg.channel, ws)
        if (msg.channel === 'presence:global' && userId) {
          broadcast('presence:global', 'PRESENCE_JOIN', { userId })
        }
      }
      if (msg.type === 'unsubscribe' && msg.channel) {
        ws.subscriptions.delete(msg.channel)
        if (msg.channel === 'presence:global' && userId) {
          broadcast('presence:global', 'PRESENCE_LEAVE', { userId })
        }
        unsubscribe(msg.channel, ws)
      }
      if (msg.type === 'broadcast' && msg.channel && msg.event !== undefined) {
        broadcast(msg.channel, msg.event, msg.payload ?? {})
      }
    } catch (_) {}
  })

  ws.on('close', () => {
    if (userId) {
      broadcast('presence:global', 'PRESENCE_LEAVE', { userId })
    }
    ws.subscriptions.forEach((ch) => unsubscribe(ch, ws))
  })
})

export { broadcast }

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Astricord Server läuft auf http://0.0.0.0:${PORT}`)
})
