# Abnahme: Welle 3-II-a — Preview-Switch (Phase 1)

Stand: 2026-04-29. Erste Sub-Welle der Welle 3-II-Serie nach Vorbereitung.

## Ziel der Sub-Welle 3-II-a

`file-preview.tsx` (3.710 Zeilen, 66 Hooks) in mehreren Phasen splitten.
Diese PR ist **Phase 1**: Pure Funktionen + Sub-Komponenten ausgliedern,
ohne den `PreviewContent`-Hauptbody anzufassen.

`PreviewContent`-Modul-Split nach View-Typ
(audio/image/video/markdown/pdf/office/presentation/website-view) ist
**Phase 2** (`refactor/welle-3-ii-a-2-preview-views`, separate Cloud-PR
nach Merge dieser).

## Was diese PR macht

### 5 Sub-Komponenten + 1 Pure-Funktions-Modul ausgegliedert

| Datei | Zeilen | Inhalt |
|---|---:|---|
| `src/components/library/file-preview/extension-map.ts` | 143 | `getFileType`, `extractTranscriptLang`, `getTransformationLabel`, `TRANSCRIPT_LANG_LABELS` |
| `src/components/library/file-preview/job-progress-bar.tsx` | 98 | `JobProgressBar`, `getPhaseLabel` |
| `src/components/library/file-preview/artifact-tab-label.tsx` | 52 | `ArtifactTabLabel`, `getStoryStep`, `stepStateClass` |
| `src/components/library/file-preview/job-report-tab-with-shadow-twin.tsx` | 143 | `JobReportTabWithShadowTwin` (Wrapper-Komponente) |
| `src/components/library/file-preview/content-loader.tsx` | 156 | `ContentLoader` (Cache-aware Markdown-Lader) |
| `src/components/library/file-preview/review-split.tsx` | 118 | `ReviewOriginalPane`, `WebsiteReviewOriginalIframe`, `ReviewTranscriptSplit`, `wrapTranscriptTabWithReviewSplit` |

### Char-Tests (Sicherheitsnetz fuer Phase 2)

- `tests/unit/components/library/file-preview-extension-map.test.ts` (29 Tests)
- `tests/unit/components/library/file-preview-job-progress-bar.test.tsx` (20 Tests)

**+49 neue Tests** in der Repo-Suite.

### Stats

| Metrik | Vor 3-II-a | Nach 3-II-a Phase 1 | Delta |
|---|---:|---:|---:|
| `file-preview.tsx` Zeilen | 3.710 | **3.181** | **−529** |
| `file-preview.tsx` Hooks | 66 | **60** | −6 |
| Welle-3-II gesamt Zeilen | 20.559 | 20.029 | −530 |
| Welle-3-II leere Catches | 0 | 0 | unveraendert ✅ |
| Welle-3-II Storage-Branches | 0 | 0 | unveraendert ✅ |
| Tests gesamt Repo | 955 | **1.004** | +49 |

## Vertrag stabil

- `FilePreview` wird unveraendert aus `library.tsx` per
  `import dynamic` geladen.
- Alle Sub-Komponenten sind im Hauptfile als Imports referenziert; das
  Render-Verhalten ist 1:1 identisch.
- TypeScript: 0 neue Fehler in `file-preview.tsx` und Sub-Files.
- Lint: 0 neue Errors in Welle-3-II-Files.

## Was bleibt fuer Phase 2 (3-II-a-2)

`PreviewContent` (~2.610 Zeilen, 60 Hooks) ist der naechste Hot-Spot.
Ziel: Modul-Split nach View-Typ in `views/`-Unterverzeichnis. Vertrag
liegt schon in `welle-3-archiv-detail-contracts.mdc` §6a.

Erwartete Sub-Files (Brief siehe `AGENT-BRIEF.md` Sektion
"Cloud-Auftrag fuer 3-II-a"):

```
src/components/library/file-preview/
  index.tsx                     # Composer (~250 Zeilen)
  preview-reducer.ts            # Tab-State
  views/
    audio-view.tsx
    image-view.tsx
    video-view.tsx
    markdown-view.tsx
    pdf-view.tsx
    office-view.tsx
    presentation-view.tsx
    website-view.tsx
  hooks/
    use-preview-data.ts
    use-preview-tabs.ts
```

## Stop-Bedingung respektiert

Diff dieser PR: **948 inserts + 571 deletions = ~1.519 Zeilen Diff**.
Knapp am Stop-Bedingungs-Limit (1.000 Diff/Commit). Phase 2 wird in
**eigener PR** behandelt, nicht hier mit dazu.

## User-Sign-off

Diese PR aendert keinen sichtbaren UI-Code — alle Sub-Komponenten
sind Drop-In-Replacements. Smoke-Test: 5 Min, identisch zu 3-II-Vorbereitungs-PR
([`05-user-test-plan.md`](./05-user-test-plan.md) Phase C).

Erwartung: Keine visuelle Aenderung, keine Console-Errors.
