## Verzeichnis veröffentlichen – Konzeption für Wiki-/Web-Publishing

Ziel: Aus bereits erzeugten Markdown-„Shadow Twins“ (z. B. `*.de.md`) ein öffentliches, durchsuchbares Wiki erzeugen. Die Markdown-Dateien werden identifiziert, mit Metadaten (Titel, Kurz-Titel, Summary, Cover-Bild, Original-Link) angereichert und als Einträge in MongoDB gespeichert. Frontend liefert eine Übersicht (dreizeiliger Teaser) und Detailseiten mit Summary, Link zum Original und vollem Markdown.

### Anforderungen
- Funktional
  - Scan eines Wurzelordners (wie beim PDF-Dialog), rekursiv.
  - Identifikation von Markdown-Shadow-Twins zu Originaldokumenten (Namensschema, Metadaten).
  - Erzeugung von stabilen `slug`s und Kurz-Titeln; Mehrsprachigkeit (z. B. `*.de.md`).
  - Extraktion von: Titel, Summary (3–5 Sätze oder ~320 Zeichen), Teaser (3 Zeilen), Cover (erstes Bild), Original-Link.
  - Idempotentes „Publish“ (Re-Run überschreibt/aktualisiert denselben Eintrag statt Duplikat).
  - API-Endpunkte zum Enqueue/Publish sowie zum Listen/Lesen.
  - Öffentliche Web-Ansicht: Übersicht, Detail, Suche/Filter.
- Nicht-funktional
  - Typensichere Schemas (Zod + Interfaces), strikte TS.
  - Indizes für schnelle Queries (slug, lang, libraryId, tags).
  - Sanitisierung von HTML beim Rendern; sichere Markdown-Pipeline.
  - Geringe Laufzeitlast beim Scan (paginierte/gestreamte Verarbeitung optional).

---

### Datenmodell (MongoDB)

Collection: `wiki_entries`

Sinnvolle Minimalfelder (alle strikt typisiert und validiert):

```ts
export interface WikiEntry {
  _id: string;                      // Mongo ObjectId als String (serverseitig)
  libraryId: string;                // Zuordnung zur aktiven Library
  sourceItemId: string;             // Storage-Item-ID des Originaldokuments (wenn vorhanden)
  sourcePath: string;               // Vollständiger Pfad im Storage (rekonstruiert)
  originalUrl?: string;             // Deeplink zurück ins Library-UI
  lang: string;                     // z. B. "de", "en"

  title: string;                    // Aus Frontmatter/H1/Dateiname
  shortTitle: string;               // Knapp, UI-tauglich (~30–40 Zeichen)
  slug: string;                     // Eindeutig pro (libraryId, lang)
  summary: string;                  // 3–5 Sätze oder ~320 Zeichen
  teaser: string;                   // Dreizeiler für Karten/Listen

  coverImageUrl?: string;           // Erstes Bild im Markdown oder generiert
  tags: string[];                   // Aus Frontmatter/Heuristik
  authors?: string[];               // Optional, aus Frontmatter

  markdown: string;                 // Voller Markdown-Inhalt
  wordCount: number;                // Heuristik
  readingTimeMinutes: number;       // Heuristik (z. B. 200 WpM)

  status: 'draft' | 'published';
  version: number;                  // Hochzählen bei Re-Publish
  checksum: string;                 // Hash über Markdown + relevante Metadaten (Idempotenz)

  createdAt: string;                // ISO
  updatedAt: string;                // ISO
}
```

Indizes:
- `{ libraryId: 1, lang: 1, slug: 1 }` unique
- `{ libraryId: 1, updatedAt: -1 }`
- `{ tags: 1 }`

Checksum-Strategie:
- SHA-256 über `markdown` + `title` + `lang` + optional `sourceItemId`.
- Bei identischer Checksum: nur `updatedAt` anpassen, kein Versionsbump.

Kurz-Titel/Slug:
- `shortTitle`: heuristisch aus Titel (Trunkierung bei ~40 Zeichen, Wortgrenzen, Suffix-Entfernung wie „- v2“).
- `slug`: `kebab-case` aus `shortTitle` + Kollisionen über Zähler lösen (`slug`, `slug-2`, ...). Uniqueness per Index.

Cover-Bild:
- Erstes Markdown-Bild `![](url)` als `coverImageUrl`.
- Fallback: generiertes OG-Image (später), oder leer lassen.

---

### Erkennung von „Shadow Twins“

Namenskonventionen:
- `name.<lang>.md` (z. B. `bericht.de.md`) → `lang = de`, Basename = `bericht`.
- Alternativ: `name.md` mit Frontmatter `lang`.

Zugehörigkeit zum Original:
- Gleicher Ordner wie Original-PDF oder verlinkt über `sourceItemId` in Frontmatter.
- Für die erste Phase reicht: Ablage neben dem PDF und Ableitung über Basename.

Frontmatter (optional):
- Unterstützt `title`, `shortTitle`, `tags`, `authors`, `originalUrl`, `lang`.
- Frontmatter überschreibt Heuristiken.

---

### Pipeline-Varianten (Verarbeitung)

1) Direkt in API (synchron, sequentiell)
- Client scannt, sendet pro Markdown-Datei `POST /api/web/publish`.
- API extrahiert Metadaten, persistiert; UI zeigt Fortschritt.
- Pros: Einfach, wenig Infrastruktur. Cons: Längere Requests, weniger robust.

2) Job-Queue (empfohlen, integriert in bestehende External-Jobs)
- Client enqueued Items (ähnlich PDF-Flow). Worker verarbeitet nacheinander.
- Pros: Robust, throttling, Retry, Logging. Cons: Etwas mehr Setup.

3) Batch-Import (Server-initiierter Scan)
- `POST /api/web/publish-folder` triggert serverseitigen rekursiven Scan + Batch-Inserts.
- Pros: Sehr schnell. Cons: Serverlast/Timeouts, weniger feingranulares Feedback.

Empfehlung: Start mit (2) Job-Queue. UI bleibt responsiv, Re-Runs sind idempotent, Logging/Fehlerbehandlung konsistent mit PDF-Prozess.

```mermaid
flowchart TD
  A[Client: PublishFolderDialog] -->|scan md| B(Enqueue per Datei)
  B --> C[API /api/web/publish]
  C --> D[Job angelegt]
  D --> E[Worker: Parse MD]
  E --> F[Extract meta + compute checksum]
  F --> G[Upsert in wiki_entries]
  G --> H[UI/"Web" liest aus DB]
```

---

### API-Design (Next.js App Router)

- `POST /api/web/publish`
  - Headers: `X-Library-Id`, Auth via Clerk
  - Body (FormData oder JSON): `{ markdownFile, path, sourceItemId?, originalUrl? }`
  - Ergebnis: `{ ok: true, entryId, slug, status }`

- `POST /api/web/publish-folder` (optional, wenn serverseitiger Scan gewünscht)
  - Headers: `X-Library-Id`
  - Body: `{ rootFolderId, ignoreExisting: boolean }`
  - Ergebnis: `{ ok: true, enqueued: number }`

- `GET /api/web/entries?query=&tag=&lang=&page=&limit=`
  - Für UI-Listen (RSC konsumierbar).

- `GET /api/web/entries/[slug]?lang=de`
  - Detail-Abruf.

Antwortschema (typisiert, standardisiert):
```ts
export interface ApiList<T> { items: T[]; total: number; page: number; limit: number }
export interface ApiResult<T> { ok: true; data: T } | { ok: false; error: string }
```

---

### UI/Navigation

- Neuer Hauptmenüpunkt: „Web“
  - Route: `/web`
  - Übersicht: Karten-Layout (cover, shortTitle, teaser, tags). Suche/Filter (nuqs).
  - Detail: `/web/[slug]` – Title, Summary, Cover, Original-Link, Render des Markdown (serverseitig, sanitized), Tags.

- Neuer Dialog analog `PdfBulkImportDialog`: `PublishFolderDialog`
  - Komponente: `src/components/library/publish-folder-dialog.tsx`
  - Funktionen:
    - Rekursiver Scan nach `*.md` (optional Filter `*.{de,en,fr,es,it}.md`).
    - Erkennen bereits veröffentlichter Einträge (per Checksum/Slug) → „Ignorieren“.
    - Vorschau (max. 10) mit relativem Pfad, Name.
    - Optionen: `ignoreExisting`, Standardsprache, Tags-Default.
    - Aktion: „Einträge veröffentlichen (N)“ → enqueue `POST /api/web/publish`.

- Library-Header-Erweiterung
  - Button „Verzeichnis veröffentlichen“ (Icon: `Globe` o. ä.), öffnet `PublishFolderDialog`.

Komponentenstruktur (Vorschlag):
- `src/app/web/page.tsx` (RSC) – Liste mit Server-Abfrage
- `src/app/web/[slug]/page.tsx` (RSC) – Detail mit Server-Abfrage
- `src/components/web/wiki-card.tsx` – Karte/Teaser
- `src/components/web/wiki-list.tsx` – Listengrid + Paginierung
- `src/components/web/wiki-detail.tsx` – Detail-Layout

---

### Extraktion und Sanitization

Reihenfolge für `title`/`summary`/`teaser`:
1. YAML-Frontmatter (falls vorhanden)
2. H1-Überschrift
3. Dateiname als Fallback

`summary`:
- Erste 1–2 Absätze, bereinigt (ohne Bilder/Links), auf ~320 Zeichen begrenzen, Satzende respektieren.

`teaser` (dreizeilig):
- Aus `summary`, Hart-Umbruch für UI (CSS `line-clamp-3`).

Sanitization:
- Markdown → HTML via `remark/rehype` auf dem Server, mit `rehype-sanitize`.
- Bilder/Links whitelisten, `target=_blank`-Policy, rel-Attribute.

---

### Idempotenz, Upsert, Versionierung

- Einzigartigkeit: `(libraryId, lang, slug)`.
- Upsert-Logik:
  - Gleicher `slug` + `lang` + `libraryId`: 
    - Wenn `checksum` gleich → kein Versionsbump, nur `updatedAt`.
    - Sonst: `version++`, Felder aktualisieren.

---

### Sicherheit und Auth

- Schreiben (Publish): Clerk-geschützte Routen, nur Rollen: Admin/Editor.
- Lesen (Web): öffentlich oder per Feature-Flag. Nie Secrets leaken.
- CSP und XSS-Schutz bei Markdown-Rendering strikt.

---

### Tests (Pflicht)

- Unit
  - Parser: Frontmatter/H1/Absatz-Erkennung, Slug/Kurz-Titel, Summary/Teaser.
  - Checksum/Idempotenz.
  - Sanitization-Pipeline (Whitelist). 

- Integration
  - `POST /api/web/publish` mit Beispiel-Markdown (mit/ohne Frontmatter).
  - Upsert-Szenarien (gleich/verschieden Checksum).
  - Listen- und Detail-Endpunkte.

- E2E (Playwright)
  - Übersicht lädt, Such-/Filter-Interaktion (nuqs) funktioniert.
  - Detail zeigt Summary, Cover, Original-Link, Markdown-Render ohne XSS.

Abdeckungsschwellen gem. Projektvorgaben einhalten.

---

### Schrittweise Einführung
1. Datenmodell + Repo-Funktionen (Insert/Upsert + Indizes)
2. `POST /api/web/publish` (einzeln), einfacher Worker/Job-Integration
3. `PublishFolderDialog` + Button im Library-Header
4. `/web` Übersicht + `/web/[slug]` Detail (RSC)
5. Suche/Filter/Tags + SEO/OG-Metadaten

---

### Offene Punkte / Entscheidungen
- Mehrsprachige Konsolidierung (ein Slug über mehrere `lang` oder getrennte Slugs?)
- OG-Image-Generator (später)
- Volltextsuche (Mongo Text-Index vs. externe Suche)
- Rechte/ACL auf Einträge (öffentlich vs. intern)

---

### Kurzfazit (kritisch)
- Variante mit Job-Queue ist robust und deckt sich mit bestehendem PDF-Flow.
- Datenmodell ist minimal, aber erweiterbar (Versionierung, Tags, Autoren).
- Risiken liegen primär in konsistenter Erkennung der Shadow Twins und sicherem Markdown-Rendering. Tests und Idempotenz-Checks mitigieren das.


