# Test-Checkliste: Generischer Creation-Flow

## Übersicht

Diese Checkliste dokumentiert die Test-Szenarien für die implementierten Features des generischen Creation-Flow-Systems.

## Phase 1-3: Template-Schema & Parser ✅

### Test 1: Template-Parsing
**Ziel**: Prüfen, ob Templates korrekt geparst werden

**Schritte**:
1. Template-Datei mit Frontmatter, Body und systemprompt erstellen
2. `parseTemplateContent()` aufrufen
3. Prüfen, ob `ParsedTemplate` korrekt erstellt wurde:
   - `metadata.fields` enthält alle Frontmatter-Felder
   - `systemprompt` korrekt extrahiert
   - `markdownBody` korrekt extrahiert

**Erwartetes Ergebnis**: 
- Template wird korrekt in drei Bereiche aufgeteilt
- Alle Felder werden erkannt

### Test 2: Creation-Block Parsing
**Ziel**: Prüfen, ob creation-Block aus Frontmatter extrahiert wird

**Schritte**:
1. Template mit creation-Block im Frontmatter erstellen:
   ```yaml
   ---
   title: {{title|Test}}
   creation:
     supportedSources:
       - id: spoken
         type: spoken
         label: "Gesprochen"
     flow:
       steps:
         - id: chooseSource
           preset: chooseSource
   ---
   ```
2. `parseTemplateContent()` aufrufen
3. Prüfen, ob `template.creation` korrekt gefüllt ist

**Erwartetes Ergebnis**:
- `creation.supportedSources` enthält die definierten Quellen
- `creation.flow.steps` enthält die definierten Steps

### Test 3: TemplateService Views
**Ziel**: Prüfen, ob Views korrekt erstellt werden

**Schritte**:
1. Template mit creation-Block parsen
2. `getUxConfig(template)` aufrufen
3. `getPromptConfig(template)` aufrufen
4. Prüfen:
   - `UxConfig` enthält nur `creation`-Daten
   - `PromptConfig` enthält KEINE `creation`-Daten
   - Beide Views haben korrekte `templateId`

**Erwartetes Ergebnis**:
- Views sind korrekt getrennt
- PromptConfig enthält keine UX-spezifischen Daten

## Phase 4: Template-Management-UI ✅

### Test 4: Creation-Flow Tab im Editor
**Ziel**: Prüfen, ob Creation-Flow im Template-Editor bearbeitet werden kann

**Schritte**:
1. Template-Management öffnen
2. Template mit creation-Block auswählen
3. Zu "Creation Flow" Tab wechseln
4. Prüfen:
   - Werden `supportedSources` angezeigt?
   - Werden `flow.steps` angezeigt?
   - Können Quellen hinzugefügt/entfernt werden?
   - Können Steps hinzugefügt/entfernt werden?
5. Änderungen speichern
6. Template neu laden und prüfen, ob Änderungen persistiert wurden

**Erwartetes Ergebnis**:
- UI zeigt creation-Block korrekt an
- Bearbeitung funktioniert
- Speichern persistiert Änderungen im Frontmatter

### Test 5: Template ohne creation-Block
**Ziel**: Prüfen, ob Templates ohne creation-Block korrekt behandelt werden

**Schritte**:
1. Template ohne creation-Block öffnen
2. Zu "Creation Flow" Tab wechseln
3. Prüfen:
   - Werden leere Listen angezeigt?
   - Können Quellen/Steps hinzugefügt werden?
4. Quellen/Steps hinzufügen und speichern
5. Prüfen, ob creation-Block im Frontmatter erstellt wurde

**Erwartetes Ergebnis**:
- UI zeigt leere Listen
- Hinzufügen funktioniert
- creation-Block wird korrekt ins Frontmatter geschrieben

## Phase 5: Library-Konfiguration & Create-Seite ✅

### Test 6: CreateContentPage mit Library-Config
**Ziel**: Prüfen, ob Create-Seite Typen aus Library-Config lädt

**Schritte**:
1. Library mit creation-Konfiguration erstellen:
   ```json
   {
     "creation": {
       "types": [
         {
           "id": "event",
           "label": "Event erfassen",
           "description": "Test",
           "templateId": "session_analyze_en",
           "icon": "calendar"
         }
       ]
     }
   }
   ```
2. `/library/[slug]/create` öffnen
3. Prüfen:
   - Werden die konfigurierten Typen angezeigt?
   - Haben sie korrekte Labels/Beschreibungen?
   - Haben sie korrekte Icons?
4. Auf einen Typ klicken
5. Prüfen, ob Route korrekt ist: `/library/[slug]/create/[typeId]`

**Erwartetes Ergebnis**:
- Typen werden aus Library-Config geladen
- UI rendert korrekt
- Routen funktionieren

### Test 7: CreateContentPage ohne Konfiguration
**Ziel**: Prüfen, ob Create-Seite ohne Konfiguration korrekt reagiert

**Schritte**:
1. Library ohne creation-Konfiguration öffnen
2. `/library/[slug]/create` öffnen
3. Prüfen:
   - Wird eine Fehlermeldung angezeigt?
   - Ist die Meldung hilfreich?

**Erwartetes Ergebnis**:
- Hilfreiche Fehlermeldung wird angezeigt
- UI ist nicht kaputt

## Integrationstests

### Test 8: End-to-End Template-Erstellung
**Ziel**: Kompletten Flow von Template-Erstellung bis zur Verwendung testen

**Schritte**:
1. Neues Template erstellen
2. Frontmatter mit Feldern definieren
3. systemprompt definieren
4. creation-Block hinzufügen:
   - 2-3 supportedSources definieren
   - 3-4 flow.steps definieren
5. Template speichern
6. Library-Konfiguration erweitern, um dieses Template zu verwenden
7. Create-Seite öffnen
8. Prüfen, ob Template-Typ angezeigt wird
9. Template parsen und Views prüfen

**Erwartetes Ergebnis**:
- Kompletter Flow funktioniert
- Alle Daten werden korrekt persistiert
- Views sind korrekt

### Test 9: Abwärtskompatibilität
**Ziel**: Prüfen, ob bestehende Templates ohne creation-Block weiterhin funktionieren

**Schritte**:
1. Bestehendes Template ohne creation-Block öffnen
2. Prüfen:
   - Wird es korrekt geparst?
   - Gibt es Fehler?
   - Kann es weiterhin für Secretary/LLM verwendet werden?
3. `getUxConfig()` aufrufen
4. Prüfen, ob `null` zurückgegeben wird

**Erwartetes Ergebnis**:
- Bestehende Templates funktionieren weiterhin
- `getUxConfig()` gibt `null` zurück für Templates ohne creation
- Keine Breaking Changes

## Bekannte Einschränkungen / Offene Punkte

1. **Source-Presets ggf. noch nicht vollständig produktiv**:
   - Je nach Preset können Diktat/URL-Scraping/Datei-Extraktion noch als Mock/Placeholder umgesetzt sein
   - Iterativ durch echte Implementierung ersetzen (Web APIs, Parser, Upload-Pipelines)

2. **End-to-End Persistenz je Ziel-Item**:
   - Der Wizard erzeugt Draft + Review; finaler „Speichern als Item“-Pfad sollte pro Zielobjekt (z.B. Session/Event) eindeutig definiert und getestet werden

3. **Secretary/Batch Regression Tests**:
   - Für mindestens ein Template (z.B. `Session_analyze_en`) einen vollständigen Testlauf definieren und automatisieren

## Test-Daten

### Beispiel-Template mit creation-Block
```markdown
---
title: {{title|Full session title}}
summary: {{summary|Summary of the session}}
tags: {{tags|Array of tags}}
creation:
  supportedSources:
    - id: spoken
      type: spoken
      label: "Ich erzähle die Session kurz"
      helpText: "Erkläre frei, worum es geht."
    - id: url
      type: url
      label: "Event- oder Slides-URL"
      helpText: "Füge einen Link ein, den wir analysieren."
  flow:
    steps:
      - id: chooseSource
        preset: chooseSource
      - id: collectSource
        preset: collectSource
      - id: generateDraft
        preset: generateDraft
      - id: reviewMetadata
        preset: reviewFields
        fields:
          - title
          - summary
          - tags
---
{{summaryInText|Beschreibung der Session}}

--- systemprompt
Role: You are a technical summarizer...
```

### Beispiel Library-Config
```json
{
  "creation": {
    "types": [
      {
        "id": "event",
        "label": "Event erfassen",
        "description": "Erfasse strukturierte Event-Informationen",
        "templateId": "session_analyze_en",
        "icon": "calendar"
      },
      {
        "id": "testimonial",
        "label": "Testimonial erfassen",
        "description": "Teile persönliche Eindrücke",
        "templateId": "testimonial_generic",
        "icon": "quote"
      }
    ]
  }
}
```

