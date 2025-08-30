# Wir haben hier in der Library dieses PDF-Verzeichnis verarbeiten, das
_Exported on 8/30/2025 at 11:43:52 GMT+2 from Cursor (1.5.5)_

---

**User**

Wir haben hier in der Library dieses PDF-Verzeichnis verarbeiten, das eine Verzeichnisstruktur durchsucht und PDF-Dateien transkliniert und Markdown-Dateien speichert. Ich möchte parallel dazu jetzt eine ähnliche Funktion bauen, die da heißt Verzeichnis veröffentlichen, das in ähnlicher Manier Markdown-Dateien sucht, praktisch Shadow Trims zu PDF von anderen Medien und diese Markdown-Dateien in eine MongoDB Collection absortet. Und diese dort ablegt. Und in diese Collections sollten dann eine Art Wiki werden fürs Web. Wo ich einfach ein Bild, eine Summary von dem Markdown-Dokument habe. Einen Titel, einen treffenden Kurztitel. Auf einer ersten Seite eine in der Übersichtsliste, da ich da einen Dreizeiler habe. Und wenn ich auf eine Detailseite gehe, dann eben eine Summary habe, eine schöne Zusammenfassung. Und natürlich den originalen Link zum originalen Dokument und auch dieses Markdown aus dem Dokumen@library-header.tsx @pdf-bulk-import-dialog.tsx 

können wir das mal konzipieren?
Datenmodell
und neuen Hauptmenüpunkt "Web"
wie könnte das aussehen?

---

**Cursor**

Ich lege eine Design-Notiz unter `docs/_analysis/wiki-publish-design.md` an, die Datenmodell, Varianten, API- und UI-Konzept (inkl. neuem Menüpunkt „Web“) präzise beschreibt. Anschließend skizziere ich die wichtigsten Interfaces und Flows.

```markdown
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


```

Ich habe die Design-Notiz erstellt: `docs/_analysis/wiki-publish-design.md`. Als Nächstes skizziere ich Datenmodell, API und UI inkl. Hauptmenü „Web“ kurz und präzise.

### Zielbild
- Verzeichnis rekursiv scannen, Markdown-Shadow-Twins (z. B. name.de.md) erkennen, Metadaten extrahieren, Einträge als Wiki in MongoDB speichern.
- UI: Übersicht mit Teasern (dreizeilig), Detail mit Summary, Cover, Link zum Original und vollem Markdown.

### Datenmodell (MongoDB)
- Collection: `wiki_entries`
- Kerneigenschaften: Stabiler `slug` je `libraryId+lang`, `summary` (~320 Zeichen), `teaser` (dreizeilig), `coverImageUrl` (erstes Bild), `originalUrl`, Versionierung und `checksum` für Idempotenz.
- Indizes: unique `(libraryId, lang, slug)`, `(libraryId, updatedAt)`, `(tags)`.

Kurzform Interface:
```ts
export interface WikiEntry {
  _id: string;
  libraryId: string;
  sourceItemId: string;
  sourcePath: string;
  originalUrl?: string;
  lang: string;
  title: string;
  shortTitle: string;
  slug: string;
  summary: string;
  teaser: string;
  coverImageUrl?: string;
  tags: string[];
  authors?: string[];
  markdown: string;
  wordCount: number;
  readingTimeMinutes: number;
  status: 'draft' | 'published';
  version: number;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}
```

### Erkennung und Metadaten
- Shadow-Twins: `name.<lang>.md` oder Frontmatter `lang`.
- Metadaten-Priorität: Frontmatter → H1 → Dateiname.
- `shortTitle`: heuristisch aus Titel (trunkiert ~40 Zeichen).
- `slug`: kebab-case + Kollisionen mit Zähler lösen.
- `summary`: 1–2 Absätze, ~320 Zeichen, satzbasiert.
- `teaser`: aus `summary`, UI-geklemmt (line-clamp-3).
- `coverImageUrl`: erstes Bild im Markdown; Fallback später.

### Pipeline-Varianten
- Variante 1 (einfach): Client schickt jede Datei direkt an `/api/web/publish` (synchron).
- Variante 2 (empfohlen): Enqueue pro Datei, Worker verarbeitet nacheinander (robust, idempotent, Logging).
- Variante 3 (Batch): Serverseitiger Scan + Bulk-Import.
Hinweis: Wir haben die drei Varianten detailliert in der Notiz dokumentiert und empfehlen v2 (Job-Queue).

### API-Entwürfe (Next.js App Router)
- POST `/api/web/publish` – Body: Datei/JSON mit Pfad, Sprache, optional `sourceItemId`, `originalUrl`. Antwort: `{ ok, entryId, slug }`.
- GET `/api/web/entries?query=&tag=&lang=&page=&limit=` – Liste für Übersicht.
- GET `/api/web/entries/[slug]?lang=de` – Detailabruf.
- Optional: POST `/api/web/publish-folder` – serverseitiger Scan/Enqueue.

### UI/Navigation
- Neuer Hauptmenüpunkt: „Web“
  - Route `app/web/page.tsx` (RSC): Kartenliste (cover, `shortTitle`, `teaser`, tags), Suche/Filter via `nuqs`.
  - Route `app/web/[slug]/page.tsx` (RSC): Detail mit Title, Summary, Cover, Original-Link, sanitiziertes Markdown.
- Neuer Dialog analog PDF: `src/components/library/publish-folder-dialog.tsx`
  - Scan nach `*.md`, Sprache wählen, „Ignoriere vorhandene“ (per `checksum/slug`), Vorschau (10 Einträge), „Veröffentlichen (N)“ → enqueued POSTs.
- `src/components/library/library-header.tsx`: zusätzlicher Button „Verzeichnis veröffentlichen“ neben „PDF-Verzeichnis verarbeiten“, öffnet den neuen Dialog.

### Sicherheit, Qualität, Tests
- Auth: Clerk-geschützte Schreibrouten (Admin/Editor).
- Sanitization: Serverseitige Markdown→HTML-Pipeline mit `rehype-sanitize`.
- Tests (Vitest/Playwright): Parser/Heuristiken, Idempotenz/Upsert, API-Integration, UI-Listen/Details ohne XSS.

Nächste Schritte (minimal-invasiv):
- Schema/Repo-Funktionen und Indizes für `wiki_entries`.
- POST `/api/web/publish` (Upsert mit `checksum`, Versionierung).
- `publish-folder-dialog.tsx` + Button im `library-header.tsx`.
- `/web` Übersicht und `/web/[slug]` Detail (RSC).
Soll ich mit Schritt 1–2 starten (Schema + Publish-API) und anschließend den Dialog einhängen?

- Ich habe die Konzeption als `docs/_analysis/wiki-publish-design.md` abgelegt und die drei Pipeline-Varianten bewertet.

```typescript
export interface WikiEntry {
  _id: string;
  libraryId: string;
  sourceItemId: string;
  sourcePath: string;
  originalUrl?: string;
  lang: string;
  title: string;
  shortTitle: string;
  slug: string;
  summary: string;
  teaser: string;
  coverImageUrl?: string;
  tags: string[];
  authors?: string[];
  markdown: string;
  wordCount: number;
  readingTimeMinutes: number;
  status: 'draft' | 'published';
  version: number;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}
```

---

**User**

Ich möchte da diese Auswertung der Markdown Shadow Twins mit unserer eigenen Templateverarbeitung bewerkstelligen. Ich kann ja über ein Template genau bestimmen, welche Parameter ich von einem Text generieren möchte, oder extrahieren möchte, oder transformieren möchte. So möchte ich den Titel, den Short-Title, Slug Summary und Teaser, Text und Autors und die Mark-Word-Count mit dieser Template-Logik, also Secretary Service, berechnen und das Ergebnis dann im MongoDB Datenmodell speichern. Alle anderen Parameter können wir aus den sonstigen Variablen rekonstruieren.@transform-service.ts Wie könnte so ein Template aussehen?

---

**Cursor**

Kurze Einordnung: Wir sollten die Extraktion strikt strukturiert und deterministisch halten. Der Secretary-Template-Prompt muss das Modell erzwingen, ausschließlich valides JSON in exakt vorgegebenem Schema auszugeben. „Teaser“ und „Summary“ sind inhaltlich verwandt, aber mit unterschiedlichen Längen/Intentionen (Teaser: Listing-geeignet, nicht identisch). Slug-Regeln, Längenlimits und ASCII-Normalisierung gehören in den Prompt. Wortanzahl und Autoren übernehmen wir ebenfalls aus dem Template-Output; alle übrigen Felder (libraryId, sourceItemId, originalUrl, Pfad) rekonstruieren wir serverseitig.

Risiken: LLM-Output driftet schnell ins Freiform-Format. Dem begegnen wir mit strengen I/O-Anweisungen (JSON-only), einem eingebauten Schema und „fencing“ (MARKDOWN-Block). Frontmatter im Markdown muss entfernt werden, bevor „text“ gezählt wird. Für Sprachen/Slug gilt: klare Regeln und Limits, samt Fallback, wenn eine Regel nicht erfüllbar ist. Wir validieren anschließend serverseitig (Zod), rechnen bei Bedarf `readingTimeMinutes` lokal und erzwingen Idempotenz per `checksum`.

Drei Varianten:
- Minimal: Ein Template ohne Few-Shot, rein Schema + Regeln (schnell, aber anfälliger).
- Robust: Mit JSON-Schema-Block, harten Constraints, negativen Beispielen; empfohlen.
- Strikt: Zusätzlicher „do not output anything else“-Block und Beispiel-Ein/Ausgabe; maximal robust, etwas längerer Prompt.

### Empfohlenes Template (robust, Secretary-kompatibel)
Verwende Platzhalter, die du beim Aufruf ersetzen kannst: `{{targetLanguage}}`, `{{fileName}}`, `{{maxSummaryChars}}`, `{{maxTeaserChars}}`. Der Markdown-Inhalt wird im Block `<<<MARKDOWN` eingeschlossen.

```text
You are a precise information extraction model.

TASK
From the given Markdown document, extract a WikiEntry JSON with fields:
- title: string
- shortTitle: string (<= 40 chars, readable, no trailing punctuation)
- slug: string (lowercase, kebab-case, ASCII only, <= 80 chars; collapse whitespace/dashes)
- summary: string (1–2 sentences, <= {{maxSummaryChars}} chars, neutral tone, no quotes/backticks)
- teaser: string (2–3 sentences, <= {{maxTeaserChars}} chars, not identical to summary)
- text: string (the Markdown content without YAML frontmatter)
- authors: string[] (from frontmatter authors/author; else [])
- wordCount: integer (plain word count of text; ignore code fences and frontmatter)

CONTEXT
- Preferred language: {{targetLanguage}}
- File name (fallback for title/slug): {{fileName}}

RULES
1) Use frontmatter (title, authors, lang) if present; else use first H1 as title; else derive from file name (remove extension and separators, title case).
2) shortTitle: shorten title to <= 40 chars on word boundary; remove trailing punctuation.
3) slug: derive from shortTitle → lowercase, ASCII, replace non-alphanumerics with '-', collapse multiple '-', trim leading/trailing '-'.
4) summary: use first meaningful paragraph(s), strip images/links/markdown formatting, <= {{maxSummaryChars}} chars, end on sentence boundary if possible.
5) teaser: distinct from summary; preview-style, concise; <= {{maxTeaserChars}} chars.
6) text: original Markdown minus YAML frontmatter. Keep headings and lists; do not include the frontmatter or injected context.
7) authors: array of strings; if missing → [].
8) wordCount: count words in text (no code blocks/frontmatter).
9) Output strictly valid JSON only. No markdown fences, no comments, no trailing commas.

INPUT MARKDOWN
<<<MARKDOWN
{{markdown}}
MARKDOWN

OUTPUT FORMAT (must match; example types only)
{
  "title": "string",
  "shortTitle": "string",
  "slug": "string",
  "summary": "string",
  "teaser": "string",
  "text": "string",
  "authors": ["string"],
  "wordCount": 123
}
```

### Variante „strikt“ mit Schema-Validierungshinweis
Optional kannst du zusätzlich ein kompaktes JSON-Schema in den Prompt packen, um die Form noch stärker zu erzwingen:

```text
JSON-SCHEMA (for shape, not to be included in output)
{
  "type":"object",
  "properties":{
    "title":{"type":"string"},
    "shortTitle":{"type":"string"},
    "slug":{"type":"string"},
    "summary":{"type":"string"},
    "teaser":{"type":"string"},
    "text":{"type":"string"},
    "authors":{"type":"array","items":{"type":"string"}},
    "wordCount":{"type":"integer","minimum":0}
  },
  "required":["title","shortTitle","slug","summary","teaser","text","authors","wordCount"],
  "additionalProperties":false
}
Return ONLY a JSON object conforming to the schema. No extra text.
```

### Einbindung in `TransformService.transformText`
- `template`-Parameter: übergib die obige Template-Zeichenkette (ggf. in `src/lib/secretary/templates/wiki-entry.ts` abgelegt) und ersetze `{{...}}` Platzhalter vor dem Call.
- Eingabe: `textContent` ist der Markdown-Content. Falls der Dateiname wichtig ist, füge ihn über Template-Kontext ein (siehe „CONTEXT“).
- Output: der Secretary Service liefert JSON-String; danach serverseitig via Zod validieren und in `wiki_entries` upserten. `readingTimeMinutes` lokal berechnen (z. B. `Math.ceil(wordCount / 200)`).

Wenn du willst, baue ich dir eine kleine Template-Hilfsfunktion plus Zod-Schema für die Validierung und ein kurzes Vitest-Sample, das die Extraktion mit einem Beispiel-Markdown prüft.

```plaintext
You are a precise information extraction model.

TASK
From the given Markdown document, extract a WikiEntry JSON with fields:
- title: string
- shortTitle: string (<= 40 chars, readable, no trailing punctuation)
- slug: string (lowercase, kebab-case, ASCII only, <= 80 chars; collapse whitespace/dashes)
- summary: string (1–2 sentences, <= {{maxSummaryChars}} chars, neutral tone, no quotes/backticks)
- teaser: string (2–3 sentences, <= {{maxTeaserChars}} chars, not identical to summary)
- text: string (the Markdown content without YAML frontmatter)
- authors: string[] (from frontmatter authors/author; else [])
- wordCount: integer (plain word count of text; ignore code fences and frontmatter)

CONTEXT
- Preferred language: {{targetLanguage}}
- File name (fallback for title/slug): {{fileName}}

RULES
1) Use frontmatter (title, authors, lang) if present; else use first H1 as title; else derive from file name (remove extension and separators, title case).
2) shortTitle: shorten title to <= 40 chars on word boundary; remove trailing punctuation.
3) slug: derive from shortTitle → lowercase, ASCII, replace non-alphanumerics with '-', collapse multiple '-', trim leading/trailing '-'.
4) summary: use first meaningful paragraph(s), strip images/links/markdown formatting, <= {{maxSummaryChars}} chars, end on sentence boundary if possible.
5) teaser: distinct from summary; preview-style, concise; <= {{maxTeaserChars}} chars.
6) text: original Markdown minus YAML frontmatter. Keep headings and lists; do not include the frontmatter or injected context.
7) authors: array of strings; if missing → [].
8) wordCount: count words in text (no code blocks/frontmatter).
9) Output strictly valid JSON only. No markdown fences, no comments, no trailing commas.

INPUT MARKDOWN
<<<MARKDOWN
{{markdown}}
MARKDOWN

OUTPUT FORMAT (must match; example types only)
{
  "title": "string",
  "shortTitle": "string",
  "slug": "string",
  "summary": "string",
  "teaser": "string",
  "text": "string",
  "authors": ["string"],
  "wordCount": 123
}
```

```plaintext
JSON-SCHEMA (for shape, not to be included in output)
{
  "type":"object",
  "properties":{
    "title":{"type":"string"},
    "shortTitle":{"type":"string"},
    "slug":{"type":"string"},
    "summary":{"type":"string"},
    "teaser":{"type":"string"},
    "text":{"type":"string"},
    "authors":{"type":"array","items":{"type":"string"}},
    "wordCount":{"type":"integer","minimum":0}
  },
  "required":["title","shortTitle","slug","summary","teaser","text","authors","wordCount"],
  "additionalProperties":false
}
Return ONLY a JSON object conforming to the schema. No extra text.
```

---

**User**

@wiki-publish-design.md Wir können die Sache vereinfachen. Und zwar, wir würden einfach in einem Verzeichnis alle Markdown-Dateien analysieren Und diese Attribute Title, Short-Title, Slug, Summary, Teaser, Author und Text befinden sich bereits im Front-Matter dieser Markdown-Dateien Da sie ja bereits über diese Template erstellt wurden und diese Parameter im YAML Front-Matter bereitstellen Und diese würden wir jetzt verwenden und in MongoDB speichern Wie könnte man das machen?

---

**Cursor**

Kurzüberlegung
- Wenn alle Felder bereits im YAML-Frontmatter stehen, minimieren wir die Logik: nur parsen, validieren, ableiten (Fallbacks), checksum bilden und upserten. Kein LLM nötig.
- Robustheitspunkte: strikte Validierung (Zod), Idempotenz (checksum), Toleranz für Varianten wie `author` vs. `authors`, fehlende `slug`/`shortTitle` (Fallback aus `title`), saubere Fehlerprotokollierung.

### Zielablauf (vereinfacht)
- Client-Dialog „Verzeichnis veröffentlichen“ scannt rekursiv `*.md`.
- Pro Datei: Hole Inhalt via `provider.getBinary(...)`, parse Frontmatter, validiere, sende an `POST /api/web/publish`.
- Server: validiert erneut, berechnet `checksum`, upsert in `wiki_entries` per `(libraryId, lang, slug)`.

### Frontmatter-Beispiel (vereinheitlicht)
```yaml
---
title: Klimabericht Alpenraum 2024
shortTitle: Klimabericht Alpen
slug: klimabericht-alpen-2024
summary: Dieser Bericht fasst die wichtigsten Trends und Maßnahmen zusammen.
teaser: Ein kompakter Überblick über Risiken und Handlungsfelder.
authors:
  - Umweltamt Tirol
  - Institut Alpine Research
lang: de
text: >
  # Klimabericht Alpenraum 2024

  Einleitung …
wordCount: 842
---
```
- Optional akzeptieren: `author: "Name"` (wir mappen zu `authors: [..]`).
- Falls `text` nicht vorhanden: nehmen wir den Markdown-Body als Text-Grundlage.

### Validierungsschema (Zod) und Parser
```ts
import { z } from 'zod';

export const WikiFrontmatterSchema = z.object({
  title: z.string().min(1),
  shortTitle: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(120).optional(),
  summary: z.string().min(1).max(600),
  teaser: z.string().min(1).max(600),
  authors: z.array(z.string()).optional(),
  author: z.string().optional(),
  lang: z.string().min(2).max(5).default('de'),
  text: z.string().optional(),
  wordCount: z.number().int().nonnegative().optional(),
});

export type WikiFrontmatter = z.infer<typeof WikiFrontmatterSchema>;

export interface ParsedMarkdown {
  frontmatter: WikiFrontmatter;
  body: string; // Markdown ohne Frontmatter
}

export function parseMarkdown(md: string): ParsedMarkdown {
  // gray-matter o. ä. verwenden
  // const { data, content } = matter(md);
  // Hier konzeptuell:
  const data = {}; const content = md; // Platzhalter
  const fm = WikiFrontmatterSchema.parse(data);

  const authors = fm.authors ?? (fm.author ? [fm.author] : []);
  const title = fm.title;
  const shortTitle = fm.shortTitle ?? deriveShortTitle(title);
  const slug = fm.slug ?? deriveSlug(shortTitle);

  return {
    frontmatter: { ...fm, authors, shortTitle, slug },
    body: content,
  };
}
```
- `deriveShortTitle(title)`: Kürzen an Wortgrenzen (~40 Zeichen).
- `deriveSlug(s)`: `kebab-case`, ASCII-only, max 80 Zeichen.

### Server: Upsert-Logik (Kern)
```ts
interface UpsertInput {
  libraryId: string;
  sourceItemId?: string;
  sourcePath?: string;
  originalUrl?: string;
  markdown: string; // kompletter Inhalt
}

export async function upsertWikiEntry(input: UpsertInput) {
  const { frontmatter, body } = parseMarkdown(input.markdown);

  const text = frontmatter.text ?? stripFrontmatterText(body);
  const wordCount = frontmatter.wordCount ?? countWords(text);
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  const checksum = sha256(`${text}|${frontmatter.title}|${frontmatter.lang}`);

  const doc = {
    libraryId: input.libraryId,
    sourceItemId: input.sourceItemId,
    sourcePath: input.sourcePath,
    originalUrl: input.originalUrl,
    lang: frontmatter.lang,
    title: frontmatter.title,
    shortTitle: frontmatter.shortTitle,
    slug: frontmatter.slug,
    summary: frontmatter.summary,
    teaser: frontmatter.teaser,
    authors: frontmatter.authors ?? [],
    markdown: body,
    wordCount,
    readingTimeMinutes,
    status: 'published' as const,
    checksum,
    updatedAt: new Date().toISOString(),
  };

  // unique key: { libraryId, lang, slug }
  const existing = await wikiEntries.findOne({ libraryId: doc.libraryId, lang: doc.lang, slug: doc.slug });

  if (!existing) {
    await wikiEntries.insertOne({ ...doc, version: 1, createdAt: doc.updatedAt });
    return { created: true };
  }

  if (existing.checksum === checksum) {
    await wikiEntries.updateOne({ _id: existing._id }, { $set: { updatedAt: doc.updatedAt } });
    return { created: false, updated: false };
  }

  await wikiEntries.updateOne(
    { _id: existing._id },
    { $set: { ...doc, version: existing.version + 1 } }
  );
  return { created: false, updated: true };
}
```

### API-Route `POST /api/web/publish`
- Headers: `X-Library-Id`.
- Body: FormData mit `file` (Markdown) oder JSON `{ markdown, sourceItemId, sourcePath, originalUrl }`.
- Schritte:
  - Clerk-Auth prüfen.
  - `libraryId` aus Header validieren.
  - Markdown laden, `upsertWikiEntry(...)` aufrufen.
  - Standardisierte Antwort zurückgeben.

### Client: „Verzeichnis veröffentlichen“-Dialog
- Nahezu identisch zu `PdfBulkImportDialog`, aber Filter auf `*.md`.
- Beim Enqueue: Datei-Inhalt laden (`provider.getBinary(id)`), als Text lesen und an `/api/web/publish` senden.
- Option „Existierende ignorieren“: optional vorab HEAD-Check via `slug` (leicht, aber optional; idempotente Upsert genügt).

### Edge-Cases
- Fehlender `slug`/`shortTitle`: Fallbacks greifen, serverseitig deterministisch.
- `authors`/`author`: vereinheitlichen (Array).
- `text` fehlt im Frontmatter: aus Body extrahieren.
- Mehrsprachigkeit: `lang` aus Frontmatter, sonst Default `de`.

Wenn du möchtest, implementiere ich als nächsten Schritt:
- `src/utils/wiki-parser.ts` (parse + derive),
- `src/app/api/web/publish/route.ts` (POST, Upsert),
- sowie die Mongo-Repo-Funktion für `wiki_entries` inkl. unique Index.

```yaml
---
title: Klimabericht Alpenraum 2024
shortTitle: Klimabericht Alpen
slug: klimabericht-alpen-2024
summary: Dieser Bericht fasst die wichtigsten Trends und Maßnahmen zusammen.
teaser: Ein kompakter Überblick über Risiken und Handlungsfelder.
authors:
  - Umweltamt Tirol
  - Institut Alpine Research
lang: de
text: >
  # Klimabericht Alpenraum 2024

  Einleitung …
wordCount: 842
---
```

```typescript
import { z } from 'zod';

export const WikiFrontmatterSchema = z.object({
  title: z.string().min(1),
  shortTitle: z.string().min(1).max(80).optional(),
  slug: z.string().min(1).max(120).optional(),
  summary: z.string().min(1).max(600),
  teaser: z.string().min(1).max(600),
  authors: z.array(z.string()).optional(),
  author: z.string().optional(),
  lang: z.string().min(2).max(5).default('de'),
  text: z.string().optional(),
  wordCount: z.number().int().nonnegative().optional(),
});

export type WikiFrontmatter = z.infer<typeof WikiFrontmatterSchema>;

export interface ParsedMarkdown {
  frontmatter: WikiFrontmatter;
  body: string; // Markdown ohne Frontmatter
}

export function parseMarkdown(md: string): ParsedMarkdown {
  // gray-matter o. ä. verwenden
  // const { data, content } = matter(md);
  // Hier konzeptuell:
  const data = {}; const content = md; // Platzhalter
  const fm = WikiFrontmatterSchema.parse(data);

  const authors = fm.authors ?? (fm.author ? [fm.author] : []);
  const title = fm.title;
  const shortTitle = fm.shortTitle ?? deriveShortTitle(title);
  const slug = fm.slug ?? deriveSlug(shortTitle);

  return {
    frontmatter: { ...fm, authors, shortTitle, slug },
    body: content,
  };
}
```

```typescript
interface UpsertInput {
  libraryId: string;
  sourceItemId?: string;
  sourcePath?: string;
  originalUrl?: string;
  markdown: string; // kompletter Inhalt
}

export async function upsertWikiEntry(input: UpsertInput) {
  const { frontmatter, body } = parseMarkdown(input.markdown);

  const text = frontmatter.text ?? stripFrontmatterText(body);
  const wordCount = frontmatter.wordCount ?? countWords(text);
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  const checksum = sha256(`${text}|${frontmatter.title}|${frontmatter.lang}`);

  const doc = {
    libraryId: input.libraryId,
    sourceItemId: input.sourceItemId,
    sourcePath: input.sourcePath,
    originalUrl: input.originalUrl,
    lang: frontmatter.lang,
    title: frontmatter.title,
    shortTitle: frontmatter.shortTitle,
    slug: frontmatter.slug,
    summary: frontmatter.summary,
    teaser: frontmatter.teaser,
    authors: frontmatter.authors ?? [],
    markdown: body,
    wordCount,
    readingTimeMinutes,
    status: 'published' as const,
    checksum,
    updatedAt: new Date().toISOString(),
  };

  // unique key: { libraryId, lang, slug }
  const existing = await wikiEntries.findOne({ libraryId: doc.libraryId, lang: doc.lang, slug: doc.slug });

  if (!existing) {
    await wikiEntries.insertOne({ ...doc, version: 1, createdAt: doc.updatedAt });
    return { created: true };
  }

  if (existing.checksum === checksum) {
    await wikiEntries.updateOne({ _id: existing._id }, { $set: { updatedAt: doc.updatedAt } });
    return { created: false, updated: false };
  }

  await wikiEntries.updateOne(
    { _id: existing._id },
    { $set: { ...doc, version: existing.version + 1 } }
  );
  return { created: false, updated: true };
}
```

