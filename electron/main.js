/**
 * @fileoverview Electron Main Process - Knowledge Scout Desktop App
 *
 * Startet den Next.js Standalone-Server im Electron Main Process
 * mittels next-electron-rsc. In Development wird der Dev-Server
 * automatisch gestartet, in Production werden HTTP-Requests
 * über ein Protocol-Intercept intern an Next.js weitergeleitet.
 * WICHTIG: createHandler() muss VOR app.on('ready') aufgerufen werden,
 * da registerSchemesAsPrivileged nur vor App-Ready funktioniert.
 *
 * @see https://github.com/kirill-konshin/next-electron-rsc
 */

const { app, BrowserWindow, protocol, dialog, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { autoUpdater } = require('electron-updater');

// Windows-Terminal auf UTF-8 setzen, damit Next.js-Logs korrekt angezeigt werden
if (process.platform === 'win32') {
  try { execSync('chcp 65001', { stdio: 'ignore' }); } catch { /* ignore */ }
}

// Sauberes Beenden bei Prozess-Signalen
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

// app.isPackaged ist true wenn die App via electron-builder paketiert wurde
const dev = !app.isPackaged;

// File-Logging: In Production werden alle console-Ausgaben in eine Log-Datei
// geschrieben, da die GUI-App auf Windows kein Terminal-Output hat.
if (!dev) {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'main.log');
  // Log-Datei rotieren (max 2 MB)
  try {
    const stats = fs.statSync(logPath);
    if (stats.size > 2 * 1024 * 1024) {
      fs.renameSync(logPath, logPath + '.old');
    }
  } catch { /* Datei existiert noch nicht */ }
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n--- App Start: ${new Date().toISOString()} ---\n`);
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  const origInfo = console.info;
  const origDebug = console.debug;
  const logFn = (prefix, orig, ...args) => {
    const msg = `[${new Date().toISOString()}] ${prefix} ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`;
    logStream.write(msg);
    orig.apply(console, args);
  };
  console.log = (...args) => logFn('LOG', origLog, ...args);
  console.info = (...args) => logFn('LOG', origInfo, ...args);
  console.error = (...args) => logFn('ERR', origError, ...args);
  console.warn = (...args) => logFn('WRN', origWarn, ...args);
  console.debug = (...args) => logFn('DBG', origDebug, ...args);
  // Unhandled errors ebenfalls loggen
  process.on('uncaughtException', (err) => {
    logFn('FATAL', origError, 'Uncaught Exception:', err.stack || err.message);
  });
  process.on('unhandledRejection', (reason) => {
    logFn('FATAL', origError, 'Unhandled Rejection:', reason?.stack || reason);
  });
  console.log('Log-Datei:', logPath);
}
const appPath = app.getAppPath();
const PROD_PORT = 3000;

// In Production: .env manuell laden, da Next.js die Datei relativ zu cwd sucht,
// aber cwd in der paketierten App nicht das App-Verzeichnis ist.
// Die .env liegt im asar.unpacked-Verzeichnis (via asarUnpack konfiguriert).
if (!dev) {
  const dotenvPaths = [
    path.join(appPath + '.unpacked', '.env'),
    path.join(appPath, '.env'),
  ];
  for (const envPath of dotenvPaths) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      console.log('.env geladen von:', envPath);
      break;
    }
  }
}

let mainWindow = null;
let stopIntercept = null;

// In Production: protocol.handle wrappen, damit http://localhost/ (ohne Port)
// automatisch auf http://localhost:3000/ normalisiert wird.
// Clerk und andere Middleware erzeugen Redirect-URLs ohne expliziten Port,
// was den URL-Vergleich in next-electron-rsc bricht.
if (!dev) {
  const originalHandle = protocol.handle.bind(protocol);
  protocol.handle = function (scheme, handler) {
    if (scheme === 'http') {
      return originalHandle(scheme, (request) => {
        const url = new URL(request.url);
        let rewritten = false;

        // 127.0.0.1 -> localhost umschreiben: getSelfBaseUrl() liefert 127.0.0.1,
        // aber next-electron-rsc's Interceptor akzeptiert nur localhost
        if (url.hostname === '127.0.0.1') {
          url.hostname = 'localhost';
          rewritten = true;
        }

        // localhost ohne Port -> Port ergaenzen (Clerk-Redirects lassen Port weg)
        if (url.hostname === 'localhost' && !url.port) {
          url.port = String(PROD_PORT);
          rewritten = true;
        }

        if (rewritten) {
          return handler(new Request(url.toString(), request));
        }
        return handler(request);
      });
    }
    return originalHandle(scheme, handler);
  };
}

// FETCH-BRIDGE: In Production nutzt next-electron-rsc protocol.handle() statt
// eines echten HTTP-Servers. Node.js fetch() (aus Worker, LocalStorageProvider etc.)
// macht aber echte TCP-Verbindungen und erreicht den Protocol-Handler nicht.
// Lösung: globalThis.fetch für localhost-Requests durch Electrons net.fetch()
// ersetzen, das den protocol.handle()-Interceptor durchläuft.
if (!dev) {
  const { net } = require('electron');
  const _originalFetch = globalThis.fetch;
  globalThis.fetch = function electronFetchBridge(input, init) {
    let url;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else if (input && typeof input === 'object' && 'url' in input) url = input.url;

    const isLocalhost = url && (
      url.startsWith(`http://localhost:${PROD_PORT}`) ||
      url.startsWith(`http://localhost/`) ||
      url.startsWith(`http://127.0.0.1:${PROD_PORT}`)
    );

    if (isLocalhost) {
      // 127.0.0.1 -> localhost normalisieren: next-electron-rsc's protocol handler
      // und Session-Cookies erwarten localhost, nicht 127.0.0.1
      if (url && url.includes('127.0.0.1')) {
        const normalized = url.replace(`http://127.0.0.1:${PROD_PORT}`, `http://localhost:${PROD_PORT}`);
        if (typeof input === 'string') {
          return net.fetch(normalized, init);
        }
        return net.fetch(new Request(normalized, input), init);
      }
      return net.fetch(input, init);
    }
    return _originalFetch.call(globalThis, input, init);
  };
  console.log('[FetchBridge] localhost-Requests werden über Electron net.fetch geleitet');
}

// createHandler wird VOR app.ready initialisiert (wegen registerSchemesAsPrivileged).
// Da next-electron-rsc ein ESM-Modul ist, muss es dynamisch importiert werden.
const handlerPromise = import('next-electron-rsc').then(({ createHandler }) => {
  return createHandler({
    dev,
    dir: appPath,
    protocol,
    port: dev ? 3000 : PROD_PORT,
    debug: dev,
  });
});

async function createWindow() {
  console.log('[Window] createWindow() gestartet');
  const { createInterceptor, localhostUrl } = await handlerPromise;
  console.log('[Window] Handler bereit, localhostUrl:', localhostUrl);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    // Fenster erst nach erfolgreichem Laden sichtbar machen
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Fenster anzeigen sobald Renderer bereit ist (verhindert weisses Flackern)
  mainWindow.once('ready-to-show', () => {
    console.log('[Window] ready-to-show Event empfangen');
    mainWindow.show();
  });

  // Renderer-Fehler loggen (Console-Ausgaben und Crashes)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Window] did-fail-load:', { errorCode, errorDescription, validatedURL });
    // Fenster trotzdem anzeigen, damit der Benutzer etwas sieht
    mainWindow.show();
  });
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Window] render-process-gone:', details);
  });
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // Nur Warnungen (2) und Fehler (3) loggen
      console.log(`[Renderer ${level === 3 ? 'ERR' : 'WRN'}] ${message} (${sourceId}:${line})`);
    }
  });

  // Dev: wartet bis der Next.js Dev-Server bereit ist.
  // Prod: aktiviert den Protocol-Interceptor (kein offener Port).
  stopIntercept = await createInterceptor({
    session: mainWindow.webContents.session,
  });
  console.log('[Window] Interceptor erstellt');

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopIntercept?.();
    stopIntercept = null;
  });

  // URL laden (in Dev: http://localhost:3000, in Prod: interne Protocol-URL)
  console.log('[Window] Lade URL:', localhostUrl + '/');
  try {
    await mainWindow.loadURL(localhostUrl + '/');
    console.log('[Window] URL erfolgreich geladen');
  } catch (err) {
    console.error('[Window] loadURL fehlgeschlagen:', err.message);
    // Fenster trotzdem anzeigen
    mainWindow.show();
  }

  // Anwendungs-Menü mit Versionsinformation erstellen
  const appVersion = app.getVersion();
  const menuTemplate = [
    {
      label: 'Datei',
      submenu: [
        { role: 'quit', label: 'Beenden' },
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'selectAll', label: 'Alles auswählen' },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { role: 'forceReload', label: 'Erzwungenes Neu laden' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Standardgröße' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' },
      ],
    },
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize', label: 'Minimieren' },
        { role: 'close', label: 'Schließen' },
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: `Version ${appVersion}`,
          enabled: false,
        },
        { type: 'separator' },
        {
          label: 'Über Knowledge Scout',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Über Knowledge Scout',
              message: `Knowledge Scout v${appVersion}`,
              detail: [
                `Version: ${appVersion}`,
                `Electron: ${process.versions.electron}`,
                `Node.js: ${process.versions.node}`,
                `Chrome: ${process.versions.chrome}`,
                '',
                '© bCommonsLAB',
              ].join('\n'),
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Nach Updates suchen...',
          click: () => {
            if (dev) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Updates',
                message: 'Update-Prüfung ist im Development-Modus deaktiviert.',
                buttons: ['OK'],
              });
              return;
            }
            autoUpdater.manualCheck = true;
            autoUpdater.checkForUpdates().catch((err) => {
              console.log('[AutoUpdater] Manueller Check fehlgeschlagen:', err.message);
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Update-Fehler',
                message: 'Update-Prüfung fehlgeschlagen.',
                detail: err.message,
                buttons: ['OK'],
              });
            });
          },
        },
      ],
    },
  ];

  // Im Dev-Modus: DevTools-Eintrag in Ansicht hinzufügen
  if (dev) {
    const viewMenu = menuTemplate.find(m => m.label === 'Ansicht');
    viewMenu.submenu.push(
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Entwicklertools' },
    );
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // DevTools im Development-Modus automatisch oeffnen
  if (dev) {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Auto-Update-Pruefung via GitHub Releases.
 * Nur im Production-Modus aktiv (nicht im Dev).
 */
function initAutoUpdater() {
  if (dev) return;

  const currentVersion = app.getVersion();
  console.log(`[AutoUpdater] Initialisiert – installierte Version: ${currentVersion}`);

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Flag um manuelle vs. automatische Prüfung zu unterscheiden.
  // Wird als Eigenschaft auf autoUpdater gesetzt, damit der Menü-Handler
  // aus createWindow() darauf zugreifen kann.
  autoUpdater.manualCheck = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Suche nach Updates...');
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Kein Update verfuegbar. Aktuelle Version:', currentVersion,
      '– Remote-Version:', info?.version || 'unbekannt');
    if (autoUpdater.manualCheck) {
      autoUpdater.manualCheck = false;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Kein Update verfügbar',
        message: 'Sie verwenden bereits die neueste Version.',
        detail: `Aktuelle Version: ${currentVersion}`,
        buttons: ['OK'],
      });
    }
  });

  autoUpdater.on('update-available', (info) => {
    autoUpdater.manualCheck = false;
    console.log('[AutoUpdater] Neue Version verfuegbar:', info.version,
      '(aktuell:', currentVersion + ')');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update verfuegbar',
      message: `Eine neue Version (${info.version}) ist verfuegbar.`,
      detail: 'Moechten Sie das Update jetzt herunterladen?',
      buttons: ['Jetzt herunterladen', 'Spaeter'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        console.log('[AutoUpdater] Download gestartet durch Benutzer');
        autoUpdater.downloadUpdate();
      } else {
        console.log('[AutoUpdater] Download vom Benutzer verschoben');
      }
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download: ${Math.round(progress.percent)}%`
      + ` (${Math.round(progress.transferred / 1024 / 1024)}MB`
      + ` / ${Math.round(progress.total / 1024 / 1024)}MB)`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update heruntergeladen:', info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update bereit',
      message: `Version ${info.version} wurde heruntergeladen.`,
      detail: 'Die App wird jetzt neu gestartet, um das Update zu installieren.',
      buttons: ['Jetzt neu starten', 'Spaeter'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.log('[AutoUpdater] Fehler:', err.message);
    if (err.stack) {
      console.log('[AutoUpdater] Stack:', err.stack);
    }
  });

  // Automatische Prüfung 5 Sekunden nach App-Start
  setTimeout(() => {
    console.log('[AutoUpdater] Starte automatischen Update-Check...');
    autoUpdater.checkForUpdates()
      .then((result) => {
        console.log('[AutoUpdater] Check abgeschlossen.',
          'Update-Info:', result?.updateInfo?.version || 'keine');
      })
      .catch((err) => {
        console.log('[AutoUpdater] Check fehlgeschlagen:', err.message);
      });
  }, 5000);
}

app.on('ready', async () => {
  // IPC-Handler für Version-Abfrage aus dem Renderer-Prozess
  ipcMain.handle('get-app-version', () => app.getVersion());

  await createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  app.quit();
});

// macOS: Fenster neu erstellen wenn Dock-Icon geklickt wird
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && !mainWindow) {
    createWindow();
  }
});
