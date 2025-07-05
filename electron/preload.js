const { contextBridge, ipcRenderer } = require('electron');

// Exponiere geschützte Methoden für die Kommunikation zwischen
// Renderer und Main Process
contextBridge.exposeInMainWorld('electronAPI', {
  // App-Informationen
  getAppVersion: () => {
    return process.env.npm_package_version || '0.1.0';
  },
  
  getPlatform: () => {
    return process.platform;
  },
  
  // Menü-Events (für später)
  onMenuNew: (callback) => {
    ipcRenderer.on('menu-new', callback);
  },
  
  // Utility-Funktionen
  isElectron: () => {
    return true;
  },
  
  // Cleanup-Funktion
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Exponiere Node.js APIs die im Renderer benötigt werden
contextBridge.exposeInMainWorld('nodeAPI', {
  platform: process.platform,
  versions: process.versions,
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    ELECTRON: 'true'
  }
});

// Debug-Informationen
console.log('Preload script loaded');
console.log('Platform:', process.platform);
console.log('Node version:', process.versions.node);
console.log('Electron version:', process.versions.electron); 