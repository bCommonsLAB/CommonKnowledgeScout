# Quick Test Guide: Generischer Creation-Flow

## Schnelltest: Was funktioniert bereits?

### ✅ Template-Parsing & Views

**Test 1: Template parsen**
```typescript
import { parseTemplateContent } from '@/lib/templates/template-service'

const content = `---
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
Body text

--- systemprompt
Role: You are...
`

const { template, errors } = parseTemplateContent(content, 'test-template')
console.log('Template:', template)
console.log('Errors:', errors)
console.log('Has creation:', !!template.creation)
```

**Erwartung**: Template wird korrekt geparst, `creation`-Block ist vorhanden

**Test 2: Views erstellen**
```typescript
import { getUxConfig, getPromptConfig } from '@/lib/templates/template-service'

const uxConfig = getUxConfig(template)
const promptConfig = getPromptConfig(template)

console.log('UxConfig:', uxConfig)
console.log('PromptConfig:', promptConfig)
console.log('PromptConfig has creation:', 'creation' in promptConfig) // sollte false sein
```

**Erwartung**: 
- `UxConfig` enthält `creation`
- `PromptConfig` enthält KEIN `creation`

### ✅ Template-Editor

**Test 3: Creation-Flow Tab**
1. Template-Management öffnen (`/settings/templates` oder ähnlich)
2. Template mit creation-Block auswählen
3. Zu "Creation Flow" Tab wechseln
4. Prüfen:
   - Werden Quellen angezeigt?
   - Können Quellen hinzugefügt/entfernt werden?
   - Werden Steps angezeigt?
   - Können Steps hinzugefügt/entfernt werden?
5. Änderungen speichern
6. Template neu laden und prüfen

**Erwartung**: UI funktioniert, Speichern persistiert Änderungen

### ✅ Create-Seite

**Test 4: Dynamische Typen**
1. Stelle sicher, dass ein Template in MongoDB einen `creation`-Block hat (z.B. `Session_analyze_en`).
2. `/library/create` öffnen
3. Prüfen, ob der Typ als Karte angezeigt wird (Name/Beschreibung/Icon idealerweise aus `creation.ui`)

**Erwartung**: Typ wird direkt aus MongoDB-Templates mit `creation`-Block abgeleitet und angezeigt

## Bekannte Probleme / Einschränkungen

1. **Source-Presets ggf. noch nicht vollständig produktiv**:
   - Je nach Preset können Diktat/URL-Scraping/Datei-Extraktion noch als Mock/Placeholder umgesetzt sein
   - Iterativ durch echte Implementierung ersetzen (Web APIs, Parser, Upload-Pipelines)

## Nächste Schritte für vollständiges Testen

1. **End-to-End Test**: Wizard → Secretary → Review → Persistenz (für mindestens einen Typ, z.B. Session)
2. **Input-Sources härten**: URL/File/Diktat Presets produktiv machen (keine Mocks)
3. **Fehler-/Validierungs-UX**: Validierungsmeldungen konsistent und verständlich halten



