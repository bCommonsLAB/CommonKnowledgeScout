# Altlast-Pass: Welle 3-II — Archiv-Detail (Vorbereitung)

Stand: 2026-04-29. Schritt 4 nach Methodik
[`docs/refactor/playbook.md`](../playbook.md).

Diese PR ist die **Vorbereitungs-PR** der Welle 3-II. Sie macht
ausschliesslich Schritt 4a (kleine Altlasten). Modul-Splits fuer die 4
Hot-Spots (`file-preview.tsx`, `markdown-preview.tsx`, `job-report-tab.tsx`,
`media-tab.tsx`) sind 4 separate Sub-Wellen
3-II-a/b/c/d.

## Schritt 4a — Kleine Altlasten

### 4a.1 Silent Fallbacks (Inventur F2)

Alle 7 leeren Catches eliminiert (verifiziert durch Stats-Skript: 7 → 0).

| Datei:Zeile | Kontext | Vorher | Nachher |
|---|---|---|---|
| `file-preview.tsx:3652` | `getStreamingUrl(displayFile.id)` im "Quelle"-Button | `} catch {}` | `} catch (error) { FileLogger.warn(...) }` mit Begruendung |
| `markdown-preview.tsx:859` | `hljs.highlight(str, { language: lang })` in Remarkable-Highlight-Config | `} catch {}` | `} catch { /* dokumentierter Fallback ... */ }` |
| `markdown-preview.tsx:863` | `hljs.highlightAuto(str)` als Fallback | `} catch {}` | `} catch { /* dokumentierter Fallback ... */ }` |
| `markdown-preview.tsx:931` | `hljs.highlight(content, { language: lang })` in fence-Renderer | `} catch {}` | `} catch { /* dokumentierter Fallback ... */ }` |
| `audio-transform.tsx:136` | `window.dispatchEvent(new CustomEvent('job_update_local', ...))` | `} catch {}` | `} catch (eventError) { FileLogger.warn(...) }` |
| `video-transform.tsx:136` | `window.dispatchEvent(new CustomEvent('job_update_local', ...))` | `} catch {}` | `} catch (eventError) { FileLogger.warn(...) }` |
| `pdf-transform.tsx:164` | `window.dispatchEvent(new CustomEvent('job_update_local', ...))` | `} catch {}` | `} catch (eventError) { FileLogger.warn(...) }` |

**Verifikation**:

```bash
$ node scripts/ui-welle-3ii-stats.mjs | tail -1
| **Summe** | **20559** | **380** | **54** | **0** | **0** | **0** |
```

`catch{}` = 0 (vorher 7). ✅

### 4a.2 Storage-Branch (Inventur F3)

`shared/freshness-comparison-panel.tsx:145` migriert auf
`isFilesystemBacked()`-Helper aus Welle 1
(`@/lib/storage/library-capability`).

| Vorher | Nachher |
|---|---|
| `data.config.primaryStore === "filesystem" \|\| data.config.persistToFilesystem` | `isFilesystemBacked({ config: { shadowTwin: data.config } })` |

Konform zu `welle-3-archiv-detail-contracts.mdc` §7 und
`storage-abstraction.mdc` §3. **Storage-Branches** in der Welle: 1 → 0. ✅

### 4a.3 `'use client'`-Audit (Plan-Regel 8)

Bestand: 54 von 57 Welle-3-II-Files haben `'use client'`. Die 3 ohne sind:

- `markdown-metadata.tsx` (437z, 2 Hooks) — Pre-Existing-Pattern
- `shared/shadow-twin-artifacts-table.tsx` (393z, 2 Hooks) — Pre-Existing-Pattern
- `markdown-preview.tsx` (2.054z, 41 Hooks) — Pre-Existing-Issue
  (nutzt `useState`, hat aber keine Direktive — funktioniert via Eltern)
- `shared/story-status.ts` (Pure Helper, korrekt)

**Aktion in dieser PR**: KEIN Aendern der bestehenden Direktiven.
Pre-Existing-Issue dokumentiert in `02-contracts.md` §8. Folge-Welle.

## Schritt 4b — Modul-Splits (in Sub-Wellen)

NICHT in dieser PR. Backlog:

| Sub-Welle | Hot-Spot | Aktuelle Stats | Vertrag |
|---|---|---|---|
| **3-II-a** | `file-preview.tsx` | 3.701z, 66 Hooks | siehe `welle-3-archiv-detail-contracts.mdc` §6a |
| **3-II-b** | `markdown-preview.tsx` (2.054z, 41 Hooks) + `markdown-metadata.tsx` (437z) | – | siehe Rule §6a |
| **3-II-c** | `job-report-tab.tsx` (2.284z, 30 Hooks) + `media-tab.tsx` (1.147z, 13 Hooks) | – | siehe Rule §6a + `detail-view-type-checklist.mdc` Punkt 9 |
| **3-II-d** | `session-detail.tsx` (1.042z) + `flow/pipeline-sheet.tsx` (671z) + `cover-image-generator-dialog.tsx` (458z) + shared/-Files | – | siehe Rule §6a |

## Schritt 4-Zusammenfassung (Vorbereitungs-PR)

| Kategorie | Vorher | Nachher | Delta |
|---|---:|---:|---:|
| Welle-3-II gesamt Zeilen | 20.508 | 20.559 | +51 (Logging-Statements) |
| Welle-3-II gesamt Hooks | 380 | 380 | unveraendert ✅ |
| Welle-3-II leere Catches | **7** | **0** | **−7** ✅ |
| Welle-3-II Storage-Branches | **1** | **0** | **−1** ✅ |
| Welle-3-II `any` | 0 | 0 | unveraendert ✅ |
| Files > 200 Zeilen | 26 | 26 | unveraendert (Modul-Splits in Sub-Wellen) |
| Max-Zeilen | 3.701 | 3.701 | unveraendert |
| Tests fuer Welle-3-II | 0 | 30 | **+30 in 7 Test-Files** ✅ |

## Audit-Aktionen aus Schritt 0 — Status

| Aktion aus 00-audit.md | Status |
|---|---|
| 11 Cursor Rules — 10 keep, 1 update | ⏳ update fuer `detail-view-type-checklist.mdc` Punkt 9 in 3-II-c |
| 5 vorhandene UI-Tests keep | ✅ erfuellt (unangetastet) |
| 8 Char-Tests fuer kleinere Files | ✅ erfuellt (7 Tests-Files mit 30 Tests, story-status.ts ist nur Re-Export — kein Test) |
| 7 leere Catches → 0 | ✅ erfuellt |
| 1 Storage-Branch → 0 | ✅ erfuellt |
| Doc-Updates `shadow-twin-freshness-sync.md`, `file-index.md` | ⏳ in Schritt 6 (Doku-Hygiene) und Sub-Wellen |
| Neue Rule `welle-3-archiv-detail-contracts.mdc` | ✅ erfuellt (Schritt 2) |

## Bezug zur Contract-Rule

| Rule § | Erfuellt in Vorbereitungs-PR? | Wie? |
|---|---|---|
| §1 Determinismus | ✅ | keine neuen Business-Logik-Aenderungen |
| §2 Fehler-Semantik | ✅ | 7 leere Catches durch Logging mit Begruendung ersetzt |
| §3 Erlaubte Abhaengigkeiten | ✅ | keine direkten Provider-Imports neu eingefuehrt |
| §4 Skip-/Default-Semantik | ✅ | `detail-view-renderer.tsx` Char-Test fixiert Switch-Vertrag |
| §5 DetailViewType-Erweiterung | ✅ | Char-Test sichert alle 6 ViewTypes ab |
| §6 Modul-Split-Vertrag | ⏳ | Sub-Wellen 3-II-a/b/c/d umsetzen Phase 4b |
| §7 Storage-Branches verboten | ✅ | 1 Verstoss in `freshness-comparison-panel` migriert |
| §8 `'use client'` minimieren | ⏳ aufgeschoben | Pre-Existing-Issue, Folge-Welle |
| §9 Code-Review-Checkliste | ✅ | erfuellt fuer alle Aenderungen in dieser PR |
