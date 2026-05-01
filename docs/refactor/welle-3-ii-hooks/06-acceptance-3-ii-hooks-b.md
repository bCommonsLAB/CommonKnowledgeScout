# Welle 3-III-b — Acceptance (useFrontmatterEditor Hook fuer job-report-tab)

**Branch**: `cursor/refactor-welle-3-iii-b-job-report-hooks-a03a`
**Stand**: 2026-05-01
**PR**: (folgt nach Push)

## Plan-Anpassung gegenueber Welle-3-III-Plan

Im Welle-3-III-Plan war fuer 3-III-b vorgesehen:
- `use-job-report-data` Hook (Job-Loader, Frontmatter-Parser)
- `use-frontmatter-editor` Hook (Inline-Editing-Logik)

**Tatsaechliche Lage**: Der Job-Loader (`use-job-report-data`) ist
**zu tief in der Komponente verzahnt** — viele useEffects, die State-
Variablen aus weit auseinanderliegenden Bereichen lesen/schreiben
(z.B. `templateFields`, `templateCoverImagePrompt`, `frontmatterMeta`,
`displayedFileName`). Eine sichere Extraktion braucht Architektur-
Entscheidungen.

**Neuer Plan fuer 3-III-b**: Nur `useFrontmatterEditor` ausgliedern.
Das ist eine eigenstaendige State-Maschine (3 States + 1 Save-Funktion)
mit klaren Inputs/Outputs.

`use-job-report-data` bleibt **Future Work** — empfohlen erst nach
Tab-Bodies-Aufteilung (separater Refactor-Cycle).

## Inhalt (4 Schritte / 4 Commits)

| Schritt | Inhalt | Neuer File / Aenderung | Brutto-Diff |
|---|---|---|---:|
| 1 | useFrontmatterEditor-Hook erstellen | `src/hooks/library/job-report-tab/use-frontmatter-editor.ts` (161z) | 161 |
| 2 | Hook in job-report-tab.tsx einbinden | `job-report-tab.tsx` -41z | 111 |
| 3 | Char-Tests (7 Cases mit `renderHook`) | `tests/.../use-frontmatter-editor.test.tsx` | 187 |
| 4 | Acceptance-Doc | `06-acceptance-3-iii-b.md` (folgt) | ~150 |

**Brutto-Diff Gesamt**: 4 Files, **609 Zeilen** — sehr klein.

## Volumen-Statistik

| Metrik | Vorher | Nachher | Differenz |
|---|---:|---:|---:|
| `job-report-tab.tsx` | 2.262 | **2.221** | **-41 (-1.8%)** |
| Sub-Module unter `hooks/library/job-report-tab/` | 0 | 1 (use-frontmatter-editor.ts, 161z) | +1 |
| Char-Test-Cases | 0 | 7 | +7 |

## Bewertung

Mit -1.8% absolut wenig. Aber:
- **Inline-Editing-State-Maschine ist sauber isoliert** und testbar
- **`isSaving`-Setter** wird bewusst auch fuer den Markdown-Edit-Mode
  exponiert (parallele Save-Pfade teilen sich die UI-Anzeige)
- **Sicherheitsnetz** (7 Char-Tests) deckt jetzt die kritische
  Save-Logik ab (Mongo + Filesystem-Pfad, JSON-Parsing, early-return)

## Future Work fuer 3-III-b (Hook 2: use-job-report-data)

Der urspruenglich geplante Hook `use-job-report-data` braucht
folgende Architektur-Vorarbeit:

1. **Tab-Bodies als Sub-Komponenten** (markdown/meta/chapters/media/
   ingestion/process). Jede Tab-Body-Komponente bekommt ihre eigenen
   Daten via Props/Context.
2. **State-Reorganisation**: Aktuell teilen sich Tab-Bodies
   `frontmatterMeta`, `displayedFileName`, `templateFields` etc. ueber
   useEffects mit komplexen Abhaengigkeiten.

Empfehlung: Diese Arbeit ist gross genug fuer eine **eigene Sub-Welle
3-III-b-2** oder gar einen **Welle 3-IV-Cycle**.

## Methodik-DoD

| Kriterium | Status |
|---|---|
| 1 PR pro Welle | OK |
| Pro Schritt eigener Commit | OK (4 Commits + Doc) |
| Char-Tests vor/zusammen mit Hook | OK (7 Cases) |
| `pnpm test` gruen | OK (1.138 Tests / 177 Files) |
| `pnpm lint` gruen | OK (nur vor-existierende Warnings) |
| `pnpm build` gruen | OK (76s, exit 0) |
| < 1.000 Zeilen Diff pro Commit | OK (max 187z) |
| < 5.000 Zeilen Brutto pro PR | OK (609z) |
| Cleanup im selben PR | OK |

## Methodik-Lehre PR #31 hat zum 7. Mal funktioniert

`pnpm build` lokal hat den fehlenden `setIsSaving`-Export aus dem
Hook abgefangen — die parallele Save-Logic im Markdown-Edit-Mode
brauchte ihn. Hook angepasst, kein Hotfix-PR-Cycle.

## Smoke-Test fuer User

3 Klicks:

1. **Datei mit Transformation oeffnen** → "Transformation"-Tab → "Metadaten"-
   Tab: Inline-Editing eines Felds funktioniert wie bisher
   (Klick auf Feld → Textfeld → Enter speichert → Toast erscheint)
2. **Markdown-Tab → Bearbeiten-Modus** → Save-Button: speichert wie bisher
   (parallele Save-Logic nutzt jetzt `setIsSaving` aus dem Hook)
3. **Long-running save**: Save-Button waehrend des Speicherns disabled
   (isSaving korrekt durchgereicht)

Wenn OK: PR mergen, dann Welle 3-III-c (session-detail).

## Verweise

- Welle 3-III-a (Vorgaenger): PR #40
- Welle 3-III README: `docs/refactor/welle-3-iii-hooks/README.md`
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc`
