# Characterization Tests: Modul `chat`

Stand: 2026-04-27. Welle 2.3, Schritt 3.

## Output

| Test-File | Tests | Testet |
|---|---:|---|
| `tests/unit/chat/budget.test.ts` (NEU) | 17 | `getBaseBudget`, `reduceBudgets`, `canAccumulate`, `getTokenBudget`, `estimateTokensFromText`, `canAccumulateTokens` |
| `tests/unit/chat/facets.test.ts` (NEU) | 10 | `extractTopLevelFacetsFromMeta`, `composeDocSummaryText` |
| `tests/unit/chat/vector-stats.test.ts` (NEU) | 5 | `accumulateVectorStats` |
| `tests/unit/chat/cache-key-utils.test.ts` (Bestand) | ~10 | `cache-key-utils` |
| `tests/unit/chat/call-llm-json-retry.test.ts` (Bestand) | ~5 | LLM-JSON-Retry |
| `tests/unit/chat/normalize-suggested-questions.test.ts` (Bestand) | ~5 | `normalize-suggested-questions` |
| `tests/unit/chat/publication-filter.test.ts` (Bestand) | ~5 | `publication-filter` |
| `tests/unit/chat/retrievers/utils/batching.test.ts` (Bestand) | ~10 | retrievers/utils Batching |

**Neu in Welle 2.3**: 17 + 10 + 5 = **32 Char-Tests** in 3 neuen Files.

## Mock-Strategie

Alle drei neuen Files testen pure Funktionen — **keine Mocks** noetig
(secretary-/templates-Wellen brauchten Provider/fetch-Mocks; chat-Welle
ist hier minimaler).

## Was getestet ist

### `common/budget.ts`

- Alle 4 AnswerLength-Stufen
- ENV-Variable `CHAT_MAX_INPUT_TOKENS` (gueltig, fehlt, ungueltig, <= 0)
- Token/Char-Konvertierung mit Heuristik 4 Zeichen/Token
- Budget-Akkumulation

### `facets.ts` (deprecated, aber getestet als Sicherheitsnetz)

- `extractTopLevelFacetsFromMeta` — leerer Input, vorhandene defs, undefined-Filterung
- `composeDocSummaryText` — null bei leerem Input, Hardcoded-Fallback (authors+tags), dynamic defs, leere-Felder-null

### `vector-stats.ts`

- Leerer Input
- Alle 3 kind-Werte (doc/chapterSummary/chunk)
- Unbekannte kind-Werte werden ignoriert
- uniqueDocs deduplikation
- Robustheit gegen fehlende metadata

## Nicht getestet (Watchpoints / Folge-PRs)

- `ingestion-service.ts` (1.474 Z.) — MongoDB-Mocks erforderlich, Folge-PR
- `orchestrator.ts` (521 Z.) — Service-Aufrufe, Folge-PR
- `retrievers/chunks.ts` (554 Z.) — RAG-Retrieval, Mongo-Vector-Search-Mocks erforderlich
- `retrievers/summaries-mongo.ts` (327 Z.) — dito
- `common/llm.ts` (604 Z.) — partial via `call-llm-json-retry.test.ts`
- `common/prompt.ts` (982 Z.) — Prompt-Aufbau, Folge-PR
- `dynamic-facets.ts` (319 Z.) — Folge-PR
- `loader.ts` (418 Z.) — Folge-PR
- `vector-search-index.ts` (169 Z.) — MongoDB-Mocks Folge-PR

## DoD-Status nach Schritt 3

| Kriterium | Erwartung | Ergebnis |
|---|---|---:|
| Neue Char-Tests | 15-25 | **32** ✅ uebererfuellt |
| `pnpm test` gruen | ja | ✅ 710/710 |
| Bestands-Tests `keep` unveraendert | ja | ✅ |
