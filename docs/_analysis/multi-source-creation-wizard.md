# Multi-Source Creation Wizard v2 - Analyse

## Problemstellung

Der aktuelle Creation Wizard unterstützt nur **eine einzige Quelle** pro Durchlauf. Nutzer müssen sich zu Beginn für eine Eingabemethode entscheiden (z.B. Audio, URL, Text, Datei), ohne zu wissen, welche Felder später abgefragt werden. Dies führt zu einer "Black-Box"-Erfahrung.

**Real-World-Szenario**: Ein Nutzer möchte eine Session erstellen:
1. Er liest zuerst eine Webseite aus (enthält Basis-Infos)
2. Dann diktiert er zusätzliche Details, die auf der Webseite fehlen
3. Er möchte beide Informationsquellen **kombinieren** und gemeinsam auswerten

**Kernproblem**: Aktuell kann der Wizard nur eine Quelle verarbeiten. Nach der ersten Quelle ist der Flow "zu Ende" - es gibt keine Möglichkeit, weitere Quellen hinzuzufügen.

## Varianten-Analyse

### Variante 1: Quellen sammeln, dann 1x auswerten
- **Ansatz**: Nutzer sammelt alle Quellen in einer Liste, klickt dann "Jetzt auswerten"
- **Vorteil**: Klar getrennte Phasen (Sammeln vs. Verarbeiten)
- **Nachteil**: Nutzer sieht erst am Ende, ob die Kombination sinnvoll ist

### Variante 2: Inkrementell mit Korpus-Truth (GEWÄHLT)
- **Ansatz**: Jede neue Quelle wird sofort verarbeitet, aber **immer mit dem gesamten bisherigen Quellen-Korpus**
- **Point-of-Truth**: Der gesamte Textkorpus aller Quellen
- **Vorteil**: Nutzer sieht sofort, wie neue Quellen die Metadaten beeinflussen; LLM entscheidet Konflikte durch Kontext
- **Nachteil**: Mehr API-Calls (aber notwendig für inkrementelles Feedback)

### Variante 3: Feld-gated (nur leere Felder füllen)
- **Ansatz**: Metafelder-Formular bleibt sichtbar; jede Quelle füllt nur leere/markierte Felder
- **Vorteil**: Sehr zielgerichtet
- **Nachteil**: Zu komplex für MVP, erfordert Feld-Mapping-Logik

## Entscheidung: Variante 2 (Korpus-Truth)

**Begründung**:
- Nutzer kann bewusst "Korrekturen" diktieren (z.B. "Der Titel ist eigentlich X, nicht Y")
- LLM sieht den gesamten Kontext und kann intelligent mergen
- Inkrementelles Feedback ist wichtig für UX
- Technisch sauber: Einheitlicher Datenfluss

## Datenmodell

### WizardSource Interface

```typescript
interface WizardSource {
  id: string                    // Eindeutige ID (z.B. UUID)
  kind: 'text' | 'url' | 'file'  // Quellen-Typ
  createdAt: Date               // Zeitstempel für Reihenfolge
  
  // Für 'text':
  text?: string                 // Der Text-Inhalt
  
  // Für 'url':
  url?: string                  // Original-URL
  rawWebsiteText?: string        // Rohtext für LLM (Point-of-Truth)
  summary?: string              // Lesbare Summary für UI
  
  // Für 'file':
  fileName?: string             // Dateiname
  extractedText?: string         // Extrahierter Text für LLM
  summary?: string              // Lesbare Summary für UI
}
```

### WizardState Erweiterung

```typescript
interface WizardState {
  // ... bestehende Felder ...
  sources: WizardSource[]       // Liste aller Quellen
  generatedDraft?: {            // Aktueller Draft (wird bei jeder Quelle neu generiert)
    metadata: Record<string, unknown>
    markdown: string
  }
}
```

## Korpus-Format (für LLM)

Der `combinedCorpusText` wird aus allen Quellen gebaut:

```
[Quelle: Text | 2025-12-13 10:42]
Hier ist der Text, den der Nutzer eingegeben hat...

[Quelle: Webseite | https://example.com/session]
...roher Webseiten-Text (rawWebsiteText)...

[Quelle: Datei | document.pdf]
...extrahierter Text aus PDF...
```

**Wichtig**: 
- Website/File nutzen **immer den Rohtext** (`rawWebsiteText`/`extractedText`), nicht die Summary
- Summary dient nur der UI-Darstellung
- Reihenfolge: chronologisch nach `createdAt`

## UX-Regeln

### Text-Quelle (tippen oder diktieren)
- **Einheitliches UI**: Großes Textfeld + Mikrofon-Button
- **Audio-Flow**: 
  1. Nutzer klickt Mic → Aufnahme startet
  2. Transkription läuft → Text erscheint im Feld
  3. Nutzer kann Text **editieren** (wichtig!)
  4. Nutzer klickt "Quelle hinzufügen" → Text wird als Source übernommen
- **Wichtig**: Nutzer sieht **immer** den Text, bevor er verarbeitet wird

### Webseiten-Quelle
- **UI zeigt**: Summary (strukturierte Daten als Key-Value-Block, optional Markdown-Auszug)
- **Verarbeitung nutzt**: `rawWebsiteText` (auch bei wiederholten Auswertungen)
- **Begründung**: Rohtext ist unleserlich für Nutzer, aber notwendig für LLM-Kontext

### Quellenliste
- **Anzeige**: Jede Quelle zeigt ihre Summary (Text: Auszug, Website/File: strukturierte Daten)
- **Aktionen**: 
  - Entfernen-Button → entfernt Quelle → triggert Re-Extract
  - "Weitere Quelle hinzufügen" → öffnet Eingabe-Dialog

## Re-Extract Mechanismus

### Trigger
- Nach erfolgreichem Hinzufügen einer Quelle
- Nach Entfernen einer Quelle

### Ablauf
1. `buildCorpusText(sources)` baut den Gesamtkorpus
2. `runExtraction(corpusText)` ruft `/api/secretary/process-text` auf
3. Response wird in `generatedDraft` gespeichert
4. UI aktualisiert sich automatisch (Review-Step zeigt neue Metadaten)

### API-Call Format

```typescript
POST /api/secretary/process-text
{
  text: combinedCorpusText,  // Gesamter Korpus mit Headern
  template: templateId,
  target_language: "de"
}
```

## Risiken & Guardrails

### Payload-Größe
- **Problem**: Website-Quelltext kann sehr groß sein (100k+ Zeichen)
- **MVP-Lösung**: 
  - Hard-Limit: max 500k Zeichen pro Korpus (warn Nutzer)
  - Truncate mit Hinweis: "Korpus wurde gekürzt, um API-Limit einzuhalten"
- **Zukünftige Lösung**: Serverseitige Source-Storage + nur IDs senden

### API-Latenz
- **Problem**: Re-Extract nach jeder Quelle kann langsam sein
- **Lösung**: 
  - Loading-State während Extraction
  - Optional: Debounce bei schnellen Add/Remove-Aktionen (z.B. 500ms)

### Konflikt-Handling
- **Aktuell**: LLM entscheidet durch Kontext (soft)
- **Phase 2**: Provenance-Tracking (`fieldProvenance: Record<string, 'ai'|'user'>`) für explizite User-Edits

## Technische Implementierung

### Dateien, die geändert werden müssen

1. **`src/components/creation-wizard/creation-wizard.tsx`**
   - WizardState erweitern: `sources[]`
   - `buildCorpusText(sources)` Funktion
   - `runExtraction(corpusText)` Funktion
   - State-Updates bei Add/Remove Source

2. **`src/components/creation-wizard/steps/collect-source-step.tsx`**
   - Text-Quelle: Textfeld + Mic-Button (unified)
   - URL-Quelle: zeigt Summary, speichert `rawWebsiteText`
   - Quellenliste-Komponente (neu)

3. **`src/lib/creation/corpus.ts`** (neu)
   - `buildCorpusText(sources)` Helper
   - `buildSourceSummary(source)` Helper (für UI)

4. **Tests**: `tests/unit/creation/corpus.test.ts`
   - Unit-Tests für Korpus-Builder
   - Tests für Add/Remove-Verhalten

## Mermaid: Datenfluss

```mermaid
flowchart TD
  userAddsSource[User_adds_source] --> sources[Wizard_sources[]]
  sources --> corpus[buildCorpusText_sources]
  corpus --> apiProcessText[/api/secretary/process-text]
  apiProcessText --> draft[generatedDraft_metadata_markdown]
  draft --> review[ReviewStep_edit]
  review --> save[Save_to_storage]
  sources -->|remove_source| corpus
  sources --> uiSummary[UI_Source_Summaries]
```

## Phase 2 (Optional, aber wichtig)

### Metadaten-Provenance
- Ziel: Tracken, welche Felder von User vs. KI gesetzt wurden
- Mechanismus:
  - `wizardState.fieldProvenance: Record<string, 'ai'|'user'>`
  - ReviewStep markiert geänderte Felder als `'user'`
  - Bei Re-Extract: bestehende Werte + Provenance als Context senden ("User-Edits bevorzugen")
  - Später: technisches Sperren von User-Edits möglich

## Zusammenfassung

**Kernentscheidung**: Korpus-basierte Multi-Source-Verarbeitung mit inkrementellem Re-Extract.

**Wichtigste UX-Änderung**: Text + Diktat werden zu einer Quelle zusammengeführt (Textfeld + Mic).

**Technischer Kern**: `buildCorpusText()` erstellt einen einheitlichen Textkorpus aus allen Quellen; dieser wird bei jeder Änderung neu an das LLM gesendet.





