# User-Test-Plan: Welle 3-II — Archiv-Detail (Vorbereitungs-PR)

Stand: 2026-04-29. Erstellt fuer User-Verifikation NACH dem Cloud-Agent-Lauf,
BEVOR der PR nach `master` gemerged wird.

## Ziel

Diese PR ist die Vorbereitungs-PR der Welle 3-II. Sie enthaelt:
- Pre-Flight-Doku (README, AGENT-BRIEF, 01-inventory)
- Audit + Contracts + Char-Tests fuer 7 kleinere Files
- 7 leere Catches eliminiert
- 1 Storage-Branch migriert auf Helper

Die Modul-Splits der 4 Hot-Spots (`file-preview.tsx`,
`markdown-preview.tsx`, `job-report-tab.tsx`, `media-tab.tsx`) kommen in 4
SEPARATEN Cloud-Lauefe danach (3-II-a/b/c/d). **Diese PR aendert keinen
sichtbaren UI-Code.**

## Was wurde im Code geaendert

| # | Aenderung | Datei | Test-Risiko |
|---|---|---|---|
| 1 | 7 leere Catches durch Logging ersetzt | `file-preview.tsx`, `markdown-preview.tsx` (3x), `audio-transform.tsx`, `video-transform.tsx`, `pdf-transform.tsx` | sehr gering — beobachtbares Verhalten identisch, nur Console-Logs koennen erscheinen |
| 2 | Storage-Branch auf Helper migriert | `shared/freshness-comparison-panel.tsx` | sehr gering — `isFilesystemBacked()` ist eine Pure Function aus Welle 1, im Storage-Char-Test gruen |
| 3 | Neue Cursor-Rule `welle-3-archiv-detail-contracts.mdc` | – | keiner |
| 4 | 7 neue Test-Files mit 30 Tests | `tests/unit/components/library/` | keiner |

**Was NICHT geaendert wurde (kommt in Sub-Wellen 3-II-a/b/c/d):**

- `file-preview.tsx`-Modul-Split (3.701 Zeilen, 66 Hooks) → Sub-Welle 3-II-a
- `markdown-preview.tsx`-Modul-Split → Sub-Welle 3-II-b
- `job-report-tab.tsx` + `media-tab.tsx`-Modul-Splits → Sub-Welle 3-II-c
- `*-detail.tsx`-Familie + `flow/*` + `shared/*`-Modul-Splits → Sub-Welle 3-II-d
- `'use client'`-Audit fuer Pre-Existing-Issues → Folge-Welle

## Phase A — Automatisierte Tests (3 Min)

```bash
pnpm install
pnpm test
```

**Erwartung:**
- Test Files **156 passed** (vorher 149 nach Welle 3-I, +7 neue)
- Tests **940 passed** (vorher 910 nach Welle 3-I, +30 neue)

```bash
pnpm vitest run tests/unit/components/library/
```

**Erwartung:** `Test Files 17 passed (17) | Tests 70 passed (70)`.

```bash
pnpm lint 2>&1 | grep -E "Error" | wc -l
```

**Erwartung:** 0 neue Errors in Welle-3-II-Files.

```bash
node scripts/ui-welle-3ii-stats.mjs | tail -1
```

**Erwartung:** `**Summe** | **20559** | **380** | **54** | **0** | **0** | **0**`

Kritische Werte:
- **catch{}: 0** (vorher 7) ✅
- **storage-branch: 0** (vorher 1) ✅

## Phase B — Build-Sanity-Check (3-5 Min)

```bash
pnpm build
```

**Erwartung:** Build laeuft durch.

## Phase C — UI-Smoke im Browser (10 Min, leicht)

Da diese PR keinen sichtbaren UI-Code aendert, reicht ein Kurz-Smoke:

### Smoke-Pfad C-1: File-Preview oeffnen

1. `/library` oeffnen, eine PDF/Markdown/Audio-Datei auswaehlen.
2. File-Preview rechts laedt, alle Tabs (Source, Transcript, Transformation,
   Story, Media) sind sichtbar.
3. Console: keine `Uncaught` / `Error`.

### Smoke-Pfad C-2: Quelle-Button (file-preview.tsx Catch-Fix)

1. In der File-Preview einer Quelldatei den "Quelle"-Button klicken.
2. Erwartung: Datei oeffnet sich in neuem Tab.
3. Bei Fehlschlag (z.B. virtuelle Mongo-ID): kein Crash, Console-Warning
   `[FilePreview] Quelle-Button: getStreamingUrl fehlgeschlagen` ist
   die neue Logging-Aenderung.

### Smoke-Pfad C-3: Audio/Video/PDF-Transform starten

1. Audio-Datei auswaehlen, "Transkribieren" klicken.
2. Job startet, Job-Monitor zeigt den Job sofort.
3. Console-Warning `job_update_local-Event konnte nicht gefeuert werden`
   ist nur dann sichtbar, wenn der Browser kein CustomEvent unterstuetzt
   (sehr selten).

### Smoke-Pfad C-4: Freshness-Panel im Debug-Footer (Storage-Branch-Fix)

1. Eine PDF/Audio-Datei mit Shadow-Twin auswaehlen.
2. Debug-Footer oeffnen → Shadow-Twin-Tab.
3. Freshness-Comparison-Panel sichtbar.
4. Bei Filesystem-backed Library: Storage-Spalte sichtbar.
5. Bei Mongo-only Library: Storage-Spalte NICHT sichtbar.
6. Verhalten muss identisch sein wie vor diesem Refactor.

### Smoke-Pfad C-5: Markdown-Preview mit Code-Block

1. Eine Markdown-Datei mit einem Code-Block (z.B. `python`) oeffnen.
2. Code-Block wird mit Syntax-Highlighting angezeigt.
3. Bei seltenen Token-Fehlern (kein Crash, nur weniger Highlighting) —
   das ist der gefixte Catch-Pfad.

## Phase D — Befund + Sign-off

| Phase | Pfad | Status | Befund |
|---|---|---|---|
| A | `pnpm test` | TBD | TBD |
| A | `pnpm lint` | TBD | TBD |
| A | `node scripts/ui-welle-3ii-stats.mjs` | TBD | TBD |
| B | `pnpm build` | TBD | TBD |
| C-1 | File-Preview rendert | TBD | TBD |
| C-2 | Quelle-Button | TBD | TBD |
| C-3 | Transform startet | TBD | TBD |
| C-4 | Freshness-Panel Storage-Spalte | TBD | TBD |
| C-5 | Markdown-Code-Block | TBD | TBD |

**Bei rotem Befund**: Cloud-Agent (`refactor/welle-3-archiv-detail`)
re-aktivieren mit konkretem Reproducer.

**Sign-off**:

- [ ] Phase A gruen
- [ ] Phase B gruen
- [ ] Phase C kein Regress
- [ ] User-OK fuer Merge nach `master`

Nach dem Merge: 4 Sub-Wellen 3-II-a/b/c/d als getrennte Cloud-Lauefe
starten (siehe `AGENT-BRIEF.md` Sektion "Sub-Wellen-Briefs").
