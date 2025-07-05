# Electron Troubleshooting Guide

## Übersicht

Dieser Guide dokumentiert die häufigsten Probleme bei der Electron-Entwicklung mit Next.js 15.2.3+ und deren Lösungen.

## Kritische Probleme

### 1. "Cannot find module 'next'" Fehler

**Symptom**:
```
Error: Cannot find module 'next'
Require stack:
- C:\Users\...\app.asar\standalone\server.js
```

**Ursache**: 
- pnpm's symlink-Struktur ist inkompatibel mit Next.js standalone builds
- Module-Resolution-Pfade sind falsch konfiguriert
- node_modules sind nicht korrekt in standalone/ kopiert

**Lösung**:

#### Schritt 1: Package Manager wechseln
```bash
# Alle pnpm-Artefakte entfernen
rm -rf node_modules pnpm-lock.yaml .pnpm-store

# Mit npm neu installieren
npm install
```

#### Schritt 2: Build neu erstellen
```bash
# Next.js standalone build
npm run build

# Prüfen ob node_modules vorhanden
ls standalone/node_modules/next
```

#### Schritt 3: Electron main.js anpassen
```javascript
// electron/main.js
const path = require('path');

// Standalone-Pfad korrekt setzen
const standalonePath = path.join(__dirname, 'standalone');
process.env.NODE_PATH = standalonePath;

// Module-Resolution verbessern
require('module').globalPaths.push(standalonePath);
```

#### Schritt 4: Electron Builder Konfiguration
```json
// package.json
{
  "build": {
    "asarUnpack": [
      "standalone/**/*"
    ],
    "extraResources": [
      {
        "from": "standalone",
        "to": "standalone"
      }
    ]
  }
}
```

### 2. Module Resolution Probleme

**Symptom**:
```
Error: Cannot find module '@next/swc-win32-x64-msvc'
Error: Cannot find module 'react'
Error: Cannot find module 'react-dom'
```

**Lösung**:

#### Electron main.js Module-Resolution
```javascript
// electron/main.js
const path = require('path');
const { app } = require('electron');

// Standalone-Pfad setzen
const standalonePath = path.join(__dirname, 'standalone');

// Module-Resolution konfigurieren
process.env.NODE_PATH = standalonePath;
require('module').globalPaths.push(standalonePath);

// Next.js Server-Pfad
const serverPath = path.join(standalonePath, 'server.js');

// Server starten
const server = require(serverPath);
```

#### Build-Script anpassen
```json
// package.json
{
  "scripts": {
    "electron:build": "npm run build && electron-builder",
    "postbuild": "cp -r node_modules standalone/"
  }
}
```

### 3. pnpm Kompatibilitätsprobleme

**Symptom**: Build funktioniert, aber Runtime-Fehler bei Module-Auflösung

**Grund**: pnpm erstellt symlinks statt flache node_modules-Struktur

**Lösung**: Komplett auf npm umstellen

```bash
# 1. Alle pnpm-Artefakte entfernen
rm -rf node_modules pnpm-lock.yaml .pnpm-store

# 2. npm install
npm install

# 3. Build neu erstellen
npm run build
npm run electron:build
```

## Build-Probleme

### 1. Standalone-Build fehlschlägt

**Symptom**: `npm run build` erstellt keinen standalone/ Ordner

**Lösung**:

#### Next.js Konfiguration prüfen
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // WICHTIG!
  experimental: {
    esmExternals: 'loose'
  }
}

module.exports = nextConfig
```

#### Dependencies prüfen
```bash
# Next.js Version prüfen
npm list next

# Sollte 15.2.3+ sein
```

### 2. Electron Builder Fehler

**Symptom**: `npm run electron:build` schlägt fehl

**Lösung**:

#### Electron Builder Konfiguration
```json
// package.json
{
  "build": {
    "appId": "com.yourcompany.knowledge-scout",
    "productName": "Knowledge Scout",
    "directories": {
      "output": "dist"
    },
    "files": [
      "standalone/**/*",
      "public/**/*",
      "electron/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "standalone",
        "to": "standalone"
      }
    ],
    "asarUnpack": [
      "standalone/**/*"
    ]
  }
}
```

#### Build-Script anpassen
```json
// package.json
{
  "scripts": {
    "electron:build": "npm run build && electron-builder --win",
    "postbuild": "cp -r node_modules standalone/"
  }
}
```

## Runtime-Probleme

### 1. App startet nicht

**Symptom**: Electron-App öffnet sich nicht oder schließt sofort

**Debugging**:

#### Logs aktivieren
```javascript
// electron/main.js
const { app } = require('electron');

// Debug-Logs aktivieren
app.commandLine.appendSwitch('enable-logging');
app.commandLine.appendSwitch('v', '1');

// Fehlerbehandlung
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
```

#### Manueller Test
```bash
# App manuell starten
./dist/win-unpacked/Knowledge Scout.exe --enable-logging
```

### 2. Next.js Server startet nicht

**Symptom**: Electron-App öffnet sich, aber Next.js Server läuft nicht

**Lösung**:

#### Server-Pfad prüfen
```javascript
// electron/main.js
const path = require('path');
const fs = require('fs');

const standalonePath = path.join(__dirname, 'standalone');
const serverPath = path.join(standalonePath, 'server.js');

// Prüfen ob Server-Datei existiert
if (!fs.existsSync(serverPath)) {
  console.error('Server file not found:', serverPath);
  app.quit();
}

// Server starten
try {
  require(serverPath);
} catch (error) {
  console.error('Failed to start server:', error);
  app.quit();
}
```

## Verifikation und Tests

### 1. Build-Verifikation

#### Standalone-Ordner prüfen
```bash
# Nach npm run build
ls -la standalone/
# Sollte enthalten: node_modules/, .next/, package.json

ls -la standalone/node_modules/
# Sollte enthalten: next, @next, react, react-dom
```

#### Electron-Build prüfen
```bash
# Nach npm run electron:build
ls -la dist/win-unpacked/
# Sollte enthalten: app.asar, app.asar.unpacked/

ls -la dist/win-unpacked/app.asar.unpacked/standalone/
# Sollte node_modules enthalten
```

### 2. Runtime-Tests

#### App-Start testen
```bash
# App starten
./dist/win-unpacked/Knowledge Scout.exe

# Mit Debug-Logs
./dist/win-unpacked/Knowledge Scout.exe --enable-logging
```

#### Module-Verfügbarkeit testen
```javascript
// In electron/main.js
const path = require('path');

// Module-Pfade loggen
console.log('Standalone path:', path.join(__dirname, 'standalone'));
console.log('NODE_PATH:', process.env.NODE_PATH);

// Module-Verfügbarkeit testen
try {
  require('next');
  console.log('Next.js module found');
} catch (error) {
  console.error('Next.js module not found:', error);
}
```

## Best Practices

### 1. Package Manager
- **IMMER npm verwenden** für Electron-Projekte
- pnpm verursacht Module-Resolution-Probleme
- yarn kann auch funktionieren, aber npm ist am stabilsten

### 2. Build-Konfiguration
- Next.js `output: 'standalone'` ist obligatorisch
- `asarUnpack` für standalone/ Ordner
- `extraResources` für zusätzliche Dateien

### 3. Module-Resolution
- Korrekte Pfad-Setzung in main.js
- NODE_PATH Environment-Variable setzen
- Module.globalPaths verwenden

### 4. Debugging
- Logs aktivieren für bessere Fehlerdiagnose
- Manuelle Tests der Build-Artefakte
- Schrittweise Verifikation des Build-Prozesses

## Häufige Fehlermeldungen und Lösungen

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| `Cannot find module 'next'` | pnpm oder falsche Pfade | npm verwenden, Pfade prüfen |
| `Cannot find module '@next/swc-*'` | Platform-spezifische Module fehlen | node_modules in standalone/ kopieren |
| `App.asar is not a valid archive` | Build-Prozess fehlgeschlagen | Build neu starten |
| `Server file not found` | standalone/ nicht korrekt erstellt | Next.js Build prüfen |
| `Module resolution failed` | NODE_PATH nicht gesetzt | main.js Module-Resolution anpassen |

## Support und Debugging

### Debug-Modus aktivieren
```bash
# Entwicklung mit Debug-Logs
npm run dev

# Electron mit Debug-Logs
npm run electron:dev -- --enable-logging
```

### Logs sammeln
```bash
# Windows Logs
%APPDATA%/Knowledge Scout/logs/

# Console Logs
./dist/win-unpacked/Knowledge Scout.exe --enable-logging
```

### Community-Ressourcen
- [Electron Builder Documentation](https://www.electron.build/)
- [Next.js Standalone Documentation](https://nextjs.org/docs/app/building-your-application/deploying/standalone)
- [Electron + Next.js Examples](https://github.com/electron/electron/tree/main/docs/tutorial) 