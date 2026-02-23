/**
 * Electron Preload Script
 * Bridge zwischen Renderer und Main Process (falls benötigt)
 */
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform as string,
})
