# MongoDB Vector Search Architektur

## Übersicht

Die Anwendung verwendet MongoDB Atlas Vector Search für semantische Suche und RAG (Retrieval-Augmented Generation). Alle Vektoren werden in MongoDB gespeichert, keine externe Vector-Datenbank ist mehr erforderlich.

## Architektur-Prinzipien

### Collection-Struktur
- **Pro Library eine Collection**: `vectors__${libraryId}`
- **Alle Dokument-Typen in derselben Collection**: Meta-Dokumente, Chunks und Chapter-Summaries
- **Unterscheidung durch `kind`-Feld**: `'meta'`, `'chunk'`, `'chapterSummary'`

### Hybrid-Ansatz
- **Meta-Dokumente** (`kind: 'meta'`): Enthalten vollständige Metadaten, **keine Embeddings**
  - Verwendet für Gallery-Anzeige, Facetten-Aggregation
  - Enthält `docMetaJson`, `chapters`, Facetten-Metadaten
- **Chunk-Dokumente** (`kind: 'chunk'`): Enthalten Text-Chunks **mit Embeddings**
  - Verwendet für semantische Suche
  - Facetten-Metadaten werden kopiert für direkte Filterung
- **ChapterSummary-Dokumente** (`kind: 'chapterSummary'`): Enthalten Kapitel-Summaries **mit Embeddings**
  - Verwendet für Kapitel-basierte Suche

## Vector Search Index

### Automatisches Setup
- Index wird automatisch beim ersten Zugriff erstellt
- Verwendet MongoDB Admin API: `db.admin().command({ createSearchIndexes: ... })`
- Index-Name: `vector_search_idx` (pro Collection)

### Index-Definition
```json
{
  "name": "vector_search_idx",
  "definition": {
    "mappings": {
      "dynamic": true,
      "fields": {
        "embedding": {
          "type": "knnVector",
          "dimensions": 1024,  // Aus Library-Config
          "similarity": "cosine"
        }
      }
    }
  }
}
```

### Zusätzliche Indizes
- `libraryId`: Index für Library-Filterung
- `fileId`: Index für File-Filterung
- `kind`: Index für Dokument-Typ-Filterung
- `user`: Index für User-Filterung
- Facetten-Indizes: Automatisch erstellt via `ensureFacetIndexes()`

## Query-Patterns

### Vector Search Query
```typescript
const pipeline = [
  {
    $vectorSearch: {
      index: 'vector_search_idx',
      path: 'embedding',
      queryVector: queryVector,
      numCandidates: Math.max(topK * 10, 100),
      limit: topK,
      filter: {
        kind: { $in: ['chunk', 'chapterSummary'] },
        libraryId: { $eq: libraryId },
        user: { $eq: userEmail },
        // Direkte Facetten-Filterung
        year: { $in: [2023, 2024] },
        authors: { $in: ['Author1'] },
      }
    }
  },
  {
    $project: {
      _id: 1,
      score: { $meta: 'vectorSearchScore' },
      // ... Metadaten
    }
  }
]
```

### Direkte MongoDB-Abfrage (ohne Vector Search)
```typescript
// Für chunkSummary-Retriever oder Nachbar-Chunks
const chunks = await collection.find({
  kind: 'chunk',
  libraryId,
  user,
  fileId: { $in: fileIds },
}).sort({ fileId: 1, chunkIndex: 1 }).toArray()
```

## Facetten-Metadaten-Duplikation

### Strategie
- Facetten-Metadaten werden in jeden Chunk und ChapterSummary kopiert
- Ermöglicht direkte Filterung während Vector Search
- Keine separate MongoDB-Query für FileIDs nötig

### Beispiel
```typescript
// Meta-Dokument
{
  _id: 'file123-meta',
  kind: 'meta',
  year: 2024,
  authors: ['Author1', 'Author2'],
  // ... keine embedding
}

// Chunk-Dokument (mit kopierten Facetten)
{
  _id: 'file123-0',
  kind: 'chunk',
  embedding: [0.123, ...],
  year: 2024,  // Kopiert aus Meta
  authors: ['Author1', 'Author2'],  // Kopiert aus Meta
  // ...
}
```

## Performance-Optimierungen

1. **Direkte Filterung**: Facetten-Filter werden direkt in `$vectorSearch` angewendet
2. **Batch-Upsert**: Vektoren werden in Batches von 1000 upsertet
3. **Meta-Dokumente**: Keine Embeddings sparen Speicher
4. **Index-Caching**: Collection- und Index-Cache für bessere Performance
5. **Nachbar-Chunks**: Direkte MongoDB-Abfrage statt separater Fetch-API

## Migration von Pinecone

### Vorteile
- ✅ Keine externe Vector-Datenbank erforderlich
- ✅ Alle Daten in einer Datenbank (MongoDB)
- ✅ Direkte Filterung in Vector Search
- ✅ Konsistente Datenstruktur
- ✅ Einfacheres Deployment (eine Datenbank)

### Unterschiede
- **Collection statt Index**: Pro Library eine Collection statt Index
- **Meta-Dokumente**: Separate Dokumente ohne Embeddings
- **Facetten-Duplikation**: Metadaten werden in Chunks kopiert
- **Query-Pattern**: `$vectorSearch` Aggregation statt REST API

## Repository-Pattern

### `src/lib/repositories/vector-repo.ts`
- Zentrale Abstraktion für alle Vector Search Operationen
- Funktionen:
  - `getVectorCollection()`: Collection-Zugriff mit automatischem Index-Setup
  - `upsertVectors()`: Batch-Upsert von Vektoren
  - `upsertVectorMeta()`: Upsert von Meta-Dokumenten
  - `queryVectors()`: Vector Search Query mit Filterung
  - `findDocs()`: Findet Meta-Dokumente für Gallery
  - `aggregateFacets()`: Aggregiert Facetten aus Meta-Dokumenten

## Code-Referenzen

- **Repository**: `src/lib/repositories/vector-repo.ts`
- **Ingestion**: `src/lib/chat/ingestion-service.ts`
- **Retriever**: `src/lib/chat/retrievers/chunks.ts`
- **ChunkSummary-Retriever**: `src/lib/chat/retrievers/chunk-summary.ts`

## Weitere Informationen

- Siehe `docs/_analysis/mongodb-vector-search-ingestion-analysis.md` für detaillierte Ingestion-Analyse
- Siehe `docs/_analysis/chat-orchestration-flow.md` für Retrieval-Flow







