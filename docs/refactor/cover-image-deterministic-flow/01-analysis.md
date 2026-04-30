# 01-Analyse: Soll-Zustand und Validator-Vertrag

**Stand:** 2026-04-30
**Vorlage:** [00-audit.md](./00-audit.md)
**Entscheidung:** Variante B — LLM darf vorschlagen, Server validiert hart, UI zeigt Warnungen

**Update 2026-04-30 (User-Entscheidung):** Validierungs-Report wird NICHT ins Frontmatter persistiert. Stattdessen:
- Validator gibt `cleanedMeta` zurueck (Phantome → null/[])
- Report geht ins Job-Log (Diagnose, nicht persistiert pro Datei)
- UI-Banner rechnet **live** aus aktueller `availableMedia`-Liste + aktuellem `coverImageUrl`-Wert
- Vorteil: Funktioniert auch fuer Alt-Daten ohne Re-Run, kein Frontmatter-Pollution

## 1) Architektur-Prinzip

**Single Source of Truth fuer Medien-Existenz** ist der Storage (Sibling-Files + binaryFragments). Das LLM ist eine **vorschlagende Instanz**, kein Schreiber. Jede Frontmatter-Persistenz eines Medien-Werts MUSS gegen die Single Source of Truth validiert werden.

```
┌─────────────────────────────────────────────────────────────┐
│ LLM-Output (Frontmatter-Vorschlag)                          │
│  coverImageUrl: "thinkpad-t480-front.jpg"                   │
│  galleryImageUrls: ["thinkpad-t480-tastatur.jpg"]           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Media-Existence-Validator (NEU)                             │
│  Input: LLM-Frontmatter + Liste verfuegbarer Medien         │
│  Output: bereinigtes Frontmatter + Validierungs-Report      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Persistierte Frontmatter                                    │
│  coverImageUrl: null                  ← war Phantom         │
│  galleryImageUrls: []                 ← waren Phantome      │
│  _media_validation: {                                       │
│    rejected: { coverImageUrl: ["thinkpad-t480-front.jpg"], │
│                galleryImageUrls: ["thinkpad-t480-..."] },   │
│    available: ["dell-optiplex-...webp"],                    │
│    validatedAt: "2026-04-30T08:56:14.913Z"                  │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## 2) Sequenzdiagramm: Voller Transformations-Flow

```
User           UI            phase-template.ts        sibling-files API     LLM (Secretary)     media-existence-validator
 │             │                    │                       │                      │                          │
 │  Start Job  │                    │                       │                      │                          │
 ├────────────▶│                    │                       │                      │                          │
 │             ├───────────────────▶│                       │                      │                          │
 │             │                    │                       │                      │                          │
 │             │                    │  list sibling-files   │                      │                          │
 │             │                    ├──────────────────────▶│                      │                          │
 │             │                    │◀──────────────────────┤                      │                          │
 │             │                    │  list binaryFragments │                      │                          │
 │             │                    ├──────────────────────▶│                      │                          │
 │             │                    │◀──────────────────────┤                      │                          │
 │             │                    │                       │                      │                          │
 │             │                    │  build CONTEXT (incl. availableMedia)        │                          │
 │             │                    │  runTemplateTransform │                      │                          │
 │             │                    ├──────────────────────────────────────────────▶                          │
 │             │                    │◀─────────────────────────── frontmatter ─────┤                          │
 │             │                    │                       │                      │                          │
 │             │                    │  validate(frontmatter, availableMedia)       │                          │
 │             │                    ├─────────────────────────────────────────────────────────────────────────▶
 │             │                    │◀────────── { cleanedMeta, report } ──────────────────────────────────────
 │             │                    │                       │                      │                          │
 │             │                    │  upsertArtifact (cleanedMeta + report)       │                          │
 │             │◀───────────────────┤                       │                      │                          │
 │             │                    │                       │                      │                          │
 │             │  show story preview                        │                      │                          │
 │◀────────────┤                    │                       │                      │                          │
 │             │                    │                       │                      │                          │
 │  open Media-Tab (sees banner if rejected entries)        │                      │                          │
 ├────────────▶│                    │                       │                      │                          │
```

## 3) Validator-Vertrag

### 3.1 Signatur

```typescript
// src/lib/templates/media-existence-validator.ts

export interface AvailableMediaEntry {
  /** Dateiname (kanonisch) — z.B. "dell-optiplex-7060-sff-1665130604.webp" */
  name: string
  /** MIME-Typ — z.B. "image/webp" */
  mimeType: string
  /** Quelle: 'sibling' (Verzeichnis) oder 'fragment' (binaryFragments) */
  source: 'sibling' | 'fragment'
  /** Optionaler Twin-Relativpfad bei Fragmenten — z.B. "_Quelle.pdf/img-0.jpeg" */
  frontmatterRef?: string
}

export interface MediaValidationReport {
  /** Werte, die rejected wurden (key → Liste der entfernten Dateinamen) */
  rejected: Record<string, string[]>
  /** Liste der tatsaechlich verfuegbaren Medien (Snapshot zum Zeitpunkt der Validierung) */
  available: string[]
  /** Zeitstempel der Validierung */
  validatedAt: string
}

export interface MediaValidationResult {
  /** Bereinigtes Frontmatter — alle Phantom-Dateinamen ersetzt durch null/[] */
  cleanedMeta: Record<string, unknown>
  /** Report fuer Logging + UI */
  report: MediaValidationReport
  /** True, wenn etwas geaendert wurde */
  hasChanges: boolean
}

/**
 * Pruefe Medien-Felder im LLM-Frontmatter gegen reale verfuegbare Medien.
 *
 * Pruefregel: Ein Wert ist gueltig, wenn er
 * (a) genau einem Eintrag in `availableMedia.name` entspricht, ODER
 * (b) genau einem Eintrag in `availableMedia.frontmatterRef` entspricht.
 *
 * Bei String-Feldern: ungueltig → null
 * Bei Array-Feldern: ungueltige Eintraege werden entfernt, leere Arrays bleiben []
 *
 * Verstoesse werden im Report gesammelt, NICHT geworfen (set_null + Warning).
 */
export function validateMediaExistence(
  meta: Record<string, unknown>,
  availableMedia: AvailableMediaEntry[],
  mediaConfig: MediaFieldsConfig,
): MediaValidationResult
```

### 3.2 MediaFieldsConfig

Steuert generisch, welche Felder validiert werden — abgeleitet aus `VIEW_TYPE_REGISTRY`:

```typescript
export interface MediaFieldsConfig {
  /** String-Felder mit einzelnem Dateinamen */
  stringFields: string[]
  /** Array-Felder mit Liste von Dateinamen */
  arrayFields: string[]
}

/** Default-Config aus VIEW_TYPE_REGISTRY ableiten */
export function buildMediaFieldsConfig(detailViewType: string): MediaFieldsConfig
```

Beispiel fuer `refurbedDevice`:

```typescript
{
  stringFields: ['coverImageUrl'],
  arrayFields: ['galleryImageUrls'],
}
```

Beispiel fuer `session`:

```typescript
{
  stringFields: ['coverImageUrl'],
  arrayFields: ['speakers_image_url', 'attachments_url'],
}
```

### 3.3 Verhalten

| Fall | Eingabe | Ergebnis |
|---|---|---|
| Wert existiert in `availableMedia.name` | `coverImageUrl: "dell-optiplex.webp"` und Liste enthaelt `"dell-optiplex.webp"` | beibehalten |
| Wert ist Twin-Relativpfad und passt zu `frontmatterRef` | `coverImageUrl: "_quelle.pdf/img-0.jpeg"` und Liste enthaelt entsprechenden Eintrag | beibehalten |
| Wert ist Phantom (nicht in Liste) | `coverImageUrl: "thinkpad-t480-front.jpg"` und Liste enthaelt nur `"dell-optiplex.webp"` | auf `null` gesetzt, in `report.rejected` aufgenommen |
| Wert ist null/leerer String | `coverImageUrl: null` | beibehalten (kein Eintrag in Report) |
| Array-Feld mit gemischten Werten | `galleryImageUrls: ["a.jpg", "b.webp"]` und Liste enthaelt nur `"b.webp"` | `["b.webp"]`, `"a.jpg"` in Report |
| Array-Feld nur mit Phantomen | `galleryImageUrls: ["x.jpg", "y.jpg"]` | `[]`, beide in Report |
| Wert ist Azure-URL oder absolute URL | `coverImageUrl: "https://..."` | **rejected** (verstoss media-lifecycle.mdc) |

### 3.4 Was NICHT der Validator macht

- Kein Auto-Replace ("nimm einfach das erste verfuegbare Bild")
- Kein Loeschen aus dem Storage
- Kein Throw / kein Job-Failure (nur Warning)
- Kein Schreiben des Reports in eine separate DB-Tabelle (geht ins Frontmatter-Feld `_media_validation` und ins Job-Log)

## 4) CONTEXT-Block-Erweiterung (LLM-Input)

### 4.1 Aktueller Stand

`src/lib/external-jobs/phase-template.ts:842-877` baut `sourceContext`:

```typescript
const sourceContext: Record<string, unknown> = {}
sourceContext.fileName = sourceName       // z.B. "pctest.md"
sourceContext.fileExtension = "md"
sourceContext.mimeType = "text/markdown"
sourceContext.filePath = "/path/to/pctest.md"
sourceContext.fileModifiedAt = "2026-04-30T..."
```

### 4.2 Neuer Stand

Zusaetzlich:

```typescript
// Liste verfuegbarer Medien aus dem Quellverzeichnis + binaryFragments
sourceContext.availableMedia = [
  { name: "dell-optiplex-7060-sff-1665130604.webp", mimeType: "image/webp", source: "sibling" },
  // ... weitere
]
```

Limit: max. 50 Eintraege. Bei Ueberschreitung wird `availableMediaTruncated: true` gesetzt und ein Hinweis in den Systemprompt-Hinweis aufgenommen.

### 4.3 Template-Anpassung (Systemprompt-Klausel)

In `template-samples/pc-steckbrief-de.md` (und aequivalent fuer alle anderen Templates):

```markdown
Bilder (`coverImageUrl`, `galleryImageUrls`):
- WICHTIG (Regel `media-lifecycle.mdc`): Niemals URLs, niemals Azure-Blob-Links.
- coverImageUrl MUSS exakt einer der Dateinamen aus CONTEXT.availableMedia sein, sonst null.
- galleryImageUrls darf nur Dateinamen aus CONTEXT.availableMedia enthalten, sonst leeres Array.
- Wenn CONTEXT.availableMedia leer ist: coverImageUrl: null, galleryImageUrls: [].
- Erfinde KEINE Dateinamen aus dem Quelltext, auch wenn dort welche genannt sind.
```

## 5) UI-Banner-Vertrag

### 5.1 Wo

`src/components/library/media-tab.tsx`, Coverbild-Sektion (Z.512-555).

### 5.2 Ausloeser (LIVE-Check, kein Frontmatter-Feld)

Banner wird gerendert, wenn:
- `coverImageUrl` (string, nicht null/leer) existiert UND
- `coverImageUrl` ist NICHT in der Liste `galleryItems.map(i => i.name)` UND
- `galleryItems` wurde geladen (nicht im Loading-Zustand)

Daraus folgt: Banner braucht **keine** Persistenz und funktioniert sofort fuer Alt-Daten.

### 5.3 Banner-Inhalt

```
[!] Cover-Bild nicht gefunden
"thinkpad-t480-front.jpg" existiert nicht im Verzeichnis.
Verfuegbare Bilder: dell-optiplex-7060-sff-1665130604.webp
[Coverbild zuordnen] (oeffnet Zuordnen-Modus)
```

Analog fuer `galleryImageUrls`, `speakers_image_url`, `attachments_url` (Array-Felder: pro Index pruefen, Anzeige als kompakte Liste).

## 6) Fehler-Semantik (set_null + Warning)

| Ebene | Aktion |
|---|---|
| Validator | `cleanedMeta[field] = null` (string) bzw. `[]` (array). Eintrag in `report.rejected[field]`. |
| Frontmatter | KEIN zusaetzliches Feld (`_media_validation` faellt weg, siehe Update oben) |
| Job-Log | `bufferLog(jobId, { phase: 'transform_validate', message: 'Phantom-Medien rejected', details: report })` + `FileLogger.warn` |
| Frontend | Banner im Medien-Tab (live-Check) + Story-Vorschau-Hinweis "Kein Cover ausgewaehlt" |
| Pipeline | **Kein Abbruch**, Job laeuft weiter, ingest-Phase kann starten |

## 7) Integrationspunkte

| Punkt | Datei | Aenderung |
|---|---|---|
| LLM-CONTEXT | `phase-template.ts:842-877` | `availableMedia` hinzufuegen |
| Validator-Aufruf | `phase-template.ts:902` | `metadataFromTemplate = validate(tr.meta, availableMedia, mediaConfig).cleanedMeta` |
| Validator-Implementierung | `src/lib/templates/media-existence-validator.ts` (NEU) | Volles Modul |
| Available-Media-Helper | `src/lib/templates/available-media-loader.ts` (NEU) | Wrapper um Sibling + Fragments |
| UI-Banner | `media-tab.tsx:512-555` | Conditional-Render |
| Hardcoded Fallback raus | `job-report-tab.tsx:1199-1201` | `cover.jpg` / `image/jpeg` Defaults entfernen |
| Hardcoded Fallback raus | `job-report-tab.tsx:1000` | Kommentar/Logik aktualisieren auf alle Image-MIME-Types |
| Template-Klausel | `template-samples/pc-steckbrief-de.md` (Systemprompt) | Klausel hinzufuegen |
| Template-Klausel | alle anderen Templates mit `coverImageUrl` | Aequivalent |
| Tests | `tests/unit/lib/templates/media-existence-validator.test.ts` (NEU) | Vollabdeckung |
| Tests | `tests/unit/components/library/media-tab.test.tsx` | Banner-Test ergaenzen |

## 8) Migration

- Bestehende Frontmatter-Werte mit Phantom-Dateinamen werden NICHT automatisch geloescht
- Bei nächstem Re-Run der Transformation greift der Validator automatisch
- Im UI sehen User sofort den Banner-Hinweis (auch ohne Re-Run), weil das Banner auch ohne `_media_validation`-Eintrag rendert, wenn `coverImageUrl` nicht in `availableMedia` ist (Live-Check im UI)
- Optional in Welle 3: Migrations-Script fuer bestehende Daten — separat

## 9) Risiken

| Risiko | Mitigation |
|---|---|
| availableMedia ist sehr gross (PDF mit hunderten Bildfragmenten) | Limit 50, dann `availableMediaTruncated: true` + Hinweis im Prompt |
| Validator entfernt Wert, der trotzdem korrekt war (z.B. wegen Race Condition beim Storage-Refresh) | Original-Wert in `_media_validation.rejected` archiviert, im UI als "Vorschlag" sichtbar |
| Bestehende Tests in phase-template-*.test.ts brechen | Tests inspizieren, ggf. Mock fuer availableMedia hinzufuegen |
| Andere Templates ohne aktualisierte Klausel produzieren weiterhin Phantome | Validator faengt es auf, aber LLM-Output ist suboptimal — Template-Pflege als Folge-Aufgabe |
| LLM-CONTEXT-Aufbau scheitert (Storage-Provider down) | Fehler werfen statt leeren `availableMedia` schicken (sonst rejected der Validator alles) |
