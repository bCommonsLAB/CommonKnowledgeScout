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

  /**
   * Teams stream.aspx → Microsoft Graph → /api/stream-ingest → Secretary
   * @param {{ streamUrl: string, targetLanguage?: string, sourceLanguage?: string, fileName?: string }} opts
   * @returns {Promise<{ ok: true, data: unknown } | { ok: false, error: string }>}
   */
  streamRelayStart: (opts) => ipcRenderer.invoke('stream-relay:start', opts),

  streamRelayCancel: () => ipcRenderer.invoke('stream-relay:cancel'),

  /**
   * @param {(p: { phase: string, percent?: number, message?: string }) => void} callback
   * @returns {() => void} unsubscribe
   */
  onStreamRelayProgress: (callback) => {
    const handler = (_event, p) => {
      callback(p);
    };
    ipcRenderer.on('stream-relay:progress', handler);
    return () => {
      ipcRenderer.removeListener('stream-relay:progress', handler);
    };
  },
});
