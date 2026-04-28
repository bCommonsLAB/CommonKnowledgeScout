# Inventur: Modul `chat`

Stand: 2026-04-27. Welle 2.3 (Plan §5 Welle 2 Verarbeitung, 3. von 3).

## 1. Modul-Health

| Modul | Files | Max-Zeilen | > 200 Zeilen | Tests | any | leere catch{} | use client |
|---|---:|---|---:|---|---:|---:|---:|
| `chat` | 30 | 1.435 (`ingestion-service.ts`) | 14 | ja | 0 | **9** | 0 |

Vergleich:

| Modul | Files | Max-Zeilen | > 200 | catch{} |
|---|---:|---:|---:|---:|
| `secretary` (nach 2.1) | 8 | 1.192 | 3 | 0 |
| `templates` (nach 2.2) | 12 | 870 | 7 | 0 |
| **`chat`** | **30** | **1.435** | **14** | **9** |

`chat` ist **das groesste Welle-2-Modul** und hat die meisten leeren
Catches. Vollstaendiger Refactor passt nicht in eine Welle. Welle 2.3
fokussiert auf:

1. Eliminierung der 9 leeren Catches (Pflicht)
2. Char-Tests fuer pure Helper (`facets.ts`, `budget.ts`,
   `vector-stats.ts`, `retriever-decider.ts`)
3. Modul-Rule etablieren

## 2. Files mit catch{}

| Datei | Zeile | Kontext |
|---|---:|---|
| `ingestion-service.ts` | 105 | Index-Erstellung |
| `ingestion-service.ts` | 152 | Init-Fehler |
| `ingestion-service.ts` | 1071 | Repository trace |
| `ingestion-service.ts` | 1137 | Repository trace |
| `ingestion-service.ts` | 1217 | `ensureFacetIndexes` |
| `ingestion-service.ts` | 1244 | Index check |
| `ingestion-service.ts` | 1386 | Repository trace `meta_doc_upsert_done` |
| `ingestion-service.ts` | 1400 | Repository trace `doc_meta_upsert_failed` |
| `retrievers/chunks.ts` | 418 | unklarer Pfad — manuell pruefen |

Alle 9 Catches schweigen einen Fehler. **Pflicht-Fix**: Logging
hinzufuegen, in 1-2 Faellen ggf. Throw.

## 3. Bestands-Tests

| Datei | Tests |
|---|---:|
| `tests/unit/chat/cache-key-utils.test.ts` | ~10 |
| `tests/unit/chat/call-llm-json-retry.test.ts` | ~5 |
| `tests/unit/chat/normalize-suggested-questions.test.ts` | ~5 |
| `tests/unit/chat/publication-filter.test.ts` | ~5 |
| `tests/unit/chat/retrievers/utils/batching.test.ts` | ~10 |

5 Test-Files, ca. 35 Tests Bestand. Decken: cache-key-utils,
call-llm-json-retry (in common/llm.ts), normalize-suggested-questions,
publication-filter, retrievers/utils/batching.

## 4. Hot-Spots fuer Welle 2.3

### 4.1 Pflicht-Char-Tests (untestete pure Funktionen)

| Datei | Zeilen | Funktionen | Geschaetzte Tests |
|---|---:|---|---:|
| `common/budget.ts` | 52 | 5 pure Funktionen | 6-8 |
| `facets.ts` | 90 | 2 pure Funktionen + 1 Helper (deprecated) | 4-6 |
| `vector-stats.ts` | 41 | sehr klein | 2-3 |
| `common/retriever-decider.ts` | 106 | pure Entscheidungs-Logik | 4-6 |

### 4.2 Pflicht-Fix Silent Catches

9 leere `catch {}` (siehe oben).

### 4.3 NICHT in dieser Welle

- Vollstaendiger Split von `ingestion-service.ts` (1.434 Z.) — Folge-PR
- Vollstaendiger Split von `common/prompt.ts` (982 Z.) — Folge-PR
- Vollstaendiger Split von `constants.ts` (888 Z.) — Folge-PR
- Char-Tests fuer `orchestrator.ts`, `ingestion-service.ts`, `retrievers/*.ts` — zu invasiv ohne MongoDB-Mock-Setup
- UI-Aufrufer-Migration — Welle 3
