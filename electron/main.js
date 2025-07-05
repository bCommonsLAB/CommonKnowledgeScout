const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const log = require('electron-log');

// Konfiguriere electron-log
log.info('=== Electron App gestartet ===');
log.info('App Version:', app.getVersion());
log.info('Electron Version:', process.versions.electron);
log.info('Node Version:', process.versions.node);
log.info('Platform:', process.platform);
log.info('Working Directory:', process.cwd());

// Zeige Log-Pfad an
function showLogPath() {
  const logPath = log.transports.file.getFile().path;
  log.info('=== LOG-DATEI PFAD ===');
  log.info('Log-Datei:', logPath);
  log.info('======================');
  console.log('Log-Datei:', logPath); // Auch in Console ausgeben
}

showLogPath();

// Fehlerbehandlung für uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  log.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Bessere Development-Erkennung
const isDev = process.env.NODE_ENV === 'development' || 
              process.env.ELECTRON_IS_DEV === 'true' || 
              process.defaultApp || 
              /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || 
              /[\\/]electron[\\/]/.test(process.execPath);

// Port-Konfiguration
const DEV_PORT = 3000; // Next.js Dev Server Port (Standard)
const PROD_PORT = 3000; // Production Server Port

let mainWindow;

function findAvailablePort(startPort = 3000) {
  log.info(`Suche nach verfügbarem Port ab ${startPort}`);
  
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, (err) => {
      if (err) {
        log.warn(`Port ${startPort} ist belegt, versuche nächsten Port`);
        server.close();
        findAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        const port = server.address().port;
        log.info(`Verfügbarer Port gefunden: ${port}`);
        server.close();
        resolve(port);
      }
    });
  });
}

async function startNextServer() {
  log.info('=== Starte Next.js Server ===');
  
  try {
    const port = await findAvailablePort(3000);
    log.info(`Verwende Port: ${port}`);
    
    // Prüfe verschiedene mögliche Pfade für server.js
    const possiblePaths = [
      // Development: lokaler Build
      path.join(__dirname, '..', '.next', 'standalone', 'server.js'),
      // Production: extraResources Pfad (bevorzugt)
      path.join(process.resourcesPath, 'app', '.next', 'standalone', 'server.js'),
    ];
    
    let serverPath = null;
    
    for (const testPath of possiblePaths) {
      log.info(`Prüfe Pfad: ${testPath}`);
      if (fs.existsSync(testPath)) {
        serverPath = testPath;
        log.info(`Server.js gefunden: ${serverPath}`);
        break;
      } else {
        log.warn(`Pfad existiert nicht: ${testPath}`);
      }
    }
    
    if (!serverPath) {
      const error = new Error('server.js nicht gefunden');
      log.error('Fehler:', error.message);
      log.error('Gesuchte Pfade:', possiblePaths);
      throw error;
    }
    
    // Setze Umgebungsvariablen
    process.env.PORT = port.toString();
    process.env.NODE_ENV = 'production';
    process.env.HOSTNAME = '0.0.0.0';
    
    // Setze NODE_PATH für Module-Auflösung
    const nodeModulesPath = path.join(path.dirname(serverPath), 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      process.env.NODE_PATH = nodeModulesPath;
      log.info(`NODE_PATH gesetzt: ${nodeModulesPath}`);
      
      // Erweitere Module.SearchPaths für bessere Auflösung
      const Module = require('module');
      const originalResolveFilename = Module._resolveFilename;
      
      Module._resolveFilename = function(request, parent, isMain, options) {
        if (request === 'next') {
          const nextPath = path.join(nodeModulesPath, 'next');
          if (fs.existsSync(nextPath)) {
            log.info(`Module-Auflösung: next -> ${nextPath}`);
            return nextPath;
          }
        }
        return originalResolveFilename.call(this, request, parent, isMain, options);
      };
      
      log.info('Module-Auflösung für next-Modul konfiguriert');
    } else {
      log.warn(`node_modules Verzeichnis nicht gefunden: ${nodeModulesPath}`);
    }
    
    log.info('Umgebungsvariablen gesetzt:', {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      HOSTNAME: process.env.HOSTNAME,
      NODE_PATH: process.env.NODE_PATH
    });
    
    log.info(`Starte Next.js Server direkt: ${serverPath}`);
    
    // Starte Next.js Server direkt in diesem Prozess
    try {
      const serverDir = path.dirname(serverPath);
      log.info(`Server-Verzeichnis: ${serverDir}`);
      
      // Prüfe, ob das Verzeichnis existiert und zugänglich ist
      if (!fs.existsSync(serverDir)) {
        throw new Error(`Server-Verzeichnis existiert nicht: ${serverDir}`);
      }
      
      // Ändere working directory nur wenn es sich nicht um eine .asar-Datei handelt
      const originalCwd = process.cwd();
      if (!serverDir.includes('.asar')) {
      log.info(`Wechsle Working Directory von ${originalCwd} zu ${serverDir}`);
      process.chdir(serverDir);
      } else {
        log.info('Verwende aktuelles Working Directory (server.js in .asar-Datei)');
      }
      
      // Prüfe Module-Verfügbarkeit
      const nodeModulesPath = path.join(serverDir, 'node_modules');
      const nextModulePath = path.join(nodeModulesPath, 'next');
      
      log.info(`Prüfe next-Modul: ${nextModulePath}`);
      if (fs.existsSync(nextModulePath)) {
        log.info('✅ next-Modul gefunden');
      } else {
        log.error('❌ next-Modul nicht gefunden!');
        log.error('Verfügbare Module in node_modules:');
        if (fs.existsSync(nodeModulesPath)) {
          const modules = fs.readdirSync(nodeModulesPath);
          log.error('Module:', modules.join(', '));
        } else {
          log.error('node_modules Verzeichnis existiert nicht!');
        }
      }
      
      // Manuelle Modul-Registrierung für next
      if (fs.existsSync(nextModulePath)) {
        log.info('Registriere next-Modul manuell...');
        require.cache[nextModulePath] = {
          id: nextModulePath,
          filename: nextModulePath,
          loaded: false,
          exports: {}
        };
        
        // Lade das next-Modul explizit
        try {
          const nextModule = require(nextModulePath);
          log.info('✅ Next-Modul erfolgreich registriert');
        } catch (e) {
          log.warn('Warnung beim manuellen Laden des next-Moduls:', e.message);
        }
      }
      
      // Require und starte den Server
      log.info('Lade Next.js Server-Modul...');
      delete require.cache[serverPath]; // Cache leeren für sauberen Start
      
      // Fallback: Versuche next-Modul manuell zu laden
      try {
        require(serverPath);
      } catch (requireError) {
        if (requireError.message.includes("Cannot find module 'next'")) {
          log.error('Next-Modul nicht gefunden, versuche Fallback-Lösung...');
          
          // Versuche next-Modul aus verschiedenen Pfaden zu laden
          const possibleNextPaths = [
            path.join(process.resourcesPath, 'app', '.next', 'standalone', 'node_modules', 'next'),
            path.join(__dirname, '..', 'node_modules', 'next'),
            path.join(process.cwd(), 'node_modules', 'next')
          ];
          
          // Versuche auch @swc/helpers zu laden
          const swcHelpersPath = path.join(process.resourcesPath, 'app', '.next', 'standalone', 'node_modules', '@swc', 'helpers');
          if (fs.existsSync(swcHelpersPath)) {
            log.info(`Lade @swc/helpers aus: ${swcHelpersPath}`);
            try {
              require.cache[swcHelpersPath] = undefined;
              require(swcHelpersPath);
              log.info('✅ @swc/helpers erfolgreich geladen');
            } catch (e) {
              log.warn(`Fehler beim Laden von @swc/helpers:`, e.message);
            }
          }
          
          for (const nextPath of possibleNextPaths) {
            if (fs.existsSync(nextPath)) {
              log.info(`Versuche next-Modul aus: ${nextPath}`);
              try {
                require.cache[nextPath] = undefined;
                require(nextPath);
                log.info('✅ Next-Modul erfolgreich geladen');
                break;
              } catch (e) {
                log.warn(`Fehler beim Laden von ${nextPath}:`, e.message);
              }
            }
          }
          
          // Versuche erneut den Server zu laden
      require(serverPath);
        } else {
          throw requireError;
        }
      }
      
      log.info('Next.js Server-Modul erfolgreich geladen');
      
      // Warte auf Server-Start
      log.info('Warte auf Server-Start...');
      await waitForServer(port);
      log.info('Next.js Server ist bereit');
      
      return port;
      
    } catch (requireError) {
      log.error('Fehler beim Laden des Server-Moduls:', requireError);
      log.error('Require Error Stack:', requireError.stack);
      throw requireError;
    }
    
  } catch (error) {
    log.error('Fehler beim Starten des Next.js Servers:', error);
    log.error('Error Stack:', error.stack);
    throw error;
  }
}

function waitForServer(port, timeout = 30000) {
  log.info(`Warte auf Server auf Port ${port} (Timeout: ${timeout}ms)`);
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkServer = () => {
      const socket = new net.Socket();
      
      socket.setTimeout(1000);
      socket.on('connect', () => {
        log.info('Server ist bereit');
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
        log.error(`Timeout beim Warten auf Server (${timeout}ms)`);
        reject(new Error('Server start timeout'));
      } else {
        log.info('Server noch nicht bereit, versuche erneut...');
        setTimeout(checkServer, 1000);
      }
    };
    
    checkServer();
  });
}

async function createWindow() {
  log.info('=== Erstelle Hauptfenster ===');
  
  try {
    const port = await startNextServer();
    
    log.info('Erstelle BrowserWindow...');
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        webSecurity: true
      },
      icon: path.join(__dirname, 'assets', 'icon.png'),
      show: false // Verstecke Fenster bis es geladen ist
    });
    
    const url = `http://localhost:${port}`;
    log.info(`Lade URL: ${url}`);
    
    await mainWindow.loadURL(url);
    log.info('URL erfolgreich geladen');
    
    // Zeige Fenster nach dem Laden
    mainWindow.show();
    log.info('Fenster angezeigt');
    
    // Öffne externe Links im Standard-Browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      log.info(`Öffne externe URL: ${url}`);
      shell.openExternal(url);
      return { action: 'deny' };
    });
    
    mainWindow.on('closed', () => {
      log.info('Hauptfenster geschlossen');
      mainWindow = null;
    });
    
    // DevTools in Development
    if (process.env.NODE_ENV === 'development') {
      log.info('Öffne DevTools (Development Mode)');
      mainWindow.webContents.openDevTools();
    }
    
  } catch (error) {
    log.error('Fehler beim Erstellen des Fensters:', error);
    log.error('Error Stack:', error.stack);
    app.quit();
  }
}

function createMenu() {
  const template = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Neu',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            console.log('Menu: New clicked');
            if (mainWindow) {
              mainWindow.webContents.send('menu-new');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Beenden',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            console.log('Menu: Quit clicked');
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
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Über Common Knowledge Scout',
              message: 'Common Knowledge Scout',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode.js: ${process.versions.node}\nChrome: ${process.versions.chrome}`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Diese Methode wird aufgerufen wenn Electron fertig ist
app.whenReady().then(() => {
  log.info('=== Electron App bereit ===');
  createWindow();
  
  app.on('activate', () => {
    log.info('App aktiviert');
    if (BrowserWindow.getAllWindows().length === 0) {
      log.info('Kein Fenster vorhanden, erstelle neues');
      createWindow();
    }
  });
});

// Beende wenn alle Fenster geschlossen sind
app.on('window-all-closed', () => {
  log.info('=== Alle Fenster geschlossen ===');
  
  if (process.platform !== 'darwin') {
    log.info('Beende App');
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('=== App wird beendet ===');
  // Next.js Server läuft im gleichen Prozess und wird automatisch beendet
});

// Logging für App-Events
app.on('ready', () => log.info('App Event: ready'));
app.on('will-quit', () => log.info('App Event: will-quit'));
app.on('quit', () => log.info('App Event: quit'));

log.info('=== Electron Main-Skript geladen ==='); 