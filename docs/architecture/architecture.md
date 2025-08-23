---
title: Technische Architektur
---

# Technische Architektur

## Haupttechnologien

### Frontend Framework
- **Next.js 14** (App Router)
  - React 18 als Basis
  - Strikte TypeScript-Integration
  - Server Components als Standard
  - Routing über App Router

### UI und Styling
- **Tailwind CSS** als Styling-Framework
  - Mit PostCSS und Autoprefixer
  - Tailwind Animations Plugin
  - Aspect Ratio Plugin
- **shadcn/ui** als Komponenten-Framework
  - Basiert auf Radix UI Primitives
  - Vollständig typisiert
  - Themefähig via `next-themes`
- **Geist** für Typografie

### State Management
- **Jotai** für atomaren globalen Zustand
- **React Hook Form** für Formular-Management
  - Mit Zod für Schema-Validierung
- **TanStack Table** für Tabellen-State

### Authentifizierung
- **Clerk** für Benutzer-Authentifizierung und -Verwaltung

## Datenfluss

### Client-seitig
- Komponenten-lokaler State via React Hooks
- Globaler State via Jotai Atoms
- Formular-State via React Hook Form
- Authentifizierungs-State via Clerk

### Server-seitig
- Server Components für direkte Datenbankzugriffe
- API Routes für client-seitige Anfragen
- Filesystem Storage System für Dateioperationen

## API-Integration

### Interne APIs
- Next.js API Routes unter `/app/api`
- Filesystem API für Speicherverwaltung
  - `storage-service` als Abstraktionsschicht
  - `filesystem-provider` für konkrete Implementierung

### Externe APIs
- Unterstützung für Remote-Bilder von:
  - images.unsplash.com
  - youtube.com
  - ytimg.com

## Build & Deploy Setup

### Development
- `pnpm` als Paketmanager
- TypeScript für statische Typisierung
- ESLint für Code-Qualität
- Entwicklungsserver via `next dev`

### Build-Prozess
- Produktions-Build via `next build`
- Strict Mode aktiviert
- TypeScript-Kompilierung
- PostCSS-Verarbeitung für Tailwind

### Produktions-Setup
- Server-Start via `next start`
- Optimierte Builds
- Image Optimization
- Konfigurierte Remote Patterns für Bilder

## Zusätzliche Features

### Markdown-Verarbeitung
- React Markdown für Rendering
- Syntax Highlighting via:
  - highlight.js
  - react-syntax-highlighter
  - rehype-pretty-code mit shiki
- Unterstützung für:
  - Frontmatter
  - GitHub Flavored Markdown
  - Sanitization

### UI/UX Features
- Responsive Design
- Dark Mode Support
- Toast Notifications
- Resizable Panels
- Verschiedene interaktive Komponenten (Dialoge, Menüs, etc.)


