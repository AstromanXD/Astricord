"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  syncUserSettings: (settings) => electron.ipcRenderer.invoke("user-settings-sync", settings)
});
