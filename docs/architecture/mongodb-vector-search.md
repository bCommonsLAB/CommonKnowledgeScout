## MongoDB Vector Search (architecture)

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









