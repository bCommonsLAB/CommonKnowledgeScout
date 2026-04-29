# Characterization Tests: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28. Ergebnis von Schritt 3 (Methodik
[`docs/refactor/playbook.md`](../playbook.md)).

## Zweck

Vor dem `file-list.tsx`-Modul-Split (Schritt 4b) brauchen wir ein
**Sicherheitsnetz**, das das aktuelle Verhalten der Schale und des
Library-Loaders festschreibt. Die Tests folgen Michael Feathers
*Working Effectively with Legacy Code*: sie pruefen das Ist-Verhalten,
nicht das Wunsch-Verhalten.

Pre-Run-Status (laut [`00-audit.md`](./00-audit.md)): **0 direkte Tests**
fuer die 16 Welle-3-I-Files.
Post-Run-Status: **10 neue Test-Files mit insgesamt 40 Tests**, alle
gruen.

## Neue Test-Files

| Test-File | Tests | Welche Datei sichert er ab? | Vertrag |
|---|---:|---|---|
| [tests/unit/components/library/upload-dialog.test.tsx](../../../tests/unit/components/library/upload-dialog.test.tsx) | 3 | `src/components/library/upload-dialog.tsx` | Dialog-Open/Close, `getPathById`-Aufloesung |
| [tests/unit/components/library/library-switcher.test.tsx](../../../tests/unit/components/library/library-switcher.test.tsx) | 3 | `src/components/library/library-switcher.tsx` | Render mit aktiver Library, leere Liste, korrupte Eintraege |
| [tests/unit/components/library/library-shell.test.tsx](../../../tests/unit/components/library/library-shell.test.tsx) | 3 | `src/components/library/library.tsx` | Status-Branches `waitingForAuth`, `providerLoading`, `ready` |
| [tests/unit/components/library/library-header.test.tsx](../../../tests/unit/components/library/library-header.test.tsx) | 4 | `src/components/library/library-header.tsx` | Action-Buttons, Tree/Compact-Toggle, Children, Error-Alert |
| [tests/unit/components/library/library-page.test.tsx](../../../tests/unit/components/library/library-page.test.tsx) | 5 | `src/app/library/page.tsx` | 5 Status-Branches: Loading, Auth-Fehler, Storage-Fehler, Empty, Render |
| [tests/unit/components/library/create-library-dialog.test.tsx](../../../tests/unit/components/library/create-library-dialog.test.tsx) | 4 | `src/components/library/create-library-dialog.tsx` | Open-State, Clone-Checkbox-Bedingung, Cancel-Callback |
| [tests/unit/components/library/file-tree.test.tsx](../../../tests/unit/components/library/file-tree.test.tsx) | 4 | `src/components/library/file-tree.tsx` | Render aus `folderItemsAtom`, Shadow-Twin-Filter (Filesystem-Modus + Mongo-Modus) |
| [tests/unit/components/library/file-list-render.test.tsx](../../../tests/unit/components/library/file-list-render.test.tsx) | 3 | `src/components/library/file-list.tsx` | Render-Smoke, leerer State, Header-Buttons |
| [tests/unit/components/library/file-list-filter.test.tsx](../../../tests/unit/components/library/file-list-filter.test.tsx) | 6 | `sortedFilteredFilesAtom` (Filter-Vertrag der Liste) | Folder-Filter, Dotfile-Filter, Search-Substring, Sort, Category-Filter |
| [tests/unit/components/library/file-list-selection.test.tsx](../../../tests/unit/components/library/file-list-selection.test.tsx) | 5 | `selectedBatchItemsAtom` + `selectedTransformationItemsAtom` | Bulk-Selection-Vertrag |

## Was diese Tests **NICHT** abdecken (bewusst)

Die Tests fixieren **das aktuelle Verhalten der Render-Vertraege und
des State-Vertrags**, nicht das vollstaendige Interaktions-Verhalten:

- **Drag&Drop-Verhalten** in `file-tree.tsx` / `file-list.tsx` —
  zu spezifisch fuer Layout/Maus-Events, getestet am UI-Smoke (Schritt 5).
- **Shadow-Twin-Analyse-Logik** im `useShadowTwinAnalysis`-Hook — der
  Hook wird gemockt (gehoert in eigene Welle 1).
- **Upload-Verhalten** in `upload-area.tsx` — die `react-dropzone`-
  Integration wird gemockt; UI-Smoke prueft echten Upload.
- **API-Calls** in `create-library-dialog.tsx` `handleCreate` —
  ist Backend-Integration, gehoert in Welle 1/2.
- **Komplette `FileList`-Komponente** mit allen 89 Hooks — bewusst
  nicht E2E gepruft, weil sonst der Modul-Split blockiert waere.
  Die Filter-/Selection-Atoms sind der externe Vertrag, der genuegt.

## Mocking-Strategie

Konsistent ueber alle Tests:

- `next/navigation` → `useRouter`/`useSearchParams`/`usePathname`-Stubs.
- `useStorage()` aus `@/contexts/storage-context` → vi.fn() mit
  konkretem Return-Value pro Test.
- Sub-Komponenten wie `UploadDialog`, `AudioRecorderClient`,
  `SplitPdfPagesButton`, `FilePreview` (via `next/dynamic`) → einfache
  data-testid-Stubs.
- Jotai-State via `createStore()` + `<Provider store={store}>` → jeder
  Test hat seinen eigenen, unabhaengigen Store.
- `window.matchMedia` → Polyfill in `library-shell.test.tsx`, weil
  jsdom es nicht hat und `library.tsx:105` darauf zugreift.

## Setup-Vorbild

Folgt dem Pattern von
[`tests/unit/components/app-layout.test.tsx`](../../../tests/unit/components/app-layout.test.tsx):

```tsx
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ /* ... */ }))

describe('Komponente', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())
  it('...', () => { /* ... */ })
})
```

## Verifikation

```bash
pnpm vitest run tests/unit/components/library/
```

**Vor Schritt 3**: 0 Tests (siehe `00-audit.md`).
**Nach Schritt 3**: `Test Files  10 passed (10) | Tests  40 passed (40)`.

## Bezug zur Audit-Tabelle

Audit-Aktionen aus [`00-audit.md`](./00-audit.md) in Schritt 3:

- 5 vorhandene UI-Tests `keep` → **unangetastet** (Sicherheitsnetz).
- 8+ Char-Tests fuer Welle-3-I → **erstellt** (10 Files, 40 Tests).
- Keine `migrate`-Tests in dieser Welle (Audit hat keine identifiziert).
- Keine `delete`-Tests (kommen in Schritt 6, falls knip etwas findet).
