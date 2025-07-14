# PDF-Extraktionsmethoden

## Übersicht

Das CommonKnowledgeScout System unterstützt verschiedene Methoden zur Extraktion von Inhalten aus PDF-Dateien. Jede Methode ist für spezifische Anwendungsfälle optimiert.

## Verfügbare Extraktionsmethoden

### 1. Native Analyse (`native`)
- **Beschreibung**: Standard-Text-Extraktion aus PDF-Dateien
- **Verwendung**: Für PDFs mit eingebettetem Text (z.B. digital erstellte Dokumente)
- **Vorteile**: Schnell, präzise für strukturierte Dokumente
- **Nachteile**: Funktioniert nicht bei gescannten Dokumenten

### 2. Tesseract OCR (`ocr`)
- **Beschreibung**: Optical Character Recognition mit Tesseract
- **Verwendung**: Für gescannte PDFs oder Dokumente ohne eingebetteten Text
- **Vorteile**: Kann Text aus Bildern extrahieren
- **Nachteile**: Langsamer, mögliche OCR-Fehler

### 3. OCR + Native (`both`)
- **Beschreibung**: Kombiniert native Text-Extraktion mit OCR
- **Verwendung**: Für gemischte Dokumente (teilweise Text, teilweise Bilder)
- **Vorteile**: Maximale Text-Extraktion
- **Nachteile**: Langsamer, größere Dateien

### 4. Vorschaubilder (`preview`)
- **Beschreibung**: Extrahiert nur Vorschaubilder jeder Seite
- **Verwendung**: Für visuelle Dokumentenanalyse
- **Vorteile**: Schnell, gut für Qualitätskontrolle
- **Nachteile**: Kein Text-Inhalt

### 5. Vorschaubilder + Native (`preview_and_native`)
- **Beschreibung**: Kombiniert Vorschaubilder mit Text-Extraktion
- **Verwendung**: Für Dokumente mit visuellen und textuellen Elementen
- **Vorteile**: Vollständige Dokumentenanalyse
- **Nachteile**: Größere Ausgabedateien

### 6. LLM-basierte OCR (`llm`)
- **Beschreibung**: KI-basierte Texterkennung mit Large Language Models
- **Verwendung**: Für komplexe Dokumente mit ungewöhnlichen Layouts
- **Vorteile**: Hohe Genauigkeit, versteht Kontext
- **Nachteile**: Langsamer, höhere Kosten

### 7. LLM + OCR (`llm_and_ocr`)
- **Beschreibung**: Kombiniert LLM-basierte Analyse mit traditioneller OCR
- **Verwendung**: Für anspruchsvolle Dokumente mit gemischten Inhalten
- **Vorteile**: Maximale Genauigkeit und Flexibilität
- **Nachteile**: Langsamste Methode, höchste Kosten

## Empfehlungen

### Für verschiedene Dokumententypen:

1. **Digitale Dokumente** (Word/PDF exportiert): `native`
2. **Gescannte Dokumente**: `ocr` oder `llm`
3. **Gemischte Dokumente**: `both` oder `llm_and_ocr`
4. **Visuelle Analyse**: `preview` oder `preview_and_native`
5. **Komplexe Layouts**: `llm` oder `llm_and_ocr`

### Performance-Kriterien:

- **Geschwindigkeit**: `native` > `preview` > `ocr` > `both` > `llm` > `llm_and_ocr`
- **Genauigkeit**: `llm_and_ocr` > `llm` > `both` > `ocr` > `native` > `preview`
- **Kosten**: `llm_and_ocr` > `llm` > `both` > `ocr` > `native` = `preview`

## Technische Implementierung

Die Extraktionsmethoden werden über die `extractionMethod`-Parameter in der PDF-Transformations-API gesteuert:

```typescript
const options = {
  extractionMethod: "llm", // Eine der verfügbaren Methoden
  targetLanguage: "de",
  useCache: true,
  includeImages: false
};
```

## Cache-Verhalten

Alle Extraktionsmethoden unterstützen Caching für bessere Performance bei wiederholten Verarbeitungen derselben Dokumente. 