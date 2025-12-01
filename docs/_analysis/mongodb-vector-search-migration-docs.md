# MongoDB Vector Search Migration - Dokumentations-Update

## Übersicht

Nach der Migration von Pinecone zu MongoDB Vector Search müssen mehrere Dokumentationsdateien aktualisiert werden. Diese Datei listet alle betroffenen Dokumente und die notwendigen Änderungen auf.

## Kritische Updates (Muss aktualisiert werden)

### 1. `docs/_analysis/pinecone-ingestion-analysis.md` ⚠️ **KOMPLETT ÜBERARBEITEN**

**Status**: Komplett veraltet - beschreibt Pinecone-Architektur

**Änderungen**:
- Titel ändern zu: "MongoDB Vector Search Ingestion - Technische Analyse"
- Alle Pinecone-Referenzen durch MongoDB Vector Search ersetzen
- Neue Architektur beschreiben:
  - MongoDB Atlas Vector Search statt Pinecone
  - Collection-Struktur pro Library (`vectors__${libraryId}`)
  - Meta-Dokumente (kind: 'meta') ohne Embeddings
  - Chunk-Dokumente (kind: 'chunk') mit Embeddings
  - Chapter-Summary-Dokumente (kind: 'chapterSummary') mit Embeddings
- Vector Search Index Setup beschreiben
- `$vectorSearch` Aggregation Pipeline erklären
- Repository-Pattern (`vector-repo.ts`) dokumentieren

**Neue Struktur**:
```markdown
# MongoDB Vector Search Ingestion - Technische Analyse

## Übersicht
Diese Analyse beschreibt den vollständigen Ablauf der Vektor-Berechnung und Ingestion in MongoDB Atlas Vector Search für die RAG-Pipeline.

## Verwendete Libraries und Technologien

### 1. Secretary Service RAG API
[... bleibt gleich ...]

### 2. MongoDB Atlas Vector Search
- **Database**: MongoDB Atlas (oder MongoDB Server ≥7.0)
- **Vector Search**: Native `$vectorSearch` Aggregation Pipeline
- **Index**: Vector Search Index mit `knnVector` Feld-Typ
- **Datei**: `src/lib/repositories/vector-repo.ts`

**Collection-Struktur**:
- Pro Library eine Collection: `vectors__${libraryId}`
- Dokument-Typen:
  - `kind: 'meta'` - Meta-Dokumente (ohne Embedding)
  - `kind: 'chunk'` - Text-Chunks (mit Embedding)
  - `kind: 'chapterSummary'` - Kapitel-Summaries (mit Embedding)

### 3. Text-Chunking
[... bleibt gleich ...]
```

### 2. `docs/_analysis/chat-orchestration-flow.md` ⚠️ **MEHRERE STELLEN**

**Betroffene Abschnitte**:
- Zeile 164: "Lädt **alle** Chunks dieser Dokumente aus Pinecone" → MongoDB
- Zeile 190: "Semantische Suche in Pinecone" → MongoDB Vector Search
- Zeile 383: "Semantische Suche in Pinecone" → MongoDB Vector Search
- Zeile 386: "Pinecone Query API" → MongoDB Vector Search Aggregation
- Zeile 391: "Pinecone-Index-Performance" → MongoDB Vector Search Index
- Zeile 399: "Pinecone Fetch API" → MongoDB direkte Abfrage
- Zeile 403: "Pinecone Fetch API kann bei vielen IDs langsam sein" → MongoDB Query-Optimierung
- Zeile 439: "Pinecone Query-Performance" → MongoDB Vector Search Performance
- Zeile 724: "Pinecone-Performance" → MongoDB Performance

**Änderungen**:
- Alle Pinecone-Referenzen durch MongoDB Vector Search ersetzen
- Neue Query-Struktur beschreiben (`$vectorSearch` Aggregation)
- Filter-Logik aktualisieren (direkte Filterung in Vector Search)
- Performance-Hinweise anpassen

### 3. `docs/architecture/pdf-transformation-phases.md` ⚠️ **PHASE 3**

**Betroffene Abschnitte**:
- Zeile 198: "Ingest transformed Markdown into vector database (Pinecone)" → MongoDB Vector Search
- Zeile 210: "Chunks with embeddings are received and stored in Pinecone" → MongoDB
- Zeile 237: "Vector embeddings: Stored in Pinecone" → MongoDB Vector Search
- Zeile 248: "Pinecone/MongoDB upsert" → MongoDB Vector Search upsert
- Zeile 251: "uses Pinecone `listVectors`" → MongoDB Query
- Zeile 267: "vectors for this document already exist in the Pinecone index" → MongoDB Collection

**Änderungen**:
- Phase 3 komplett überarbeiten
- MongoDB Vector Search Collection-Struktur beschreiben
- Neue Upsert-Logik dokumentieren
- Gate-Checking auf MongoDB umstellen

### 4. `docs/reference/modules/chat.md` ⚠️ **DEPENDENCIES & RETRIEVER**

**Betroffene Abschnitte**:
- Zeile 109: "Uses OpenAI API for LLM calls, Pinecone for vector search" → MongoDB Vector Search
- Zeile 122: "Semantic search in Pinecone for specific chunks" → MongoDB Vector Search

**Änderungen**:
```markdown
## Dependencies
- **Library System**: Uses `@/lib/services/library-service` for library access
- **Database**: Uses `@/lib/mongodb-service` for chat and query persistence
- **Storage**: Uses storage providers for file access
- **External**: Uses OpenAI API for LLM calls, MongoDB Atlas Vector Search for vector search

## Retriever Types
- **`chunk`**: Semantic search in MongoDB Vector Search for specific chunks
- **`summary`**: MongoDB search for document summaries
- **`chunkSummary`**: Loads all chunks from MongoDB without vector search
- **`auto`**: Automatic retriever selection based on question analysis
```

## Optionale Updates (Kann aktualisiert werden)

### 5. `docs/_analysis/file-inventory.md`

**Betroffene Abschnitte**:
- Zeile 122: `src/app/api/health/pinecone/route.ts` - Diese Route existiert möglicherweise noch, sollte aber als veraltet markiert werden

**Änderungen**:
- Health-Check-Route als veraltet markieren oder entfernen
- Neue MongoDB Health-Check-Route dokumentieren (falls vorhanden)

### 6. `docs/_analysis/pdf-transformation-phases-ist.md`

**Betroffene Abschnitte**:
- Zeile 192: Pinecone-Referenzen in Gate-Checking
- Zeile 229: Pinecone-Upsert-Logik

**Änderungen**:
- Gate-Checking auf MongoDB umstellen
- Upsert-Logik aktualisieren

## Neue Dokumentation erstellen

### 7. `docs/architecture/mongodb-vector-search.md` ⭐ **NEU**

**Inhalt**:
- MongoDB Vector Search Architektur-Übersicht
- Collection-Struktur und Dokument-Typen
- Vector Search Index Setup
- Query-Patterns (`$vectorSearch` Aggregation)
- Filter-Strategien
- Performance-Optimierung
- Migration von Pinecone (historischer Kontext)

### 8. `docs/reference/mongodb-vector-search-index.md` ⭐ **NEU**

**Inhalt**:
- Index-Definition
- Automatisches Index-Setup
- Index-Management
- Troubleshooting

## Dokumentation die aktuell bleibt

### ✅ `docs/mongodb-indexes.md`
- Beschreibt QueryLog-Collection-Indexe
- Keine Pinecone-Referenzen
- **Keine Änderungen nötig**

## Prioritäten

1. **Hoch**: `pinecone-ingestion-analysis.md` komplett neu schreiben
2. **Hoch**: `chat-orchestration-flow.md` aktualisieren
3. **Mittel**: `pdf-transformation-phases.md` Phase 3 aktualisieren
4. **Mittel**: `reference/modules/chat.md` Dependencies aktualisieren
5. **Niedrig**: Neue Architektur-Dokumentation erstellen
6. **Niedrig**: Optionale Dateien aktualisieren

## Checkliste für Updates

- [x] `pinecone-ingestion-analysis.md` → `mongodb-vector-search-ingestion-analysis.md` umbenennen und komplett neu schreiben ✅
- [x] `chat-orchestration-flow.md` alle Pinecone-Referenzen durch MongoDB Vector Search ersetzen ✅
- [x] `pdf-transformation-phases.md` Phase 3 aktualisieren ✅
- [x] `reference/modules/chat.md` Dependencies und Retriever-Typen aktualisieren ✅
- [x] `pdf-transformation-phases-ist.md` Gate-Checking aktualisieren ✅
- [x] `file-inventory.md` veraltete Referenzen markieren ✅
- [ ] Neue Architektur-Dokumentation erstellen (optional)
- [ ] Optionale Dateien durchgehen und aktualisieren (optional)

