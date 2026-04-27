# Bestands-Audit: Modul `chat`

Stand: 2026-04-27. Welle 2.3, Schritt 0.

## A. Cursor Rules

| Rule-Datei | Bezug | Status | Aktion | Begruendung |
|---|---|---|---|---|
| `.cursor/rules/contracts-story-pipeline.mdc` | direkt (§4 Ingestion Input Contract, §5 Vector Search) | aktuell | keep | bleibt unveraendert; chat-contracts.mdc verfeinert auf Code-Ebene |
| `.cursor/rules/ingest-mongo-only.mdc` | indirekt (chat ingest-service nutzt Pipeline) | aktuell | keep | |
| `.cursor/rules/no-silent-fallbacks.mdc` | global | aktuell | keep | gilt fuer 9 catch{} |
| `.cursor/rules/storage-abstraction.mdc` | global | aktuell | keep | |
| `.cursor/rules/chat-contracts.mdc` (NEU) | direkt | wird in Schritt 2 erstellt | create | Modul-Invarianten |

## B. Tests

| Test-Datei | Testet | Code existiert? | Aktion |
|---|---|---|---|
| `tests/unit/chat/cache-key-utils.test.ts` | `utils/cache-key-utils.ts` | ja | keep |
| `tests/unit/chat/call-llm-json-retry.test.ts` | LLM-JSON-Retry-Logik in `common/llm.ts` | ja | keep |
| `tests/unit/chat/normalize-suggested-questions.test.ts` | `common/normalize-suggested-questions.ts` | ja | keep |
| `tests/unit/chat/publication-filter.test.ts` | `publication-filter.ts` | ja | keep |
| `tests/unit/chat/retrievers/utils/batching.test.ts` | retrievers/utils Batching | ja | keep |

Keine Tests zu loeschen oder migrieren.

## C. Docs

| Doc-Datei | Status | Aktion |
|---|---|---|
| `docs/architecture/mongodb-vector-search.md` | aktuell | keep |
| `docs/architecture/pipeline-phases.md` | erwaehnt chat-ingest | keep |
| `docs/architecture/artifact-pipeline-v3-design.md` | erwaehnt RAG-Konsum | keep |
| `docs/refactor/chat/*` (NEU) | wird erstellt | create |

## Zusammenfassung

| Kategorie | keep | update | migrate | delete | create |
|---|---:|---:|---:|---:|---:|
| Rules | 4 | 0 | 0 | 0 | 1 |
| Tests | 5 | 0 | 0 | 0 | 0 |
| Docs | 3+ | 0 | 0 | 0 | mehrere (Welle-Doku) |

Gleicher Befund wie bei Templates — keine Loeschungen, kein Migrate.
Hauptarbeit: catch{}-Fix + Char-Tests + Modul-Rule.
