/**
 * Auto-Updater - Prüft auf Updates und installiert sie
 * Nutzer müssen nicht neu installieren, nur updaten
 */
import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-available')
    }
  })

  autoUpdater.on('update-downloaded', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-downloaded')
    }
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-Updater Fehler:', err)
  })

  // Beim Start prüfen
  autoUpdater.checkForUpdatesAndNotify()
}
