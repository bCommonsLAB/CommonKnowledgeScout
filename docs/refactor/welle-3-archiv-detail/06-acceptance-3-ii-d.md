# Welle 3-II-d — Acceptance (Detail + Flow + Shared)

**Branch**: `cursor/refactor-welle-3-ii-d-detail-flow-a03a`
**Stand**: 2026-05-01
**PR**: (folgt nach Push)
**Strategie**: 1 PR pro Welle (siehe `.cursor/rules/refactor-batch-strategy.mdc`)

## Plan-Anpassung gegenueber AGENT-BRIEF.md

AGENT-BRIEF.md schlug fuer 3-II-d folgende 6 Files vor:

```
session-detail.tsx                        (1.041z)
flow/pipeline-sheet.tsx                   (670z)
cover-image-generator-dialog.tsx          (457z)
shared/artifact-info-panel.tsx            (332z)
shared/artifact-markdown-panel.tsx        (324z)
shared/shadow-twin-artifacts-table.tsx    (392z)
                                  Total:   3.216z
```

**Tatsaechliche Struktur**: Wie schon in Welle 3-II-c sind alle 6 Files
**monolithische Render-Funktionen** mit nur wenigen Top-Level-Helpers.
Konkret:

| File | Top-Level-Helpers | Empfehlung |
|---|---|---|
| `session-detail.tsx` | 0 | Skip — Future Work |
| `flow/pipeline-sheet.tsx` | 1 Helper + 4 Types/Konstanten | Ausgliedern |
| `cover-image-generator-dialog.tsx` | 0 | Skip — Future Work |
| `shared/artifact-info-panel.tsx` | 4 Pure-Helpers + 1 Type | Ausgliedern |
| `shared/artifact-markdown-panel.tsx` | 2 Pure-Helpers | Ausgliedern |
| `shared/shadow-twin-artifacts-table.tsx` | 0 + 3 Types | Types ausgliedern |

**Neuer Plan**: Konservativer Helper-Extract fuer 4 von 6 Files.
`session-detail.tsx` und `cover-image-generator-dialog.tsx` haben keine
Top-Level-Helpers und werden in dieser Welle **nicht** angefasst —
Future Work.

## Inhalt (7 Schritte / 6 Commits)

| Schritt | Inhalt | Neuer File / Aenderung | Brutto-Diff |
|---|---|---|---:|
| 1 | Char-Tests fuer alle Pure-Helpers (28 Cases) | 3 Test-Files | 250 |
| 2 | artifact-info-panel: 4 Helpers + MongoArtifact-Type | `shared/artifact-info-panel/helpers.ts` (46z) | 128 |
| 3 | artifact-markdown-panel: 2 Helpers (`isCompositeContainerContent`, `stripFrontmatterBlock`) | `shared/artifact-markdown-panel/helpers.ts` (34z) | 87 |
| 4 | shadow-twin-artifacts-table: 3 Types | `shared/shadow-twin-artifacts-table/types.ts` (61z) | 103 |
| 5+6 | pipeline-sheet: 1 Helper + 3 Types + 2 Konstanten + Cleanup | `flow/pipeline-sheet/helpers.ts` (85z) | 190 |
| 7 | Acceptance-Doc | `06-acceptance-3-ii-d.md` (folgt) | ~150 |

**Brutto-Diff Gesamt**: 11 Files, +491 / -157 (648 Zeilen) — sehr klein.

## Volumen-Statistik

| File | Vorher | Nachher | Differenz |
|---|---:|---:|---:|
| `shared/artifact-info-panel.tsx` | 332 | 308 | -24 (-7.2%) |
| `shared/artifact-markdown-panel.tsx` | 324 | 319 | -5 (-1.5%) |
| `shared/shadow-twin-artifacts-table.tsx` | 392 | 358 | -34 (-8.7%) |
| `flow/pipeline-sheet.tsx` | 670 | 621 | -49 (-7.3%) |
| **Total** | **1.718** | **1.606** | **-112 (-6.5%)** |

| Neue Sub-Module | Zeilen |
|---|---:|
| `shared/artifact-info-panel/helpers.ts` | 46 |
| `shared/artifact-markdown-panel/helpers.ts` | 34 |
| `shared/shadow-twin-artifacts-table/types.ts` | 61 |
| `flow/pipeline-sheet/helpers.ts` | 85 |
| **Total** | **226** |

| Test-Cases | 0 → 28 (+28) |
|---|---|

## Re-Export-Pattern bei pipeline-sheet

Eine wichtige Eigenheit: `flow/pipeline-sheet.tsx` exportiert seine Types
und Konstanten weiterhin selbst (Re-Export), damit alle Konsumenten
(`file-preview/views/audio-view.tsx`, `pdf-view.tsx` etc.) ihre Imports
nicht aendern muessen.

```ts
// Im Mutterfile:
export {
  type PipelinePolicies,
  type CoverImageOptions,
  type ExistingArtifacts,
  type LlmModelOption,
  TRANSCRIPTION_SOURCE_LANGUAGES,
  TRANSFORMATION_TARGET_LANGUAGES,
  isNonEmptyString,
} from './pipeline-sheet/helpers'
```

Dies ist ein **bewusstes Architektur-Pattern**, das die externe API stabil
haelt waehrend interne Modularitaet erhoeht wird.

## Future Work (nicht Teil dieser Welle)

### session-detail.tsx (1.041z)
Komplett unangetastet. Hat keine Top-Level-Helpers — alle Logik im
Render-Body. Sub-Komponenten-Split braucht Architektur-Entscheidung
(Hooks vs. Sub-Components).

### cover-image-generator-dialog.tsx (457z)
Auch unangetastet. Selbe Situation. Das `GeneratedImage` Interface ist
inline und koennte in Future Work in eine separate Datei.

### Empfehlung
Diese 2 Files haben keine "low-hanging fruit". Wenn sie refactored werden
sollen, dann mit **Hook-Extraktion** (z.B. `use-session-data`,
`use-image-generation`) — das ist Teil von Welle 3-III oder eines
spaeteren Cycles.

## Methodik-DoD

| Kriterium | Status |
|---|---|
| 1 PR pro Welle | OK |
| Pro Schritt eigener Commit | OK (6 Commits) |
| Char-Tests vor Code-Aenderungen | OK (Schritt 1: 28 Cases) |
| `pnpm test` gruen | OK (1.124 Tests / 175 Files, 18.5s) |
| `pnpm lint` gruen | OK (nur vor-existierende Warnings) |
| `pnpm build` gruen | OK (77s, exit 0) |
| < 1.000 Zeilen Diff pro Commit | OK (max 250z) |
| < 5.000 Zeilen Brutto pro PR | OK (648z) |
| < 15 Commits pro PR | OK (6 Commits + Doc) |
| Cleanup im selben PR | OK (in Schritt 5+6 zusammengelegt) |
| Keine neuen `any`, keine neuen `catch{}` | OK (1:1 portierter Code) |

## Welle 3-II Gesamt-Bilanz (3-II-a + 3-II-b + 3-II-c + 3-II-d abgeschlossen)

| Welle | Hauptdatei vorher | Hauptdatei nachher | Sub-Module | Char-Tests |
|---|---:|---:|---:|---:|
| 3-II-a (file-preview) | 4.230 | 1.288 | 9 Views + 5 Helpers | 27 |
| 3-II-b (markdown-preview) | 2.064 | 798 | 4 Sub-Module | 6 |
| 3-II-b (markdown-metadata) | 437 | 287 | 1 Sub-Module | (gemeinsam) |
| 3-II-c (job-report-tab) | 2.296 | 2.262 | 1 Helper | 8 |
| 3-II-c (media-tab) | 1.187 | 958 | 1 Helper | 13 |
| 3-II-d (4 Files) | 1.718 | 1.606 | 4 Sub-Module | 28 |
| **Total** | **11.932** | **7.199** | **20 Sub-Module** | **82 Cases** |

**Welle-3-II Gesamt-Reduktion**: **-4.733 Zeilen (-39.7%)** in den 6
Hauptdateien.

## Smoke-Test fuer User

**Was getestet werden soll**: Welle 3-II-d hat NUR Pure-Helper + Types
ausgelagert — kein UI-Verhalten geaendert. Smoke-Test bestaetigt nur,
dass nichts kaputt ging.

3 Klicks:

1. **Datei-Detail mit Transformation oeffnen** → Tab "Transformation" →
   Tab "Markdown": ArtifactMarkdownPanel rendert Inhalt korrekt
   (stripFrontmatterBlock entfernt das Frontmatter wie bisher).
2. **Tab "Uebersicht"** im Datei-Detail → ArtifactInfoPanel zeigt
   Artefakt-Tabelle mit Datums-Format "DD.MM.YY" + korrekten
   Dateinamen (transcript: `base.de.md`, transformation:
   `base.template.de.md`).
3. **Pipeline-Sheet oeffnen** (Button "Jetzt erstellen" oder "Neu
   generieren") → Sprachen-Dropdowns funktionieren wie bisher
   (TRANSCRIPTION_SOURCE_LANGUAGES + TRANSFORMATION_TARGET_LANGUAGES);
   Pipeline-Start funktioniert.

Wenn OK: PR mergen. **Welle 3-II ist abgeschlossen.**

## Verweise

- Welle 3-II-c Acceptance: `06-acceptance-3-ii-c.md`
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc` (PR #35)
- Methodik-Lehre `pnpm build`-Pflicht: PR #31
