## Ingestion (current runtime)

Status: active  
Last verified: 2026-01-04  

### Scope
This document describes how ingestion and vector storage work **today**.
It is meant to be simple and operational (what to look at when something breaks).

### Glossary
- **Vector collection**: MongoDB collection `vectors__${libraryId}`
- **meta**: metadata-only doc (no embedding)
- **chunk**: text chunk + embedding
- **chapterSummary**: chapter summary + embedding

## Data model (MongoDB)
We use one collection per library:
- `vectors__${libraryId}`

Kinds:
- `meta`: used for gallery + facets
- `chunk`: used for semantic search
- `chapterSummary`: used for chapter-based search

Canonical architecture reference:
- `docs/architecture/mongodb-vector-search.md`

## Main entry points (code)
- Ingestion service: `src/lib/chat/ingestion-service.ts`
- Vector repo: `src/lib/repositories/vector-repo.ts`

## Practical debugging checklist
When ingestion “looks wrong”, check:
1) Does a `meta` document exist for the fileId?
2) Do `chunk` documents exist for the same fileId?
3) Does `vector_search_idx` exist for the collection?
4) Are facet fields present on chunks (so filters work)?

## Common failure modes (what it usually is)

### 1) Ingestion input is empty / too short

Symptoms:

- `ingest_rag` fails early
- ingestion appears “successful” but results in 0 useful chunks

Typical causes:

- upstream artifact (transformation/transcript) is empty
- wrong artifact selected (e.g. missing/incorrect template context)

Fix direction:

- treat empty ingestion input as a hard error (pipeline must not mark success)
- verify transformation output first (frontmatter + body)

### 2) Vector Search index not READY (INITIAL_SYNC)

Symptoms:

- retrieval fails even though docs were upserted
- errors or very slow/no results right after index creation

Fix direction:

- check index status in Atlas; INITIAL_SYNC can take minutes depending on size

### 3) Token-index missing for array filters

Symptoms:

- errors like: “Path 'authors' needs to be indexed as token”
- filters work for scalar fields but break for array fields (authors/tags/topics/…)

Fix direction:

- update the Atlas Search index definition (token indexing for array fields you filter on)
- rebuild/recreate index if needed

### 4) Wrong `fileId` used for upserts (mismatched namespaces)

Symptoms:

- meta doc exists for a different id than the file you query
- ingestion-status says “not indexed” although ingestion ran

Fix direction:

- ensure `fileId` used for vector upserts matches the source fileId used by the UI

## Operational probes (fast checks)

### A) Ingestion status endpoint (UI-friendly)

Use:

- `GET /api/chat/{libraryId}/ingestion-status?fileId=...`

What to look for:

- `doc.exists=true`
- reasonable `chunkCount` and `chaptersCount`
- staleness (docModifiedAt vs stored docModifiedAt)

### B) Retrieval sanity check (chat stream)

Use:

- `POST /api/chat/{libraryId}/stream`

What to look for:

- retriever selection (chunk vs summary)
- retrieval steps returning sources (non-empty)

## Related docs

- End-to-end overview: `docs/use-cases/file-to-story.md`
- Vector architecture: `docs/architecture/mongodb-vector-search.md`


