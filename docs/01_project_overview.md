# Knowledge Scout Projektübersicht

## Projektstruktur

### Hauptverzeichnisse

- `/app`: Next.js 13+ App Router Verzeichnis
  - `/api`: API-Routen
  - `/library`: Bibliotheks-bezogene Komponenten
  - `layout.tsx`: Haupt-Layout-Komponente
  - `page.tsx`: Hauptseiten-Komponente

- `/src`: Quellcode-Verzeichnis
  - `/components`: Wiederverwendbare React-Komponenten
  - `/hooks`: Custom React Hooks
  - `/lib`: Utility-Funktionen und Bibliotheken
  - `/styles`: Styling-Dateien
  - `/types`: TypeScript Typ-Definitionen
  - `middleware.ts`: Next.js Middleware

- `/docs`: Projektdokumentation
- `/types`: Globale TypeScript Typ-Definitionen

### Wichtige Konfigurationsdateien

- `package.json`: NPM-Paket-Konfiguration und Projektabhängigkeiten
- `pnpm-lock.yaml`: PNPM Dependency Lock-Datei
- `next.config.js`: Next.js Konfiguration
- `tsconfig.json`: TypeScript Konfiguration
- `tailwind.config.ts`: Tailwind CSS Konfiguration
- `postcss.config.js`: PostCSS Konfiguration
- `components.json`: Komponenten-Konfiguration
- `.env`: Umgebungsvariablen (nicht versioniert)
- `.env.example`: Beispiel für Umgebungsvariablen
- `.gitignore`: Git-Ignore Konfiguration
- `.cursorrules`: Cursor-spezifische Regeln

## Architektur und Beziehungen

Das Projekt basiert auf Next.js 13+ mit dem App Router und verwendet:

1. **Frontend:**
   - React mit TypeScript
   - Tailwind CSS für Styling
   - Komponenten-basierte Architektur in `/src/components`

2. **Backend/API:**
   - Next.js API Routes in `/app/api`
   - Middleware für Request-Handling

3. **Daten und Logik:**
   - Custom Hooks für wiederverwendbare Logik
   - Utility-Funktionen in `/src/lib`
   - Typisierung durch TypeScript

Die Anwendung folgt den Best Practices von Next.js 13+ mit einer klaren Trennung von:
- Seitenkomponenten (`/app`)
- Wiederverwendbaren Komponenten (`/src/components`)
- Business-Logik (`/src/lib`)
- API-Endpunkten (`/app/api`)
