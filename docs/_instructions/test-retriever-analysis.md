# Test-Anleitung: Retriever-Analyse

## 1. Schnelltest über die API

### Test 1: Unklare Frage (sollte `needs_clarification` zurückgeben)

```bash
curl -X POST "http://localhost:3000/api/chat/<libraryId>" \
  -H "Content-Type: application/json" \
  -H "X-User-Email: your-email@example.com" \
  -d '{"message":"Was gibt es?","answerLength":"mittel"}' | jq
```

**Erwartetes Ergebnis:**
```json
{
  "status": "needs_clarification",
  "analysis": {
    "explanation": "Ihre Frage ist zu allgemein...",
    "suggestedQuestions": {
      "chunk": "Gib mir Details zu: Was gibt es?",
      "summary": "Gib mir einen Überblick über: Was gibt es?"
    }
  }
}
```

### Test 2: Spezifische Chunk-Frage

```bash
curl -X POST "http://localhost:3000/api/chat/<libraryId>" \
  -H "Content-Type: application/json" \
  -H "X-User-Email: your-email@example.com" \
  -d '{"message":"Wie funktioniert die Funktion calculateScore()?","answerLength":"mittel"}' | jq '.status, .queryId'
```

**Erwartetes Ergebnis:**
- `status: "ok"`
- Normale Chat-Antwort
- Analyse-Ergebnis im Query-Log gespeichert

### Test 3: Breite Summary-Frage

```bash
curl -X POST "http://localhost:3000/api/chat/<libraryId>" \
  -H "Content-Type: application/json" \
  -H "X-User-Email: your-email@example.com" \
  -d '{"message":"Was sind die Hauptthemen aller Dokumente?","answerLength":"mittel"}' | jq '.status, .queryId'
```

## 2. Analyse-Ergebnisse im Query-Log prüfen

### Option A: Direkt in MongoDB

```javascript
// MongoDB Query
db.queries.find(
  { queryId: "<queryId>" },
  { questionAnalysis: 1, question: 1, retriever: 1, createdAt: 1 }
).pretty()
```

### Option B: Über API-Endpunkt (falls vorhanden)

```bash
curl "http://localhost:3000/api/chat/<libraryId>/queries/<queryId>/explain" | jq '.questionAnalysis'
```

## 3. Logs im Server-Log prüfen

Die Analyse-Logik gibt folgende Logs aus:

```bash
# Server-Logs anzeigen
tail -f logs/server.txt | grep "Frage-Analyse"

# Oder in der Konsole während Entwicklung
# Sollte zeigen:
# - Analyse-Ergebnisse (recommendation, confidence)
# - Fehler bei Analyse-Fehlern
```

## 4. Debugging-Tipps

### Analyse deaktivieren für Test

```bash
# Analyse deaktivieren
curl -X POST "http://localhost:3000/api/chat/<libraryId>?autoRetriever=false" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test","answerLength":"mittel"}'
```

### Expliziten Retriever erzwingen

```bash
# Chunk-Modus erzwingen
curl -X POST "http://localhost:3000/api/chat/<libraryId>?retriever=chunk" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test","answerLength":"mittel"}'

# Summary-Modus erzwingen
curl -X POST "http://localhost:3000/api/chat/<libraryId>?retriever=summary" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test","answerLength":"mittel"}'
```

## 5. Unit-Test für die Analyse-Funktion

```typescript
// tests/unit/question-analyzer.test.ts
import { describe, it, expect } from 'vitest'
import { analyzeQuestionForRetriever } from '@/lib/chat/common/question-analyzer'

describe('analyzeQuestionForRetriever', () => {
  it('sollte chunk für spezifische Fragen empfehlen', async () => {
    const result = await analyzeQuestionForRetriever('Wie funktioniert X?')
    expect(result.recommendation).toBe('chunk')
    expect(result.confidence).toBe('high')
  })

  it('sollte summary für breite Fragen empfehlen', async () => {
    const result = await analyzeQuestionForRetriever('Was sind die Hauptthemen?')
    expect(result.recommendation).toBe('summary')
  })

  it('sollte unclear für vage Fragen zurückgeben', async () => {
    const result = await analyzeQuestionForRetriever('Was gibt es?')
    expect(result.recommendation).toBe('unclear')
    expect(result.suggestedQuestionChunk).toBeDefined()
    expect(result.suggestedQuestionSummary).toBeDefined()
  })
})
```

## 6. Checkliste für Tests

- [ ] Unklare Frage → `needs_clarification` Response
- [ ] Spezifische Frage → Chunk-Modus verwendet
- [ ] Breite Frage → Summary-Modus verwendet
- [ ] Expliziter `?retriever=` Parameter überschreibt Analyse
- [ ] `?autoRetriever=false` deaktiviert Analyse
- [ ] Analyse-Ergebnisse werden im Query-Log gespeichert
- [ ] Bei Analyse-Fehler → Fallback auf Standard-Verhalten (chunk)
- [ ] Event-Modus wird korrekt berücksichtigt

## 7. Häufige Probleme

### Problem: Analyse wird nicht ausgeführt
**Lösung:** Prüfe ob `ENABLE_AUTO_RETRIEVER_ANALYSIS` nicht auf `false` gesetzt ist

### Problem: Immer 'chunk' Modus
**Lösung:** Prüfe ob `OPENAI_API_KEY` gesetzt ist und Analyse nicht fehlschlägt (siehe Server-Logs)

### Problem: Analyse zu langsam
**Lösung:** Prüfe `QUESTION_ANALYZER_MODEL` - kleineres Modell verwenden (z.B. `gpt-4o-mini`)

## 8. Monitoring

Um die Analyse-Performance zu überwachen:

```javascript
// MongoDB Aggregation: Wie oft wird welcher Modus empfohlen?
db.queries.aggregate([
  { $match: { questionAnalysis: { $exists: true } } },
  { $group: {
      _id: "$questionAnalysis.recommendation",
      count: { $sum: 1 },
      avgConfidence: { $avg: { $cond: [
        { $eq: ["$questionAnalysis.confidence", "high"] }, 1,
        { $cond: [
          { $eq: ["$questionAnalysis.confidence", "medium"] }, 0.5, 0
        ]}
      ]}}
    }
  }
])
```











