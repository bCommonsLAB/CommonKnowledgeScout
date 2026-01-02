# Testanleitung: Creation Wizard (Aktualisiert)

## Übersicht

Diese Anleitung zeigt, wie du die aktuellen Features des Creation-Wizards testen kannst:
- **collectSource-Step**: Quelle sammeln mit integrierter Quelle-Auswahl
- **Multi-Source**: Mehrere Quellen in einem Flow sammeln
- **EditDraft-Step**: Formular-Modus mit Metadaten + Markdown-Editor
- **Shadow-Twin Speicherung**: Quellen werden in versteckten Ordnern gespeichert
- **Container-Folder**: Items können in eigenen Ordnern gespeichert werden

## Voraussetzungen

1. **Template-Verwaltung öffnen**: Navigiere zu `http://localhost:3000/templates`
2. **Bestehendes Template bearbeiten** oder **neues Template erstellen**

## Aktuelle Step-Presets

Die folgenden Presets sind verfügbar:
- `welcome` - Willkommensseite
- `collectSource` - Quelle sammeln (zeigt Quelle-Auswahl wenn keine ausgewählt)
- `generateDraft` - LLM-Transformation (optional, wird in Multi-Source-Flow automatisch übersprungen)
- `editDraft` - Metadaten-Bearbeitung
- `previewDetail` - Vorschau
- `uploadImages` - Bild-Upload (optional)
- `selectRelatedTestimonials` - Testimonial-Auswahl (spezifisch)

**Entfernte Presets** (nicht mehr verfügbar):
- ❌ `briefing` - Funktionalität ist jetzt in `collectSource` integriert
- ❌ `chooseSource` - Funktionalität ist jetzt in `collectSource` integriert
- ❌ `reviewSources` - Wurde als nicht benötigt entfernt

## Schritt 1: Template konfigurieren

### Option A: Bestehendes Template erweitern

1. Öffne `/templates`
2. Wähle ein Template aus, das bereits einen `creation`-Block hat
3. Klicke auf den Tab **"Creation Flow"**
4. Konfiguriere die Flow Steps

### Option B: Neues Template erstellen

1. Öffne `/templates`
2. Klicke auf **"Neu"**
3. Fülle die Tabs aus:
   - **Metadaten**: Definiere mindestens 3-5 Felder (z.B. `title`, `summary`, `tags`)
   - **Rollenanweisung**: Beschreibe die Rolle
   - **Struktur**: Definiere Markdown-Struktur mit `{{key|description}}`
   - **Creation Flow**: Konfiguriere den Flow

## Schritt 2: Flow Steps konfigurieren

### Empfohlene Flow-Reihenfolge

**Standard-Flow**:
1. `welcome` - Willkommensseite
2. `collectSource` - Quellen sammeln (mit Quelle-Auswahl)
3. `editDraft` - Metadaten bearbeiten
4. `previewDetail` - Vorschau anzeigen

**Mit Bild-Upload**:
1. `welcome`
2. `collectSource`
3. `editDraft` (mit `imageFieldKeys` konfiguriert)
4. `uploadImages` - Optional
5. `previewDetail`

**Mit Transformation**:
1. `welcome`
2. `collectSource`
3. `generateDraft` - Optional (wird automatisch übersprungen wenn Quellen vorhanden)
4. `editDraft`
5. `previewDetail`

### collectSource Step konfigurieren

1. Füge einen `collectSource`-Step hinzu
2. Im Detail-Panel rechts:
   - **Preset**: `collectSource` (bereits ausgewählt)
   - **Step ID**: z.B. `CollectSource`
   - **Titel**: z.B. `"Quellen sammeln"`
   - **Beschreibung**: Optional
3. **Unterstützte Quellen hinzufügen**:
   - Klicke auf **"Quelle hinzufügen"** im Step Details Panel
   - Konfiguriere die Quelle:
     - **Typ**: `text`, `url` oder `file`
     - **Label**: z.B. "Text (tippen oder diktieren)"
     - **Hilfetext**: Beschreibung für den Nutzer
   - Wiederhole für weitere Quellen

**Wichtig**: Die Quellen-Verwaltung ist jetzt direkt im `collectSource` Step integriert!

### editDraft Step konfigurieren

1. Füge einen `editDraft`-Step hinzu
2. Im Detail-Panel rechts:
   - **Preset**: `editDraft`
   - **Step ID**: z.B. `Details`
   - **Titel**: z.B. `"Details bearbeiten"`
   - **Felder auswählen**: Wähle die Metadaten-Felder, die bearbeitet werden sollen
   - **Bildfelder**: Optional - wähle Felder, die als Bild-Upload gerendert werden sollen

## Schritt 3: Template speichern

1. Klicke auf **"Speichern"**
2. Prüfe, ob keine Validierungsfehler angezeigt werden
3. Template sollte jetzt in der Liste erscheinen

## Schritt 4: Create-Seite testen

1. Navigiere zu `http://localhost:3000/library/create`
2. Dein Template sollte als Karte erscheinen (mit Icon, Name, Beschreibung aus `creation.ui`)
3. Klicke auf die Karte

## Schritt 5: collectSource Step testen

### Quelle-Auswahl testen

1. **Erwartung**: Beim Betreten des `collectSource` Steps sollte die Quelle-Auswahl angezeigt werden
2. **Quellen anzeigen**:
   - Alle konfigurierten Quellen sollten als Cards angezeigt werden
   - Icons und Beschreibungen sollten korrekt sein
3. **Quelle auswählen**:
   - Klicke auf eine Quelle (z.B. "Webseite")
   - **Erwartung**: Der entsprechende Dialog sollte sofort erscheinen (kein "Weiter"-Klick nötig)
   - Bei "Webseite": URL-Eingabefeld sollte erscheinen
   - Bei "Text": Textarea mit Diktat-Button sollte erscheinen

### Multi-Source testen

1. **Erste Quelle hinzufügen**:
   - Wähle "Webseite" → Gib URL ein → Klicke "Weiter"
   - **Erwartung**: Quelle wird hinzugefügt, Extraktion startet automatisch
2. **Zurückgehen**:
   - Klicke "Zurück" zum `collectSource` Step
   - **Erwartung**: Quelle-Auswahl wird wieder angezeigt
   - **Erwartung**: Bereits hinzugefügte Quellen werden oben angezeigt
3. **Weitere Quelle hinzufügen**:
   - Wähle "Text" → Gib Text ein → Klicke "Weiter"
   - **Erwartung**: Beide Quellen sollten in der Liste angezeigt werden
4. **Quelle entfernen**:
   - Klicke auf X-Button bei einer Quelle
   - **Erwartung**: Quelle wird entfernt, Extraktion wird neu ausgeführt

### Automatische Extraktion testen

1. Füge eine Quelle hinzu
2. **Erwartung**: 
   - Toast "Quellen wurden ausgewertet" sollte erscheinen
   - `generatedDraft` sollte automatisch erstellt werden
   - Kein separater `generateDraft` Step nötig

## Schritt 6: editDraft Step testen

1. Nach dem `collectSource` Step sollte der `editDraft` Step erscheinen
2. **Metadaten-Tab**:
   - Felder sollten mit Werten aus `generatedDraft` vorausgefüllt sein (falls vorhanden)
   - Felder sollten bearbeitbar sein
   - Bei Bildfeldern: Upload-Button sollte sichtbar sein
3. **Markdown-Tab**:
   - Markdown-Text sollte aus `generatedDraft.markdown` stammen
   - Text sollte bearbeitbar sein
4. **Änderungen speichern**:
   - Änderungen sollten im Wizard-State gespeichert werden
   - Beim Zurückgehen sollten Änderungen erhalten bleiben

## Schritt 7: Shadow-Twin Speicherung testen

1. Erstelle ein Item mit Quellen
2. Speichere das Item
3. **Prüfe im Filesystem**:
   - Haupt-Markdown-Datei sollte erstellt sein: `{title}.md`
   - Shadow-Twin Ordner sollte erstellt sein: `.{sourceName}/` (versteckt)
   - Transcript sollte vorhanden sein: `{baseName}.de.md`
   - Transformation sollte vorhanden sein: `{baseName}.{templateName}.de.md`

**Erwartete Struktur**:
```
library/
├── mein-item.md (Hauptdatei)
└── .mein-item.md/ (Shadow-Twin Ordner, versteckt)
    ├── mein-item.de.md (Transcript)
    └── mein-item.template-name.de.md (Transformation)
```

## Schritt 8: Container-Folder testen (`createInOwnFolder`)

1. **Template konfigurieren**:
   - Im Template-Editor → Creation Flow Tab
   - Aktiviere `createInOwnFolder` im Output-Bereich
2. **Item erstellen**:
   - Erstelle ein Item mit diesem Template
   - Speichere das Item
3. **Prüfe im Filesystem**:
   - Ordner sollte erstellt sein: `{slugified-title}/`
   - Hauptdatei sollte im Ordner liegen: `{title}/{title}.md`
   - Shadow-Twin Ordner sollte auch im Ordner liegen: `{title}/.{sourceName}/`

**Erwartete Struktur**:
```
library/
└── mein-dialograum/
    ├── mein-dialograum.md (Hauptdatei)
    └── .mein-dialograum.md/ (Shadow-Twin Ordner)
        ├── mein-dialograum.de.md (Transcript)
        └── mein-dialograum.template-name.de.md (Transformation)
```

## Schritt 9: Testimonial-Flow testen (Child-Flow)

1. **Dialograum erstellen**:
   - Erstelle einen Dialograum mit `createInOwnFolder: true`
   - Notiere die Ordner-ID
2. **Testimonial erstellen**:
   - Öffne Testimonial-Creation Flow
   - Füge `targetFolderId` Query-Param zur URL hinzu:
     ```
     /library/create/testimonial?targetFolderId=<dialograum-folder-id>
     ```
3. **Testimonial speichern**:
   - Fülle Testimonial aus
   - Speichere das Testimonial
4. **Prüfe im Filesystem**:
   - Testimonial sollte im Dialograum-Ordner liegen
   - Testimonial sollte eigenen Shadow-Twin Ordner haben

**Erwartete Struktur**:
```
library/
└── mein-dialograum/
    ├── mein-dialograum.md
    ├── .mein-dialograum.md/
    ├── testimonial-1.md
    ├── .testimonial-1.md/
    ├── testimonial-2.md
    └── .testimonial-2.md/
```

## Schritt 10: Navigation testen

### Zurückgehen testen

1. Füge eine Quelle hinzu
2. Gehe zu `editDraft` Step
3. Gehe zurück zu `collectSource` Step
4. **Erwartung**:
   - Quelle-Auswahl wird wieder angezeigt
   - Bereits hinzugefügte Quellen sind sichtbar
   - Quellen können bearbeitet/entfernt werden

### Datenverlust vermeiden

1. Fülle Metadaten in `editDraft` aus
2. Gehe zurück zu `collectSource`
3. Gehe wieder zu `editDraft`
4. **Erwartung**: Alle Änderungen sollten erhalten bleiben

## Schritt 11: Edge Cases testen

### Test 1: Keine Quellen hinzufügen

1. Starte Creation Flow
2. Gehe direkt zu `editDraft` ohne Quellen hinzuzufügen
3. **Erwartung**: 
   - `editDraft` sollte funktionieren (Formular-Modus)
   - Metadaten sollten leer sein
   - Speichern sollte funktionieren

### Test 2: Alle Quellen entfernen

1. Füge mehrere Quellen hinzu
2. Entferne alle Quellen
3. **Erwartung**:
   - `generatedDraft` sollte zurückgesetzt werden
   - `editDraft` sollte mit leeren Feldern erscheinen

### Test 3: Sehr viele Quellen

1. Füge 5+ Quellen hinzu
2. **Erwartung**:
   - Alle Quellen sollten angezeigt werden
   - Extraktion sollte funktionieren
   - Performance sollte akzeptabel sein

### Test 4: Ungültige URL

1. Wähle "Webseite" als Quelle
2. Gib eine ungültige URL ein (z.B. "test")
3. **Erwartung**: 
   - Fehlermeldung sollte angezeigt werden
   - Flow sollte nicht crashen

## Schritt 12: Vollständiger End-to-End Flow

1. **Start**: Öffne Creation Flow
2. **Welcome**: Klicke "Weiter"
3. **collectSource**:
   - Wähle "Webseite" → Gib URL ein → Füge hinzu
   - Gehe zurück → Wähle "Text" → Gib Text ein → Füge hinzu
   - Prüfe: Beide Quellen sind sichtbar
4. **editDraft**:
   - Bearbeite Metadaten
   - Bearbeite Markdown
5. **previewDetail**:
   - Prüfe Vorschau
6. **Speichern**:
   - Klicke "Speichern"
   - Prüfe: Item wurde erstellt
   - Prüfe: Shadow-Twin Bundle wurde erstellt

**Erwartung**: Kompletter Flow sollte ohne Fehler durchlaufen

## Debugging-Tipps

### Browser Console prüfen

- Öffne DevTools → Console
- Suche nach Fehlermeldungen:
  - `[handleSave] Fehler beim Schreiben des Bundles`
  - `[write-bundle] Fehler`
  - React Hook-Fehler

### Network Tab prüfen

- Öffne DevTools → Network
- Filtere nach `/api/library/.../creation/write-bundle`
- Prüfe Request/Response:
  - Status 200 = Erfolg
  - Status 500 = Server-Fehler (siehe Response-Body)

### Storage prüfen

- In Library-Ansicht: Prüfe Dateistruktur
- Dot‑Folders sind versteckt (beginnen mit `.`)
- In Filesystem: Prüfe physische Ordnerstruktur

### Frontmatter prüfen

- Öffne Source-Datei im Editor
- Prüfe Frontmatter:
  - Sollte `creationTypeId`, `creationTemplateId` enthalten
  - Sollte keine `textSources[]` enthalten (wird jetzt im Bundle gespeichert)

## Bekannte Einschränkungen

1. **Bundle-Schreiben ist nicht atomisch**
   - Wenn Bundle-Schreiben fehlschlägt, ist Source-Datei bereits gespeichert
   - Toast-Warnung erscheint, aber Source bleibt erhalten

2. **Container-Ordner-Name**
   - Wird aus Dateiname abgeleitet (ohne Extension)
   - Bei Namensänderung: Ordner wird nicht automatisch umbenannt

3. **generateDraft Step**
   - Wird automatisch übersprungen wenn Quellen vorhanden sind
   - Kann optional für Legacy-Templates verwendet werden

## Nächste Schritte

Nach erfolgreichem Test:
1. Template-Migration: Bestehende Templates auf neue Presets umstellen
2. Container-Templates: `createInOwnFolder` für Events/Books aktivieren
3. Dokumentation: User-Guide für Creation-Wizard aktualisieren
4. Performance-Tests: Sehr viele Quellen (>10) testen
