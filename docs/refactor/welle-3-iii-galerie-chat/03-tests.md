# Characterization Tests: Welle 3-III — Galerie + Story-Mode + Chat

Stand: 2026-05-02. Sicherheitsnetz **vor** den Modul-Splits in
Sub-Wellen 3-III-a/b/c.

## Ziel

Pure-Helper und kleine Komponenten mit klarem Vertrag absichern, damit
in den Sub-Wellen die grossen Files (`chat-panel.tsx`, `gallery-root.tsx`,
`perspective-page-content.tsx`) sicher refaktoriert werden koennen.

Fokus auf **eindeutige Vertraege** — was rein geht, was raus kommt —
keine Rendering-Marathons.

## Char-Tests (DIESE PR — 6 Files)

| Test-File | Code unter Test | Ziele |
|---|---|---|
| `tests/unit/components/library/chat/chat-utils.test.ts` | `chat/utils/chat-utils.ts` (165z, 0 Hooks, Pure) | `createMessagesFromQueryLog` (Frage+Antwort, Cache-Felder, Default-Fall), `groupMessagesToConversations` (Pairing, Skip-Duplicates) |
| `tests/unit/components/library/chat/chat-storage.test.ts` | `chat/utils/chat-storage.ts` (142z, 0 Hooks, Pure) | `getInitial*`-Helper (Default bei SSR, Read aus LocalStorage, Migration alter Single-Value-Format auf Array), `saveChatContextToLocalStorage` (Schreibt alle 6 Keys) |
| `tests/unit/components/library/chat/chat-suggested-questions.test.tsx` | `chat/chat-suggested-questions.tsx` (43z) | Render-Smoke (Liste rendert), Click → onSelect-Callback aufgerufen, leere Liste → Empty-State |
| `tests/unit/components/library/gallery/view-mode-toggle.test.tsx` | `gallery/view-mode-toggle.tsx` (61z) | Render-Smoke pro View-Modus (grid/table/virtualized), Click → onChange-Callback |
| `tests/unit/components/library/gallery/items-grid.test.tsx` | `gallery/items-grid.tsx` (76z) | Render-Smoke mit Items-Mock, leere Items → Empty-State, DocumentCard-Children werden gemockt |
| `tests/unit/components/library/file-category-filter.test.tsx` | `file-category-filter.tsx` (75z) | Render-Smoke, Auswahl-Callback, alle Kategorien-Optionen sichtbar |

**Volumen-Schaetzung**: 6 Test-Files, ca. 30-40 Test-Cases, ca. 600-800
Test-Zeilen — sicher unter 5.000-Brutto-Diff-Limit.

## Char-Tests (Sub-Wellen)

### Sub-Welle 3-III-a (Gallery)

| Test-File | Code unter Test |
|---|---|
| `gallery-root.test.tsx` | `gallery-root.tsx` (Render-Smoke pro View-Modus, URL-State-Reaction) |
| `items-view.test.tsx` | `items-view.tsx` |
| `grouped-items-view.test.tsx` | `grouped-items-view.tsx` |
| `virtualized-items-view.test.tsx` | `virtualized-items-view.tsx` (Performance-kritisch — pure Renderer-Tests) |
| `document-card.test.tsx` | `document-card.tsx` (Pflichtfelder, Bilder, Buttons) |
| `filters-panel.test.tsx` | `filters-panel.tsx`, `mobile-filters-sheet.tsx` |
| `bulk-buttons.test.tsx` | `bulk-publish-button.tsx`, `bulk-delete-button.tsx` |
| `references-sheet.test.tsx` | `references-sheet.tsx` |

### Sub-Welle 3-III-b (Chat)

| Test-File | Code unter Test |
|---|---|
| `chat-panel.test.tsx` | `chat-panel.tsx` (Composer-Smoke, MessagesList-Slot) |
| `chat-message.test.tsx` | `chat-message.tsx` |
| `chat-input.test.tsx` | `chat-input.tsx` (Submit-Vertrag, Disabled-Logic) |
| `chat-messages-list.test.tsx` | `chat-messages-list.tsx` |
| `use-chat-stream.test.ts` | `chat/hooks/use-chat-stream.ts` (Reducer-Anteil als Pure-Function) |
| `use-chat-toc.test.ts` | `chat/hooks/use-chat-toc.ts` (TOC-Builder als Pure-Function) |
| `use-chat-history.test.ts` | `chat/hooks/use-chat-history.ts` |
| `chat-config-display.test.tsx` | `chat-config-display.tsx` |
| `debug-panel.test.tsx` | `debug-panel.tsx` (Tab-Switch, Sub-Komponenten) |
| `processing-status.test.tsx` | `processing-status.tsx` |

### Sub-Welle 3-III-c (Story + Perspective)

| Test-File | Code unter Test |
|---|---|
| `perspective-page-content.test.tsx` | `shared/perspective-page-content.tsx` |
| `perspective-display.test.tsx` | `shared/perspective-display.tsx` |
| `story-mode-header.test.tsx` | `story/story-mode-header.tsx` |
| `story-topics.test.tsx` | `story/story-topics.tsx` |

## Test-Strategie

Pro Datei:

1. **Render-Smoke**: Komponente rendert ohne Crash mit Default-Props
2. **Vertrag-Tests**: Inputs → Outputs (Callbacks, Atom-Setter, URL-Updates)
3. **Empty-State**: Komponente rendert sichtbaren Empty-State, nicht `null`
4. **Edge-Cases**: nur die wichtigsten (z.B. SSR-Fall fuer LocalStorage-Helper)

**Mocks**:
- `next/router` und `next/navigation` ueber `vi.mock` (siehe Welle 3-I-Vorbild)
- `Storage` via `localStorage` global mock
- Atom-Provider mit Init-Wert
- API-Calls via `fetch`-Mock (nicht nutzen, wo nicht noetig)

## Verfahren

1. Tests landen unter `tests/unit/components/library/{chat,gallery}/`.
2. Pure-Helper-Tests sind `.test.ts`, Render-Tests `.test.tsx`.
3. Fuer jeden Test: Was beweist er, was nicht?
4. **Tests fixieren das aktuelle Verhalten** (auch wenn buggy) — Refactor
   in den Sub-Wellen darf das Verhalten nicht aendern, ohne den Test zu
   aktualisieren.
