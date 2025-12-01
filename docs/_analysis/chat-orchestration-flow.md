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
   - Schritt 2: Lädt **alle** Chunks dieser Dokumente aus MongoDB
   - **OHNE Embedding-Suche** (direkter Filter: `fileId: { $in: [...] }`)
   - Filter-Struktur: `{ kind: 'chunk', libraryId, user, fileId: { $in: [...] } }`
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
   - Schritt 2: Semantische Suche in MongoDB Vector Search (Vector-Similarity)
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

---

## Performance-Analyse: Timing-Daten

### Gemessene Timings (Beispiel aus Produktion)

**RAG-Flow (chunk-Modus) - Normale Frage:**

```
┌─────────────────────────────────────────────────────────────┐
│ Schritt                    │ Timing    │ Anteil │ Status   │
├─────────────────────────────────────────────────────────────┤
│ 1. Embedding-Generierung   │ ~514ms    │ 11%    │ ✅ OK    │
│ 2. Vector-Suche (Query)    │ ~1187ms   │ 26%    │ ⚠️ Langsam│
│ 3. Fetch Neighbors          │ ~2902ms   │ 64%    │ ❌ Sehr  │
│                            │           │        │   langsam │
│ 4. Prompt-Building         │ ~50-100ms │ 1-2%   │ ✅ OK    │
│ 5. LLM-Aufruf             │ ~2000-5000ms│ 44-55%│ ⚠️ Variabel│
│                            │           │        │           │
│ TOTAL                      │ ~4600-8700ms│ 100% │ ⚠️        │
└─────────────────────────────────────────────────────────────┘
```

### Detaillierte Schritt-Analyse

#### 1. Embedding-Generierung (`embed`)
- **Timing**: ~514ms
- **Was passiert**: Frage wird in Embedding-Vektor umgewandelt
- **API-Call**: OpenAI Embeddings API
- **Bewertung**: ✅ Akzeptabel (~500ms ist normal für Embeddings)
- **Optimierungspotenzial**: Gering (abhängig von OpenAI)

#### 2. Vector-Suche (`query`)
- **Timing**: ~1187ms
- **Was passiert**: 
  - Semantische Suche in MongoDB Vector Search
  - Top-K relevante Chunks finden (Standard: 20)
  - Parallel: Chapter-Summaries suchen (Top-10)
- **API-Call**: MongoDB `$vectorSearch` Aggregation (2 parallel)
- **Bewertung**: ⚠️ Langsam (könnte optimiert werden)
- **Optimierungspotenzial**: 
  - Parallelisierung bereits implementiert ✅
  - Top-K könnte reduziert werden (wenn nicht alle benötigt)
  - MongoDB Vector Search Index-Performance prüfen

#### 3. Fetch Neighbors (`fetchNeighbors`)
- **Timing**: Variabel (abhängig von Anzahl der Nachbarn)
- **Was passiert**:
  - Window-basierte Nachbar-Chunks abrufen
  - Beispiel: Top-20 Chunks → Window ±1-3 → ~60-74 IDs
  - Direkte MongoDB-Abfrage mit `_id: { $in: [...] }`
- **API-Call**: MongoDB `find()` Query (1 Request mit vielen IDs)
- **Bewertung**: ✅ Schneller als Pinecone Fetch API
- **Vorteile**: 
  - Direkte MongoDB-Abfrage ist effizienter
  - Alle Metadaten bereits verfügbar (keine separate Fetch nötig)
  - Window-Größe (`windowByLength`) bestimmt Anzahl der IDs
- **Optimierungspotenzial**: 
  - **Mittel**: Window-Größe dynamisch anpassen
  - **Niedrig**: Optional machen (nur wenn wirklich nötig)

#### 4. Prompt-Building
- **Timing**: ~50-100ms (geschätzt)
- **Was passiert**: Prompt aus Quellen zusammenbauen
- **Bewertung**: ✅ OK (lokale Operation)
- **Optimierungspotenzial**: Gering

#### 5. LLM-Aufruf
- **Timing**: ~2000-5000ms (variabel)
- **Was passiert**: OpenAI API-Call für Antwort-Generierung
- **Bewertung**: ⚠️ Variabel (abhängig von Antwortlänge, Modell, Last)
- **Optimierungspotenzial**: 
  - Modell-Auswahl (gpt-4.1-mini ist schneller als gpt-4o)
  - Streaming bereits implementiert ✅
  - Token-Budget-Management bereits implementiert ✅

### Identifizierte Performance-Probleme

#### 🔴 Problem 1: Fetch Neighbors ist zu langsam
- **Impact**: Hoch (64% der Retrieval-Zeit)
- **Ursache**: Ein Request mit vielen IDs (74+)
- **Lösung**: 
  1. Batch-Größe reduzieren (z.B. max 20 IDs pro Request)
  2. Parallelisierung (mehrere Requests parallel)
  3. Window-Größe dynamisch anpassen (kleineres Window bei vielen Chunks)
  4. Optional machen (nur wenn wirklich nötig)

#### 🟡 Problem 2: Vector-Suche könnte schneller sein
- **Impact**: Mittel (26% der Retrieval-Zeit)
- **Ursache**: MongoDB Vector Search Query-Performance
- **Lösung**: 
  1. Top-K reduzieren (wenn nicht alle benötigt)
  2. Vector Search Index-Performance prüfen
  3. Caching für ähnliche Queries

#### 🟢 Problem 3: Embedding-Generierung ist akzeptabel
- **Impact**: Niedrig (11% der Retrieval-Zeit)
- **Status**: ✅ OK

### Optimierungsvorschläge

#### Priorität 1: Fetch Neighbors optimieren (Hoch)

**Option A: Batch-Größe reduzieren**
```typescript
// Aktuell: Ein Request mit allen IDs
const fetched = await fetchVectors(idx.host, apiKey, ids) // 74 IDs

// Optimiert: Mehrere Requests mit kleineren Batches
const BATCH_SIZE = 20
const batches = []
for (let i = 0; i < ids.length; i += BATCH_SIZE) {
  batches.push(ids.slice(i, i + BATCH_SIZE))
}
const fetched = await Promise.all(
  batches.map(batch => fetchVectors(idx.host, apiKey, batch))
)
```

**Option B: Window-Größe dynamisch anpassen**
```typescript
// Aktuell: Feste Window-Größe basierend auf answerLength
const windowByLength = input.answerLength === 'ausführlich' ? 3 : ...

// Optimiert: Dynamisch basierend auf Anzahl der Matches
const windowSize = matches.length > 30 ? 1 : matches.length > 15 ? 2 : 3
```

**Option C: Optional machen**
```typescript
// Nur wenn wirklich nötig (z.B. wenn Chunks sequenziell sind)
const needsNeighbors = matches.some(m => {
  const { base, chunk } = parseId(m.id)
  return Number.isFinite(chunk)
})
if (needsNeighbors) {
  // Fetch neighbors
} else {
  // Verwende Original-Matches direkt
}
```

#### Priorität 2: Vector-Suche optimieren (Mittel)

**Option A: Top-K reduzieren**
```typescript
// Aktuell: baseTopK = 20
// Optimiert: Dynamisch basierend auf Budget
const baseTopK = budget > 50000 ? 30 : budget > 30000 ? 20 : 15
```

**Option B: Caching für ähnliche Queries**
```typescript
// Cache für Embeddings ähnlicher Fragen (z.B. innerhalb von 5 Minuten)
const cacheKey = hashQuestion(input.question)
const cached = await getCachedEmbedding(cacheKey)
if (cached) {
  // Verwende cached embedding
}
```

#### Priorität 3: Monitoring verbessern (Niedrig)

- Detaillierte Timing-Logs für jeden Schritt
- Alerts bei langsamen Queries (>5s)
- Dashboard für Performance-Metriken

---

## Flow-Validierung: Aktueller Stand

### ✅ Validierung: Flow stimmt noch

Der dokumentierte Flow entspricht der aktuellen Implementierung:

1. ✅ **TOC-Query-Logik**: 
   - Token-Budget-basierte Entscheidung zwischen `summary` und `chunkSummary`
   - Implementiert in `decideRetrieverMode()`

2. ✅ **Normale Fragen**: 
   - Immer RAG (`chunk`-Modus)
   - Warnung bei Score < 0.7
   - Implementiert in `chunksRetriever`

3. ✅ **Retrieval-Schritte**:
   - Embedding-Generierung ✅
   - Vector-Suche (parallel für Chunks und Chapter-Summaries) ✅
   - Fetch Neighbors (Window-basiert) ✅
   - Score-Boosting (Chapter-Boost, Lexical-Boost) ✅

4. ✅ **Prompt-Building**:
   - TOC-Prompt für TOC-Queries ✅
   - Normal-Prompt für normale Fragen ✅

5. ✅ **LLM-Aufruf**:
   - Streaming implementiert ✅
   - Token-Budget-Management ✅
   - Retry-Logik bei zu langen Prompts ✅

6. ✅ **Response-Parsing**:
   - StoryTopicsData für TOC-Queries ✅
   - Normal-Parsing für normale Fragen ✅
   - Warnung wird hinzugefügt ✅

### ⚠️ Verbesserungen identifiziert

1. **Performance**: Fetch Neighbors ist zu langsam (siehe oben)
2. **Monitoring**: Timing-Daten werden gesammelt, aber nicht ausgewertet
3. **Optimierung**: Window-Größe könnte dynamischer sein

---

## Empfohlene Optimierungen (Priorisiert)

### Sofort umsetzbar (Quick Wins)

1. **Fetch Neighbors batching** (Priorität: Hoch)
   - Batch-Größe auf 20 IDs reduzieren
   - Parallelisierung implementieren
   - Geschätzte Verbesserung: ~50% schneller (2902ms → ~1450ms)

2. **Window-Größe dynamisch anpassen** (Priorität: Mittel)
   - Kleinere Window-Größe bei vielen Matches
   - Geschätzte Verbesserung: ~30% weniger IDs → ~20% schneller

### Mittelfristig (Wochen)

3. **Top-K dynamisch anpassen** (Priorität: Mittel)
   - Basierend auf Budget und Anzahl der Matches
   - Geschätzte Verbesserung: ~10-15% schneller

4. **Caching für Embeddings** (Priorität: Niedrig)
   - Cache für ähnliche Fragen
   - Geschätzte Verbesserung: ~500ms bei Cache-Hit

### Langfristig (Monate)

5. **Monitoring-Dashboard** (Priorität: Niedrig)
   - Performance-Metriken visualisieren
   - Alerts bei langsamen Queries

---

## Zusammenfassung: Performance-Optimierung

### Aktuelle Performance (RAG-Flow)
- **Total Retrieval**: ~4600ms
- **Langsamster Schritt**: Fetch Neighbors (~2902ms, 64%)
- **Zweiter Schritt**: Vector-Suche (~1187ms, 26%)
- **Schnellster Schritt**: Embedding (~514ms, 11%)

### Optimierungspotenzial
- **Fetch Neighbors**: ~50% schneller möglich (Batching)
- **Vector-Suche**: ~10-15% schneller möglich (dynamisches Top-K)
- **Gesamt**: ~30-40% schneller möglich (~4600ms → ~2800-3200ms)

### Nächste Schritte
1. ✅ Flow validiert - stimmt noch
2. ✅ Performance-Probleme identifiziert
3. ✅ Optimierungsvorschläge dokumentiert
4. ✅ Implementierung der Quick Wins abgeschlossen

---

## Implementierte Optimierungen

### ✅ Fetch Neighbors Batching (Implementiert)

**Problem**: Ein einzelner Request mit vielen IDs (74+) war sehr langsam (~2902ms).

**Lösung**: 
- IDs werden in Batches aufgeteilt (Standard: 20 IDs pro Batch)
- Batches werden parallel mit `Promise.all()` abgerufen
- Ergebnisse werden zusammengeführt

**Code-Änderungen** (`src/lib/chat/retrievers/chunks.ts`):
```typescript
// Batching: IDs in kleinere Batches aufteilen und parallel abrufen
const BATCH_SIZE = Number(process.env.CHAT_FETCH_BATCH_SIZE) || 20
const batches: string[][] = []
for (let i = 0; i < ids.length; i += BATCH_SIZE) {
  batches.push(ids.slice(i, i + BATCH_SIZE))
}

// Parallel abrufen: Mehrere kleinere Requests sind schneller als ein großer Request
const fetchedBatches = await Promise.all(
  batches.map(batch => fetchVectors(idx.host, apiKey, batch))
)

// Ergebnisse zusammenführen
const fetched: Record<string, { id: string; metadata?: Record<string, unknown> }> = {}
for (const batch of fetchedBatches) {
  Object.assign(fetched, batch)
}
```

**Konfiguration**:
- Umgebungsvariable: `CHAT_FETCH_BATCH_SIZE` (Standard: 20)
- Kann über `.env` angepasst werden

**Erwartete Verbesserung**: ~50% schneller (2902ms → ~1450ms)

---

### ✅ Dynamische Window-Größe (Implementiert)

**Problem**: Feste Window-Größe führte bei vielen Matches zu sehr vielen IDs.

**Lösung**:
- Window-Größe wird dynamisch basierend auf Anzahl der Matches angepasst
- Bei vielen Matches (>30): Window-Größe 1
- Bei mittleren Matches (>15): Window-Größe 2
- Sonst: Ursprüngliche Window-Größe basierend auf `answerLength`

**Code-Änderungen** (`src/lib/chat/retrievers/chunks.ts`):
```typescript
// Dynamische Window-Größe: Kleinere Window-Größe bei vielen Matches
const baseWindow = input.answerLength === 'ausführlich' ? 3 : input.answerLength === 'mittel' ? 2 : 1
const dynamicWindow = matches.length > 30 ? 1 : matches.length > 15 ? 2 : baseWindow
const windowByLength = Math.min(dynamicWindow, baseWindow) // Nicht größer als ursprünglich
```

**Erwartete Verbesserung**: ~30% weniger IDs → ~20% schneller

---

### ✅ Dynamisches Top-K (Implementiert)

**Problem**: Festes `baseTopK = 20` war nicht optimal für verschiedene Budgets.

**Lösung**:
- Top-K wird dynamisch basierend auf verfügbarem Budget berechnet
- Größeres Budget ermöglicht mehr Chunks

**Code-Änderungen** (`src/lib/chat/retrievers/chunks.ts`):
```typescript
// Dynamisches Top-K basierend auf Budget: Größeres Budget ermöglicht mehr Chunks
const baseTopK = budget > 50000 ? 30 : budget > 30000 ? 20 : 15
```

**Logik**:
- Budget > 50000: Top-K = 30
- Budget > 30000: Top-K = 20
- Sonst: Top-K = 15

**Erwartete Verbesserung**: ~10-15% schneller

---

## Performance-Verbesserungen: Zusammenfassung

### Vorher (gemessen)
- **Total Retrieval**: ~4600ms
- **Fetch Neighbors**: ~2902ms (64%)
- **Vector-Suche**: ~1187ms (26%)
- **Embedding**: ~514ms (11%)

### Nachher (geschätzt)
- **Total Retrieval**: ~2800-3200ms (~30-40% schneller)
- **Fetch Neighbors**: ~1450ms (~50% schneller durch Batching)
- **Vector-Suche**: ~1000-1070ms (~10-15% schneller durch dynamisches Top-K)
- **Embedding**: ~514ms (unverändert)

### Implementierte Features
1. ✅ Fetch Neighbors Batching mit Parallelisierung
2. ✅ Dynamische Window-Größe basierend auf Anzahl der Matches
3. ✅ Dynamisches Top-K basierend auf Budget
4. ✅ Konfigurierbare Batch-Größe über Umgebungsvariable

### Konfiguration

**Neue Umgebungsvariable**:
- `CHAT_FETCH_BATCH_SIZE`: Batch-Größe für Fetch Neighbors (Standard: 20)
  - Kann in `.env` gesetzt werden
  - Empfohlener Wert: 20-30 (abhängig von MongoDB-Performance)

---

## Monitoring & Testing

### Empfohlene Tests
1. **Unit-Tests**: Batching-Logik mit verschiedenen ID-Anzahlen
2. **Integration-Tests**: Gesamter Retrieval-Flow mit Timing-Messungen
3. **Edge-Cases**: 
   - Leere IDs-Liste
   - Sehr viele IDs (>100)
   - Einzelne ID
   - Batch-Größe größer als Anzahl der IDs

### Performance-Monitoring
- Timing-Daten werden bereits in `QueryRetrievalStep` gespeichert
- Empfehlung: Dashboard für Performance-Metriken erstellen
- Alerts bei langsamen Queries (>5s) einrichten

