# Welle 3-II-Hooks — Hooks-Extraktion (Future-Work aus Welle 3-II)

**Stand**: 2026-05-01
**Status**: ABGESCHLOSSEN (alle 4 Sub-Wellen merged)
**Strategie**: 1 PR pro Sub-Welle (siehe `.cursor/rules/refactor-batch-strategy.mdc`)

> **Naming-Hinweis (2026-05-01)**: Diese Welle hieß ursprünglich
> "Welle 3-III". Sie wurde umbenannt zu **Welle 3-II-Hooks**, weil sie
> inhaltlich die direkte Fortsetzung von Welle 3-II ("Archiv-Detail")
> ist und der Name "3-III" laut Plan-File für die noch nicht begonnene
> Welle "Galerie + Story-Mode + Chat" reserviert ist.
>
> Die neue Naming-Konvention ist in
> `.cursor/rules/refactor-naming-konvention.mdc` festgehalten.

## Kontext

Welle 3-II hat 6 Hauptdateien des Archiv-Detail-Bereichs auf Pure-Helpers
+ Sub-Komponenten + Types reduziert (-39.7% Zeilen). Was uebrig blieb,
sind monolithische **Render-Funktionen mit tiefen Closures** — diese
liessen sich in 3-II nicht ohne Architektur-Risiko aufteilen.

Welle 3-II-Hooks fokussiert auf **Hook-Extraktion** als naechsten
Refactor-Schritt. Custom-Hooks kapseln State + Effects + abgeleitete
Daten und sind eine bewaehrte React-Methode, grosse Komponenten zu
zerlegen.

## Sub-Wellen-Plan (alle abgeschlossen)

| Sub-Welle | Datei | Hook(s) | Reduktion |
|---|---|---|---:|
| **3-II-Hooks-a** | `media-tab.tsx` (958z) | `use-gallery-items` | -161 (-16.8%) |
| **3-II-Hooks-b** | `job-report-tab.tsx` (2.262z) | `use-frontmatter-editor` | -41 (-1.8%) |
| **3-II-Hooks-c** | `session-detail.tsx` (1.041z) | `use-resolved-session-media` | -172 (-16.5%) |
| **3-II-Hooks-d** | `cover-image-generator-dialog.tsx` (457z) | `use-image-generation` | -139 (-30.4%) |

Vollstaendige Bilanz und User-Sign-off siehe
`06-acceptance-3-ii-hooks-GESAMT.md`.

## Methodik

Wie in 3-II:
1. **Char-Tests** vor Code-Aenderung (Sicherheitsnetz)
2. **Hook + Test-File** in eigenem Modul: `src/hooks/library/<scope>/use-*.ts` + `tests/unit/hooks/library/<scope>/use-*.test.tsx`
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
- Naming-Konvention: `../../../.cursor/rules/refactor-naming-konvention.mdc`
- Methodik-Strategie: `.cursor/rules/refactor-batch-strategy.mdc`
- AGENTS.md (Branching, Stop-Bedingungen)
