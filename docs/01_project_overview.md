# Projektübersicht

## Projektstruktur

### Hauptverzeichnisse

- `/app` - Next.js App Router Verzeichnis
  - `/api` - API-Routen
  - `/library` - Bibliotheks-Funktionalität
  - `/mail` - E-Mail-bezogene Funktionen
  - `/tasks` - Aufgabenverwaltung
  - Weitere Funktionsmodule: cards, dashboard, forms, music, playground

- `/src` - Quellcode-Hauptverzeichnis
  - `/components` - React-Komponenten
    - `/library` - Bibliotheks-bezogene Komponenten
    - `/ui` - Basis-UI-Komponenten (shadcn/ui)
  - `/lib` - Kernfunktionalität
    - `/storage` - Speicher-Management und Dateisystem
  - `/types` - TypeScript Typdefinitionen
  - `/hooks` - React Hooks
  - `/styles` - Styling und Tailwind-Konfiguration

### Wichtige Konfigurationsdateien

- `package.json` - Projekt-Konfiguration und Abhängigkeiten
- `pnpm-lock.yaml` - Exakte Abhängigkeitsversionen (pnpm)
- `next.config.js` - Next.js Konfiguration
- `tailwind.config.ts` - Tailwind CSS Konfiguration
- `tsconfig.json` - TypeScript Konfiguration
- `components.json` - shadcn/ui Komponenten-Konfiguration
- `.env` / `.env.local` / `.env.example` - Umgebungsvariablen

### Kernkomponenten

#### Storage System
- `src/lib/storage/storage-factory.ts`
- `src/lib/storage/filesystem-provider.ts`
- `src/lib/storage/filesystem-client.ts`
- `src/lib/storage/storage-service.ts`

#### Bibliotheks-Komponenten
- `src/components/library/file-explorer.tsx`
- `src/components/library/file-list.tsx`
- `src/components/library/file-preview.tsx`
- `src/components/library/library.tsx`

#### UI-Komponenten
- `src/components/ui/tree.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/alert.tsx`

## Technologie-Stack

- Next.js mit App Router
- TypeScript
- Tailwind CSS
- shadcn/ui Komponenten-Bibliothek
- pnpm als Paketmanager 