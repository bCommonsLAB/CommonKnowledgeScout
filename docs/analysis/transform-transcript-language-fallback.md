# Transform schlägt fehl: „Shadow‑Twin nicht gefunden" trotz vorhandenem Transkript

Status: ANALYSE FERTIG, UMSETZUNG OFFEN (für Online-Session)
Branch: `fix/transform-transcript-language-fallback`
Erstellt: 2026-06-22

## 1. Symptom

Ein Transform-Job (PDF) scheitert mit:

```
transform_template: failed → "Shadow‑Twin nicht gefunden"
error.code: shadow_twin_not_found  (HTTP 404)
```

Gleichzeitig zeigt das Frontend (Tab „Transkript") das Transkript korrekt an.
Der Anwender sieht also ein Transkript, der Job findet aber keines.

Beispiel-Job (failed):
- Quelle: `9783927266575_Interior.pdf`
- libraryId: `bf29edda-fdc3-4ac0-ae54-90133c2e1517`
- `correlation.options.targetLanguage = "de"`
- `parameters.template = "tamera-extract-en"`
- `parameters.policies = { extract: "ignore", metadata: "do", ingest: "ignore" }`

## 2. Tatsächliche Ursache (belegt durch Dev-Logs)

**Sprach-Mismatch.** Das Transkript existiert, aber unter einer anderen
`targetLanguage` als der Job anfragt.

Beweis (Dev-Server-Log, 11:05:13):

```
[shadow-twin-repo][warn] Artefakt im Dokument nicht gefunden {
  artifactKey: { kind: 'transcript', targetLanguage: 'de', templateName: undefined },
  availableArtifacts: [ 'transcript', 'transformation' ]   // existieren!
}
[mongo-shadow-twin-store][warn] Artefakt nicht gefunden { kind:'transcript', targetLanguage:'de' }
[artifact-resolver][info] Artefakt nicht gefunden
GET /api/.../artifacts/resolve?...&targetLanguage=de&preferredKind=transcript 200
```

Das MongoDB-Dokument hat `transcript` UND `transformation` — aber nicht unter
`de`. Die Library ist englisch konfiguriert, daher liegen die Artefakte unter
`en` (`artifacts.transcript.en`). Der Job sucht `artifacts.transcript.de`.

### Warum sprach-exakt?

Artefakte sind im Repo sprach-exakt verschlüsselt:

```ts
// src/lib/repositories/shadow-twin-repo.ts
export function buildArtifactPath(key: ArtifactKey): string {
  if (key.kind === 'transcript') {
    return `artifacts.transcript.${key.targetLanguage}`
  }
  const templateName = key.templateName || 'unknown'
  return `artifacts.transformation.${templateName}.${key.targetLanguage}`
}
```

### Warum das Frontend trotzdem ein Transkript zeigt

Der Transkript-Tab lädt sprach-UNABHÄNGIG über:

```
GET /api/library/[libraryId]/shadow-twins/[sourceId]
→ getAllArtifacts()  // gibt ALLE Sprachen/Templates zurück
```

`getAllArtifacts` ignoriert die Sprache → zeigt das `en`-Transkript an.
Der Job hingegen sucht sprach-exakt → 404.

## 3. Code-Pfad des Fehlers

1. `src/app/api/external/jobs/[jobId]/start/route.ts`
   - Policy `extract: ignore` → `runExtract = false`
   - Policy `metadata: do` → `runTemplate = true`
   - Verzweigt in den Template-only-Pfad (`!runExtract && runTemplate`)
   - Ruft `loadShadowTwinMarkdown(ctxPre, provider, 'forTemplateTransformation')`
   - Liefert `null` → setzt Step+Job auf failed, gibt 404 zurück (Zeile ~1080–1098)

2. `src/lib/external-jobs/phase-shadow-twin-loader.ts`
   - Branch `purpose === 'forTemplateTransformation'`
   - Sucht Transkript in dieser Reihenfolge, jeweils SPRACH-EXAKT mit `lang`:
     - Prio 1: `job.shadowTwinState.transcriptFiles` (hier null)
     - Prio 2: `ShadowTwinService.getMarkdown({ kind:'transcript', targetLanguage: lang })`
     - Prio 3: `resolveArtifact(provider, { preferredKind:'transcript', targetLanguage: lang })`
   - Alle drei scheitern, weil nur `en` existiert → `return null`

## 4. Designfrage

Ein Transkript ist das rohe OCR-Ergebnis (Inhaltssprache = Dokumentsprache).
Die `targetLanguage` betrifft die AUSGABE der Transformation, nicht die
EINGABE (Transkript). Daher ist die sprach-exakte Transkript-Suche als
Transformations-Input zu streng.

## 5. Lösung (zu implementieren) — Variante 1: sprach-toleranter Transkript-Fallback

Nur den Lese-Pfad für die Transform-EINGABE sprach-tolerant machen.
KEINE Änderung an `buildArtifactPath` oder am Schreib-/Schlüssel-Modell.

### Eingriffspunkt (genau eine Stelle)

`src/lib/external-jobs/phase-shadow-twin-loader.ts`, Branch
`forTemplateTransformation`: NACH Prio 3 (vor dem finalen `return null`,
ca. Zeile 419) einen Fallback ergänzen:

1. `const all = await getAllArtifacts({ libraryId: job.libraryId, sourceId: sourceItemId })`
   (aus `@/lib/repositories/shadow-twin-repo`)
2. `const transcripts = all.filter(a => a.kind === 'transcript')`
   (bereits nach `updatedAt` desc sortiert → erstes Element = neuestes)
3. Wenn genau eines existiert ODER eindeutig wählbar:
   `ShadowTwinService.getMarkdown({ kind:'transcript', targetLanguage: transcripts[0].targetLanguage })`
   laden und mit `loadedArtifactKind:'transcript'` zurückgeben.
4. Vor Verwendung LOGGEN (kein stiller Fallback! siehe Rule
   `no-silent-fallbacks.mdc`):
   `FileLogger.info(... 'Transkript-Sprach-Fallback verwendet', { requested: lang, used: transcripts[0].targetLanguage })`

### Bewusste Entscheidungen / Grenzen

- Mehrdeutigkeit: Wenn mehrere Transkripte in verschiedenen Sprachen
  existieren, deterministisch das neueste nehmen (Sortierung steht) UND loggen.
  Alternativ: nur fallbacken, wenn GENAU ein Transkript existiert — sonst
  bewusst 404 lassen. (Im Online-Task entscheiden + im Code kommentieren.)
- Der Fallback gilt NUR für `forTemplateTransformation` (Eingabe). Der
  `forIngestOrPassthrough`-Branch bleibt unverändert.
- `buildArtifactPath` und das Schreibmodell bleiben sprach-exakt.

## 6. Pflicht-Tests

- Neuer Unit-Test für `loadShadowTwinMarkdown('forTemplateTransformation')`:
  - Nur `transcript.en` vorhanden, Job fragt `de` an → Fallback lädt `en`,
    Rückgabe `loadedArtifactKind:'transcript'`, Log vorhanden.
  - `transcript.de` vorhanden → kein Fallback (exakter Treffer bevorzugt).
  - Kein Transkript vorhanden → weiterhin `null` (404 bleibt korrekt).
- Bestehende Tests grün halten: `pnpm test` + `pnpm lint`.
- Char-Tests der Template-Phase nicht verletzen
  (`tests/unit/external-jobs/phase-template-*.test.ts`).

## 7. Verifikation durch Anwender (nach Fix)

1. Englische Library, PDF mit nur `transcript.en`.
2. Transform mit Zielsprache `de` starten.
3. Job läuft durch (kein 404 mehr); Template nutzt das `en`-Transkript als
   Eingabe und erzeugt die `de`-Transformation.

## 8. Nicht Teil dieser Aufgabe (separat halten)

- Der frühere Fall „englisches Dokument, savedItemId fehlt nach
  `chapters_already_exist`" ist ein ANDERER Randfall (eigene Aufgabe).
- UI-Guard für Zielsprache-Auswahl (Variante 2) ist optional/Folgeaufgabe.
- Hartcodierte `targetLanguage="de"` in `file-preview.tsx` (Zeile ~137) und
  `pdf-view.tsx` (Zeile ~288): separater Cleanup, nicht hier.

## 9. Referenzdateien

- `src/lib/external-jobs/phase-shadow-twin-loader.ts` (Eingriffspunkt)
- `src/lib/repositories/shadow-twin-repo.ts` (`getAllArtifacts`, `buildArtifactPath`)
- `src/lib/shadow-twin/store/shadow-twin-service.ts` (`getMarkdown`)
- `src/app/api/external/jobs/[jobId]/start/route.ts` (Template-only-Pfad, 404)
- `.cursor/rules/no-silent-fallbacks.mdc` (Fallback muss geloggt werden)
- `.cursor/rules/external-jobs-integration-tests.mdc` (Contracts/Skip-Semantik)
