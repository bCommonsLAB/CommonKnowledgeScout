# Batch Session Import

## Übersicht

Das Session Import Modal wurde um eine Batch-Import-Funktion erweitert, die es ermöglicht, mehrere Sessions gleichzeitig von einer Übersichtsseite zu importieren.

## Features

### Single Import (Einzelimport)
- Import einer einzelnen Session von einer spezifischen URL
- Vorschau der extrahierten Daten vor dem Speichern
- Auswahl von Quell- und Zielsprache

### Batch Import (Massenimport)
- Import mehrerer Sessions von einer Übersichtsseite
- Automatische Extraktion aller Session-Links mit Track-Informationen
- Übernahme globaler Event-Informationen für alle Sessions
- Track-Informationen aus der Liste haben Vorrang vor extrahierten Daten
- Sequenzieller Import mit Fortschrittsanzeige
- Status-Tracking für jede Session (ausstehend, importierend, erfolgreich, fehlgeschlagen)
- Fehlerbehandlung mit detaillierten Fehlermeldungen pro Session

## Technische Implementierung

### UI-Komponente
Die `SessionImportModal` Komponente wurde erweitert mit:
- Tab-Navigation zwischen Single und Batch Import
- Separater State für Batch-Operationen
- Progress-Bar für Import-Fortschritt
- ScrollArea für lange Session-Listen

### API-Integration

#### Single Import
```typescript
await importSessionFromUrl(url, {
  sourceLanguage,
  targetLanguage,
  template: 'ExtractSessiondataFromWebsite',
  useCache: false
});
```

#### Batch Import
1. **Session-Liste extrahieren:**
```typescript
await importSessionFromUrl(batchUrl, {
  sourceLanguage: batchSourceLanguage,
  targetLanguage: batchTargetLanguage,
  template: 'ExtractSessionListFromWebsite', // Spezielles Template für Listen
  useCache: false
});
```

2. **Einzelne Sessions importieren:**
- Iteriert über alle gefundenen Session-Links
- Ruft für jede URL `ExtractSessiondataFromWebsite` auf
- Erstellt Sessions über `/api/sessions` Endpoint

### Secretary Service Templates

#### ExtractSessiondataFromWebsite
- Extrahiert detaillierte Session-Informationen von einer einzelnen Seite
- Rückgabe: `StructuredSessionData` Objekt

#### ExtractSessionListFromWebsite (NEU)
- Extrahiert eine Liste von Session-Links von einer Übersichtsseite
- Erwartete Rückgabe-Struktur:
  ```typescript
  // Bevorzugtes Format mit globalem Event und Track-Informationen
  {
    "event": "2024 - SFSCON",
    "sessions": [
      {
        "track": "Main Track",
        "title": "Opening SFSCON 2024",
        "url": "https://www.sfscon.it/talks/opening-sfscon-2024/"
      },
      {
        "track": "Main Track", 
        "title": "Greetings",
        "url": "https://www.sfscon.it/talks/greetings-from-noi/"
      }
    ]
  }
  
  // Alternative Formate werden auch unterstützt:
  // Option 1: Array direkt
  [
    { name: "Session 1", url: "https://..." },
    { name: "Session 2", url: "https://..." }
  ]
  
  // Option 2: Objekt mit sessions Array (ohne globales Event)
  {
    sessions: [
      { name: "Session 1", url: "https://..." },
      { name: "Session 2", url: "https://..." }
    ]
  }
  ```

## Benutzerführung

### Batch Import Workflow
1. Benutzer wählt "Batch-Import" Tab
2. Gibt URL der Session-Übersichtsseite ein
3. Wählt Quell- und Zielsprache
4. Klickt "Session-Liste laden"
5. System zeigt gefundene Sessions mit Namen und URLs
6. Benutzer kann Liste überprüfen oder zurücksetzen
7. Klickt "X Sessions importieren"
8. System importiert Sessions sequenziell mit visueller Statusanzeige
9. Nach Abschluss: Zusammenfassung und automatisches Schließen

### Fehlerbehandlung
- Validierung von URLs vor dem Import
- Detaillierte Fehlermeldungen pro Session
- Import wird bei Fehlern fortgesetzt (kein Abbruch)
- Zusammenfassung zeigt Anzahl erfolgreicher/fehlgeschlagener Imports

## Konfiguration

### Timeouts und Limits
- 1 Sekunde Pause zwischen Session-Imports (Rate Limiting)
- Automatisches Schließen nach 2 Sekunden bei erfolgreichem Batch-Import

### Secretary Service Anforderungen
Das Secretary Service Backend muss das neue Template `ExtractSessionListFromWebsite` implementieren, das:
- Eine Webseite nach Session-Links durchsucht
- Session-Namen und URLs extrahiert
- Optional: Globale Event-Informationen extrahiert
- Optional: Track-Informationen pro Session extrahiert
- Die Daten in einem der unterstützten Formate zurückgibt

### Daten-Hierarchie beim Import
Beim Batch-Import gilt folgende Prioritätsreihenfolge für Datenfelder:
1. **Event**: Globales Event aus der Batch-Liste > Event aus einzelner Session
2. **Track**: Track aus der Batch-Liste > Track aus einzelner Session
3. **Andere Felder**: Werden aus der einzelnen Session-Seite extrahiert 