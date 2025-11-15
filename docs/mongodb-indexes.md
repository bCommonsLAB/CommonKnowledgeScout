# MongoDB Indexe für QueryLog Collection

## Übersicht

Die `queries` Collection verwendet mehrere optimierte Indexe für schnelle Cache-Abfragen.

## Indexe

### Basis-Indexe
- `queryId_unique`: Eindeutiger Index auf `queryId`
- `library_createdAt_desc`: Index auf `libraryId` und `createdAt` (absteigend)
- `user_createdAt_desc`: Index auf `userEmail` und `createdAt` (absteigend)
- `sessionId_createdAt_desc`: Index auf `sessionId` und `createdAt` (absteigend)
- `chatId_createdAt_desc`: Index auf `chatId` und `createdAt` (absteigend)

### Cache-Lookup-Indexe (für TOC-Cache-Abfragen)

#### Für authentifizierte Nutzer
- `cache_lookup_user_toc`: Zusammengesetzter Index für vollständige Cache-Abfragen
  - Felder: `libraryId`, `question`, `userEmail`, `queryType`, `status`, `targetLanguage`, `character`, `socialContext`, `genderInclusive`, `retriever`, `createdAt`
  - Partial Filter: Nur für Dokumente mit `userEmail`

- `cache_lookup_user_basic`: Fallback-Index für Basis-Abfragen
  - Felder: `libraryId`, `question`, `userEmail`, `queryType`, `status`, `createdAt`
  - Partial Filter: Nur für Dokumente mit `userEmail`

#### Für anonyme Nutzer
- `cache_lookup_session_toc`: Zusammengesetzter Index für vollständige Cache-Abfragen
  - Felder: `libraryId`, `question`, `sessionId`, `queryType`, `status`, `targetLanguage`, `character`, `socialContext`, `genderInclusive`, `retriever`, `createdAt`
  - Partial Filter: Nur für Dokumente mit `sessionId`

- `cache_lookup_session_basic`: Fallback-Index für Basis-Abfragen
  - Felder: `libraryId`, `question`, `sessionId`, `queryType`, `status`, `createdAt`
  - Partial Filter: Nur für Dokumente mit `sessionId`

## Index-Überprüfung

### Indexe in MongoDB anzeigen
```javascript
// In MongoDB Shell oder Compass
db.queries.getIndexes()
```

### Index-Performance prüfen
```javascript
// Erkläre eine Query, um zu sehen, welche Indexe verwendet werden
db.queries.find({
  libraryId: "...",
  question: "...",
  userEmail: "...",
  queryType: "toc",
  status: { $in: ["ok", "pending"] }
}).sort({ createdAt: -1 }).limit(1).explain("executionStats")
```

### Index-Statistiken anzeigen
```javascript
// Zeige Statistiken für alle Indexe
db.queries.aggregate([{ $indexStats: {} }])
```

## Performance-Optimierung

Die Cache-Abfragen verwenden:
1. Zusammengesetzte Indexe mit den häufigsten Filter-Feldern
2. Partial Filter Expressions, um Index-Größe zu reduzieren
3. `limit(50)` in der Query, um die Anzahl der geladenen Dokumente zu begrenzen
4. Sortierung nach `createdAt: -1` für neueste Ergebnisse zuerst

## Wartung

Die Indexe werden automatisch beim ersten Zugriff auf die Collection erstellt. Falls Indexe manuell erstellt werden müssen:

```javascript
// In MongoDB Shell
db.queries.createIndex(
  { 
    libraryId: 1, 
    question: 1, 
    userEmail: 1, 
    queryType: 1, 
    status: 1, 
    targetLanguage: 1,
    character: 1,
    socialContext: 1,
    genderInclusive: 1,
    retriever: 1,
    createdAt: -1 
  }, 
  { 
    name: 'cache_lookup_user_toc',
    partialFilterExpression: { userEmail: { $exists: true } }
  }
)
```









