# Next.js Mail & Dashboard Application

Eine moderne Web-Anwendung gebaut mit Next.js 14, die verschiedene UI-Komponenten und Funktionalitäten demonstriert.

## 🚀 Inhaltsverzeichnis

- [Features](#-features)
- [Technologie-Stack](#-technologie-stack)
- [Projektstruktur](#-projektstruktur)
- [Installation](#-installation)
- [Entwicklung](#-entwicklung)
- [Tests](#-tests)
- [Deployment](#-deployment)
- [Umgebungsvariablen](#-umgebungsvariablen)
- [Beiträge](#-beiträge)
- [Lizenz](#-lizenz)

## 🚀 Features

- Mail Interface
  - Vollständiges Mail-Interface mit Konversationsansicht
  - Echtzeit-Updates durch Server-Sent Events
  - Drag & Drop Dateianhänge
  - Intelligente Suche und Filterung

- Dashboard
  - Analytisches Dashboard mit interaktiven Diagrammen
  - Echtzeit-Statistiken und KPIs
  - Anpassbare Widgets
  - Export-Funktionalität

- Task Management
  - Kanban-Board mit Drag & Drop
  - Aufgabenverwaltung mit Prioritäten
  - Teamzuweisung und Tracking
  - Deadline-Management

- Weitere Features
  - Fortgeschrittene Formulare mit Validierung
  - AI-Playground Interface
  - Dark/Light Mode
  - Responsive Design für alle Geräte
  - Barrierefreiheit nach WCAG 2.1

## 🛠 Technologie-Stack

Core
- Framework: Next.js 14 (App Router)
- Sprache: TypeScript
- Package Manager: pnpm

UI & Styling
- CSS Framework: Tailwind CSS
- UI Components: 
  - Shadcn UI
  - Radix UI Primitives
- Icons: Lucide React
- Fonts: Geist Font Family

State Management & Data Handling
- Client State: Zustand
- Server State: TanStack Query
- Forms: React Hook Form + Zod
- URL State: nuqs

Visualisierung & Interaktivität
- Charting: Recharts
- Drag & Drop: @hello-pangea/dnd

Testing
- Unit Tests: Vitest
- E2E Tests: Playwright
- Component Tests: @testing-library/react

## 🏗 Projektstruktur 

src/
├── app/
│   ├── api/         # API Routes
│   ├── mail/        # Mail Funktionalität
│   └── tasks/       # Task Management
├── components/
│   ├── ui/          # Basis UI-Komponenten
│   ├── mail/        # Mail-bezogene Komponenten
│   │   └── data/    # Mail-Daten & Logik
│   ├── tasks/       # Task-Management Komponenten
│   └── forms/       # Formular-Komponenten
├── lib/             # Utilities und Hilfsfunktionen
├── hooks/           # Custom React Hooks
├── styles/          # Globale Styles
└── types/           # TypeScript Typdefinitionen

## 💻 Installation

1. Repository klonen:
   git clone https://github.com/username/project-name.git
   cd project-name

2. Abhängigkeiten installieren:
   pnpm install

3. Umgebungsvariablen konfigurieren:
   cp .env.example .env.local

4. Entwicklungsserver starten:
   pnpm dev

## 🔧 Entwicklung

Scripts:
- pnpm dev - Entwicklungsserver starten
- pnpm build - Produktions-Build erstellen
- pnpm start - Produktions-Build starten
- pnpm test - Tests ausführen
- pnpm lint - Code-Linting durchführen
- pnpm format - Code formatieren

