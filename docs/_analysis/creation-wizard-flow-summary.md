# Creation Wizard Flow - Detaillierte Zusammenfassung

## Übersicht: Schritt-für-Schritt

### Schritt 1: Welcome
**Was passiert:**
- Zeigt Willkommensnachricht (Markdown aus Template)
- Optional: Bild als Data-URL

**Bei "Weiter":**
- Geht automatisch zum nächsten Step (keine Validierung)

---

### Schritt 2: Briefing
**Was passiert:**
- Zeigt kompakte Liste der benötigten Felder
- Nutzer wählt Startmethode:
  - **"Formular ausfüllen"** → setzt `mode = 'form'`
  - **Quelle auswählen** (Text/URL/Datei) → setzt `mode = 'interview'` + `selectedSource`

**Bei "Weiter":**
- Prüft: `mode === 'form'` ODER `selectedSource` vorhanden
- Wenn Formular: Springt direkt zu `editDraft` (überspringt `collectSource` + `generateDraft`)
- Wenn Quelle gewählt: Geht zu `collectSource`

---

### Schritt 3: Collect Source (Eingeben)
**Was passiert:**

#### Multi-Source-System (neu):
- **Quellenliste oben**: Zeigt alle bisher hinzugefügten Quellen mit Summary
  - Jede Quelle kann entfernt werden (triggert Re-Extract)
- **Eingabe-Bereich unten**: Abhängig von gewählter Quelle

#### Text-Quelle (tippen oder diktieren):
1. **Textfeld** ist immer sichtbar
2. **Mic-Button**: 
   - Startet Aufnahme → Transkription läuft
   - Ergebnis erscheint im Textfeld
   - Nutzer kann Text **editieren**
3. **"Text-Quelle hinzufügen"** Button:
   - Erstellt `WizardSource` mit `kind: 'text'`
   - Ruft `addSource()` auf
   - **Triggert automatisch Re-Extract** mit gesamten Quellen

#### URL-Quelle:
1. **URL-Eingabefeld**
2. **"Webseite auslesen und hinzufügen"** Button:
   - Ruft `/api/secretary/import-from-url` auf
   - Extrahiert `structured_data` + `rawWebsiteText` (oder Fallback auf `markdown`)
   - Erstellt `WizardSource` mit:
     - `kind: 'url'`
     - `url`: Original-URL
     - `rawWebsiteText`: Rohtext für LLM (Point-of-Truth)
     - `summary`: Key-Value-Format für UI-Anzeige
   - Ruft `addSource()` auf
   - **Triggert automatisch Re-Extract** mit gesamten Quellen

#### Datei-Quelle:
1. **Datei-Upload**
2. Liest Dateiinhalt als Text
3. **"Datei-Quelle hinzufügen"** Button:
   - Erstellt `WizardSource` mit `kind: 'file'`
   - Ruft `addSource()` auf
   - **Triggert automatisch Re-Extract**

#### Re-Extract Mechanismus (automatisch nach jeder Quelle):
1. `buildCorpusText(sources)` baut Gesamtkorpus:
   - Format: `[Quelle: Typ | Info]\n...Inhalt...`
   - Für URL/File: Nutzt `rawWebsiteText`/`extractedText` (nicht Summary!)
2. `runExtraction(corpusText)`:
   - Ruft `/api/secretary/process-text` auf
   - Sendet gesamten Korpus
   - Erhält `structured_data` + `markdown`
   - Setzt `wizardState.generatedDraft`
   - Zeigt Toast: "Quellen wurden ausgewertet"

**Bei "Weiter":**
- Prüft: `sources.length > 0` (mindestens eine Quelle vorhanden)
- Wenn ja: Weiter möglich (auch wenn Extraction noch läuft oder fehlgeschlagen ist)
- Legacy: Fallback auf `collectedInput?.content`

**Auto-Skip:**
- Wenn `generateDraft` als nächster Step: Wird übersprungen, wenn `sources.length > 0` (weil Re-Extract bereits gelaufen ist)

---

### Schritt 4: Generate Draft (wird meist übersprungen)
**Was passiert:**
- Nur relevant, wenn **keine** Quellen vorhanden sind (Legacy-Flow)
- Ruft `/api/secretary/process-text` mit `collectedInput.content` auf
- Setzt `generatedDraft`

**Bei "Weiter":**
- Prüft: `mode === 'interview'` → braucht `generatedDraft`
- Prüft: `mode === 'form'` → kann übersprungen werden

**Auto-Skip:**
- Wird automatisch übersprungen, wenn `sources.length > 0` (Multi-Source-Flow)

---

### Schritt 5: Edit Draft (Formular-Modus)
**Was passiert:**
- Zeigt Formular für **alle** Metadaten-Felder
- Zeigt Markdown-Editor für Body-Text
- Nutzer kann alles direkt bearbeiten
- Änderungen werden in `draftMetadata` + `draftText` gespeichert

**Bei "Weiter":**
- Immer möglich (keine Validierung)

---

### Schritt 6: Review (vereinfachte Prüfung)
**Was passiert:**
- Zeigt **wichtige Felder** prominent
- Zeigt **optionale Felder** hinter "Mehr anzeigen"
- Nutzer kann Felder direkt bearbeiten
- Änderungen werden in `reviewedFields` gespeichert

**Bei "Weiter":**
- Immer möglich (keine Validierung)

---

### Schritt 7: Preview Detail
**Was passiert:**
- Rendert Detailansicht (BookDetail oder SessionDetail)
- Zeigt finales Ergebnis basierend auf:
  - `reviewedFields` ODER
  - `generatedDraft.metadata` ODER
  - `draftMetadata`

**Bei "Weiter":**
- Immer möglich (keine Validierung)

---

### Schritt 8: Speichern
**Was passiert:**
1. **Metadaten bestimmen** (Priorität):
   - `draftMetadata` (Form-Modus) ODER
   - `reviewedFields` ODER
   - `generatedDraft.metadata`
2. **Markdown bestimmen** (Priorität):
   - `draftText` (Form-Modus) ODER
   - `generatedDraft.markdown`
3. **Dateiname generieren**:
   - Nutzt `creation.output.fileName.metadataFieldKey` (z.B. `title`)
   - Slugifiziert Wert
   - Fallback: `typeId-YYYY-MM-DD.md`
4. **Frontmatter erstellen**:
   - YAML-Format mit allen Metadaten
5. **Datei speichern**:
   - Zielordner: `currentFolderIdAtom` (aktuelles Verzeichnis aus Jotai)
   - Fallback: `root`
   - Upload via `provider.uploadFile()`
6. **Refresh**:
   - Ruft `refreshItems(targetFolderId)` auf
7. **Navigation**:
   - Weiterleitung zu `/library`

---

## Wichtige Unterschiede: Multi-Source vs. Legacy

### Multi-Source-Flow (neu):
- **Quellen werden gesammelt** (`sources[]`)
- **Re-Extract nach jeder Quelle** (automatisch)
- **Korpus als Point-of-Truth**: Alle Quellen werden gemeinsam verarbeitet
- **generateDraft wird übersprungen** (weil Re-Extract bereits gelaufen ist)

### Legacy-Flow (alt):
- **Eine Quelle** (`collectedInput`)
- **Manueller generateDraft** Step nötig
- **Keine Quellenliste**

---

## Datenfluss-Diagramm

```
Welcome
  ↓
Briefing (wählt Mode + Source)
  ↓
Collect Source
  ├─ Quelle hinzufügen → addSource()
  ├─ Re-Extract (automatisch) → runExtraction()
  │   ├─ buildCorpusText(sources)
  │   ├─ /api/secretary/process-text
  │   └─ generatedDraft gesetzt
  └─ "Weiter" (wenn sources.length > 0)
  ↓
[Generate Draft] ← Wird übersprungen wenn sources vorhanden
  ↓
Edit Draft (Form-Modus) ODER Review (Interview-Modus)
  ↓
Preview Detail
  ↓
Speichern
  ├─ Dateiname generieren
  ├─ Frontmatter erstellen
  ├─ Upload zu currentFolderIdAtom
  └─ Redirect zu /library
```

---

## State-Management

### WizardState:
```typescript
{
  currentStepIndex: number
  mode?: 'interview' | 'form'
  selectedSource?: CreationSource
  sources: WizardSource[]          // Multi-Source: Liste aller Quellen
  collectedInput?: {...}          // Legacy: Einzelne Quelle
  generatedDraft?: {               // Ergebnis der Re-Extraction
    metadata: Record<string, unknown>
    markdown: string
  }
  reviewedFields?: Record<string, unknown>  // Manuelle Änderungen
  draftMetadata?: Record<string, unknown>   // Form-Modus
  draftText?: string                        // Form-Modus
  isExtracting?: boolean                    // Loading-State für Re-Extract
}
```

### WizardSource:
```typescript
{
  id: string
  kind: 'text' | 'url' | 'file'
  createdAt: Date
  // Für text:
  text?: string
  // Für url:
  url?: string
  rawWebsiteText?: string  // Für LLM (Point-of-Truth)
  summary?: string         // Für UI (lesbar)
  // Für file:
  fileName?: string
  extractedText?: string   // Für LLM
  summary?: string         // Für UI
}
```

---

## Wichtige Funktionen

### `runExtraction(sources)`
- Baut Korpus aus allen Quellen
- Ruft Secretary Service auf
- Setzt `generatedDraft`
- Wird automatisch nach `addSource()` / `removeSource()` aufgerufen

### `addSource(source)`
- Fügt Quelle zu `sources[]` hinzu
- Triggert `runExtraction()`

### `removeSource(sourceId)`
- Entfernt Quelle aus `sources[]`
- Triggert `runExtraction()` (mit verbleibenden Quellen)

### `buildCorpusText(sources)`
- Kombiniert alle Quellen zu einem Textkorpus
- Format: `[Quelle: Typ | Info]\n...Inhalt...`
- Nutzt `rawWebsiteText`/`extractedText` (nicht Summary!)

### `canProceed()`
- Prüft, ob "Weiter"-Button aktiviert sein soll
- Abhängig vom aktuellen Step-Preset





