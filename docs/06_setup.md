# Entwickler Setup Guide

## Lokales Setup

### Systemvoraussetzungen
- Node.js >= 18
- npm >= 9 (⚠️ **WICHTIG**: Verwende npm statt pnpm für Electron-Builds)
- Git

### Installation

```bash
# Repository klonen
git clone [repository-url]
cd [projekt-verzeichnis]

# Dependencies installieren (npm verwenden!)
npm install

# Entwicklungsserver starten
npm run dev
```

### Entwicklungsumgebung

```bash
# Entwicklungsserver
npm run dev         # Startet den Server auf http://localhost:3000

# Linting
npm run lint        # Code-Qualität prüfen

# TypeScript Check
npm run tsc         # Typ-Checking durchführen
```

## Electron Setup (Desktop App)

### ⚠️ Kritische Electron-Konfiguration

**WICHTIG**: Diese Anwendung verwendet Next.js 15.2.3+ mit Electron. Es gibt spezielle Konfigurationsanforderungen:

#### 1. Package Manager: npm statt pnpm
```bash
# ❌ NICHT verwenden
pnpm install

# ✅ RICHTIG verwenden
npm install
```

**Grund**: pnpm's symlink-Struktur ist inkompatibel mit Next.js standalone builds in Electron.

#### 2. Next.js Konfiguration
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',  // WICHTIG für Electron
  experimental: {
    esmExternals: 'loose'  // Für Electron-Kompatibilität
  }
}
```

#### 3. Electron Builder Konfiguration
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
    ],
    "win": {
      "target": "nsis"
    },
    "mac": {
      "target": "dmg"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

### Electron Build-Prozess

#### 1. Next.js Build
```bash
# Next.js standalone build erstellen
npm run build
```

**Erwartete Ausgabe**:
- `standalone/` Ordner mit der kompilierten App
- `standalone/node_modules/` mit allen Dependencies

#### 2. Electron Build
```bash
# Electron App bauen
npm run electron:build
```

**Build-Artefakte**:
- `dist/` - Fertige Electron-App
- `app.asar` - Gepackte Anwendung
- `app.asar.unpacked/` - Ungepackte Dateien (node_modules)

### Electron-spezifische Umgebungsvariablen

```env
# Electron-spezifische Variablen
ELECTRON_IS_DEV=false
NODE_ENV=production

# Next.js für Electron
NEXT_TELEMETRY_DISABLED=1
```

## Umgebungsvariablen

Kopiere `.env.example` zu `.env.local` und konfiguriere:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Frontend URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Storage Provider Konfiguration
STORAGE_ROOT=/absolute/path/to/storage    # Für lokalen FileSystem Provider
SHAREPOINT_CLIENT_ID=...                  # Für SharePoint Provider
SHAREPOINT_CLIENT_SECRET=...
GOOGLE_DRIVE_CLIENT_ID=...                # Für Google Drive Provider
GOOGLE_DRIVE_CLIENT_SECRET=...
```

## Build-Prozess

### Web-Build (ohne Electron)

```bash
# Build erstellen
npm run build

# Build testen
npm run start
```

### Electron-Build (Desktop App)

```bash
# 1. Next.js standalone build
npm run build

# 2. Electron app bauen
npm run electron:build

# 3. App testen (Windows)
./dist/win-unpacked/Knowledge Scout.exe
```

Der Electron-Build-Prozess:
1. Next.js standalone build mit `output: 'standalone'`
2. node_modules werden in `standalone/` kopiert
3. Electron packt alles in `app.asar`
4. `standalone/` wird als `asarUnpack` markiert
5. App wird als ausführbare Datei erstellt

### Build-Artefakte
- `.next/` - Kompilierte Next.js Anwendung
- `standalone/` - Standalone Next.js App mit node_modules
- `dist/` - Fertige Electron-App
- `public/` - Statische Assets

## Troubleshooting

### Häufige Electron-Probleme

#### 1. "Cannot find module 'next'" Fehler
**Symptom**: Electron-App startet nicht, Fehler beim Laden von Next.js

**Lösung**:
```bash
# 1. Auf npm umstellen
rm -rf node_modules pnpm-lock.yaml
npm install

# 2. Build neu erstellen
npm run build
npm run electron:build

# 3. Prüfen ob node_modules in standalone/ vorhanden
ls standalone/node_modules/next
```

#### 2. Module Resolution Probleme
**Symptom**: Verschiedene "Cannot find module" Fehler

**Lösung**:
```javascript
// electron/main.js - Module Resolution anpassen
const path = require('path');

// Standalone-Pfad korrekt setzen
const standalonePath = path.join(__dirname, 'standalone');
process.env.NODE_PATH = standalonePath;
```

#### 3. pnpm Kompatibilitätsprobleme
**Symptom**: Build funktioniert, aber Runtime-Fehler

**Lösung**: Komplett auf npm umstellen
```bash
# Alle pnpm-Artefakte entfernen
rm -rf node_modules pnpm-lock.yaml .pnpm-store

# Mit npm neu installieren
npm install
```

### Build-Verifikation

#### 1. Standalone-Ordner prüfen
```bash
# Nach npm run build
ls -la standalone/
# Sollte enthalten: node_modules/, .next/, package.json

ls -la standalone/node_modules/
# Sollte enthalten: next, @next, react, etc.
```

#### 2. Electron-Build prüfen
```bash
# Nach npm run electron:build
ls -la dist/win-unpacked/
# Sollte enthalten: app.asar, app.asar.unpacked/

ls -la dist/win-unpacked/app.asar.unpacked/standalone/
# Sollte node_modules enthalten
```

## Deployment

### Web-Deployment

#### 1. Vercel (Empfohlen)
```bash
# Vercel CLI installieren
npm install -g vercel

# Deployment
vercel
```

#### 2. Standalone Server
```bash
# Build erstellen
npm run build

# Server starten
NODE_ENV=production npm run start
```

### Electron-Deployment

#### 1. Windows
```bash
# Build erstellen
npm run electron:build

# Installer finden
ls dist/*.exe
```

#### 2. macOS
```bash
# Build erstellen
npm run electron:build

# DMG finden
ls dist/*.dmg
```

#### 3. Linux
```bash
# Build erstellen
npm run electron:build

# AppImage finden
ls dist/*.AppImage
```

### Deployment-Checkliste
- [ ] npm statt pnpm verwendet
- [ ] Next.js standalone build erfolgreich
- [ ] node_modules in standalone/ vorhanden
- [ ] Electron build erfolgreich
- [ ] App.asar.unpacked enthält standalone/
- [ ] Umgebungsvariablen gesetzt
- [ ] Storage Provider konfiguriert
- [ ] Authentifizierung eingerichtet

## Monitoring & Wartung

### Logs
- Application Logs: `[deployment-path]/logs/`
- Build Logs: `.next/build-manifest.json`
- Electron Logs: `%APPDATA%/Knowledge Scout/logs/` (Windows)
- Server Logs: Via Deployment-Platform

### Health Checks
- `/api/health` - API Status
- `/api/storage/health` - Storage Provider Status

### Backup
- Regelmäßige Backups der Datenbank
- Storage Provider Synchronisation
- Umgebungsvariablen sichern

## Best Practices

### Electron-Entwicklung
1. **Immer npm verwenden** - pnpm verursacht Module-Resolution-Probleme
2. **Standalone-Build** - Next.js muss mit `output: 'standalone'` konfiguriert sein
3. **asarUnpack** - standalone/ Ordner muss ausgepackt werden
4. **Module-Pfade** - Korrekte Pfad-Auflösung in main.js implementieren

### Build-Optimierung
1. **Dependency-Audit** - Regelmäßig `npm audit` ausführen
2. **Bundle-Größe** - Unnötige Dependencies entfernen
3. **Code-Splitting** - Next.js automatisches Code-Splitting nutzen
4. **Asset-Optimierung** - Bilder und statische Assets optimieren 