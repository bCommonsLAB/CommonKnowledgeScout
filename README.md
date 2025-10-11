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

```bash
# Repository klonen
git clone [repository-url]
cd [projekt-verzeichnis]

# Dependencies installieren
pnpm install

# Umgebungsvariablen konfigurieren
cp .env.example .env.local
# .env.local anpassen

# Entwicklungsserver starten
pnpm dev
```
Die Anwendung ist nun unter `http://localhost:3000` verfügbar.


### Cursor‑IDE Chats exportieren (Utility)

Zur Bequemlichkeit liegt ein optionales Skript bei, das lokale Cursor‑Chats aus der SQLite‑DB exportiert.

Voraussetzungen:
- Windows, Cursor geschlossen

Schritte (PowerShell):

```powershell
$env:CURSOR_DB="$env:APPDATA\Cursor\User\globalStorage\state.vscdb"
pnpm install
pnpm run export:cursor-chats -- --out "@cursor-chats" --only-md --messages-only
```

CLI‑Optionen:
- `--out <pfad>`: Zielordner (Standard: `exports/cursor-chats`). Tipp: `"@cursor-chats"`.
- `--only-md`: Keine Rohdateien speichern, nur Markdown.
- `--messages-only`: Nur Einträge exportieren, die als Nachrichten erkennbar sind.
- `--pattern <teilstring>`: Zusätzliche Key‑Filter, mehrfach nutzbar (Default: chat, conversation, history, messages, session, cursor).

Ergebnis:
- `<out>/*.md`: Eine Markdown‑Datei pro erkannten Chat inkl. Frontmatter (`source`, `key`, `createdAt`).
- `<out>/raw/*`: Nur ohne `--only-md` – Rohdaten (JSON/TXT/BIN).


## Package deployen
1. Githuvb Token setzen
$env:GITHUB_TOKEN="ghp_YOUR_TOKEN_HERE"

2. Token prüfen
echo "Token gesetzt: $env:GITHUB_TOKEN"

3. Package veröffentlichen
pnpm run package:publish


## 📚 Dokumentation

Detaillierte Dokumentation finden Sie in den folgenden Bereichen:

### Architektur & Setup
- [Projektübersicht](docs/01_project_overview.md)
- [Technische Architektur](docs/02_architecture.md)
- [Kernkomponenten](docs/03_core_components.md)
- [Storage Provider System](docs/04_storage-provider.md)

### Benutzer & Features
- [Funktionen und Benutzergruppen](docs/05_features.md)
- [Entwickler Setup Guide](docs/05_setup.md)
- [API Dokumentation](docs/07_api.md)

## 🛠 Technologie-Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **State**: Jotai, React Hook Form
- **Auth**: Clerk
- **Build**: pnpm

## 📋 Systemanforderungen

- Node.js >= 18
- pnpm >= 9.15
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

