import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { authMiddleware } from '../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../../uploads')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase()
    cb(null, `${uuidv4()}.${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\//.test(file.mimetype) || /^audio\//.test(file.mimetype) || /^video\//.test(file.mimetype)
    cb(null, !!ok)
  },
})

const router = Router()
router.use(authMiddleware)

router.post('/message-attachment', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Datei erforderlich' })
  const base = (process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '')
  const url = `${base}/uploads/${req.file.filename}`
  res.json({ url })
})

export default router
