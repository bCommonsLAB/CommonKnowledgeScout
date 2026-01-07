## MongoDB Vector Search (architecture)

Status: active  
Last verified: 2026-01-06  

### Scope
This document describes the **data model and index shape** for MongoDB Atlas Vector Search in this repo.
Operational “what to debug” notes live in `docs/analysis/ingestion.md`.

### Glossary
- **Vector collection**: MongoDB collection `vectors__${libraryId}` (one per library)
- **Vector search index**: Atlas search index `vector_search_idx`
- **meta**: metadata-only document (no embedding)
- **chunk**: text chunk + embedding
- **chapterSummary**: chapter summary + embedding

This project uses **MongoDB Atlas Vector Search** for semantic search and RAG.
Embeddings and metadata live in MongoDB. No separate vector database is required.

### Collection layout
- **One collection per library**: `vectors__${libraryId}`
- Multiple document kinds live in the same collection (distinguished by `kind`)
  - `meta`: full metadata (no embedding)
  - `chunk`: text chunk + embedding
  - `chapterSummary`: chapter summary + embedding

### Why we keep `meta` without embeddings
- The gallery and facet aggregation need full metadata.
- Storing meta without embeddings saves space and keeps writes cheaper.

### Vector search index
- Index name: `vector_search_idx`
- Created lazily (first access) via Mongo admin commands

Example (simplified):
```json
{
  "name": "vector_search_idx",
  "definition": {
    "mappings": {
      "dynamic": true,
      "fields": {
        "embedding": {
          "type": "knnVector",
          "dimensions": 1024,
          "similarity": "cosine"
        }
      }
    }
  }
}
```

### Token indexes for filtering (important)

Atlas Vector Search requires fields used in `$vectorSearch.filter` to be indexed in a compatible way.
In practice, this means:

- fields filtered via `$in` must be indexed as **token** (not plain string)
- this includes **arrays** (e.g. `authors`, `tags`) and also “single string facets” if the code always uses `$in`

If you see errors like:

> `Path 'authors' needs to be indexed as token`

the fix is to ensure the search index mapping contains token entries for those fields.

### Recommended mapping additions (example)

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embedding": { "type": "knnVector", "dimensions": 1024, "similarity": "cosine" },
      "kind": { "type": "token" },
      "libraryId": { "type": "token" },
      "user": { "type": "token" },
      "fileId": { "type": "token" },
      "authors": { "type": "token" },
      "speakers": { "type": "token" },
      "tags": { "type": "token" },
      "topics": { "type": "token" }
    }
  }
}
```

Notes:
- The exact list depends on which facet fields you use in filters.
- When in doubt: index every filterable facet as token to avoid runtime failures.

### Query patterns
Vector search query (simplified):
```typescript
const pipeline = [
  {
    $vectorSearch: {
      index: 'vector_search_idx',
      path: 'embedding',
      queryVector,
      numCandidates: Math.max(topK * 10, 100),
      limit: topK,
      filter: {
        kind: { $in: ['chunk', 'chapterSummary'] },
        libraryId: { $eq: libraryId },
        user: { $eq: userEmail },
      }
    }
  },
  { $project: { _id: 1, score: { $meta: 'vectorSearchScore' } } }
]
```

Direct Mongo query (no vector search), e.g. for neighbor chunks:
```typescript
const chunks = await collection.find({
  kind: 'chunk',
  libraryId,
  user: userEmail,
  fileId: { $in: fileIds },
}).sort({ fileId: 1, chunkIndex: 1 }).toArray()
```

### Facet duplication
Facet fields are copied into `chunk` and `chapterSummary` documents so filtering can happen directly inside `$vectorSearch`.

### Code references
- Repository: `src/lib/repositories/vector-repo.ts`
- Ingestion: `src/lib/chat/ingestion-service.ts`
- Retrievers:
  - `src/lib/chat/retrievers/chunks.ts`
  - `src/lib/chat/retrievers/chunk-summary.ts`

### Related docs
- Runtime/operations notes: `docs/analysis/ingestion.md`









