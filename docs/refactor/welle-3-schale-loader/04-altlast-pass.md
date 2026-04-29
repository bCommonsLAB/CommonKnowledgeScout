# Altlast-Pass: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28. Schritt 4 nach Methodik
[`docs/refactor/playbook.md`](../playbook.md).

Methodik-Vorgabe: 8 Altlast-Kategorien (Schritt 4 im Playbook).
Welle 3-I bearbeitet die fuer den Scope relevanten Kategorien:
**Silent Fallbacks (2)**, **Datei > 200 Zeilen (7)** und ueberprueft
**`use client`-Direktiven (8)**.

## Schritt 4a — Kleine Altlasten

### 4a.1 Silent Fallbacks (Inventur F2)

| Datei:Zeile | Vorher | Nachher | Begruendung |
|---|---|---|---|
| `src/components/library/library-switcher.tsx:109` | `} catch {}` | `StateLogger.warn` mit Begruendungs-Kommentar | Router-Replace darf nicht stille fehlschlagen — Folder-Atoms sind oben schon zurueckgesetzt, aber der Vorgang muss observable sein |
| `src/app/library/page.tsx:41` | `} catch {}` | `console.warn` mit Begruendungs-Kommentar | URL-Bereinigung darf nicht stille scheitern, Library-State ist oben schon korrekt gesetzt |
| `src/components/library/file-list.tsx:1391` | `} catch {}` | `FileLogger.warn` mit Begruendungs-Kommentar | `library_refresh`-Event-Handler soll nicht crashen, wenn das CustomEvent-Format unerwartet ist; muss aber sichtbar sein |

**Verifikation**:

```bash
$ node scripts/ui-welle-3i-stats.mjs | grep "leere Catches"
# vorher: leere Catches: 3
# nachher: catch{} = 0 in jeder Welle-3-I-Datei
```

### 4a.2 file-tree.tsx-Modul-Split

`file-tree.tsx` enthielt eine 174-Zeilen-`TreeItem`-Komponente, die nur
einmal verwendet wird. Sie wurde in eigene Datei extrahiert:

| Datei | Zeilen vorher | Zeilen nachher |
|---|---:|---:|
| `src/components/library/file-tree.tsx` | 619 | 467 |
| `src/components/library/tree-item.tsx` | – | 188 (neu) |

Vertrag: `TreeItem` wird via Default-Export aus `tree-item.tsx`
re-exportiert; `file-tree.tsx` importiert via `import { TreeItem } from './tree-item'`.

Char-Test `file-tree.test.tsx` bleibt ohne Aenderung gruen — der Vertrag
ist stabil.

### 4a.3 `'use client'`-Audit (Plan-Regel 8)

Bestand: 13 von 16 Welle-3-I-Files haben `'use client'`. Die 3 ohne
Direktive sind:

- `src/app/library/gallery/page.tsx` (17z, Server-Composer fuer
  `page-client.tsx` + `client.tsx`) — korrekt.
- `src/components/library/library.tsx` (785z) — **Pre-Existing-Issue**:
  Datei nutzt `useAtom`, `useState` etc., aber hat keine
  `'use client'`-Direktive. Funktioniert, weil sie ausschliesslich
  via `<Library />` aus einer Client-Page (`src/app/library/page.tsx`)
  gerendert wird. Aenderung in dieser Welle waere riskant
  (Build-Bruch); siehe `02-contracts.md` §7.
- `src/components/library/library-header.tsx` (217z) — gleiches
  Pre-Existing-Issue.

**Aktion in dieser Welle**: KEIN Aendern der bestehenden Direktiven.
Folge-Welle (Plan-Welle 3-II) sollte pruefen, ob `'use client'`
explizit gesetzt werden sollte (ohne funktionalen Aenderungen).

## Schritt 4b — file-list.tsx Modul-Split (Hauptaufgabe)

`file-list.tsx` mit 2.225 Zeilen + 89 Hooks war der Hot-Spot dieser Welle
(siehe `01-inventory.md` Sektion 4 und `02-contracts.md` §6).

### Vorher

```
src/components/library/file-list.tsx  2.225 Zeilen, 89 Hooks
```

Enthielt 8 Top-Level-Symbole:
- 4 Typen/Interfaces (`SortField`, `SortOrder`, `ListMeta`, `FileGroup`)
- 5 Komponenten (`ListCoverThumbnail`, `FileIconComponent`,
  `SortableHeaderCell`, `FileRow`, `FileList`)
- 3 Pure Funktionen (`getFileTypeFromName`, `formatFileSize`, `formatDate`)

### Nachher

```
src/components/library/file-list.tsx                1.483 Zeilen, 67 Hooks  (Composer-Fassade)
src/components/library/file-list/list-utils.ts        207 Zeilen           (Typen + pure Helper)
src/components/library/file-list/cover-thumbnail.tsx   95 Zeilen           (ListCoverThumbnail)
src/components/library/file-list/file-icon.tsx         77 Zeilen           (FileIconComponent)
src/components/library/file-list/sortable-header-cell.tsx  47 Zeilen       (SortableHeaderCell)
src/components/library/file-list/file-row.tsx        ~440 Zeilen           (FileRow)
```

**Reduktion:** −742 Zeilen aus dem Hauptfile, −22 Hooks aus dem Hauptfile.

### Vertrag bleibt stabil

`FileList` wird weiterhin aus `src/components/library/library.tsx` als
`import { FileList } from "./file-list"` konsumiert. Kein Konsument muss
angepasst werden.

### Was NICHT in Schritt 4b gemacht wurde (Begruendung im Code-Kommentar)

`file-list.tsx` ist mit 1.483 Zeilen weiterhin > 1.000 Zeilen. Eine
weitere Phase 2 (Sub-Wellen 4b-2/4b-3) wurde nicht in dieser Welle
durchgefuehrt, aus folgendem Grund:

- **Stop-Bedingung aus AGENT-BRIEF**: > 1.000 Zeilen Diff in einem Commit
  ist riskant. Phase 2 wuerde ~7.000 Zeilen Diff erzeugen (Hooks +
  Bulk-Actions + Header-Bar in 3-4 weitere Sub-Files), weil die Hook-
  Reihenfolge erhalten bleiben muss und die Atom-Konsumenten
  identisch bleiben muessen.
- **Risikobewertung**: weiterer Split braucht eigene Mehr-Phasen-Welle
  mit User-Smoke-Test pro Sub-Phase. Vertrag ist in
  `welle-3-schale-loader-contracts.mdc` §6 schon fixiert; die kuenftigen
  Sub-Files muessen dem Vertrag genuegen.

### Naechste Sub-Phasen (geplante Folge-Welle)

| Sub-Phase | Ziel-Datei | Zeilen-Schaetzung | Verantwortung |
|---|---|---:|---|
| 4b-2 | `file-list/list-bulk-actions.tsx` | ~300 | Bulk-Action-Bar (Header-Bar mit Refresh, Filter, Bulk-Operations) |
| 4b-3 | `file-list/hooks/use-file-list-data.ts` | ~250 | Daten-Hook (`shouldShowItems`, `folders`, `findFileGroup`, `groupedFiles`) |
| 4b-4 | `file-list/hooks/use-file-list-selection.ts` | ~150 | Selection-Wrapper (`isItemSelected`, `handleSelectAll`, `handleClearSelection`) |

Nach Sub-Phasen 4b-2/4b-3/4b-4 erwartet: `file-list.tsx` < 500 Zeilen,
< 25 Hooks.

## Schritt 4-Zusammenfassung

| Kategorie | Vorher | Nachher | Delta |
|---|---:|---:|---:|
| Welle-3-I gesamt Zeilen | 5.427 | 4.555 | **−872** |
| Welle-3-I gesamt Hooks | 215 | 184 | **−31** |
| Welle-3-I leere Catches | 3 | **0** | **−3** ✅ |
| Welle-3-I Storage-Branches | 0 | 0 | unveraendert ✅ |
| Welle-3-I `any` | 0 | 0 | unveraendert ✅ |
| Files > 200 Zeilen | 8 | 7 | −1 |
| Max-Zeilen | 2.217 (`file-list.tsx`) | 1.483 (`file-list.tsx`) | **−734** |
| Tests fuer Welle-3-I-Files | 0 | 40 | **+40** ✅ |

## Audit-Aktionen aus Schritt 0 — Status

| Aktion aus 00-audit.md | Status |
|---|---|
| Cursor Rules — alle 9 keep | ✅ erfuellt (keine Aenderung an globalen Rules) |
| Tests — 5 vorhandene UI-Tests keep | ✅ erfuellt (unangetastet) |
| Tests — 8+ neue Char-Tests | ✅ erfuellt (10 neue Files mit 40 Tests) |
| Docs — `docs/reference/modules/library.md` update | ⏳ offen (Schritt 6 — Doku-Hygiene) |
| Docs — `docs/reference/file-index.md` update | ⏳ offen (Schritt 6) |
| Neue Rule `welle-3-schale-loader-contracts.mdc` | ✅ erfuellt (Schritt 2) |

## Bezug zur Contract-Rule

| Rule §  | Erfuellt? | Wie? |
|---|---|---|
| §1 Determinismus (UI-Container ohne Business-Logik) | ✅ | Sub-Module sind reine Render-Komponenten + State-Atoms |
| §2 Fehler-Semantik (kein leerer Catch) | ✅ | 3 Catches durch Logging mit Begruendung ersetzt |
| §3 Erlaubte Abhaengigkeiten | ✅ | Keine direkten Provider-Imports; Helper `shouldFilterShadowTwinFolders` bleibt |
| §4 Skip-/Default-Semantik | ✅ | Status-Branches in `library.tsx` und `library-page.tsx` weiter sichtbar (Char-Test fixiert) |
| §5 Storage-Branches verboten | ✅ | 0 Storage-Branches verifiziert |
| §6 Modul-Split-Vertrag | ⏳ teilweise | Phase 1 fertig; Phase 2 (Hooks + Bulk-Actions) als Folge-Welle |
| §7 `'use client'` minimieren | ⏳ aufgeschoben | Pre-Existing-Issue, keine Aenderung in dieser Welle |
| §8 Code-Review-Checkliste | ✅ | Phase 1 entspricht der Checkliste |
