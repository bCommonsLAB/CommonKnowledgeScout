# User-Test-Plan: Welle 3 — Modul `ingestion`

Stand: 2026-04-27. Erstellt fuer User-Verifikation NACH dem IDE-Agent-Lauf.
Bezug: [`06-acceptance.md`](./06-acceptance.md), Playbook R3,
Welle-2-Vorbild [`docs/refactor/shadow-twin/05-user-test-plan.md`](../shadow-twin/05-user-test-plan.md).

## Ziel

Bevor Welle 3 nach `master` gemerged wird, soll der User lokal verifizieren,
dass die wenigen Code-Aenderungen funktional unauffaellig sind. Welle 3 hat
am Modul `ingestion` ausschliesslich pure Helper extrahiert und Tests
ergaenzt — der Risiko-Footprint ist **sehr klein**.

## Was wurde im Code geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | Drei pure Helper (`getImageCacheKey`, `normalizeImagePath`, `formatImageError`) aus `image-processor.ts` extrahiert in neue Datei `src/lib/ingestion/image-processor-helpers.ts`. Aufrufer-Stellen (7 in derselben Datei) auf importierte Funktionen umgestellt. Logik unveraendert. | `src/lib/ingestion/image-processor-helpers.ts` (neu, +53 Z.), `src/lib/ingestion/image-processor.ts` (-40/+13 Z.) | sehr gering — Pure Funktionen, char-test-gruen mit 16 Tests |
| 2 | 7 neue Char-Test-Files (83 Tests) fuer `ingestion`-Modul: `page-split.test.ts`, `metadata-formatter.test.ts`, `document-text-builder.test.ts`, `meta-document-builder.test.ts`, `vector-builder.test.ts`, `image-processor.test.ts`, `image-processor-helpers.test.ts` | `tests/unit/ingestion/` (neu) | gering — nur Tests, kein Produktcode geaendert |
| 3 | Neue Cursor-Rule `.cursor/rules/ingestion-contracts.mdc` (7 Sektionen) | `.cursor/rules/` | keine — nur Regelwerk |
| 4 | Welle-3-Doku unter `docs/refactor/ingestion/` (5 Files: Audit, Contracts, Tests, Altlast, User-Test-Plan, Acceptance) | `docs/refactor/ingestion/` | keine — nur Doku |

**Was NICHT geaendert wurde (Folge-PRs):**

- Vollstaendiger Split von `image-processor.ts` (832 Z.) in
  `markdown.ts`/`slides.ts`/`cover.ts` — Folge-PR mit eigenen Mocks
  fuer `AzureStorageService`.
- `imageCache` in eigenes `cache.ts`-Modul auslagern.
- Konsolidierung der Marker-Regex zwischen
  `src/lib/ingestion/page-split.ts` und
  `src/lib/markdown/markdown-page-splitter.ts` (Watchpoint, Folge-PR).
- Update `docs/analysis/ingestion.md` (Helper-Files erwaehnen).
- Glob-Erweiterung von `ingest-mongo-only.mdc` auf `src/lib/ingestion/**`.

---

## Phase A — Automatisierte Tests (5 Min)

Im Projekt-Root:

```powershell
pnpm install
pnpm test
```

**Erwartung:**
- **594 / 594 Tests gruen** (vorher 511, +83 in Welle 3)
- Keine neuen Fehler

```powershell
pnpm lint
```

**Erwartung:** 0 neue Errors. Bestehende Warnings (Empty `catch{}`,
`@ts-expect-error`, etc.) sind erwartet und unveraendert.

```powershell
pnpm health
```

**Erwartung fuer Modul `ingestion`** (per Skript-Methode):
- Files: 8 (vorher 7, +1 Helper-File)
- Max-Zeilen: 832 (vorher 858, **-26 Zeilen**)
- Files > 200 Zeilen: 1 (unveraendert; `image-processor.ts` immer noch
  > 200 — vollstaendiger Split in Folge-PR)
- Tests: **ja** (vorher nein)
- `any`-Count: 0 (unveraendert)
- Leere `catch{}`: 0 (unveraendert)
- `'use client'`: 0 (unveraendert)

---

## Phase B — Build-Sanity-Check (3 Min)

```powershell
pnpm build
```

**Erwartung:** Build laeuft durch, keine TypeScript-Fehler, kein
"Module not found" auf den neuen `image-processor-helpers.ts`-Pfad.

---

## Phase C — Lokale UI-Smoke-Tests (10-20 Min)

App lokal starten (falls nicht ohnehin schon):

```powershell
pnpm dev
```

Fokus: alles, was Bild-Verarbeitung und Vector-Ingestion triggert.
Da Welle 3 nur Helper extrahiert hat, sind die Pfade indirekt:

| # | UseCase | Szenario | Warum dieser Test? | Kategorie |
|---|---|---|---|---|
| 1 | PDF mit Bildern hochladen + ingestieren | PDF mit eingebetteten Bildern in Library hochladen, Pipeline bis zur Ingestion durchlaufen lassen | Triggert `processMarkdownImages` → nutzt jetzt importierte `normalizeImagePath`, `getImageCacheKey`, `formatImageError` aus Helper-Datei | **MUSS gruen** |
| 2 | PDF mit Cover generieren | PDF mit `preview_001.jpg` in Library, Cover-Bild generieren | Triggert `processCoverImage` → indirekt Helper | **MUSS gruen** |
| 3 | Slides verarbeiten (falls Library hat) | Slide-basiertes Dokument hochladen | Triggert `processSlideImages` → indirekt Helper | sollte gruen |
| 4 | Pfad-Edge-Case mit `/leading/path/` | Manuell ein Bild-Asset mit komischem Pfad referenzieren | Triggert `normalizeImagePath` mit Slash-Stripping | nice-to-have |
| 5 | Pfad-Traversal-Versuch (gutartig) | Markdown mit `../foo.jpg`-Referenz | `normalizeImagePath` erkennt `..` → Result-Objekt mit `success: false` | nice-to-have |

**Minimales Smoke-Set** (5 Min): nur Test 1 (PDF-Ingestion).

### Was bei Failure beobachten

- **Build-Failure** (Phase B) → ist der neue Pfad
  `@/lib/ingestion/image-processor-helpers` korrekt aufloesbar?
  `pnpm build` mit `--debug` Flag pruefen.
- **PDF-Ingestion-Failure** (Test 1) → pruefe Log-Praefix `[file:ingestion]`
  in der Konsole. Bei Fehler: Stack-Trace muss auf Helper-Datei zeigen,
  nicht auf `image-processor.ts` (= Beweis, dass Refactor-Pfad wirkt).
- **Test-Failure** (Phase A) → vermutlich CRLF/LF-Konflikt durch Windows-
  Linebreaks. Falls `image-processor.ts` plotzlich anders aussieht als
  erwartet: `git checkout -- src/lib/ingestion/image-processor.ts` und
  Welle wiederholen.

Ergebnis dokumentieren wie in Welle 2.

---

## Phase D — Befund konsolidieren

### Option 1: Alles gruen → Welle 3 abgenommen

- Acceptance-Bericht (`06-acceptance.md`) bleibt wie ist
- PR mergen (Squash-Merge wie Welle 1+2)
- Folge-PRs (image-processor-Split, Marker-Regex, Doku-Update) in den
  Backlog

### Option 2: Failures, aber bekannt

- Befund in `05-user-test-plan.md` ergaenzen
- Welle als "best effort verifiziert" markieren

### Option 3: Echte Regression

- Konkreter Test + Stack-Trace in eine Mini-Welle "Welle 3 Hotfix"
- Lokal testen, push erst nach OK
- KEIN Merge nach `master` ohne Hotfix
