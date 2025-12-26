---
name: ShadowTwin Zentralisierung+IDs (aktualisiert inkl. Frontend)
overview: Wir zentralisieren Shadow‑Twin Semantik (Transkript vs Transformation) und deterministische IDs mit minimalen Breaking Changes. Legacy bleibt lauffähig; pro Library wird per Flag/Convert-Button auf das neue Verhalten umgestellt. Zusätzlich wird das Frontend explizit von Shadow‑Twin Heuristiken entkoppelt.
todos:
  - id: spec-types-tests
    content: Types + Parser/Builder für Artefaktnamen/Keys implementieren und Unit-Tests hinzufügen
    status: pending
  - id: central-resolver
    content: Zentralen Artifact-Resolver einführen und Read-Pfade (external-jobs loader, gates, preprocess) darauf umstellen (nur wenn library flag v2)
    status: pending
    dependencies:
      - spec-types-tests
  - id: frontend-decouple
    content: Frontend von Shadow-Twin Heuristiken entkoppeln (nur noch über zentrale Resolver/Writer-APIs; keine UI-eigenen Namensparses/Storage-Reads zur Artefaktfindung)
    status: pending
    dependencies:
      - central-resolver
  - id: central-writer
    content: Zentralen Artifact-Writer einführen und Write-Pfade (TransformService, external-jobs save) darauf umstellen (nur wenn library flag v2)
    status: pending
    dependencies:
      - central-resolver
      - frontend-decouple
  - id: library-flag-ui
    content: Library-Flag (legacy/v2) + UI-Button „Konvertieren“ + API-Route zum Umschalten implementieren
    status: pending
    dependencies:
      - spec-types-tests
  - id: converter-job
    content: Konvertierungs-Job pro Library (minimal): Mongo-Meta backfill/normalisieren; keine Storage-Struktur verschieben
    status: pending
    dependencies:
      - library-flag-ui
      - central-resolver
---

# Plan: Shadow‑Twin Zentralisierung, per‑Library Conversion, deterministische IDs (inkl. Frontend)

## Ziel

- **Eine zentrale Stelle** entscheidet über Shadow‑Twin Lesen/Schreiben/Interpretation (Transkript vs Transformation) – ohne große Storage‑Strukturänderung.
- **Pro Library** schaltbar: Legacy‑Verhalten bleibt stabil; neue Libraries starten im neuen Modus.
- **IDs**: `sourceId` ist die aktuelle Storage‑Item‑ID (kein Breaking Change). Re‑Runs sollen **updaten statt duplizieren**.

## Leitprinzipien (aus dem Gespräch)

- **Semantik (UC‑A/UC‑B)**:
  - **Transkript (UC‑A)**: authentisch, Autor=Quelle; Dateiname drückt Sprache aus (z.B. `.de.md`).
  - **Transformation (UC‑B)**: user‑autored; Dateiname drückt Template + Sprache aus (z.B. `.Besprechung.de.md`).
  - Gilt **genauso** im Dot‑Folder wie als Sibling neben der Source.
- **Keine neue Storage‑Ordnerstruktur** (`transcripts/`/`transformations/`) – wir arbeiten mit der bestehenden Namenskonvention.
- **Template‑Key = Template‑Name** (Template‑Änderungen sollen bestehende Ergebnisse aktualisieren, nicht neue IDs erzeugen).
- **Per‑Library Rollout** via Flag + Convert‑Button (keine globale Umstellung).

## Phase 0 – Spezifikation & Tests (ohne Runtime‑Verhalten zu ändern)

- Definiere zentral:
  - `ArtifactKind = 'transcript' | 'transformation'`
  - `SourceId = storageItemId`
  - `ArtifactKey = { sourceId, artifactKind, targetLanguage, templateName? }`
- Implementiere reine Builder‑Funktionen + Parser für Dateinamen-Suffixe:
  - **Parse**: aus `fileName` extrahieren: `targetLanguage?`, `templateName?`, `artifactKind`.
  - **Build**: aus `ArtifactKey` den kanonischen Dateinamen erzeugen (und Match-Regeln definieren).
- Unit‑Tests (Vitest):
  - Parser/Builder Roundtrip.
  - Eindeutigkeit: Transkript vs Transformation kollidiert nicht.
  - Stabilität bei Re‑Run: gleicher `ArtifactKey` → gleicher Ziel-Dateiname.

## Phase 1 – Zentraler Resolver (Read‑Pfad)

- Neues Modul (Vorschlag): `src/lib/shadow-twin/artifact-resolver.ts`
- **Eingang**: `sourceItemId`, `sourceName`, `parentId`, `mode` (legacy/v2), `targetLanguage`, optional `templateName`.
- **Ausgang**: `{ kind, fileId, fileName, location: 'sibling' | 'dotFolder', shadowTwinFolderId? } | null`.
- Bestehende Heuristiken konsolidieren:
  - nutzt vorhandene Utilities aus `src/lib/storage/shadow-twin.ts` und State‑Analyse (z.B. `src/lib/shadow-twin/analyze-shadow-twin.ts`).
- Umstellen der wichtigsten Leser auf Resolver (nur wenn Flag `v2`):
  - `src/lib/external-jobs/phase-shadow-twin-loader.ts`
  - `src/lib/processing/gates.ts`
  - `src/lib/external-jobs/preprocess-core.ts`
  - optional: `scripts/migrate-shadow-twins-to-meta.ts` (nur für `v2` Libraries)

## Phase 2 – Frontend‑Entkopplung/Zentralisierung (Feature‑Sicherheit)

**Ziel:** Das Frontend enthält keine eigene Shadow‑Twin‑Heuristik mehr. Alle UI‑Features (Preview, Transform, Re‑Run, Ingest) gehen über ein zentrales Client‑API, das serverseitig den Resolver nutzt.

Konkrete Regeln:
- UI macht **kein** eigenes Parsing von Suffixen, um „transcript vs transformation“ zu entscheiden.
- UI sucht Artefakte **nicht** durch „listItems + string matching“ in Komponenten.\n

Umsetzungsvorschlag:
- Ein Client‑Wrapper (z.B. `src/lib/shadow-twin/artifact-client.ts`) kapselt Fetches auf eine Route wie:
  - `GET /api/library/[libraryId]/artifacts/resolve?sourceId=...&kind=...&lang=...&template=...`
  - (Route intern ruft `artifact-resolver.ts` auf.)
- UI‑Komponenten/Flows nutzen nur noch diesen Wrapper.\n

Definition of Done:
- Umschalten `legacy`→`v2` verändert keine UI‑Interaktion (nur Resolver/Writer entscheidet die Storage‑Details).

## Phase 3 – Zentraler Writer (Write‑Pfad)

- Neues Modul (Vorschlag): `src/lib/shadow-twin/artifact-writer.ts`
- schreibt deterministisch in den richtigen Ort (Sibling oder Dot‑Folder) basierend auf:
  - „komplexe Quelle“ (Folder existiert/ist nötig) vs „einfach“ (Sibling).
- dedupliziert: Ziel existiert → **überschreiben** (Update statt Duplikat).
- Umstellen der Schreiber (nur wenn Flag `v2`):
  - UI Transform: `src/lib/transform/transform-service.ts`
  - External Jobs Save: `src/lib/external-jobs/storage.ts`
  - Legacy Adoption bleibt Spezialfall, wird aber auf neue Namensregeln ausgerichtet: `src/lib/external-jobs/legacy-markdown-adoption.ts`

## Phase 4 – Per‑Library Flag + Convert Button

- Erweiterung Library‑Config um Version/Flag (z.B. `shadowTwinMode: 'legacy' | 'v2'`).
- Neue Libraries bekommen automatisch `v2`.
- Bestehende bleiben `legacy`.
- UI‑Button „Konvertieren“ pro Library:
  - setzt Flag auf `v2`
  - startet einen Hintergrund‑Konvertierungslauf (minimal, siehe nächste Phase)

## Phase 5 – Konvertierung (minimal, ohne Storage‑Umbau)

- Konvertierungsschritte pro Library:
  - **Mongo‑Seite**: Backfill/Normalisierung der Meta‑Dokumente (ohne Re‑Ingestion):
    - `docMetaJson.sourceFileId = <sourceId>` (Storage‑Item‑ID)
    - `docMetaJson.artifactKind`, `docMetaJson.targetLanguage`, `docMetaJson.templateName` (falls ableitbar)
    - optional: `docMetaJson.provenance.sources[]` (für Events: mehrere Quellen)
  - Optional: Shadow‑Twin‑State neu berechnen, aber **keine** Dateistruktur verschieben.

## Risiko‑Kontrollen

- Keine globale Umstellung.
- Jede Library separat konvertierbar; Rollback via Flag zurück auf `legacy`.
- Unit‑Tests decken Parser/Writer/Resolver‑Determinismus ab.

## Akzeptanzkriterien (prüfbar)

- Re‑Run derselben Operation erzeugt keine neuen Artefakte, sondern überschreibt das bestehende.
- Transkript vs Transformation ist über Dateiname + Metadaten eindeutig.
- Legacy‑Libraries funktionieren unverändert, bis der Convert‑Button gedrückt wurde.


