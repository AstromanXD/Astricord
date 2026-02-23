/**
 * Electron Main Process
 * Startet die Chat-Demo als Desktop-App
 */
import { app, BrowserWindow, session, desktopCapturer, ipcMain, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { setupAutoUpdater } from './updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

interface ElectronSettings {
  startMinimized?: boolean
  minimizeToTray?: boolean
}

function getElectronSettings(): ElectronSettings {
  try {
    const path = join(app.getPath('userData'), 'astricord-electron-settings.json')
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'))
      return { startMinimized: !!data.startMinimized, minimizeToTray: data.minimizeToTray !== false }
    }
  } catch {}
  return { startMinimized: false, minimizeToTray: true }
}

function saveElectronSettings(s: ElectronSettings) {
  try {
    const path = join(app.getPath('userData'), 'astricord-electron-settings.json')
    writeFileSync(path, JSON.stringify(s), 'utf-8')
  } catch {}
}

function createWindow(): void {
  const electronSettings = getElectronSettings()

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (!electronSettings.startMinimized) {
      mainWindow?.show()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    if (tray) {
      tray.destroy()
      tray = null
    }
  })
  mainWindow.on('close', (e) => {
    const s = getElectronSettings()
    if (s.minimizeToTray && mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault()
      mainWindow.hide()
      if (!tray) {
        const iconPath = join(__dirname, '../dist/favicon.ico')
        const icon = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
        tray = new Tray(icon)
        tray.setToolTip('Astricord')
        tray.on('click', () => {
          mainWindow?.show()
          mainWindow?.focus()
        })
      }
    }
  })
}

ipcMain.handle('user-settings-sync', (_event, settings: ElectronSettings) => {
  const current = getElectronSettings()
  const next = { ...current, ...settings }
  saveElectronSettings(next)
})

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
    const screen = sources.find((s) => s.id.startsWith('screen:')) ?? sources[0]
    callback(screen ? { video: screen } : {})
  })

  createWindow()

  if (!VITE_DEV_SERVER_URL) {
    setupAutoUpdater()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
