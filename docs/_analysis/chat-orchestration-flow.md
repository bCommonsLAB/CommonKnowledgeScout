# Chat-Orchestrierungs-Flow: Vereinfachte Dokumentation

## Übersicht

Dieses Dokument beschreibt den vereinfachten Flow der Chat-Orchestrierung von der Frage bis zur Antwort. Die Logik wurde stark vereinfacht: TOC-Queries verwenden Summary oder ChunkSummary basierend auf Token-Budget, normale Fragen verwenden immer RAG (chunk) mit Warnung bei zu wenig relevanten Dokumenten.

## Flow-Diagramm

```
┌─────────────────────────────────────────────────────────────────┐
│                   1. Request empfangen                          │
│              (POST /api/chat/[libraryId]/stream)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   2. Authentifizierung &                         │
│                      Library-Context laden                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   3. Query-Typ bestimmen                        │
│              • isTOCQuery? (TOC_QUESTION)                        │
│              • Normale Frage                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                                                   ▼
    ┌───────────────────┐   ┌──────────────────────┐
    │   TOC-Query       │   │   Normale Frage      │
    │   (Story Mode)    │   │   (immer RAG)        │
    └─────────┬─────────┘   └──────────┬───────────┘
              │                        │
              │                        │
              │                        │
              │                        │
              │                        │
              │                        │
              │                        │
              └────────────┬────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │  4. Retriever-Entscheidung           │
        │  TOC: summary oder chunkSummary      │
        │  (basierend auf Token-Budget)        │
        │  Normale Frage: chunk (RAG)          │
        └───────────┬──────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
    ┌────────┐ ┌──────────┐ ┌────────┐
    │Summary │ │ChunkSumm │ │ Chunk  │
    │(TOC)   │ │(TOC)     │ │(RAG)   │
    └───┬────┘ └────┬─────┘ └───┬────┘
        │           │           │
        └───────────┼───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  5. Retrieval          │
        │  (Quellen abrufen)    │
        │  • RAG: Score-Prüfung │
        │  • Warnung bei < 0.7  │
        └───────────┬────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  6. Prompt-Building   │
        │  • TOC-Prompt         │
        │  • Normal-Prompt      │
        └───────────┬────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  7. LLM-Aufruf        │
        │  (OpenAI API)         │
        └───────────┬────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  8. Response-Parsing  │
        │  • StoryTopicsData    │
        │  • Normal-Answer      │
        │  • Warnung hinzufügen │
        └───────────┬────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  9. Complete          │
        │  (Stream beenden)     │
        └───────────────────────┘
```

## Detaillierte Fallbeschreibungen

### Fall 1: TOC-Query (Story Mode)

**Trigger**: `isTOCQuery === true` (Frage entspricht `TOC_QUESTION` ODER `asTOC === true`)

**Flow**:
1. ✅ **Retriever-Entscheidung**: Basierend auf Token-Budget
   - Berechnet: `estimatedTokens = totalChunks × CHAT_AVG_TOKENS_PER_CHUNK`
   - Wenn `estimatedTokens >= CHAT_MAX_INPUT_TOKENS`: `summary` (MongoDB Summaries)
   - Wenn `estimatedTokens < CHAT_MAX_INPUT_TOKENS`: `chunkSummary` (alle Chunks)
2. ✅ **Retrieval**: 
   - `summary`: `summariesMongoRetriever` - Lädt alle MongoDB-Dokument-Summaries
   - `chunkSummary`: `chunkSummaryRetriever` - Lädt alle Chunks der gefilterten Dokumente
3. ✅ **Prompt**: `buildTOCPrompt()` - Spezieller Prompt für Themenübersicht
4. ✅ **LLM**: Generiert strukturierte Themenübersicht
5. ✅ **Parsing**: `parseStoryTopicsData()` - Extrahiert strukturierte Daten
6. ✅ **Output**: `StoryTopicsData` + Markdown-Answer (für Rückwärtskompatibilität)

**Vorteile**:
- Automatische Entscheidung basierend auf Token-Budget
- Bei wenigen Dokumenten: Präziser (chunkSummary)
- Bei vielen Dokumenten: Übersichtlich (summary)

**Nachteile**:
- Abhängig von Qualität der Summaries (bei summary)

---

### Fall 2: Normale Frage - Summary-Modus (nur explizit)

**Trigger**: 
- Explizit: `retriever=summary` oder `retriever=doc`

**Flow**:
1. ✅ **Retriever-Entscheidung**: `summary` (nur wenn explizit gesetzt)
2. ✅ **Retrieval**: `summariesMongoRetriever`
   - Lädt alle MongoDB-Dokument-Summaries (gefiltert)
   - Keine Embedding-Suche
3. ✅ **Prompt**: `buildPrompt()` - Normaler Prompt mit Summaries
4. ✅ **LLM**: Generiert Antwort basierend auf Summaries
5. ✅ **Parsing**: `parseStructuredLLMResponse()` - Standard-Parsing

**Hinweis**: Dieser Modus wird nur noch verwendet, wenn explizit gewählt. Automatisch wird immer RAG verwendet.

---

### Fall 3: TOC-Query - ChunkSummary-Modus

**Trigger**: 
- TOC-Query UND `estimatedTokens < CHAT_MAX_INPUT_TOKENS`

**Entscheidungskriterien**:
```typescript
estimatedTokens = totalChunks × CHAT_AVG_TOKENS_PER_CHUNK
if (estimatedTokens < CHAT_MAX_INPUT_TOKENS) {
  mode = 'chunkSummary' // Für TOC
}
```

**Flow**:
1. ✅ **Retriever-Entscheidung**: `chunkSummary` (nur für TOC)
   - Automatisch basierend auf Token-Budget
   - Berechnet: `sumChunkCounts()` aus MongoDB
2. ✅ **Retrieval**: `chunkSummaryRetriever`
   - Schritt 1: Lädt gefilterte Dokumente aus MongoDB (nur `fileIds`)
   - Schritt 2: Lädt **alle** Chunks dieser Dokumente aus Pinecone
   - **OHNE Embedding-Suche** (direkter Filter: `fileId: { $in: [...] }`)
   - Filter-Struktur: `{ $and: [libraryId, user, fileId: { $in: [...] }, kind: { $ne: 'chapterSummary' }] }`
3. ✅ **Prompt**: `buildTOCPrompt()` - TOC-Prompt mit allen Chunks
4. ✅ **LLM**: Generiert strukturierte Themenübersicht
5. ✅ **Parsing**: `parseStoryTopicsData()` - Extrahiert strukturierte Daten

**Vorteile**:
- Vollständiger Kontext (alle Chunks)
- Präzisere Themenübersicht als Summary-Modus
- Keine Embedding-Suche nötig

**Hinweis**: Dieser Modus wird nur für TOC-Queries verwendet, nicht für normale Fragen.

---

### Fall 4: Normale Frage - Chunk-Modus (RAG)

**Trigger**: 
- Immer für normale Fragen (automatisch)
- Explizit: `retriever=chunk`

**Flow**:
1. ✅ **Retriever-Entscheidung**: `chunk` (RAG) - Immer für normale Fragen
2. ✅ **Retrieval**: `chunksRetriever`
   - Schritt 1: Embedding der Frage generieren
   - Schritt 2: Semantische Suche in Pinecone (Vector-Similarity)
   - Schritt 3: Top-K relevante Chunks zurückgeben
   - Optional: Chapter-Summaries zusätzlich abrufen
   - **Warnung**: Wenn alle Scores < 0.7 → Warnung generieren
3. ✅ **Prompt**: `buildPrompt()` - Normaler Prompt mit relevanten Chunks
4. ✅ **LLM**: Generiert Antwort basierend auf relevanten Chunks
5. ✅ **Parsing**: `parseStructuredLLMResponse()` - Standard-Parsing
6. ✅ **Warnung**: Falls vorhanden, wird zur Antwort hinzugefügt

**Vorteile**:
- Semantisch relevante Chunks (beste Qualität)
- Funktioniert auch bei vielen Dokumenten
- Flexibel (Top-K kann angepasst werden)
- Warnung bei zu wenig relevanten Dokumenten

**Nachteile**:
- Langsamer (Embedding-Generierung + Vektor-Suche)
- Teurer (mehr API-Calls)

---

## Entscheidungslogik: `decideRetrieverMode()`

### Prioritäten (in Reihenfolge):

1. **TOC-Query**: Entscheidung basierend auf Token-Budget
   ```typescript
   if (isTOCQuery) {
     totalChunks = sumChunkCounts(filter)
     estimatedTokens = totalChunks × CHAT_AVG_TOKENS_PER_CHUNK
     
     if (estimatedTokens < CHAT_MAX_INPUT_TOKENS) {
       return { mode: 'chunkSummary' } // Präziser bei wenigen Dokumenten
     } else {
       return { mode: 'summary' } // Übersichtlich bei vielen Dokumenten
     }
   }
   ```

2. **Explizite Auswahl**: Respektiere User-Input
   ```typescript
   if (explicitRetriever && explicitRetriever !== 'auto') {
     // chunkSummary nur für TOC verfügbar
     return { mode: explicitRetriever === 'doc' ? 'summary' : explicitRetriever }
   }
   ```

3. **Normale Fragen**: Immer RAG
   ```typescript
   return { mode: 'chunk' } // Immer RAG für normale Fragen
   ```

### Konfiguration:

- `CHAT_MAX_INPUT_TOKENS`: Token-Budget (Standard: aus `budget.ts`)
- `CHAT_AVG_TOKENS_PER_CHUNK`: Durchschnittliche Token pro Chunk (Standard: 300)
- `RAG_MIN_SCORE_THRESHOLD`: Mindest-Score für relevante Dokumente (Standard: 0.7)

---

## Warnungs-Logik

### Warnung bei zu wenig relevanten Dokumenten

**Trigger**: 
- RAG-Modus (chunk)
- Alle gefundenen Dokumente haben Score < 0.7

**Warnung**:
```
"Die zugrundeliegenden Dokumente enthalten zu wenig passenden Inhalt. 
Bitte formulieren Sie die Frage um oder erweitern Sie die Anzahl der 
zugrundeliegenden Dokumente (Facettenfilter anpassen)."
```

**Implementierung**:
- Prüfung nach `queryVectors()` in `chunksRetriever`
- Warnung wird in `RetrieverOutput.warning` zurückgegeben
- Im Orchestrator wird Warnung zur Antwort hinzugefügt

---

## Checkbox für Themenübersicht

### Feature: "Als Themenübersicht anzeigen"

**Beschreibung**: 
- Checkbox im Chat-Input für normale Fragen
- Wenn aktiviert: Antwort wird als Themenübersicht (StoryTopicsData) formatiert
- Ermöglicht es Benutzern, normale Fragen als strukturierte Themenübersicht zu erhalten

**Implementierung**:
- Parameter `asTOC` im Request-Body
- Wenn `asTOC === true`: `isTOCQuery` wird auf `true` gesetzt
- Verwendet TOC-Prompt und StoryTopicsData-Parsing

---

## Implementierte Änderungen

### 1. Vereinfachte TOC-Logik

- TOC verwendet `summary` oder `chunkSummary` basierend auf Token-Budget
- `chunkSummary` nur für TOC verfügbar (nicht für normale Fragen)

### 2. Normale Fragen: Immer RAG

- Automatisch immer `chunk` (RAG) für normale Fragen
- Keine Token-Budget-Prüfung mehr für normale Fragen
- Warnung bei zu wenig relevanten Dokumenten (Score < 0.7)

### 3. Frage-Analyse entfernt

- Keine LLM-basierte Frage-Analyse mehr
- Chat-Title wird direkt aus Frage generiert (erste 60 Zeichen)
- Vereinfachter Flow ohne zusätzliche LLM-Calls

### 4. Checkbox für Themenübersicht

- Checkbox "Als Themenübersicht anzeigen" im Chat-Input
- Ermöglicht normale Fragen als Themenübersicht zu formatieren

---

## Zusammenfassung: Vereinfachte Logik

### Implementiert:

```
TOC-Query:
  Wenn estimatedTokens < CHAT_MAX_INPUT_TOKENS → chunkSummary (präziser)
  Wenn estimatedTokens >= CHAT_MAX_INPUT_TOKENS → summary (übersichtlich)

Normale Frage:
  Immer → chunk (RAG)
  Warnung wenn alle Scores < 0.7

Checkbox "Als Themenübersicht":
  Setzt isTOCQuery = true → verwendet TOC-Logik
```

---

## Implementierungsstatus

1. ✅ TOC-Logik vereinfacht (Token-Budget basiert)
2. ✅ Normale Fragen: Immer RAG
3. ✅ Warnung bei zu wenig relevanten Dokumenten
4. ✅ Frage-Analyse entfernt
5. ✅ Checkbox für Themenübersicht hinzugefügt
6. ✅ Dokumentation aktualisiert

## Nächste Schritte (optional)

1. ⚠️ Tests für Edge-Cases (wenige Dokumente, viele Dokumente)
2. ⚠️ Monitoring: Welcher Modus wird wann gewählt?
3. ⚠️ Top-K Erweiterung evaluieren (bei zu wenig relevanten Dokumenten)

