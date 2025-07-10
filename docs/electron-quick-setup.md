# 🚀 Electron Quick Setup: Knowledge Scout Offline

## 📋 **Checkliste: Was du installieren musst**

### **✅ Bereits im offline Package enthalten (67 Dependencies)**
- Alle UI-Komponenten (Radix-UI, Heroicons, Lucide)
- Next.js + alle Plugins
- State Management (Jotai, Nuqs)
- Utilities (Lodash, Date-fns, UUID, etc.)
- Database (MongoDB)
- Markdown/Syntax Highlighting
- Form Handling (React Hook Form + Zod)
- Charts & Visualization
- Theming
- **KEIN Clerk** (nur NextAuth)

### **❌ Du musst nur installieren**
```bash
# Minimal Setup für Electron
npm install react react-dom
npm install -D electron electron-builder concurrently wait-on
```

## ⚡ **3-Minuten Setup**

### **1. Package.json**
```json
{
  "name": "knowledge-scout-electron",
  "version": "1.0.0",
  "main": "public/electron.js",
  "scripts": {
    "dev": "concurrently \"next dev\" \"wait-on http://localhost:3000 && electron .\"",
    "build": "next build",
    "dist": "next build && electron-builder"
  },
  "dependencies": {
    "@bcommonslab/common-knowledge-scout-offline": "^1.0.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0",
    "concurrently": "^9.0.0",
    "wait-on": "^8.0.0"
  },
  "build": {
    "appId": "com.yourcompany.knowledge-scout",
    "productName": "Knowledge Scout",
    "files": [
      ".next/**/*",
      "public/**/*",
      "node_modules/@bcommonslab/common-knowledge-scout-offline/**/*",
      "node_modules/react/**/*",
      "node_modules/react-dom/**/*"
    ]
  }
}
```

### **2. Next.js Config (next.config.js)**
```javascript
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};
```

### **3. Electron Main (public/electron.js)**
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('.next/out/index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
```

## 🎯 **Häufige Probleme & Lösungen**

### **Problem 1: "Module not found: react"**
```bash
# Lösung: React explizit installieren
npm install react react-dom
```

### **Problem 2: "Cannot resolve 'fs'"**
```bash
# Lösung: Webpack Fallback in next.config.js
webpack: (config) => {
  config.resolve.fallback = { fs: false, path: false };
  return config;
}
```

### **Problem 3: Große Bundle-Größe**
```bash
# Lösung: Nur benötigte Files bundeln
"build": {
  "files": [
    "!node_modules/**/*",
    "node_modules/@bcommonslab/common-knowledge-scout-offline/**/*",
    "node_modules/react/**/*",
    "node_modules/react-dom/**/*"
  ]
}
```

## 📏 **Erwartete Größen**

- **Development**: ~150 MB
- **Production Build**: ~60-80 MB
- **Installierte App**: ~80-120 MB

## 🔧 **Optimierungen (Optional)**

### **Kompression aktivieren**
```json
{
  "build": {
    "compression": "maximum",
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### **Plattform-spezifische Targets**
```json
{
  "build": {
    "win": { "target": "nsis" },
    "mac": { "target": "dmg" },
    "linux": { "target": "AppImage" }
  }
}
```

## 🚀 **Los geht's!**

```bash
# 1. Projekt erstellen
mkdir knowledge-scout-electron
cd knowledge-scout-electron

# 2. Dependencies installieren
npm init -y
npm install @bcommonslab/common-knowledge-scout-offline react react-dom
npm install -D electron electron-builder concurrently wait-on

# 3. Configs erstellen (siehe oben)

# 4. Entwicklung starten
npm run dev

# 5. Build erstellen
npm run dist
```

**Das war's! 🎉 Das offline Package bringt bereits alles mit - du musst nur noch Electron hinzufügen.** 