## Umsetzungsplan: Shadow‑Twin Semantik, Zentralisierung, deterministische IDs

### Ausgangslage (präzise Problemdefinition)

Wir haben drei Spannungen, die wir gleichzeitig lösen müssen:

1) **Semantik/Aurorenschaft**: Ein Shadow‑Twin kann entweder ein **authentisches Abbild/Transkript** (Autor=Quelle) oder eine **interpretative Transformation** (Autor=User) sein. Diese beiden Fälle sind fachlich unterschiedlich und müssen im Datenmodell sichtbar sein.
2) **Container‑Form**: „Shadow‑Twin Datei“ (ein Artefakt) vs „Shadow‑Twin Verzeichnis“ (mehrere Artefakte) ist **use‑case‑abhängig sinnvoll** (Audio vs PDF vs Event/Multi‑Source). Aber die Regeln sind aktuell nicht zentral festgelegt.
3) **Dedup/Idempotenz**: Wiederholte Verarbeitung derselben Quelle darf nicht zu neuen IDs führen. Wir brauchen deterministische IDs, die **pfadunabhängig** sind und „Use‑Case“ (Transkript/Übersetzung/Template+Sprache) einbeziehen.

Dieses Dokument ist ein **Plan** (kein Code), der minimal‑invasiv vorgeht und Migrationen handhabbar hält.

---

### Zielbild (fachlich)

#### Artefakt‑Semantik (muss zentral und eindeutig sein)

- **UC‑A: `artifactKind = 'transcript'`**
  - Zweck: authentisch/nah an der Quelle.
  - **Autorenschaft**: `authorKind = 'source'` (Quelle/Autor der Source).
  - Metadaten müssen die Source eindeutig referenzieren (Provenienz).

- **UC‑B: `artifactKind = 'transformation'`**
  - Zweck: interpretativ/journalistisch, Template‑basiert.
  - **Autorenschaft**: `authorKind = 'user'` (oder „creation flow“).
  - Metadaten müssen `sources[]` enthalten (Quellenreferenzen bleiben zwingend).
  - Metadaten müssen `templateRef` enthalten (welches Template wurde genutzt).

#### Container‑Regeln (Datei vs Verzeichnis)

- **Shadow‑Twin Datei** ist zulässig und bevorzugt, wenn ein einziges Artefakt entsteht (typisch Audio/Text‑Transkript).
- **Shadow‑Twin Verzeichnis** wird verwendet, wenn mehrere Artefakte/Assets organisiert werden müssen:
  - PDF (Text + Bilder + ggf. Seitenartefakte)
  - Slides/Präsentationen (Bilder/Thumbnails + Text)
  - Event/Multi‑Source (Video/Audio + Slides + Webseiten‑Text + Ergebnis)

**Wichtig:** Innerhalb des Verzeichnisses müssen wir künftig strikt trennen:

```
.<sourceFileName>/
  transcripts/
    <sourceId>.<lang>.md?        // wenn Transkript sprach-/modellabhängig gespeichert wird
    <sourceId>.md                // wenn „authentisch“ ohne Sprachsuffix
  transformations/
    <artifactId>.md              // Template + Sprache eindeutig
  assets/
    ...                          // Bilder/ZIP-Extrakte/Slides
  manifest.json                  // optional: schneller Index über Artefakte
```

Der konkrete Name/Unterordner ist Implementation‑Detail – aber die **Trennung** ist die zentrale Regel.

---

### ID‑Spezifikation (deterministisch, pfadunabhängig)

#### 1) `sourceId` (Quelle)

**Ziel:** Wenn dieselbe Quelle erneut verarbeitet wird, muss dieselbe `sourceId` entstehen – unabhängig von Verzeichnisname/Sharing/Provider.

**Empfehlung (präferiert):**
- `sourceId = sha256(binaryContent)` als Hex‑String (oder Base32/URL‑safe Base64).
- Optional ergänzt um MimeType, wenn wir theoretische Ambiguitäten vermeiden wollen:
  - `sourceId = sha256(mimeType + '\n' + binaryContent)`

**Warum nicht Dateiname/Pfad?**
- Pfade ändern sich beim Sharing/Merging.
- Dateinamen können kollidieren, sind nicht stabil und enthalten keine Inhaltsidentität.

**Praktische Umsetzung:** Hash **streaming** berechnen (auch für große Dateien) – kein komplettes Buffering.

#### 2) `artifactId` (abgeleitet aus Quelle + Use‑Case)

Ein Artefakt ist *nicht nur* die Quelle, sondern Quelle + Verarbeitungskontext.

**Definition:**
- `artifactId = sha256(sourceId + '|' + artifactKind + '|' + targetLanguage + '|' + templateKey + '|' + pipelineVersion)`

Dabei:
- `artifactKind ∈ {'transcript','transformation'}`
- `targetLanguage` ist verpflichtend, sobald Sprache relevant ist (Übersetzung / DE/EN etc.)
- `templateKey` ist leer bei reinen Transkripten, sonst z. B. `templateId@templateVersion`
- `pipelineVersion` optional, aber wichtig sobald sich Semantik ändert (z. B. neue Normalisierung). Dann ist es legitim, eine neue ID zu erhalten.

#### 3) Multi‑Source („Event“)

Wenn ein Ergebnis aus mehreren Quellen entsteht, muss die ID aus den Quellen ableitbar sein:

- `compositeSourceId = sha256( sortByRole([ role + ':' + sourceId ]) .join('|') )`
- dann wie oben `artifactId` aus `compositeSourceId + template + language + ...`

So wird die Ordnung der Inputs deterministisch, ohne Pfadabhängigkeit.

---

### 3 Varianten für IDs (mit Tradeoffs)

#### Variante A – **Full Binary Hash** (empfohlen)
- `sourceId = sha256(binary)`
- **Pro:** maximal stabil über Sharing/Provider hinweg; perfekte Dedup‑Eigenschaft.
- **Contra:** Hashing kostet IO/CPU (aber lässt sich streaming + caching lösen).

#### Variante B – Provider‑Fingerprint
- `sourceId = sha256(providerType + providerFileId + revision + size + etag)`
- **Pro:** schnell, kein Download nötig.
- **Contra:** nicht share‑stabil (anderer Nutzer hat andere provider IDs), nicht robust bei Kopien.

#### Variante C – Hybrid (zweistufig)
- Primär `sha256(binary)` wenn Binary verfügbar/neu ingestiert wird.
- Fallback auf Provider‑Fingerprint, bis Binary‑Hash asynchron nachgezogen wurde.
- **Pro:** schnelle UX + eventual consistency.
- **Contra:** Komplexer (Reconciliation), klare Regeln nötig wann auf „final sourceId“ umgestellt wird.

---

### Zentralisierung (Single Entry Point) – minimaler Umbaupfad

Wir wollen *nicht* sofort alles migrieren, sondern zuerst die Regeln zentralisieren.

#### Phase 0 – Spezifikation + Tests (ohne Feature‑Umbau)
- Definiere zentrale Interfaces/Types (nur Typen/Docs), z. B.:
  - `SourceRef`, `ArtifactRef`, `ArtifactKind`, `AuthorKind`
- Definiere ID‑Builder Funktion als reine Funktion (testbar).
- Schreibe Unit‑Tests: deterministische IDs, Reihenfolge‑Unabhängigkeit bei Multi‑Source, keine Pfadabhängigkeit.

#### Phase 1 – „Resolver“ einführen (Read‑Pfad)
- Ein Modul kapselt die Auflösung:
  - „Finde Transcript/Transformation“ (Sibling oder Dot‑Folder), aber mit klarer Semantik.
- Bestehende Call‑Sites (External‑Jobs Loader, gates, ingest‑markdown) rufen nur noch den Resolver.
- Ziel: weniger Doppel‑Heuristiken, ohne Speicherpfade zu ändern.

#### Phase 2 – „Writer“ einführen (Write‑Pfad)
- Ein Modul kapselt Speichern:
  - UC‑A → Sibling oder `transcripts/`
  - UC‑B → `transformations/`
- `TransformService` und External‑Jobs `saveMarkdown` schreiben über denselben Writer.

#### Phase 3 – Mongo‑Upsert/Dedup an `artifactId` koppeln
- Entscheide, ob Mongo‑`fileId` umgestellt wird oder ein neues Feld (`stableArtifactId`) zuerst eingeführt wird.
- Minimal‑Risiko: zunächst `stable*` Felder in `docMetaJson` speichern, plus **Upsert‑By‑StableId** als Alternative.
- Erst wenn stabil: Migration alter Docs/Indices.

#### Phase 4 – `.knowledge.scout` Export/Import
- Export verwendet `sourceId`/`artifactId` als Directory Keys.
- Import upsertet deterministisch (kein Duplikat bei wiederholtem Import).

---

### Entscheidungspunkte (die du freigeben musst)

1) **Ist `sourceId = sha256(binary)` verpflichtend?** (Variante A)  
2) **Wie definieren wir `templateKey`?** (Template‑Name vs Template‑ID + Version/Hash des Template‑Contents)  
3) **Wie gehen wir mit „same source, different language“ bei Transkripten um?**
   - Entweder `artifactKind='transcript'` + `targetLanguage` immer gesetzt
   - oder „authentisch“ ohne Sprache, und Übersetzung ist eine Transformation


