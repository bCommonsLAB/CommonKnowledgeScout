# Next.js Document Management System

Ein modernes, erweiterbares Dokumentenmanagementsystem, gebaut mit Next.js 14, TypeScript und Tailwind CSS. Das System ermöglicht die einheitliche Verwaltung von Dokumenten über verschiedene Storage-Provider hinweg.

## ✨ Hauptfunktionen

- 📁 **Multi-Provider Storage System**
  - Lokales Dateisystem
  - SharePoint Integration (vorbereitet)
  - Google Drive Integration (vorbereitet)
  - OneDrive Integration (vorbereitet)

- 🔍 **Erweiterte Dokumentenverwaltung**
  - Hierarchische Ordnerstruktur
  - Datei-Vorschau
  - Metadaten-Verwaltung
  - Volltextsuche

- 👥 **Benutzer & Berechtigungen**
  - Rollenbasierte Zugriffssteuerung
  - Benutzer- und Gruppenverwaltung
  - Feingranulare Berechtigungen

- 🛠 **Technische Features**
  - Modern UI mit Tailwind & shadcn/ui
  - TypeScript & Next.js 14
  - Server Components
  - API Routes

## 🚀 Quick Start

### Web-Anwendung
```bash
# Repository klonen
git clone [repository-url]
cd [projekt-verzeichnis]

# Dependencies installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env.local
# .env.local anpassen

# Entwicklungsserver starten
npm run dev
```

Die Anwendung ist nun unter `http://localhost:3000` verfügbar.

### Desktop-Anwendung (Electron)
```bash
# Dependencies installieren
npm install

# Electron-App bauen
npm run build
npm run electron:build

# App starten (Windows)
./dist/win-unpacked/Knowledge Scout.exe
```

⚠️ **Wichtig**: Verwende npm statt pnpm für Electron-Builds!

## 📚 Dokumentation

Detaillierte Dokumentation finden Sie in den folgenden Bereichen:

### Architektur & Setup
- [Projektübersicht](docs/01_project_overview.md)
- [Technische Architektur](docs/02_architecture.md)
- [Kernkomponenten](docs/03_core_components.md)
- [Storage Provider System](docs/04_storage-provider.md)

### Benutzer & Features
- [Funktionen und Benutzergruppen](docs/05_features.md)
- [Entwickler Setup Guide](docs/06_setup.md)
- [API Dokumentation](docs/07_api.md)

### Electron & Troubleshooting
- [Electron Troubleshooting Guide](docs/electron-troubleshooting.md)

## 🛠 Technologie-Stack

- **Frontend**: Next.js 15.2.3, React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: Jotai, React Hook Form
- **Auth**: Clerk
- **Desktop**: Electron
- **Build**: npm (⚠️ pnpm nicht für Electron-Builds)

## 📋 Systemanforderungen

- Node.js >= 18
- npm >= 9 (⚠️ pnpm nicht für Electron-Builds)
- Git

## 🤝 Beitragen

1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/AmazingFeature`)
3. Änderungen committen (`git commit -m 'Add some AmazingFeature'`)
4. Branch pushen (`git push origin feature/AmazingFeature`)
5. Pull Request erstellen

## 📝 Lizenz

Dieses Projekt ist unter der MIT Lizenz lizenziert - siehe die [LICENSE](LICENSE) Datei für Details.

## 🙏 Danksagungen

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Clerk](https://clerk.dev/)
- [Radix UI](https://www.radix-ui.com/)

