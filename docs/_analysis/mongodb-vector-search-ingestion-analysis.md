# MongoDB Vector Search Ingestion - Technische Analyse

## Übersicht

Diese Analyse beschreibt den vollständigen Ablauf der Vektor-Berechnung und Ingestion in MongoDB Atlas Vector Search für die RAG-Pipeline. **Alle Embeddings laufen über den Secretary Service RAG API** (`/api/rag/embed-text`). Chunking erfolgt im Secretary Service, nicht mehr lokal.

## Verwendete Libraries und Technologien

### 1. Secretary Service RAG API
- **Service**: Secretary Service (`/api/rag/embed-text`)
- **Model**: Standard `voyage-3-large` (konfigurierbar pro Library via `config.chat.embeddings.embeddingModel`)
- **Dimension**: Standard 1024 für `voyage-3-large` (konfigurierbar via `config.chat.embeddings.dimensions`)
- **Chunking**: Erfolgt im Secretary Service (Markdown-aware, respektiert Überschriften und Absätze)
- **Datei**: `src/lib/secretary/client.ts` (`embedTextRag()`)
- **Abstraktion**: `src/lib/chat/rag-embeddings.ts`

**Unterstützte Modelle**:
- `voyage-3-large` (Standard, 1024 Dimensionen, beste Qualität laut [Voyage Blog](https://blog.voyageai.com/2025/01/07/voyage-3-large/))
- `voyage-3.5`, `voyage-3.5-lite` (1024 Dimensionen)
- `voyage-code-3` (1024 Dimensionen)
- `text-embedding-3-large` (3072 Dimensionen, OpenAI über Secretary Service)
- Weitere Voyage-Modelle

### 2. MongoDB Atlas Vector Search
- **Database**: MongoDB Atlas (oder MongoDB Server ≥7.0)
- **Vector Search**: Native `$vectorSearch` Aggregation Pipeline
- **Index**: Vector Search Index mit `knnVector` Feld-Typ
- **Datei**: `src/lib/repositories/vector-repo.ts`

**Collection-Struktur**:
- Pro Library eine Collection: `vectors__${libraryId}`
- Dokument-Typen (unterschieden durch `kind`-Feld):
  - `kind: 'meta'` - Meta-Dokumente (ohne Embedding, enthalten vollständige Metadaten)
  - `kind: 'chunk'` - Text-Chunks (mit Embedding und Facetten-Metadaten)
  - `kind: 'chapterSummary'` - Kapitel-Summaries (mit Embedding)

**WICHTIG**: 
- Alle Dokument-Typen werden in derselben Collection gespeichert
- Facetten-Metadaten werden in Chunk- und ChapterSummary-Dokumente kopiert für direkte Filterung
- Meta-Dokumente enthalten keine Embeddings (nur Metadaten für Gallery-Anzeige)

### 3. Text-Chunking (nicht mehr lokal verwendet)
- **Hinweis**: Chunking erfolgt jetzt im Secretary Service
- Die lokale `chunkText()` Funktion (`src/lib/text/chunk.ts`) wird für Chat/RAG nicht mehr verwendet
- Secretary Service verwendet Markdown-aware Chunking (respektiert Überschriften, Absätze)

## Detaillierter Ablauf

### Phase 1: Markdown-Vorbereitung

**Datei**: `src/lib/chat/ingestion-service.ts`

**Prozess**:
1. **Frontmatter-Parsing**: Extraktion von Meta und Body
2. **Bild-Verarbeitung**: Slides, Cover-Bilder und Markdown-Bilder werden auf Azure Storage hochgeladen
3. **Finales Markdown**: Das Markdown aus `docMetaJson.markdown` wird verwendet (identisch mit MongoDB-Inhalt)

**WICHTIG**: Das finale Markdown enthält bereits alle Azure-Bild-URLs, die auch in MongoDB gespeichert sind. Damit ist Konsistenz zwischen Vector-Chunks und MongoDB-Dokument gewährleistet.

### Phase 2: Secretary Service RAG Embedding

**Datei**: `src/lib/chat/rag-embeddings.ts`

**Funktion**: `embedDocumentWithSecretary(markdown: string, ctx: LibraryChatContext, options?: {...}): Promise<{chunks, dimensions, model}>`

**Prozess**:

1. **Config-Lesen**:
   ```typescript
   const config = getEmbeddingConfig(ctx)
   // Defaults: model='voyage-3-large', chunkSize=1000, chunkOverlap=200, dimensions=1024
   ```

2. **Secretary Service API-Aufruf**:
   ```typescript
   POST ${SECRETARY_SERVICE_URL}/api/rag/embed-text
   Headers:
     Authorization: Bearer ${SECRETARY_SERVICE_API_KEY}
     X-Secretary-Api-Key: ${SECRETARY_SERVICE_API_KEY}
     Content-Type: application/json
   Body:
     {
       "markdown": "...", // Komplettes Dokument
       "document_id": fileId,
       "chunk_size": 1000,
       "chunk_overlap": 200,
       "embedding_model": "voyage-3-large",
       "metadata": { ... }
     }
   ```

3. **Response-Struktur**:
   ```typescript
   {
     status: 'success',
     data: {
       chunks: [
         {
           text: "...",
           chunk_index: 0,
           document_id: "...",
           embedding: [0.123, -0.456, ...], // 1024 Dimensionen
           heading_context: "Introduction" | null,
           start_char: 0 | null,
           end_char: 100 | null,
           metadata: { ... } // Zusätzliche Metadaten vom Secretary Service
         }
       ],
       dimensions: 1024,
       model: "voyage-3-large"
     }
   }
   ```

### Phase 3: MongoDB Vector Search Upsert

**Datei**: `src/lib/repositories/vector-repo.ts`

**Funktion**: `upsertVectors(libraryKey: string, vectors: VectorDocument[]): Promise<void>`

**Prozess**:

1. **Collection-Zugriff**:
   ```typescript
   const col = await getVectorCollection(libraryKey)
   // Collection-Name: vectors__${libraryId}
   ```

2. **Vector Search Index Setup** (automatisch):
   - Index wird automatisch erstellt beim ersten Zugriff
   - Index-Name: `vector_search_idx`
   - Index-Definition:
     ```json
     {
       "mappings": {
         "dynamic": true,
         "fields": {
           "embedding": {
             "type": "knnVector",
             "dimensions": 1024, // Aus Config
             "similarity": "cosine"
           }
         }
       }
     }
     ```

3. **Chunk-Vektoren erstellen**:
   ```typescript
   const vectors = ragResult.chunks.map(chunk => ({
     _id: `${fileId}-${chunk.index}`,
     kind: 'chunk',
     libraryId,
     user: userEmail,
     fileId,
     fileName,
     chunkIndex: chunk.index,
     text: chunk.text,
     embedding: chunk.embedding,
     headingContext: chunk.headingContext,
     startChar: chunk.startChar,
     endChar: chunk.endChar,
     upsertedAt: new Date().toISOString(),
     // Facetten-Metadaten für direkte Filterung
     year: mongoDoc.year,
     authors: mongoDoc.authors,
     region: mongoDoc.region,
     docType: mongoDoc.docType,
     source: mongoDoc.source,
     tags: mongoDoc.tags,
     // ... weitere Facetten-Felder
   }))
   ```

4. **Batch-Upsert**:
   ```typescript
   await upsertVectors(libraryKey, vectors)
   // Verwendet MongoDB bulkWrite mit Batches von 1000
   ```

5. **Meta-Dokument erstellen**:
   ```typescript
   const metaDoc = {
     libraryId,
     user: userEmail,
     fileId,
     fileName,
     chunkCount: vectors.length,
     chaptersCount,
     docMetaJson: docMetaJsonObj,
     chapters: chaptersForMongo,
     upsertedAt: new Date().toISOString(),
     // Alle Facetten-Metadaten
     year, authors, region, docType, source, tags, ...
   }
   await upsertVectorMeta(libraryKey, metaDoc)
   // Speichert als kind: 'meta' ohne Embedding
   ```

**WICHTIG**: 
- Facetten-Metadaten werden in jeden Chunk kopiert für direkte Filterung während Vector Search
- Meta-Dokumente enthalten keine Embeddings (nur Metadaten)
- Alle Dokument-Typen werden in derselben Collection gespeichert

### Phase 4: Vector Search Query

**Datei**: `src/lib/repositories/vector-repo.ts`

**Funktion**: `queryVectors(libraryKey: string, queryVector: number[], topK: number, filter: Record<string, unknown>, dimension?: number): Promise<QueryMatch[]>`

**Prozess**:

1. **Vector Search Aggregation Pipeline**:
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
           authors: { $in: ['Author1', 'Author2'] },
           // ... weitere Filter
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

2. **Ergebnisse**:
   ```typescript
   const results = await col.aggregate(pipeline).toArray()
   return results.map(doc => ({
     id: doc._id,
     score: doc.score,
     metadata: { ...doc }
   }))
   ```

**Vorteile**:
- Direkte Filterung in Vector Search (keine separate MongoDB-Query nötig)
- Alle Facetten-Metadaten sind in den Vektoren verfügbar
- Einzelne Query statt zwei separate Queries

## Code-Referenzen

### Ingestion Service
- **`src/lib/chat/ingestion-service.ts`**: Haupt-Ingestion-Logik
  - `upsertMarkdown()`: Kompletter Upsert-Prozess
  - Erstellt Chunk-Vektoren mit Facetten-Metadaten
  - Erstellt Meta-Dokument ohne Embedding

### Vector Repository
- **`src/lib/repositories/vector-repo.ts`**: MongoDB Vector Search Repository
  - `getVectorCollection()`: Collection-Zugriff mit automatischem Index-Setup
  - `upsertVectors()`: Batch-Upsert von Vektoren
  - `upsertVectorMeta()`: Upsert von Meta-Dokumenten
  - `queryVectors()`: Vector Search Query mit Filterung
  - `findDocs()`: Findet Meta-Dokumente für Gallery
  - `aggregateFacets()`: Aggregiert Facetten aus Meta-Dokumenten

### Retriever
- **`src/lib/chat/retrievers/chunks.ts`**: Chunk-Retriever
  - Verwendet `queryVectors()` für semantische Suche
  - Filter werden direkt in Vector Search angewendet
  - Lädt Nachbar-Chunks aus MongoDB für Kontext

- **`src/lib/chat/retrievers/chunk-summary.ts`**: ChunkSummary-Retriever
  - Lädt alle Chunks direkt aus MongoDB ohne Vector Search
  - Verwendet direkte MongoDB-Abfrage mit Filterung

## Umgebungsvariablen

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| `MONGODB_URI` | - | MongoDB Connection String (erforderlich) |
| `SECRETARY_SERVICE_URL` | - | Secretary Service URL (erforderlich) |
| `SECRETARY_SERVICE_API_KEY` | - | Secretary Service API-Key (erforderlich) |

**Hinweis**: `PINECONE_API_KEY` wird nicht mehr benötigt.

## Collection-Struktur

### Collection-Name
- Format: `vectors__${libraryId}`
- Beispiel: `vectors__lib-abc123`

### Dokument-Struktur

#### Meta-Dokument (kind: 'meta')
```typescript
{
  _id: `${fileId}-meta`,
  kind: 'meta',
  libraryId: string,
  user: string,
  fileId: string,
  fileName: string,
  chunkCount: number,
  chaptersCount: number,
  docMetaJson: Record<string, unknown>,
  chapters: Array<ChapterMetaEntry>,
  // Facetten-Metadaten
  year?: number,
  authors?: string[],
  region?: string,
  docType?: string,
  source?: string,
  tags?: string[],
  upsertedAt: string,
  // KEIN embedding-Feld
}
```

#### Chunk-Dokument (kind: 'chunk')
```typescript
{
  _id: `${fileId}-${chunkIndex}`,
  kind: 'chunk',
  libraryId: string,
  user: string,
  fileId: string,
  fileName: string,
  chunkIndex: number,
  text: string,
  embedding: number[], // Vector Embedding
  headingContext?: string,
  startChar?: number,
  endChar?: number,
  upsertedAt: string,
  // Facetten-Metadaten (für Filterung kopiert)
  year?: number,
  authors?: string[],
  region?: string,
  docType?: string,
  source?: string,
  tags?: string[],
}
```

#### ChapterSummary-Dokument (kind: 'chapterSummary')
```typescript
{
  _id: `${fileId}-chap-${chapterId}`,
  kind: 'chapterSummary',
  libraryId: string,
  user: string,
  fileId: string,
  fileName: string,
  chapterId: string,
  chapterTitle?: string,
  chapterOrder?: number,
  text: string,
  embedding: number[], // Vector Embedding
  keywords?: string[],
  upsertedAt: string,
  // Facetten-Metadaten (für Filterung kopiert)
  year?: number,
  authors?: string[],
  // ...
}
```

## Vector Search Index

### Automatisches Setup
- Index wird automatisch beim ersten Zugriff erstellt
- Verwendet `db.admin().command({ createSearchIndexes: ... })`
- Dimension wird aus Library-Config gelesen

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
          "dimensions": 1024,
          "similarity": "cosine"
        }
      }
    }
  }
}
```

### Indizes für Filterung
- `libraryId`: Index für Library-Filterung
- `fileId`: Index für File-Filterung
- `kind`: Index für Dokument-Typ-Filterung
- `user`: Index für User-Filterung
- Facetten-Indizes: Automatisch erstellt via `ensureFacetIndexes()`

## Performance-Optimierungen

1. **Batch-Upsert**: Vektoren werden in Batches von 1000 upsertet
2. **Direkte Filterung**: Facetten-Filter werden direkt in Vector Search angewendet
3. **Meta-Dokumente**: Keine Embeddings in Meta-Dokumenten (spart Speicher)
4. **Facetten-Duplikation**: Metadaten werden in Chunks kopiert für direkte Filterung
5. **Index-Caching**: Collection- und Index-Cache für bessere Performance

## Fehlerbehandlung

### Vector Search Index
- Fehler beim Index-Setup werden geloggt, aber nicht geworfen
- Index kann manuell erstellt werden falls automatisches Setup fehlschlägt

### Upsert-Fehler
- Fehler werden geloggt und weitergeworfen
- Job wird als failed markiert bei kritischen Fehlern

## Zusammenfassung

Die MongoDB Vector Search Ingestion erfolgt in mehreren Phasen:

1. **Markdown-Vorbereitung**: Frontmatter-Parsing, Bild-Upload
2. **Secretary Service RAG Embedding**: Chunking und Embedding-Generierung
3. **MongoDB Vector Search Upsert**: Batch-Upsert mit automatischem Index-Setup
4. **Meta-Dokument**: Speicherung ohne Embedding für Gallery-Anzeige

Die verwendeten Libraries sind minimal: Native MongoDB Driver für Vector Search, keine externen Dependencies für Embeddings oder Vector-Datenbank-Integration.



