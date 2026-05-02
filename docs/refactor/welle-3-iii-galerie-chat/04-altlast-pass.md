# Altlast-Pass: Welle 3-III — Galerie + Story-Mode + Chat

Stand: 2026-05-02. Status der 8 Altlast-Kategorien aus Methodik
([`docs/refactor/playbook.md`](../playbook.md)).

## Ist-Lage (verifiziert via `node scripts/ui-welle-3iii-stats.mjs`)

| # | Kategorie | Anzahl Verstoesse | Bewertung |
|---|---|---:|---|
| 1 | Fehlende Tests | 65 / 65 Files | rot — wird in Sub-Wellen + Vorbereitung addressiert |
| 2 | Silent Fallbacks (leere Catches) | 0 leere + ~15 Comment-only-Catches | gelb — Comment-only in Sub-Wellen fixen |
| 3 | UI/Storage-Branches | 0 | **gruen** |
| 4 | `any`-Drift | 0 | **gruen** |
| 5 | Duplikate | unbekannt (Detail-Audit in Sub-Wellen) | gelb |
| 6 | Toter Code | unbekannt (knip in Sub-Wellen) | gelb |
| 7 | Datei > 200 Zeilen | 27 / 65 (42%) | rot — wird in Sub-Wellen geteilt |
| 8 | Unnoetiges `'use client'` | 56 / 65 mit Direktive (Stichprobe ergibt: meist berechtigt) | gruen (Stichprobe) |

## Vorbereitung (DIESE PR)

**Keine** Code-Aenderungen — nur Doku + Char-Tests + Contracts +
AGENT-BRIEF. Begruendung: Welle 3-III hat keine "Quick-Wins" wie 3-II
(7 leere Catches + 1 Storage-Branch); die Comment-only-Catches sind
keine ESLint-Verstoesse und stehen in komplexen Pfaden, die besser
zusammen mit dem jeweiligen Modul-Split adressiert werden.

## Backlog (Sub-Wellen)

### Sub-Welle 3-III-a (Gallery)

| Hot-Spot | Datei | Massnahme |
|---|---|---|
| **49 Hooks, 994z** | `gallery/gallery-root.tsx` | Modul-Split nach View-Modus + Hook-Extraktion (`use-gallery-data`, `use-gallery-selection`, `use-gallery-url-state`) |
| **5 Hooks, 639z** | `gallery/document-card.tsx` | Render-Refactor (Helper extrahieren, Card-Sections als Sub-Komponenten) |
| **13 Hooks, 470z** | `gallery/virtualized-items-view.tsx` | Hook-Extraktion (`use-virtualized-items`) |
| **6 Hooks, 306z** | `gallery/grouped-items-table.tsx` | Helper extrahieren |
| **6 Hooks, 264z** | `gallery/grouped-items-grid.tsx` | Helper extrahieren |
| **3 Comment-only-Catches** | `gallery/document-share-button.tsx` | Logging hinzufuegen oder explizit als bewusst dokumentieren (Browser-Capability-Fallback) |
| **1 Comment-only-Catch** | `gallery/switch-to-story-mode-button.tsx:137` | Logging hinzufuegen |
| **1 Comment-only-Catch** | `gallery/speaker-icons.tsx:38` | Logging hinzufuegen |

### Sub-Welle 3-III-b (Chat)

| Hot-Spot | Datei | Massnahme |
|---|---|---|
| **36 Hooks, 1.268z** | `chat/chat-panel.tsx` | Modul-Split nach Sub-Komponenten-Familie + Hook-Extraktion (z.B. `use-chat-panel-state`, `use-chat-panel-config`) |
| **4 Hooks, 492z** | `chat/hooks/use-chat-stream.ts` | Hook-internes Refactor: Streaming-Reducer als Pure-Helper extrahieren |
| **11 Hooks, 527z** | `chat/chat-reference-list.tsx` | Modul-Split (`SingleRef` + `RefList`-Container) |
| **3 Hooks, 440z** | `chat/debug-panel.tsx` | Modul-Split (Tabs als Sub-Komponenten — `debug-step-table` und `debug-timeline` existieren bereits) |
| **3 Hooks, 392z** | `chat/processing-status.tsx` | Helper-Extract |
| **6 Hooks, 378z** | `chat/chat-config-display.tsx` | Helper-Extract |
| **13 Hooks, 326z** | `chat/hooks/use-chat-toc.ts` | TOC-Builder als Pure-Helper |
| **2 Hooks, 290z** | `chat/chat-welcome-assistant.tsx` | Helper-Extract |
| **6× Comment-only-Catches** | `chat/utils/chat-storage.ts` | Wrapper `safeParseJSON()` mit Logging einfuehren |
| **4× Comment-only-Catches** | `chat/chat-panel.tsx`, `chat-conversation-item.tsx` | Logging hinzufuegen |
| **6× Comment-only-Catches** | `chat/hooks/use-chat-{config,history,stream,toc}.ts` | Logging hinzufuegen |

### Sub-Welle 3-III-c (Story + Perspective)

| Hot-Spot | Datei | Massnahme |
|---|---|---|
| **13 Hooks, 926z** | `shared/perspective-page-content.tsx` | Modul-Split (Header/Body/Tabs als Sub-Komponenten) |
| **3 Hooks, 275z** | `shared/perspective-display.tsx` | Helper-Extract |
| **5 Hooks, 394z** | `story/story-topics.tsx` | Modul-Split |

## Sub-Wellen-Reihenfolge (nach Methodik R2: 1 Cloud-Agent seriell)

1. **Vorbereitung (DIESE PR)** — Audit + Inventur + Contracts + Char-Tests + AGENT-BRIEF
2. **3-III-a (Gallery)** — groesste Sub-Welle, ca. 5.500 Zeilen Scope
3. **3-III-b (Chat)** — zweite grosse Sub-Welle, ca. 6.800 Zeilen Scope
4. **3-III-c (Story + Perspective)** — Aufwaerm-Sub-Welle, ca. 1.800 Zeilen Scope

R2 (1 Cloud-Agent seriell): jede Sub-Welle wird vor der naechsten
gemerged, damit ihre Char-Tests Sicherheitsnetz fuer die folgende sind.

## Verifikation nach jeder Sub-Welle

- `pnpm test` gruen
- `pnpm lint` keine neuen Warnings
- `pnpm build` gruen
- `node scripts/ui-welle-3iii-stats.mjs` zeigt Reduktion in Sub-Welle-Files
- User-Sign-off lokal nach Smoke-Test (`05-user-test-plan.md`)
