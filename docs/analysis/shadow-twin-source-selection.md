# Shadow-Twin Quellenwahl - Deterministische Architektur

## Problem (Bug vom 27.01.2026)

Bei Re-Transformation eines PDFs mit 32 Seiten wurde nur eine kurze Summary (761 Zeichen) generiert, obwohl das vollständige Transkript vorhanden war.

### Ursachen (zwei Bugs)

**Bug 1: Template-Phase wurde übersprungen trotz `force` Policy**

Die Start-Route ignorierte die `policies.metadata = 'force'` Policy:

```typescript
// VORHER (falsch):
const runTemplate = templateEnabled && needTemplate
// needTemplate kam aus Preprocessor, force wurde ignoriert!
```

**Bug 2: Falsche Quellenwahl bei Template-Ausführung**

Die Funktion `loadShadowTwinMarkdown()` bevorzugte immer die transformierte Datei (`shadowTwinState.transformed.id`), unabhängig vom Kontext:

```
Shadow-Twin-State:
├── transformed.id = "...::transformation::de::pdfanalyse"  ← 761 Zeichen (Summary)
└── transcriptFiles[0].id = "...::transcript::de::"         ← ~50.000 Zeichen (32 Seiten)
```

Bei Template-Ausführung mit `policy=force`:
1. `loadShadowTwinMarkdown()` lud die alte Transformation (761 Zeichen)
2. Template transformierte die Summary → Ergebnis war wieder nur Summary
3. **Garbage In, Garbage Out**

## Lösung: Deterministische Quellenwahl mit explizitem `purpose` Parameter

Die Funktion `loadShadowTwinMarkdown()` erfordert jetzt einen **required** `purpose` Parameter:

```typescript
type ShadowTwinLoadPurpose =
  | 'forTemplateTransformation'  // Lädt TRANSKRIPT (Phase 1 Ergebnis)
  | 'forIngestOrPassthrough'     // Lädt TRANSFORMATION (Phase 2 Ergebnis)
```

### Architekturprinzip

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETERMINISTISCHE QUELLENWAHL                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Template wird AUSGEFÜHRT        Template wird ÜBERSPRUNGEN                 │
│  ──────────────────────────      ─────────────────────────────              │
│  Quelle: TRANSKRIPT              Quelle: TRANSFORMATION                     │
│  (Phase 1 Ergebnis)              (Phase 2 Ergebnis)                         │
│                                                                             │
│  Der Transformer darf NIEMALS    Bestehendes Ergebnis wird an               │
│  seine eigenen Daten als         nächste Phase weitergegeben                │
│  Quelle verwenden!                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Ingest-Phase                                                               │
│  ────────────                                                               │
│  Quelle: TRANSFORMATION (Fallback: Transkript)                              │
│  Ingest braucht das transformierte Markdown mit Metadaten                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verwendung

```typescript
// Template-Phase wird AUSGEFÜHRT → braucht Transkript
const source = await loadShadowTwinMarkdown(ctx, provider, 'forTemplateTransformation')

// Ingest-Phase oder Template übersprungen → braucht transformierte Datei
const source = await loadShadowTwinMarkdown(ctx, provider, 'forIngestOrPassthrough')
```

### Aufrufer-Übersicht

| Datei | Kontext | Purpose |
|-------|---------|---------|
| `start/route.ts` | Ingest-only-Pfad | `'forIngestOrPassthrough'` |
| `start/route.ts` | Template-only-Pfad | `'forTemplateTransformation'` |
| `start/route.ts` | Ingest nach Template | `'forIngestOrPassthrough'` |
| `phase-ingest.ts` | Ingest-Phase | `'forIngestOrPassthrough'` |

## Lösung Bug 1: Template-Policy-Berücksichtigung

Die Start-Route berücksichtigt jetzt die `policies.metadata` Policy:

```typescript
// NACHHER (korrekt):
const templateDirective: 'ignore' | 'do' | 'force' = 
  policies.metadata === 'force' ? 'force' :
  policies.metadata === 'ignore' || policies.metadata === 'skip' ? 'ignore' :
  templateEnabled ? 'do' : 'ignore'

const runTemplate = templateEnabled && (
  templateDirective === 'force' ? true :
  templateDirective === 'ignore' ? false :
  needTemplate // 'do' → basierend auf Preprocessor
)
```

| Policy | Verhalten |
|--------|-----------|
| `'force'` | Template wird IMMER ausgeführt (auch wenn needTemplate=false) |
| `'ignore'`/`'skip'` | Template wird NIE ausgeführt |
| `'auto'`/`'do'` | Basierend auf Preprocessor (needTemplate) |

## Betroffene Dateien

- `src/lib/external-jobs/phase-shadow-twin-loader.ts` - Deterministische Quellenwahl
- `src/app/api/external/jobs/[jobId]/start/route.ts` - Policy-Berücksichtigung + Aufrufer
- `src/lib/external-jobs/phase-ingest.ts` - Aufrufer angepasst

## Rückgabewert

Der Rückgabewert enthält jetzt auch `loadedArtifactKind` für Debugging:

```typescript
interface ShadowTwinMarkdownResult {
  markdown: string
  meta: Record<string, unknown>
  fileId: string
  fileName: string
  loadedArtifactKind: 'transcript' | 'transformation'  // NEU
}
```
