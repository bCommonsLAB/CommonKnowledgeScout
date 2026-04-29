# Inventur: Welle 3-II — Archiv-Detail

Stand: 2026-04-29. Quelle: [`scripts/ui-welle-3ii-stats.mjs`](../../../scripts/ui-welle-3ii-stats.mjs).

## 1. Welle-Health-Zusammenfassung

| Metrik | Wert | Bewertung vs. Backend-Modul-Schwelle |
|---|---:|---|
| Files | 57 | – |
| Gesamt-Zeilen | 20.508 | – (4x Welle 3-I) |
| Files > 200 Zeilen | 26 von 57 (46%) | **rot** (Schwelle: 0) |
| Max-Zeilen einer Datei | 3.701 (`file-preview.tsx`) | **rot** (Schwelle: 200) |
| Hooks gesamt | 380 | – |
| Max-Hooks einer Datei | 66 (`file-preview.tsx`) | **rot** (vergleichbar mit `creation-wizard.tsx`) |
| Leere Catches | **7** (in 5 Files) | **rot** (Schwelle: 0) |
| Storage-Branches im UI | **1** (in `freshness-comparison-panel.tsx`) | **rot** (Verstoss gegen `storage-abstraction.mdc`) |
| `'use client'`-Direktiven | 54 von 57 | erwartet bei UI |
| `any` | 0 | gruen |
| Existierende Vitest-Tests fuer Welle 3-II | **0** | **rot** (0% Coverage) |

**Vergleich zu Welle 3-I**: 4x Volumen (20.508 vs 5.427 Zeilen), 4x Hot-Spot-Files
(file-preview, job-report-tab, markdown-preview, media-tab), und 2x mehr leere
Catches. Modul-Splits dominieren — daher 5 Cloud-Lauefe (Vorbereitung +
3-II-a/b/c/d).

## 2. Files (verifiziert via `node scripts/ui-welle-3ii-stats.mjs`)

### Hauptkomponenten der Detail-View (6 Files, 9.534 Zeilen, 164 Hooks)

| Datei | Zeilen | Hooks | use-client | catch{} | hat Test |
|---|---:|---:|---:|---:|---|
| `src/components/library/file-preview.tsx` | **3.701** | **66** | 1 | **1** | nein ← 3-II-a |
| `src/components/library/job-report-tab.tsx` | 2.284 | 30 | 1 | 0 | nein ← 3-II-c |
| `src/components/library/markdown-preview.tsx` | 2.054 | 41 | 0 | **3** | nein ← 3-II-b |
| `src/components/library/media-tab.tsx` | 1.147 | 13 | 1 | 0 | nein ← 3-II-c |
| `src/components/library/detail-view-renderer.tsx` | 192 | 11 | 1 | 0 | nein ← Vorbereitung-PR |
| `src/components/library/document-preview.tsx` | 156 | 3 | 1 | 0 | nein |

### `*-detail.tsx`-Familie (11 Files, 2.822 Zeilen, 41 Hooks)

| Datei | Zeilen | Hooks | use-client | hat Test |
|---|---:|---:|---:|---|
| `src/components/library/session-detail.tsx` | **1.042** | 19 | 1 | nein ← 3-II-d |
| `src/components/library/diva-document-detail.tsx` | 368 | 0 | 1 | nein |
| `src/components/library/book-detail.tsx` | 363 | 0 | 1 | nein |
| `src/components/library/climate-action-detail.tsx` | 333 | 0 | 1 | nein |
| `src/components/library/diva-texture-detail.tsx` | 178 | 0 | 1 | nein |
| `src/components/library/testimonial-detail.tsx` | 174 | 1 | 1 | nein ← Vorbereitung-PR |
| `src/components/library/ingestion-book-detail.tsx` | 85 | 5 | 1 | nein |
| `src/components/library/ingestion-session-detail.tsx` | 79 | 4 | 1 | nein |
| `src/components/library/ingestion-diva-document-detail.tsx` | 72 | 4 | 1 | nein |
| `src/components/library/ingestion-diva-texture-detail.tsx` | 65 | 4 | 1 | nein |
| `src/components/library/ingestion-climate-action-detail.tsx` | 63 | 4 | 1 | nein |

### Audio/Video/Image/PDF-Renderer (10 Files, 2.378 Zeilen, 70 Hooks)

| Datei | Zeilen | Hooks | use-client | catch{} | hat Test |
|---|---:|---:|---:|---:|---|
| `src/components/library/pdf-canvas-viewer.tsx` | 315 | 7 | 1 | 0 | nein |
| `src/components/library/pdf-transform.tsx` | 292 | 8 | 1 | **1** | nein |
| `src/components/library/image-preview.tsx` | 275 | 7 | 1 | 0 | nein ← Vorbereitung-PR |
| `src/components/library/audio-player.tsx` | 267 | 7 | 1 | 0 | nein |
| `src/components/library/pdf-phases-view.tsx` | 242 | 14 | 1 | 0 | nein |
| `src/components/library/video-player.tsx` | 229 | 7 | 1 | 0 | nein |
| `src/components/library/pdf-phase-settings.tsx` | 193 | 7 | 1 | 0 | nein |
| `src/components/library/audio-transform.tsx` | 189 | 4 | 1 | **1** | nein |
| `src/components/library/image-transform.tsx` | 188 | 5 | 1 | 0 | nein |
| `src/components/library/video-transform.tsx` | 188 | 4 | 1 | **1** | nein |

### Markdown-Sub-Komponenten + Detail-Tab-Helper (12 Files, 2.305 Zeilen, 27 Hooks)

| Datei | Zeilen | Hooks | use-client | hat Test |
|---|---:|---:|---:|---|
| `src/components/library/cover-image-generator-dialog.tsx` | 458 | 3 | 1 | nein |
| `src/components/library/markdown-metadata.tsx` | 437 | 2 | 0 | nein ← Vorbereitung-PR |
| `src/components/library/transform-save-options.tsx` | 314 | 2 | 1 | nein |
| `src/components/library/phase-stepper.tsx` | 190 | 7 | 1 | nein |
| `src/components/library/event-details-accordion.tsx` | 144 | 1 | 1 | nein |
| `src/components/library/ingestion-status.tsx` | 140 | 3 | 1 | nein |
| `src/components/library/slide-accordion.tsx` | 120 | 0 | 1 | nein |
| `src/components/library/text-editor.tsx` | 87 | 4 | 1 | nein ← Vorbereitung-PR |
| `src/components/library/transform-result-handler.tsx` | 63 | 3 | 1 | nein ← Vorbereitung-PR |
| `src/components/library/chapter-accordion.tsx` | 61 | 0 | 1 | nein |
| `src/components/library/markdown-audio.tsx` | 41 | 0 | 1 | nein |

### `flow/*` (3 Files, 979 Zeilen, 20 Hooks)

| Datei | Zeilen | Hooks | use-client | hat Test |
|---|---:|---:|---:|---|
| `src/components/library/flow/pipeline-sheet.tsx` | **671** | 15 | 1 | nein ← 3-II-d |
| `src/components/library/flow/source-renderer.tsx` | 157 | 3 | 1 | nein |
| `src/components/library/flow/artifact-tabs.tsx` | 151 | 2 | 1 | nein |

### `shared/*` ohne `perspective-*` (15 Files, 2.490 Zeilen, 58 Hooks)

| Datei | Zeilen | Hooks | use-client | storage-branch | hat Test |
|---|---:|---:|---:|---:|---|
| `src/components/library/shared/shadow-twin-artifacts-table.tsx` | 393 | 2 | 0 | 0 | nein |
| `src/components/library/shared/artifact-info-panel.tsx` | 333 | 11 | 1 | 0 | nein |
| `src/components/library/shared/artifact-markdown-panel.tsx` | 325 | 7 | 1 | 0 | nein |
| `src/components/library/shared/freshness-comparison-panel.tsx` | 281 | 3 | 1 | **1** | nein ← Vorbereitung-PR (Storage-Branch) |
| `src/components/library/shared/shadow-twin-sync-banner.tsx` | 215 | 2 | 1 | 0 | nein |
| `src/components/library/shared/story-view.tsx` | 160 | 2 | 1 | 0 | nein |
| `src/components/library/shared/source-and-transcript-pane.tsx` | 151 | 2 | 1 | 0 | nein |
| `src/components/library/shared/use-story-status.ts` | 148 | 6 | 1 | 0 | nein ← Vorbereitung-PR |
| `src/components/library/shared/artifact-edit-dialog.tsx` | 142 | 3 | 1 | 0 | nein |
| `src/components/library/shared/ingestion-status-compact.tsx` | 133 | 4 | 1 | 0 | nein |
| `src/components/library/shared/use-ingestion-data.ts` | 122 | 5 | 1 | 0 | nein |
| `src/components/library/shared/ingestion-detail-panel.tsx` | 103 | 6 | 1 | 0 | nein |
| `src/components/library/shared/use-resolved-transcript-item.ts` | 100 | 3 | 1 | 0 | nein |
| `src/components/library/shared/ingestion-data-context.tsx` | 59 | 4 | 1 | 0 | nein |
| `src/components/library/shared/story-status-icons.tsx` | 55 | 0 | 1 | 0 | nein |
| `src/components/library/shared/story-status.ts` | 20 | 0 | 1 | 0 | nein ← Vorbereitung-PR |

## 3. Hot-Spots fuer Schritt 4 (Altlast-Pass)

### Vorbereitung (DIESE PR)

| Hot-Spot | Datei(en) | Massnahme |
|---|---|---|
| **7 leere Catches** | `file-preview.tsx:3652` (1), `markdown-preview.tsx:859,863,931` (3), `audio-transform.tsx:136` (1), `video-transform.tsx:136` (1), `pdf-transform.tsx:164` (1) | Logging mit Begruendung, kein `throw` (UI-Render-Pfade) |
| **1 Storage-Branch** | `shared/freshness-comparison-panel.tsx:145` | `data.config.primaryStore === "filesystem"` durch Helper aus `library-capability.ts` ersetzen oder API-Response-Flag |

### Sub-Wellen 3-II-a/b/c/d

| Hot-Spot | Datei | Sub-Welle |
|---|---|---|
| **66 Hooks, 3.701 Zeilen** | `file-preview.tsx` | 3-II-a (Modul-Split nach View-Typ) |
| **41 Hooks, 2.054 Zeilen** | `markdown-preview.tsx` | 3-II-b |
| **30 Hooks, 2.284 Zeilen** | `job-report-tab.tsx` | 3-II-c |
| **13 Hooks, 1.147 Zeilen** | `media-tab.tsx` | 3-II-c |
| **19 Hooks, 1.042 Zeilen** | `session-detail.tsx` | 3-II-d |
| **15 Hooks, 671 Zeilen** | `flow/pipeline-sheet.tsx` | 3-II-d |

## 4. Hot-Spots fuer Schritt 3 (Characterization Tests)

### Vorbereitung (DIESE PR — 8 kleinere Files mit klarem Vertrag)

- `testimonial-detail.test.tsx` (174z, 1 Hook — Render-Smoke)
- `image-preview.test.tsx` (275z, 7 Hooks — Render-Smoke)
- `text-editor.test.tsx` (87z, 4 Hooks — Render-Smoke + onSave-Vertrag)
- `transform-result-handler.test.tsx` (63z, 3 Hooks — Render-Smoke)
- `story-status.test.ts` (20z Pure Helper)
- `use-story-status.test.tsx` (148z Hook)
- `detail-view-renderer.test.tsx` (192z, 11 Hooks — Render-Switch nach `detailViewType`)
- `markdown-metadata.test.tsx` (437z, 2 Hooks — Render-Smoke + Field-Validation)

### Sub-Wellen 3-II-a/b/c/d

- file-preview-* Tests in 3-II-a (pro View-Typ ein File)
- markdown-preview-* Tests in 3-II-b
- job-report-tab-* + media-tab-* Tests in 3-II-c
- session-detail / pipeline-sheet Tests in 3-II-d

## 5. Zentrale Architektur-Rules (potentiell betroffen)

- [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) — 1 Verstoss in `freshness-comparison-panel.tsx`, wird in dieser PR gefixt
- [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) — 7 Verstoesse, alle in dieser PR gefixt
- [`media-lifecycle.mdc`](../../../.cursor/rules/media-lifecycle.mdc) — `cover-image-generator-dialog.tsx`, `media-tab.tsx`, `markdown-metadata.tsx` muessen Frontmatter-Vertrag respektieren
- [`shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc) — viele Detail-Tabs konsumieren Shadow-Twin-State
- [`detail-view-type-checklist.mdc`](../../../.cursor/rules/detail-view-type-checklist.mdc) — `detail-view-renderer.tsx`, `job-report-tab.tsx`, alle `*-detail.tsx`
- Neue Rule: `welle-3-archiv-detail-contracts.mdc` (Schritt 2)

## 6. Bekannte Risiken / Watchpoints

- **`file-preview.tsx`-Modul-Split (3-II-a)** ist die Schluesselentscheidung der Welle. 66 Hooks, sehr viele State-Branches nach View-Typ. Eigene Mehr-Phasen-Sub-Welle.
- **DetailViewType-Vertrag** (`detail-view-type-checklist.mdc`) muss in 3-II-c und 3-II-d strikt eingehalten werden — `job-report-tab.tsx` ist Punkt 9 in der Checkliste, jeder Modul-Split muss den Pfad stabil halten.
- **Visuelle Abnahme zwingend lokal** fuer alle Sub-Wellen (siehe Plan-Sektion 8.6).
