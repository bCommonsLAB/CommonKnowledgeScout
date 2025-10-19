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


## ⚙️ Umgebungsvariablen (.env)

Lege eine `.env.local` (Entwicklung) bzw. `.env` (Produktion) an. Eine Vorlage findest du in `.env.example`.

Wichtige Variablen (Auszug, siehe Beispiel unten):
- Anwendung
  - `NEXT_PUBLIC_APP_URL` (erforderlich, z. B. `http://localhost:3000` oder Produktions‑URL)
- (entfällt) `NEXT_PUBLIC_BASE_URL` → verwende `NEXT_PUBLIC_APP_URL`
  - `PORT` (optional; Next.js Port)
- Interner Bypass/Callbacks
  - `INTERNAL_TEST_TOKEN` (empfohlen): Shared Secret für interne Server‑zu‑Server‑Aufrufe. Wird als `X-Internal-Token` gesetzt und auf `/api/external/jobs/[jobId]` geprüft. Fehlt diese Variable, schlagen interne Callbacks mit 401 fehl (z. B. Meldung „callback_token fehlt“), und Jobs bleiben u. U. im Status „running“.
  - `INTERNAL_SELF_BASE_URL` (optional, empfohlen in Prod): Basis‑URL für interne Self‑Calls (z. B. `http://127.0.0.1:3000` oder interne Service‑URL). Fallbacks: Request‑Origin → `NEXT_PUBLIC_BASE_URL` → `http://127.0.0.1:${PORT||3000}`. Wird u. a. für den Analyze‑Endpoint genutzt.
- Secretary Service
  - `SECRETARY_SERVICE_URL` (erforderlich)
  - `SECRETARY_SERVICE_API_KEY` (erforderlich)
  - `EXTERNAL_REQUEST_TIMEOUT_MS` (optional; Default 600000 empfohlen)
  - `EXTERNAL_TEMPLATE_TIMEOUT_MS` (optional; überschreibt Template‑Timeout)
- MongoDB
  - `MONGODB_URI` (erforderlich)
  - `MONGODB_DATABASE_NAME` (erforderlich)
  - `MONGODB_COLLECTION_NAME` (optional; Default: `libraries`)
- Pinecone / Embeddings
  - `PINECONE_API_KEY` (falls RAG genutzt wird)
  - `OPENAI_EMBEDDINGS_DIMENSION` (optional; Default 3072)
- OpenAI Chat (optional)
  - `OPENAI_API_KEY`
  - `OPENAI_CHAT_MODEL_NAME` (Default: `gpt-4o-mini`)
  - `OPENAI_CHAT_TEMPERATURE` (Default: `0.2`)
- Worker Steuerung (optional)
  - `JOBS_WORKER_INTERVAL_MS` (Default: `2000`)
  - `JOBS_WORKER_CONCURRENCY` (Default: `3`)
  - `JOBS_WORKER_AUTOSTART` (Default: `true`)
- Auth (Clerk)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
- Debug (optional)
  - `DEBUG_FILESYSTEM` (Default: `false`)

Beispiel:

```bash
# Anwendung
NEXT_PUBLIC_APP_URL=http://localhost:3000
# (entfällt) NEXT_PUBLIC_BASE_URL=
PORT=3000

# Interner Bypass für interne Callbacks (Server‑zu‑Server)
INTERNAL_TEST_TOKEN=change_me_for_prod
# Interne Self‑Calls (optional; überschreibt Origin)
INTERNAL_SELF_BASE_URL=http://127.0.0.1:3000

# Secretary Service
SECRETARY_SERVICE_URL=http://127.0.0.1:5001/api
SECRETARY_SERVICE_API_KEY=your_secretary_key
EXTERNAL_REQUEST_TIMEOUT_MS=600000
EXTERNAL_TEMPLATE_TIMEOUT_MS=600000

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/your-db
MONGODB_DATABASE_NAME=your-db
MONGODB_COLLECTION_NAME=libraries

# Pinecone / Embeddings
PINECONE_API_KEY=
OPENAI_EMBEDDINGS_DIMENSION=3072

# OpenAI Chat (optional)
OPENAI_API_KEY=
OPENAI_CHAT_MODEL_NAME=gpt-4o-mini
OPENAI_CHAT_TEMPERATURE=0.2

# Worker
JOBS_WORKER_INTERVAL_MS=2000
JOBS_WORKER_CONCURRENCY=3
JOBS_WORKER_AUTOSTART=true

# Clerk (optional, falls Login aktiviert ist)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Debug
DEBUG_FILESYSTEM=false
```

Hinweis zur Fehlermeldung „callback_token fehlt“: In der Template‑Only/Idempotenz‑Pfadführung wird ein interner Callback an `/api/external/jobs/[jobId]` gesendet. Ist `INTERNAL_TEST_TOKEN` nicht gesetzt, wird kein `X-Internal-Token` Header mitgesendet, der Callback wird mit 401 abgewiesen und der Job kann im Status „running“ verbleiben. Setze daher in Produktion unbedingt `INTERNAL_TEST_TOKEN` (gleich auf Sender‑ und Empfängerseite; hier derselbe Server) und starte die App neu.


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

