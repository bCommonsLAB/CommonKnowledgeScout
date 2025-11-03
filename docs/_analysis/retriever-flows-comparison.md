# Vergleich: Chunk-Flow vs. Summary-Flow

## Übersicht

Beide Flows verwenden jetzt den **Orchestrator** (`runChatOrchestrated`) für die gemeinsame LLM-Verarbeitung. Die Unterschiede liegen in der Retrieval-Phase, die durch spezifische Retriever-Implementierungen abgedeckt wird.

---

## Chunk-Flow (klassischer RAG)

### Spezifische Schritte (nur Chunk-Flow)

#### 1. **Embedding-Generierung** (`chunks.ts:19-22`)
- Frage wird in einen Vektor eingebettet
- **Zweck**: Semantische Suche in Pinecone

#### 2. **Parallele Vektor-Queries** (`chunks.ts:24-43`)
- **Chunk-Query**: Top-20 Chunks mit semantischer Ähnlichkeit
- **Summary-Query**: Top-10 Kapitel-Summaries (parallel, für Boost)
- **Zweck**: Initiale Kandidaten-Sammlung

#### 3. **Kapitel-Boost-Berechnung** (`chunks.ts:75-86`)
- Berechnet Boost-Werte für Kapitel basierend auf Summary-Query-Rankings
- Formel: `base (1.0) - i * step (0.05)` pro Kapitel
- **Zweck**: Chunks aus relevanten Kapiteln höher gewichten

#### 4. **Nachbarfenster-Extraktion** (`chunks.ts:91-100`)
- Bestimmt Kontext-Window (±w) basierend auf `answerLength`:
  - `ausführlich`: ±3 Chunks
  - `mittel`: ±2 Chunks
  - `kurz`: ±1 Chunk
- **Zweck**: Vollständige Kontext-Snippets für Top-Treffer

#### 5. **Fetch Neighbors** (`chunks.ts:101-104`)
- Lädt vollständige Metadaten für alle Nachbar-Chunks
- **Zweck**: Vollständige Text-Inhalte für Scoring

#### 6. **Scoring & Reranking** (`chunks.ts:106-133`)
- **Initial Score**: Vektor-Similarity-Score aus Query
- **Kapitel-Boost**: `score + (chapterAlpha * chapterBoost)` (wenn Kapitel gefunden)
- **Lexikalischer Boost**: 
  - +0.02 wenn Frage im Kapitel-Titel enthalten
  - +0.02 pro Keyword-Match (max. +0.06)
- **Finale Sortierung**: Nach boosted Score (absteigend)
- **Zweck**: Kombiniert semantische und lexikalische Signale

#### 7. **Budget-Akkumulation** (`chunks.ts:135-190`)
- Fügt Chunks sequenziell hinzu bis Budget erreicht
- **Budget**: Abhängig von `answerLength` (30k/90k/180k Zeichen)
- **Abbruch**: Wenn Budget überschritten wird (`break`)
- **Zweck**: Begrenzt Prompt-Größe

### Gemeinsame Schritte (Orchestrator)

#### 8. **Prompt-Building** (`orchestrator.ts:45`)
- Verwendet `buildPrompt()` mit Quellen und Antwortlänge
- **Hinweis**: Nur für Chunk-Flow: Wenn `usedInPrompt < candidatesCount`, wird Warnung hinzugefügt

#### 9. **LLM-Aufruf** (`orchestrator.ts:57-82`)
- Strukturierte JSON-Response erzwingen (`response_format: json_object`)
- **Retry-Logik**: Bei "maximum context length" Budget schrittweise reduzieren

#### 10. **Response-Parsing** (`orchestrator.ts:85-86`)
- Extrahiert `answer`, `suggestedQuestions`, `usedReferences`
- Verwendet `parseStructuredLLMResponse()`

#### 11. **Referenz-Filterung** (`orchestrator.ts:91-104`)
- Generiert vollständige Referenzen-Liste aus allen Quellen
- Filtert basierend auf `usedReferences` aus LLM-Response
- **Fallback**: Wenn keine `usedReferences`, zeige alle

#### 12. **Logging & Finalisierung** (`orchestrator.ts:106-112`)
- Speichert Antwort, Quellen, Referenzen, Timing
- Finalisiert Query-Log

---

## Summary-Flow (Dokument/Kapitel-Übersichten)

### Spezifische Schritte (nur Summary-Flow)

#### 1. **MongoDB-Abfrage** (`summaries-mongo.ts:53-56`)
- Lädt Dokument-Metadaten aus MongoDB
- **Filter**: Basierend auf `input.filters` (z.B. `libraryId`, `user`, etc.)
- **Optimierung**: Im Event-Modus werden `chapters` nicht geladen (`skipChapters: true`)

#### 2. **Modus-Entscheidung** (`summaries-mongo.ts:60`)
- Entscheidet zwischen `'chapters'` und `'docs'` Modus:
  - **Event-Modus**: Immer `'docs'` (nutzt `docMetaJson.summary`)
  - **Keine Chapters**: Immer `'docs'`
  - **Sonst**: Basierend auf Budget und Kapitel-Anzahl
- **Zweck**: Optimiert für verschiedene Dokument-Strukturen

#### 3. **Budget-Akkumulation (ohne Abbruch)** (`summaries-mongo.ts:68-101`)
- **WICHTIG**: Im Summary-Modus werden **ALLE** gefilterten Dokumente übernommen
- Budget wird nur als Warnung verwendet, nicht als harte Grenze
- **Zweck**: Vollständiger Überblick über alle relevanten Dokumente

### Gemeinsame Schritte (Orchestrator)

#### 4. **Prompt-Building** (`orchestrator.ts:45`)
- Gleiche Funktion wie Chunk-Flow
- **KEIN** Hinweis bei Budget-Überschreitung (weil alle Dokumente übernommen werden)

#### 5. **LLM-Aufruf** (`orchestrator.ts:57-82`)
- Identisch zu Chunk-Flow

#### 6. **Response-Parsing** (`orchestrator.ts:85-86`)
- Identisch zu Chunk-Flow

#### 7. **Referenz-Filterung** (`orchestrator.ts:91-104`)
- Identisch zu Chunk-Flow

#### 8. **Logging & Finalisierung** (`orchestrator.ts:106-112`)
- Identisch zu Chunk-Flow

---

## Vergleichsmatrix

| Schritt | Chunk-Flow | Summary-Flow | Gemeinsam |
|---------|-----------|--------------|-----------|
| **Embedding** | ✅ Ja | ❌ Nein | ❌ |
| **Vektor-Query** | ✅ Ja (Top-20) | ❌ Nein | ❌ |
| **Kapitel-Boost** | ✅ Ja | ❌ Nein | ❌ |
| **Nachbarfenster** | ✅ Ja (±w) | ❌ Nein | ❌ |
| **Fetch Neighbors** | ✅ Ja | ❌ Nein | ❌ |
| **Scoring & Reranking** | ✅ Ja (semantisch + lexikalisch) | ❌ Nein | ❌ |
| **MongoDB-Abfrage** | ❌ Nein | ✅ Ja | ❌ |
| **Modus-Entscheidung** | ❌ Nein | ✅ Ja (`chapters` vs `docs`) | ❌ |
| **Budget-Limitierung** | ✅ Ja (harte Grenze) | ❌ Nein (alle Dokumente) | ❌ |
| **Prompt-Building** | ✅ Ja | ✅ Ja | ✅ |
| **LLM-Aufruf** | ✅ Ja | ✅ Ja | ✅ |
| **Response-Parsing** | ✅ Ja | ✅ Ja | ✅ |
| **Referenz-Filterung** | ✅ Ja | ✅ Ja | ✅ |
| **Logging** | ✅ Ja | ✅ Ja | ✅ |

---

## Bestätigung: Chunk-Flow-Funktionalität erhalten

### ✅ Alle wichtigen Features bleiben erhalten:

1. **✅ Embedding**: Frage wird weiterhin eingebettet (`chunks.ts:19-22`)
2. **✅ Parallele Queries**: Chunk + Summary-Query laufen parallel (`chunks.ts:24-43`)
3. **✅ Kapitel-Boost**: Boost-Berechnung unverändert (`chunks.ts:75-86`)
4. **✅ Nachbarfenster**: ±w Window-Extraktion unverändert (`chunks.ts:91-100`)
5. **✅ Fetch Neighbors**: Vollständige Metadaten werden geladen (`chunks.ts:101-104`)
6. **✅ Scoring & Reranking**: 
   - Initial Score aus Vektor-Similarity (`chunks.ts:89`)
   - Kapitel-Boost (`chunks.ts:118-120`)
   - Lexikalischer Boost (`chunks.ts:122-130`)
   - Sortierung nach boosted Score (`chunks.ts:133`)
7. **✅ Budget-Akkumulation**: Sequenzielle Hinzufügung bis Budget (`chunks.ts:135-190`)

### 🔄 Was sich geändert hat (nur Struktur):

- **Vorher**: LLM-Aufruf und Parsing direkt in `route.ts`
- **Nachher**: LLM-Aufruf und Parsing im Orchestrator (`orchestrator.ts`)
- **Ergebnis**: Gleiche Funktionalität, aber zentralisiert und wiederverwendbar

---

## Code-Flow-Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│                    API Route (route.ts)                     │
│  - Auth, Validierung, Filter-Parsing                        │
│  - Retriever-Analyse (optional)                            │
│  - Retriever-Auswahl (chunk/summary)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Orchestrator (orchestrator.ts)                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Retriever-Auswahl                                  │  │
│  │  - chunksRetriever (für chunk)                      │  │
│  │  - summariesMongoRetriever (für summary)            │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                       │
│                     ▼                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  SPECIFISCHE RETRIEVAL-PHASE                        │  │
│  │                                                      │  │
│  │  ┌─────────────────┐    ┌──────────────────────┐   │  │
│  │  │ Chunk-Flow      │    │ Summary-Flow         │   │  │
│  │  │                 │    │                      │   │  │
│  │  │ • Embedding     │    │ • MongoDB-Abfrage    │   │  │
│  │  │ • Vektor-Query  │    │ • Modus-Entscheidung │   │  │
│  │  │ • Kapitel-Boost │    │ • Alle Dokumente     │   │  │
│  │  │ • Nachbarn      │    │                      │   │  │
│  │  │ • Scoring       │    │                      │   │  │
│  │  │ • Reranking     │    │                      │   │  │
│  │  │ • Budget-Limit  │    │                      │   │  │
│  │  └─────────────────┘    └──────────────────────┘   │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                     │                                       │
│                     ▼                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  GEMEINSAME LLM-PHASE                               │  │
│  │                                                      │  │
│  │  • Prompt-Building                                   │  │
│  │  • LLM-Aufruf (mit Retry)                           │  │
│  │  • Response-Parsing (strukturiert)                  │  │
│  │  • Referenz-Filterung                                │  │
│  │  • Logging & Finalisierung                           │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Zusammenfassung

### Gemeinsame Schritte (Orchestrator):
1. Prompt-Building
2. LLM-Aufruf mit strukturierter JSON-Response
3. Response-Parsing (`answer`, `suggestedQuestions`, `usedReferences`)
4. Referenz-Filterung basierend auf `usedReferences`
5. Logging & Finalisierung

### Spezifische Schritte:

**Chunk-Flow:**
- Embedding, Vektor-Query, Kapitel-Boost, Nachbarfenster, Scoring, Reranking
- **Zweck**: Präzise, semantische Suche mit Kontext

**Summary-Flow:**
- MongoDB-Abfrage, Modus-Entscheidung, alle Dokumente übernehmen
- **Zweck**: Überblick über alle relevanten Dokumente/Kapitel

### ✅ Bestätigung:
**Die Funktionalität des Chunk-Flows bleibt vollständig erhalten.** Alle Scoring-, Reranking- und Boost-Mechanismen wurden unverändert aus der Route in den `chunksRetriever` verschoben. Die einzige Änderung ist die Zentralisierung der LLM-Verarbeitung im Orchestrator.



