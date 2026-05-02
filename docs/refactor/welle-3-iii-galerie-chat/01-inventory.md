# Inventur: Welle 3-III — Galerie + Story-Mode + Chat

Stand: 2026-05-02. Quelle: [`scripts/ui-welle-3iii-stats.mjs`](../../../scripts/ui-welle-3iii-stats.mjs).

## 1. Welle-Health-Zusammenfassung

| Metrik | Wert | Bewertung vs. Backend-Modul-Schwelle |
|---|---:|---|
| Files | 65 | – |
| Gesamt-Zeilen | 15.055 | – (0.7x Welle 3-II, 2.8x Welle 3-I) |
| Files > 200 Zeilen | 27 von 65 (42%) | **rot** (Schwelle: 0) |
| Files > 500 Zeilen | 5 von 65 (8%) | **rot** (Schwelle: 0) |
| Max-Zeilen einer Datei | 1.268 (`chat/chat-panel.tsx`) | **rot** (Schwelle: 200) |
| Hooks gesamt | 286 | – |
| Max-Hooks einer Datei | 49 (`gallery/gallery-root.tsx`) | **rot** (vergleichbar mit `markdown-preview.tsx` aus 3-II) |
| Leere Catches | **0** | **gruen** |
| Storage-Branches im UI | **0** | **gruen** (konform zu `storage-abstraction.mdc`) |
| `'use client'`-Direktiven | 56 von 65 (86%) | erwartet bei UI |
| `any` | 0 | **gruen** |
| Existierende Vitest-Tests fuer Welle 3-III | **0** | **rot** (0% Coverage) |

**Vergleich zu Welle 3-II**:
- Volumen: 73% (15.055 vs 20.508 Zeilen)
- 3-II hatte 7 leere Catches und 1 Storage-Branch — 3-III hat **0/0** (sauberer Code-Ausgangspunkt)
- 3-III hat keinen einzelnen Hot-Spot wie `file-preview.tsx` mit 3.701z, sondern 3 mittelgrosse Hot-Spots (chat-panel 1.268z, gallery-root 994z, perspective-page-content 926z)

## 2. Files (verifiziert via `node scripts/ui-welle-3iii-stats.mjs`)

### Hot-Spots > 500 Zeilen (5 Files, 4.353 Zeilen)

| Datei | Zeilen | Hooks | use-client | catch{} | Sub-Welle |
|---|---:|---:|---:|---:|---|
| `src/components/library/chat/chat-panel.tsx` | **1.268** | **36** | 1 | 0 | 3-III-b |
| `src/components/library/gallery/gallery-root.tsx` | **994** | **49** | 1 | 0 | 3-III-a |
| `src/components/library/shared/perspective-page-content.tsx` | **926** | 13 | 1 | 0 | 3-III-c |
| `src/components/library/gallery/document-card.tsx` | **639** | 5 | 1 | 0 | 3-III-a |
| `src/components/library/chat/chat-reference-list.tsx` | **527** | 11 | 1 | 0 | 3-III-b |

### Mittel-Hot-Spots 300-500 Zeilen (5 Files, 1.985 Zeilen)

| Datei | Zeilen | Hooks | use-client | Sub-Welle |
|---|---:|---:|---:|---|
| `src/components/library/chat/hooks/use-chat-stream.ts` | 492 | 4 | 0 | 3-III-b |
| `src/components/library/gallery/virtualized-items-view.tsx` | 470 | 13 | 1 | 3-III-a |
| `src/components/library/chat/debug-panel.tsx` | 440 | 3 | 1 | 3-III-b |
| `src/components/library/story/story-topics.tsx` | 394 | 5 | 1 | 3-III-c |
| `src/components/library/chat/processing-status.tsx` | 392 | 3 | 1 | 3-III-b |

### gallery/* (30 Files, 5.483 Zeilen, 142 Hooks)

| Datei | Zeilen | Hooks | use-client |
|---|---:|---:|---:|
| `gallery-root.tsx` | 994 | 49 | 1 |
| `document-card.tsx` | 639 | 5 | 1 |
| `virtualized-items-view.tsx` | 470 | 13 | 1 |
| `grouped-items-table.tsx` | 306 | 6 | 1 |
| `grouped-items-grid.tsx` | 264 | 6 | 1 |
| `detail-overlay.tsx` | 228 | 4 | 1 |
| `references-sheet.tsx` | 227 | 2 | 1 |
| `document-share-button.tsx` | 224 | 11 | 1 |
| `bulk-publish-button.tsx` | 197 | 4 | 1 |
| `bulk-delete-button.tsx` | 197 | 3 | 1 |
| `items-table.tsx` | 195 | 5 | 1 |
| `switch-to-story-mode-button.tsx` | 193 | 6 | 1 |
| `speaker-icons.tsx` | 163 | 1 | 1 |
| `delete-document-button.tsx` | 137 | 3 | 1 |
| `publish-document-button.tsx` | 123 | 3 | 0 |
| `gallery-sticky-header.tsx` | 105 | 1 | 1 |
| `open-in-archive-button.tsx` | 104 | 0 | 1 |
| `grouped-items-view.tsx` | 93 | 0 | 1 |
| `gallery-card-density-toggle.tsx` | 90 | 1 | 1 |
| `publish-status-chips.tsx` | 80 | 1 | 0 |
| `items-view.tsx` | 79 | 0 | 1 |
| `items-grid.tsx` | 76 | 1 | 1 |
| `reference-group-header.tsx` | 75 | 0 | 1 |
| `filters-panel.tsx` | 71 | 1 | 1 |
| `document-filter-group.tsx` | 67 | 1 | 1 |
| `facet-group.tsx` | 65 | 1 | 1 |
| `view-mode-toggle.tsx` | 61 | 1 | 1 |
| `mobile-filters-sheet.tsx` | 59 | 0 | 1 |
| `facets-list.tsx` | 58 | 0 | 1 |
| `references-legend.tsx` | 41 | 0 | 1 |

### chat/* (28 Files, 6.792 Zeilen, 116 Hooks)

| Datei | Zeilen | Hooks | use-client |
|---|---:|---:|---:|
| `chat-panel.tsx` | 1.268 | 36 | 1 |
| `chat-reference-list.tsx` | 527 | 11 | 1 |
| `hooks/use-chat-stream.ts` | 492 | 4 | 0 |
| `debug-panel.tsx` | 440 | 3 | 1 |
| `processing-status.tsx` | 392 | 3 | 1 |
| `chat-config-display.tsx` | 378 | 6 | 1 |
| `hooks/use-chat-toc.ts` | 328 | 13 | 0 |
| `chat-welcome-assistant.tsx` | 290 | 2 | 1 |
| `chat-message.tsx` | 278 | 4 | 1 |
| `chat-input.tsx` | 264 | 6 | 1 |
| `hooks/use-chat-history.ts` | 252 | 4 | 0 |
| `chat-conversation-item.tsx` | 248 | 2 | 1 |
| `chat-messages-list.tsx` | 206 | 1 | 1 |
| `chat-document-sources.tsx` | 194 | 3 | 1 |
| `chat-config-popover.tsx` | 175 | 1 | 1 |
| `chat-selector.tsx` | 167 | 2 | 1 |
| `utils/chat-utils.ts` | 165 | 0 | 0 |
| `hooks/use-chat-config.ts` | 163 | 6 | 0 |
| `chat-filters-display.tsx` | 154 | 2 | 1 |
| `chat-config-bar.tsx` | 148 | 1 | 1 |
| `utils/chat-storage.ts` | 142 | 0 | 0 |
| `processing-logs-dialog.tsx` | 131 | 3 | 1 |
| `hooks/use-chat-scroll.ts` | 115 | 5 | 0 |
| `query-details-dialog.tsx` | 109 | 3 | 1 |
| `debug-step-table.tsx` | 86 | 3 | 1 |
| `debug-timeline.tsx` | 85 | 0 | 1 |
| `debug-trace.tsx` | 50 | 0 | 1 |
| `chat-suggested-questions.tsx` | 43 | 1 | 1 |

### story/* (3 Files, 574 Zeilen, 13 Hooks)

| Datei | Zeilen | Hooks | use-client |
|---|---:|---:|---:|
| `story-topics.tsx` | 394 | 5 | 1 |
| `story-header.tsx` | 96 | 5 | 1 |
| `story-mode-header.tsx` | 84 | 3 | 1 |

### shared/perspective-* (2 Files, 1.201 Zeilen, 16 Hooks)

| Datei | Zeilen | Hooks | use-client |
|---|---:|---:|---:|
| `shared/perspective-page-content.tsx` | 926 | 13 | 1 |
| `shared/perspective-display.tsx` | 275 | 3 | 1 |

### Filter-Komponenten (2 Files, 309 Zeilen, 3 Hooks)

| Datei | Zeilen | Hooks | use-client |
|---|---:|---:|---:|
| `filter-context-bar.tsx` | 234 | 2 | 1 |
| `file-category-filter.tsx` | 75 | 1 | 1 |

## 3. Hot-Spots fuer Schritt 4 (Altlast-Pass)

### Vorbereitung (DIESE PR)

**Sehr sauber**: keine leeren Catches, kein `any`, keine
Storage-Branches. Daher in der Vorbereitung **keine** Code-Aenderungen
notwendig — nur Char-Tests + Contracts + Doku.

### Sub-Wellen 3-III-a/b/c

| Hot-Spot | Datei(en) | Sub-Welle | Hauptproblem |
|---|---|---|---|
| **49 Hooks, 994 Zeilen** | `gallery/gallery-root.tsx` | 3-III-a | Modul-Split nach View-Modus (items/grouped/grid/table) + Hook-Extraktion |
| **5 Hooks, 639 Zeilen** | `gallery/document-card.tsx` | 3-III-a | Render-Refactor (zu viele Render-Branches in einer Komponente) |
| **13 Hooks, 470 Zeilen** | `gallery/virtualized-items-view.tsx` | 3-III-a | Hook-Extraktion (`use-virtualized-items`) |
| **36 Hooks, 1.268 Zeilen** | `chat/chat-panel.tsx` | 3-III-b | Modul-Split nach Sub-Komponenten-Familie + Hook-Extraktion |
| **4 Hooks, 492 Zeilen** | `chat/hooks/use-chat-stream.ts` | 3-III-b | Hook-internes Refactor (Streaming-Logik aufsplitten) |
| **11 Hooks, 527 Zeilen** | `chat/chat-reference-list.tsx` | 3-III-b | Modul-Split (RefList vs. SingleRef) |
| **3 Hooks, 440 Zeilen** | `chat/debug-panel.tsx` | 3-III-b | Modul-Split (Tabs als Sub-Komponenten, debug-step-table + debug-timeline existieren bereits) |
| **3 Hooks, 392 Zeilen** | `chat/processing-status.tsx` | 3-III-b | Helper-Extract |
| **6 Hooks, 378 Zeilen** | `chat/chat-config-display.tsx` | 3-III-b | Helper-Extract |
| **13 Hooks, 326 Zeilen** | `chat/hooks/use-chat-toc.ts` | 3-III-b | TOC-Builder als Pure-Helper |
| **13 Hooks, 926 Zeilen** | `shared/perspective-page-content.tsx` | 3-III-c | Modul-Split (Tabs/Sections als Sub-Komponenten) |
| **5 Hooks, 394 Zeilen** | `story/story-topics.tsx` | 3-III-c | Modul-Split |

## 4. Hot-Spots fuer Schritt 3 (Characterization Tests)

### Vorbereitung (DIESE PR — 6 kleinere Files mit klarem Vertrag)

Die Char-Tests dienen als **Sicherheitsnetz** fuer die nachfolgenden
Sub-Wellen. Auswahl: Pure-Helper + kleine Komponenten mit klaren
Vertraegen, die sich ohne Mock-Marathon testen lassen.

| Test-File | Code unter Test | Begruendung |
|---|---|---|
| `tests/unit/components/library/chat/chat-utils.test.ts` | `chat/utils/chat-utils.ts` (165z, 0 Hooks) | Pure-Helpers — leichte Sicherheit fuer 3-III-b |
| `tests/unit/components/library/chat/chat-storage.test.ts` | `chat/utils/chat-storage.ts` (142z, 0 Hooks) | LocalStorage-Logik, deterministisch |
| `tests/unit/components/library/chat/chat-suggested-questions.test.tsx` | `chat/chat-suggested-questions.tsx` (43z) | Render-Smoke + onClick-Vertrag |
| `tests/unit/components/library/gallery/view-mode-toggle.test.tsx` | `gallery/view-mode-toggle.tsx` (61z) | Render-Smoke + onChange-Vertrag |
| `tests/unit/components/library/gallery/items-grid.test.tsx` | `gallery/items-grid.tsx` (76z) | Render-Smoke (Grid mit DocumentCard-Children-Mock) |
| `tests/unit/components/library/file-category-filter.test.tsx` | `file-category-filter.tsx` (75z) | Render-Smoke + Auswahl-Vertrag |

### Sub-Wellen 3-III-a/b/c (jeweils eigene Char-Test-Sets)

- **3-III-a**: Tests fuer `gallery-root.tsx`, `items-view`, `grouped-items-view`, `virtualized-items-view`, `document-card.tsx` (vor Modul-Split)
- **3-III-b**: Tests fuer `chat-panel.tsx`, `chat-message`, `chat-input`, `chat-messages-list`, `use-chat-stream` (Pure-Reducer-Anteil)
- **3-III-c**: Tests fuer `perspective-page-content.tsx`, `story-topics.tsx`

## 5. Zentrale Architektur-Rules (potentiell betroffen)

- [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) — 0 Verstoesse, bleibt einzuhalten
- [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) — 0 Verstoesse, bleibt einzuhalten
- [`chat-contracts.mdc`](../../../.cursor/rules/chat-contracts.mdc) — Backend-Contracts, UI ist Konsument
- [`shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc) — `gallery/gallery-root.tsx` und `chat/chat-panel.tsx` lesen Shadow-Twin-State
- [`reorganizing-components.mdc`](../../../.cursor/rules/reorganizing-components.mdc) — Modul-Split-Empfehlung
- [`prio1-state-caching-navigation.mdc`](../../../.cursor/rules/prio1-state-caching-navigation.mdc) — Galerie nutzt URL-State
- Neue Rule: `welle-3-iii-galerie-chat-contracts.mdc` (Schritt 2)

## 6. Bekannte Risiken / Watchpoints

- **Visuelle Abnahme zwingend lokal** fuer alle Sub-Wellen (Galerie + Chat sind hochgradig interaktiv).
- **Streaming im Chat**: `use-chat-stream` hat einen komplexen Reducer (4 Hooks, 492z). Char-Test muss deterministisch ohne echten Stream laufen.
- **URL-State**: `gallery-root` nutzt vermutlich `useSearchParams`/`nuqs` — Tests muessen den Router mocken.
- **Jotai-Atoms**: viele Komponenten lesen aus Atoms (Galerie + Chat). Tests brauchen `Provider`-Wrapper oder Atom-Init.
- **Zwei getrennte Domaenen**: Galerie ist Read-Only-Konsum, Chat ist Streaming + Write — daher Sub-Wellen klar trennen.

## 7. Verfahren

1. Skript [`scripts/ui-welle-3iii-stats.mjs`](../../../scripts/ui-welle-3iii-stats.mjs) ausgefuehrt.
2. Output in Tabelle uebernommen.
3. Hot-Spots manuell sortiert nach Sub-Welle.
4. Char-Test-Liste auf 6 sichere kleine Files beschraenkt.
