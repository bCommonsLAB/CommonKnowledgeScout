# Bild-Transformation mit OCR

## Übersicht

Das CommonKnowledgeScout System unterstützt jetzt die Transformation von Bilddateien mittels OCR (Optical Character Recognition) und LLM-basierter Analyse. Diese Funktion ermöglicht es, Text aus Bildern zu extrahieren und als strukturierte Markdown-Dateien zu speichern.

## Unterstützte Bildformate

- **JPEG** (.jpg, .jpeg)
- **PNG** (.png)
- **WebP** (.webp)
- **TIFF** (.tiff, .tif)
- **BMP** (.bmp)

## Verfügbare Extraktionsmethoden

### 1. Tesseract OCR (`ocr`)
- **Beschreibung**: Traditionelle OCR mit Tesseract
- **Verwendung**: Für klare, gut lesbare Texte in Bildern
- **Vorteile**: Schnell, gut für strukturierte Dokumente
- **Nachteile**: Kann bei komplexen Layouts Probleme haben

### 2. LLM-basierte OCR (`llm`)
- **Beschreibung**: KI-basierte Texterkennung mit Large Language Models
- **Verwendung**: Für komplexe Dokumente mit ungewöhnlichen Layouts
- **Vorteile**: Hohe Genauigkeit, versteht Kontext, erkennt Handschrift
- **Nachteile**: Langsamer, höhere Kosten

### 3. LLM + OCR (`llm_and_ocr`)
- **Beschreibung**: Kombiniert LLM-basierte Analyse mit traditioneller OCR
- **Verwendung**: Für anspruchsvolle Dokumente mit gemischten Inhalten
- **Vorteile**: Maximale Genauigkeit und Flexibilität
- **Nachteile**: Langsamste Methode, höchste Kosten

### 4. Native Bildanalyse (`native`)
- **Beschreibung**: Standard-Bildanalyse ohne OCR
- **Verwendung**: Für Bilder ohne Text oder für Metadaten-Extraktion
- **Vorteile**: Schnell, gut für Bildbeschreibungen
- **Nachteile**: Keine Textextraktion

### 5. OCR + Native (`both`)
- **Beschreibung**: Kombiniert OCR mit nativer Bildanalyse
- **Verwendung**: Für Bilder mit Text und visuellen Elementen
- **Vorteile**: Vollständige Bildanalyse
- **Nachteile**: Langsamer, größere Ausgabedateien

### 6. Vorschaubilder (`preview`)
- **Beschreibung**: Extrahiert nur Vorschaubilder
- **Verwendung**: Für visuelle Dokumentenanalyse
- **Vorteile**: Schnell, gut für Qualitätskontrolle
- **Nachteile**: Kein Text-Inhalt

### 7. Vorschaubilder + Native (`preview_and_native`)
- **Beschreibung**: Kombiniert Vorschaubilder mit nativer Analyse
- **Verwendung**: Für Dokumente mit visuellen und textuellen Elementen
- **Vorteile**: Vollständige Dokumentenanalyse
- **Nachteile**: Größere Ausgabedateien

## Verwendung in der Anwendung

### 1. Bild auswählen
- Navigieren Sie zu einem Bild in der Bibliothek
- Klicken Sie auf das Bild, um es zu öffnen

### 2. Transformation starten
- Klicken Sie auf den "Transformieren"-Button in der Bildvorschau
- Wählen Sie die gewünschte Extraktionsmethode
- Konfigurieren Sie die Optionen:
  - **Zielsprache**: Sprache für die Ausgabe
  - **Extraktionsmethode**: OCR-Methode (siehe oben)
  - **Cache verwenden**: Beschleunigt wiederholte Verarbeitungen
  - **Dateiname**: Automatisch generiert als `{originalname}.{sprache}.md`

### 3. Verarbeitung
- Das Bild wird an den Secretary Service gesendet
- Die OCR-Verarbeitung läuft asynchron
- Der Fortschritt wird in der UI angezeigt

### 4. Ergebnis
- Eine Markdown-Datei wird im gleichen Ordner erstellt
- Der Dateiname folgt der Konvention: `{originalname}.{sprache}.md`
- Die Datei enthält den extrahierten Text mit Metadaten im YAML-Frontmatter

## Technische Implementierung

### API-Endpunkt
```
POST /api/secretary/process-image
```

### Parameter
- `file`: Bilddatei (multipart/form-data)
- `targetLanguage`: Zielsprache (z.B. "de", "en")
- `extraction_method`: Extraktionsmethode (siehe oben)
- `useCache`: Cache verwenden (boolean)
- `context`: Optionaler JSON-Kontext für LLM-Optimierung

### Response
```json
{
  "status": "success",
  "data": {
    "extracted_text": "Extrahierter Text aus dem Bild...",
    "metadata": {
      "file_name": "original.jpg",
      "file_size": 123456,
      "dimensions": "1920x1080",
      "format": "JPEG",
      "extraction_method": "llm"
    }
  }
}
```

## Metadaten im Frontmatter

Die generierte Markdown-Datei enthält umfangreiche Metadaten im YAML-Frontmatter:

```yaml
---
source_file: "original.jpg"
source_file_id: "file-id"
source_file_size: 123456
source_file_type: "image/jpeg"
target_language: "de"
dimensions: "1920x1080"
format: "JPEG"
color_mode: "RGB"
dpi: "96x96"
extraction_method: "llm"
process_id: "process-id"
processor: "ImageOCRProcessor"
processing_duration_ms: 5000
model_used: "gpt-4o-mini"
tokens_used: 1234
cache_used: false
cache_key: "cache-key"
---
```

## Empfehlungen

### Für verschiedene Bildtypen:

1. **Dokumente mit klarem Text**: `ocr`
2. **Handschriftliche Texte**: `llm`
3. **Komplexe Layouts**: `llm_and_ocr`
4. **Bilder ohne Text**: `native`
5. **Gemischte Inhalte**: `both`
6. **Visuelle Analyse**: `preview` oder `preview_and_native`

### Performance-Kriterien:

- **Geschwindigkeit**: `native` > `preview` > `ocr` > `both` > `llm` > `llm_and_ocr`
- **Genauigkeit**: `llm_and_ocr` > `llm` > `both` > `ocr` > `native` > `preview`
- **Kosten**: `llm_and_ocr` > `llm` > `both` > `ocr` > `native` = `preview`

## Fehlerbehebung

### Häufige Probleme:

1. **Kein Text gefunden**: Versuchen Sie eine andere Extraktionsmethode
2. **Langsame Verarbeitung**: Aktivieren Sie Cache für wiederholte Verarbeitungen
3. **Ungenauigkeiten**: Verwenden Sie LLM-basierte Methoden für komplexe Dokumente

### Support:

Bei Problemen prüfen Sie die Logs in der Browser-Konsole oder kontaktieren Sie den Support. 