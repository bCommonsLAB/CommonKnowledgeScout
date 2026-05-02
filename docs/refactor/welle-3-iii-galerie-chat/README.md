# Welle 3-III — Galerie + Story-Mode + Chat

**Stand**: 2026-05-02
**Status**: VORBEREITUNG (PR offen)
**Strategie**: 1 PR pro Sub-Welle ab Sub-Welle 3-III-a (siehe `.cursor/rules/refactor-batch-strategy.mdc`)

> **Naming-Hinweis**: Der Welle-3-III-Slot war zwischen 2026-05-01 kurz
> belegt durch eine Future-Work-Welle aus 3-II ("Hooks-Extraktion"),
> die auf **Welle 3-II-Hooks** umbenannt wurde (siehe PR #44 und
> `.cursor/rules/refactor-naming-konvention.mdc`). Welle 3-III bleibt
> wie im Plan-File reserviert fuer **Galerie + Story-Mode + Chat**.

## Kontext

Welle 3-III ist die **Konsum-Sicht / RAG-UX**: was der User sieht, wenn
er mit einer ingestierten Library "arbeitet". Drei UX-Bereiche:

- **Galerie**: Document-Card-Grid + Tabellen-Ansicht + Facetten-Filter
- **Story-Mode**: Story-Topics + Story-Header + Perspective-Page-Content
- **Chat**: RAG-Chat-Panel + Streaming + Debug-Overlay + Konfigurations-UI

Diese Welle profitiert vom bereits refactorierten **Backend-Modul `chat`**
(Welle 2 + `chat-contracts.mdc`), d.h. die UI-Komponenten konsumieren
einen sauberen Service-Layer.

## Scope (verifiziert via `node scripts/ui-welle-3iii-stats.mjs`, siehe `01-inventory.md`)

| Bereich | Files | Zeilen | Hooks (Top) |
|---|---:|---:|---:|
| `gallery/` (30 Files) | 30 | 5.483 | 32 in `gallery-root.tsx` |
| `chat/` (28 Files inkl. `hooks/`, `utils/`) | 28 | 6.792 | 21 in `chat-panel.tsx` + 12 in `use-chat-toc.ts` |
| `story/` (3 Files) | 3 | 571 | – |
| `shared/perspective-*` (2 Files) | 2 | 1.199 | 9 in `perspective-page-content.tsx` |
| `filter-context-bar.tsx` + `file-category-filter.tsx` | 2 | 307 | 0 |
| **Summe** | **65** | **14.352** | – |

**Hot-Spots** (>= 500 Zeilen):
- `chat/chat-panel.tsx` (1.267 Zeilen, 21 Hooks)
- `gallery/gallery-root.tsx` (993 Zeilen, 32 Hooks)
- `shared/perspective-page-content.tsx` (925 Zeilen, 9 Hooks)
- `gallery/document-card.tsx` (638 Zeilen, 1 Hook)
- `chat/chat-reference-list.tsx` (526 Zeilen, 8 Hooks)

## Sub-Wellen-Plan

| Sub-Welle | Inhalt | Branch (geplant) |
|---|---|---|
| **Vorbereitung** (DIESE PR) | Audit + Inventur + Contracts + 6-8 Char-Tests + AGENT-BRIEF | `cursor/refactor-welle-3-iii-vorbereitung-a03a` |
| **3-III-a** | `gallery/` Modul-Split: gallery-root nach View-Modus + document-card-Refactor | `cursor/refactor-welle-3-iii-a-gallery-...` |
| **3-III-b** | `chat/` Modul-Split: chat-panel nach Sub-Komponenten-Familie + use-chat-stream | `cursor/refactor-welle-3-iii-b-chat-...` |
| **3-III-c** | `story/` + `perspective-*` (Aufwaerm-Sub-Welle, kleines Volumen) | `cursor/refactor-welle-3-iii-c-story-perspective-...` |

Reihenfolge nach Methodik (R2: 1 Cloud-Agent seriell):
**Vorbereitung mergen → 3-III-a → 3-III-b → 3-III-c**.

## Files in diesem Verzeichnis

| File | Zweck | Status |
|---|---|---|
| `README.md` | Diese Uebersicht | DIESE PR |
| `00-audit.md` | Bestands-Audit (Rules, Tests, Docs) | DIESE PR |
| `01-inventory.md` | Code-Inventur mit Health-Stats | DIESE PR |
| `02-contracts.md` | Verweis auf neue Rule | DIESE PR |
| `03-tests.md` | Liste der Char-Test-Files (Sicherheitsnetz) | DIESE PR |
| `04-altlast-pass.md` | Backlog Altlasten je Sub-Welle | DIESE PR |
| `05-user-test-plan.md` | Smoke-Test-Plan fuer User | DIESE PR |
| `06-acceptance.md` | Vorbereitung-Acceptance | DIESE PR |
| `AGENT-BRIEF.md` | Brief fuer Sub-Wellen-Cloud-Agents | DIESE PR |
| `06-acceptance-3-iii-a.md` | Acceptance Sub-Welle 3-III-a | folgt |
| `06-acceptance-3-iii-b.md` | Acceptance Sub-Welle 3-III-b | folgt |
| `06-acceptance-3-iii-c.md` | Acceptance Sub-Welle 3-III-c | folgt |
| `06-acceptance-GESAMT.md` | Gesamt-Acceptance | folgt |

## Verweise

- Plan-File: `.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md` (Sektion 5, Welle 3-III)
- Welle 3-II Gesamt-Acceptance: `../welle-3-archiv-detail/06-acceptance-3-ii-GESAMT.md`
- Welle 3-II-Hooks Gesamt-Acceptance: `../welle-3-ii-hooks/06-acceptance-3-ii-hooks-GESAMT.md`
- Methodik-Strategie: `.cursor/rules/refactor-batch-strategy.mdc`
- Naming-Konvention: `.cursor/rules/refactor-naming-konvention.mdc`
- Backend-Chat-Contracts: `.cursor/rules/chat-contracts.mdc` (UI konsumiert)
- AGENTS.md (Branching/Stop-Bedingungen)
