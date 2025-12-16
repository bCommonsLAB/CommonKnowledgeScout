# Testanleitung: Creation Wizard mit Briefing & EditDraft

## Übersicht

Diese Anleitung zeigt, wie du die neuen Features testen kannst:
- **Briefing-Step**: Spickzettel + Mode-Auswahl
- **EditDraft-Step**: Formular-Modus mit Metadaten + Markdown-Editor
- **Zwei Eingabemodi**: Interview vs Formular

## Voraussetzungen

1. **Template-Verwaltung öffnen**: Navigiere zu `http://localhost:3000/templates`
2. **Bestehendes Template bearbeiten** oder **neues Template erstellen**

## Schritt 1: Template mit neuen Presets konfigurieren

### Option A: Bestehendes Template erweitern

1. Öffne `/templates`
2. Wähle ein Template aus, das bereits einen `creation`-Block hat (z.B. `Session_analyze_en`)
3. Klicke auf den Tab **"Creation Flow"**
4. Klicke auf **"Step hinzufügen"**

### Option B: Neues Template erstellen

1. Öffne `/templates`
2. Klicke auf **"Neu"**
3. Fülle die Tabs aus:
   - **Metadaten**: Definiere mindestens 3-5 Felder (z.B. `title`, `summary`, `tags`)
   - **Rollenanweisung**: Beschreibe die Rolle
   - **Struktur**: Definiere Markdown-Struktur mit `{{key|description}}`
   - **Creation Flow**: Konfiguriere den Flow

## Schritt 2: Briefing-Step hinzufügen

1. Im Tab **"Creation Flow"** → **"Flow Steps"**
2. Klicke **"Step hinzufügen"**
3. Im Detail-Panel rechts:
   - **Preset**: Wähle `briefing`
   - **Step ID**: z.B. `overview`
   - **Titel**: z.B. `"Was wird benötigt?"`
   - **Beschreibung**: Optional
4. **Speichern** klicken

**Hinweis**: Der Briefing-Step zeigt automatisch alle Felder aus `reviewFields`-Steps an. Stelle sicher, dass du mindestens einen `reviewFields`-Step hast!

## Schritt 3: ReviewFields-Steps konfigurieren

1. Füge einen `reviewFields`-Step hinzu:
   - **Preset**: `reviewFields`
   - **Step ID**: z.B. `reviewEssential`
   - **Titel**: z.B. `"Wichtige Felder"`
   - **Felder auswählen**: Wähle 3-5 Felder aus den Metadaten (z.B. `title`, `summary`)

2. Optional: Füge einen zweiten `reviewFields`-Step hinzu:
   - **Preset**: `reviewFields`
   - **Step ID**: z.B. `reviewOptional`
   - **Titel**: z.B. `"Optionale Felder"`
   - **Felder auswählen**: Wähle weitere Felder

**Wichtig**: Der Briefing-Step leitet den Spickzettel aus allen `reviewFields`-Steps ab!

## Schritt 4: EditDraft-Step hinzufügen

1. Füge einen `editDraft`-Step hinzu:
   - **Preset**: `editDraft`
   - **Step ID**: z.B. `editDraft`
   - **Titel**: z.B. `"Draft bearbeiten"`
   - **Beschreibung**: Optional

**Hinweis**: `editDraft` benötigt keine Feldauswahl - er zeigt automatisch alle Metadaten-Felder an.

## Schritt 5: Flow-Reihenfolge festlegen

**Empfohlene Reihenfolge für Interview-Templates**:
1. `briefing` (Mode-Auswahl)
2. `chooseSource` (Quelle wählen)
3. `collectSource` (Eingabe sammeln)
4. `generateDraft` (LLM-Transformation)
5. `reviewFields` (Felder überprüfen)
6. `editDraft` (optional: weitere Bearbeitung)

**Empfohlene Reihenfolge für Bulk-first Templates**:
1. `chooseSource` (Datei/URL wählen)
2. `collectSource` (Datei hochladen)
3. `generateDraft` (LLM-Transformation)
4. `reviewFields` (Felder überprüfen)
5. `editDraft` (optional: weitere Bearbeitung)

**Für Formular-Modus-Test**:
1. `briefing` (Mode-Auswahl → Formular wählen)
2. `editDraft` (direkt bearbeiten)
3. Optional: `generateDraft` (zur Initialbefüllung)

## Schritt 6: Template speichern

1. Klicke auf **"Speichern"**
2. Prüfe, ob keine Validierungsfehler angezeigt werden
3. Template sollte jetzt in der Liste erscheinen

## Schritt 7: Create-Seite testen

1. Navigiere zu `http://localhost:3000/library/create`
2. Dein Template sollte als Karte erscheinen (mit Icon, Name, Beschreibung aus `creation.ui`)
3. Klicke auf die Karte

## Schritt 8: Briefing-Step testen

1. **Spickzettel prüfen**:
   - Werden alle Felder aus `reviewFields`-Steps angezeigt?
   - Sind die Feldnamen und Beschreibungen korrekt?
   - Werden die Felder nach Step-Titel gruppiert?

2. **Mode-Auswahl testen**:
   - Klicke auf **"Interview-Modus"** → sollte ausgewählt werden
   - Klicke auf **"Formular-Modus"** → sollte ausgewählt werden
   - **"Weiter"**-Button sollte erst aktiviert werden, wenn ein Mode gewählt ist

## Schritt 9: Interview-Modus testen

1. Wähle **"Interview-Modus"** im Briefing-Step
2. Klicke **"Weiter"**
3. **chooseSource**: Wähle eine Quelle (z.B. "Gesprochen" oder "Text")
4. **collectSource**: 
   - Bei "Gesprochen": Button sollte **"Interview starten (erzählen Sie alles)"** zeigen
   - Bei "Text": Textarea sollte verfügbar sein
   - Eingabe tätigen
5. **generateDraft**: 
   - Klicke **"Entwurf generieren"**
   - Warte auf LLM-Response
   - Metadaten und Markdown sollten angezeigt werden
6. **reviewFields**: 
   - Felder sollten mit Werten aus `generateDraft` vorausgefüllt sein
   - Werte bearbeiten und prüfen, ob Änderungen gespeichert werden
7. **editDraft** (optional):
   - Metadaten-Tab: Alle Felder sollten bearbeitbar sein
   - Markdown-Tab: Markdown-Text sollte bearbeitbar sein
8. **Speichern**: 
   - Datei sollte im Storage erstellt werden
   - Frontmatter sollte aus `reviewedFields` oder `generatedDraft.metadata` stammen
   - Markdown sollte aus `generatedDraft.markdown` stammen

## Schritt 10: Formular-Modus testen

1. Starte den Wizard erneut (`/library/create` → Template wählen)
2. Im Briefing-Step: Wähle **"Formular-Modus"**
3. Klicke **"Weiter"**
4. **editDraft-Step** sollte direkt erscheinen (oder nach `chooseSource`/`collectSource`, je nach Flow)
5. **Metadaten-Tab**:
   - Alle Felder sollten leer sein (oder mit Werten aus `generateDraft`, falls dieser Step vorher kam)
   - Pro Feld: **Diktat-Button** (Mic-Icon) sollte sichtbar sein
   - Diktat-Button klicken → sollte "Diktat läuft..." anzeigen (Mock-Implementierung)
   - Felder manuell ausfüllen und prüfen, ob Änderungen gespeichert werden
6. **Markdown-Tab**:
   - Markdown-Editor sollte verfügbar sein
   - Text eingeben und prüfen, ob Änderungen gespeichert werden
7. Optional: **generateDraft**-Step (falls im Flow):
   - Sollte auch ohne `collectedInput` funktionieren (zur Initialbefüllung)
   - Nach `generateDraft`: `draftMetadata` und `draftText` sollten mit Werten aus `generatedDraft` initialisiert werden
8. **Speichern**:
   - Datei sollte im Storage erstellt werden
   - Frontmatter sollte aus `draftMetadata` stammen
   - Markdown sollte aus `draftText` stammen

## Schritt 11: Feld-Diktat testen (Formular-Modus)

1. Im **editDraft-Step** → **Metadaten-Tab**
2. Klicke auf den **Mic-Button** neben einem Feld
3. **Erwartetes Verhalten**:
   - Button sollte "Diktat läuft..." anzeigen
   - Nach 2 Sekunden (Mock) sollte transkribierter Text im Feld erscheinen
   - Text sollte bearbeitbar bleiben

**Hinweis**: Aktuell ist Diktat als Mock implementiert. Echte Sprachaufnahme muss noch integriert werden.

## Schritt 12: Edge Cases testen

### Test 1: Briefing ohne reviewFields-Steps
- Template ohne `reviewFields`-Steps erstellen
- `briefing`-Step hinzufügen
- **Erwartung**: Alle Metadaten-Felder sollten angezeigt werden

### Test 2: EditDraft ohne generateDraft
- Flow: `briefing` → `editDraft` (ohne `generateDraft`)
- **Erwartung**: Felder sollten leer sein, Speichern sollte funktionieren

### Test 3: Interview-Modus ohne generateDraft
- Flow: `briefing` → `chooseSource` → `collectSource` → `reviewFields` (ohne `generateDraft`)
- **Erwartung**: `reviewFields` sollte Fehlermeldung zeigen ("Bitte zuerst einen Entwurf generieren")

### Test 4: Form-Modus mit generateDraft
- Flow: `briefing` → `chooseSource` → `collectSource` → `generateDraft` → `editDraft`
- **Erwartung**: Nach `generateDraft` sollten `draftMetadata` und `draftText` mit Werten aus `generatedDraft` initialisiert werden

## Bekannte Einschränkungen / Mock-Implementierungen

1. **Diktat (Speech-to-Text)**: Aktuell als Mock implementiert (2 Sekunden Delay, Beispieltext)
2. **URL-Scraping**: Aktuell als Mock implementiert
3. **File-Upload**: Liest nur Text-Dateien (.md, .txt)

## Debugging-Tipps

### Console-Logs prüfen
- Browser-Console öffnen (F12)
- Nach Fehlermeldungen suchen
- State-Updates im Wizard prüfen

### Template-Struktur prüfen
- In MongoDB: Collection `templates` öffnen
- Template-Dokument prüfen: `creation.flow.steps` sollte alle Steps enthalten

### API-Calls prüfen
- Network-Tab im Browser öffnen
- `/api/templates` Calls prüfen
- `/api/secretary/process-text` Calls prüfen (für `generateDraft`)

## Nächste Schritte

Nach erfolgreichem Test:
1. Echte Sprachaufnahme für Diktat integrieren
2. URL-Scraping implementieren
3. File-Upload für PDFs/andere Formate erweitern
4. Unit-Tests für Step-Komponenten schreiben
5. Integration-Tests für Wizard-Flow schreiben







