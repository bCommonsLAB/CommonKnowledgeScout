# Creation-Wizard Shadow‑Twin Testing Guide

## Übersicht

Dieser Guide beschreibt, wie die Shadow-Twin Features des Creation-Wizards getestet werden können:
- **Automatische Extraktion**: Quellen werden automatisch ausgewertet nach dem Hinzufügen
- **Container-Ordner** (`createInOwnFolder`): Items können in eigenen Ordnern gespeichert werden
- **Shadow‑Twin Bundle-Schreiben**: Quellen werden in versteckten Ordnern gespeichert
- **Multi-Source**: Mehrere Quellen in einem Flow sammeln
- **`targetFolderId` Query-Param**: Für Child-Flows (z.B. Testimonials in Event-Ordner)

## Vorbereitung

1. **Template konfigurieren**
   - Gehe zu Template-Editor
   - Konfiguriere `collectSource` Step mit unterstützten Quellen
   - Optional: Aktiviere `createInOwnFolder` im Output-Bereich

2. **Test-Library vorbereiten**
   - Stelle sicher, dass eine Library vorhanden ist
   - Notiere die Library-ID

## Test-Szenarien

### Test 1: Automatische Extraktion (Multi-Source)

**Ziel:** Prüfen, dass Quellen automatisch ausgewertet werden und mehrere Quellen kombiniert werden.

**Schritte:**
1. Öffne Creation-Wizard für ein Template mit `collectSource` Step
2. Gehe zu `collectSource` Step
3. **Erwartung:** Quelle-Auswahl wird angezeigt
4. Wähle "Webseite" → Gib URL ein → Klicke "Weiter"
5. **Erwartung:** 
   - Quelle wird hinzugefügt
   - Toast "Quellen wurden ausgewertet" erscheint automatisch
   - `generatedDraft` wird automatisch erstellt
6. Gehe zurück zu `collectSource` Step
7. **Erwartung:** 
   - Quelle-Auswahl wird wieder angezeigt
   - Bereits hinzugefügte Quelle wird oben angezeigt
8. Wähle "Text" → Gib Text ein → Klicke "Weiter"
9. **Erwartung:**
   - Beide Quellen werden in der Liste angezeigt
   - Extraktion wird erneut ausgeführt (mit beiden Quellen)
   - Toast "Quellen wurden ausgewertet" erscheint erneut

**Erfolgskriterien:**
- ✅ Automatische Transformation nach `addSource`
- ✅ Mehrere Quellen werden kombiniert
- ✅ Extraktion wird bei Quellen-Änderung neu ausgeführt

---

### Test 2: Container-Ordner (`createInOwnFolder`)

**Ziel:** Prüfen, dass Container-Items in eigenen Ordnern gespeichert werden.

**Schritte:**
1. Erstelle/bearbeite ein Template (z.B. "Dialograum")
2. Aktiviere `createInOwnFolder` im Output-Bereich
3. Speichere Template
4. Öffne Creation-Wizard für dieses Template
5. Fülle alle Steps aus:
   - Füge Quellen hinzu
   - Bearbeite Metadaten
   - Prüfe Vorschau
6. Speichere die Datei
7. **Erwartung:**
   - Toast "Content erfolgreich erstellt in Ordner 'mein-dialograum'!"
   - In der Library: Ordner `mein-dialograum/` wurde erstellt
   - Im Ordner: Datei `mein-dialograum.md` liegt direkt im Ordner
8. Prüfe Dateistruktur:
   ```
   library/
   └── mein-dialograum/
       ├── mein-dialograum.md (Source)
       └── .mein-dialograum.md/ (Shadow‑Twin Bundle, versteckt)
           ├── mein-dialograum.de.md (Transcript)
           └── mein-dialograum.<template>.de.md (Transformation)
   ```

**Erfolgskriterien:**
- ✅ Ordner wird erstellt (Name = Dateiname ohne Extension)
- ✅ Source-Datei liegt im Ordner
- ✅ Shadow‑Twin Bundle liegt im Dot‑Folder innerhalb des Ordners

---

### Test 3: Shadow‑Twin Bundle-Schreiben

**Ziel:** Prüfen, dass Bundle nach Source-Save geschrieben wird.

**Schritte:**
1. Erstelle ein Item mit mehreren Quellen:
   - Text-Quelle: "Mein Text"
   - URL-Quelle: Eine Webseite
   - Optional: Audio-Quelle
2. **Erwartung:** Extraktion läuft automatisch nach jeder Quelle
3. Speichere die Datei
4. Prüfe Shadow‑Twin Bundle:
   - Öffne Dot‑Folder `.source-name.md/` (oder `.{sourceName}/` je nach Konfiguration)
   - **Erwartung:**
     - `source-name.de.md` (Transcript) existiert
     - `source-name.<template>.de.md` (Transformation) existiert
     - Transcript enthält vollständigen Rohkorpus (alle Quellen kombiniert)
     - Transformation enthält Template-Output mit Frontmatter
5. Prüfe Source-Datei Frontmatter:
   - **Erwartung:** Keine `textSources[]` mehr im Frontmatter (wird jetzt im Bundle gespeichert)
   - **Erwartung:** `creationFlowMetadata` sollte vorhanden sein

**Erfolgskriterien:**
- ✅ Bundle wird nach Source-Save geschrieben
- ✅ Transcript und Transformation existieren
- ✅ Source-Frontmatter enthält keine Vollrohtexte mehr
- ✅ Alle Quellen sind im Transcript enthalten

---

### Test 4: Child-Flow mit `targetFolderId`

**Ziel:** Prüfen, dass Testimonials im Container-Ordner gespeichert werden können.

**Schritte:**
1. Erstelle ein Dialograum-Item mit `createInOwnFolder` (siehe Test 2)
2. Notiere die Dialograum-Ordner-ID (aus URL oder Library-Ansicht)
3. Öffne Creation-Wizard für Testimonial-Template
4. Füge `targetFolderId` Query-Param zur URL hinzu:
   ```
   /library/create/testimonial?targetFolderId=<dialograum-folder-id>
   ```
5. Fülle Testimonial-Wizard aus
6. Speichere Testimonial
7. **Erwartung:**
   - Testimonial wird im Dialograum-Ordner gespeichert
   - Dateistruktur:
     ```
     library/
     └── mein-dialograum/
         ├── mein-dialograum.md
         ├── .mein-dialograum.md/ (Shadow-Twin für Dialograum)
         ├── testimonial-1.md
         ├── .testimonial-1.md/ (Shadow-Twin für Testimonial 1)
         ├── testimonial-2.md
         └── .testimonial-2.md/ (Shadow-Twin für Testimonial 2)
     ```

**Erfolgskriterien:**
- ✅ `targetFolderId` wird aus Query-Param gelesen
- ✅ Child-Items werden im Container-Ordner gespeichert
- ✅ Jedes Child-Item hat eigenes Shadow‑Twin Bundle

---

### Test 5: Multi-Source mit verschiedenen Quell-Typen

**Ziel:** Prüfen, dass verschiedene Quell-Typen korrekt kombiniert werden.

**Schritte:**
1. Erstelle ein Item mit:
   - URL-Quelle: Eine Webseite
   - Text-Quelle: Manuell eingegebener Text
   - Optional: Audio-Quelle (falls verfügbar)
2. **Erwartung:**
   - Alle Quellen werden in der Liste angezeigt
   - Extraktion kombiniert alle Quellen
   - Transcript enthält alle Rohdaten
3. Entferne eine Quelle
4. **Erwartung:**
   - Extraktion wird neu ausgeführt
   - Transcript wird aktualisiert
   - `generatedDraft` wird aktualisiert

**Erfolgskriterien:**
- ✅ Verschiedene Quell-Typen können kombiniert werden
- ✅ Entfernen einer Quelle triggert Neu-Extraktion
- ✅ Transcript enthält alle Quellen korrekt

---

### Test 6: Resume-Flow (Backward-Compat)

**Ziel:** Prüfen, dass bestehende Creation-Dateien weiterhin funktionieren.

**Schritte:**
1. Öffne eine alte Creation-Datei (mit `textSources[]` im Frontmatter)
2. Klicke "Wiederaufnehmen"
3. **Erwartung:**
   - Wizard öffnet sich
   - Quellen werden aus `textSources[]` geladen (Fallback)
   - Flow funktioniert normal
4. Speichere die Datei erneut
5. **Erwartung:**
   - Neue Datei hat kein `textSources[]` mehr
   - Bundle wird geschrieben (falls Quellen vorhanden)
   - Migration zu neuem Format erfolgt automatisch

**Erfolgskriterien:**
- ✅ Alte Dateien können wiederaufgenommen werden
- ✅ Resume funktioniert mit Legacy-Format
- ✅ Nach erneutem Speichern: neues Format

---

## Debugging-Tipps

### Browser Console prüfen
- Öffne DevTools → Console
- Suche nach Fehlermeldungen:
  - `[handleSave] Fehler beim Schreiben des Bundles`
  - `[write-bundle] Fehler`
  - `Error calling tool` (bei API-Calls)

### Network Tab prüfen
- Öffne DevTools → Network
- Filtere nach `/api/library/.../creation/write-bundle`
- Prüfe Request/Response:
  - Status 200 = Erfolg
  - Status 500 = Server-Fehler (siehe Response-Body)
  - Prüfe Request Body: Enthält `sources`, `transcriptContent`, `transformationContent`?

### Storage prüfen
- In Library-Ansicht: Prüfe Dateistruktur
- Dot‑Folders sind versteckt (beginnen mit `.`)
- In Filesystem: Prüfe physische Ordnerstruktur
- Prüfe Shadow-Twin Ordner-Inhalt:
  - Transcript-Datei sollte vorhanden sein
  - Transformation-Datei sollte vorhanden sein

### Frontmatter prüfen
- Öffne Source-Datei im Editor
- Prüfe Frontmatter:
  - Sollte keine `textSources[]` enthalten
  - Sollte `creationTypeId`, `creationTemplateId` enthalten
  - Sollte `creationFlowMetadata` enthalten (für Resume)

### API Response prüfen
- Prüfe `/api/library/.../creation/write-bundle` Response:
  - `transcriptFileId`: ID der Transcript-Datei
  - `transformationFileId`: ID der Transformation-Datei
  - `shadowTwinFolderId`: ID des Shadow-Twin Ordners

---

## Bekannte Einschränkungen

1. **Bundle-Schreiben ist nicht atomisch**
   - Wenn Bundle-Schreiben fehlschlägt, ist Source-Datei bereits gespeichert
   - Toast-Warnung erscheint, aber Source bleibt erhalten
   - **Workaround**: Bei Fehler manuell prüfen und ggf. erneut speichern

2. **Resume mit Legacy-Format**
   - Alte Dateien mit `textSources[]` funktionieren weiterhin
   - Migration zu neuem Format erfolgt beim erneuten Speichern
   - **Hinweis**: Nach Migration sind Quellen im Bundle, nicht mehr im Frontmatter

3. **Container-Ordner-Name**
   - Wird aus Dateiname abgeleitet (ohne Extension)
   - Bei Namensänderung: Ordner wird nicht automatisch umbenannt
   - **Hinweis**: Ordner-Name basiert auf dem initialen Dateinamen

4. **Automatische Extraktion**
   - Wird bei jeder Quellen-Änderung ausgeführt
   - Bei vielen Quellen kann dies zu mehreren API-Calls führen
   - **Hinweis**: Extraktion läuft im Hintergrund, UI bleibt responsiv

---

## Nächste Schritte

Nach erfolgreichen Tests:
1. **Template-Migration**: Bestehende Templates auf neue Presets umstellen
2. **Container-Templates**: `createInOwnFolder` für Events/Books aktivieren
3. **Dokumentation**: User-Guide für Creation-Wizard aktualisieren
4. **Performance**: Bei sehr vielen Quellen (>10) Performance testen
5. **Fehlerbehandlung**: Robustheit bei API-Fehlern verbessern
