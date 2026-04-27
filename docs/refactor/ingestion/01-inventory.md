# Inventur: Modul `ingestion`

Stand: 2026-04-27. Erstellt vom IDE-Agent als Pre-Flight fuer Welle 3
(siehe [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)).

Quelle: `pnpm health -- --module ingestion` plus manuelle Test- und
Cross-Modul-Zuordnung.

## 1. Modul-Health-Zusammenfassung

| Modul | Files | Max-Zeilen (Datei) | > 200 Zeilen | hat Tests | any | leere catch{} | use client |
|---|---:|---|---:|---|---:|---:|---:|
| `ingestion` | 7 | 781 (`image-processor.ts`) | 1 | **nein** | 0 | 0 | 0 |

**Vergleich zu vorherigen Wellen**: deutlich kompakter als `shadow-twin`
(7 vs. 30 Files) und `storage` (15 Files). Strukturell sauber (0 `any`,
0 leere Catches), aber **null Tests** im Modul — Char-Tests sind die
Hauptarbeit der Welle.

## 2. Files in `src/lib/ingestion/`

Sortiert nach Zeilen, absteigend.

| Datei | Zeilen | hat direkten Test | Anmerkung |
|---|---:|---|---|
| `image-processor.ts` | 781 | nein | Klasse `ImageProcessor` mit statischen Methoden, Azure-Upload, Cache, Markdown/Slide/Cover-Bild-Verarbeitung |
| `vector-builder.ts` | 127 | nein | Embeddings/Vector-Aufbau |
| `document-text-builder.ts` | 104 | nein | Text-Aggregation pro Dokument |
| `meta-document-builder.ts` | 95 | nein | Meta-Dokument-Aggregation |
| `metadata-formatter.ts` | 87 | nein | Formatierung Mongo-Metadaten |
| `page-split.ts` | 40 | nein | Seiten-Split-Helper |
| `ingest-meta-keys.ts` | 6 | nein | Meta-Key-Konstanten |

**Test-Coverage**: 0 von 7 Files direkt getestet (~0 %). Das ist die
**oberste Prioritaet** in Welle 3 Schritt 3 (Char-Tests).

## 3. Aufrufer (Cross-Modul-Bezug)

`src/lib/ingestion/` wird genutzt von:

| Aufrufer | Datei | Anmerkung |
|---|---|---|
| `chat` | `src/lib/chat/ingestion-service.ts` | Hauptkonsument |
| `external-jobs` | `src/lib/external-jobs/phase-ingest.ts` | Pipeline-Phase |
| `shadow-twin` | `src/lib/shadow-twin/media-persistence-service.ts`, `src/lib/shadow-twin/shadow-twin-direct-upload.ts` | Cross-Modul |
| `types` | `src/types/item.ts` | Typ-Imports |

## 4. Zentrale Architektur-Rule(s)

Keine modul-spezifische Rule existiert. Verwandte Rules:

- [`ingest-mongo-only.mdc`](../../../.cursor/rules/ingest-mongo-only.mdc)
  (alwaysApply: false, globs auf `phase-shadow-twin-loader.ts`,
  Wizard-API). Erzwingt: **Alle ingestierten Artefakte muessen in MongoDB
  vorhanden sein, kein Fallback**.
- [`contracts-story-pipeline.mdc`](../../../.cursor/rules/contracts-story-pipeline.mdc)
  (alwaysApply: false). Globaler Pipeline-Contract.
- [`detail-view-type-checklist.mdc`](../../../.cursor/rules/detail-view-type-checklist.mdc)
  — erwaehnt Ingestion am Rande.

**Status fuer Audit**: keine bestehende ingestion-spezifische Rule. Eine
neue `.cursor/rules/ingestion-contracts.mdc` wird in Schritt 2 angelegt.

## 5. Hot-Spots fuer Welle 3

### 5.1 Pflicht-Char-Tests (Schritt 3)

| Datei | Begruendung |
|---|---|
| `image-processor.ts` (781 Z.) | Hauptlast, Azure-API + Cache, viele Pfade — mind. 5-8 Char-Tests |
| `vector-builder.ts` (127 Z.) | Embeddings-Aufbau, kritisch fuer RAG |
| `document-text-builder.ts` (104 Z.) | Text-Aggregation, Verbindung zu Chat |
| `meta-document-builder.ts` (95 Z.) | Meta-Aufbau, Verbindung zu Chat |
| `metadata-formatter.ts` (87 Z.) | Pure Funktionen, einfach zu testen |
| `page-split.ts` (40 Z.) | Pure Funktion, einfach zu testen |

### 5.2 Pflicht-Splits (Schritt 4)

| Datei | Zeilen | Vorschlag |
|---|---:|---|
| `image-processor.ts` | 781 | Splitten nach Verarbeitungs-Typ: `image-processor/markdown.ts`, `slides.ts`, `cover.ts`, `cache.ts`, `azure-upload.ts`. Klasse als Composer/Fassade belassen oder in pure Funktionen aufloesen |

### 5.3 Cross-Modul-Beobachtung

- `image-processor.ts` importiert `getShadowTwinBinaryFragments` aus
  `repositories/shadow-twin-repo.ts` — Abhaengigkeit zu `shadow-twin`
  (Welle 2, gerade gemerged).
- `vector-builder.ts` und Verwandte arbeiten direkt mit Mongo-Embeddings.

## 6. Bekannte Risiken / Watchpoints

- **`image-processor.ts` ist 781 Zeilen** — Hauptarbeit. Voller Split
  ohne Char-Tests ist riskant; Reihenfolge: erst Char-Tests, dann Split,
  dann ggf. weitere Tests pro Sub-Modul.
- **0 Tests im Modul** — Char-Test-Aufwand ist hoeher als in Welle 2 (die
  hatte 13 Bestands-Tests). Schritt 3 ist die Hauptarbeit dieser Welle.
- **Azure-API in `image-processor.ts`** — saubere Mocks Pflicht
  (`vi.mock('@/lib/services/azure-storage-service')`), keine Live-Calls.
- **Cross-Modul-Bezug zu `shadow-twin`** (Welle 2 gerade gemerged) — wenn
  Tests neue Importpfade nutzen, ggf. anpassen.
- **`ingest-mongo-only.mdc` Glob-Bezug** — die Rule referenziert
  `phase-shadow-twin-loader.ts`, NICHT `src/lib/ingestion/**`. Pruefe
  in Schritt 0, ob die Glob-Pfade aktualisiert werden sollten.
