# Beispiel: Creation-Block für Session-Template

## Empfohlene Konfiguration

```yaml
creation:
  supportedSources:
    - id: spoken
      type: spoken
      label: "Ich erzähle kurz über die Session"
      helpText: "Beschreibe frei, worum es in der Session geht, wer spricht und wann sie stattfindet."
    - id: url
      type: url
      label: "Event- oder Session-URL"
      helpText: "Füge einen Link zur Event-Seite, Session-Seite oder Slides ein. Wir analysieren die Seite automatisch."
    - id: text
      type: text
      label: "Text einfügen"
      helpText: "Füge hier Text ein, z.B. aus einer E-Mail, einem Dokument oder Notizen."
    - id: file
      type: file
      label: "Datei hochladen"
      helpText: "Lade Slides, PDFs oder andere Dokumente hoch, die Informationen zur Session enthalten."
  flow:
    steps:
      - id: chooseSource
        preset: chooseSource
        title: "Wie möchtest du die Session-Informationen eingeben?"
        description: "Wähle eine der Optionen aus, um zu beginnen."
      - id: collectSource
        preset: collectSource
        title: "Session-Informationen eingeben"
        description: "Gib die Informationen zur Session ein oder lade eine Datei hoch."
      - id: generateDraft
        preset: generateDraft
        title: "Session-Daten werden generiert"
        description: "Wir analysieren deine Eingabe und erstellen strukturierte Session-Daten."
      - id: reviewEssential
        preset: reviewFields
        title: "Wichtige Felder überprüfen"
        description: "Bitte überprüfe und korrigiere die wichtigsten Felder."
        fields:
          - title
          - summary
          - date
          - starttime
          - endtime
          - location
          - speakers
      - id: reviewOptional
        preset: reviewFields
        title: "Optionale Felder bearbeiten"
        description: "Du kannst diese Felder jetzt bearbeiten oder später überspringen."
        fields:
          - shortTitle
          - teaser
          - affiliations
          - tags
          - topics
          - event
          - track
          - session
          - url
          - video_url
          - slides
```

## Erklärung der Konfiguration

### supportedSources

1. **spoken** (Gesprochen):
   - Für schnelle Eingabe per Sprache
   - User kann frei erzählen, was er über die Session weiß
   - LLM extrahiert strukturierte Daten daraus

2. **url** (URL):
   - Für Event-Seiten, Session-Seiten, Slides-Links
   - Automatisches Scraping und Analyse der Webseite
   - Sehr praktisch für Konferenz-Sessions

3. **text** (Text):
   - Für Copy-Paste aus E-Mails, Dokumenten, Notizen
   - Flexibel für verschiedene Textquellen

4. **file** (Datei):
   - Für Slides (PDF), Dokumente, Notizen
   - Automatische Extraktion aus PDFs

### Flow Steps

1. **chooseSource**: 
   - User wählt Input-Quelle
   - Klare Auswahl mit Icons und Beschreibungen

2. **collectSource**:
   - User gibt Input ein (je nach Quelle: Text, URL, Datei, Sprache)
   - Kontextuelle Hilfe je nach gewählter Quelle

3. **generateDraft**:
   - LLM analysiert Input und generiert strukturierte Daten
   - Loading-State mit Fortschrittsanzeige

4. **reviewEssential**:
   - Wichtigste Felder zuerst überprüfen
   - Fokus auf: Titel, Zusammenfassung, Zeit, Ort, Sprecher
   - Diese Felder sind kritisch für die Session

5. **reviewOptional**:
   - Optionale Felder können bearbeitet werden
   - User kann auch überspringen
   - Enthält: Tags, Topics, URLs, Slides, etc.

## Alternative: Vereinfachte Version

Falls der Flow zu lang ist, kann man auch eine kürzere Version verwenden:

```yaml
creation:
  supportedSources:
    - id: spoken
      type: spoken
      label: "Ich erzähle kurz über die Session"
    - id: url
      type: url
      label: "Event- oder Session-URL"
    - id: text
      type: text
      label: "Text einfügen"
  flow:
    steps:
      - id: chooseSource
        preset: chooseSource
      - id: collectSource
        preset: collectSource
      - id: generateDraft
        preset: generateDraft
      - id: reviewAll
        preset: reviewFields
        title: "Session-Daten überprüfen"
        description: "Überprüfe und bearbeite die generierten Daten."
        fields:
          - title
          - summary
          - date
          - starttime
          - endtime
          - location
          - speakers
          - shortTitle
          - teaser
          - tags
          - topics
          - event
          - url
```

## Felder, die NICHT im Review-Step sein sollten

Diese Felder werden automatisch generiert oder sind technisch und sollten nicht im Wizard erscheinen:

- `slug`: Wird automatisch aus `title` generiert
- `template`: Wird automatisch gesetzt
- `language`: Wird automatisch erkannt
- `cache_key`: Technisches Feld
- `speakers_url`, `speakers_image_url`: Können später ergänzt werden
- `attachments_url`: Wird automatisch gesetzt
- `video_transcript`: Wird automatisch generiert, wenn Video vorhanden

## Empfehlung

**Verwende die erste Version mit zwei Review-Steps**, weil:
1. User wird nicht überfordert (wichtige Felder zuerst)
2. Bessere UX (schrittweise Bearbeitung)
3. Optionale Felder können übersprungen werden
4. Klare Trennung zwischen essentiellen und optionalen Daten









