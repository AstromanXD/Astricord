/**
 * Electron Preload Script
 * Bridge zwischen Renderer und Main Process
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform as string,
  syncUserSettings: (settings: { startMinimized?: boolean; minimizeToTray?: boolean }) =>
    ipcRenderer.invoke('user-settings-sync', settings),
})
