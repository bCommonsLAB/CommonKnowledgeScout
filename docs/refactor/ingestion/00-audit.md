# Bestands-Audit: Modul `ingestion`

Stand: 2026-04-27. Erstellt vom IDE-Agent (Welle 3, Plan-Schritt 0).

Bezug:
- AGENT-BRIEF: [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)
- Inventur: [`01-inventory.md`](./01-inventory.md)
- Vorbild: [`docs/refactor/shadow-twin/00-audit.md`](../shadow-twin/00-audit.md) (Welle 2)

## Zusammenfassung

| Bereich | Eintraege | keep | update | merge | migrate | delete | archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cursor Rules | 5 | 4 | 1 | 0 | 0 | 0 | 0 |
| Tests | 0 (keine direkten) + 1 verwandt | 1 | 0 | 0 | 0 | 0 | 0 |
| Docs | 7 | 5 | 1 | 0 | 0 | 0 | 1 |
| **Summe** | **13** | **10** | **2** | **0** | **0** | **0** | **1** |

**Kritische Findings**:

- **Null direkte Tests** im Modul (`tests/unit/ingestion/` existiert nicht).
  Ein verwandter Test in `tests/unit/markdown/markdown-page-splitter.test.ts`
  testet `splitMarkdownByPageMarkers` aus `src/lib/markdown/`, **nicht**
  `splitByPages` aus `src/lib/ingestion/page-split.ts`. Das ist ein
  potenzielles Duplikat — siehe Abschnitt "Doppelte Implementierung".
- Es gibt **keine modul-spezifische Contract-Rule** fuer `ingestion`. Die
  bestehende [`ingest-mongo-only.mdc`](../../../.cursor/rules/ingest-mongo-only.mdc)
  ist Pipeline-Ebene (Wizard, External-Jobs), nicht modul-spezifisch.
- **`image-processor.ts` ist 781 Zeilen** und hat mehrere bewusste
  `try/catch`-Bloecke mit Logging (z.B. MongoDB-Fragment-Lookup-Fehler in
  Zeile 242-249). Diese sind **nicht** silent — sie loggen via `FileLogger`
  und fallen auf den normalen Upload-Pfad zurueck. Das muss in der neuen
  `ingestion-contracts.mdc` als bewusster Vertrag verankert werden.
- **Doku-Drift erkannt**: `docs/analysis/ingestion.md` (Stand 2026-01-04)
  ist mittlerweile teilweise veraltet — nennt `src/lib/chat/ingestion-service.ts`
  als Hauptentrypoint, beschreibt aber nicht die Helper unter `src/lib/ingestion/`.
  Aktion: `update` in Schritt 2/4.

## A. Cursor Rules

In Scope: alle Rules, die `ingestion`, `ingest`, oder konkret die Files
unter `src/lib/ingestion/` referenzieren.

| Rule-Datei | Bezug zum Modul | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [.cursor/rules/ingest-mongo-only.mdc](../../../.cursor/rules/ingest-mongo-only.mdc) | indirekt (Pipeline-Ebene; Globs auf Wizard/External-Jobs, nicht auf `src/lib/ingestion/**`) | aktuell | **update** (optional) | Glob-Liste koennte um `src/lib/ingestion/**/*.ts` erweitert werden, damit Code-Aenderungen in `image-processor.ts` o.ae. die Rule triggern. Nicht Pflicht in Welle 3. |
| [.cursor/rules/contracts-story-pipeline.mdc](../../../.cursor/rules/contracts-story-pipeline.mdc) | indirekt (deckt Pipeline mit ab, ingestion-Phase darin) | aktuell | **keep** | Globaler Pipeline-Contract; bleibt unangetastet. |
| [.cursor/rules/external-jobs-integration-tests.mdc](../../../.cursor/rules/external-jobs-integration-tests.mdc) | indirekt (Phase `phase-ingest.ts` nutzt ingestion) | aktuell | **keep** | Bleibt unangetastet. |
| [.cursor/rules/media-lifecycle.mdc](../../../.cursor/rules/media-lifecycle.mdc) | indirekt (Bilder in `image-processor.ts` durchlaufen Lifecycle) | aktuell | **keep** | Bleibt unangetastet. |
| [.cursor/rules/detail-view-type-checklist.mdc](../../../.cursor/rules/detail-view-type-checklist.mdc) | indirekt (erwaehnt Ingestion am Rande) | aktuell | **keep** | UI-Checklist; bleibt unangetastet. |

### Update-Detail (optional in Welle 3)

`ingest-mongo-only.mdc` koennte Glob auf `src/lib/ingestion/**/*.ts`
erweitern. Das ist **Komfort** — die Rule wuerde dann auch greifen, wenn
jemand in `image-processor.ts` einen Filesystem-Fallback einbauen wollte.
Wird in Schritt 2 entschieden; bei Zeitknappheit nicht Pflicht.

### Neu zu erstellen (Schritt 2)

- `.cursor/rules/ingestion-contracts.mdc` — modul-spezifische
  Contract-Rule, Globs `["src/lib/ingestion/**/*.ts"]`. Komplementaer
  zu den oben genannten Pipeline-/Lifecycle-Rules.

## B. Tests

In Scope: alle Tests in `tests/unit/ingestion/` (existiert NICHT)
plus verwandte Tests, die ingestion-Code indirekt pruefen.

| Test-Datei | Testet welchen Code | Code existiert? | Vertrag korrekt? | Aktion |
|---|---|---|---|---|
| (kein File in `tests/unit/ingestion/`) | — | — | — | — |
| [tests/unit/markdown/markdown-page-splitter.test.ts](../../../tests/unit/markdown/markdown-page-splitter.test.ts) | `splitMarkdownByPageMarkers` aus `src/lib/markdown/markdown-page-splitter.ts` | ja, **anderes Modul** | ja | **keep** (testet `markdown`, nicht `ingestion`) |

### Doppelte Implementierung (Watchpoint!)

Es existieren **zwei aehnliche Funktionen** mit unterschiedlichen Namen:

| Funktion | Datei | Was sie tut |
|---|---|---|
| `splitByPages` | `src/lib/ingestion/page-split.ts` (40 Z.) | Liefert `PageSpan[]` mit `startIdx`/`endIdx` |
| `splitMarkdownByPageMarkers` | `src/lib/markdown/markdown-page-splitter.ts` | Liefert vermutlich `Page[]` mit `pageNumber`/`content` |

Beide parsen das gleiche Marker-Format `--- Seite N ---`. **Ist das eine
Duplikat-Drift?** Antwort offen. Pruefen in Schritt 4 (Altlast-Pass §5
Duplikate). **Nicht Pflicht in Welle 3** — falls die zwei Funktionen
unterschiedliche Aufrufer mit unterschiedlichen Vertraegen haben, ist es
keine Drift.

### Test-Coverage-Luecke (Pflicht in Schritt 3)

Alle 7 Files in `src/lib/ingestion/` brauchen mindestens 1 Test-File.
Reihenfolge nach Komplexitaet:

| Datei | Zeilen | Pflicht-Tests |
|---|---:|---|
| `image-processor.ts` | 781 | **3+** (markdown, slides, cache); aufwaendigste Datei |
| `vector-builder.ts` | 127 | **2-3** (extractFacetValues + buildVectorDocuments) |
| `document-text-builder.ts` | 104 | **2-3** (mit/ohne Felder) |
| `meta-document-builder.ts` | 95 | **2-3** (Default-Werte, Roundtrip) |
| `metadata-formatter.ts` | 87 | **2-3** (leeres Objekt, voller Pfad) |
| `page-split.ts` | 40 | **2-3** (kein Marker, mehrere Seiten) |
| `ingest-meta-keys.ts` | 6 | **0** (nur Konstante, nicht testpflichtig) |

Mindestens **15 neue Tests** in **6 neuen Test-Files**.

## C. Docs

In Scope: alle Files in `docs/`, die `ingestion` als primaeres oder
sekundaeres Thema haben.

| Doc-Datei | Beschreibt was | Status | Aktion | Begruendung |
|---|---|---|---|---|
| [docs/analysis/ingestion.md](../../analysis/ingestion.md) | Runtime-Beschreibung der Ingestion (Mongo-Collections, Failures, Debugging) | teilweise veraltet (Stand 2026-01-04) | **update** | Hauptentrypoint genannt: `src/lib/chat/ingestion-service.ts`. Helper unter `src/lib/ingestion/` werden nicht erwaehnt. Update in Schritt 4 oder Folge-PR. |
| [docs/rules/ingest-mongo-only.md](../../rules/ingest-mongo-only.md) | Begleit-Doku zur Rule `ingest-mongo-only.mdc` | aktuell | **keep** | Mirror-Doku zur Rule, beide bleiben gepflegt. |
| [docs/architecture/mongodb-vector-search.md](../../architecture/mongodb-vector-search.md) | MongoDB Vector Search Konzept | unbekannt (nicht voll gelesen) | **keep** | Architektur-Reference; ingestion-Modul ist Konsument, nicht Quelle. |
| [docs/architecture/artifact-pipeline-v3-design.md](../../architecture/artifact-pipeline-v3-design.md) | Pipeline-Design v3 | unbekannt | **keep** | Pipeline-Architektur; ingestion ist eine Phase darin. |
| [docs/architecture/pipeline-phases.md](../../architecture/pipeline-phases.md) | Pipeline-Phasen-Reference | unbekannt | **keep** | Pipeline-Phasen, ingestion = `phase-ingest`. |
| [docs/analysis/markdown-processing-pipeline.md](../../analysis/markdown-processing-pipeline.md) | Markdown-Verarbeitungs-Pipeline | unbekannt | **archive** (Folge-PR) | Per Konvention `docs/analysis/*` = Diskussions-Snapshot. Folge-PR. |
| [docs/analysis/dual-save-transcript-vs-transformation.md](../../analysis/dual-save-transcript-vs-transformation.md) | Dual-Save-Diskussion | unbekannt | **keep** | Erwaehnt ingestion am Rande, nicht primaeres Thema. |

### Out of Scope

Andere Files erwaehnen ingestion nur als Querreferenz und werden NICHT in Welle 3 angefasst:

- `docs/architecture/shadow-twin.md` — shadow-twin-Welle (Welle 2, gemerged)
- `docs/architecture/pdf-transformation-phases.md` — PDF-Welle
- `docs/use-cases/*` — use-case-Welle
- `docs/_chats/*` und `docs/_analysis/*` — historische Notizen, per Naming-Konvention archiviert
- `docs/architecture/finalize-wizard-requirements.md` — wizard-Welle (Welle 3d)

## Audit -> Folge-Schritte

| Audit-Aktion | Folge-Schritt | Wo umgesetzt | In Welle 3? |
|---|---|---|---|
| Rule `ingestion-contracts.mdc` neu anlegen | Schritt 2 | direkt | **ja** |
| Rule `ingest-mongo-only.mdc` -> Glob auf `src/lib/ingestion/**` erweitern (optional) | Schritt 2 | direkt | nice-to-have |
| 6 neue Test-Files mit 15-25 Tests | Schritt 3 | direkt | **ja** |
| Pure Helper aus `image-processor.ts` extrahieren | Schritt 4 | direkt | **ja** |
| Duplikat-Verdacht `splitByPages` vs. `splitMarkdownByPageMarkers` pruefen | Schritt 4 | direkt | **ja** (Analyse + Notiz) |
| Doc `docs/analysis/ingestion.md` -> **update** mit Helper-Files | Schritt 4 oder 6 | direkt (Doku-Hygiene) | **ja** |
| Doc `docs/analysis/markdown-processing-pipeline.md` -> **archive** | spaeter | Folge-PR | **nein** |
