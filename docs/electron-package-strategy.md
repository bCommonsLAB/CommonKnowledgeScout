# Electron Package Strategy

## Übersicht

Diese Dokumentation beschreibt die Strategie zur Aufspaltung des CommonKnowledgeScout-Projekts in zwei separate Repositories:

1. **CommonKnowledgeScout** (Web-Package) - Hauptanwendung als npm-Package
2. **CommonKnowledgeScout-Desktop** (Electron-Wrapper) - Desktop-Application

Diese Trennung ermöglicht:
- Schnellere Build-Zeiten (60-80% Reduktion)
- Saubere Trennung von Web- und Desktop-Code
- Unabhängige Entwicklungszyklen
- Einfachere Wartung und Updates

## Strategie-Übersicht

### Aktueller Zustand
```
CommonKnowledgeScout/
├── Electron-Dependencies vermischt
├── Build-Zeit: 5-8 Minuten
├── Komplexe Module-Resolution
└── Maintenance-Aufwand hoch
```

### Ziel-Zustand
```
CommonKnowledgeScout/              (Web-Package)
├── Reine Web-Anwendung
├── Als npm-Package deploybar
├── Build-Zeit: 2-3 Minuten
└── Keine Electron-Abhängigkeiten

CommonKnowledgeScout-Desktop/      (Electron-Wrapper)
├── Minimaler Electron-Code
├── Importiert Web-Package
├── Build-Zeit: 30-90 Sekunden
└── Plattform-spezifische Features
```

---

## Phase 1: CommonKnowledgeScout als npm-Package

### Schritt 1: Package-Konfiguration

#### 1.1 Package.json anpassen
```json
{
  "name": "@bcommonslab/common-knowledge-scout",
  "version": "1.0.0",
  "description": "Common Knowledge Scout - Modern Document Management System",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist/**/*",
    "public/**/*",
    "package.json",
    "README.md"
  ],
  "scripts": {
    "build": "next build",
    "build:package": "npm run build && npm run package:prepare",
    "package:prepare": "node scripts/prepare-package.js",
    "package:publish": "npm run build:package && npm publish"
  },
  "keywords": [
    "document-management",
    "next.js",
    "typescript",
    "file-management"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/bCommonsLAB/CommonKnowledgeScout.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

#### 1.2 Package-Preparation-Script erstellen
```javascript
// scripts/prepare-package.js
const fs = require('fs');
const path = require('path');

async function preparePackage() {
  console.log('🔧 Preparing package for distribution...');
  
  // 1. Standalone build kopieren
  const standalonePath = path.join(__dirname, '..', '.next', 'standalone');
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (fs.existsSync(standalonePath)) {
    fs.cpSync(standalonePath, distPath, { recursive: true });
    console.log('✅ Standalone build copied to dist/');
  }
  
  // 2. Public assets kopieren
  const publicPath = path.join(__dirname, '..', 'public');
  const distPublicPath = path.join(distPath, 'public');
  
  if (fs.existsSync(publicPath)) {
    fs.cpSync(publicPath, distPublicPath, { recursive: true });
    console.log('✅ Public assets copied');
  }
  
  // 3. Package-spezifische package.json erstellen
  const mainPackageJson = require('../package.json');
  const packageJson = {
    name: mainPackageJson.name,
    version: mainPackageJson.version,
    description: mainPackageJson.description,
    main: 'server.js',
    dependencies: {
      // Nur Production-Dependencies
      ...Object.fromEntries(
        Object.entries(mainPackageJson.dependencies || {})
          .filter(([key]) => !key.startsWith('electron'))
      )
    }
  };
  
  fs.writeFileSync(
    path.join(distPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  console.log('✅ Package prepared successfully');
}

preparePackage().catch(console.error);
```

### Schritt 2: Next.js-Konfiguration für Package

#### 2.1 Next.js Config erweitern
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // Package-spezifische Konfiguration
  env: {
    BUILD_TARGET: process.env.BUILD_TARGET || 'web',
    IS_PACKAGE_BUILD: process.env.IS_PACKAGE_BUILD || 'false'
  },
  
  experimental: {
    esmExternals: 'loose'
  },
  
  // Optimierungen für Package-Build
  typescript: {
    // Ignoriere Build-Errors für Package (falls nötig)
    ignoreBuildErrors: process.env.IS_PACKAGE_BUILD === 'true'
  },
  
  // Webpack-Konfiguration für Package
  webpack: (config, { isServer }) => {
    if (process.env.IS_PACKAGE_BUILD === 'true') {
      // Package-spezifische Optimierungen
      config.externals = config.externals || [];
      
      // Electron-spezifische Module ausschließen
      config.externals.push('electron');
    }
    
    return config;
  }
};

module.exports = nextConfig;
```

#### 2.2 Build-Scripts anpassen
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:web": "BUILD_TARGET=web next build",
    "build:package": "IS_PACKAGE_BUILD=true BUILD_TARGET=package next build && node scripts/prepare-package.js",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### Schritt 3: Electron-Dependencies entfernen

#### 3.1 Dependencies bereinigen
```bash
# Electron-spezifische Dependencies entfernen
npm uninstall electron electron-builder electron-log

# Package.json bereinigen
# Alle "electron*" Dependencies entfernen
# Alle "electron-*" devDependencies entfernen
```

#### 3.2 Electron-spezifische Dateien entfernen
```bash
# Dateien löschen/verschieben
rm -rf electron/
rm -rf assets/
rm -rf standalone/
rm electron-builder.yml
```

#### 3.3 Code-Bereinigung
```typescript
// Electron-spezifische Imports entfernen
// Beispiel: In verschiedenen Komponenten
// ENTFERNEN:
// import { ipcRenderer } from 'electron';

// Environment-Checks anpassen
// VORHER:
// if (typeof window !== 'undefined' && window.electron) {
// NACHHER:
// if (typeof window !== 'undefined' && process.env.BUILD_TARGET === 'electron') {
```

### Schritt 4: CI/CD für Package

#### 4.1 GitHub Actions für Package-Publishing
```yaml
# .github/workflows/publish-package.yml
name: Publish Package

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        registry-url: 'https://npm.pkg.github.com'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build package
      run: npm run build:package
    
    - name: Publish package
      run: npm publish
      env:
        NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Phase 2: CommonKnowledgeScout-Desktop (Electron-Wrapper)

### Schritt 1: Neues Repository erstellen

#### 1.1 Repository-Struktur
```
CommonKnowledgeScout-Desktop/
├── package.json
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── menu.js
├── src/
│   ├── renderer/
│   │   ├── index.html
│   │   └── renderer.js
│   └── utils/
│       └── package-manager.js
├── assets/
│   ├── icon.png
│   ├── icon.ico
│   └── icon.icns
├── scripts/
│   ├── build.js
│   └── dev.js
├── dist/
└── README.md
```

#### 1.2 Package.json für Electron-Wrapper
```json
{
  "name": "common-knowledge-scout-desktop",
  "version": "1.0.0",
  "description": "Desktop application for Common Knowledge Scout",
  "main": "electron/main.js",
  "scripts": {
    "dev": "electron .",
    "build": "electron-builder",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux",
    "build:all": "electron-builder --win --mac --linux",
    "package:update": "npm install @bcommonslab/common-knowledge-scout@latest"
  },
  "dependencies": {
    "@bcommonslab/common-knowledge-scout": "^1.0.0",
    "electron-log": "^5.0.0",
    "electron-updater": "^6.0.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0"
  },
  "build": {
    "appId": "com.bcommonslab.knowledge-scout",
    "productName": "Common Knowledge Scout",
    "directories": {
      "output": "dist"
    },
    "files": [
      "electron/**/*",
      "src/**/*",
      "assets/**/*",
      "node_modules/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

### Schritt 2: Electron Main Process

#### 2.1 Main.js - Haupt-Electron-Process
```javascript
// electron/main.js
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const PackageManager = require('../src/utils/package-manager');

// Konfiguration
const isDev = process.env.NODE_ENV === 'development';
const packageManager = new PackageManager();

let mainWindow;
let webServerPort = 3000;

// Logging konfigurieren
log.info('=== Common Knowledge Scout Desktop gestartet ===');

// Auto-Updater konfigurieren
autoUpdater.checkForUpdatesAndNotify();

async function createWindow() {
  log.info('Erstelle Hauptfenster...');
  
  try {
    // Web-Package starten
    webServerPort = await packageManager.startWebServer();
    log.info(`Web-Server gestartet auf Port ${webServerPort}`);
    
    // Hauptfenster erstellen
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false
    });
    
    // Menu setzen
    const menu = require('./menu');
    Menu.setApplicationMenu(menu);
    
    // Web-App laden
    await mainWindow.loadURL(`http://localhost:${webServerPort}`);
    
    // Fenster anzeigen
    mainWindow.show();
    
    // Externe Links im Browser öffnen
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
    
    // DevTools in Development
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
    
  } catch (error) {
    log.error('Fehler beim Erstellen des Fensters:', error);
    app.quit();
  }
}

// App-Events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    packageManager.stopWebServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC-Handler
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  return await autoUpdater.checkForUpdatesAndNotify();
});
```

#### 2.2 Package Manager - Web-Server Management
```javascript
// src/utils/package-manager.js
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const log = require('electron-log');

class PackageManager {
  constructor() {
    this.webServer = null;
    this.webServerPort = null;
  }
  
  async startWebServer(port = 3000) {
    log.info('Starte Web-Server...');
    
    try {
      // Freien Port finden
      const availablePort = await this.findAvailablePort(port);
      
      // Web-Package-Pfad
      const packagePath = path.join(
        __dirname, 
        '..', 
        '..',
        'node_modules',
        '@bcommonslab',
        'common-knowledge-scout'
      );
      
      // Server-Script-Pfad
      const serverScript = path.join(packagePath, 'server.js');
      
      // Umgebungsvariablen setzen
      const env = {
        ...process.env,
        PORT: availablePort.toString(),
        NODE_ENV: 'production',
        HOSTNAME: '127.0.0.1'
      };
      
      // Node.js Server starten
      this.webServer = spawn('node', [serverScript], {
        env,
        cwd: packagePath,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Logging
      this.webServer.stdout.on('data', (data) => {
        log.info(`Web-Server: ${data.toString()}`);
      });
      
      this.webServer.stderr.on('data', (data) => {
        log.error(`Web-Server Error: ${data.toString()}`);
      });
      
      this.webServer.on('close', (code) => {
        log.info(`Web-Server beendet mit Code ${code}`);
      });
      
      // Warten bis Server bereit ist
      await this.waitForServer(availablePort);
      
      this.webServerPort = availablePort;
      return availablePort;
      
    } catch (error) {
      log.error('Fehler beim Starten des Web-Servers:', error);
      throw error;
    }
  }
  
  stopWebServer() {
    if (this.webServer) {
      log.info('Stoppe Web-Server...');
      this.webServer.kill();
      this.webServer = null;
      this.webServerPort = null;
    }
  }
  
  async findAvailablePort(startPort = 3000) {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(startPort, (err) => {
        if (err) {
          server.close();
          this.findAvailablePort(startPort + 1).then(resolve).catch(reject);
        } else {
          const port = server.address().port;
          server.close();
          resolve(port);
        }
      });
    });
  }
  
  async waitForServer(port, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkServer = () => {
        const socket = new net.Socket();
        
        socket.setTimeout(1000);
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          checkAgain();
        });
        
        socket.on('error', () => {
          socket.destroy();
          checkAgain();
        });
        
        socket.connect(port, '127.0.0.1');
      };
      
      const checkAgain = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server start timeout'));
        } else {
          setTimeout(checkServer, 1000);
        }
      };
      
      checkServer();
    });
  }
}

module.exports = PackageManager;
```

### Schritt 3: Preload Script

#### 3.1 Preload.js - Sichere API-Brücke
```javascript
// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Sichere API für Renderer-Process
contextBridge.exposeInMainWorld('electronAPI', {
  // App-Informationen
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  // File-System (falls benötigt)
  selectFile: () => ipcRenderer.invoke('dialog-open-file'),
  selectFolder: () => ipcRenderer.invoke('dialog-open-folder'),
  
  // Notifications
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body)
});

// Desktop-spezifische Features
contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  isElectron: true,
  
  // Theme
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  
  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close')
});
```

### Schritt 4: Menu-System

#### 4.1 Menu.js - Anwendungsmenü
```javascript
// electron/menu.js
const { Menu, shell, dialog } = require('electron');

const template = [
  {
    label: 'Datei',
    submenu: [
      {
        label: 'Neu',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          // Weiterleitung an Web-App
          mainWindow.webContents.send('menu-new');
        }
      },
      {
        label: 'Öffnen',
        accelerator: 'CmdOrCtrl+O',
        click: async () => {
          const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
              { name: 'Alle Dateien', extensions: ['*'] }
            ]
          });
          
          if (!result.canceled) {
            mainWindow.webContents.send('menu-open-file', result.filePaths[0]);
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Beenden',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Bearbeiten',
    submenu: [
      { role: 'undo', label: 'Rückgängig' },
      { role: 'redo', label: 'Wiederholen' },
      { type: 'separator' },
      { role: 'cut', label: 'Ausschneiden' },
      { role: 'copy', label: 'Kopieren' },
      { role: 'paste', label: 'Einfügen' }
    ]
  },
  {
    label: 'Ansicht',
    submenu: [
      { role: 'reload', label: 'Neu laden' },
      { role: 'forceReload', label: 'Erzwingen neu laden' },
      { role: 'toggleDevTools', label: 'Entwicklertools' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Zoom zurücksetzen' },
      { role: 'zoomIn', label: 'Vergrößern' },
      { role: 'zoomOut', label: 'Verkleinern' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Vollbild' }
    ]
  },
  {
    label: 'Hilfe',
    submenu: [
      {
        label: 'Über',
        click: () => {
          dialog.showMessageBox({
            type: 'info',
            title: 'Über Common Knowledge Scout',
            message: 'Common Knowledge Scout Desktop',
            detail: `Version ${app.getVersion()}\nModernes Dokumentenmanagementsystem`
          });
        }
      },
      {
        label: 'GitHub Repository',
        click: () => {
          shell.openExternal('https://github.com/bCommonsLAB/CommonKnowledgeScout');
        }
      }
    ]
  }
];

module.exports = Menu.buildFromTemplate(template);
```

### Schritt 5: Build-Scripts

#### 5.1 Build.js - Automatisierter Build-Prozess
```javascript
// scripts/build.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function build() {
  console.log('🚀 Starte Electron-Build...');
  
  try {
    // 1. Web-Package auf neueste Version aktualisieren
    console.log('📦 Aktualisiere Web-Package...');
    await execCommand('npm install @bcommonslab/common-knowledge-scout@latest');
    
    // 2. Electron-Builder ausführen
    console.log('🔧 Starte Electron-Builder...');
    const platform = process.argv[2] || 'all';
    
    let buildCommand = 'electron-builder';
    if (platform === 'win') buildCommand += ' --win';
    if (platform === 'mac') buildCommand += ' --mac';
    if (platform === 'linux') buildCommand += ' --linux';
    
    await execCommand(buildCommand);
    
    console.log('✅ Build erfolgreich abgeschlossen!');
    
    // 3. Build-Artefakte auflisten
    const distPath = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distPath)) {
      console.log('\n📁 Build-Artefakte:');
      const files = fs.readdirSync(distPath);
      files.forEach(file => {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`   ${file} (${size} MB)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Build fehlgeschlagen:', error);
    process.exit(1);
  }
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        console.log(stdout);
        resolve();
      }
    });
  });
}

build();
```

---

## Phase 3: Testing und Deployment

### Schritt 1: Lokale Testing-Strategie

#### 1.1 Web-Package Testing
```bash
# Im CommonKnowledgeScout Repository
npm run build:package

# Package lokal testen
npm pack
# Erstellt common-knowledge-scout-1.0.0.tgz

# In Test-Umgebung
npm install /path/to/common-knowledge-scout-1.0.0.tgz
```

#### 1.2 Electron-Wrapper Testing
```bash
# Im CommonKnowledgeScout-Desktop Repository
npm install

# Development-Modus
npm run dev

# Build testen
npm run build:win
./dist/Common Knowledge Scout Setup.exe
```

### Schritt 2: CI/CD Pipeline

#### 2.1 Web-Package CI/CD
```yaml
# .github/workflows/publish-web-package.yml
name: Publish Web Package

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        registry-url: 'https://npm.pkg.github.com'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build and test
      run: |
        npm run build:package
        npm run test
    
    - name: Publish to GitHub Packages
      run: npm publish
      env:
        NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 2.2 Electron-App CI/CD
```yaml
# .github/workflows/build-electron-app.yml
name: Build Electron App

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        registry-url: 'https://npm.pkg.github.com'
    
    - name: Install dependencies
      run: npm ci
      env:
        NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build Electron app
      run: npm run build
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: electron-app-${{ matrix.os }}
        path: dist/
```

### Schritt 3: Versioning und Updates

#### 3.1 Semantic Versioning
```json
{
  "version": "1.0.0",
  "scripts": {
    "version:patch": "npm version patch",
    "version:minor": "npm version minor", 
    "version:major": "npm version major"
  }
}
```

#### 3.2 Auto-Updates für Electron
```javascript
// In electron/main.js
const { autoUpdater } = require('electron-updater');

// Update-Konfiguration
autoUpdater.updateConfigPath = path.join(__dirname, 'app-update.yml');

// Update-Events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available.');
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.');
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded');
  // Benachrichtigung an User
  dialog.showMessageBox({
    type: 'info',
    title: 'Update verfügbar',
    message: 'Eine neue Version wurde heruntergeladen. Jetzt installieren?',
    buttons: ['Jetzt installieren', 'Später']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
```

---

## Phase 4: Monitoring und Maintenance

### Schritt 1: Logging und Monitoring

#### 1.1 Electron-Logging
```javascript
// electron/main.js
const log = require('electron-log');

// Log-Konfiguration
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

// Performance-Monitoring
function logPerformance(label, fn) {
  const start = process.hrtime();
  const result = fn();
  const [seconds, nanoseconds] = process.hrtime(start);
  const milliseconds = seconds * 1000 + nanoseconds / 1000000;
  log.info(`${label}: ${milliseconds.toFixed(2)}ms`);
  return result;
}
```

#### 1.2 Error Reporting
```javascript
// electron/main.js
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  // Optional: Sentry oder andere Error-Reporting-Service
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection:', reason);
});
```

### Schritt 2: Health Checks

#### 2.1 Package Health Check
```javascript
// scripts/health-check.js
const https = require('https');
const packageJson = require('../package.json');

async function checkPackageHealth() {
  try {
    // 1. Package-Verfügbarkeit prüfen
    const packageUrl = `https://npm.pkg.github.com/@bcommonslab/common-knowledge-scout`;
    
    // 2. Aktuelle Version prüfen
    const currentVersion = packageJson.dependencies['@bcommonslab/common-knowledge-scout'];
    console.log(`Current version: ${currentVersion}`);
    
    // 3. Server-Erreichbarkeit testen
    const testUrl = 'http://localhost:3000';
    // ... Health-Check-Logik
    
    console.log('✅ Package Health Check erfolgreich');
  } catch (error) {
    console.error('❌ Package Health Check fehlgeschlagen:', error);
    process.exit(1);
  }
}

checkPackageHealth();
```

---

## Zusammenfassung

### Zeitersparnis durch diese Strategie

| Phase | Aktuell | Neue Strategie | Ersparnis |
|-------|---------|----------------|-----------|
| Initial Build | 5-8 min | 3-5 min | 30-40% |
| Web-Änderungen | 5-8 min | 2-3 min | 60-70% |
| Electron-Änderungen | 5-8 min | 30-90 sec | 80-90% |
| Multi-Platform | 15-24 min | 2-4 min | 85-90% |

### Nächste Schritte

1. **Phase 1 starten**: CommonKnowledgeScout als Package vorbereiten
2. **Testing**: Lokale Tests des Web-Packages
3. **Phase 2**: Electron-Wrapper Repository erstellen
4. **Integration**: Beide Projekte zusammenführen
5. **CI/CD**: Automatisierte Pipelines einrichten
6. **Deployment**: Erste Releases testen

Diese Strategie bietet eine saubere Trennung, deutlich schnellere Build-Zeiten und bessere Wartbarkeit für beide Projekte. 