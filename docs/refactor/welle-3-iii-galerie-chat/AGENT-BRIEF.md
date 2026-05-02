# Cloud-Agent-Brief: Welle 3-III — Galerie + Story-Mode + Chat

Stand: 2026-05-02. Erstellt vom Cloud-Agent als Pre-Flight in einem.

## Kontext (lies das ZUERST)

1. **Methodik & Workflow-Regeln**: [`docs/refactor/playbook.md`](../playbook.md) — Workflow-Regeln R1-R5.
2. **Vorbild-Welle**: [`docs/refactor/welle-3-archiv-detail/`](../welle-3-archiv-detail/) — komplette Doku-Serie + Modul-Split-Pattern; und [`docs/refactor/welle-3-ii-hooks/`](../welle-3-ii-hooks/) — Hooks-Pattern.
3. **Plan-Bezug**: [.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md](../../../.cursor/plans/refactor-strategie-drift-eliminieren_06fd8014.plan.md) Sektion 5 (Welle 3-III).
4. **Architektur-Rules** (alle relevant):
   - [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) — UI darf Storage-Backend nicht kennen
   - [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) — keine leeren Catches, keine Comment-only-Catches
   - [`media-lifecycle.mdc`](../../../.cursor/rules/media-lifecycle.mdc) — Frontmatter enthaelt nur Dateinamen
   - [`shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc)
   - [`chat-contracts.mdc`](../../../.cursor/rules/chat-contracts.mdc) — Backend-Contracts, UI ist Konsument
   - [`welle-3-iii-galerie-chat-contracts.mdc`](../../../.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc) — UI-Welle-3-III-Contracts
   - [`refactor-batch-strategy.mdc`](../../../.cursor/rules/refactor-batch-strategy.mdc) — 1 PR pro Welle
   - [`refactor-naming-konvention.mdc`](../../../.cursor/rules/refactor-naming-konvention.mdc) — Naming
5. **Audit + Inventur**: [`00-audit.md`](./00-audit.md), [`01-inventory.md`](./01-inventory.md) — verifizierte Health-Zahlen + Hot-Spots.
6. **AGENTS.md** im Repo-Root.

## Welle-Struktur

Welle 3-III wird in **3 Sub-Wellen** abgearbeitet (nach Vorbereitungs-PR):

| Sub-Welle | Branch (geplant) | Inhalt | Status |
|---|---|---|---|
| **Vorbereitung** | `cursor/refactor-welle-3-iii-vorbereitung-a03a` | Audit + Inventur + Contracts + Char-Tests + AGENT-BRIEF | DIESE PR |
| **3-III-a** Gallery | `cursor/refactor-welle-3-iii-a-gallery-...` | `gallery/` Modul-Split + Hook-Extraktion | Cloud-Lauf NACH Vorbereitung-Merge |
| **3-III-b** Chat | `cursor/refactor-welle-3-iii-b-chat-...` | `chat/` Modul-Split + Hook-Extraktion | Cloud-Lauf NACH 3-III-a |
| **3-III-c** Story+Perspective | `cursor/refactor-welle-3-iii-c-story-perspective-...` | `story/` + `shared/perspective-*` Modul-Split | Cloud-Lauf NACH 3-III-b |

R2 (1 Cloud-Agent seriell) gilt: **erst Vorbereitung mergen, dann
3-III-a, dann 3-III-b, dann 3-III-c**.

## Aufgabe DIESES Cloud-Laufs (Vorbereitung)

Schritte 0, 1, 2, 3 (Char-Tests fuer kleine Files), 4 (Backlog), 5 (entfaellt), 6 (entfaellt), 7 nach Methodik.
**Keine Modul-Splits** und **keine Code-Aenderungen** fuer die Welle-3-III-Files.

### Schritt 0 — Bestands-Audit

- File: [`00-audit.md`](./00-audit.md) — bereits angelegt
- 3 Tabellen (Rules, Tests, Docs) wie in [Vorbild](../welle-3-archiv-detail/00-audit.md).

### Schritt 1 — Inventur

- File: [`01-inventory.md`](./01-inventory.md) — bereits angelegt
- Skript: `node scripts/ui-welle-3iii-stats.mjs`

### Schritt 2 — Contracts

- Neue Rule: `.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc` — bereits angelegt
- Sieht mindestens vor:
  - **§1 Determinismus**: Galerie-/Chat-/Story-Komponenten sind UI-Renderer
  - **§2 Fehler-Semantik**: Keine leeren Catches, keine Comment-only-Catches
  - **§3 Erlaubte/verbotene Abhaengigkeiten**: Welle 3-III darf NICHT direkt Storage-Provider importieren — nur ueber `useStorage()` / Helper
  - **§4 Skip-/Default-Semantik**: Galerie ohne Items / Chat ohne Konversation / Story ohne Topics — sichtbarer Empty-State
  - **§5 URL-State-Vertrag** (Galerie + Story): Single Source of Truth fuer Reload-bare State
  - **§6 Modul-Split-Vertrag** (vorbereitend fuer Sub-Wellen)
  - **§7 Storage-Branches verboten**
  - **§8 `'use client'`-Direktiven minimieren**
  - **§9 Code-Review-Checkliste**

### Schritt 3 — Characterization Tests

Pflicht in DIESER PR (kleinere Files, die Sicherheitsnetz fuer Sub-Wellen werden):

1. `tests/unit/components/library/chat/chat-utils.test.ts`
2. `tests/unit/components/library/chat/chat-storage.test.ts`
3. `tests/unit/components/library/chat/chat-suggested-questions.test.tsx`
4. `tests/unit/components/library/gallery/view-mode-toggle.test.tsx`
5. `tests/unit/components/library/gallery/items-grid.test.tsx`
6. `tests/unit/components/library/file-category-filter.test.tsx`

**Char-Tests fuer chat-panel/gallery-root/perspective-page-content** kommen
in den jeweiligen Sub-Wellen 3-III-a/b/c — sonst sprengt der Diff.

### Schritt 4 — Altlast-Pass

**Keine** Code-Aenderungen in DIESER PR. Hot-Spot-Backlog in
[`04-altlast-pass.md`](./04-altlast-pass.md) dokumentiert.

Begruendung: 0 leere Catches, 0 Storage-Branches, 0 `any`. Die einzigen
"echten" Altlasten sind Comment-only-Catches (~15 Stueck), die in den
jeweiligen Modul-Splits in Sub-Welle 3-III-a/b mit-fixiert werden.

### Schritt 5 — Strangler-Fig

Entfaellt in Vorbereitung.

### Schritt 6 — Dead-Code

- `pnpm knip` laufen lassen → falls Welle-3-III-relevante Funde
  ausserhalb der Sub-Welle-Files: hier dokumentieren
- Doku-Hygiene: `docs/reference/file-index.md` und
  `docs/reference/modules/library.md` werden in Sub-Wellen aktualisiert

### Schritt 7 — Abnahme

- Methodik-DoD + Modul-DoD wie Welle 3-II-Vorbereitung
- **Modul-DoD fuer DIESE PR**: 0 NEUE leere Catches, 0 NEUE Storage-Branches,
  >= 6 neue Char-Test-Files, ca. 30+ neue Test-Cases
- Sub-Wellen-Plan in [`06-acceptance.md`](./06-acceptance.md) als Roadmap

## Sub-Wellen-Briefs (fuer Folge-Cloud-Lauefe)

**Strategie ab 2026-04-30**: Pro Sub-Welle EINE PR mit mehreren
kohaerenten Commits — siehe [`refactor-batch-strategy.mdc`](../../../.cursor/rules/refactor-batch-strategy.mdc).

### Cloud-Auftrag fuer 3-III-a (Gallery) — 1 PR

```
Lies VOR dem Start:
- docs/refactor/welle-3-iii-galerie-chat/AGENT-BRIEF.md (Sektion "3-III-a")
- docs/refactor/welle-3-iii-galerie-chat/04-altlast-pass.md (Hot-Spot-Liste)
- .cursor/rules/welle-3-iii-galerie-chat-contracts.mdc
- .cursor/rules/refactor-batch-strategy.mdc (1 PR pro Welle)
- AGENTS.md (Branching/Stop-Bedingungen)

Aufgabe: gallery-root.tsx (994z, 49 Hooks!) + document-card.tsx (639z) +
virtualized-items-view.tsx (470z) Modul-Splits + Hook-Extraktion.

Branch: cursor/refactor-welle-3-iii-a-gallery-<suffix>

Strategie: 1 PR mit ca. 8-12 kohaerenten Commits, jeder unter 1.000 Zeilen Diff.

Zielstruktur (Vorschlag, im Audit verfeinern):
  src/components/library/gallery/gallery-root/
    index.tsx                       # Composer
    view-mode-switch.tsx            # Items vs Grouped vs Virtualized
    bulk-toolbar.tsx                # Bulk-Actions
    hooks/
      use-gallery-data.ts           # Data-Loading
      use-gallery-selection.ts      # Bulk-Auswahl
      use-gallery-url-state.ts      # nuqs-Integration
      use-gallery-filters.ts        # Filter-State

  src/components/library/gallery/document-card/
    index.tsx                       # Composer
    card-header.tsx
    card-body.tsx
    card-footer.tsx
    helpers.ts                      # Pure-Helpers fuer Card-Display

  src/components/library/gallery/virtualized-items-view/
    index.tsx
    hooks/use-virtualized-items.ts

Empfohlene Commit-Reihenfolge:
  1. Char-Tests fuer gallery-root, items-view, grouped-items-view, document-card
  2. Pure-Helpers extrahieren (gallery-helpers.ts)
  3. document-card splitten in card-header/body/footer
  4. virtualized-items-view: use-virtualized-items extrahieren
  5. gallery-root: use-gallery-url-state extrahieren
  6. gallery-root: use-gallery-data extrahieren
  7. gallery-root: use-gallery-selection extrahieren
  8. gallery-root: bulk-toolbar als Sub-Komponente
  9. gallery-root: Composer-Integration
  10. Comment-only-Catches in document-share-button, switch-to-story-mode-button, speaker-icons fixen (Logging)
  11. Cleanup ungenutzte Imports (NACH pnpm build, PFLICHT im selben PR)
  12. Acceptance-Doc 06-acceptance-3-iii-a.md

Vor jedem Push: pnpm test + pnpm lint + pnpm build (PFLICHT!).

Stop wenn:
- 1 Commit > 1.000 Zeilen Diff (splitten)
- PR > 5.000 Zeilen Brutto-Diff (ohne Plan-Begruendung)
- PR > 15 Commits
- URL-State-Vertrag wird gebrochen (siehe Contracts §5)

PR als Draft. Smoke-Test-Plan im PR-Body (siehe 05-user-test-plan.md).
Antworte auf Deutsch.
```

### Cloud-Auftrag fuer 3-III-b (Chat) — 1 PR

```
Lies VOR dem Start:
- docs/refactor/welle-3-iii-galerie-chat/AGENT-BRIEF.md (Sektion "3-III-b")
- docs/refactor/welle-3-iii-galerie-chat/04-altlast-pass.md (Hot-Spot-Liste)
- .cursor/rules/welle-3-iii-galerie-chat-contracts.mdc
- .cursor/rules/chat-contracts.mdc (Backend, UI ist Konsument)
- .cursor/rules/refactor-batch-strategy.mdc
- AGENTS.md

Aufgabe: chat-panel.tsx (1.268z, 36 Hooks!) + chat-reference-list.tsx (527z) +
use-chat-stream.ts (492z) + debug-panel.tsx (440z) + processing-status.tsx (392z) +
use-chat-toc.ts (326z) + chat-config-display.tsx (378z) Modul-Splits + Hook-Extraktion.

Branch: cursor/refactor-welle-3-iii-b-chat-<suffix>

Strategie: 1 PR mit ca. 10-14 kohaerenten Commits.

Zielstruktur (Vorschlag, im Audit verfeinern):
  src/components/library/chat/chat-panel/
    index.tsx                       # Composer
    panel-header.tsx
    panel-body.tsx                  # Welcome / MessagesList / Streaming
    panel-footer.tsx                # ChatInput + Suggested
    hooks/
      use-chat-panel-state.ts
      use-chat-panel-config.ts

  src/components/library/chat/chat-reference-list/
    index.tsx                       # Container
    single-ref.tsx                  # Eintrag
    helpers.ts                      # Pure-Helpers

  src/components/library/chat/debug-panel/
    index.tsx                       # Tabs-Composer
    (debug-step-table, debug-timeline, debug-trace bleiben single-files)

  src/components/library/chat/hooks/use-chat-stream/
    index.ts                        # Hook
    reducer.ts                      # Pure-Reducer (testbar!)
    types.ts

  src/components/library/chat/hooks/use-chat-toc/
    index.ts                        # Hook
    toc-builder.ts                  # Pure-Builder (testbar!)

Empfohlene Commit-Reihenfolge:
  1. Char-Tests fuer chat-panel, chat-message, chat-input, use-chat-stream-reducer, use-chat-toc-builder
  2. Pure-Helpers extrahieren (chat-utils, toc-builder, stream-reducer)
  3. chat-panel: use-chat-panel-state extrahieren
  4. chat-panel: panel-header / panel-body / panel-footer als Sub-Komponenten
  5. chat-panel: Composer-Integration
  6. chat-reference-list: single-ref als Sub-Komponente
  7. debug-panel: Tabs aufsplitten
  8. use-chat-stream: reducer ausgliedern
  9. use-chat-toc: builder ausgliedern
  10. processing-status: Helpers extrahieren
  11. chat-config-display: Helpers extrahieren
  12. Comment-only-Catches in chat-storage, chat-panel, hooks fixen (Logging via safeParseJSON)
  13. Cleanup ungenutzte Imports (NACH pnpm build, PFLICHT im selben PR)
  14. Acceptance-Doc 06-acceptance-3-iii-b.md

Vor jedem Push: pnpm test + pnpm lint + pnpm build (PFLICHT).

Stop-Bedingungen siehe refactor-batch-strategy.mdc + welle-3-iii-galerie-chat-contracts.mdc.

PR als Draft. Smoke-Test-Plan im PR-Body.
Antworte auf Deutsch.
```

### Cloud-Auftrag fuer 3-III-c (Story + Perspective) — 1 PR

```
Lies VOR dem Start:
- docs/refactor/welle-3-iii-galerie-chat/AGENT-BRIEF.md (Sektion "3-III-c")
- docs/refactor/welle-3-iii-galerie-chat/04-altlast-pass.md
- .cursor/rules/welle-3-iii-galerie-chat-contracts.mdc
- .cursor/rules/refactor-batch-strategy.mdc
- AGENTS.md

Aufgabe: shared/perspective-page-content.tsx (926z, 13 Hooks) +
shared/perspective-display.tsx (275z) + story/story-topics.tsx (394z) +
story-header.tsx + story-mode-header.tsx Modul-Splits.

Gesamt-Volumen: ca. 1.800 Zeilen ueber 5 Files. Aufwaerm-Sub-Welle.

Branch: cursor/refactor-welle-3-iii-c-story-perspective-<suffix>

Strategie: 1 PR mit ca. 6-9 kohaerenten Commits.

Zielstruktur:
  src/components/library/shared/perspective-page-content/
    index.tsx                       # Composer
    header.tsx
    body.tsx
    tabs.tsx
    hooks/use-perspective-data.ts

  src/components/library/story/story-topics/
    index.tsx
    topic-list.tsx
    topic-card.tsx

Empfohlene Commit-Reihenfolge:
  1. Char-Tests fuer perspective-page-content, story-topics
  2. perspective-page-content: header/body/tabs ausgliedern
  3. perspective-page-content: use-perspective-data Hook ausgliedern
  4. perspective-page-content: Composer-Integration
  5. story-topics: topic-list/topic-card ausgliedern
  6. perspective-display: Helpers extrahieren
  7. Cleanup
  8. Acceptance-Doc 06-acceptance-3-iii-c.md
  9. Gesamt-Acceptance 06-acceptance-GESAMT.md

Vor jedem Push: pnpm test + pnpm lint + pnpm build (PFLICHT).

PR als Draft. Smoke-Test-Plan im PR-Body.
Antworte auf Deutsch.
```

## Push-Strategie

**Du PUSHST NICHT auf master.** Stattdessen:

- Eigener Branch pro Sub-Welle: `cursor/refactor-welle-3-iii-<sub>-<suffix>`
- Mehrere kohaerente Commits, jeder unter 1.000 Zeilen Diff
- **Eine PR pro Sub-Welle** (siehe `.cursor/rules/refactor-batch-strategy.mdc`)
- Kein Auto-Merge — User reviewt, smoke-testet, merged dann selbst.

## Stop-Bedingungen

Stoppe und melde dem User, wenn:
- `> 1.000 Zeilen Diff` in einem **einzelnen** Commit (hart — splitte)
- `> 5.000 Zeilen Brutto-Diff` in einer **PR** ohne Plan-Begruendung
- `> 15 Commits` in einer PR
- Tests werden rot und du findest die Ursache nicht in 30 Min
- `pnpm build` rot und nach 3 Versuchen keine Loesung
- React-Error-Boundary-Fehler im UI nach Refactor — erst mit User klaeren
- Architektur-Frage auftritt, die nicht im Brief geklaert ist
- URL-State-Vertrag wird gebrochen (siehe Contracts §5)
- Storage-Provider-Live-Calls werden noetig — verboten, sauber mocken
- Backend-`chat`-Service direkt importiert wird (statt `/api/chat/...`)

## Daten zum Mitnehmen

- Repo: `bCommonsLAB/CommonKnowledgeScout`, default branch `master`
- Aktueller Stand `master`: Wellen 0-2 + 3-I + 3-II + 3-II-Hooks abgenommen
- Test-Setup: `pnpm install` (Node 20+, pnpm 9.15.3)
- Tools (Reihenfolge verbindlich vor jedem Push):
  1. `pnpm test` — Vitest
  2. `pnpm lint` — ESLint via `next lint`
  3. **`pnpm build`** — `next build`, **PFLICHT** (siehe Lehre PR #31)
  4. `node scripts/ui-welle-3iii-stats.mjs` — Welle-3-III-Stats
  5. `pnpm knip` — Dead-Code (optional)
- **Keine** Live-Storage-Provider-Calls, keine Live-Mongo-Calls, keine Live-Chat-LLM-Calls (alles mocken)
