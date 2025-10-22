# Chat Retriever Logging – Design

Ziel: Jede Chat‑Frage wird als JSON in der MongoDB‑Collection `queries` gespeichert, inkl. Frage, Facetten/Filter, Retrieval‑Schritte (Kapitel/Summaries/Chunks), Pinecone‑Filter, Scores, Prompt und finaler Antwort. Ein `queryId` verknüpft Antwort und Log. UI bietet Debug‑Button.

## Datenmodell (Kurzüberblick)
- `QueryLog` mit Feldern: `queryId`, `libraryId`, `userEmail`, `question`, `mode`, `facetsSelected`, `filtersNormalized`, `filtersPinecone`, `retrieval[]`, `prompt`, `answer`, `sources[]`, `timing`, `tokenUsage`, `createdAt`, `status`, `error`.
- Retrieval‑Schritt enthält: Ebene (`chapter|summary|chunk`), Stage (`list|query|fetchNeighbors|rerank|aggregate`), Pinecone‑Filter, Top‑K, Ergebnisse mit `id/score/metadata/snippet` (Snippets ≤300 Zeichen).

## Instrumentierung
- Start: `startQueryLog` vor Pinecone‑Aufrufen, mit Facetten und Filtern.
- Pro Pinecone‑Aufruf: `appendRetrievalStep` mit `filtersEffective` (normalized+pinecone) und Timing.
- Vor LLM: `setPrompt` (maskiert Tokens).
- Nach Antwort: `finalizeQueryLog` mit Answer, Sources, Timing.
- Fehler: `failQueryLog`.

## Sicherheit/Privacy
- Keine Secrets im Prompt (Maskierung).
- Snippets gekürzt (≤300).
- Zugriff per Clerk, nur Besitzer (`userEmail`) derselben `libraryId`.

## UI‑Debug
- API‑Antwort enthält `queryId`.
- Debug‑Button lädt `/api/chat/[libraryId]/queries/[queryId]` und zeigt JSON.

## Tests
- Unit: Logger‑Redaktion, Snippet‑Clamp, Statuswechsel.
- Integration/E2E: folgt.




