# Chat-Antwort-Generierung: Prozess-Analyse

## Übersicht

Dieses Dokument beschreibt den vollständigen Ablauf der Chat-Antwort-Generierung in der CommonKnowledgeScout-Anwendung.

## Haupt-Endpoint

**POST** `/api/chat/[libraryId]/stream`

Dieser Endpoint verwendet Server-Sent Events (SSE) für Streaming von Status-Updates während der Antwortgenerierung.

## Verarbeitungsschritte

### Phase 1: Initialisierung & Validierung

**Schritt 1.1: Authentifizierung & Bibliotheks-Kontext laden**
- Prüfung der Authentifizierung (optional für öffentliche Libraries)
- Laden des Library-Kontexts via `loadLibraryChatContext()`
- Unterstützt sowohl authentifizierte als auch anonyme Benutzer (für öffentliche Libraries)
- Prüfung, ob Library öffentlich ist oder Authentifizierung erforderlich

**Schritt 1.2: Request-Validierung**
- Validierung des Request-Bodys mit Zod-Schema
- Extraktion der Parameter: `message`, `answerLength`, `chatHistory`, `chatId`
- Parsen der Query-Parameter aus der URL

**Schritt 1.3: Facetten-Filter extrahieren**
- Parsen der Facetten-Definitionen aus der Library
- Extraktion der ausgewählten Facetten aus Query-Parametern
- Filtern von Chat-Konfigurations-Parametern (retriever, targetLanguage, etc.)

### Phase 2: Intelligente Frage-Analyse

**Schritt 2.1: Frage-Analyse starten**
- Event: `question_analysis_start`
- Prüfung, ob automatische Retriever-Analyse aktiviert ist
- Prüfung, ob expliziter Retriever gesetzt wurde

**Schritt 2.2: Automatische Retriever-Empfehlung** (optional)
- Aufruf von `analyzeQuestionForRetriever()` wenn aktiviert
- Analyse der Frage, um den besten Retriever zu empfehlen:
  - `'chunk'`: Für spezifische, detaillierte Fragen
  - `'summary'`: Für überblicksartige Fragen
  - `'unclear'`: Wenn die Frage unklar ist (löst Clarification-Flow aus)
- Event: `question_analysis_result` mit Empfehlung und Confidence-Level

**Schritt 2.3: Clarification-Flow** (falls Frage unklar)
- Wenn `recommendation === 'unclear'`:
  - Senden von vorgeschlagenen Präzisierungsfragen
  - Event: `complete` mit `clarification`-Flag
  - Prozess endet hier

### Phase 3: Chat-Verwaltung

**Schritt 3.1: Chat erstellen oder laden**
- Wenn kein `chatId` vorhanden: Erstellen eines neuen Chats
  - Chat-Titel: Von Frage-Analyse oder erste 60 Zeichen der Frage
- Wenn `chatId` vorhanden: Laden des bestehenden Chats
  - Prüfung, ob Chat existiert
  - `touchChat()`: Aktualisierung des Last-Access-Zeitstempels

### Phase 4: Retriever-Auswahl

**Schritt 4.1: Effektiven Retriever bestimmen**
- Priorität:
  1. Explizit gesetzter Retriever (Query-Parameter)
  2. Von Frage-Analyse empfohlener Retriever
  3. Standard: `'chunk'`
- Event: `retriever_selected` mit Retriever und Begründung

**Schritt 4.2: Chat-Konfiguration bestimmen**
- Zusammenführen von:
  - Library-Standard-Konfiguration
  - Query-Parameter (targetLanguage, character, socialContext)
- Validierung der Parameter-Werte

### Phase 5: Filter-Aufbau

**Schritt 5.1: Filter erstellen**
- Aufruf von `buildFilters()` mit:
  - Query-Parametern
  - Library-Kontext
  - User-Email (leer für anonyme Benutzer)
  - Library-ID
  - Effektivem Retriever
- Generierung von:
  - Normalisierten Filtern (für MongoDB)
  - Pinecone-Filtern (für Vector-Search)
- Bestimmung des Modus: `'summaries'` oder `'chunks'`

### Phase 6: Query-Logging starten

**Schritt 6.1: Query-Log erstellen**
- Aufruf von `startQueryLog()` mit allen relevanten Parametern:
  - Library-ID, Chat-ID, User-Email
  - Frage, Modus, Query-Type (TOC oder Frage)
  - Retriever, Chat-Konfiguration
  - Facetten-Filter, normalisierte Filter, Pinecone-Filter
- Speicherung der Frage-Analyse-Ergebnisse (falls vorhanden)

### Phase 7: Retrieval (Quellensuche)

**Schritt 7.1: Retrieval starten**
- Event: `retrieval_start`
- Event: `llm_start` (für spätere Verwendung)
- Auswahl des Retriever-Implementierung:
  - `summariesMongoRetriever`: Für Summary-Modus
  - `chunksRetriever`: Für Chunk-Modus

**Schritt 7.2: Vector-Search ausführen**
- Aufruf von `retrieverImpl.retrieve()`
- Event: `retrieval_progress` während der Suche
- Status-Updates: "Suche nach relevanten Quellen..."
- Rückgabe von:
  - `sources`: Array von gefundenen Quellen
  - `stats`: Statistik-Informationen (candidatesCount, usedInPrompt, etc.)

**Schritt 7.3: Retrieval-Ergebnisse verarbeiten**
- Event: `retrieval_complete` mit Anzahl der Quellen und Timing
- Prüfung: Wenn keine Quellen gefunden → Früher Abbruch
- Logging der Query-Steps (für Chunk-Modus)

### Phase 8: Prompt-Erstellung

**Schritt 8.1: Prompt bauen**
- Status-Update: "Erstelle Prompt..."
- Aufruf von `buildPrompt()` mit:
  - Frage
  - Gefundene Quellen
  - Antwortlänge (normalisiert: 'unbegrenzt' → 'ausführlich')
  - Chat-Konfiguration (Sprache, Charakter, sozialer Kontext, Gender-Inclusive)
  - Chat-Historie (falls vorhanden)
  - Facetten-Filter (für Kontext im Prompt)
- Hinweis hinzufügen (nur Chunk-Modus): Wenn weniger Dokumente verwendet wurden als gefunden

**Schritt 8.2: Prompt-Logging**
- Speicherung des Prompts in der Datenbank
- Event: `prompt_complete` mit:
  - Prompt-Länge
  - Anzahl der verwendeten Dokumente
  - Geschätzte Token-Anzahl

### Phase 9: LLM-Aufruf

**Schritt 9.1: API-Key bestimmen**
- Priorität:
  1. Public API-Key (aus Library-Konfiguration)
  2. Globaler API-Key (aus Umgebungsvariablen)
- Modell: `OPENAI_CHAT_MODEL_NAME` oder Standard: `'gpt-4o-mini'`
- Temperatur: `OPENAI_CHAT_TEMPERATURE` oder Standard: `0.3`

**Schritt 9.2: OpenAI-API aufrufen**
- Status-Update: "Generiere Antwort..."
- Aufruf von `callOpenAI()` mit Modell, Temperatur, Prompt und API-Key
- Parsen der Response mit Token-Usage-Informationen

**Schritt 9.3: Fehlerbehandlung bei Context-Length-Überschreitung**
- Wenn `maximum context length` Fehler:
  - Automatische Retry-Logik mit reduzierten Budgets
  - Reduzierung der Quellen nach Budget
  - Neuer Prompt mit reduzierten Quellen und 'kurz' Antwortlänge
  - Wiederholung des LLM-Aufrufs

**Schritt 9.4: LLM-Complete**
- Event: `llm_complete` mit:
  - Timing (LLM-Millisekunden)
  - Prompt-Tokens
  - Completion-Tokens
  - Total-Tokens

### Phase 10: Antwort-Verarbeitung

**Schritt 10.1: Strukturierte Response parsen**
- Status-Update: "Verarbeite Antwort..."
- Aufruf von `parseStructuredLLMResponse()`:
  - Extraktion der Antwort
  - Extraktion der vorgeschlagenen Fragen
  - Extraktion der verwendeten Referenzen (Nummern)

**Schritt 10.2: Referenzen aufbauen**
- Generierung einer vollständigen Referenzen-Liste aus allen Quellen
- Mapping der tatsächlich verwendeten Referenzen (falls vorhanden)
- Fallback: Alle Referenzen anzeigen, wenn keine explizit verwendet wurden

**Schritt 10.3: Query-Log finalisieren**
- Aufruf von `finalizeQueryLog()` mit:
  - Antwort
  - Quellen (mit Metadaten)
  - Referenzen
  - Vorgeschlagene Fragen
  - Timing-Informationen
  - Token-Usage

### Phase 11: Finalisierung

**Schritt 11.1: Complete-Event senden**
- Event: `complete` mit:
  - Antwort
  - Referenzen
  - Vorgeschlagene Fragen
  - Query-ID
  - Chat-ID

**Schritt 11.2: Processing-Logs speichern**
- Speicherung aller Processing-Steps in der Datenbank
- Stream schließen

## Retriever-Implementierungen

### Summary-Retriever (`summariesMongoRetriever`)
- Sucht in MongoDB nach Summary-Dokumenten
- Filtert nach Facetten und anderen Filtern
- Sortiert nach Relevanz
- Gibt alle passenden Dokumente zurück

### Chunk-Retriever (`chunksRetriever`)
- Nutzt Vector-Search in Pinecone
- Sucht nach semantisch ähnlichen Text-Chunks
- Filtert nach Metadaten (Facetten, etc.)
- Gibt Top-K relevanteste Chunks zurück
- Kann Quellen nach Budget reduzieren

## Processing-Events (SSE)

Die folgenden Events werden während der Verarbeitung gesendet:

1. `question_analysis_start` - Frage-Analyse beginnt
2. `question_analysis_result` - Analyse-Ergebnis mit Empfehlung
3. `retriever_selected` - Retriever wurde ausgewählt
4. `retrieval_start` - Retrieval beginnt
5. `retrieval_progress` - Fortschritt beim Retrieval
6. `retrieval_complete` - Retrieval abgeschlossen
7. `prompt_complete` - Prompt erstellt
8. `llm_start` - LLM-Aufruf beginnt
9. `llm_progress` - Fortschritt beim LLM-Aufruf
10. `llm_complete` - LLM-Aufruf abgeschlossen
11. `parsing_response` - Antwort wird verarbeitet
12. `complete` - Vollständige Antwort bereit
13. `error` - Fehler aufgetreten

## Fehlerbehandlung

- **Keine Quellen gefunden**: Früher Abbruch mit entsprechender Nachricht
- **Context-Length-Überschreitung**: Automatische Retry-Logik mit reduzierten Budgets
- **API-Fehler**: Fehler-Event wird gesendet, Query-Log wird aktualisiert
- **Ungültige Anfrage**: Validierungsfehler wird zurückgegeben

## Performance-Metriken

- **Retrieval-Zeit**: Gemessen von Retrieval-Start bis Ende
- **LLM-Zeit**: Gemessen von LLM-Aufruf bis Response-Parsing
- **Token-Usage**: Prompt-Tokens, Completion-Tokens, Total-Tokens
- **Query-Logging**: Alle Schritte werden in der Datenbank gespeichert

## Besonderheiten

- **Öffentliche Libraries**: Unterstützung für anonyme Benutzer mit Public API-Key
- **TOC-Fragen**: Spezielle Behandlung für Inhaltsverzeichnis-Fragen
- **Chat-Historie**: Kontext aus vorherigen Fragen/Antworten wird im Prompt verwendet
- **Facetten-Filter**: Werden sowohl für Retrieval als auch für Prompt-Kontext verwendet
- **Gender-Inclusive**: Optionale geschlechtsneutrale Formulierungen in Antworten





