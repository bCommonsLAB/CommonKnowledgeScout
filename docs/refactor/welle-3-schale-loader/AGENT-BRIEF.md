# Cloud-Agent-Brief: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28. Erstellt vom IDE-Agenten (Pre-Flight, erste UI-Welle).

## Kontext (lies das ZUERST)

1. **Methodik & Workflow-Regeln**: [`docs/refactor/playbook.md`](../playbook.md) — Workflow-Regeln R1-R5 (kein Parallelismus, ein Test-Cycle, User-Verifikation Pflicht).
2. **Pilot-Vorlage**: [`docs/refactor/external-jobs/`](../external-jobs/) und [`docs/refactor/storage/`](../storage/) — komplette Doku-Serie als Muster.
3. **Plan-Bezug**: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md) Sektion 5 (Welle 3-I).
4. **Architektur-Rules** (alle `alwaysApply: true`):
   - [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) — UI darf Storage-Backend nicht kennen
   - [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) — keine leeren Catches
   - [`media-lifecycle.mdc`](../../../.cursor/rules/media-lifecycle.mdc) — Frontmatter enthaelt nur Dateinamen
5. **Inventur** (schon erstellt): [`01-inventory.md`](./01-inventory.md) — verifizierte Health-Zahlen + Hot-Spots.
6. **AGENTS.md** im Repo-Root — verbindliche Regeln fuer alle Agenten.
7. **Erste UI-Welle**: Es gibt noch keine UI-Refactor-Vorlage. Backend-Vorlagen (`storage`, `chat`) sind die Methodik-Vorlage; Test-Setup orientiert sich an `tests/unit/components/app-layout.test.tsx`.

## Aufgabe

Du bist **EIN** Cloud-Agent (kein Parallelismus, R2). Du arbeitest die 8 Schritte der Methodik **seriell** durch fuer Welle 3-I (16 Files, 5.427 Zeilen, siehe [`01-inventory.md`](./01-inventory.md)).

Output landet in `docs/refactor/welle-3-schale-loader/00-audit.md`, `02-contracts.md`, `03-tests.md`, `04-altlast-pass.md`, `05-user-test-plan.md`, `06-acceptance.md` (Nummerierung 02-06, weil 01 schon existiert).

Code-Aenderungen landen direkt in `src/components/library/`, `src/app/library/`, neue Tests in `tests/unit/components/library/`. Eine modul-spezifische Contract-Rule `.cursor/rules/welle-3-schale-loader-contracts.mdc` wird neu erstellt.

## Schritt-fuer-Schritt-Ablauf

### Schritt 0 — Bestands-Audit

- File: `docs/refactor/welle-3-schale-loader/00-audit.md`
- 3 Tabellen (Rules, Tests, Docs) wie in [Pilot-Vorlage](../external-jobs/00-audit.md)
- **Rules**: Mindestens pruefen `storage-abstraction.mdc`, `no-silent-fallbacks.mdc`, `media-lifecycle.mdc`, plus alle `.cursor/rules/*.mdc`, die UI/Library-Schale erwaehnen.
- **Tests**: Alle 5 Tests in `tests/unit/components/` pruefen, Aktion (`keep` fuer alle ausser ggf. testimonial-list — verifizieren).
- **Docs**: `docs/architecture/*.md`, `docs/reference/*.md` — Doku, die App-Schale oder Library-Loader beschreibt.
- **Vorab-Bestaetigung** (vom IDE-Agenten geklaert): es gibt aktuell **0 Vitest-Tests** fuer die 16 Welle-3-I-Files (siehe `01-inventory.md` Sektion 2). Das ist der Char-Test-Backlog fuer Schritt 3.

### Schritt 1 — Inventur

- File: `docs/refactor/welle-3-schale-loader/01-inventory.md` **existiert bereits** (vom IDE-Agenten geschrieben, verifizierte Stats via `scripts/ui-welle-3i-stats.mjs`).
- Du kannst Spalten ergaenzen oder die Hot-Spot-Analyse vertiefen.

### Schritt 2 — Contracts

- Neue Rule: `.cursor/rules/welle-3-schale-loader-contracts.mdc`
- Globs: `["src/components/library/library*.tsx", "src/components/library/file-list.tsx", "src/components/library/file-tree.tsx", "src/components/library/upload*.tsx", "src/components/library/create-library-dialog.tsx", "src/app/library/**/*.tsx"]`
- Mindestens definieren:
  - **§1 Determinismus**: App-Schale und Library-Loader sind UI-Container. Keine Business-Logik (gehört in `src/lib/library`, `src/lib/storage`, `src/lib/services/library-service.ts`).
  - **§2 Fehler-Semantik**: Fehler in Library-Lade-Pfaden werden via React-Error-Boundary oder explizit via UI-Toast gemeldet, **niemals** in leeren Catches verschluckt.
  - **§3 Erlaubte/verbotene Abhaengigkeiten**: UI-Container darf NICHT direkt von `src/lib/storage/[provider].ts` abhängen — nur ueber `StorageFactory` / `useStorageProvider()`. Verifizieren mit `rg "from '@/lib/storage/(filesystem|nextcloud|onedrive)" src/components/library`.
  - **§4 Skip-/Default-Semantik**: Was zeigt die Schale, wenn die aktive Library nicht geladen werden kann? (verboten: silent leerer State; erlaubt: dokumentiertes Fehler-UI mit Logging).

### Schritt 3 — Characterization Tests

Pflicht-Subset (vor jedem Modul-Split in Schritt 4):

1. `tests/unit/components/library/file-list-render.test.tsx` — Render mit Mock-Library, prueft mind. 3 erwartete Sektionen
2. `tests/unit/components/library/file-list-filter.test.tsx` — Filter/Search-Verhalten
3. `tests/unit/components/library/file-list-selection.test.tsx` — Bulk-Selection-State
4. `tests/unit/components/library/file-tree-render.test.tsx`
5. `tests/unit/components/library/library-shell.test.tsx` — Layout-Wrapper
6. `tests/unit/components/library/library-switcher.test.tsx`
7. `tests/unit/components/library/upload-dialog.test.tsx` — Upload-Trigger
8. `tests/unit/components/library/create-library-dialog.test.tsx`

Setup: Vitest + `@testing-library/react`. Vorbild: `tests/unit/components/app-layout.test.tsx`. Mocks: Storage-Provider als Fake-Provider mocken (siehe Welle 1 `storage`), keine echten API-Calls.

**Wichtig**: Char-Tests muessen **vor** dem `file-list.tsx`-Split gruen sein. Sie sind das Sicherheitsnetz fuer Schritt 4.

### Schritt 4 — Altlast-Pass (in zwei Sub-Phasen)

#### 4a — Kleine Altlasten (alle ausser file-list)

1. Drei leere Catches beheben (vom IDE-Agenten verifiziert):
   - `src/components/library/library-switcher.tsx:109`
   - `src/app/library/page.tsx:41`
   - `src/components/library/file-list.tsx:1391` — wird in 4b im Split mit-betrachtet
   Ersatz: `console.warn` mit Begruendungs-Kommentar oder `throw` mit fachlich passendem Error-Type.
2. Pruefen ob `library.tsx` (785 Zeilen) splittbar ist:
   - Vermutlich `library/library-shell.tsx` (Layout), `library/library-data-loader.ts` (Daten-Hooks), `library/library-active-state.ts` (Active-Library-Reducer/Context)
   - Char-Test `library-shell.test.tsx` muss gruen bleiben
3. `file-tree.tsx` (619 Zeilen) — wenn Drag&Drop und Render trennbar: zwei Sub-Files
4. Pruefen, ob die 13 `'use client'`-Direktiven wirklich noetig sind. Server-Komponenten bevorzugen, wo moeglich (Plan-Regel 8).

#### 4b — `file-list.tsx`-Modul-Split (Hauptaufgabe)

`file-list.tsx` mit 89 Hooks ist der Schluessel-Refactor dieser Welle. Ziel: max. 200 Zeilen pro Sub-Datei.

Vorgeschlagene Struktur (Cloud-Agent verfeinert nach Audit):

```
src/components/library/file-list/
  index.tsx                      # Composer / Fassade (~150 Zeilen)
  list-render.tsx                # Render der Liste, Tabelle/Grid-Switch
  list-filter.tsx                # Filter/Search-UI + URL-Sync
  list-selection.tsx             # Bulk-Selection-State (Reducer + Context)
  list-bulk-actions.tsx          # Action-Bar fuer Bulk-Operations
  list-drag-drop.tsx             # Drag&Drop-Handler
  hooks/use-file-list-data.ts    # Daten-Hook (Fetch + Cache)
  hooks/use-file-list-filter.ts  # Filter-Hook
  hooks/use-file-list-selection.ts
  hooks/use-file-list-upload.ts
```

Char-Tests aus Schritt 3 muessen nach jedem Sub-Split gruen bleiben (test-driven). Pro Sub-File ein eigener Commit.

**NICHT in dieser Welle** (Folge-Wellen):
- Galerie-Komponenten (Welle 3-III)
- Detail-View / Preview (Welle 3-II)
- Settings (Welle 3-IV)

### Schritt 5 — Strangler-Fig

In Welle 3-I voraussichtlich nicht noetig — die 16 Files sind in-place refaktorierbar. Falls beim Modul-Split unklar wird, ob der alte Pfad noch genutzt wird: `@deprecated`-Markierung + Logging einsetzen (analog Backend-Wellen).

### Schritt 6 — Dead-Code

- `pnpm knip` laufen lassen (Filter auf `src/components/library/library*.tsx`, `src/components/library/file-list*`, `src/app/library/`)
- Audit-Findings mit Status `delete` aus Schritt 0 hier umsetzen
- Doku-Hygiene: nach Modul-Split die Verweise in `docs/architecture/*.md`, `docs/reference/*.md` aktualisieren

### Schritt 7 — Abnahme

Du fuellst BEIDE DoD-Teile (R5):

**Methodik-DoD**:
- Alle 6 Doku-Files vorhanden (`00-audit.md` bis `06-acceptance.md`)
- `welle-3-schale-loader-contracts.mdc` existiert
- Char-Tests existieren (>= 8 neue Test-Files, siehe Schritt 3)

**Modul-DoD** (in DIESER Welle erreichbar):
- `pnpm test` gruen (Anzahl Tests vorher dokumentieren, danach + neue Tests)
- `pnpm lint` ohne neue Errors (Warnings okay)
- `node scripts/ui-welle-3i-stats.mjs` zeigt nach Refactor:
  - Max-Zeilen pro Datei: < 250 (nicht zwingend < 200, aber dokumentierte Ausnahme)
  - **`> 200 Zeilen`: ≤ 4** (von 8 jetzt, durch Splits min. 4 Files raus)
  - leere Catches: 0 (statt 3)
  - Storage-Branches: 0 (bleibt 0)
- `tests/unit/components/library/file-list-*.test.tsx` existieren mit ≥ 3 Tests pro File

### Schritt 5 (User-Test-Plan, nicht Strangler-Fig)

- File: `docs/refactor/welle-3-schale-loader/05-user-test-plan.md` (Vorlage: [storage/05](../storage/05-user-test-plan.md))
- Phase A (autom. Tests via Vitest)
- Phase B (Build-Sanity via `pnpm build`)
- Phase C (UI-Smoke im Browser, **zwingend lokal**, siehe Plan-Sektion 8.6):
  - Library-Liste rendert (Filesystem + Nextcloud/OneDrive falls vorhanden)
  - Library wechseln via library-switcher
  - Datei in der Liste markieren (Single + Bulk)
  - Datei via Upload-Dialog hochladen
  - Neue Library via create-library-dialog anlegen (Filesystem)
  - file-tree zeigt verschachtelte Ordner an
- Phase D (Befund + Sign-off)

## Push-Strategie (R1, R4)

**Du PUSHST NICHT auf master.** Stattdessen:

- Eigener Branch: `refactor/welle-3-schale-loader`
- Commit pro Schritt (`welle-3-i(audit): ...`, `welle-3-i(tests): ...`, `welle-3-i(altlast-4a): ...`, `welle-3-i(altlast-4b): file-list split`, etc.)
- 1 PR am Ende, alle Schritte enthaltend
- Kein Auto-Merge — User reviewt, smoke-testet im Browser nach `05-user-test-plan.md`, merged dann selbst.

## Stop-Bedingungen

Stoppe und melde dem User, wenn:
- `> 1.000 Zeilen Diff` in einem Commit (zu riskant, splitte) — gilt insbesondere fuer den `file-list.tsx`-Split
- Tests werden rot und du findest die Ursache nicht in 30 Min
- React-Error-Boundary-Fehler im UI nach Refactor — erst mit User klaeren, nicht raten
- Architektur-Frage auftritt, die nicht im Brief geklaert ist (z.B. "soll `library.tsx` Server- oder Client-Komponente werden?" — Default: Server, falls moeglich)
- Storage-Provider-Live-Calls werden noetig — verboten, sauber mocken (siehe Welle 1)
- App-Router-Konvention von Next.js wird durch Modul-Split gebrochen (z.B. `page.tsx` umbenennen)

## Daten zum Mitnehmen

- Repo: `bCommonsLAB/CommonKnowledgeScout`, default branch `master`
- Aktueller Stand `master`: Wellen 0-2 abgenommen (mit dokumentiertem Backend-Drift, siehe Plan-Sektion 5)
- Test-Setup: `pnpm install` (Node 20+, pnpm 9.15.3)
- Tools:
  - `pnpm test` — Vitest
  - `pnpm lint` — ESLint
  - `pnpm health` — Backend-Module (UI ist nicht erfasst, deshalb das spezifische Skript:)
  - `node scripts/ui-welle-3i-stats.mjs` — Welle-3-I-Stats
  - `pnpm knip` — Dead-Code
- **Keine** Live-Storage-Provider-Calls, keine Live-Mongo-Calls (siehe AGENTS.md)
