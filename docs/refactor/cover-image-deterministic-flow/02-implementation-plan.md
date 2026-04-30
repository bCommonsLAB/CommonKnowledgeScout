# 02-Implementation-Plan: Konkrete Code-Aenderungen

**Stand:** 2026-04-30
**Vorlage:** [01-analysis.md](./01-analysis.md)

## 1) Reihenfolge der Aenderungen

```
1. NEU: src/lib/templates/media-existence-validator.ts
2. NEU: src/lib/templates/available-media-loader.ts
3. NEU: tests/unit/lib/templates/media-existence-validator.test.ts
4. UPDATE: src/lib/external-jobs/phase-template.ts (CONTEXT + Validator-Aufruf)
5. UPDATE: src/components/library/media-tab.tsx (UI-Banner)
6. UPDATE: src/components/library/job-report-tab.tsx (Hardcoded Fallbacks raus)
7. UPDATE: template-samples/pc-steckbrief-de.md (Systemprompt-Klausel)
8. UPDATE: weitere Templates mit coverImageUrl-Feld (Klausel anwenden)
9. UPDATE: tests/unit/components/library/media-tab.test.tsx (Banner-Test)
10. VERIFY: pnpm test, pnpm build
11. VERIFY: manuelles Browser-Testszenario dokumentieren
```

## 2) Datei: `src/lib/templates/media-existence-validator.ts` (NEU)

**Zweck:** Pure-Function-Modul, validiert Medien-Felder gegen Liste verfuegbarer Medien.

**Exports:**
- `interface AvailableMediaEntry`
- `interface MediaValidationReport`
- `interface MediaValidationResult`
- `interface MediaFieldsConfig`
- `function buildMediaFieldsConfig(detailViewType: string, libraryConfig?: Record<string, unknown>): MediaFieldsConfig`
- `function validateMediaExistence(meta, availableMedia, mediaConfig): MediaValidationResult`

**Pure-Function-Constraint:** Keine I/O, keine Logger-Calls (Logging passiert beim Aufrufer).

**Test-Coverage:**
- String-Feld: gueltig / ungueltig / null / leer
- Array-Feld: alle gueltig / alle ungueltig / gemischt / leer
- Twin-Relativpfad-Match (`_quelle.pdf/img-0.jpeg`)
- Absolute URL → rejected
- Verschiedene `MediaFieldsConfig`s (book, session, refurbedDevice)
- Empty `availableMedia` → alle rejected

## 3) Datei: `src/lib/templates/available-media-loader.ts` (NEU)

**Zweck:** Server-side Helper, laedt Sibling-Files + binaryFragments fuer eine Quelldatei und buildet `AvailableMediaEntry[]`.

**Exports:**
- `async function loadAvailableMediaForSource(libraryId, sourceItemId, parentId, options?): Promise<AvailableMediaEntry[]>`

**Implementierung:**
- Nutzt `LibraryService` + `ShadowTwinService` direkt (kein HTTP-Call zu eigenen API-Routes)
- Limit: max. 50 Eintraege, Sortierung: Sibling zuerst, dann Fragmente
- Fehler beim Storage-Zugriff: throw (kein leerer Fallback, sonst rejected Validator alles!)

**Test-Coverage:** Optional, da reiner I/O-Wrapper. Kann mit Mock-Provider getestet werden.

## 4) Datei: `src/lib/external-jobs/phase-template.ts` (UPDATE)

### 4.1 CONTEXT-Block erweitern (Z.842-877)

```typescript
// VORHER (Z.842-877)
const sourceContext: Record<string, unknown> = {}
// ... fileName, fileExtension, mimeType, filePath, fileModifiedAt

// NACHHER (zusaetzlich vor Z.901)
try {
  const { loadAvailableMediaForSource } = await import('@/lib/templates/available-media-loader')
  const availableMedia = await loadAvailableMediaForSource(
    libraryId,
    sourceItemId,
    parentId,
  )
  sourceContext.availableMedia = availableMedia
  if (availableMedia.length >= 50) {
    sourceContext.availableMediaTruncated = true
  }
  bufferLog(jobId, {
    phase: 'transform_context',
    message: `availableMedia: ${availableMedia.length} Eintraege geladen`,
  })
} catch (err) {
  // KEIN stiller Fallback: wenn wir die Liste nicht laden koennen,
  // wuerde der Validator spaeter ALLES rejecten.
  // Stattdessen: Job mit klarem Fehler beenden.
  throw new Error(
    `availableMedia konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`,
  )
}
```

### 4.2 Validator-Aufruf nach LLM-Antwort (nach Z.902)

```typescript
// VORHER (Z.901-902)
const tr = await runTemplateTransform({...})
metadataFromTemplate = tr.meta as unknown as Record<string, unknown> | null

// NACHHER (KEIN _media_validation-Feld im Frontmatter, nur cleanedMeta)
const tr = await runTemplateTransform({...})
const rawMeta = tr.meta as unknown as Record<string, unknown> | null
if (rawMeta) {
  const { getDetailViewType } = await import('@/lib/templates/detail-view-type-utils')
  const detailViewType = getDetailViewType(rawMeta, args.libraryConfig)

  const { validateMediaExistence, buildMediaFieldsConfig } = await import('@/lib/templates/media-existence-validator')
  const mediaConfig = buildMediaFieldsConfig(detailViewType)
  const availableMedia = (sourceContext.availableMedia as AvailableMediaEntry[]) ?? []

  const validationResult = validateMediaExistence(rawMeta, availableMedia, mediaConfig)

  if (validationResult.hasChanges) {
    bufferLog(jobId, {
      phase: 'transform_validate',
      message: 'Phantom-Medien rejected',
      details: validationResult.report,
    })
    FileLogger.warn('phase-template', 'Validator hat Phantom-Medien entfernt', {
      jobId, rejected: validationResult.report.rejected,
    })
  }

  // WICHTIG: Nur cleanedMeta — KEIN _media_validation-Feld ins Frontmatter
  metadataFromTemplate = validationResult.cleanedMeta
} else {
  // bestehender Fehler-Pfad
  ...
}
```

## 5) Datei: `src/components/library/media-tab.tsx` (UPDATE)

### 5.1 Banner-Komponente fuer Coverbild-Slot (LIVE-CHECK)

Position: zwischen Z.512-555 (Coverbild-Sektion).

Logik: Statt Frontmatter-Feld lesen, vergleicht Banner den aktuellen `coverImageUrl`-Wert
mit der `galleryItems`-Liste (die bereits im Component-State vorhanden ist).

```tsx
{/* NEU: Live-Validierungs-Banner */}
{(() => {
  // Banner nur, wenn coverImageUrl existiert UND Gallery-Items geladen sind UND
  // der Wert nicht in der Liste vorhanden ist.
  if (!coverImageUrl || typeof coverImageUrl !== 'string') return null
  if (galleryLoading) return null
  // Alt-Daten haben moeglicherweise keinen Pfad-Anteil, neue Werte koennen Twin-Refs sein
  const trimmed = coverImageUrl.trim()
  if (!trimmed) return null
  // Absolute URLs (http/https/blob) sind separat zu behandeln (kein Sibling-Match moeglich)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return null
  const exists = galleryItems.some(item =>
    item.name === trimmed || item.frontmatterRef === trimmed
  )
  if (exists) return null
  return (
    <Alert variant="destructive" className="mt-2">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Cover-Bild nicht gefunden</AlertTitle>
      <AlertDescription>
        &quot;{trimmed}&quot; existiert nicht im Verzeichnis.
        {galleryItems.length > 0
          ? ` Verfuegbar: ${galleryItems.slice(0, 3).map(i => i.name).join(', ')}${galleryItems.length > 3 ? '...' : ''}`
          : ' Keine Bilder im Verzeichnis vorhanden.'}
      </AlertDescription>
    </Alert>
  )
})()}
```

Analog fuer `galleryImageUrls`, `speakers_image_url`, `attachments_url`.

### 5.2 Refactor: Banner-Komponente extrahieren

Wenn das Banner-JSX > 30 Zeilen wird oder mehrfach repeats, extrahieren nach:

```
src/components/library/media-tab/media-validation-banner.tsx
```

(folgend `welle-3-archiv-detail-contracts.mdc` §6).

## 6) Datei: `src/components/library/job-report-tab.tsx` (UPDATE)

### 6.1 Hardcoded `cover.jpg`-Fallback raus (Z.1199-1201)

```typescript
// VORHER
const fileName = coverImageUrl.split('/').pop() || 'cover.jpg'
const mimeType = blob.type || 'image/jpeg'

// NACHHER
const fileName = coverImageUrl.split('/').pop()
if (!fileName) {
  throw new Error('Cover-URL enthaelt keinen Dateinamen — kann nicht hochgeladen werden')
}
const mimeType = blob.type
if (!mimeType) {
  throw new Error('Blob hat keinen MIME-Typ — kann nicht hochgeladen werden')
}
```

### 6.2 Namenskonvention erweitern (Z.1000)

```typescript
// VORHER (Kommentar suggeriert nur png/jpg)
// oder über Namenskonvention (thumb_<name>.webp → <name>.png/jpg)

// NACHHER
// oder über Namenskonvention (thumb_<name>.webp → <name>.{png,jpg,webp,gif,...})
// Match auf alle Image-MIME-Types.
```

Code-Logik bleibt gleich (matched ohnehin auf base name), nur Kommentar aktualisieren.

## 7) Template-Anpassungen

### 7.1 `template-samples/pc-steckbrief-de.md` (Systemprompt-Klausel)

Ersetze Block "Bilder (`coverImageUrl`, `galleryImageUrls`):" mit:

```markdown
Bilder (`coverImageUrl`, `galleryImageUrls`):
- WICHTIG (Regel `media-lifecycle.mdc`): Niemals URLs, niemals Azure-Blob-Links.
- coverImageUrl MUSS exakt einer der Dateinamen aus CONTEXT.availableMedia sein, sonst null.
- galleryImageUrls darf nur Dateinamen aus CONTEXT.availableMedia enthalten, sonst leeres Array.
- Wenn CONTEXT.availableMedia leer ist: coverImageUrl: null, galleryImageUrls: [].
- Erfinde KEINE Dateinamen aus dem Quelltext, auch wenn dort welche genannt sind.
- Sprechende Dateinamen helfen bei der Zuordnung (z.B. "thinkpad-t480-front.webp" → coverImageUrl).
```

### 7.2 Weitere Templates mit Medien-Feldern

Liste der Templates, die aktualisiert werden muessen (per Grep nach `coverImageUrl` in `template-samples/` und `src/lib/templates/builtin-creation-templates.ts`):

```bash
rg -l "coverImageUrl|galleryImageUrls|speakers_image_url|authors_image_url|attachments_url" template-samples/ src/lib/templates/
```

Pro Template: gleiche Klausel, ggf. an Feld-Set angepasst.

## 8) Tests

### 8.1 `tests/unit/lib/templates/media-existence-validator.test.ts` (NEU)

Test-Cases:
- `validateMediaExistence` mit gueltigem coverImageUrl → unveraendert
- `validateMediaExistence` mit Phantom coverImageUrl → null + report
- `validateMediaExistence` mit leerem availableMedia → alles rejected
- `validateMediaExistence` mit Twin-Relativpfad → erkannt via frontmatterRef
- `validateMediaExistence` mit absoluter URL → rejected
- `validateMediaExistence` mit Array-Feld gemischt → nur Phantome entfernt
- `buildMediaFieldsConfig('book')` → korrekte Felder
- `buildMediaFieldsConfig('session')` → korrekte Felder
- `buildMediaFieldsConfig('refurbedDevice')` → korrekte Felder
- `buildMediaFieldsConfig('unknown')` → Default (nur coverImageUrl als String, keine Arrays)

### 8.2 `tests/unit/components/library/media-tab.test.tsx` (UPDATE)

Test-Cases ergaenzen:
- Banner wird gerendert, wenn `_media_validation.rejected.coverImageUrl` Eintraege hat
- Banner zeigt verfuegbare Medien an
- Banner wird NICHT gerendert, wenn `_media_validation` fehlt
- Banner wird NICHT gerendert, wenn `coverImageUrl` korrekt gesetzt ist

### 8.3 Optional: `tests/unit/external-jobs/phase-template-validator.test.ts` (NEU)

Smoke-Test fuer Validator-Integration in `phase-template.ts`:
- Mock `runTemplateTransform` liefert Phantom-Werte
- Mock `loadAvailableMediaForSource` liefert echte Liste
- Erwarte: `metadataFromTemplate.coverImageUrl === null` + `_media_validation` gesetzt
- Erwarte: `bufferLog`-Eintrag mit `phase: 'transform_validate'`

## 9) Manuelles Testszenario (zur Verifikation)

Im Browser, mit dev-Server:

1. Quelldatei `pctest.md` mit Inhalt anlegen:
   ```
   Lenovo ThinkPad T480
   Intel Core i5-8350U
   Bilder: thinkpad-t480-front.jpg
   ```
2. Zugehoeriges webp-Bild ins gleiche Verzeichnis legen: `dell-optiplex-7060-sff-1665130604.webp`
3. Transformation ausloesen
4. Erwartung NACH Refactor:
   - `coverImageUrl` ist `null` im Frontmatter (LLM-Vorschlag wurde rejected)
   - `_media_validation.rejected.coverImageUrl = ["thinkpad-t480-front.jpg"]`
   - `_media_validation.available = ["dell-optiplex-7060-sff-1665130604.webp"]`
   - Im Medien-Tab: Banner "Cover-Bild nicht gefunden — vorgeschlagen war 'thinkpad-t480-front.jpg', verfuegbar: dell-optiplex..."
   - Im Job-Log: Eintrag `transform_validate: Phantom-Medien rejected`
   - In Story-Vorschau: "Kein Cover ausgewaehlt"
5. User klickt im Medien-Tab "Coverbild zuordnen" → waehlt webp → coverImageUrl wird auf `dell-optiplex-...webp` gesetzt
6. Story-Vorschau zeigt das Bild korrekt

## 10) Akzeptanz-Kriterien

- [ ] Validator-Modul existiert und hat 100% Test-Coverage fuer dokumentierte Faelle
- [ ] phase-template.ts ruft Validator AUF — Build & Tests gruen
- [ ] Banner erscheint im Medien-Tab bei rejected Werten
- [ ] Hardcoded `cover.jpg` und `image/jpeg` Fallbacks sind weg
- [ ] mind. ein Template (`pc-steckbrief-de.md`) hat aktualisierte Systemprompt-Klausel
- [ ] manuelles Testszenario erfolgreich durchgefuehrt + im PR-Body dokumentiert
- [ ] keine neuen Lint-Warnings (Workspace-Regel: "Linterwarnungen sind EXTREM WICHTIG")
- [ ] keine Datei > 200 Zeilen (Workspace-Regel)

## 11) Git-Strategie

User-Vorgabe: **wir arbeiten auf master**.

- Pro logischem Schritt einzelner Commit (Workspace-Regel `AGENTS.md`):
  - Commit 1: `feat: media-existence-validator (Variante B) — Modul + Tests`
  - Commit 2: `feat: phase-template integriert media-existence-validator + availableMedia in CONTEXT`
  - Commit 3: `feat: media-tab UI-Banner fuer rejected media-Werte`
  - Commit 4: `chore: hardcoded cover.jpg-Fallbacks aus job-report-tab entfernt`
  - Commit 5: `docs: pc-steckbrief-de Template-Klausel fuer availableMedia`
  - Commit 6: `docs: refactor/cover-image-deterministic-flow Audit + Analyse + Plan`
- Push erst nach User-Bestaetigung. Kein eigenmaechtiger Push.
