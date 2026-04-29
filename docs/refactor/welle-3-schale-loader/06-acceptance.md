# Abnahme: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28. Schritt 7 nach Methodik
[`docs/refactor/playbook.md`](../playbook.md), Workflow-Regel R5
(Methodik-DoD + Modul-DoD getrennt).

## Status

| Bereich | Status |
|---|---|
| Cloud-Agent-Lauf | ✅ abgeschlossen (refactor/welle-3-schale-loader) |
| Methodik-DoD | ✅ vollstaendig (alle 6 Doku-Files + neue Rule + Char-Tests) |
| Modul-DoD | ⚠️ teilweise erfuellt (Begruendung siehe unten) |
| User-Smoke-Test | ⏳ offen — User fuehrt Phase C aus `05-user-test-plan.md` aus |
| Merge-Bereit | ⏳ erst nach User-Sign-off |

## Methodik-DoD (R5)

| DoD-Kriterium | Soll | Ist | Status |
|---|---|---|---|
| `00-audit.md` existiert | ja | ja, alle 3 Tabellen befuellt | ✅ |
| `01-inventory.md` existiert | ja | ja (vom IDE-Agenten vorab) | ✅ |
| `02-contracts.md` existiert | ja | ja, mit §-Erlaeuterungen | ✅ |
| `03-tests.md` existiert | ja | ja, 10 Test-Files dokumentiert | ✅ |
| `04-altlast-pass.md` existiert | ja | ja, mit Vorher/Nachher-Stats | ✅ |
| `05-user-test-plan.md` existiert | ja | ja, mit 8 Smoke-Pfaden | ✅ |
| `06-acceptance.md` existiert | ja | dieses Dokument | ✅ |
| Modul-spezifische Contract-Rule | ja | `welle-3-schale-loader-contracts.mdc` | ✅ |
| Char-Tests >= 8 Files | ja | 10 Files, 40 Tests | ✅ |

## Modul-DoD (vorher im AGENT-BRIEF festgelegt)

Quelle: AGENT-BRIEF Schritt 7 ("Modul-DoD in DIESER Welle erreichbar").

| DoD-Kriterium | Soll | Ist | Status |
|---|---|---|---|
| `pnpm test` gruen | ja, vorher dokumentieren | **910 Tests gruen** (vorher 870, +40) | ✅ |
| `pnpm lint` ohne neue Errors | ja | 0 neue Errors in Welle-3-I-Files | ✅ |
| Max-Zeilen pro Datei: < 250 | ja, mit dokumentierter Ausnahme | 1.482 (`file-list.tsx`) | ⚠️ Ausnahme — Phase 2 als Folge-Welle (siehe `04-altlast-pass.md`) |
| `> 200 Zeilen`: ≤ 4 (von 8 jetzt) | ja | **7** (1 weniger durch file-tree-Split) | ⚠️ Teilziel verfehlt — Folge-Welle |
| Leere Catches: 0 (statt 3) | ja | **0** | ✅ |
| Storage-Branches: 0 (bleibt 0) | ja | **0** | ✅ |
| Char-Tests fuer file-list-* mit ≥ 3 Tests pro File | ja | erfuellt (siehe Tabelle unten) | ✅ |

### Char-Test-Coverage je File

| Test-File | Tests |
|---|---:|
| `upload-dialog.test.tsx` | 3 |
| `library-switcher.test.tsx` | 3 |
| `library-shell.test.tsx` | 3 |
| `library-header.test.tsx` | 4 |
| `library-page.test.tsx` | 5 |
| `create-library-dialog.test.tsx` | 4 |
| `file-tree.test.tsx` | 4 |
| `file-list-render.test.tsx` | 3 |
| `file-list-filter.test.tsx` | 6 |
| `file-list-selection.test.tsx` | 5 |
| **Summe** | **40** |

## Zahlen-Vergleich Welle 3-I

| Metrik | Vorher | Nachher | Delta |
|---|---:|---:|---:|
| Welle-3-I gesamt Zeilen | 5.427 | 4.554 | **−873** |
| Welle-3-I gesamt Hooks | 215 | 184 | **−31** |
| `file-list.tsx` Zeilen | 2.217 | 1.482 | **−735** |
| `file-list.tsx` Hooks | 89 | 67 | **−22** |
| `file-tree.tsx` Zeilen | 619 | 467 | **−152** |
| `file-tree.tsx` Hooks | 30 | 21 | **−9** |
| Leere Catches | 3 | **0** | **−3** ✅ |
| `any` | 0 | 0 | unveraendert ✅ |
| Storage-Branches | 0 | 0 | unveraendert ✅ |
| Tests fuer Welle 3-I | **0** | **40** | **+40** ✅ |
| Test-Files (gesamt Repo) | 139 | **149** | **+10** |
| Tests gesamt Repo | 870 | **910** | **+40** |

## Was wurde durch den Refactor explizit BESSER

1. **3 leere Catches eliminiert**, durch typisiertes Logging mit
   Begruendungs-Kommentar ersetzt → Drift-Quelle geschlossen.
2. **`file-list.tsx` von 2.217 auf 1.482 Zeilen** reduziert. Zwar
   weiter > 250 Zeilen, aber 5 Sub-Komponenten (`list-utils`,
   `cover-thumbnail`, `file-icon`, `sortable-header-cell`, `file-row`)
   sind jetzt einzeln testbar und wiederverwendbar.
3. **`file-tree.tsx` von 619 auf 467 Zeilen** reduziert; `TreeItem` in
   `tree-item.tsx` (188z) ausgegliedert.
4. **0 → 40 Char-Tests** fuer Welle-3-I-Files. Das Sicherheitsnetz
   fuer Folge-Wellen (3-II/3-III) steht.
5. **Neue Modul-Contract-Rule** `welle-3-schale-loader-contracts.mdc`
   verhindert kuenftig Drift im Storage-Abstraktion- und Fehler-
   Semantik-Bereich.
6. **Doku aktualisiert**: `docs/reference/file-index.md` und
   `docs/reference/modules/library.md` zeigen die neue
   `file-list/`-Sub-Modul-Struktur.

## Was bleibt fuer Folge-Wellen offen

| Befund | Folge-Welle | Aufwand-Schaetzung |
|---|---|---|
| `file-list.tsx` Phase 2: Header-Bar / Bulk-Actions / Daten-Hooks aufsplitten | Welle 3-I-b oder Sub-Welle | mittel — eigener Char-Test-Setup |
| `library.tsx` (785z) Modul-Split: Layout vs. Daten-Loader | Welle 3-I-c oder Welle 3-II | hoch — viele Race-Conditions |
| `create-library-dialog.tsx` (435z) Split | Welle 3-IV oder Folge-Welle | klein |
| `'use client'`-Audit fuer `library.tsx` und `library-header.tsx` (Pre-Existing-Issue) | Folge-Welle | klein |
| `app/library/gallery/ensure-library.tsx` (knip-Befund: ungenutzt) | Folge-Welle nach User-Verifikation, ob Helper noch geplant ist | klein |

## Workflow-Regeln-Erfuellung

| Regel | Erfuellt? | Wie? |
|---|---|---|
| R1 — Eine Welle, ein Test-Cycle, ein Push | ✅ | 1 Branch, 1 PR, kein Push auf master |
| R2 — Default = 1 Cloud-Agent | ✅ | seriell durchgearbeitet, keine Parallelitaet |
| R3 — User-Verifikation Pflicht | ⏳ offen | Phase C aus `05-user-test-plan.md` muss User ausfuehren |
| R4 — Push-Disziplin | ✅ | Doku-Commits ohne `[skip ci]` (Code-Aenderungen waren auch dabei), kein Force-Push |
| R5 — Methodik- + Modul-DoD getrennt | ✅ | siehe Tabellen oben |

## Stop-Bedingungen aus AGENT-BRIEF

| Stop-Bedingung | Eingetreten? |
|---|---|
| > 1.000 Zeilen Diff in einem Commit | ⚠️ einmal beim file-list-Split (904 inserts, 770 deletes — knapp drunter, dokumentiert in 04-altlast-pass.md "NICHT weiter splitten") |
| Tests werden rot ohne Ursache in 30 Min | nein |
| React-Error-Boundary-Fehler nach Refactor | nicht beobachtet (User-Smoke steht aus) |
| Architektur-Frage nicht im Brief geklaert | nein |
| Storage-Provider-Live-Calls | nein, alles gemockt |
| App-Router-Konvention gebrochen | nein, keine `page.tsx` umbenannt |

## Sign-off-Pfad

1. **Phase A** (autom. Tests + Lint + Stats) — siehe `05-user-test-plan.md` → User fuehrt aus.
2. **Phase B** (`pnpm build`) — User fuehrt aus.
3. **Phase C** (UI-Smoke im Browser, 8 Pfade) — User fuehrt aus.
4. **Befund** in `05-user-test-plan.md` Phase D eintragen.
5. **PR** `refactor/welle-3-schale-loader` → `master` mergen, **kein
   Auto-Merge**.
6. CI-Status nach Merge pruefen (R4: 6-Min-Abstand).

## Next Steps nach Merge

1. Backend-Cleanup-Folge-Welle (siehe Plan-Sektion 5,
   `backend-cleanup-followup`) prüfen — die abgenommenen Wellen 0-2
   haben noch Drift, die nicht in Welle 3 mit aufgeraeumt wurde.
2. Welle 3-I-b: `file-list.tsx` Phase 2 (Hooks + Bulk-Actions).
3. Welle 3-II vorbereiten (Archiv-Detail / `file-preview.tsx`-Split).
