## Shadow‑Twin Zentralisierung – Code‑Analyse & Varianten

### Kontext & Ziel

Aktuell existieren mehrere Stellen im Code, die Shadow‑Twin‑Artefakte (Markdown + ggf. Bilder) **suchen**, **speichern**, **verschieben** oder **für Ingestion auslesen**. Das ist historisch gewachsen (UI‑basierte Transformationspfade vs. External‑Jobs Orchestrierung vs. Migration/Repair‑Flows). Der Effekt: Eine Migration „Storage → Mongo“ (oder „Mongo als Cache“) wird unnötig komplex, weil man mehrere Pfade synchron migrieren müsste – und Fehler entstehen typischerweise genau an den Schnittstellen (z. B. Shadow‑Twin existiert, aber an anderer Stelle als erwartet).

Ziel dieser Analyse ist **keine Implementierung**, sondern eine belastbare Kartierung: **Welche Logiken hantieren mit Shadow‑Twins? Wo gibt es parallele Implementierungen?** Daraus leiten wir Varianten für einen **Single Entry Point** ab, sodass spätere Migrationen/Exports nicht doppelt implementiert werden müssen.

Wichtig: Bei der Bewertung müssen wir **zwei Use Cases** unterscheiden, weil sie unterschiedliche Autorenschaft/Provenienz implizieren:

- **UC‑A (authentisch / quellengetreu)**: Shadow‑Twin als „Transkript/Abbild“ einer Source‑Datei. Autor/Quelle der Source soll dem Artefakt zugeschrieben werden. Ziel ist Nachvollziehbarkeit und Nähe zum Original.
- **UC‑B (interpretativ / user‑autored)**: Shadow‑Twin als **Template‑Transformation** (journalistische Nacherzählung/Interpretation). Autor ist der User (oder der „Creation“-Flow), aber **Quellenreferenzen müssen zwingend erhalten bleiben** (Provenienz in Metadaten).

Das bedeutet: „Dot‑Folder vs Sibling‑Markdown“ ist nicht nur Legacy‑Inkonsistenz, sondern kann **absichtlich** use‑case‑abhängig sein – allerdings müssen die Regeln zentral und eindeutig formuliert werden (keine Doppeldeutigkeiten).

---

### Inventar: Wo Shadow‑Twins heute im Code vorkommen

- **Core‑Utilities (Storage‑basiert)**
  - `src/lib/storage/shadow-twin.ts`
    - Namens-/Pfadlogik (`generateShadowTwinName`, `generateShadowTwinFolderName*`)
    - Suche im Dot‑Folder (`findShadowTwinFolder`, `findShadowTwinMarkdown`)
    - Bildauflösung + URL‑Mapping (`findShadowTwinImage`, `resolveShadowTwinImageUrl`)
    - **Speichern** als Sibling‑Datei (`saveShadowTwin`) – wichtig: schreibt **nicht** in Dot‑Folder.

- **Shadow‑Twin Zustand/Analyse**
  - `src/lib/shadow-twin/analyze-shadow-twin.ts`
    - Ermittelt Shadow‑Twin‑State (transformed/transcript, Frontmatter‑Presence, Fallback‑Heuristiken).
    - Damit existiert bereits eine „Interpretationsinstanz“, was ein Shadow‑Twin ist.

- **External‑Jobs Pipeline (Server‑seitig, orchestriert)**
  - `src/lib/external-jobs/phase-shadow-twin-loader.ts`
    - Lädt Shadow‑Twin‑Markdown und parst Frontmatter (Priorität: `job.shadowTwinState.transformed.id`, dann Finder).
  - `src/lib/external-jobs/shadow-twin-finder.ts`
    - Konsolidierte Suche: Dot‑Folder → Parent‑Fallback.
  - `src/lib/external-jobs/shadow-twin-helpers.ts`
    - Find/Create Dot‑Folder (`findOrCreateShadowTwinFolder`), Vorbereitung für Image‑Processing.
  - `src/lib/external-jobs/legacy-markdown-adoption.ts`
    - „Repair“: verschiebt Legacy‑Markdown neben PDF in den Dot‑Folder, dedupliziert.
  - `src/lib/external-jobs/preprocess-core.ts`
    - `findPdfMarkdown`: Dot‑Folder → Parent‑Fallback (mit Annahme `originalName = ${baseName}.pdf`).
  - `src/lib/processing/gates.ts`
    - Gates prüfen Shadow‑Twin Existenz **sowohl** im Dot‑Folder als auch als Sibling‑Datei.
  - `src/app/api/external/jobs/[jobId]/start/route.ts`
    - Erzeugt/verwaltet Shadow‑Twin‑Folder‑Kontext und verwendet Loader/Adoption.

- **UI‑basierte Transformation (Client‑Pfad)**
  - `src/lib/transform/transform-service.ts`
    - Entscheidet dynamisch: Dot‑Folder wird nur erstellt, wenn Bilder/ZIP/Mistral‑OCR‑Images erwartet werden.
    - Speichert Markdown **entweder** in Dot‑Folder **oder** im Parent‑Folder (Fallback).
    - Triggert zusätzlich `/api/chat/[libraryId]/upsert-doc-meta` (Meta‑Upsert ohne vollständige RAG‑Ingestion).
  - `src/lib/transform/image-extraction-service.ts`
    - Speichert Bilder in Dot‑Folder oder in separatem Ordner (kompatibel).
  - `src/lib/transform/batch-transform-service.ts`
    - Batch nutzt `TransformService.generateShadowTwinName` (eigene Namenslogik, nicht `storage/shadow-twin.ts`).
  - `src/app/api/chat/[libraryId]/ingest-markdown/route.ts`
    - Liest eine Markdown‑Datei direkt aus Storage (`provider.getBinary(fileId)`) und ruft `IngestionService.upsertMarkdown` auf.
    - Das ist ein weiterer „Einstiegspunkt“: hier ist `fileId` typischerweise die Markdown‑Datei (nicht das Original‑PDF).

- **Migration**
  - `scripts/migrate-shadow-twins-to-meta.ts`
    - Lädt Shadow‑Twin‑Markdown **nur** via Dot‑Folder (`findShadowTwinFolder` → `findShadowTwinMarkdown`).
    - Hat aktuell **keinen** Fallback auf Sibling‑Dateien; außerdem ist Sprache hardcoded `'de'`.
    - Bildmigration ist als TODO markiert.

---

### Parallele Logiken / Inkonsistenzen (Risiko‑Hotspots)

1) **Zwei Speicherorte (Dot‑Folder vs Sibling)**
- External‑Jobs und Repair‑Flows treiben Richtung Dot‑Folder.
- UI‑Transform schreibt ohne Bilder häufig als **Sibling** (Parent‑Folder).
- `saveShadowTwin` in `storage/shadow-twin.ts` schreibt ebenfalls als Sibling.
- Gates (`src/lib/processing/gates.ts`) berücksichtigen beide – Migration aktuell nur Dot‑Folder.

**Neue Bewertung (aus fachlicher Sicht):** Das kann sinnvoll sein, wenn wir es klar definieren:
- **Sibling‑Markdown** ist ein guter Fit für UC‑A (einfaches Transkript/Abbild, platzsparend, direkt neben Quelle).
- **Dot‑Folder** ist ein guter Fit für „komplexe Quellen“ (PDF mit Bildern, Multi‑Source Events, Slides/Assets), also überall dort, wo mehrere Artefakte organisiert werden müssen.

2) **Zwei Namensgeneratoren**
- `src/lib/storage/shadow-twin.ts: generateShadowTwinName()` (nutzt `path.parse`).
- `src/lib/transform/transform-service.ts: TransformService.generateShadowTwinName()` (entfernt „alle Extensions“ via `split('.')` und liefert **ohne** Dateiendung).
- Zusätzlich existieren Spezialfälle (Punkte im BaseName) mit handgebauten Namen in `findShadowTwinMarkdown` und `analyzeShadowTwin`.

3) **Unklare Identität: Was ist „fileId“?**
- In Mongo‑Meta (`MetaDocument.fileId`) ist „fileId“ aktuell die ID des Wissensobjekts in der Vector‑Collection.
- In `/ingest-markdown` ist `fileId` die ID der Markdown‑Datei im Storage.
- In External‑Jobs kann `job.correlation.source.itemId` das Original sein, `shadowTwinState.transformed.id` die Markdown‑Datei.
- Für Zentralisierung müssen wir das sauber typisieren: `sourceFileId` vs `artifactFileId` vs `itemId`.

4) **Migration‑Script ist semantisch enger als Produktlogik**
- Produktlogik findet Shadow‑Twins in Folder **oder** Parent; Migration nur Folder → potentiell „false negatives“.
- Sprache hardcoded `'de'` im Migration‑Loader.
- Das Script validiert Azure‑URLs, aber Bildmigration ist unimplementiert.

---

### Warum Zentralisierung vor Migration sinnvoll sein kann

Wenn wir zuerst zentralisieren, dann müssen wir bei späteren Änderungen (z. B. „Mongo wird Cache, Storage bleibt Source‑of‑Truth“ oder „Export nach `.knowledge.scout`“) **nur eine** Logik ändern: den zentralen Store/Resolver. Ohne Zentralisierung riskieren wir:

- doppelte Implementierungen (UI‑Pfad, External‑Jobs, Migration, direkte API‑Routes),
- divergierende Heuristiken (Folder‑only vs Folder+Sibling),
- schwer testbare Edge‑Cases (insbesondere bei Merge/Import/Legacy‑Artifacts).

---

### Varianten (3) für einen Single Entry Point

#### Variante A – `TranscriptionStore` + `ItemResolver` (empfohlen)
**Idee:** Einführung eines kleinen, strikt typisierten Moduls, das alle Shadow‑Twin/Transkript‑Operationen kapselt.

- **Interface (Beispiel)**
  - `resolveTranscriptionArtifact({ source, targetLanguage, preferTransformed }): Promise<ResolvedArtifact | null>`
  - `saveTranscription({ source, targetLanguage, markdown, placement }): Promise<SavedArtifact>`
  - `resolveImages({ source, markdown }): Promise<{ markdownWithAzureUrls, attachments }>`
- **Implementierungen**
  - `StorageTranscriptionStore` (Folder + Sibling + Legacy‑Fallback)
  - `MongoTranscriptionStore` (später: `docMetaJson.markdown` / Item‑API)
- **Vorteil**
  - Alle Call‑Sites (External‑Jobs, `/ingest-markdown`, UI‑Transform, Migration) werden zu dünnen Adaptern.
- **Risiko**
  - Initialer Refactor über mehrere Dateien; muss über Unit‑Tests abgesichert werden.

**Erweiterung (für UC‑A/UC‑B):** Das Interface muss Artefakt‑Typen explizit machen (nicht nur „preferTransformed“):
- `artifactKind: 'transcript' | 'transformation'`
- `authorKind: 'source' | 'user'`
- `sources: Array<{ sourceFileId: string; sourceFileName: string; role?: string }>` (Multi‑Source)
- `templateRef?: { templateId: string; version?: string }` (nur für UC‑B)

#### Variante B – Minimaler Wrapper (Low‑Risk, inkrementell)
**Idee:** Keine neue Abstraktion, aber eine zentrale „Facade“ um bestehende Funktionen.

- Neuer Einstiegspunkt: `src/lib/shadow-twin/shadow-twin-service.ts`
- Intern delegiert er auf `storage/shadow-twin.ts`, `external-jobs/*`, `analyze-shadow-twin.ts`.
- Call‑Sites werden schrittweise umgestellt; direkte Storage‑Reads bleiben noch eine Zeit lang erlaubt.
- **Vorteil:** Geringes Risiko, schnellster Start.
- **Nachteil:** Technische Schuld bleibt länger sichtbar; Gefahr, dass neue Logik wieder daneben entsteht.

#### Variante C – Registry‑First (Mongo als Artefakt‑Index)
**Idee:** Mongo hält eine kleine Registry: „Welche Artefakte existieren wo?“ (IDs + Pfade + Checksums).

- External‑Jobs/Transform schreiben Registry‑Einträge (statt Heuristiken).
- Loader/Gates/Migration lesen primär Registry, Storage nur als sekundäre Prüfung.
- **Vorteil:** Dedupe/Merge/Import wird später einfacher.
- **Nachteil:** Mehr Konzept-/Schemaarbeit; erfordert sauberen Migrationspfad der Registry selbst.

---

### Konkrete Empfehlung (vorläufig, nicht „validiert“)

Ich würde **Variante A** bevorzugen, weil sie die Migration und ein späteres `.knowledge.scout`‑Export/Import‑System am stärksten vereinfacht: ein Ort entscheidet, ob wir aus Storage oder aus Mongo lesen, wie wir Legacy‑Artefakte finden, und wie wir Artefakte eindeutig referenzieren.

Wichtig: Bevor wir refactoren, sollten wir in Tests und im Dokumentations‑Teil explizit festhalten, was heute als „korrektes“ Verhalten gilt (Folder‑Only? Folder+Sibling? welche Sprachen?).

---

### Offene Fragen (für die nächste Analyse/Entscheidung)

- Ist Dot‑Folder **der** Zielstandard für komplexe Quellen (PDF/Event/Slides), während Sibling‑Markdown für einfache Transkripte (Audio/Text) zulässig bleibt?
- Wie trennen wir innerhalb eines Dot‑Folders strikt **Transkript(e)** vs **Transformation(en)**, damit Autorenschaft/Provenienz eindeutig bleibt?
- Wie definieren wir eindeutig `itemId` vs `sourceFileId` vs `artifactFileId` in Types und APIs?
- Welche Sprachen müssen wir als Fallback unterstützen (nur `de`/`en` oder beliebig)?
- Welche Artefakte sind „Source‑of‑Truth“: Originale im Storage, Shadow‑Twin‑Markdown im Storage, oder `docMetaJson.markdown` in Mongo?

**Hinweis (ID‑Plan):** Für die Umsetzung der pfadunabhängigen, deterministischen IDs siehe `docs/_analysis/shadow-twin-implementation-plan.md` (Abschnitt „ID‑Spezifikation“).


