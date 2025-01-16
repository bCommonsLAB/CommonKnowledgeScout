# Knowledge Scout - Technische Architektur

## Haupttechnologien

### Frontend Framework
- Next.js 14.0.4 mit App Router
- React 18
- TypeScript 5
- Tailwind CSS 3.3.0 für Styling

### UI Komponenten
- Radix UI für grundlegende UI-Komponenten
- shadcn/ui als UI-Komponenten-System
- Lucide React für Icons
- Geist für Typografie
- next-themes für Dark/Light Mode

### State Management & Datenfluss
- Jotai für globales State Management
- React Hook Form für Formularverarbeitung
- Zod für Schema Validierung

### Markdown Processing
- react-markdown für Markdown Rendering
- rehype-plugins für Code-Highlighting und Sanitization
- remark-plugins für Markdown Erweiterungen (GFM, Frontmatter)

### Datenvisualisierung
- Recharts für Diagramme und Visualisierungen
- react-resizable-panels für flexible Layouts

## Authentifizierung
- Clerk für Benutzerauthentifizierung und -verwaltung

## Build und Development Setup

### Development Tools
- TypeScript für statische Typisierung
- ESLint für Code-Qualität
- Autoprefixer und PostCSS für CSS-Processing
- PNPM als Package Manager

### Scripts
- `dev`: Next.js Entwicklungsserver
- `build`: Produktions-Build
- `start`: Produktionsserver starten
- `lint`: Code-Linting

## API-Integration

Das Projekt nutzt:
- Next.js API Routes für Backend-Funktionalität
- Middleware für Request-Handling
- TypeScript Types für API-Typsicherheit

## Datenfluss

1. **State Management:**
   - Jotai für globalen Zustand
   - React Hooks für lokalen Komponenten-Zustand
   - Form State Management durch React Hook Form

2. **Datenvalidierung:**
   - Zod für Schema-Validierung
   - TypeScript für statische Typsicherheit

3. **API-Kommunikation:**
   - Next.js API Routes für Backend-Kommunikation
   - Typisierte API-Responses