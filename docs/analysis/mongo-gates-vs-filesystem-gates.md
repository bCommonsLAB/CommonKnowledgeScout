## Problemstellung

Beim erneuten Starten eines Jobs für **dieselbe Quelle** (ohne „erzwingen“) werden `extract_pdf`, `transform_template` und `ingest_rag` trotzdem erneut ausgeführt. Das ist unerwünscht, wenn die Artefakte bereits existieren.

## Beobachtung (kritisch)

Die Gate-/Preprocess-Logik hatte bisher zwei zentrale Schwächen:

1. **Gates & Preprozessoren nutzten primär den `StorageProvider`** (Filesystem/OneDrive/etc.), um Artefakte zu finden.
   - Das funktioniert, wenn Shadow‑Twins im Filesystem liegen.
   - Es funktioniert **nicht**, wenn `primaryStore='mongo'` ist und `persistToFilesystem=false`, weil dann keine Artefakte im Provider sichtbar sind.

2. Dadurch wurde „Artefakt existiert“ fälschlich als **false** bewertet:
   - `gateExtractPdf()` fand kein Transcript im Storage → `extractGateExists=false`
   - `preprocessorTransformTemplate()` fand keine Transformation → `needTemplate=true`
   - `preprocessorIngest()` fand kein transformiertes Markdown → `needIngest=true`

Die Folge ist deterministisch: Jobs laufen erneut, obwohl MongoDB bereits den Shadow‑Twin enthält.

## Lösungsvarianten

### Variante A – Mongo-aware Gates (minimal-invasiv)
Wenn `primaryStore='mongo'`:
- Gates prüfen Existenz direkt im Shadow‑Twin‑Dokument.
- Storage-Fallback nur, wenn `allowFilesystemFallback=true`.

**Pro:** wenig Umbau, schnelle Entscheidung, keine Storage-Scans.  
**Contra:** Muss sauber zwischen Transcript vs. Transformation unterscheiden.

### Variante B – Mongo-aware Preprozessoren (präziser, aber mehr Umbau)
Preprozessoren laden gezielt:
- Extract: Transcript aus Mongo
- Template/Ingest: Transformation aus Mongo (TemplateName + Sprache)

**Pro:** richtige Semantik pro Phase, Frontmatter-Analyse auf *Transformation* statt Transcript.  
**Contra:** Mehr Stellen anzupassen.

### Variante C – ShadowTwinState zentralisieren (größerer Umbau)
`analyzeShadowTwin()` würde für Mongo-PrimaryStore ebenfalls Mongo konsultieren, so dass alle Konsumenten (UI/Jobs) konsistente States bekommen.

**Pro:** Single Source of Truth.  
**Contra:** Signatur/Abhängigkeiten ändern (libraryId/userEmail), höheres Risiko.

## Entscheidung

Wir implementieren **Variante A + B**:

- `gateExtractPdf()` ist mongo-aware (Transcript-Existenz).
- `findPdfMarkdown()` unterstützt Mongo direkt und kann Transcript **oder** Transformation laden.
- Preprozessoren nutzen `findPdfMarkdown()` mit dem passenden `preferredKind`:
  - Extract → `transcript`
  - Template/Ingest → `transformation` (mit `templateName`)

Damit werden bestehende Artefakte in MongoDB als „existiert“ erkannt und die Phasen laufen ohne „erzwingen“ nicht erneut.

