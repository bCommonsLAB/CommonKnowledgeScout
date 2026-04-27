# Altlast-Pass: Modul `templates`

Stand: 2026-04-27. Welle 2.2, Schritt 4.

## Erledigte Punkte

### 1. Fuenf silent Catches in `template-service.ts` eliminiert ✅

Alle 5 leeren `catch {}` umgaben `repo.traceAddEvent`-Aufrufe
(Telemetry). Sie wurden ersetzt durch einen einzigen Helper
`emitTraceEventSafely`, der den Fehler explizit per `console.warn`
loggt.

| Vorher | Nachher |
|---|---|
| `template-service.ts:148` `} catch {}` (template_not_found) | Aufruf `emitTraceEventSafely(repo, jobId, 'template_not_found', ...)` |
| `template-service.ts:170` `} catch {}` (template_not_found leer) | dito |
| `template-service.ts:191` `} catch {}` (template_default_used) | dito |
| `template-service.ts:208` `} catch {}` (template_fallback_used) | dito |
| `template-service.ts:237` `} catch {}` (template_selected) | dito |

Bezug: [`templates-contracts.mdc`](../../../.cursor/rules/templates-contracts.mdc) §2.

Code-Reduktion: ~50 Zeilen Inline-Code zu 5 Funktionsaufrufen +
~20 Zeilen Helper-Definition. Lesbarkeit deutlich besser.

### 2. Zwei silent fallbacks (catch + leeres Array) zusammengefuehrt ✅

| Datei | Vorher | Nachher |
|---|---|---|
| `template-service.ts:91-93` `listAvailableTemplates` | `} catch { return [] }` | Loggt `console.warn` mit Begruendung + return [] |
| `template-import-export.ts:123-125` `listTemplatesInStorage` | `} catch { return [] }` | dito |

Beide Funktionen liefern weiterhin ein leeres Array bei Storage-
Fehlern (Aufrufer-Vertrag bleibt), aber der Fehler ist jetzt sichtbar
geloggt — kein silent fallback mehr.

### 3. Char-Tests fuer kritische Files ergaenzt ✅

Siehe [`03-tests.md`](./03-tests.md). Insgesamt 39 neue Tests in
3 Files.

## Health-Stats: Vorher / Nachher

| Kennzahl | Vorher | Nachher | Status |
|---|---:|---:|---|
| Files | 12 | 12 | ✅ unveraendert |
| Max-Zeilen | 870 (`template-frontmatter-utils.ts`) | 870 | ✅ unveraendert (Folge-PR) |
| > 200 Zeilen | 7 | 7 | ✅ unveraendert |
| Leere `catch{}` | **5** | **0** | ✅ **eliminiert** |
| `any` | 0 | 0 | ✅ |
| `'use client'` | 0 | 0 | ✅ |

## NICHT erledigte Watchpoints (mit Begruendung)

1. **`template-frontmatter-utils.ts` (870 Z.)** — Hauptlast des Moduls.
   Voller Split waere ein eigener PR mit umfangreichem Char-Test-Setup.
   Bestands-Tests decken aber image-field-Logik bereits indirekt ab.
2. **`template-service-mongodb.ts` (350 Z.)** — kein Mongo-Mock-Setup
   im Welle-Scope. Folge-PR.
3. **`template-service.ts` (367 Z. nach Helper-Add)** — leichte
   Vergroesserung durch `emitTraceEventSafely`-Helper, akzeptiert.
4. **Cross-Modul-Aufrufer**: UI-Komponenten und API-Routen wurden
   nicht geprueft. Welle 3 UX deckt das ab.
5. **MongoDB-/Filesystem-Strangler-Fig** — Code dokumentiert Legacy-
   Status klar, aktive Migration ist nicht Welle-Scope.

## Folge-PR-Empfehlung

| Was | Aufwand | Begruendung |
|---|---|---|
| `template-frontmatter-utils.ts` aufsplitten in `extract.ts` / `inject.ts` / `creation-block.ts` | mittel | Hauptlast, derzeit 870 Z. |
| Char-Tests fuer `template-service-mongodb.ts` mit Mongo-Mocks | mittel | Coverage-Luecke |
| Char-Tests fuer `template-service-client.ts` mit fetch-Mock | klein | Coverage-Luecke |
