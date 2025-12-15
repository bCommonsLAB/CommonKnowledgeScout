# Implementierungsplan: Generischer Creation-Wizard

## Ziel
Implementierung eines generischen Creation-Wizards, der Templates aus MongoDB lädt und die `creation.flow.steps` dynamisch rendert.

## Architektur

### 1. API-Route für Template-Daten
**`/api/templates/[templateId]/config`**
- Lädt Template aus MongoDB
- Gibt strukturiertes `TemplateDocument` zurück (inkl. `creation`-Block)
- Client-seitig verwendbar

### 2. Create-Seite
**`src/app/library/create/page.tsx`**
- Leitet Creation-Typen direkt aus MongoDB-Templates ab (Templates mit `creation`-Block)
- Zeigt Karten für jeden Creation-Typ
- Navigation zu Wizard-Seite mit `typeId` und `templateId`

### 3. Wizard-Seite
**`src/app/library/create/[typeId]/page.tsx`**
- Lädt Template-Konfiguration via API
- Rendert Wizard basierend auf `creation.flow.steps`
- State-Management für Wizard-Datenfluss

### 4. Step-Preset-Komponenten
**`src/components/creation-wizard/steps/`**
- `ChooseSourceStep.tsx` - Quelle auswählen (spoken/url/text/file)
- `CollectSourceStep.tsx` - Eingaben sammeln
- `GenerateDraftStep.tsx` - Secretary-Call ausführen
- `ReviewFieldsStep.tsx` - Metadaten-Felder zur Überprüfung

### 5. Wizard-Container
**`src/components/creation-wizard/creation-wizard.tsx`**
- Orchestriert Steps
- State-Management für Wizard-Daten
- Navigation zwischen Steps
- Finale Speicherung

## Datenfluss

1. **Create-Seite**: Lädt Templates aus MongoDB → filtert `creation` → zeigt Creation-Typen
2. **Wizard-Seite**: Lädt Template-Config → initialisiert Wizard
3. **Step 1 (chooseSource)**: Nutzer wählt Input-Quelle
4. **Step 2 (collectSource)**: Nutzer gibt Daten ein (je nach Quelle)
5. **Step 3 (generateDraft)**: Secretary-Call mit Template + Input
6. **Step 4 (reviewFields)**: Nutzer überprüft/korrigiert Metadaten
7. **Speicherung**: Finales Dokument wird gespeichert

## Implementierungsschritte

### Phase 1: API-Route für Template-Config ✅
- [x] `/api/templates/[templateId]/config` Route erstellen
- [x] Gibt `TemplateDocument` als JSON zurück

### Phase 2: Create-Seite
- [x] Create-Seite erstellt (`src/app/library/create/page.tsx`)
- [x] Creation-Typen aus Templates (MongoDB) laden
- [x] Karten für jeden Typ rendern
- [x] Navigation zu Wizard

### Phase 3: Wizard-Seite
- [x] Wizard-Seite erstellt (`src/app/library/create/[typeId]/page.tsx`)
- [x] Template-Config laden
- [x] Wizard-Container initialisieren

### Phase 4: Step-Presets
- [x] `ChooseSourceStep` implementiert
- [x] `CollectSourceStep` implementiert
- [x] `GenerateDraftStep` implementiert
- [x] `ReviewFieldsStep` implementiert

### Phase 5: Wizard-Container
- [x] State-Management für Wizard-Daten
- [x] Step-Navigation
- [x] Secretary-Call Integration
- [ ] Speicherung (End-to-End: Ziel-Item/Storage/Mongo Persistenz sauber definieren)

## Technische Details

### State-Struktur
```typescript
interface WizardState {
  currentStepIndex: number
  selectedSource?: CreationSource
  collectedInput?: {
    type: CreationSourceType
    content: string
  }
  generatedDraft?: {
    metadata: Record<string, unknown>
    markdown: string
  }
  reviewedFields?: Record<string, unknown>
}
```

### API-Integration
- Secretary-Call: `/api/secretary/process-text` mit `template` (Name) und `text` (Input)
- Template-Load: `/api/templates/[templateId]/config` für strukturierte Daten
- Speicherung: Storage-Provider für finale Markdown-Datei

