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



