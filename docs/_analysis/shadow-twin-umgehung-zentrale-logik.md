# Shadow-Twin: Umgehung der zentralen Logik - Analyse

## Übersicht

Dieses Dokument listet alle Stellen im Code auf, die Shadow-Twin-Logik enthalten, aber **NICHT** die zentrale Logik aus `artifact-naming.ts` und `artifact-writer.ts` nutzen.

## Zentrale Logik

- **Namensgenerierung**: `buildArtifactName()` aus `src/lib/shadow-twin/artifact-naming.ts`
- **Schreiben**: `writeArtifact()` aus `src/lib/shadow-twin/artifact-writer.ts`
- **Lesen**: `resolveArtifact()` aus `src/lib/shadow-twin/artifact-resolver.ts`

## Gefundene Umgehungen

### 1. Legacy-Funktionen in `src/lib/storage/shadow-twin.ts`

**Funktionen:**
- `generateShadowTwinName()` - Generiert Namen nach alter Konvention
- `saveShadowTwin()` - Speichert Shadow-Twin direkt ohne zentrale Logik

**Verwendung:**
- `src/lib/processing/gates.ts` - Zeile 33, 133, 140
- `src/lib/shadow-twin/analyze-shadow-twin.ts` - Zeile 21, 201, 202
- `src/lib/external-jobs/extract-only.ts` - Zeile 116, 117
- `src/lib/integration-tests/pdf-upload.ts` - Zeile 19, 139, 140, 152

**Status:** ⚠️ Legacy - sollte durch `buildArtifactName()` ersetzt werden

---

### 2. `TransformService.generateShadowTwinName()` in `src/lib/transform/transform-service.ts`

**Funktion:** Zeile 135-139
- Generiert Namen nach alter Konvention: `{baseName}.{language}`

**Verwendung:**
- `src/lib/transform/transform-service.ts` - Zeile 218 (transformAudio)
- `src/lib/transform/batch-transform-service.ts` - Zeile 83-86

**Status:** ⚠️ Legacy - sollte durch `buildArtifactName()` ersetzt werden

---

### 3. `TransformService.saveTwinFile()` in `src/lib/transform/transform-service.ts`

**Funktion:** Zeile 950-1082
- Speichert Shadow-Twin direkt ohne zentrale Logik
- Nutzt eigene `generateUniqueFileName()` Logik
- Nutzt `parseArtifactName()` nur für Logging, nicht für Namensgenerierung

**Verwendung:**
- Wird von allen `TransformService.transform*()` Methoden verwendet
- `src/components/library/markdown-preview.tsx` - Zeile 367, 424

**Status:** ⚠️ Legacy - sollte durch `writeArtifact()` ersetzt werden

---

### 4. Eigene `generateShadowTwinName()` in `src/components/library/pdf-transform.tsx`

**Funktion:** Zeile 41-43
- Lokale Implementierung: `${baseName}.${targetLanguage}`

**Verwendung:**
- Nur lokal in `pdf-transform.tsx` - Zeile 50

**Status:** ⚠️ Sollte zentrale Logik nutzen

---

### 5. `src/lib/processing/gates.ts`

**Verwendung von Legacy-Funktionen:**
- Zeile 33: Import von `generateShadowTwinName`
- Zeile 133, 140: Direkte Verwendung von `generateShadowTwinName()`

**Status:** ⚠️ Sollte `resolveArtifact()` nutzen (bereits teilweise integriert)

---

### 6. `src/lib/shadow-twin/analyze-shadow-twin.ts`

**Verwendung:**
- Zeile 21: Import von `generateShadowTwinName`
- Zeile 201-202: Generiert Namen für Suche nach Shadow-Twins

**Status:** ⚠️ Sollte `resolveArtifact()` nutzen

---

### 7. `src/lib/external-jobs/extract-only.ts`

**Verwendung:**
- Zeile 116-117: Dynamischer Import und Verwendung von `generateShadowTwinName()`

**Status:** ⚠️ Sollte `writeArtifact()` nutzen

---

### 8. `src/lib/integration-tests/pdf-upload.ts`

**Verwendung:**
- Zeile 19: Import von `generateShadowTwinName`
- Zeile 139-140, 152: Verwendung für Test-Setup

**Status:** ⚠️ Test-Code - kann Legacy-Funktionen nutzen, sollte aber dokumentiert sein

---

## Empfehlungen

### Priorität 1: TransformService umstellen
- `TransformService.saveTwinFile()` sollte `writeArtifact()` nutzen
- `TransformService.generateShadowTwinName()` sollte `buildArtifactName()` nutzen

### Priorität 2: Gates und Analyse umstellen
- `gates.ts` sollte vollständig auf `resolveArtifact()` umstellen
- `analyze-shadow-twin.ts` sollte `resolveArtifact()` nutzen

### Priorität 3: Extract-Only umstellen
- `extract-only.ts` sollte `writeArtifact()` nutzen

### Priorität 4: UI-Komponenten bereinigen
- `pdf-transform.tsx` sollte zentrale Logik nutzen
- Alle anderen Transform-Komponenten prüfen

### Priorität 5: Legacy-Funktionen deprecaten
- `generateShadowTwinName()` und `saveShadowTwin()` als deprecated markieren
- Nach vollständiger Migration entfernen

## Migration-Strategie

1. **Phase 1**: TransformService auf zentrale Logik umstellen
2. **Phase 2**: Gates und Analyse umstellen
3. **Phase 3**: Extract-Only und andere Jobs umstellen
4. **Phase 4**: UI-Komponenten bereinigen
5. **Phase 5**: Legacy-Funktionen entfernen




