# Shadow-Twin: Deterministische Architektur

**Status:** Analyse abgeschlossen, Refactoring erforderlich  
**Erstellt:** 2026-01-29  
**Bezug:** Coverbild-Upload-Fehler wegen fehlendem templateName

---

## 1. Grundprinzip: Ein Shadow-Twin ist deterministisch

Ein Shadow-Twin ist **KEIN optionales Konstrukt**. Es hat deterministische Parameter, ohne die es nicht funktionieren kann.

### ArtifactKey - Die Pflichtparameter

```typescript
interface ArtifactKey {
  sourceId: string;         // PFLICHT - ID der Quelldatei
  kind: ArtifactKind;       // PFLICHT - 'transcript' | 'transformation' | 'canonical' | 'raw'
  targetLanguage: string;   // PFLICHT - z.B. 'de', 'en'
  templateName?: string;    // PFLICHT für 'transformation', undefined für andere
}
```

### Regel: templateName ist für Transformationen PFLICHT

| kind | templateName | Beispiel-Dateiname |
|------|--------------|-------------------|
| `transcript` | MUSS `undefined` sein | `document.de.md` |
| `transformation` | MUSS gesetzt sein | `document.klimamassnahme-detail-de.de.md` |
| `canonical` | MUSS `undefined` sein | `document.canonical.de.md` |
| `raw` | MUSS `undefined` sein | `document.raw.html` |

**Ein Shadow-Twin mit `kind='transformation'` ohne `templateName` ist UNGÜLTIG und darf nicht existieren.**

---

## 2. Identifizierte Fallback-Lösungen (PROBLEMATISCH)

### 2.1 MongoShadowTwinStore - "Wähle beste Transformation"

**Datei:** `src/lib/shadow-twin/store/mongo-shadow-twin-store.ts`

```typescript
// Zeile 39 und 60:
if (key.kind === 'transformation' && (!key.templateName || key.templateName.trim().length === 0)) {
  // PROBLEMATISCH: Sucht "irgendeine" Transformation
  const selected = selectShadowTwinArtifact(doc, 'transformation', key.targetLanguage)
}
```

**Problem:** Nicht-deterministisches Verhalten. "Beste" = neueste, aber das kann sich ändern.

**Empfehlung:** Fehler werfen statt raten.

### 2.2 ShadowTwinService - templateName aus Frontmatter/ID

**Datei:** `src/lib/shadow-twin/store/shadow-twin-service.ts`

```typescript
// Zeile 626-648:
if (!templateName && kind === 'transformation') {
  // Versuche aus Frontmatter zu extrahieren
  if (existing.frontmatter?.template_used) {
    templateName = String(existing.frontmatter.template_used)
  } else if (isMongoShadowTwinId(existing.id)) {
    // Fallback: Aus der ID extrahieren
    const parsed = parseMongoShadowTwinId(existing.id)
    templateName = parsed?.templateName
  }
}
```

**Problem:** Das ist eine Rettungsaktion für fehlerhafte Aufrufe. Der Caller sollte templateName kennen.

**Empfehlung:** Caller muss templateName liefern, sonst Fehler.

### 2.3 Artifact Resolver - Template-agnostische Auflösung

**Datei:** `src/lib/shadow-twin/artifact-resolver.ts`

```typescript
// Zeile 137-141:
/**
 * Template-agnostische Auflösung:
 * wenn kind === 'transformation' und templateName fehlt, wählen wir die "beste"
 */
function pickBestTransformation(items: StorageItem[]): StorageItem | null {
  // Sortiert nach modifiedAt, nimmt neueste
}
```

**Problem:** Nicht-deterministisch. Bei mehreren Templates wird "irgendeine" gewählt.

**Empfehlung:** Explizit templateName erfordern oder alle Templates zurückgeben.

---

## 3. Legitime Fallback-Muster

Diese Fallbacks sind KORREKT und sollten beibehalten werden:

### 3.1 Storage-Fallback (MongoDB → Filesystem)

```typescript
// Primary: MongoDB
// Fallback: Filesystem (für Migration/Kompatibilität)
if (this.fallbackStore) {
  const fallbackResult = await this.fallbackStore.getArtifactMarkdown(key)
}
```

**Legitim:** Zwei verschiedene Storage-Backends, gleiche deterministische Keys.

### 3.2 URL-Auflösung (Azure → Storage-API)

```typescript
// Bevorzugt: Azure Blob Storage URL
if (fragment.url) return fragment.url
// Fallback: Dateisystem-Referenz → Storage-API-URL
if (fragment.fileId) return `/api/storage/filesystem?...`
```

**Legitim:** Abstrahiert Storage-Backend für UI.

### 3.3 Dateiname-Parsing (defensive Programmierung)

```typescript
// Fallback bei unbekanntem Pattern
if (!targetLanguage && fileName.endsWith('.md')) {
  kind = 'transcript'
}
```

**Legitim:** Legacy-Kompatibilität für existierende Dateien.

---

## 4. Woher kommt templateName?

### 4.1 Bei Job-Erstellung (External Jobs)

```typescript
// src/app/api/external/jobs/[jobId]/start/route.ts
const templateEnabled = !!libraryConfig?.templateName
const templateName = libraryConfig?.templateName
```

**templateName kommt aus Library-Konfiguration.**

### 4.2 Bei UI-Anzeige (JobReportTab)

```typescript
// Aus Job-Metadaten:
const templateName = job?.cumulativeMeta?.template_used
// Aus Frontmatter:
const templateName = frontmatterMeta?.template_used
```

**templateName wird im Frontmatter als `template_used` gespeichert.**

### 4.3 Bei Shadow-Twin-State

```typescript
// Aus shadowTwinState.transformed
// Die ID enthält das templateName:
// mongo-shadow-twin:libraryId::sourceId::transformation::de::klimamassnahme-detail-de
```

---

## 5. Handlungsempfehlungen

### 5.1 SOFORT: Fehler statt Fallback in patchArtifactFrontmatter

```typescript
// VORHER (aktuell):
if (!templateName && kind === 'transformation') {
  // Versuche zu erraten...
}

// NACHHER (empfohlen):
if (kind === 'transformation' && !templateName) {
  throw new Error(
    `templateName ist erforderlich für Transformation. ` +
    `Caller muss templateName explizit übergeben.`
  )
}
```

### 5.2 MITTELFRISTIG: UI-Code anpassen

Der Caller (UI) muss templateName aus verfügbaren Quellen holen:

```typescript
// In saveCoverImage():
const templateName = 
  frontmatterMeta?.template_used ||
  job?.cumulativeMeta?.template_used ||
  shadowTwinState?.transformed?.metadata?.templateName // falls verfügbar

if (!templateName) {
  toast.error('Template-Name nicht verfügbar. Bitte Seite neu laden.')
  return
}
```

### 5.3 LANGFRISTIG: selectShadowTwinArtifact() refactoren

```typescript
// VORHER:
function selectShadowTwinArtifact(doc, kind, language) {
  // Wählt "beste" wenn templateName fehlt
}

// NACHHER (Option A - Strict):
function getArtifactStrict(doc, kind, language, templateName) {
  if (kind === 'transformation' && !templateName) {
    throw new Error('templateName required for transformation')
  }
  // Exakter Match
}

// NACHHER (Option B - List all):
function listTransformations(doc, language): ArtifactRecord[] {
  // Gibt ALLE Transformationen zurück, Caller wählt
}
```

---

## 6. Dokumentation-Status

| Dokument | Status | Kommentar |
|----------|--------|-----------|
| `shadow-twin-architecture.mdc` | ✅ GÜLTIG | Storage-Abstraktion korrekt |
| `shadow-twin-v2-only.md` | ✅ GÜLTIG | v2-only Runtime korrekt |
| `shadow-twin-source-selection.md` | ✅ GÜLTIG | Purpose-basierte Quellenwahl korrekt |
| `shadow-twin-mongo-target-structure.md` | ✅ GÜLTIG | MongoDB-Struktur korrekt |
| `shadow-twin-mongo-migration-plan.md` | ⚠️ VERALTET | Migration größtenteils abgeschlossen |

---

## 7. Checkliste für Entwickler

Vor jeder Änderung im Shadow-Twin-Bereich:

- [ ] Ist `templateName` für Transformationen IMMER gesetzt?
- [ ] Werfe ich einen Fehler wenn `templateName` fehlt (statt zu raten)?
- [ ] Kommt `templateName` aus einer verlässlichen Quelle (nicht aus ID extrahiert)?
- [ ] Gibt es "wähle beste/neueste" Logik? → Refactoren!
- [ ] Ist der Code deterministisch? (Gleiche Eingabe → Gleiches Ergebnis)
