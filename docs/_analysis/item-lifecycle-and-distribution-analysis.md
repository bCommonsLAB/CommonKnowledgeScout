## Item‑Lebenszyklus & Verteilungsprinzip – Analyse (Source‑of‑Truth vs Cache)

### Kontext & Motivation

Du willst zwei Dinge gleichzeitig erreichen, die sich schnell widersprechen, wenn man sie nicht sauber modelliert:

1) **Performance / UX**: Schnelles Laden/Speichern, unabhängig von trägem Filesystem/Provider → MongoDB als schneller Cache/Index.
2) **Dezentralität / Teilbarkeit**: Libraries sollen „per Folder Share“ (z. B. File‑Sharing) teilbar und importierbar sein, ohne dass teure Extraktion/Template‑Transformation erneut laufen müssen → ein **portables Abbild** der Library‑Inhalte.

Diese Analyse versucht, den **heutigen Code‑Lebenszyklus** nachzuvollziehen (wo entstehen welche Artefakte?) und daraus Varianten für ein **redundantes Export/Import‑Prinzip** abzuleiten, das die Verbindung zu den Quellen nicht verliert und Doppelverwertung beim Merge verhindert.

---

### Begriffe (präzise, weil im Code teils vermischt)

- **Source Artifact**: Originaldatei (PDF/Video/Audio/Text) im Storage‑Provider (lokal/OneDrive/…).
- **Transcription / Shadow‑Twin Markdown**: Markdown‑Datei(en), die aus Source erzeugt werden.
  - **`transcript` (UC‑A, authentisch)**: quellengetreues Transkript/Abbild der Source. Autor/Quelle wird der Source zugeschrieben. Typisch platzsparend als **Sibling** neben der Source (z. B. `audio.md`).
  - **`transformation` (UC‑B, interpretativ)**: Template‑Transformation/Nacherzählung. Autor ist der User/Creation‑Flow. Quellen müssen **explizit** in Metadaten referenziert sein. Typisch als `<base>.<lang>.md` mit Frontmatter.
- **Shadow‑Twin Container (Datei vs Verzeichnis)**:
  - **Datei‑Shadow‑Twin (ein Artefakt)**: passend für einfache Transkripte (Audio/Text), wenn keine weiteren Assets organisiert werden müssen.
  - **Verzeichnis‑Shadow‑Twin (mehrere Artefakte)**: passend für komplexe Medien (PDF: Text + Bilder) und Multi‑Source‑Objekte (Event: Video/Audio + Slides + Webtexte), weil mehrere Artefakte strukturiert abgelegt werden müssen.
- **Item (Variante 1)**: logisches Wissensobjekt = Meta‑Dokument `kind:'meta'` in `vectors__<libraryId>`, inkl. `docMetaJson.markdown`.
  - Siehe `src/types/item.ts` Mapping.
- **Assets**: Bilder/Slides/cover – heute oft nach Azure hochgeladen; URLs landen in `docMetaJson` (und teilweise werden Markdown‑Image‑URLs ersetzt).
- **Vectors/Chunks/ChapterSummaries**: RAG‑Artefakte in derselben Collection (andere `kind`).

Wichtig: Im Code existieren mehrere „fileId“‑Bedeutungen:
- `sourceFileId` (Original im Storage)
- `artifactFileId` (Markdown‑Datei im Storage)
- `itemId` (Mongo Meta‑Doc `fileId`)

---

### Heutiger Lebenszyklus (Code‑Pfad‑basiert)

#### Pfad A: External‑Jobs Orchestrierung (PDF‑Pipeline, serverseitig)
**High‑Level**: Source (PDF) → ggf. Extract Phase → Template Phase (Frontmatter/Chapters) → Shadow‑Twin speichern → Shadow‑Twin laden → Ingestion (RAG) → Mongo Meta/Vectors.

Relevante Bausteine:
- **Gating (Skip‑Logik)**: `src/lib/processing/gates.ts`
  - prüft Shadow‑Twin Existenz im Dot‑Folder **oder** als Sibling‑Datei.
- **Preprocess (Frontmatter/NeedTemplate)**:
  - `src/lib/external-jobs/preprocess-core.ts` (`findPdfMarkdown`, `validateFrontmatter`, …)
  - `src/lib/external-jobs/preprocessor-transform-template.ts`
- **Template‑Phase**: `src/lib/external-jobs/phase-template.ts`
  - erzeugt ein Markdown mit Frontmatter (via `createMarkdownWithFrontmatter`)
  - speichert über `saveMarkdown` in `src/lib/external-jobs/storage.ts` (typisch im Shadow‑Twin‑Folder).
- **Repair‑Flow (Legacy)**: `src/lib/external-jobs/legacy-markdown-adoption.ts`
  - verschiebt Legacy‑Markdown neben PDF in den Shadow‑Twin‑Folder, dedupliziert.
- **Shadow‑Twin Load**: `src/lib/external-jobs/phase-shadow-twin-loader.ts`
  - lädt Markdown (Priorität: `job.shadowTwinState.transformed.id`, sonst Finder).
- **Ingestion**: `src/lib/chat/ingestion-service.ts` (`upsertMarkdown`)
  - parst/normalisiert Frontmatter → `docMetaJsonObj`
  - optional: Bild‑Verarbeitung via `src/lib/ingestion/image-processor.ts`
    - lädt Bilder über Provider, lädt nach Azure hoch, ersetzt URLs im Markdown, schreibt `coverImageUrl`/`slides` in `docMetaJsonObj`.
  - schreibt `kind:'meta'` über `upsertVectorMeta` (und `chunk`/`chapterSummary` etc. über `upsertVectors`).

Beobachtung: In diesem Pfad ist der Shadow‑Twin in Storage primär „Arbeitsartefakt“, Mongo wird zum Such‑/Item‑Cache inklusive kanonischem Markdown im `docMetaJson`.

#### Pfad B: UI‑basierte Transformation (Client‑Pfad, TransformService)
**High‑Level**: Source → Secretary Transform → Markdown mit Frontmatter → speichern (Dot‑Folder oder Parent) → optional Meta‑Upsert.

Relevante Bausteine:
- `src/lib/transform/transform-service.ts`
  - erstellt Dot‑Folder nur wenn Bilder/ZIP/Mistral‑OCR‑Images anstehen; sonst speichert Markdown als Sibling.
  - ruft `/api/chat/[libraryId]/upsert-doc-meta` (Meta‑Upsert ohne volle RAG‑Ingestion).
- `src/app/api/chat/[libraryId]/upsert-doc-meta/route.ts`
  - schreibt/merged ein `kind:'meta'` Dokument (ohne Vektoren), primär für Status/Felder.

Beobachtung: Dieser Pfad kann dazu führen, dass Mongo Meta existiert, bevor RAG‑Ingestion läuft, und dass Shadow‑Twin‑Placement variiert.

#### Pfad C: Direkt „Markdown ingestieren“ (API)
- `src/app/api/chat/[libraryId]/ingest-markdown/route.ts`
  - liest `fileId` direkt als Storage‑Binary und übergibt Inhalt an `IngestionService.upsertMarkdown`.
  - Dieser Endpunkt ist (semantisch) „Ingest this markdown file“, nicht „Ingest source file“.

---

### Wo ist heute der „Point of Truth“?

De facto existieren zwei Wahrheiten:

- **Für UI/RAG/Suche** ist `docMetaJson.markdown` im Mongo‑Meta‑Doc der schnellste und konsistenteste Zugriffspunkt.
- **Für Provenienz/Teilbarkeit** ist das Filesystem/Storage die Quelle der Originale, und (je nach Pfad) auch der Shadow‑Twin‑Markdown.

Das ist noch kein Widerspruch – solange wir sauber modellieren, dass Mongo **Cache/Index** ist, und Storage **Provenienz/Distribution** liefert. Der Code ist aktuell aber an mehreren Stellen so gebaut, dass Mongo‑Meta **kanonischen** Markdown enthält (inkl. ersetzter Image‑URLs), während das Storage‑Markdown ggf. ein Zwischenstand sein kann (z. B. vor Bild‑Upload).

Für die gewünschte Autorenschaft/Provenienz‑Trennung heißt das:
- Für UC‑A („authentisch“) muss im Item/Export eindeutig stehen: **Autor=Quelle**, und der Inhalt ist ein Transkript/Abbild.
- Für UC‑B („interpretativ“) muss im Item/Export eindeutig stehen: **Autor=User**, und `sources[]` enthält die referenzierten Quellen (inkl. Rollen/Bezug).

---

### Zielbild: Mongo als Cache, Filesystem als teilbares Abbild („.knowledge.scout“)

Du hast die Idee genannt: pro Library ein Root‑Verzeichnis `.knowledge.scout`, das die Mongo‑Welt spiegelt, damit andere Nutzer per File‑Share importieren können (ohne erneute Extraktion/Template‑Transformation).

Das ist plausibel, aber erfordert zwei Design‑Entscheidungen:
1) **Was exportieren wir?** (nur Meta+Markdown? auch Chapters/Chunks? auch Embeddings?)
2) **Wie deduplizieren/mergen wir?** (stabile IDs/Fingerprints, Provenienz‑Graph)

#### Vorschlag: Export‑Layout (minimal, aber erweiterbar)

```
.knowledge.scout/
  manifest.jsonl
  items/
    <itemId>/
      meta.json
      content.md
      chapters.json
      attachments.json
      provenance.json
```

- `provenance.json` enthält mindestens:
  - `authorKind: 'source' | 'user'`
  - `artifactKind: 'transcript' | 'transformation'`
  - `sources[]` (Provider‑Typ, Pfad/ID/stabile ID, optional checksum, role)
  - optional: `templateRef` (Template‑ID/Version), `pipelineRef` (Versions/Policies)
- `meta.json` enthält strukturierte Metadaten (Frontmatter ohne Markdown) + Facetten.
- `content.md` enthält den finalen Markdown‑Body (idealerweise der gleiche Stand wie `docMetaJson.markdown`).
- `attachments.json` referenziert Azure‑URLs; optional kann man Assets zusätzlich mitschicken (falls „offline share“ wichtig ist).

Optional (später): `vectors/` exportieren.
- Pro: keine erneute Embedding‑Kosten.
- Contra: Modellabhängigkeit/Dimension/Index‑Kompatibilität + große Datenmengen.

---

### Import/Merge/Dedup: Wie vermeiden wir doppelte Quellen?

Ohne stabile Identität wird Merge immer unsauber. Minimal braucht man:

- **`sourceFingerprint`**: deterministischer Hash über Source‑Referenz + „Inhaltssignatur“.
  - z. B. `(providerType, providerStableIdOrPath, size, modifiedAt, checksum?)`
- **`transformationFingerprint`**: Hash über `(templateId, targetLanguage, policies, pipelineVersion)`
- **`itemId`**: idealerweise `hash(sourceFingerprint + transformationFingerprint)`

Dann gilt:
- Beim Import: wenn `itemId` existiert → skip/merge.
- Beim Merge zweier Libraries: Manifest‑Union über `itemId` + Konfliktregeln (neuester `upsertedAt`, oder explicit „prefer mine“).
- Für „mehrere Quellen → ein Ziel“ (Event‑Templates): `provenance.json` enthält `sourceRefs[]` (Video, Slides, Website‑Text, …) + eine definierte „primarySource“ (für UI‑Darstellung).

Wichtig: Im Code gibt es bereits `hashId` (`src/lib/chat/ingestion-service.ts` importiert es). Das kann als Baustein dienen – aber wir müssen erst entscheiden, **welche** Inputs in die ID fließen, sonst dedupliziert man zufällig oder gar nicht.

**Hinweis (ID‑Plan):** Eine konkrete, pfadunabhängige ID‑Spezifikation (Quelle/Artefakt, Sprache, Template, Multi‑Source) ist in `docs/_analysis/shadow-twin-implementation-plan.md` beschrieben.

---

### Varianten (3) für das Verteilungs-/Cache‑Prinzip

#### Variante A – Mongo‑Cache + asynchroner Export nach `.knowledge.scout` (empfohlen)
- Writes gehen primär nach Mongo (schnell, konsistent).
- Ein Hintergrundprozess exportiert deterministisch nach `.knowledge.scout`:
  - entweder „on change“ (Job/Event‑basiert) oder periodisch.
- Import liest `.knowledge.scout` und upsertet nach Mongo.
- **Vorteil:** UI/RAG bleiben schnell; File‑Sharing möglich; kein erneutes Template/Extract nötig.
- **Risiko:** Export/Import muss sauber versioniert werden (Schema‑Evolution).

#### Variante B – Filesystem als primäre Wahrheit, Mongo als „rebuildable index“
- Alles liegt als kanonische Dateien im Filesystem (inkl. finalem Markdown).
- Mongo wird aus Filesystem rekonstruiert.
- **Vorteil:** „Source‑of‑Truth“ klar, offline‑first.
- **Nachteil:** Performance leidet; viele Codepfade müssten zurückgebaut werden (aktuell setzt Ingestion `docMetaJson.markdown` als Arbeitsbasis).

#### Variante C – Dual‑Write mit Reconciliation
- Jede Änderung schreibt synchron nach Mongo und nach `.knowledge.scout`.
- Dazu ein Reconciliation‑Job, der Divergenzen auflöst.
- **Vorteil:** sehr robust, minimale Verzögerung.
- **Nachteil:** Komplexität/Fehlerklassen steigen stark (Partial failures, Konflikte).

---

### Was sollten wir als Nächstes testen/validieren (bevor Implementierung)?

- 2 Libraries exportieren, manuell mergen, importieren:
  - Wird `itemId` stabil genug, um Dubletten zu vermeiden?
- Multi‑Source Event:
  - Ist Provenienz (alle Inputs) im Export reproduzierbar?
- „Legacy“ Shadow‑Twin als Sibling:
  - Kann Export/Import solche Fälle deterministisch normalisieren (z. B. immer Dot‑Folder)?


