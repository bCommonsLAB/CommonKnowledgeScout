# Inventur: Welle 3-I — App-Schale + Library-Loader

Stand: 2026-04-28. Erstellt vom IDE-Agenten als Pre-Flight (siehe [`AGENT-BRIEF.md`](./AGENT-BRIEF.md)).
Quelle: [`scripts/ui-welle-3i-stats.mjs`](../../../scripts/ui-welle-3i-stats.mjs) (verifizierter Snapshot der 16 Files).

## 1. Welle-Health-Zusammenfassung

| Metrik | Wert | Bewertung vs. Backend-Modul-Schwelle |
|---|---:|---|
| Files | 16 | – |
| Gesamt-Zeilen | 5.427 | – |
| Files > 200 Zeilen | 8 von 16 (50%) | **rot** (Schwelle: 0) |
| Max-Zeilen einer Datei | 2.217 (`file-list.tsx`) | **rot** (Schwelle: 200) |
| Hooks gesamt | 215 | – |
| Max-Hooks einer Datei | 89 (`file-list.tsx`) | **rot** (vergleichbar mit `creation-wizard.tsx`) |
| Leere Catches | 3 (in 3 Files) | **rot** (Schwelle: 0) |
| `'use client'`-Direktiven | 13 von 16 | erwartet bei UI |
| `any` | 0 | grün |
| Storage-Branches im UI | 0 | grün |
| Existierende Vitest-Tests fuer Welle 3-I | **0** | **rot** (0% Coverage) |

**Vergleich zu `external-jobs`** (Pilot, vor Refactor): kleiner als der Pilot (5.427 vs 10.725 Zeilen), aber `file-list.tsx` allein ist mit 2.217 Zeilen + 89 Hooks vergleichbar mit `phase-template.ts` (2.038 Zeilen) — und braucht einen ähnlich aufwendigen Sub-Modul-Split.

## 2. Files (verifiziert via `node scripts/ui-welle-3i-stats.mjs`)

### App-Schale (11 Files, 1.836 Zeilen, 78 Hooks)

| Datei | Zeilen | Hooks | use-client | catch{} | hat Test |
|---|---:|---:|---:|---:|---|
| `src/components/library/library.tsx` | 785 | 28 | 0 | 0 | nein |
| `src/components/library/library-header.tsx` | 217 | 12 | 0 | 0 | nein |
| `src/components/library/library-switcher.tsx` | 187 | 10 | 1 | **1** | nein |
| `src/app/library/page.tsx` | 149 | 10 | 1 | **1** | nein |
| `src/app/library/gallery/page.tsx` | 17 | 0 | 0 | 0 | nein |
| `src/app/library/gallery/page-client.tsx` | 8 | 0 | 1 | 0 | nein |
| `src/app/library/gallery/client.tsx` | 10 | 0 | 1 | 0 | nein |
| `src/app/library/gallery/ensure-library.tsx` | 26 | 4 | 1 | 0 | nein |
| `src/app/library/gallery/perspective/page.tsx` | 94 | 5 | 1 | 0 | nein |
| `src/app/library/create/page.tsx` | 207 | 5 | 1 | 0 | nein |
| `src/app/library/create/[typeId]/page.tsx` | 136 | 4 | 1 | 0 | nein |

### Library-Loader (5 Files, 3.591 Zeilen, 137 Hooks)

| Datei | Zeilen | Hooks | use-client | catch{} | hat Test |
|---|---:|---:|---:|---:|---|
| `src/components/library/file-list.tsx` | **2.217** | **89** | 1 | **1** | nein ← Hauptlast |
| `src/components/library/file-tree.tsx` | 619 | 30 | 1 | 0 | nein |
| `src/components/library/upload-dialog.tsx` | 94 | 2 | 1 | 0 | nein |
| `src/components/library/upload-area.tsx` | 226 | 3 | 1 | 0 | nein |
| `src/components/library/create-library-dialog.tsx` | 435 | 13 | 1 | 0 | nein |

## 3. Vorhandene UI-Tests im Repo (potentielle Vorbilder)

Es gibt 5 Component-Tests unter `tests/unit/components/`, aber **keinen** für die 16 Welle-3-I-Files. Möglicherweise als Vorbild geeignet:

- `tests/unit/components/app-layout.test.tsx` — Layout-Test, koennte fuer `library.tsx` Vorbild sein
- `tests/unit/components/top-nav-config.test.ts` — Konfigurations-Test
- `tests/unit/components/composite-multi-dialog.test.tsx` — Dialog-Test
- `tests/unit/components/public-home-links.test.tsx`
- `tests/unit/components/testimonial-list.test.tsx`

**Cloud-Agent-Aufgabe in Schritt 0**: Diese Tests im Audit als Status `keep` markieren (auch wenn sie ausserhalb der Welle liegen) und in Schritt 3 deren Test-Setup als Vorbild fuer die neuen Welle-3-I-Tests pruefen.

## 4. Hot-Spots fuer Schritt 4 (Altlast-Pass)

| Hot-Spot | Datei(en) | Massnahme |
|---|---|---|
| **89 Hooks in einer Datei** | `file-list.tsx` (2.217z) | Modul-Split nach Verantwortung: vermutlich Liste-Render, Filter/Search, Selection/Bulk-Actions, Drag&Drop, Upload-Hook, URL-Sync. Mind. 5-7 Sub-Files |
| **Datei > 200 Zeilen, gross** | `library.tsx` (785z, 28h) | Trennung Layout-Wrapper vs. Daten-Loading. Vermutlich `library/layout.tsx` + `library/data-loader.ts` + Detail-Komponenten |
| **Datei > 200 Zeilen, mittel** | `file-tree.tsx` (619z, 30h) | Pruefen, ob Tree-Render und Drag&Drop trennbar sind |
| **Datei > 200 Zeilen, klein** | `create-library-dialog.tsx` (435z, 13h), `upload-area.tsx` (226z), `library-header.tsx` (217z), `library-switcher.tsx` (187z falsch — knapp unter 200), `app/library/create/page.tsx` (207z) | Pro Datei pruefen, ob Split sinnvoll oder ob Datei kohaerent ist. Konservativ. |
| **Silent Catches (3)** | `library-switcher.tsx:109`, `app/library/page.tsx:41`, `file-list.tsx:1391` | Untersuchen, ob `throw` oder dokumentiertes Default mit Logging |
| **Server-Komponente moeglich?** | `src/app/library/gallery/page.tsx` (17z, kein use-client), `library.tsx` (785z, kein use-client), `library-header.tsx` (217z, kein use-client) | Diese drei sind bereits Server-Komponenten — gut. Prueft Cloud-Agent ob die uebrigen 13 use-client wirklich noetig sind |

## 5. Hot-Spots fuer Schritt 3 (Characterization Tests)

Pilot-Fokus: `file-list.tsx` (Hauptlast, kein Test), `library.tsx` (Schale, kein Test), `file-tree.tsx` (komplex, kein Test).

Geplante Test-Files (Vorschlag, Cloud-Agent verfeinert):

- `tests/unit/components/library/file-list-render.test.tsx` (Render-Test mit Mock-Library)
- `tests/unit/components/library/file-list-filter.test.tsx` (Filter/Search-Verhalten)
- `tests/unit/components/library/file-list-selection.test.tsx` (Bulk-Selection-State)
- `tests/unit/components/library/file-tree-render.test.tsx`
- `tests/unit/components/library/library-shell.test.tsx` (Wrapper-Verhalten)
- `tests/unit/components/library/library-switcher.test.tsx`

Setup: Vitest + `@testing-library/react` (Setup pruefen, vermutlich schon vorhanden — siehe `app-layout.test.tsx`).
Mocks: Storage-Provider als Fake-Provider mocken (siehe Welle 1 `storage`), keine echten API-Calls.

## 6. Zentrale Architektur-Rules (potentiell betroffen)

- [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) — UI darf Storage-Backend nicht kennen. Befund: 0 Storage-Branches in dieser Welle (gut). Cloud-Agent verifiziert im Audit nochmal mit `rg "primaryStore|library\.type ===" src/app/library src/components/library/library*.tsx src/components/library/file-list.tsx src/components/library/file-tree.tsx`.
- [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) — 3 leere Catches in dieser Welle, müssen weg.
- Neue Rule wird angelegt: `.cursor/rules/welle-3-schale-loader-contracts.mdc` (siehe AGENT-BRIEF Schritt 2).

## 7. Bekannte Risiken / Watchpoints

- **`file-list.tsx`-Modul-Split** ist die Schluesselentscheidung dieser Welle. 89 Hooks sind nicht in einem Cloud-Agent-Lauf reviewbar — Cloud-Agent muss den Split in eigenem Commit machen, mit Char-Tests vorher/nachher gruen.
- **App-Schale ist Server/Client-Boundary** — `library.tsx` (785 Zeilen, kein use-client) ist Server-Komponente, ruft aber Client-Komponenten auf. Bei Modul-Split darauf achten, dass die Server/Client-Grenze sauber bleibt (Plan-Rule (8) "Unnötiges 'use client'").
- **Page-Files in `src/app/library/`** sind Next.js-App-Router-Konvention — nicht in beliebige Sub-Module verschiebbar. Splits muessen die App-Router-Struktur respektieren.
- **Visuelle Abnahme zwingend lokal** — Plan-Sektion 8.6 sagt: UI-Refactors muessen vom User im Browser smoke-getestet werden, bevor PR merged wird. User-Test-Plan (`05-user-test-plan.md`) muss konkrete Smoke-Pfade benennen (Library wechseln, Datei oeffnen, Datei hochladen, neue Library anlegen).
