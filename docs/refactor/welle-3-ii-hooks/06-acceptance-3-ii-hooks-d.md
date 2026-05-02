# Welle 3-II-Hooks-d — Acceptance (useImageGeneration Hook fuer cover-image-generator-dialog)

**Branch**: `cursor/refactor-welle-3-iii-d-cover-image-hooks-a03a`
(historisch, vor Naming-Update)
**Stand**: 2026-05-01
**PR**: #43 (merged)

> **Naming-Hinweis**: Initial als "Welle 3-III-d" gestartet, am
> 2026-05-01 zu **Welle 3-II-Hooks-d** umbenannt. Siehe
> `.cursor/rules/refactor-naming-konvention.mdc`.

## Inhalt

**Letzte Sub-Welle von Welle 3-II-Hooks** (Hooks-Extraktion). Extrahiert die
Bild-Generierungs-Logik aus `cover-image-generator-dialog.tsx` in einen
Custom-Hook `useImageGeneration`.

| Schritt | Inhalt | Neuer File / Aenderung | Brutto-Diff |
|---|---|---|---:|
| 1 | useImageGeneration-Hook erstellen | `src/hooks/library/cover-image-generator-dialog/use-image-generation.ts` (252z) | 252 |
| 2 | Hook in Dialog einbinden | `cover-image-generator-dialog.tsx` -139z | 215 |
| 3 | Char-Tests (9 Cases mit `renderHook` + fetch-Mock) | `tests/.../use-image-generation.test.tsx` | 243 |
| 4 | Acceptance-Doc | `06-acceptance-3-ii-hooks-d.md` | ~150 |

**Brutto-Diff Gesamt**: 4 Files, **860 Zeilen** — gut unter 5.000-Limit.

## Volumen-Statistik

| Metrik | Vorher | Nachher | Differenz |
|---|---:|---:|---:|
| `cover-image-generator-dialog.tsx` | 457 | **318** | **-139 (-30.4%)** |
| Sub-Module unter `hooks/library/cover-image-generator-dialog/` | 0 | 1 (use-image-generation.ts, 252z) | +1 |
| Char-Test-Cases | 0 | 9 | +9 |

**Beste Reduktion in Welle 3-II-Hooks** (-30.4%) — der Hook hat eine sehr
klare Schnittstelle (2 Inputs, 7 Outputs) und kapselt eine
geschlossene API-Logik.

## Hook-Inhalt

| Verantwortlichkeit | Detail |
|---|---|
| State | `isGenerating`, `generatedImages`, `selectedImageIndex` |
| `generate()` | Secretary-API-Call mit 2 Modi (4 Varianten + seeds, oder 1 Bild + Cache) |
| `selectImage()` | Base64 → File-Konvertierung mit Datum-Filename, ruft `onGenerated` |
| `resetGeneration()` | Leert Bilder + Auswahl (fuer Dialog-Close-Cleanup) |
| `setSelectedImageIndex()` | Fuer pre-Save-Highlights |

## Methodik-DoD

| Kriterium | Status |
|---|---|
| 1 PR pro Welle | OK |
| Pro Schritt eigener Commit | OK (3 Code-Commits + 1 Doc-Commit) |
| Char-Tests mit `renderHook` + fetch-Mock | OK (9 Cases) |
| `pnpm test` gruen | OK (1.159 Tests / 179 Files, 19.6s) |
| `pnpm lint` gruen | OK (nur vor-existierende Warnings) |
| `pnpm build` gruen | OK (72s, exit 0) |
| < 1.000 Zeilen Diff pro Commit | OK (max 252z) |
| < 5.000 Zeilen Brutto pro PR | OK (860z) |
| Cleanup im selben PR | OK (UILogger-Import entfernt, GeneratedImage-Type re-importiert) |
| Keine neuen `any`, keine neuen `catch{}` | OK (1:1 portierter Code) |

## Methodik-Lehre PR #31 hat zum 9. Mal funktioniert

`pnpm build` lokal bestaetigte sauber:
- Type-Re-Import (`GeneratedImage`, `GenerationSize`, `GenerationQuality`)
  von Hook nach Dialog erfolgreich
- Kein `UILogger`-Import-Bug nach Cleanup

Erstmals seit langem **kein** Type-/Import-Fehler — das Pattern fuer
Hook-Extraktion hat sich nach 4 Sub-Wellen so stabil eingespielt, dass
der Build sauber durchlaeuft.

## Smoke-Test fuer User

3 Klicks:

1. **Cover-Image generieren**: Datei-Detail → Transformation-Tab →
   "Cover-Bild generieren" → Prompt eingeben → "4 Varianten generieren"
   klicken → 4 Bilder werden geladen und angezeigt
2. **Bild auswaehlen**: auf eine Variante klicken → Bild wird
   gespeichert + Dialog schliesst sich + Toast erscheint
3. **Single-Mode**: Erneut oeffnen → "Einzelnes Bild" klicken → 1 Bild
   wird generiert + auf Bestaetigung gewartet

Wenn OK: PR mergen — **Welle 3-II-Hooks ist abgeschlossen**.

## Verweise

- Welle 3-II-Hooks-a (Vorgaenger): PR #40
- Welle 3-II-Hooks-b (Vorgaenger): PR #41
- Welle 3-II-Hooks-c (Vorgaenger): PR #42
- Welle 3-II-Hooks README: `docs/refactor/welle-3-ii-hooks/README.md`
- Naming-Konvention: `.cursor/rules/refactor-naming-konvention.mdc`
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc`
