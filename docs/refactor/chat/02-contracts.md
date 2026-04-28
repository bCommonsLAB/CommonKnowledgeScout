# Contracts: Modul `chat`

Stand: 2026-04-27. Welle 2.3, Schritt 2.

## Output

Neue Modul-Rule: [`.cursor/rules/chat-contracts.mdc`](../../../.cursor/rules/chat-contracts.mdc).

## Sektionen

| § | Thema | Kernregel |
|---|---|---|
| §1 | Determinismus | Pure Helper seiteneffekt-frei (budget, facets, retriever-decider, ...) |
| §2 | Fehler-Semantik | Index-Aufbau geloggt, Telemetry geloggt, Ingest-Leer wirft, `catch {}` verboten |
| §3 | Abhaengigkeiten | DARF: `secretary/client`, `repositories`, `mongodb-service`, `templates`, `logging`. DARF NICHT: `components/**`, `app/**`, `external-jobs/**` |
| §4 | Skip-/Default | Leere Vector-Search-Ergebnisse → loggen + leer; fehlende Embedding-Config → wirft |
| §5 | Cache-Vertrag | `buildVectorSearchCacheKey` deterministisch, Stat-Helper read-only |
| §6 | Test-Vertrag | Pure ohne Mocks; Service mit Mongo/fetch-Mock |
| §7 | Performance-Watchpoints | `chunks.ts`, `summaries-mongo.ts`, `ingestion-service.ts` heisse Pfade |

## Verbindung zu globalen Rules

- §2 verankert Pflicht-Fix der 9 leeren Catches
- §3 verankert UI-Vermeidung
- §1+§4 ergaenzen `contracts-story-pipeline.mdc` auf Helper-Ebene
