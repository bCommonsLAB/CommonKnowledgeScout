# Common Chat Integration in Common Knowledge Scout

Ziel: Pro Library eine konfigurierbare, optional öffentliche Chat-Ansicht bereitstellen, die über eine RAG-Pipeline mit den in der Library verarbeiteten Dokumenten und Chunks interagiert. Die View startet zunächst unter dem Menüpunkt „Chat“ und kann später zur Startansicht der Library werden.

Quellen: Architektur und Funktionsweise an das öffentliche Repository „common-chat“ angelehnt (`https://github.com/bCommonsLAB/common-chat`) und an unsere korrigierte RAG-Architektur (Summaries für Vektor-Suche, Original-Markdown für LLM-Kontext; Top‑K Kapitel laden) angepasst.

---

## Kontext und Anforderungen

- Pro Library existieren bereits generierte Markdown-Dateien. Diese sollen für Chat-Abfragen nutzbar sein.
- Die RAG-Pipeline folgt dem Prinzip:
  1) Vektor-Suche auf kurzen Summary‑Dokumenten (≤2000 Zeichen) mit Metadaten-Filtern,
  2) Laden der Original‑Markdown‑Abschnitte der Top‑K Kapitel,
  3) Antwortgenerierung durch LLM auf Basis der Originaltexte.
- Pro Library eine Konfiguration, die die „öffentliche Präsenz“ (Titel, Beschreibung, Limits) sowie technische RAG‑Parameter beschreibt.
- Sicherheit: optional öffentlich, ansonsten über Clerk geschützt; keine Secrets an den Client; Rate‑Limiting.
- UI/UX: Shadcn UI, mobil‑zuerst; Chat unter Menüpunkt „Chat“, später als Standard‑Startansicht.
- Tests: Vitest (Unit/Integration), Playwright (E2E), MSW (API‑Mocks), Snapshots für UI.

---

## Architekturvorschlag (High-Level)

### Datenmodell (RAG‑Artefakte)
- Summary‑Chunk
  - `id`, `libraryId`, `chapterId`, `sectionId`, `language`, `tokens`, `summaryText` (≤2000), `embedding`, `metadata` (Kapitel, Pfad, Version, Tags)
- Original‑Chunk
  - `id`, `libraryId`, `chapterId`, `sectionId`, `markdown` (vollständig), `sourcePath`, `hash`

Hinweis: Summary‑Chunks werden in der Vektor‑DB abgelegt; Original‑Chunks in Filesystem/Blob‑Store/DB (je nach bestehender Storage‑Strategie) und via ID referenziert.

### Vektor‑Speicher‑Strategie (3 Varianten)
1) Ein Index, Multi‑Tenant via Namespace pro `libraryId`
   - Vorteile: kosteneffizient, einfaches Management
   - Nachteile: Tuning pro Library begrenzt
   - Empfehlung für Start (Default)
2) Ein Index pro Library (wie „common-chat“ skizziert)
   - Vorteile: Isolation, eigenes Tuning
   - Nachteile: höhere Kosten/Verwaltung
3) Lokale Vektor‑DB (pgvector/sqlite) pro Library + optionaler Cloud‑Fallback
   - Vorteile: Kontrolle, offline‑fähig
   - Nachteile: mehr Betriebsaufwand

### Konfigurationsschema (pro Library)
Datei: `src/library/<libraryId>/chat.config.json` (oder Sammlung in `src/lib/chatbots.ts`)

```
{
  "id": "<libraryId>",
  "name": "Name in der UI",
  "title": "Titelzeile",
  "description": "Kurzbeschreibung",
  "url": "/library/<libraryId>/chat",
  "titleAvatarSrc": "/images/...",
  "welcomeMessage": "Willkommen ...",
  "errorMessage": "Uups ...",
  "placeholder": "Frage eingeben ...",
  "maxChars": 500,
  "maxCharsWarningMessage": "Maximale Länge erreicht.",
  "footerText": "—",
  "companyLink": "https://...",
  "vectorStore": {
    "provider": "pinecone",                 // oder "local"
    "index": "shared-index-name",           // bei Namespace-Modell
    "namespace": "<libraryId>",
    "topK": 5,
    "minScore": 0.2
  },
  "models": {
    "chat": "gpt-4o-mini",                  // ENV überschreibbar
    "embeddings": "text-embedding-3-large",
    "temperature": 0.3
  },
  "public": true,                             // steuert Sichtbarkeit
  "rateLimit": { "windowSec": 60, "max": 30 },
  "features": {
    "citations": true,
    "streaming": true,
    "tools": []
  }
}
```

Validierung via Zod‑Schema (`LibraryChatConfig`), strikt typisiert.

### Ingestion‑Pipeline (Build/Job)
1) Markdown scannen → Kapitel/Abschnitte erkennen (bestehende Logik wiederverwenden)
2) Summary pro Kapitel/Abschnitt erzeugen (≤2000 Zeichen)
3) Embedding für Summary erzeugen → Vektor‑DB upsert
4) Original‑Markdown persistieren (Pfad/ID speichern)
5) Metadaten schreiben (libraryId, chapterId, tags, language)

Wichtig: Idempotenz (Hash/Upsert), Versions‑Metadaten, Retry/Backoff, Logging minimal aber aussagekräftig.

### Query‑/Antwort‑Pipeline
1) Anfrage validieren (Zod), Rate‑Limit, Auth je nach `public`
2) Vektor‑Suche auf Summary‑Embeddings (Filter: `libraryId`, Sprache, Tags)
3) Für Top‑K Kapitel Original‑Markdown laden
4) Prompt zusammenstellen (System + Regeln + Zitierpflicht)
5) LLM‑Antwort streamen; Zitate/Quellen anhängen
6) Persistenz: Chatverlauf in MongoDB (Schlüssel: userEmail + libraryId + conversationId)

### UI/Navigation
- Route: `app/library/[libraryId]/chat/page.tsx`
  - Server Component (Daten), Client Subkomponenten (Eingabe/Streaming)
  - Shadcn UI (Input, Button, ScrollArea, Badge), Lucide Icons
- Später: `app/library/[libraryId]/page.tsx` → Redirect auf Chat (wenn gewünscht)
- State: `nuqs` für Query‑Param (conversationId), TanStack Query für Fetch/Stream‑Status
- A11y: Tastatur, ARIA‑Labels, Kontrast

### Sicherheit
- Clerk Auth; Middleware schützt private Libraries
- Keine Secrets an Client; nur Status/Maskierung
- Request‑Limits, einfache Abuse‑Signale (lange Prompt‑Loops, übergroße Kontexte)

### Fehlerbehandlung & Logging
- Typisierte Fehler (discriminated unions), mapping → HTTP‑Status
- Route‑Handler immer `try/catch` mit strukturierter Fehlerrückgabe
- Logging: nur wesentliche Ereignisse (Start/Fehler/Abschluss, Dauer, Größen)

---

## Technische Umsetzungsschritte (Phasen)

1) Konfiguration & Types
   - `LibraryChatConfig` (Zod + TS‑Interface), Loader für `chat.config.json`
   - ENV‑Handling (Modelle, Provider, Index/Namespace)

2) Vektor‑Store vorbereiten
   - Pinecone Client, Index prüfen/erstellen (oder lokaler Store)
   - Namespace je Library (empfohlen) oder separater Index

3) Ingestion‑Job
   - CLI/Script: Markdown → Summaries → Embeddings → Upsert
   - Idempotenz via Hash; Metriken (chunks, tokens, Dauer)

4) API‑Routen (Next.js App Router)
   - `POST /api/chat/[libraryId]` → Query/Stream
   - `GET /api/chat/[libraryId]/sources` → Quell‑Snippets
   - `GET /api/chat/[libraryId]/config` → Public‑safe Config

5) Chat‑UI
   - Seite unter `library/[libraryId]/chat` mit Streaming, Zitaten, Copy
   - Responsive; Suspense‑Boundaries; Error Boundary

6) Sichtbarkeit/Access
   - `public` Flag respektieren; Clerk‑Gate für privat
   - Rate‑Limit (IP/User), einfache Captcha‑Option für public

7) Tests
   - Unit: Config‑Validation, Chunking, Prompt‑Builder
   - Integration: API‑Routen mit MSW
   - E2E: Chat‑Flow mit Playwright (öffentlich + privat)

8) Startansicht (optional Phase 2)
   - Redirect Library‑Start → Chat, Feature‑Flag/Config‑gesteuert

---

## Env‑Variablen (Beispiele)
```
OPENAI_API_KEY=
OPENAI_CHAT_MODEL_NAME=gpt-4o-mini
OPENAI_EMBEDDINGS_MODEL_NAME=text-embedding-3-large
OPENAI_CHAT_TEMPERATURE=0.3

PINECONE_API_KEY=
PINECONE_INDEX=knowledge-scout
```

---

## Offene Fragen
- Index‑Strategie final: Namespace (empfohlen) vs. Index pro Library?
- Public‑Libraries: Captcha/Ratelimit ausreichend oder weitere Schutzmaßnahmen?
- Storage der Original‑Markdown‑Chunks: Dateisystem vs. DB vs. Blob‑Store?
- Metriken/Analytics: Welche KPIs sind relevant (Antwortlatenz, Kontextgröße, Trefferquote)?

---

## Referenzen
- GitHub Repository „common-chat“: `https://github.com/bCommonsLAB/common-chat`
- Interne RAG‑Architektur (Summaries + Original‑Markdown; Top‑K Kapitel)


