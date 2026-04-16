/**
 * @fileoverview Preload nur für das Konfigurations-Fenster (ENV-Viewer).
 * Getrennt vom App-preload.js, damit keine zusätzliche Oberfläche im Next-Renderer landet.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('envViewer', {
  /**
   * @param {{ revealAll?: boolean, revealKeys?: string[] }} opts
   * @returns {Promise<{ meta: Record<string, string | boolean>, rows: unknown[] }>}
   */
  getRows: (opts) => ipcRenderer.invoke('env-config:get-rows', opts || {}),

  /**
   * @param {string} text
   * @returns {Promise<{ ok: boolean }>}
   */
  copyText: (text) => ipcRenderer.invoke('env-config:copy-text', text),
});
