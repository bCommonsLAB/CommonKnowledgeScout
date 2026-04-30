# Abnahme: Welle 3-II-a Phase 2a — PreviewContent View-Split (audio + image)

Stand: 2026-04-30. Phase 2a der 3-II-a-Sub-Welle. Folgt auf Phase 1
(PR #28, gemerged 2026-04-29).

## Ziel der Phase 2a

`PreviewContent`-Switch nach View-Typ aufsplitten — **diese PR** macht
nur **audio + image** als ersten Pattern-Beweis. Video, default,
markdown, pdf, office, presentation, website kommen in **Phase 2b/2c/2d**
als separate Cloud-PRs.

## Begruendung der Aufteilung in Phase 2a/b/c/d

`PreviewContent` enthaelt einen `switch(fileType)` mit 8 View-Typ-Blöcken
(audio, image, video, markdown, pdf, office, presentation, website,
default). Jeder Block referenziert ~30 State/Hook-Variablen aus der
Composer-Closure.

**Diff-Schaetzung pro View**: ~250 Zeilen Sub-File + ~200 Zeilen Original-
Block geloescht + ~50 Zeilen Char-Test ≈ **~500 Zeilen Diff/View**.

Bei 8 Views in einer PR waeren das **~4.000 Zeilen Diff** — am oberen
Stop-Bedingungs-Limit aus dem AGENT-BRIEF. Zudem riesige Reviewer-
Belastung. Pragmatischer Plan:

- **Phase 2a (diese PR)**: audio + image (kleinere View-Typen, gleiches
  Tab-Schema) → ~1.880 Zeilen Diff.
- **Phase 2b** (`refactor/welle-3-ii-a-2b-preview-views`): video +
  default-View.
- **Phase 2c** (`refactor/welle-3-ii-a-2c-preview-markdown-pdf`):
  markdown-view + pdf-view (komplexer).
- **Phase 2d** (`refactor/welle-3-ii-a-2d-preview-office-website`):
  office-view + presentation-view + website-view.

Jede Folge-Phase nutzt das in dieser PR eingefuehrte
`PreviewViewProps`-Bundle — die Schwerstarbeit ist also einmalig in 2a
geleistet.

## Was diese PR macht

### 4 neue Dateien

| Datei | Zeilen | Inhalt |
|---|---:|---|
| `src/components/library/file-preview/views/view-props.ts` | 122 | `PreviewViewProps`-Interface (gemeinsames Props-Bundle fuer alle View-Typ-Komponenten) + `PreviewInfoTab`-Type + `PreviewPipelinePhase`-Type + `PreviewJobInfo`-Type |
| `src/components/library/file-preview/views/audio-view.tsx` | 327 | `AudioView`-Komponente mit allen 5 Tabs (Original, Transcript, Transformation, Story, Uebersicht) + PipelineSheet |
| `src/components/library/file-preview/views/image-view.tsx` | 245 | `ImageView`-Komponente mit 4 Tabs (Original, Analyse, Story, Uebersicht — KEIN Transcript-Tab fuer Bilder) + PipelineSheet |
| `src/components/library/file-preview/transcript-toolbar-actions.tsx` | 190 | `TranscriptToolbarActions`-Komponente (Icon-Toolbar im Transcript-Tab — Review/Vergleichen, Seiten splitten, Neu generieren) |

### Char-Tests

| Test-File | Tests | Inhalt |
|---|---:|---|
| `tests/unit/components/library/file-preview-audio-view.test.tsx` | 4 | Render-Smoke + Tab-Trigger + JobProgressBar + provider=null-Hinweis |
| `tests/unit/components/library/file-preview-image-view.test.tsx` | 4 | Wie audio-view, aber 4 Tabs (kein Transcript) |

### Aenderungen in `file-preview.tsx`

- `viewProps`-Bundle in `PreviewContent` zusammengebaut (~50 Zeilen)
- `case 'audio':` → `<AudioView {...viewProps} />` (statt 234-Zeilen-Block)
- `case 'image':` → `<ImageView {...viewProps} />` (statt 189-Zeilen-Block)
- `TranscriptToolbarActions`-Definition entfernt (war ~165 Zeilen, jetzt
  Re-Import aus eigener Datei)

### Stats

| Metrik | Vor 3-II-a Phase 2 | Nach 3-II-a Phase 2a | Delta |
|---|---:|---:|---:|
| `file-preview.tsx` Zeilen | 3.180 | **2.658** | **−522** |
| `file-preview.tsx` Hooks | 60 | **59** | −1 (das `viewProps`-Bundle nutzt useMemo nicht — Composer ruft die View einfach mit dem Bundle auf) |
| Welle-3-II gesamt Zeilen | 20.029 | 20.286 | +257 (Char-Tests + view-props.ts) |
| Welle-3-II leere Catches | 0 | 0 | unveraendert ✅ |
| Welle-3-II Storage-Branches | 0 | 0 | unveraendert ✅ |
| Tests gesamt Repo | 1.029 | **1.037** | +8 (audio + image Char-Tests) |

## Vertrag stabil

- `FilePreview` wird unveraendert aus `library.tsx` per `import dynamic` geladen.
- `viewProps`-Bundle: gleiche Werte wie vorher in der Closure, jetzt
  einmal zusammengebaut und per Spread `<View {...viewProps} />` weitergereicht.
- TypeScript: 0 neue Fehler in `file-preview.tsx`/Sub-Files.
- Lint: 0 neue Errors in Welle-3-II-Files.
- Char-Tests: 8 neue, alle gruen.

## Was in Phase 2b/2c/2d folgt

| Welle | Datei(en) | View(s) |
|---|---|---|
| **2b** | `refactor/welle-3-ii-a-2b-preview-views` | `views/video-view.tsx` + `views/default-view.tsx` |
| **2c** | `refactor/welle-3-ii-a-2c-preview-markdown-pdf` | `views/markdown-view.tsx` + `views/pdf-view.tsx` |
| **2d** | `refactor/welle-3-ii-a-2d-preview-office-website` | `views/office-view.tsx` + `views/presentation-view.tsx` + `views/website-view.tsx` |

Sub-Briefs werden im AGENT-BRIEF.md beim Start der jeweiligen Phase
nachgetragen.

## Stop-Bedingung respektiert

PR-Diff: **1.291 inserts + 589 deletions = ~1.880 Zeilen Diff**.
Innerhalb der 1.000-Diff-pro-Commit-Vorgabe (max. ~250 deletions/Commit
in den Einzel-Commits) und unter der 4.000-Zeilen-Gesamt-Schwelle.

## User-Sign-off

Phase 2a aendert keinen sichtbaren UI-Code — `<AudioView />` und
`<ImageView />` rendern exakt dieselbe Tab-Struktur wie vorher der
inline-`switch`-Block. Smoke-Test: ~5 Min im Browser:

1. `/library` oeffnen, eine Audio-Datei (`.mp3`) auswaehlen.
2. File-Preview rechts laedt mit 5 Tabs (Original, Transkript,
   Transformation, Story, Uebersicht).
3. Tabs durchklicken — alle rendern wie vorher.
4. Eine Bild-Datei (`.jpg/.png`) auswaehlen.
5. File-Preview zeigt 4 Tabs (Original, Analyse, Story, Uebersicht).
6. Console: keine `Uncaught` / `Error`.

Bei Erfolg mergen, dann Phase 2b als naechsten Cloud-Auftrag starten.
