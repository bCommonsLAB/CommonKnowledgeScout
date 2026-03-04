/**
 * @fileoverview Electron Preload Script - Bridge zwischen Main und Renderer Process
 *
 * Exponiert eine minimale API an den Renderer-Prozess ueber contextBridge.
 * Ermoeglicht dem Frontend, die Electron-Umgebung zu erkennen.
 * Kann spaeter um native Dialoge (Ordnerauswahl etc.) erweitert werden.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Flag zur Erkennung der Electron-Umgebung im Frontend
  isElectron: true,
  // App-Version aus package.json (via Electron's app.getVersion())
  getVersion: () => ipcRenderer.invoke('get-app-version'),
});
