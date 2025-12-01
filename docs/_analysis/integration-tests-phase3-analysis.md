# Integrationstests Phase 3 – Analyse nach MongoDB-Migration

## Aktuelle Situation

### Vorhandene Test-Cases (Phase 3)

1. **TC-3.1**: Vollständige Ingestion (Extract + Template + Ingest)
2. **TC-3.2**: Ingest mit force-Policy
3. **TC-3.3**: Ingest mit skip-Policy (Gate-basiert)
4. **TC-3.4**: MongoDB-only Ingestion mit force-Policy ⚠️
5. **TC-3.5**: MongoDB-only Ingestion mit auto-Policy ⚠️
6. **TC-3.6**: Pinecone-only Ingestion mit force-Policy ❌ **VERALTET**
7. **TC-3.7**: Pinecone-only Ingestion mit auto-Policy ❌ **VERALTET**

### Aktuelle Validatoren

- `validateMongoUpsert()`: Prüft `doc_meta` Collection (verwendet noch `doc-meta-repo`)
- `validatePineconeUpsert()`: Prüft Pinecone-Vektoren ❌ **VERALTET**
- `validateIngestion()`: Prüft nur `job.ingestion.vectorsUpserted`

## Probleme nach MongoDB-Migration

### 1. Trennung MongoDB/Pinecone macht keinen Sinn mehr

**Vorher:**
- MongoDB: `doc_meta` Collection für Metadaten
- Pinecone: Vektoren für RAG-Suche

**Jetzt:**
- MongoDB: Alles in einer Collection (`vectors__${libraryId}`)
  - `kind: 'meta'` → Meta-Dokument (ersetzt `doc_meta`)
  - `kind: 'chunk'` → Chunk-Vektoren (ersetzt Pinecone Chunks)
  - `kind: 'chapterSummary'` → Chapter-Summaries

### 2. Validatoren verwenden noch alte Repositories

- `validateMongoUpsert()` verwendet `doc-meta-repo` → sollte `vector-repo` verwenden
- `validatePineconeUpsert()` ist komplett obsolet

### 3. Test-Cases TC-3.6/TC-3.7 sind obsolet

Diese Tests prüfen explizit Pinecone und machen nach der Migration keinen Sinn mehr.

## Vorschlag: Neue Test-Strategie für Phase 3

### Use Cases, die wir testen sollten

#### 1. **Vollständige Ingestion** (TC-3.1, TC-3.2)
- ✅ Meta-Dokument existiert (`kind: 'meta'`)
- ✅ Chunk-Vektoren existieren (`kind: 'chunk'`)
- ✅ Chapter-Summaries existieren (`kind: 'chapterSummary'`, falls vorhanden)
- ✅ Vector Search Index existiert
- ✅ Vektoren können abgefragt werden (Vector Search funktioniert)

#### 2. **Gate-basierte Policies** (TC-3.3)
- ✅ Wenn bereits Vektoren existieren → Skip
- ✅ Wenn keine Vektoren existieren → Run

#### 3. **Force-Policy** (TC-3.2)
- ✅ Überschreibt bestehende Vektoren
- ✅ Alte Vektoren werden gelöscht (`deleteVectorsByFileId`)
- ✅ Neue Vektoren werden erstellt

#### 4. **Vector Search Funktionalität** (NEU)
- ✅ Vector Search Query funktioniert
- ✅ Filter funktionieren (libraryId, user, fileId, kind)
- ✅ Facetten-Filter funktionieren (year, authors, etc.)
- ✅ Top-K Ergebnisse sind korrekt

#### 5. **Meta-Dokument Validierung** (NEU)
- ✅ Meta-Dokument enthält alle erwarteten Felder
- ✅ Facetten-Metadaten sind korrekt gespeichert
- ✅ Chapters-Array ist korrekt
- ✅ Chunk-Count stimmt mit tatsächlichen Chunks überein

#### 6. **Chunk-Vektoren Validierung** (NEU)
- ✅ Chunk-Vektoren enthalten Facetten-Metadaten (für Filterung)
- ✅ Embeddings haben korrekte Dimension
- ✅ Text-Inhalte sind korrekt
- ✅ Heading-Context ist vorhanden (falls vorhanden)

## Vorschlag: Neue Validatoren

### `validateMongoVectorUpsert()`

Ersetzt sowohl `validateMongoUpsert()` als auch `validatePineconeUpsert()`.

**Prüfungen:**
1. Meta-Dokument existiert (`kind: 'meta'`)
2. Chunk-Vektoren existieren (`kind: 'chunk'`)
3. Chapter-Summaries existieren (`kind: 'chapterSummary'`, falls vorhanden)
4. Vector Search Index existiert
5. Vektoren können abgefragt werden

**Implementierung:**
```typescript
async function validateMongoVectorUpsert(
  job: ExternalJob,
  expected: ExpectedOutcome,
  messages: ValidationMessage[]
): Promise<void> {
  if (!expected.expectMongoUpsert && !expected.expectVectorUpsert) return

  const fileId = job.correlation?.source?.itemId
  if (!fileId) {
    pushMessage(messages, 'warn', 'Keine fileId im Job gefunden')
    return
  }

  try {
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const { getVectorCollection, getMetaByFileId, queryVectors } = await import('@/lib/repositories/vector-repo')

    const ctx = await loadLibraryChatContext(job.userEmail, job.libraryId)
    if (!ctx) {
      pushMessage(messages, 'error', 'Bibliothek nicht gefunden')
      return
    }

    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const dimension = getEmbeddingDimensionForModel(ctx.library.config?.chat)

    // 1. Prüfe Meta-Dokument
    const metaDoc = await getMetaByFileId(libraryKey, fileId)
    if (!metaDoc) {
      pushMessage(messages, 'error', `Meta-Dokument nicht gefunden für fileId "${fileId}"`)
    } else {
      const chunkCount = typeof metaDoc.chunkCount === 'number' ? metaDoc.chunkCount : 0
      const chaptersCount = typeof metaDoc.chaptersCount === 'number' ? metaDoc.chaptersCount : 0
      pushMessage(messages, 'info', `Meta-Dokument gefunden: chunkCount=${chunkCount}, chaptersCount=${chaptersCount}`)
    }

    // 2. Prüfe Chunk-Vektoren
    const zeroVector = new Array<number>(dimension).fill(0)
    const chunkVectors = await queryVectors(
      libraryKey,
      zeroVector,
      10,
      {
        libraryId: job.libraryId,
        user: job.userEmail,
        fileId,
        kind: 'chunk',
      },
      dimension
    )

    if (chunkVectors.length === 0) {
      pushMessage(messages, 'error', `Keine Chunk-Vektoren gefunden für fileId "${fileId}"`)
    } else {
      pushMessage(messages, 'info', `${chunkVectors.length} Chunk-Vektoren gefunden`)
      
      // Prüfe Facetten-Metadaten in Chunks
      const firstChunk = chunkVectors[0]
      const hasFacets = firstChunk.year !== undefined || 
                        firstChunk.authors !== undefined || 
                        firstChunk.region !== undefined
      if (hasFacets) {
        pushMessage(messages, 'info', 'Chunk-Vektoren enthalten Facetten-Metadaten (für Filterung)')
      } else {
        pushMessage(messages, 'warn', 'Chunk-Vektoren enthalten keine Facetten-Metadaten')
      }
    }

    // 3. Prüfe Chapter-Summaries (falls vorhanden)
    if (metaDoc && metaDoc.chaptersCount > 0) {
      const chapterSummaries = await queryVectors(
        libraryKey,
        zeroVector,
        10,
        {
          libraryId: job.libraryId,
          user: job.userEmail,
          fileId,
          kind: 'chapterSummary',
        },
        dimension
      )
      
      if (chapterSummaries.length > 0) {
        pushMessage(messages, 'info', `${chapterSummaries.length} Chapter-Summaries gefunden`)
      } else {
        pushMessage(messages, 'warn', 'Chapter-Summaries erwartet, aber keine gefunden')
      }
    }

    // 4. Prüfe Vector Search Index
    const collection = getVectorCollection(libraryKey)
    const indexes = await collection.listSearchIndexes().toArray()
    const vectorIndex = indexes.find(idx => idx.name === 'vector_search_idx')
    
    if (!vectorIndex) {
      pushMessage(messages, 'error', 'Vector Search Index nicht gefunden')
    } else {
      pushMessage(messages, 'info', 'Vector Search Index existiert')
    }

    // 5. Teste Vector Search Query
    if (chunkVectors.length > 0 && chunkVectors[0].embedding) {
      const testQuery = await queryVectors(
        libraryKey,
        chunkVectors[0].embedding,
        5,
        {
          libraryId: job.libraryId,
          user: job.userEmail,
          fileId,
          kind: 'chunk',
        },
        dimension
      )
      
      if (testQuery.length > 0) {
        pushMessage(messages, 'info', `Vector Search Query erfolgreich: ${testQuery.length} Ergebnisse`)
      } else {
        pushMessage(messages, 'warn', 'Vector Search Query lieferte keine Ergebnisse')
      }
    }
  } catch (error) {
    pushMessage(
      messages,
      'error',
      `Fehler beim Prüfen von MongoDB Vector Search: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
```

## Vorschlag: Neue Test-Cases

### TC-3.4: MongoDB Vector Search Ingestion mit force-Policy
- **Beschreibung**: Prüft, ob Meta-Dokument und Chunk-Vektoren in MongoDB Vector Search Collection existieren
- **Erwartungen**:
  - `expectMongoUpsert: true` → Meta-Dokument existiert
  - `expectVectorUpsert: true` → Chunk-Vektoren existieren
  - `expectVectorSearchIndex: true` → Vector Search Index existiert

### TC-3.5: MongoDB Vector Search Ingestion mit auto-Policy
- **Beschreibung**: Gate-basierte Ingestion, prüft ob Skip-Logik funktioniert
- **Erwartungen**:
  - Wenn Vektoren existieren → Skip
  - Wenn keine Vektoren existieren → Run

### TC-3.6: Vector Search Funktionalität (NEU)
- **Beschreibung**: Prüft, ob Vector Search Queries funktionieren
- **Erwartungen**:
  - Vector Search Query liefert Ergebnisse
  - Filter funktionieren (libraryId, user, fileId, kind)
  - Facetten-Filter funktionieren

### TC-3.7: Facetten-Metadaten in Vektoren (NEU)
- **Beschreibung**: Prüft, ob Facetten-Metadaten korrekt in Chunk-Vektoren kopiert wurden
- **Erwartungen**:
  - Chunk-Vektoren enthalten Facetten-Metadaten
  - Filterung nach Facetten funktioniert

## Vorschlag: Anpassungen an ExpectedOutcome

```typescript
export interface ExpectedOutcome {
  // ... bestehende Felder ...
  
  /** MongoDB Vector Search: Meta-Dokument soll existieren */
  expectMetaDocument?: boolean;
  
  /** MongoDB Vector Search: Chunk-Vektoren sollen existieren */
  expectChunkVectors?: boolean;
  
  /** MongoDB Vector Search: Chapter-Summaries sollen existieren */
  expectChapterSummaries?: boolean;
  
  /** MongoDB Vector Search: Vector Search Index soll existieren */
  expectVectorSearchIndex?: boolean;
  
  /** MongoDB Vector Search: Vector Search Query soll funktionieren */
  expectVectorSearchQuery?: boolean;
  
  /** MongoDB Vector Search: Facetten-Metadaten sollen in Chunks vorhanden sein */
  expectFacetMetadataInChunks?: boolean;
  
  // Veraltete Felder (für Rückwärtskompatibilität behalten, aber als deprecated markieren)
  /** @deprecated Verwende expectMetaDocument statt expectMongoUpsert */
  expectMongoUpsert?: boolean;
  
  /** @deprecated Nicht mehr relevant nach MongoDB-Migration */
  expectPineconeUpsert?: boolean;
}
```

## Zusammenfassung: Was muss geändert werden?

### 1. Validatoren aktualisieren
- ✅ `validateMongoUpsert()` → `validateMongoVectorUpsert()` umbenennen und anpassen
- ❌ `validatePineconeUpsert()` entfernen oder als deprecated markieren
- ✅ Neue Validierungen für Vector Search Index und Queries hinzufügen

### 2. Test-Cases aktualisieren
- ✅ TC-3.4, TC-3.5: Beschreibungen und Erwartungen anpassen
- ❌ TC-3.6, TC-3.7: Entfernen oder durch neue Vector Search Tests ersetzen
- ✅ Neue Test-Cases für Vector Search Funktionalität hinzufügen

### 3. ExpectedOutcome Interface erweitern
- ✅ Neue Felder für MongoDB Vector Search hinzufügen
- ✅ Alte Felder als deprecated markieren

### 4. Repository-Imports aktualisieren
- ✅ `doc-meta-repo` → `vector-repo` in Validatoren
- ✅ `getByFileIds` → `getMetaByFileId`
- ✅ `getCollectionNameForLibrary` aus `vector-repo` verwenden

## Ergebnis-Prüfung: Wie können wir Ergebnisse prüfen?

### 1. **Meta-Dokument Prüfung**
```typescript
const metaDoc = await getMetaByFileId(libraryKey, fileId)
// Prüfe: chunkCount, chaptersCount, docMetaJson, Facetten-Felder
```

### 2. **Chunk-Vektoren Prüfung**
```typescript
const chunks = await queryVectors(libraryKey, zeroVector, 10, {
  libraryId, user, fileId, kind: 'chunk'
}, dimension)
// Prüfe: Anzahl, Facetten-Metadaten, Embeddings-Dimension
```

### 3. **Vector Search Index Prüfung**
```typescript
const indexes = await collection.listSearchIndexes().toArray()
const vectorIndex = indexes.find(idx => idx.name === 'vector_search_idx')
// Prüfe: Index existiert, korrekte Konfiguration
```

### 4. **Vector Search Query Prüfung**
```typescript
const results = await queryVectors(libraryKey, queryVector, topK, filter, dimension)
// Prüfe: Ergebnisse vorhanden, Filter funktionieren, Scores sind sinnvoll
```

### 5. **Facetten-Filter Prüfung**
```typescript
const filteredResults = await queryVectors(libraryKey, queryVector, topK, {
  libraryId, user, fileId, kind: 'chunk',
  year: 2024, // Facetten-Filter
}, dimension)
// Prüfe: Nur Dokumente mit year=2024 werden zurückgegeben
```



