# Entwickler Setup Guide

## Lokales Setup

### Systemvoraussetzungen
- Node.js >= 18
- pnpm >= 9.15
- Git

### Installation

```bash
# Repository klonen
git clone [repository-url]
cd [projekt-verzeichnis]

# Dependencies installieren
pnpm install

# Entwicklungsserver starten
pnpm dev
```

### Entwicklungsumgebung

```bash
# Entwicklungsserver
pnpm dev         # Startet den Server auf http://localhost:3000

# Linting
pnpm lint        # Code-Qualität prüfen

# TypeScript Check
pnpm tsc         # Typ-Checking durchführen
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

### Produktions-Build

```bash
# Build erstellen
pnpm build

# Build testen
pnpm start
```

Der Build-Prozess:
1. TypeScript Kompilierung
2. Code-Optimierung
3. Asset-Optimierung
4. Statische Seiten-Generierung

### Build-Artefakte
- `.next/` - Kompilierte Anwendung
- `public/` - Statische Assets
- `node_modules/.pnpm` - Dependencies

## Deployment

### Vorbereitungen
1. Umgebungsvariablen setzen
2. Produktions-Build erstellen
3. Dependencies installieren

### Deployment-Optionen

#### 1. Vercel (Empfohlen)
```bash
# Vercel CLI installieren
pnpm add -g vercel

# Deployment
vercel
```

#### 2. Standalone Server
```bash
# Build erstellen
pnpm build

# Server starten
NODE_ENV=production pnpm start
```

#### 3. Docker
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm build
CMD ["pnpm", "start"]
```

### Deployment-Checkliste
- [ ] Umgebungsvariablen gesetzt
- [ ] Produktions-Build erfolgreich
- [ ] Dependencies installiert
- [ ] Storage Provider konfiguriert
- [ ] Authentifizierung eingerichtet
- [ ] SSL/TLS konfiguriert
- [ ] Monitoring eingerichtet

## Monitoring & Wartung

### Logs
- Application Logs: `[deployment-path]/logs/`
- Build Logs: `.next/build-manifest.json`
- Server Logs: Via Deployment-Platform

### Health Checks
- `/api/health` - API Status
- `/api/storage/health` - Storage Provider Status

### Backup
- Regelmäßige Backups der Datenbank
- Storage Provider Synchronisation
- Umgebungsvariablen sichern 