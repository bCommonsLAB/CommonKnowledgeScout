# Analyse: Creation Wizard Step Presets

## Übersicht aller Presets

### 1. `welcome` ✅ **WIRD BENÖTIGT**
- **Bedeutung**: Willkommensseite am Anfang des Wizards
- **Verwendung**: Zeigt Markdown-Inhalt mit Erklärung des Prozesses
- **Status**: Aktiv verwendet in allen Templates
- **Empfehlung**: Behalten

### 2. `briefing` ⚠️ **REDUNDANT**
- **Bedeutung**: Zeigt Spickzettel der benötigten Felder + Quelle-Auswahl
- **Verwendung**: Wird verwendet, aber `collectSource` zeigt jetzt auch Quelle-Auswahl
- **Problem**: Doppelte Funktionalität mit `collectSource`
- **Empfehlung**: **ENTFERNEN** - Funktionalität ist jetzt in `collectSource` integriert

### 3. `chooseSource` ❌ **REDUNDANT**
- **Bedeutung**: Separate Quelle-Auswahl
- **Verwendung**: Wird noch im Code unterstützt, aber nicht mehr in Templates verwendet
- **Problem**: Funktionalität ist jetzt in `collectSource` integriert (zeigt Quelle-Auswahl wenn keine ausgewählt)
- **Empfehlung**: **ENTFERNEN** - Funktionalität ist jetzt in `collectSource` integriert

### 4. `collectSource` ✅ **WIRD BENÖTIGT**
- **Bedeutung**: Quelle sammeln (zeigt Quelle-Auswahl wenn keine ausgewählt, sonst entsprechenden Dialog)
- **Verwendung**: Haupt-Step für Multi-Source-Sammlung
- **Status**: Aktiv verwendet, wurde erweitert um Quelle-Auswahl zu zeigen
- **Empfehlung**: Behalten

### 5. `reviewSources` ❌ **NICHT MEHR BENÖTIGT**
- **Bedeutung**: Human-in-the-loop Gate - Quellen prüfen vor Transformation
- **Verwendung**: Wurde vom User explizit als nicht benötigt markiert
- **Status**: Wurde aus Templates entfernt
- **Empfehlung**: **ENTFERNEN** - User-Feedback: "Das mit den Quellenprüfen brauchen wir nicht"

### 6. `generateDraft` ⚠️ **TEILWEISE REDUNDANT**
- **Bedeutung**: LLM-Transformation der Eingabe zu strukturierten Daten + Markdown
- **Verwendung**: Wird automatisch übersprungen wenn Quellen vorhanden sind (Extraktion passiert automatisch)
- **Problem**: Wird in Multi-Source-Flow automatisch übersprungen, macht Step redundant
- **Empfehlung**: **OPTIONAL BEHALTEN** für Legacy-Templates, aber nicht mehr in neuen Templates verwenden

### 7. `editDraft` ✅ **WIRD BENÖTIGT**
- **Bedeutung**: Formular-Modus für Metadaten-Bearbeitung mit Feld-Auswahl
- **Verwendung**: Wird aktiv verwendet für strukturierte Eingabe
- **Status**: Aktiv verwendet
- **Empfehlung**: Behalten

### 8. `previewDetail` ✅ **WIRD BENÖTIGT**
- **Bedeutung**: Vorschau der fertigen Detailseite
- **Verwendung**: Wird aktiv verwendet als letzter Step vor dem Speichern
- **Status**: Aktiv verwendet
- **Empfehlung**: Behalten

### 9. `uploadImages` ✅ **WIRD BENÖTIGT**
- **Bedeutung**: Optionaler Step zum Hochladen von Bildern für konfigurierte Bildfelder
- **Verwendung**: Wird verwendet wenn `imageFieldKeys` in `editDraft` Steps konfiguriert sind
- **Status**: Aktiv verwendet (z.B. in Testimonial-Template)
- **Empfehlung**: Behalten

### 10. `selectRelatedTestimonials` ✅ **WIRD BENÖTIGT**
- **Bedeutung**: Auswahl/Exclude von gefundenen Testimonials (für Dialograum-Ergebnis)
- **Verwendung**: Spezifisch für Dialograum-Ergebnis-Templates
- **Status**: Aktiv verwendet
- **Empfehlung**: Behalten

## Zusammenfassung

### ✅ Zu behalten (6 Presets):
1. `welcome` - Willkommensseite
2. `collectSource` - Quelle sammeln (mit integrierter Quelle-Auswahl)
3. `editDraft` - Metadaten-Bearbeitung
4. `previewDetail` - Vorschau
5. `uploadImages` - Bild-Upload (optional)
6. `selectRelatedTestimonials` - Testimonial-Auswahl (spezifisch)

### ❌ Zu entfernen (4 Presets):
1. `briefing` - Redundant zu `collectSource`
2. `chooseSource` - Redundant zu `collectSource`
3. `reviewSources` - User-Feedback: nicht benötigt
4. `generateDraft` - Wird automatisch übersprungen in Multi-Source-Flow

## Empfohlene Aktionen

1. **Code-Bereinigung**: Entferne `briefing`, `chooseSource`, `reviewSources` aus dem Code
2. **Template-Migration**: Aktualisiere bestehende Templates, die diese Presets verwenden
3. **Dokumentation**: Aktualisiere Template-Dokumentation mit neuen Presets
4. **`generateDraft`**: Optional behalten für Legacy-Support, aber nicht mehr in neuen Templates verwenden

## Typischer Flow nach Bereinigung

```
welcome → collectSource → editDraft → [uploadImages] → previewDetail
```

Optional:
- `selectRelatedTestimonials` für Dialograum-Ergebnis-Templates
- `generateDraft` nur für Legacy-Templates ohne Multi-Source-Support




