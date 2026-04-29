# User-Test-Plan: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28. Erstellt fuer User-Verifikation NACH dem
Cloud-Agent-Lauf, BEVOR der PR nach `master` gemerged wird.
Bezug: [`06-acceptance.md`](./06-acceptance.md), Playbook R3.

## Ziel

Welle 3-I ist die **erste UI-Welle** des Refactor-Programms. Die Aenderungen
betreffen die App-Schale und den Library-Loader — also die zentralen
Render-Knoten der Library-Page. Vor dem Merge muss der User lokal
verifizieren, dass:

- die wichtigsten Library-UseCases funktionieren (Library wechseln,
  Datei oeffnen, Upload, Tree-Navigation),
- die Render-Pipeline keinen visuellen Regress hat,
- keine Console-Errors im Browser auftauchen.

## Was wurde im Code geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | 3 leere Catches durch Logging ersetzt | `library-switcher.tsx:109`, `app/library/page.tsx:41`, `file-list.tsx:1391` | sehr gering — beobachtbares Verhalten identisch, nur Console-Logs koennen jetzt erscheinen |
| 2 | `TreeItem` aus `file-tree.tsx` in eigene Datei `tree-item.tsx` ausgegliedert | `file-tree.tsx` (-151z), `tree-item.tsx` (+188z, neu) | gering — identische Render-Logik, Char-Test gruen |
| 3 | `file-list.tsx`-Modul-Split Phase 1: 5 Sub-Komponenten in `file-list/` | `file-list.tsx` (-742z), `file-list/list-utils.ts`, `file-list/cover-thumbnail.tsx`, `file-list/file-icon.tsx`, `file-list/sortable-header-cell.tsx`, `file-list/file-row.tsx` (alle neu) | mittel — `FileRow` enthaelt Drag&Drop, Long-Press, Rename, Bulk-Selection. Char-Tests pruefen Filter+Selection-Vertraege via Atoms, aber das Render-Verhalten muss visuell verifiziert werden |
| 4 | Neue Cursor-Rule `welle-3-schale-loader-contracts.mdc` | `.cursor/rules/welle-3-schale-loader-contracts.mdc` | keiner — nur Rule, kein Code-Verhalten |

**Was NICHT geaendert wurde (Folge-Wellen):**

- `library.tsx`-Modul-Split (785 Zeilen) — riskant, weil viele
  Race-Conditions im `loadItems()`-Pfad. Folge-Welle.
- `file-list.tsx` Phase 2 (Header-Bar / Bulk-Actions / Daten-Hooks) —
  separate Welle 3-I-b mit eigenem Char-Test-Setup.
- `'use client'`-Audit fuer `library.tsx` und `library-header.tsx`
  (Pre-Existing-Issue, siehe `04-altlast-pass.md`).
- Storage-Branches (waren schon 0).

---

## Phase A — Automatisierte Tests (3 Min)

Im Projekt-Root:

```bash
pnpm install
pnpm test
```

**Erwartung:**
- Test Files **149 passed (149)** (vorher 139, +10 neue Welle-3-I-Tests)
- Tests **910 passed (910)** (vorher 870, +40 neue Tests)

```bash
pnpm vitest run tests/unit/components/library/
```

**Erwartung:** `Test Files 10 passed (10) | Tests 40 passed (40)`.

```bash
pnpm lint 2>&1 | grep -E "Error" | wc -l
```

**Erwartung:** 0 neue Errors. Bestehende Warnings (z.B. `no-empty` in
`external-jobs/`, `react-hooks/exhaustive-deps` in `library.tsx`)
bleiben — diese werden in eigenen Folge-Wellen aufgeraeumt.

```bash
node scripts/ui-welle-3i-stats.mjs
```

**Erwartung** (siehe `04-altlast-pass.md`):
- Files: 16 (unveraendert)
- Welle-3-I gesamt Zeilen: ~4.555 (vorher 5.427, **−872**)
- **Leere Catches: 0** (vorher 3) ← Modul-DoD-Ziel erfuellt
- Storage-Branches: 0 (unveraendert)
- `any`: 0 (unveraendert)
- `file-list.tsx`: 1.483 Zeilen (vorher 2.225)
- `file-tree.tsx`: 467 Zeilen (vorher 619)

---

## Phase B — Build-Sanity-Check (3-5 Min)

Damit fehlende Imports oder TypeScript-Fehler nicht erst im
Production-Build auffliegen:

```bash
pnpm build
```

**Erwartung:** Build laeuft durch, keine TypeScript-Fehler, kein
"Module not found" auf die neuen Pfade
(`./tree-item`, `./file-list/list-utils`, `./file-list/file-row`, ...).

**Bei Fehlern:** Im Output nach Imports der alten Symbol-Namen suchen:

```bash
grep -r "ListCoverThumbnail\|FileIconComponent\|SortableHeaderCell\|FileRow" src --include="*.tsx" --include="*.ts" | grep -v "file-list/"
```

Diese sollten nur intern in `file-list.tsx` als Re-Exports erscheinen.

---

## Phase C — UI-Smoke im Browser (zwingend lokal, ~15 Min)

Plan-Sektion 8.6 fordert visuelle Abnahme im Browser fuer UI-Refactors.

### Vorbereitung

```bash
pnpm dev
```

Browser oeffnen, mit Clerk anmelden, Library-Seite oeffnen.
**WICHTIG**: Browser-DevTools (F12) → Console-Tab offen halten, um
Errors / Warnings sofort zu sehen.

### Smoke-Pfad C-1: Library-Liste rendert (Filesystem-Backend)

1. `/library` oeffnen.
2. Library-Switcher (oben links) zeigt aktive Library?
3. Datei-Liste zeigt mindestens eine Datei?
4. Console: keine `Uncaught` / `Error`?

**Erwartung**: Library-Header, FileTree (links), FileList (mitte)
sichtbar. Keine Layout-Sprunge.

### Smoke-Pfad C-2: Library wechseln

1. Library-Switcher klicken.
2. Andere Library aus dem Dropdown waehlen.
3. Eintraege in der Liste aendern sich.
4. URL: `?folderId=` ist weg, nur `/library`.
5. Console: kein Crash bei `localStorage.setItem` oder `router.replace`
   (sind jetzt mit Logging statt stillem Catch).

**Bei Console-Warning** wie `[LibrarySwitcher] router.replace
fehlgeschlagen ...`: das ist die neue Logging-Aenderung — sichtbar,
aber nicht funktional kaputt.

### Smoke-Pfad C-3: Datei in Liste markieren (Single + Bulk)

1. Eine Datei in der Liste anklicken → Vorschau (rechts) oeffnet sich.
2. Checkbox einer Audio/Video-Datei aktivieren → Bulk-Selection
   sichtbar (Header-Bar mit Bulk-Actions erscheint).
3. Checkbox einer PDF/Markdown-Datei aktivieren → andere Bulk-Actions
   erscheinen.
4. Mehrere Checkboxes mischen → beide Bulk-Action-Sets sichtbar.

**Erwartung**: Selektion bleibt nach Folder-Navigation erhalten.

### Smoke-Pfad C-4: Datei via Doppelklick umbenennen

1. Datei-Namen doppelklicken → Inline-Input erscheint.
2. Neuen Namen eingeben + Enter → API-Call wird ausgeloest, Liste
   aktualisiert.
3. Bei abhaengigen Dateien (Transcript, Transformation) → Toast-Hinweis
   "Bitte Haupt-Datei umbenennen".

### Smoke-Pfad C-5: Datei hochladen via Upload-Dialog

1. Header → Upload-Button (Cloud-Icon).
2. Dialog oeffnet, Zielverzeichnis wird angezeigt
   (`getPathById`-Aufloesung).
3. Datei droppen oder via Datei-Auswahl waehlen.
4. Upload-Button klicken → Progress-Anzeige.
5. Nach Erfolg: Dialog schliesst, Liste zeigt neue Datei.

### Smoke-Pfad C-6: Neue Library anlegen via create-library-dialog

1. Library-Switcher → "Neue Bibliothek erstellen".
2. Dialog oeffnet sich.
3. Name eingeben (>= 3 Zeichen).
4. ggf. "Konfiguration klonen" aktivieren.
5. Erstellen → API-Call, Toast "Bibliothek erstellt", Wechsel zur
   neuen Library.
6. Settings-Page wird geoeffnet (Navigation in `LibrarySwitcher`).

### Smoke-Pfad C-7: file-tree zeigt verschachtelte Ordner

1. Im FileTree (links) auf einen Ordner mit Chevron klicken
   (Aufklappen).
2. Children werden geladen (Cache oder API).
3. Verschachtelten Ordner aufklappen → 2-Level-Hierarchie sichtbar.
4. Shadow-Twin-Ordner (Praefix `_`) sind im Filesystem-Modus
   ausgeblendet, im Mongo-Modus sichtbar.

### Smoke-Pfad C-8: file-tree Drag&Drop (optional)

1. Datei aus FileList ueber einen Ordner im FileTree ziehen.
2. Drop → Datei wird verschoben (oder die ganze FileGroup, wenn
   Basis-Datei).
3. Liste aktualisiert sich.

---

## Phase D — Befund + Sign-off

### Befund-Tabelle (User fuellt aus)

| Phase | Pfad | Status | Befund |
|---|---|---|---|
| A | `pnpm test` | TBD | TBD |
| A | `pnpm lint` | TBD | TBD |
| A | `node scripts/ui-welle-3i-stats.mjs` | TBD | TBD |
| B | `pnpm build` | TBD | TBD |
| C-1 | Library-Liste rendert | TBD | TBD |
| C-2 | Library wechseln | TBD | TBD |
| C-3 | Datei markieren (Single + Bulk) | TBD | TBD |
| C-4 | Doppelklick-Rename | TBD | TBD |
| C-5 | Upload via Dialog | TBD | TBD |
| C-6 | Create-Library-Dialog | TBD | TBD |
| C-7 | file-tree verschachtelt | TBD | TBD |
| C-8 | Drag&Drop (optional) | TBD | TBD |

### Sign-off

- [ ] Phase A gruen
- [ ] Phase B gruen
- [ ] Phase C kein blockierender visueller Regress
- [ ] Console im Browser: keine `Uncaught` / `Error`
- [ ] User-OK: Welle 3-I darf nach `master` gemerged werden

**Bei rotem Befund**: Cloud-Agent (`refactor/welle-3-schale-loader`)
re-aktivieren mit dem gefundenen Reproducer und Korrektur in eigenem
Commit pushen lassen, BEVOR Merge.
