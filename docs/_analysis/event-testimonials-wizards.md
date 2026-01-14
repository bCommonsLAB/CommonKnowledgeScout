# Analyse: Event → Testimonials → Finalize/Publish (3 Wizard-Flows)

Datum: 2026-01-11  
Scope: CommonKnowledgeScout – Wizard-UX, Storage-Datenhaltung, Ingestion/Explorer, Event-Detail-UI

## 1) Zielbild (fachlich)

Es sollen **drei getrennte Wizard-Flows** einen zusammenhängenden Prozess bedienen:

1. **Flow A – Event anlegen**: Ein Moderator erstellt eine Event-Seite (wie heute: Session/Event-Detailansicht). Der Event soll in der Explorer/Gallery-Ansicht **ganz normal** erscheinen (öffentlich/publiziert, je nach Library-Konfiguration).
2. **Flow B – Testimonials einsammeln**: Über einen QR-Code auf der Event-Seite werden Testimonials aufgenommen (Audio). Die Audio-Dateien + Artefakte werden **im Event-Kontext** abgelegt.
3. **Flow C – Co‑Creation / Finalisieren**: Aus Event-Text + Testimonials wird ein „finaler“ Event generiert. **Wichtig:** Im Filesystem wird nichts überschrieben (Original bleibt erhalten). Im Explorer/Index soll bei „Publish final“ jedoch der **Original-Event im Index ersetzt** werden.

## 2) Festgelegte Entscheidungen (aus Gespräch)

Diese Punkte gelten als „gegeben“ und beeinflussen Architektur/Implementierung:

- **Datenhaltung (Source of Truth)**: Primär **Storage/Filesystem** (Markdown + Artefakte im Event-Ordner). MongoDB wird weiterhin für Templates/konfigurationale Daten genutzt, nicht als primäres Event/Testimonial-DB-Modell.
- **Moderator vs anonym (QR-Sichtbarkeit)**: Entscheidung über **Login/Session** (Clerk) – Moderator sieht QR, anonyme Nutzer nicht.
- **Slug/Ersetzung beim Final-Publish**: Finaler Event bekommt **denselben `slug`** wie der ursprüngliche Event, um denselben „Platz“ im Explorer zu belegen.
- **Mehrfaches Finalisieren**: Flow C darf mehrfach laufen und erzeugt **versionierte Final-Entwürfe im Filesystem**, die **nicht automatisch** in den Index gehen. Erst ein expliziter Publish-Schritt führt zum Index-Swap.

## 3) Ist-Zustand (verifiziert durch Code-Lesung)

### 3.1 Explorer/Gallery – woher kommen die Items?

Die Gallery lädt Dokumente über:
- `GET /api/chat/[libraryId]/docs` (`src/app/api/chat/[libraryId]/docs/route.ts`)

Diese Route nutzt Vektor-/Meta-Daten aus MongoDB-Collections (Vector-Repo). Das bedeutet:
- **Explorer-„Wahrheit“ ist der Ingestion-Index**, nicht das Filesystem.
- Dateien können im Storage existieren, aber **ohne Ingestion** erscheinen sie nicht in der Gallery.

Konsequenz:
- „Event ersetzen“ (ohne Files zu löschen) muss als **Index-Operation** modelliert werden.

### 3.2 Index löschen ohne Dateien zu löschen (existiert bereits)

Es gibt bereits:
- `DELETE /api/chat/[libraryId]/docs/delete` (`src/app/api/chat/[libraryId]/docs/delete/route.ts`)

Diese Route:
- löscht **nur** MongoDB-Vektordokumente (Chunks/Meta/…)
- **löscht NICHT** die Dateien im Storage

Das passt exakt zu „Original bleibt im Filesystem, aber verschwindet aus Explorer“.

### 3.3 Ingestion für Markdown (existiert bereits)

Es gibt bereits:
- `POST /api/chat/[libraryId]/ingest-markdown` (`src/app/api/chat/[libraryId]/ingest-markdown/route.ts`)

Diese Route:
- lädt eine Markdown-Datei aus Storage via `fileId`
- upsertet diese in den Ingestion-Index (über `IngestionService.upsertMarkdown`)

Konsequenz:
- Ein Index-Swap kann prinzipiell aus **(a) ingest final** + **(b) delete original** zusammengesetzt werden.

### 3.4 Detail-Rendering: Session vs Testimonial

Es gibt einen generischen Renderer:
- `DetailViewRenderer` (`src/components/library/detail-view-renderer.tsx`)
  - kann `book`, `session`, `testimonial` rendern (Mapping via `doc-meta-mappers.ts`)

**Wichtig:** Der Explorer-Detail-Overlay (`DetailOverlay`) ist aktuell typisch auf `viewType: 'book' | 'session'` begrenzt:
- `src/components/library/gallery/detail-overlay.tsx`

Konsequenz:
- Für Testimonials und/oder weitere Detailtypen ist entweder
  - das Overlay zu erweitern, **oder**
  - Testimonials nur als Teil der SessionDetail-UI darzustellen, ohne eigenen Overlay-Typ.

### 3.5 Template/Creation-Flow – was ist heute „wirklich“ unterstützt?

Die Typen erlauben bestimmte Step-Presets:
- `CreationFlowStepPreset` in `src/lib/templates/template-types.ts`
  - u.a. `welcome`, `chooseSource`, `collectSource`, `reviewMarkdown`, `generateDraft`, `editDraft`, `uploadImages`, `previewDetail`, `publish`, `selectRelatedTestimonials`

Beobachtung aus deinen MongoDB-JSONs:
- `rawFrontmatter` enthält teils Presets wie `briefing`, `reviewSources` (in einem Beispiel),
- im gespeicherten `creation.flow.steps` fehlen diese.

Interpretation (muss in Tests bestätigt werden):
- unbekannte Presets werden wahrscheinlich **nicht verarbeitet** (oder beim Speichern/Parser nicht übernommen).
  - Das ist relevant, weil neue Flows nur dann „templategesteuert“ bleiben, wenn wir bei den implementierten Presets bleiben oder neue Presets end-to-end hinzufügen.

### 3.6 Publish-Step im Wizard: aktuell nicht generisch

Der `publish` Step existiert als Preset, aber die Implementierung im Wizard ist aktuell stark auf einen speziellen Case (PDFAnalyse) zugeschnitten:
- `src/components/creation-wizard/creation-wizard.tsx` (Publish-Case enthält Guard auf `templateId === 'pdfanalyse'`)

Konsequenz:
- Für Flow C („Publish final Event“) brauchen wir einen **neuen Publish-Mechanismus** (oder eine Generalisierung), der **Index-Swap** unterstützt.

## 4) Soll-Modell: Datenhaltung vs Index (ohne Überschreiben)

### 4.1 Filesystem-Layout (Vorschlag, anpassbar)

Ziel: Original bleibt erhalten, Final-Runs werden versioniert gespeichert, Testimonials liegen im Event-Kontext.

Beispiel:

```
events/<eventSlug>/
  original/
    event.md
    event.json
  testimonials/
    <testimonialId>/
      audio.<ext>
      transcript.md (optional)
      testimonial.md (optional)
      artifacts.json (optional)
  finals/
    run-<timestamp>/
      event-final.md
      final.json
```

Wichtig:
- Der „originale Event“ ist eine Datei im Storage und bleibt dauerhaft bestehen.
- Jeder Final-Run schreibt in einen eigenen Unterordner.
- Der finale Publish-Mechanismus entscheidet, welche Datei in den Index gelangt.

### 4.2 Index/Explorer-Logik: „ersetzten“ durch Swap

Da Explorer aus dem Ingestion-Index liest, ist „Ersetzen“ im Kern:

1. **Final erzeugen** (Filesystem-only): Final-Run schreiben, NICHT ingestieren.
2. **Publish final** (Index-Swap):
   - (a) **final ingestieren** (mit `docType: 'event'` und `slug` wie Original)
   - (b) **original aus Index löschen** (via `/docs/delete` mit original `fileId`)

Offener Punkt (muss entschieden/validiert werden):
- Reihenfolge (a→b) vs (b→a) und Fehlerfälle:
  - a→b minimiert „leeren Slot“, kann aber kurzzeitig Duplikate im Index erzeugen, falls slug nicht als Unique-Constraint wirkt.
  - b→a minimiert Duplikate, kann aber kurzzeitig „kein Event“ in Explorer bedeuten.

## 5) Was muss programmiert werden? (Änderungsflächen)

### 5.1 Wizard/Creation-Flow (Frontend)

**Neue Fähigkeiten** (wahrscheinlich nötig):
- **Kontextgebundener Output**: Flow B & Flow C müssen in einen bestehenden Event-Ordner schreiben (statt „neuen Root-Output“).
- **Flow C Aggregation**: Inputs aus mehreren Quellen (Original-Event + N Testimonials) müssen gebündelt und an LLM/Transformation übergeben werden.
- **Generischer Publish-Step** für „Publish final Event“:
  - ruft Ingestion für Final an
  - ruft Delete für Original an
  - erzwingt `slug` Gleichheit im Final

**Risiko**:
- Wenn Wizard-Presets nicht ausreichen, braucht es neue Step-Presets oder eine „Custom Step“-Erweiterung.

### 5.2 Backend/API

Für die Event/Testimonial-Beziehung braucht das Frontend klare APIs. Zwei mögliche Richtungen:

1) **Index-basiert (empfohlen, konsistent zum Explorer):**
- Endpoint „Testimonials zu Event“: Query im Index nach `docType='testimonial'` und `parentId=<eventFileId>` (oder `parentSlug/eventId`).

2) **Filesystem-basiert (nur wenn Index nicht reicht):**
- Endpoint liest Storage-Ordner `events/<slug>/testimonials/...` und liefert Liste + Streaming URLs.

Zusätzlich nötig:
- **Upload/Save Testimonial** (Audio + Metadaten) als Server-Route, die sauber authorisiert (anonym erlaubt, aber nur für spezifischen Event-Kontext).
  - Hier ist Security besonders wichtig (Rate Limits, Event-Token oder zumindest event-spezifische Write-Grenzen).

### 5.3 Event Detail UI (SessionDetail)

SessionDetail (`src/components/library/session-detail.tsx`) zeigt aktuell:
- Titel/Teaser
- PDF-Link (falls `url`)
- Markdown (aus `data.markdown` oder `data.summary`)

Erweiterungen für euer Ziel:
- **QR-Block** oben (nur Moderator):
  - braucht Auth-Infos + Owner/Moderator Check
- **Testimonials-Block**:
  - Liste + Audioplayer/Quotes/Summaries
  - optional „Start Finalize/Close“-CTA (Moderator)
- **Final-Status**:
  - UI unterscheidet: „open“ vs „final published“

Wichtig: Der Explorer-Overlay nutzt aktuell `IngestionSessionDetail` (nicht direkt `SessionDetail`). Wir müssen analysieren, wo genau wir UI einhängen:
- Entweder in `IngestionSessionDetail` (wahrscheinlich), oder
- in einer höheren Schicht, die die Daten zusammenführt.

## 6) Offene Fragen (noch nicht validiert)

Diese Punkte müssen vor Implementierung geklärt oder per Test verifiziert werden:

- **Flow B/C als Template-Wizards**: Wenn Flow B (Testimonial-Erfassung) und Flow C (Finalisierung/Publikation) zwingend über den Creation-Wizard laufen sollen, muss klar sein, ob diese Flows
  - nur für angemeldete User (Moderator/Owner) gedacht sind, oder
  - auch „öffentlich“/anonym laufen sollen (dann brauchen wir eine Public-Variante des Wizards oder einen separaten Public-Wrapper).
- **Template-Samples vs. Mongo Templates**: `template-samples/*` sind nur Beispiele. Für die echte Wizard-Auswahl müssen diese Templates in MongoDB importiert werden (Creation-Typen werden aus Templates mit `creation`-Block abgeleitet).
- **Slug-Constraints im Index**: Gibt es eine garantierte Eindeutigkeit? Oder können zwei Dokumente mit gleichem `slug` parallel existieren?
- **Welche Felder bestimmt die Gallery-Karte?** (`DocCardMeta` kommt aus Item-Mapping; docType/parentId existieren, müssen aber konsistent befüllt werden.)
- **Wie sauber können wir „Original aus Index löschen“ identifizieren?** (fileId ist eindeutig; slug wäre nur sekundär.)
- **Auth für anonyme Testimonials**: Login ist für Moderator entschieden, aber anonyme Writes brauchen trotzdem eine Absicherung (mindestens event-spezifische Begrenzung).

## 7) Testplan (minimal, aber aussagekräftig)

### Unit/Integration
- Slug-Erzeugung + Stabilität (Original vs Final)
- Index-Swap-Logik: ingest + delete in definierter Reihenfolge (inkl. Fehlerfall-Handling)
- Parent-Relation: testimonial.parentId (oder eventId) wird konsistent gesetzt und kann abgefragt werden

### Smoke-Test (manuell)
1. Event via Flow A erstellen → erscheint in Explorer.
2. Als Moderator Event öffnen → QR sichtbar. Als anon öffnen → QR nicht sichtbar.
3. Per QR Testimonial aufnehmen → Artefakte landen im Event-Ordner.
4. Flow C starten → Final-Run-Dateien werden geschrieben, erscheinen aber **nicht** im Explorer.
5. „Publish final“ → Original verschwindet aus Explorer, Final erscheint mit gleichem slug/„Platz“.

