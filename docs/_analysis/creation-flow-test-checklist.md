# Creation Flow Test-Checkliste

## ✅ Bereits getestet
- [x] Webseite verarbeiten
- [x] Text verarbeiten
- [x] Audio verarbeiten

## 🔍 Nächste wichtige Tests

### 1. Multi-Source Funktionalität
**Ziel**: Mehrere Quellen in einem Flow sammeln

**Test-Schritte**:
1. Starte Creation Flow
2. Füge eine Webseite-Quelle hinzu
3. Gehe zurück zum "Quellen sammeln" Step
4. Füge zusätzlich eine Text-Quelle hinzu
5. Füge optional eine Audio-Quelle hinzu
6. Prüfe: Werden alle Quellen angezeigt?
7. Prüfe: Kannst du Quellen wieder entfernen?
8. Gehe weiter zu Details

**Erwartetes Ergebnis**:
- Alle Quellen werden in der Liste angezeigt
- Quellen können einzeln entfernt werden
- Extraktion funktioniert mit allen Quellen zusammen

---

### 2. Shadow-Twin Speicherung
**Ziel**: Prüfen, ob Quellen korrekt in Shadow-Twin Ordnern gespeichert werden

**Test-Schritte**:
1. Erstelle ein neues Item mit Quellen
2. Speichere das Item
3. Prüfe im Filesystem:
   - Wurde die Haupt-Markdown-Datei erstellt?
   - Wurde ein Shadow-Twin Ordner erstellt (z.B. `.{sourceName}/`)?
   - Sind die Rohdaten (transcript) im Shadow-Twin Ordner?
   - Ist die Transformation im Shadow-Twin Ordner?

**Erwartetes Ergebnis**:
- Hauptdatei: `{title}.md` im Hauptverzeichnis
- Shadow-Twin Ordner: `.{sourceName}/` (versteckt)
- Transcript: `{baseName}.de.md` im Shadow-Twin Ordner
- Transformation: `{baseName}.{templateName}.de.md` im Shadow-Twin Ordner

---

### 3. Container-Folder (`createInOwnFolder`)
**Ziel**: Prüfen, ob Items mit `createInOwnFolder: true` in eigenem Ordner gespeichert werden

**Test-Schritte**:
1. Erstelle ein Dialograum-Item (hat `createInOwnFolder: true`)
2. Speichere das Item
3. Prüfe im Filesystem:
   - Wurde ein Ordner `{slugified-title}/` erstellt?
   - Liegt die Haupt-Markdown-Datei IN diesem Ordner?
   - Wurde der Shadow-Twin Ordner ebenfalls IN diesem Ordner erstellt?

**Erwartetes Ergebnis**:
```
{dialograum-title}/
  ├── {dialograum-title}.md (Hauptdatei)
  └── .{sourceName}/
      ├── {baseName}.de.md (Transcript)
      └── {baseName}.{templateName}.de.md (Transformation)
```

---

### 4. Vollständiger Flow-End-to-End
**Ziel**: Kompletter Flow von Anfang bis Ende

**Test-Schritte**:
1. Starte Creation Flow
2. Durchlaufe alle Steps:
   - Welcome
   - Quellen sammeln (mit mehreren Quellen)
   - Details bearbeiten
   - Preview anzeigen
3. Speichere das Item
4. Prüfe:
   - Wurde das Item korrekt gespeichert?
   - Sind alle Metadaten vorhanden?
   - Funktioniert die Vorschau?

**Erwartetes Ergebnis**:
- Flow läuft ohne Fehler durch
- Alle Daten werden korrekt gespeichert
- Item ist in der Library sichtbar

---

### 5. Zurückgehen zwischen Steps
**Ziel**: Prüfen, ob Navigation zwischen Steps funktioniert

**Test-Schritte**:
1. Starte Creation Flow
2. Füge eine Quelle hinzu
3. Gehe zu Details
4. Gehe zurück zu "Quellen sammeln"
5. Prüfe: Wird die Quelle-Auswahl wieder angezeigt?
6. Prüfe: Sind bereits hinzugefügte Quellen sichtbar?
7. Füge eine weitere Quelle hinzu
8. Gehe wieder zu Details

**Erwartetes Ergebnis**:
- Zurückgehen funktioniert ohne Datenverlust
- Quelle-Auswahl wird korrekt angezeigt
- Bereits hinzugefügte Quellen bleiben erhalten

---

### 6. Fehlerbehandlung
**Ziel**: Prüfen, wie Fehler behandelt werden

**Test-Schritte**:
1. Versuche eine ungültige URL einzugeben
2. Versuche eine sehr große Datei hochzuladen
3. Versuche ohne Quellen zu speichern
4. Prüfe: Werden aussagekräftige Fehlermeldungen angezeigt?

**Erwartetes Ergebnis**:
- Fehlermeldungen sind verständlich
- Flow kann nach Fehler fortgesetzt werden
- Keine Crashes oder unerwartete Zustände

---

### 7. Testimonial-Flow (Child-Flow)
**Ziel**: Prüfen, ob Testimonials korrekt in Event-Ordner gespeichert werden

**Test-Schritte**:
1. Erstelle einen Dialograum (mit `createInOwnFolder: true`)
2. Öffne den Dialograum
3. Starte Testimonial-Creation Flow (mit `targetFolderId`)
4. Erfasse ein Testimonial
5. Speichere das Testimonial
6. Prüfe im Filesystem:
   - Liegt das Testimonial im Dialograum-Ordner?
   - Hat das Testimonial seinen eigenen Shadow-Twin Ordner?

**Erwartetes Ergebnis**:
```
{dialograum-title}/
  ├── {dialograum-title}.md
  ├── {testimonial-title}.md
  ├── .{dialograum-source}/
  └── .{testimonial-source}/
```

---

### 8. Datenintegrität
**Ziel**: Prüfen, ob alle Daten korrekt gespeichert werden

**Test-Schritte**:
1. Erstelle Item mit mehreren Quellen
2. Bearbeite Metadaten in Details
3. Speichere das Item
4. Öffne das gespeicherte Item
5. Prüfe:
   - Sind alle Metadaten vorhanden?
   - Sind alle Quellen im Frontmatter?
   - Funktioniert Resume-Flow (falls implementiert)?

**Erwartetes Ergebnis**:
- Alle Daten sind vollständig
- Frontmatter enthält `creationFlowMetadata`
- Resume-Flow funktioniert (falls implementiert)

---

## 🐛 Bekannte Probleme / Edge Cases

### Zu testen:
- [ ] Was passiert, wenn keine Quellen hinzugefügt werden?
- [ ] Was passiert, wenn alle Quellen entfernt werden?
- [ ] Was passiert bei sehr langen Texten?
- [ ] Was passiert bei sehr vielen Quellen (>10)?
- [ ] Was passiert, wenn der Speicherort nicht verfügbar ist?

---

## 📝 Test-Protokoll

**Datum**: _______________
**Tester**: _______________
**Template**: _______________

### Ergebnisse:
- [ ] Multi-Source: ✅ / ❌
- [ ] Shadow-Twin Speicherung: ✅ / ❌
- [ ] Container-Folder: ✅ / ❌
- [ ] Vollständiger Flow: ✅ / ❌
- [ ] Zurückgehen: ✅ / ❌
- [ ] Fehlerbehandlung: ✅ / ❌
- [ ] Testimonial-Flow: ✅ / ❌
- [ ] Datenintegrität: ✅ / ❌

### Gefundene Probleme:
1. 
2. 
3. 

### Notizen:
___________________________________________________




