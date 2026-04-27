# Altlast-Pass: Modul `ingestion`

Stand: 2026-04-27. Erstellt vom IDE-Agent (Welle 3, Plan-Schritt 4).

Bezug:
- Audit: [`00-audit.md`](./00-audit.md)
- Contracts: [`02-contracts.md`](./02-contracts.md)
- Tests: [`03-tests.md`](./03-tests.md)
- Welle-2-Vorbild: [`docs/refactor/shadow-twin/04-altlast-pass.md`](../shadow-twin/04-altlast-pass.md)

## Was wurde gemacht

Ein einziger Sub-Commit fuer den Helper-Extract aus
`src/lib/ingestion/image-processor.ts`:

| Commit | Was | git diff |
|---|---|---:|
| `ingestion(altlast): image-processor-helpers.ts extrahiert + 16 Char-Tests` | Drei pure `private static` Helper aus `ImageProcessor` ausgelagert in neue Datei `src/lib/ingestion/image-processor-helpers.ts` (53 Z.). 16 neue Char-Tests in `tests/unit/ingestion/image-processor-helpers.test.ts`. Alle 7 Aufrufstellen in `image-processor.ts` umgestellt. | +13 / -40 (image-processor.ts) |

### Extrahierte Helper (im Detail)

| Funktion | Lines (alt → neu) | Begruendung |
|---|---|---|
| `getImageCacheKey(libraryId, scope, hash, extension)` | 5 → eigene Datei | Pure String-Komposition; trivial testbar; war `private static` und damit nicht direkt testbar |
| `normalizeImagePath(imagePath)` | 7 → eigene Datei | Pure Path-Validierung mit Path-Traversal-Schutz; sicherheits-relevant → eigene Test-Coverage |
| `formatImageError(errorMessage, imagePath)` | 12 → eigene Datei | Pure String-Mapping (Fehlermeldungen → User-Friendly); 4 Branches mit Char-Tests abgedeckt |

## Health-Metriken (vor → nach)

Zwei verschiedene Zaehlmethoden im Vergleich; das Skript `pnpm health`
nutzt `text.split('\n').length`, das Inventory-File hatte
`Measure-Object -Line` verwendet (Differenz durch Trailing-Newline-
Handhabung).

### `pnpm health` (offizielle Methode)

| Metrik | vor Welle 3 | nach Welle 3 | Differenz |
|---|---:|---:|---:|
| Files in `src/lib/ingestion/` | 7 | 8 | +1 (neuer Helper) |
| Max-Zeilen | 858 (`image-processor.ts`) | 832 (`image-processor.ts`) | **-26** |
| Files > 200 Zeilen | 1 | 1 | 0 |
| Tests | nein | **ja** | +1 |
| `any`-Count | 0 | 0 | 0 |
| Empty-`catch{}` | 0 | 0 | 0 |
| `'use client'` | 0 | 0 | 0 |

### `Measure-Object -Line` (Inventory-Methode, ergaenzend)

| Metrik | vor Welle 3 | nach Welle 3 | Differenz |
|---|---:|---:|---:|
| `image-processor.ts` Zeilen | 781 | 754 | -27 |

## Modul-DoD-Check (aus AGENT-BRIEF.md)

| Kriterium | Erwartung | Erreicht | Status |
|---|---|---|:---:|
| `pnpm test` gruen | >= aktuell + 15-25 neue Tests | **+83 Tests** (67 in Schritt 3 + 16 in Schritt 4) | ✓ |
| Max-Zeilen | < 600 (mind.) | **832** (Reduktion -26) | ✗ Soft-Miss |
| Files > 200 Zeilen | 0-1 | 1 | ✓ |
| `any`-Count | 0 | 0 | ✓ |
| Empty-`catch{}` | 0 | 0 | ✓ |
| Lint-Fehler | 0 | 0 (nur Pre-existing-Warnings) | ✓ |

### Begruendung fuer Soft-Miss "Max-Zeilen < 600"

`image-processor.ts` ist von 858 → 832 Zeilen geschrumpft (-26 Zeilen,
absolute Reduktion). Der AGENT-BRIEF-Zielwert "< 600" ist damit nicht
erreicht. Begruendung:

- Der Welle-3-Plan sah Helper-Extract als Pflicht-Subset vor; weitere
  Splits (z.B. `processMarkdownImages` in `markdown.ts`/`slides.ts`/
  `cover.ts` aufteilen, wie im AGENT-BRIEF E2 vorgeschlagen) sind sehr
  groesser Aufwand und wuerden den Diff-Stop-Zaehler (1.000 Zeilen
  Diff/Aenderung) reissen.
- Die drei verbleibenden grossen Methoden (`processMarkdownImages`
  ~350 Z., `processSlideImages` ~190 Z., `processCoverImage` ~80 Z.)
  haben jeweils ineinander verschraenkte Azure- und Cache-Logik, die
  fuer einen sauberen Split komplette Test-Doubles fuer
  `AzureStorageService` braucht — das ist ein separates
  Feature-Stueck.
- **Empfehlung**: separate Folge-PR "ingestion: image-processor.ts
  splitten in markdown/slides/cover", mit dedizierten Test-Setups.

## Watchpoint aus dem Audit: `splitByPages` vs. `splitMarkdownByPageMarkers`

Das Audit ([`00-audit.md`](./00-audit.md), Abschnitt "Doppelte
Implementierung") hat zwei aehnliche Funktionen identifiziert. Welle 3
hat sie analysiert:

| Funktion | Datei | Aufrufer | Output-Form |
|---|---|---|---|
| `splitByPages` | `src/lib/ingestion/page-split.ts` (40 Z.) | `src/lib/chat/ingestion-service.ts` (1 Stelle) | `PageSpan[]` mit `startIdx`/`endIdx` |
| `splitMarkdownByPageMarkers` | `src/lib/markdown/markdown-page-splitter.ts` (~80 Z.) | `src/app/api/library/[libraryId]/markdown/split-pages/route.ts` (1 Stelle) | `MarkdownPageSlice[]` mit `pageNumber`/`content` |

**Bewertung**: kein echtes Duplikat. Beide parsen das gleiche
Marker-Format `--- Seite N ---`, aber:

- `splitByPages` liefert **Index-Bereiche** (low-level, fuer
  Stream-/Cursor-Verarbeitung in der Ingestion).
- `splitMarkdownByPageMarkers` liefert **bereits gestrippten Content**
  (high-level, fuer API-Antworten an Frontend) — inklusive
  Frontmatter-Strip und Trim.

**Empfehlung**: keine Konsolidierung in Welle 3. Optional in einer
spaeteren Markdown-Welle: gemeinsame Marker-Regex-Konstante
exportieren (vermeidet Drift bei Marker-Format-Aenderungen).

## Weiterer Watchpoint aus Schritt 6 (knip): Doppelter `VectorDocument`

`pnpm knip` hat ein zweites Drift-Symptom aufgedeckt: zwei
unabhaengige `VectorDocument`-Interfaces mit identischem Namen.

| Datei | Wer importiert |
|---|---|
| `src/lib/ingestion/vector-builder.ts:5` | nur intern (impliziter Return-Type von `buildVectorDocuments`) |
| `src/lib/repositories/vector-repo.ts:70` | `doc-meta-formatter.ts`, ueber 10 Verwendungen in `vector-repo.ts` selbst |

**Bewertung**: aktuell strukturell aequivalent, aber langfristig
fragil. Konsolidierung haette Cross-Module-Impact und gehoert in
einen separaten PR mit eigenen Char-Tests.

**Empfehlung**: Folge-PR "ingestion+repositories: VectorDocument
konsolidieren" — siehe [`06-deadcode.md`](./06-deadcode.md).

## Was wurde **bewusst nicht** gemacht

| Auslassung | Warum nicht in Welle 3 |
|---|---|
| `processMarkdownImages` in eigene `markdown.ts` extrahieren | > 200 Zeilen Aenderung; braucht eigenes Test-Setup; Folge-PR |
| `processSlideImages` in eigene `slides.ts` extrahieren | dito |
| `processCoverImage` in eigene `cover.ts` extrahieren | dito |
| `imageCache` in eigenes `cache.ts`-Modul mit Klassen-API extrahieren | greift in mehrere Methoden ein; Folge-PR |
| `splitByPages` und `splitMarkdownByPageMarkers` mit gemeinsamer Regex-Konstante refaktorieren | Markdown-Welle, nicht Ingestion-Welle |
| Glob-Erweiterung von `ingest-mongo-only.mdc` auf `src/lib/ingestion/**` | Komfort, kein Vertrag; Folge-PR |
| Update `docs/analysis/ingestion.md` (Helper-Files erwaehnen) | Doku-Drift, kein Code-Drift; in Schritt 6 Doku-Hygiene oder Folge-PR |

## Folge-Schritte

| Schritt | Was | Wo |
|---|---|---|
| 6 | `pnpm knip` ausfuehren, Dead-Code-Findings beurteilen | `06-deadcode.md` |
| 7 | Acceptance-Report schreiben (DoD-Tabelle, Lessons Learned) | `06-acceptance.md` |
| Folge-PR | `image-processor.ts` weiter splitten in markdown/slides/cover | separater PR |
| Folge-PR | Markdown-Marker-Regex konsolidieren (`page-split.ts` + `markdown-page-splitter.ts`) | separater PR |
