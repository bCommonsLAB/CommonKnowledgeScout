# Welle 3-III — Hooks-Extraktion (Future-Work aus Welle 3-II)

**Stand**: 2026-05-01
**Strategie**: 1 PR pro Sub-Welle (siehe `.cursor/rules/refactor-batch-strategy.mdc`)

## Kontext

Welle 3-II hat 6 Hauptdateien des Archiv-Detail-Bereichs auf Pure-Helpers
+ Sub-Komponenten + Types reduziert (-39.7% Zeilen). Was uebrig blieb,
sind monolithische **Render-Funktionen mit tiefen Closures** — diese
liessen sich in 3-II nicht ohne Architektur-Risiko aufteilen.

Welle 3-III fokussiert auf **Hook-Extraktion** als naechsten Refactor-
Schritt. Custom-Hooks kapseln State + Effects + abgeleitete Daten und
sind eine bewaehrte React-Methode, grosse Komponenten zu zerlegen.

## Sub-Wellen-Plan

| Sub-Welle | Datei | Hook(s) | Geschaetzt |
|---|---|---|---:|
| **3-III-a** | `media-tab.tsx` (958z) | `use-gallery-items` | -200z |
| **3-III-b** | `job-report-tab.tsx` (2.262z) | `use-job-report-data` + `use-frontmatter-editor` | -500z |
| **3-III-c** | `session-detail.tsx` (1.041z) | `use-session-data` | -300z |
| **3-III-d** | `cover-image-generator-dialog.tsx` (457z) | `use-image-generation` | -150z |

## Methodik

Wie in 3-II:
1. **Char-Tests** vor Code-Aenderung (Sicherheitsnetz)
2. **Hook + Test-File** in eigenem Modul: `src/hooks/library/use-*.ts` + `tests/unit/hooks/library/use-*.test.tsx`
3. **Komponente** nutzt Hook ueber Destructuring
4. **`pnpm build` Pflicht** vor jedem Push

## Hook-Konventionen

- **Naming**: `use-<scope>-<thing>.ts` (z.B. `use-gallery-items.ts`)
- **Location**: `src/hooks/library/<thing>/` (Sub-Ordner pro Komponente)
- **Tests**: `@testing-library/react` mit `renderHook` (nicht nur Render-Smoke)
- **Outputs**: typisiertes Tupel oder Objekt mit benannten Feldern
- **Inputs**: alle externen Daten via Argumente — keine globalen Atoms im Hook
  selbst (nur in der Komponente, dann an Hook weiterreichen)

## Verweise

- Welle 3-II Gesamt-Acceptance: `../welle-3-archiv-detail/06-acceptance-3-ii-GESAMT.md`
- Methodik-Strategie: `.cursor/rules/refactor-batch-strategy.mdc`
- AGENTS.md (Branching, Stop-Bedingungen)
