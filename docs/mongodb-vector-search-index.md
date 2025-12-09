# MongoDB Atlas Vector Search Index - Token-Indexe für Facetten

## Problem

MongoDB Atlas Vector Search benötigt **Token-Indexe** für Array-Felder (wie `authors`, `speakers`, `tags`), wenn diese in Filtern mit `$in`-Operatoren verwendet werden.

**Fehler:** `Path 'authors' needs to be indexed as token`

## Lösung

### Für neue Indexe

Neue Vector Search Indexe werden automatisch mit allen benötigten Token-Indexen erstellt. Die folgenden Felder sind standardmäßig als Token-Indexe definiert:

**Basis-Filter-Felder (immer als Token-Indexe):**
- `kind` (Token) - Für Filterung nach Dokument-Typ
- `libraryId` (Token) - Für Filterung nach Library
- `user` (Token) - Für Filterung nach Benutzer
- `fileId` (Token) - Für Filterung nach Datei-ID (wird mit `$in` verwendet)

**Array-Facetten-Felder (dynamisch aus Facetten-Config):**
- `authors` (Token) - Wenn als Array-Facette (`type: 'string[]'`) definiert
- `speakers` (Token) - Wenn als Array-Facette definiert
- `tags` (Token) - Wenn als Array-Facette definiert
- `topics` (Token) - Wenn als Array-Facette definiert
- `speakers_image_url` (Token) - Wenn als Array-Facette definiert
- Weitere Array-Facetten aus der Library-Config werden automatisch hinzugefügt

### Für bestehende Indexe

Wenn Sie einen bestehenden Vector Search Index haben, müssen Sie ihn manuell aktualisieren:

#### Option 1: Index neu erstellen (empfohlen)

1. **Index löschen** (über MongoDB Atlas UI oder Shell):
   ```javascript
   db.collection.dropSearchIndex("vector_search_idx")
   ```

2. **Index wird automatisch neu erstellt** beim nächsten Aufruf von `getVectorCollection()` mit allen benötigten Token-Indexen.

#### Option 2: Index-Definition manuell aktualisieren

1. Gehen Sie zu MongoDB Atlas → Search → Indexes
2. Öffnen Sie den `vector_search_idx` Index
3. Fügen Sie die folgenden Felder als Token-Indexe hinzu:

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 1024,
        "similarity": "cosine"
      },
      "kind": {
        "type": "token"
      },
      "libraryId": {
        "type": "token"
      },
      "user": {
        "type": "token"
      },
      "authors": {
        "type": "token"
      },
      "speakers": {
        "type": "token"
      },
      "tags": {
        "type": "token"
      },
      "topics": {
        "type": "token"
      },
      "speakers_image_url": {
        "type": "token"
      },
      "track": {
        "type": "token"
      },
      "year": {
        "type": "number"
      },
      "region": {
        "type": "string"
      },
      "docType": {
        "type": "string"
      },
      "source": {
        "type": "string"
      },
      "date": {
        "type": "string"
      }
    }
  }
}
```

**WICHTIG:** 
- `libraryId` und `user` müssen als **Token-Indexe** definiert sein (nicht `string`), da sie in Filtern mit `$eq`-Operatoren verwendet werden
- **Alle String-Facetten** (wie `track`, `region`, `docType`, `source`, `date`) müssen als **Token-Indexe** definiert sein, da `buildFilterFromQuery` IMMER `$in` verwendet (auch bei einem Wert)
- MongoDB Vector Search benötigt Token-Indexe für **alle** Felder, die mit `$in` verwendet werden, unabhängig davon, ob das Feld selbst ein Array ist oder nicht

## Welche Felder benötigen Token-Indexe?

**Alle Filter-Felder**, die in Vector Search Filtern mit Operatoren (`$eq`, `$in`, etc.) verwendet werden:

**Basis-Filter-Felder (immer erforderlich):**
- `kind` - Dokument-Typ (chunk, meta, etc.)
- `libraryId` - Library-ID
- `user` - Benutzer-E-Mail

**Array-Facetten-Felder (dynamisch aus Facetten-Config):**
- `authors` - Array von Autoren
- `speakers` - Array von Sprechern
- `tags` - Array von Tags
- `topics` - Array von Topics
- `speakers_image_url` - Array von Bild-URLs
- Weitere Array-Facetten aus der Library-Config

**Hinweis:** MongoDB Atlas Vector Search benötigt Token-Indexe für **alle** Felder, die in Filtern verwendet werden, nicht nur für Array-Felder. 

**Warum String-Facetten Token-Indexe benötigen:**
- `buildFilterFromQuery` verwendet IMMER `$in` für String-Facetten (auch wenn nur ein Wert vorhanden ist)
- MongoDB Vector Search benötigt Token-Indexe für alle Felder, die mit `$in` verwendet werden
- Daher müssen alle String-Facetten (wie `track`, `region`, `docType`, `source`, `date`) als Token-Indexe definiert werden

**Beispiel:**
```typescript
// buildFilterFromQuery erstellt immer:
{ track: { $in: ["Developers"] } }  // Auch bei einem Wert!

// MongoDB benötigt daher:
{ track: { type: "token" } }  // Nicht "string"!
```

## Weitere Facetten-Felder

Wenn Sie zusätzliche Facetten-Felder in Ihrer Library-Konfiguration haben, die Array-Typen sind (`type: 'string[]'`), müssen diese ebenfalls als Token-Indexe hinzugefügt werden.

## Prüfung

Nach der Index-Aktualisierung können Sie testen, ob der Index korrekt funktioniert:

```javascript
// Test-Query mit authors-Filter
db.collection.aggregate([
  {
    $vectorSearch: {
      index: "vector_search_idx",
      path: "embedding",
      queryVector: [/* test vector */],
      numCandidates: 10,
      limit: 5,
      filter: {
        authors: { $in: ["Test Author"] }
      }
    }
  }
])
```

Wenn diese Query ohne Fehler funktioniert, ist der Index korrekt konfiguriert.

