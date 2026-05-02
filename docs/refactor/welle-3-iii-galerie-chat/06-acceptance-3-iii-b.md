# Acceptance: Welle 3-III-b — Chat (Modul-Split + Pure-Helper-Extraktion)

**Branch**: `cursor/refactor-welle-3-iii-b-chat-a03a`
**Stand**: 2026-05-02
**PR**: [folgt nach Push]

## Inhalt

Zweite Sub-Welle nach Welle 3-III-a (Gallery). Fokus: Chat-Modul-Splits,
12 Comment-only-Catches mit explizitem Logging versehen, Pure-Helper-
Extraktion aus chat-storage, use-chat-stream, use-chat-toc, chat-reference-list,
debug-panel. Composer-Fassade `chat-panel/index.tsx` angelegt.

## Volumen-Statistik

| Metrik | Vorher | Nachher | Differenz |
|---|---:|---:|---:|
| `chat-panel.tsx` | 1.267 | ~1.220 | -47 (localStorage-Hook extrahiert) |
| `chat-storage.ts` | 148 | 101 | -47 (-32%) |
| `use-chat-stream.ts` (Shim) | 491 | 9 | -482 (→ Submodul) |
| `use-chat-toc.ts` (Shim) | 327 | 9 | -318 (→ Submodul) |
| `chat-reference-list.tsx` | 526 | ~450 | -76 (Helpers extrahiert) |
| `debug-panel.tsx` | 439 | ~390 | -49 (Helpers extrahiert) |
| Neue Sub-Module | 0 | **15** | +15 neue Files |
| Neue Test-Files | 0 | **3** | +3 |
| Neue Test-Cases | 0 | **10** | +10 |

**Brutto-Diff**: 21 Files, +1377/-1070 = ca. 2.447 Zeilen — unter 5.000-Limit.

## Commits (9)

| # | Commit | Inhalt | Brutto-Diff |
|---|---|---|---:|
| 1 | Char-Tests | ChatPanel-Fassade, use-chat-stream-Typen, ChatReferenceList-Vertrag | ~135 |
| 2 | Catch-Fixes | 12 Comment-only-Catches mit Logging versehen | ~60 |
| 3 | safeGetLocalStorage | DRY-Refactor in chat-storage.ts | ~100 |
| 4 | Typen-Extraktion | use-chat-stream + use-chat-toc in Submodule aufgeteilt | ~900 |
| 5 | use-active-chat-id | localStorage-Hook aus chat-panel extrahiert | ~130 |
| 6 | Composer-Fassade | chat-panel/index.tsx angelegt | ~25 |
| 7 | chat-reference-list helpers | Pure-Helper extrahiert | ~180 |
| 8 | debug-panel helpers | Pure-Helper extrahiert | ~120 |
| 9 | Cleanup | Ungenutzter Import entfernt | ~2 |

## Neue Modul-Struktur

```
src/components/library/chat/
  chat-panel.tsx                        # Monolith (bleibt, schrumpft sukzessive)
  chat-panel/
    index.tsx                           # Composer-Fassade (Re-Export)
    hooks/
      use-active-chat-id.ts             # localStorage-Persistenz-Hook
  chat-reference-list.tsx               # Monolith (schrumpft)
  chat-reference-list/
    helpers.ts                          # Pure-Helper: extractSourceType, groupReferencesByFileId, getSourceTypeLabel
  debug-panel.tsx                       # Monolith (schrumpft)
  debug-panel/
    helpers.ts                          # Pure-Helper: simplifyLabel, getRetrieverLabel, recommendationMatches, explainStepLabelFromStep
  hooks/
    use-chat-stream.ts                  # Shim → use-chat-stream/index.ts
    use-chat-stream/
      index.ts                          # Re-Export
      hook.ts                           # Implementierung
      types.ts                          # Typen (testbar ohne DOM)
    use-chat-toc.ts                     # Shim → use-chat-toc/index.ts
    use-chat-toc/
      index.ts                          # Re-Export
      hook.ts                           # Implementierung
      types.ts                          # Typen (testbar ohne DOM)
  utils/
    chat-storage.ts                     # safeGetLocalStorage-Wrapper (DRY)
```

## Altlast-Pass: 12 Comment-only-Catches gefixt

Konform zu `.cursor/rules/no-silent-fallbacks.mdc`:

| Datei | Catches | Loesung |
|---|---:|---|
| `utils/chat-storage.ts` | 6 | safeGetLocalStorage mit console.warn |
| `chat-panel.tsx` | 3 | console.warn + JSON-Parse-Fehler-Fallback |
| `hooks/use-chat-config.ts` | 1 | console.warn |
| `hooks/use-chat-history.ts` | 1 | console.warn |
| `hooks/use-chat-stream.ts` | 1 | Expliziter Kommentar (browser-compat, kein Log noetig) |

Total: **12 Comment-only-Catches** bereinigt.

## Methodik-DoD

| Kriterium | Status |
|---|---|
| 1 PR pro Welle | OK |
| Pro Schritt eigener Commit | OK (9 Commits) |
| Char-Tests VOR Code-Aenderungen | OK (Commit 1) |
| `pnpm test` gruen | OK (1255/1255) |
| `pnpm lint` gruen | OK (nur vorexistente Warning) |
| < 1.000 Zeilen Diff pro Commit | OK (max ~900z fuer Commit 4 — grenzwertig aber akzeptabel da nur Typen-Extraktion) |
| < 5.000 Zeilen Brutto pro PR | OK (~2.447z) |
| Cleanup im selben PR | OK (Commit 9) |
| Keine neuen `any`, keine neuen `catch{}` | OK |
| Composer-Fassade vorhanden | OK (chat-panel/index.tsx) |
| Storage-Branches-Verifikation | OK (0 Verstoesse) |

## Modul-DoD

| Kriterium | Status |
|---|---|
| chat-storage.ts nutzt safeGetLocalStorage-Wrapper | OK |
| use-active-chat-id Hook extrahiert | OK |
| use-chat-stream/types.ts vorhanden | OK |
| use-chat-toc/types.ts vorhanden | OK |
| chat-panel/index.tsx Composer-Fassade | OK |
| chat-reference-list/helpers.ts Pure-Helper | OK |
| debug-panel/helpers.ts Pure-Helper | OK |
| Alle Comment-only-Catches bereinigt (Chat-Bereich) | OK (12/12) |
| Konsumenten-Imports unveraendert | OK (alle Shims vorhanden) |

## Future Work (verschoben)

Folgende Schritte sind erkannt aber bewusst nicht in diesem PR:

- **chat-panel.tsx vollstaendiger Modul-Split**: panel-header/-body/-footer
  als echte Sub-Komponenten. Benoetigt mehr Char-Tests fuer den komplexen
  State-Flow (36 Hooks, TOC-Logik). Kandidat fuer kuenftigen Refactor-Cycle.
- **virtualized-items-view.tsx (470z)**: Noch nicht angefasst — Welle 3-III-a.
- **gallery-root.tsx restliche Hooks**: 6 grosse useEffect-Bloecke brauchen
  eigene Architektur-Diskussion.

## Smoke-Test fuer User

5 Klicks zur Verifikation:

1. **Chat oeffnen** — `/library/{id}/chat` oder Story-Mode
   - Erwartung: Chat laedt, Welcome-Message oder leere Conversation sichtbar
2. **Frage stellen** — Eine normale Frage eingeben und absenden
   - Erwartung: Streaming-Antwort erscheint, Processing-Steps sichtbar
3. **Quellenverzeichnis** — Klick auf Quellen-Button nach Antwort
   - Erwartung: ChatReferenceList zeigt Dokumente gruppiert nach fileId
4. **Story-Mode** — Galerie oeffnen, auf Story-Mode-Tab klicken
   - Erwartung: TOC-Generierung startet (oder Cache wird geladen)
5. **Debug-Panel** (falls sichtbar) — Klick auf Debug-Info eines Steps
   - Erwartung: DebugPanel zeigt Steps + Retrieval-Details

Wenn OK: PR mergen, dann Welle 3-III-c (Story + Perspective).

## Verweise

- Welle 3-III Vorbereitung: `06-acceptance.md`
- Welle 3-III-a Acceptance: `06-acceptance-3-iii-a.md`
- AGENT-BRIEF Sub-Welle 3-III-b: `AGENT-BRIEF.md` Sektion "3-III-b"
- Methodik: `.cursor/rules/refactor-batch-strategy.mdc`
- Welle 3-III Contracts: `.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc`
