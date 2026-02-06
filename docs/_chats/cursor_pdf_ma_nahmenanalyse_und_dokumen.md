# PDF-Maßnahmenanalyse und Dokumentenerstellung
_Exported on 2/6/2026 at 17:11:30 GMT+1 from Cursor (2.4.27)_

---

**User**

Ich habe jetzt ein PDF mit 600 Seiten und jede Seite beinhaltet, also es ist ein PDF über Vorschläge zu Maßnahmen und jede Seite entspricht einer Maßnahme. Und jetzt möchte ich das PDF so analysieren, dass ich zu jeder Seite eine Template-Transformation starte und ein eigenes Dokument kreiere, das bestimmte Fragen beantwortet. So hätte ich dann auch ein Dokument. Wie könnte ich das mit meinem bestehenden Logik umsetzen? Was bietet sich an? Ist es einmal diese Batch-Verarbeitung, diese Story Creator? Aber es bietet sich da eben auch diese Template-Geschichte an, dann ist wo ich diese Wizards oder wie sollte man das jetzt am besten angehen? Warum mache ich das eigentlich? Weil ich möchte dann auch publizieren in meinem Explorer-Mode die einzelnen Maßnahmen finden können, nach bestimmten Kriterien und sie nach diesen Rezepten da wiederfinden, die ich vorher in diesen Template-Transformationen aus Metadaten kreiert habe. Verstehen wir die Logik?

---

**Cursor**

Ich verstehe die Logik: Jede PDF‑Seite entspricht genau einer Maßnahme. Du willst pro Seite ein strukturiertes Dokument erzeugen, das feste Fragen beantwortet, damit du im Explorer‑Mode nach Kriterien filtern und die Maßnahmen nach „Rezepten“ wiederfinden kannst. Das ist im Kern eine Pipeline: Seiten extrahieren → Template‑Transformation → Metadaten & Text speichern → Index für Suche/Filter. Wichtig ist, dass die Transformation deterministisch bleibt und die Metadaten konsistent sind, sonst funktioniert die spätere Filterung nicht zuverlässig.

Bevor wir entscheiden, sollte die Analyse dokumentiert werden (deine Regel). Ich kann dir eine kurze Analyse‑Notiz unter `docs/` als Vorschlag liefern, aber in Ask‑Mode kann ich keine Datei schreiben. Wenn du willst, liefere ich dir den Inhalt zum Kopieren. Danach würde ich eine der drei Varianten empfehlen:

### Drei Lösungsvarianten (kurz und kritisch)
1) **Batch‑Verarbeitung (serverseitig, einmalig/periodisch)**  
   - Pipeline: PDF → Seiten → Template‑QA → JSON/MD pro Maßnahme → Index.  
   - Vorteil: stabil, skalierbar, reproduzierbar.  
   - Nachteil: weniger interaktiv, braucht klaren Job‑Status & Fehler‑Handling.  
   - Passt gut zu 600 Seiten und Explorer‑Suche.

2) **Story Creator / Wizard (interaktiv, seitenweise)**  
   - Pipeline: Nutzer öffnet Seite → Wizard erzeugt Dokument + Metadaten → speichert.  
   - Vorteil: kuratierbar, bessere Qualität.  
   - Nachteil: sehr langsam bei 600 Seiten, nicht „Batch‑tauglich“.  
   - Sinnvoll nur für Stichproben oder Qualitätskontrolle.

3) **Hybrid: Batch + Qualitäts‑Wizard**  
   - Batch erzeugt alle Maßnahmen automatisch.  
   - Wizard dient für Korrekturen, Low‑Confidence‑Fälle oder wichtige Maßnahmen.  
   - Vorteil: schnell + Qualität.  
   - Nachteil: etwas mehr Systemaufwand.

### Empfehlung (ohne Tests keine „Validierung“)
Ich würde **Variante 3** wählen: Batch für Vollabdeckung, Wizard zur Nachbesserung. Das erfüllt deine Explorer‑Ziele und bleibt kontrollierbar. Kritischer Punkt: Ein **einheitliches Template‑Schema** (z. B. `measureId`, `title`, `problem`, `proposal`, `targetGroup`, `impact`, `cost`, `risks`, `sources`, `confidence`) und eine **Fehler‑/Logging‑Strategie** je Seite. Ohne robuste Fehlererfassung verlierst du Seiten oder Metadaten.

---

Wenn du willst, erstelle ich dir jetzt:
- eine **Analyse‑Notiz** für `docs/` (kurz, mit Entscheidungsbegründung),
- ein **Template‑Schema**,
- einen **minimalen Batch‑Ablauf** (pseudocode / TypeScript‑Skizze),
- und **Test‑/Validierungs‑Schritte**.

Sag mir nur, ob ich die Analyse‑Notiz und die Skizzen in Ask‑Mode liefern soll (zum Kopieren), oder ob du in Agent‑Mode wechseln willst, damit ich direkt Dateien anlege.

---

**User**

Ich habe ein PDF transformiert und erzeugt in unserem Shadow Twin Verzeichnis unsere Artefakte. Und ich würde jetzt einen eigenen Flow kreieren, der aus jedem einzelnen Artefakt, also aus jeder Seite, ein eigenes Dokument kreiert, mit einer eigenen Template-Transformation, und das in einem Unterverzeichnis dann ablegt. Das Ziel ist es, dass ich zum Beispiel jetzt dieses PDF mit zig Maßnahmen auf jeder Seite zu verarbeiten, dass ich danach für jede Maßnahme ein eigenes Dokument kreiert habe, das bestimmte Eigenschaften enthält. Ich würde das, wenn ich vielleicht keinen wieder einen eigenen Namen geben oder ein eigenes Symbol neben "story creator" einen "Multi Documents Creator" um, dass das aus den Seiten eines Dokuments viele macht oder "creates multiple documents" und das ist jetzt praktisch nur aus der File-Liste heraus startbar - ohne Batch. Es werden einfach nur viele Jobs erzeugt.
man wählt ein Template aus und die Quelle, berechnet dann die Anzahl der Seiten und ich starte es und habe dann in einem Unterverzeichnis diese ganzen Dokumente. Aus Anwendersicht sehe ich nur das Originaldokument hier und dann auch das generierte Verzeichnis mit den einzelnen Dokumenten.

---

**Cursor**

Ich sehe zwei harte Rahmenbedingungen: Erstens brauchst du pro Seite eine **eindeutige, persistierte Seiten‑Textbasis** (sonst kannst du später keine deterministische Template‑Transformation pro Seite fahren). Zweitens darf die Ablage der erzeugten Dokumente nicht mit den Shadow‑Twin‑Artefakt‑Namen kollidieren, sonst überschreiben sich Ergebnisse. Aktuell ist die Pipeline primär „1 Datei → 1 Transform‑Artefakt“, und die Story‑Creator‑UI ist genau auf diesen Fluss getrimmt. Das erklärt, warum ein „Multi Documents Creator“ als eigener Flow sinnvoll ist und nicht nur ein Button am bestehenden Story Creator.

Dazu kommt: Die Secretary‑Antwort enthält per‑Page‑Text (`metadata.text_contents`), aber der Code speichert ihn heute nicht dauerhaft. Für dein Ziel musst du diesen Seiten‑Text **entweder** beim Extract in ein eigenes Artefakt schreiben **oder** bei Bedarf neu extrahieren. Ersteres ist klar schneller und stabiler, zweiteres ist einfacher, aber teuer. Diese Abwägung würde ich vorab in `docs/` festhalten, bevor wir entscheiden.

### Drei Varianten (mit Trade‑offs)
1) **Neue Multi‑Docs‑Pipeline (empfohlen)**  
   - Speichere per‑Page‑Text einmalig beim Extract (z. B. `pages.json` im Shadow‑Twin).  
   - Multi‑Docs‑Creator liest `pages.json`, erzeugt pro Seite eine Template‑Transformation und schreibt die Ergebnisse in einen **sichtbaren** Unterordner.  
   - Vorteil: Keine Re‑OCR, reproduzierbar, klare Ergebnisse.  
   - Nachteil: Neue API + neue UI + kleiner Daten‑Persistenz‑Schritt.

2) **Jobs pro Seite über External Jobs**  
   - Pro Seite wird ein eigener External‑Job erzeugt (mit `extracted_text`), Ergebnis landet im Zielordner.  
   - Vorteil: vorhandenes Job‑Monitoring (SSE) kann wiederverwendet werden.  
   - Nachteil: Namenskonflikte + sehr viele Jobs, komplexer Job‑Status.

3) **Wizard‑Variante (manuell/semi‑automatisch)**  
   - Wizard iteriert Seite für Seite, erzeugt Dokumente.  
   - Vorteil: Qualität hoch.  
   - Nachteil: Bei 600 Seiten faktisch unbrauchbar.

---

## Konkreter Vorschlag (minimaler Umbau)
**Kurzfassung:** Variante 1. Neue API „pages‑to‑docs“, neue UI‑Aktion „Multi Documents Creator“, und eine kleine Ergänzung im Extract‑Callback, um `pages.json` zu speichern.

**UI‑Entry‑Points (wo andocken):**
- In der Vorschau‑Toolbar gibt es bereits den „Story Creator“‑Button. Dort kannst du einen zweiten Button „Multi Documents Creator“ ergänzen.
  
```1050:1090:src/components/library/file-preview.tsx
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const url = `/library/story-creator?libraryId=${encodeURIComponent(activeLibraryId)}&fileId=${encodeURIComponent(displayFile.id)}&parentId=${encodeURIComponent(displayFile.parentId)}&left=off`
              router.push(url)
            }}
          >
            Story Creator
          </Button>
```

- Auch im Flow‑Header ist der Story‑Creator bereits verdrahtet, ideal für ein zweites Icon.

```473:522:src/components/library/flow/flow-actions.tsx
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>
```

- Story‑Creator als „Single‑File‑Entry“ ist auch dokumentiert (hilfreich für die neue Doku).

```34:42:docs/architecture/artifact-pipeline-v3-design.md
## User journey (Story Creator)
The UI entry point for single-file processing is the **Story Creator** (library page + dedicated route). It frames the pipeline in user terms:
1. **Text erzeugen** (OCR/Extract or Transkription)
2. **Transformieren** (template-based LLM structuring)
3. **Veröffentlichen** (RAG ingestion/index)
```

---

## Analyse‑Notiz für `docs/` (zum Kopieren)
Du wolltest vor der Entscheidung eine dokumentierte Analyse. Hier ist ein kurzer Entwurf im **einfachen Englisch** (Repo‑Konvention):

```md
# Multi Documents Creator – Page-Based Template Transformation

## Goal
Create one document per PDF page (each page = one measure). The resulting documents must be searchable in Explorer Mode by metadata and template-derived fields.

## Current State
- Story Creator handles single-file processing.
- External jobs extract full text and store Shadow-Twin artifacts.
- Page-level text (metadata.text_contents) is available in the Secretary response but is not persisted.

## Problem
We need stable, per-page text inputs and deterministic file naming. Without persisted page text, we must re-extract on demand.

## Options
1) Persist page text during extract (pages.json in Shadow-Twin), then run a new pages-to-docs pipeline.
2) Create one external job per page and feed extracted_text into the callback.
3) Manual wizard workflow (page-by-page).

## Decision Criteria
- Scalability for 600+ pages
- Deterministic outputs (no overwrite, stable naming)
- Minimal re-OCR cost
- Low UI friction

## Proposed Direction
Option 1: store pages.json in the Shadow-Twin and build a dedicated Multi Documents Creator flow.

## Risks
- pages.json might be missing for older artifacts (requires fallback or re-extract).
- Template outputs need a naming scheme to avoid collisions.

## Validation
- Unit test: page extraction + naming rules.
- Integration test: pages-to-docs API with a 3-page PDF.
- Manual test: Explorer filters find generated measures.
```

---

## Wenn du Variante 1 willst: technische Skizze
**Neue API (Vorschlag):**  
`POST /api/transform/pages-to-docs`  
Payload: `{ libraryId, sourceFileId, parentId, templateName, targetLanguage, pageRange?, outputFolderName? }`

**Server‑Ablauf:**
1) Auth via Clerk, `LibraryService.getInstance()` + `StorageFactory`.  
2) `findShadowTwinFolder` → lade `pages.json`.  
3) Erzeuge Zielordner, z. B. `${slug(baseName)}-measures` (lowercase + hyphen).  
4) Für jede Seite: `transformTextWithTemplate(text, templateName, targetLanguage)` → Ergebnis als Markdown in Zielordner schreiben, Name z. B. `${baseName}-p001.md`.  
5) Frontmatter anreichern: `source_file_id`, `page`, `template`, `language`.

**Persistenz von `pages.json` (minimal):**
- Im Extract‑Callback die `metadata.text_contents` übernehmen und **einmalig** als `pages.json` im Shadow‑Twin‑Ordner ablegen.  
- Damit bleibt der Multi‑Docs‑Flow rein lesend und schnell.

---

## Tests/Validierung (noch nicht ausgeführt)
- Unit: `pages.json` Parser + slugging + Page‑Range.  
- Integration: `pages-to-docs` mit einer kleinen Test‑PDF (3 Seiten).  
- Manuell: Explorer‑Filter prüfen (Template‑Metadaten im Frontmatter sichtbar).

---

Wenn du möchtest, liefere ich dir die **konkreten Code‑Änderungen** als Copy‑Paste‑Snippets (Ask‑Mode), oder ich setze es direkt um (Agent‑Mode). Ich habe keine Tests ausgeführt.

```typescriptreact
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const url = `/library/story-creator?libraryId=${encodeURIComponent(activeLibraryId)}&fileId=${encodeURIComponent(displayFile.id)}&parentId=${encodeURIComponent(displayFile.parentId)}&left=off`
              router.push(url)
            }}
          >
            Story Creator
          </Button>
```

```typescriptreact
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>
```

```plaintext
## User journey (Story Creator)
The UI entry point for single-file processing is the **Story Creator** (library page + dedicated route). It frames the pipeline in user terms:
1. **Text erzeugen** (OCR/Extract or Transkription)
2. **Transformieren** (template-based LLM structuring)
3. **Veröffentlichen** (RAG ingestion/index)
```

```plaintext
# Multi Documents Creator – Page-Based Template Transformation

## Goal
Create one document per PDF page (each page = one measure). The resulting documents must be searchable in Explorer Mode by metadata and template-derived fields.

## Current State
- Story Creator handles single-file processing.
- External jobs extract full text and store Shadow-Twin artifacts.
- Page-level text (metadata.text_contents) is available in the Secretary response but is not persisted.

## Problem
We need stable, per-page text inputs and deterministic file naming. Without persisted page text, we must re-extract on demand.

## Options
1) Persist page text during extract (pages.json in Shadow-Twin), then run a new pages-to-docs pipeline.
2) Create one external job per page and feed extracted_text into the callback.
3) Manual wizard workflow (page-by-page).

## Decision Criteria
- Scalability for 600+ pages
- Deterministic outputs (no overwrite, stable naming)
- Minimal re-OCR cost
- Low UI friction

## Proposed Direction
Option 1: store pages.json in the Shadow-Twin and build a dedicated Multi Documents Creator flow.

## Risks
- pages.json might be missing for older artifacts (requires fallback or re-extract).
- Template outputs need a naming scheme to avoid collisions.

## Validation
- Unit test: page extraction + naming rules.
- Integration test: pages-to-docs API with a 3-page PDF.
- Manual test: Explorer filters find generated measures.
```

---

**User**

Ich habe noch eine andere Idee. Wenn unter den Artefakten alle Seiten gespeichert sind bei einer normalen PDF-Transformation, kann ich ja hergehen und diese Seiten in ein normales Verzeichnis kopieren, manuell, und dann eine normale Batch-Transformation starten, wo wir da jetzt nicht PDFs transformieren, sondern Seiten transformieren. Image mit der Transformation in Dokumente. Dann müssten wir nur wenigstens programmieren. Theoretisch müsste das ja funktionieren, oder?

---

**Cursor**

Ich sehe den Gedanken, aber mit der bestehenden Logik ist das **nicht** so einfach. Aktuell werden die „Seiten“ aus der PDF‑Extraktion zwar als **Bild‑ZIP** oder in `mistral_ocr_raw` geliefert, aber **nicht** als einzelne Markdown‑Dateien abgelegt. Du würdest also beim „manuellen Kopieren“ nur Bilder haben, keine Texte. Die vorhandene Batch‑Transformation kann **Texte** (Markdown) oder **Audio/Video/PDF** verarbeiten, aber **nicht** Bild‑Seiten in sinnvolle Texte verwandeln. Ohne OCR pro Bildseite bekommst du also keine inhaltlichen Antworten aus dem Template.

Zweiter Punkt: Selbst wenn du Seiten als Textdateien hättest, ist die aktuelle Batch‑Transformation für Text **nicht** „ein Dokument pro Datei“, sondern **ein Dokument aus allen Texten zusammen**. Das steht so im Batch‑Service (`transformTextBatch`). Das passt nicht zu deinem Ziel „pro Seite ein Dokument“. Damit würde deine Idee in der aktuellen Form **ein großes Dokument** erzeugen, nicht 600 einzelne.

### Drei Varianten (kritisch, realistisch)
1) **Minimaler Umbau (empfohlen)**  
   - Persistiere `pages.json` (Text pro Seite) beim Extract einmalig.  
   - Multi‑Docs‑Flow erstellt pro Seite ein Dokument.  
   - Wenig Risiko, deterministisch, kein Re‑OCR.

2) **OCR pro Bildseite im Batch**  
   - Seitenbilder als einzelne Dateien, dann OCR pro Bild in Text umwandeln, danach Template.  
   - Sehr teuer und fehleranfällig, besonders bei 600 Seiten.

3) **Manuelle Kopie + Batch‑Text**  
   - Funktioniert **nicht** wie gewünscht, weil Batch‑Text alles zusammenfasst.  
   - Nur sinnvoll, wenn du absichtlich ein Sammeldokument willst.

**Kurz:** Theoretisch nur dann, wenn du pro Seite zuerst Text bekommst und danach eine „per‑File‑Transformation“ für Text baust. Mit dem aktuellen Stand ist das **nicht** erfüllt.

Wenn du willst, skizziere ich dir eine Minimal‑Änderung, die **genau** deine Idee unterstützt (wenige Zeilen):  
- beim Extract `pages.json` speichern  
- neue kleine „Batch‑per‑File‑Transform“ nur für Markdown‑Dateien (pro Datei ein Output)

Sag Bescheid, ob ich dir das als Copy‑Paste‑Snippets ausarbeite.

---

**User**

Ja, aber diese generierte Markdown aus dem PDF-Transformation hat ja eine Seitentrennung und es wird ja bei der Kapitelanalyse dann auch auf, wir haben alle Seitennummern und die Anzahl der Seiten wird ja auch berechnet aus der Anzahl dieser Seiten. Das heißt, ich könnte schon eine zusätzliche Transformation anbieten, wo ich sage, jetzt mache ich diese Template-Transformation nicht mit dem gesamten PDF-Dokument, sondern pro Seite. Ich erstelle dann dynamisch für jede Seite einen Jaburger und als Quelle generiere ich Nein, noch besser. Ich brauche eigentlich nur eine Funktion, die ein bestehendes Markdown von einer PDF-Transformation in einzelne Seiten splitted den Text und als eigene Dateien abspeichert. Danach kann ich ganz normal mit dieser Batch-Transformation über das Verzeichnis alle einzelnen Seiten mit einem bestimmten Template verarbeiten. Das wäre meiner Meinung nach der einfachste Weg zu einem Markdown-Splitter.

---

**Cursor**

Ich stimme dir grundsätzlich zu, aber mit zwei **kritischen Einschränkungen**: (1) Die Seitentrennung steckt in der **Extract/Transcript‑Markdown**, nicht in der Template‑Transformation. Die Template‑Ausgabe ist bereits „verarbeitet“ und kann die Marker verlieren. (2) Die aktuelle Batch‑Transformation für **Text** erzeugt **ein einziges Dokument aus allen Dateien**, nicht ein Dokument pro Datei. Dein Splitter bringt dir also nur dann das gewünschte Ergebnis, wenn wir zusätzlich einen „per‑File“-Transform‑Pfad für Text anbieten. Das ist der wichtigste Stolperstein.

Die Marker sind im System explizit vorgesehen. In `phase-template.ts` wird die Seitenzahl aus `--- Seite N ---` rekonstruiert, was zeigt, dass diese Marker im Extract‑Markdown existieren und als zuverlässig gelten. Das stützt deine Idee „Markdown‑Splitter“. Aber: Das funktioniert nur, wenn du **den Transcript/Extract** splittest (nicht die Transformation) und wenn die Marker tatsächlich enthalten sind. Für PDFs ohne OCR‑Marker oder abweichende Formate bräuchtest du Fallbacks.

```444:448:src/lib/external-jobs/phase-template.ts
const pageMarkerRegex = /^---\s*Seite\s*(\d+)\s*---\s*$/gm
let match: RegExpExecArray | null
while ((match = pageMarkerRegex.exec(textSourceForRepair))) {
  const pageNo = Number(match[1])
```

```181:188:src/lib/transform/batch-transform-service.ts
  /**
   * Transformiert eine Batch von Text-Dateien (alle zusammen als ein Dokument)
   */
  static async transformTextBatch(
    items: BatchTransformationItem[],
    baseOptions: BaseTransformOptions,
```

### Drei Varianten (damit es wirklich klappt)
1) **Splitter + neuer „Per‑File Text Transform“ (empfohlen)**  
   - Splitte Transcript‑Markdown in `page-001.md` … `page-600.md`.  
   - Neue Batch‑Option: „pro Datei transformieren“ statt „alle zusammen“.  
   - Ergebnis: Pro Seite ein Dokument.

2) **Splitter + Story‑Creator pro Seite (ohne neue Batch‑Funktion)**  
   - Splitter erzeugt 600 Dateien.  
   - Du startest pro Datei eine normale Einzel‑Transformation (automatisierbar).  
   - Ergebnis stimmt, aber UI/Job‑Overhead sehr hoch.

3) **OCR‑Pages + Bild‑Batch**  
   - Seiten als Bilder, dann OCR pro Bild und Template.  
   - Funktioniert, ist aber teuer und fehleranfällig.

### Was ich dir konkret vorschlage
- **Splitter** auf Basis der `--- Seite N ---` Marker aus dem **Transcript**.  
- **Kleine Erweiterung** der Batch‑Transformation: Option „per‑File“ für Markdown.  
- Damit bleibt der Code minimal und du bekommst exakt „1 Seite → 1 Dokument“.

Wenn du willst, liefere ich dir in Ask‑Mode die **konkreten Code‑Snippets** für:  
- `splitMarkdownIntoPages(markdown)`  
- `savePagesToFolder(provider, ...)`  
- eine kleine Erweiterung in der Batch‑Transformation, die „per‑File“ statt „all‑in‑one“ macht.

Sag mir, ob du den Splitter nur als Utility willst oder gleich den per‑File‑Batch‑Pfad.

```typescript
const pageMarkerRegex = /^---\s*Seite\s*(\d+)\s*---\s*$/gm
let match: RegExpExecArray | null
while ((match = pageMarkerRegex.exec(textSourceForRepair))) {
  const pageNo = Number(match[1])
```

```typescript
  /**
   * Transformiert eine Batch von Text-Dateien (alle zusammen als ein Dokument)
   */
  static async transformTextBatch(
    items: BatchTransformationItem[],
    baseOptions: BaseTransformOptions,
```

---

**User**

Ich verstehe den unterschied zwischen diesen beiden Varianten nicht genau:
1) Splitter + neuer „Per‑File Text Transform“ (empfohlen)
Splitte Transcript‑Markdown in page-001.md … page-600.md.
Neue Batch‑Option: „pro Datei transformieren“ statt „alle zusammen“.
Ergebnis: Pro Seite ein Dokument.
2) Splitter + Story‑Creator pro Seite (ohne neue Batch‑Funktion)
Splitter erzeugt 600 Dateien.
Du startest pro Datei eine normale Einzel‑Transformation (automatisierbar).
Ergebnis stimmt, aber UI/Job‑Overhead sehr hoch.

---

**Cursor**

Der Unterschied liegt **nur** darin, *wie* die Template‑Transformation ausgelöst wird – und wie viele Jobs/Interaktionen dabei entstehen.

### 1) Splitter + **neue Batch‑Option „pro Datei transformieren“**
- Du erzeugst 600 `page-XXX.md`.
- **Ein einziger Batch‑Lauf** nimmt alle Seiten und erzeugt **600 Output‑Dokumente**.
- Dafür braucht es **eine kleine Erweiterung** der Batch‑Transformation, damit sie *pro Datei* arbeitet (nicht „alle zusammen“).
- **Vorteil:** ein Start, ein Monitoring, wenig UI‑Overhead.

### 2) Splitter + **Story‑Creator pro Seite**
- Du erzeugst 600 `page-XXX.md`.
- Dann startest du **600 Einzel‑Jobs** (jeder läuft wie Story Creator).
- **Vorteil:** keine Änderung an der Batch‑Logik.
- **Nachteil:** extrem viele Jobs, viele UI‑Updates, viel Overhead.

**Kurz:**  
Variante 1 = „ein Batch‑Job, 600 Outputs“.  
Variante 2 = „600 Einzel‑Jobs, 600 Outputs“.

Wenn du willst, kann ich dir eine Mini‑Skizze zeigen, wie die Batch‑Option „per‑File“ aussehen würde, damit es für dich greifbar wird.

---

**User**

Ja bitte Variante 1 umsetzen. Wo werden die Dokumente gespeichert? Am Besten ein Verzeichnis erstellen, das den Namen der Quelldatei hat. Danach kann ich über dieses Verzeichnis eine Batchtransformation starten.

---

**Cursor**

```markdown
# Markdown Page Splitting for PDF Measures

## Context
We need one document per PDF page (each page represents a single measure). The current PDF pipeline already inserts explicit page markers in the transcript markdown (`--- Seite N ---`). These markers are reliable enough for deterministic splitting without re-running OCR.

## Options Considered
- **Split transcript markdown into per-page files, then transform per file.**  
  Low risk and minimal new logic, but requires a per-file transform mode to avoid combined output.
- **Create one external job per page.**  
  Accurate but creates high orchestration overhead.
- **Re-OCR page images.**  
  Expensive and unnecessary because transcript markers already exist.

## Decision
Implement a **page splitter** that turns transcript markdown into `page-XXX.md` files inside a folder named after the source file. Then extend batch transformation with a **per-file mode** so each page gets its own template output.

## Risks & Mitigations
- **Missing or malformed page markers** → return a clear error and avoid partial output.
- **Unsafe folder names** → sanitize source file name to a filesystem-safe folder name.
- **Output collisions** → use deterministic `page-XXX` names and template-specific output names.

## Validation Plan
- Unit test for page splitting using real marker format.
- Manual test: split a PDF transcript and confirm 1 file per page.
- Batch test: per-file transform yields one output document per page.

```

```yaml
site_name: Common Knowledge Scout
site_url: http://localhost:3000/docs
repo_url: https://github.com/bCommonsLAB/CommonKnowledgeScout
docs_dir: docs
site_dir: public/docs

theme:
  name: material
  language: en
use_directory_urls: false

extra_javascript:
  - https://unpkg.com/mermaid@10.9.1/dist/mermaid.min.js
  - assets/javascripts/mermaid-init.js

extra_css:
  - assets/stylesheets/print.css

plugins:
  - search
  - print-site:
      add_to_navigation: false
      print_page_title: 'Common Knowledge Scout – Complete Document'

markdown_extensions:
  - admonition
  - toc:
      permalink: true
  - pymdownx.details
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format

nav:
  - Home: index.md
  # Overview: - Dateien existieren nicht
  #   - Start: overview/index.md
  #   - Intro: overview/intro.md
  #   - Features: overview/features.md
  - Architecture:
      - Module Hierarchy: architecture/module-hierarchy.md
      - Dependency Graph: architecture/dependency-graph.md
      - Shadow-Twin: architecture/shadow-twin.md
      - PDF Transformation Phases: architecture/pdf-transformation-phases.md
      - MongoDB Vector Search: architecture/mongodb-vector-search.md
  - Analysis:
      - Shadow-Twin (v2-only): analysis/shadow-twin-v2-only.md
      - Wizard & External Jobs: analysis/wizard-and-jobs.md
      - Audio/Video (no template): analysis/audio-jobs-transcript-only.md
      - Ingestion: analysis/ingestion.md
      - Storage: analysis/storage.md
      - Markdown Page Splitting: analysis/markdown-page-splitting.md
  # Guide: - Dateien existieren nicht
  #   - Start: guide/index.md
  #   - Setup: guide/setup.md
  #   - Getting Started: guide/getting-started.md
  #   - Settings: guide/settings.md
  #   - Using the Library: guide/library.md
  #   - Event Monitor: guide/event-monitor.md
  #   - Batch Session Import: guide/batch-session-import.md
  #   - Troubleshooting: guide/troubleshooting.md
  #   - FAQ: guide/faq.md
  - Use Cases:
      - Overview: use-cases/index.md
      - Library Setup: use-cases/library-setup.md
      - PDF Transformation: use-cases/file-transformation-pdf.md
      - Media Transformation: use-cases/file-transformation-media.md
      - Web Scraping: use-cases/web-scraping.md
      - Publishing: use-cases/publishing.md
      - Chat & Story Mode: use-cases/chat-exploration.md
      - Batch Operations: use-cases/batch-operations.md
  # Concepts: - Die meisten Dateien existieren nicht
  #   - Start: concepts/index.md
  #   - Storage Provider: concepts/storage-provider.md
  #   - FileSystem (Local): concepts/localstorage.md
  #   - Image Transformation: concepts/image-transformation.md
  #   - PDF Extraction: concepts/pdf/extraction-methods.md
  #   - Metadata: concepts/metadata.md
  #   - Library:
  #       - Overview: concepts/library/overview.md
  #       - Global State: concepts/library/global-state.md
  #       - Header: concepts/library/header.md
  #       - Breadcrumb: concepts/library/breadcrumb.md
  #       - FileTree: concepts/library/file-tree.md
  #       - FileList: concepts/library/file-list.md
  #       - Upload: concepts/library/upload.md
  #       - FilePreview: concepts/library/file-preview.md
  #       - Transcription: concepts/library/transcription.md
  #       - Transform: concepts/library/transform.md
  #       - Batch Transcription: concepts/library/batch-transcription.md
  #       - Error Handling & Tests: concepts/library/error-handling-logging-testing.md
  #       - Initialization: concepts/library/initialization-sequence.md
  #   - Library Components: concepts/library/components.md
  #   - Shadow-Twin: concepts/features/shadowtwins.md
  #   - Extended Shadow-Twin: concepts/features/extended-shadowtwin.md
  #   - Transformation Service: concepts/features/transformation-service.md
  #   - Video Transformation: concepts/video-transformation.md
  - Reference:
      - File Index: reference/file-index.md
      - Modules:
          - Library: reference/modules/library.md
          - Storage: reference/modules/storage.md
          - Chat: reference/modules/chat.md
      # Glossary: reference/glossary.md - Datei existiert nicht
      # Secretary Services: reference/api/secretary-services.md - Datei existiert nicht
      # Track Processor: reference/api/track-processor.md - Datei existiert nicht
      # Chat & Story Mode: chat-response-generation-process.md - Datei existiert nicht
  # Operations: - Dateien existieren nicht
  #   - Start: ops/index.md
  #   - Docker Deployment: ops/deployment/docker.md
  #   - Electron Quick Setup: ops/desktop/quick-setup.md
  #   - Electron Package Strategy: ops/desktop/package-strategy.md
  # Analyse und Archiv absichtlich nicht verlinkt/gebaut

```

```typescript
/**
 * @fileoverview Markdown Page Splitter
 *
 * @description
 * Splits transcript markdown into per-page chunks based on explicit page markers.
 * This enables deterministic per-page processing without re-running OCR.
 */

export interface MarkdownPageSlice {
  /** Page number extracted from marker (e.g. "--- Seite 12 ---") */
  pageNumber: number
  /** Markdown body content for this page, without the marker line */
  content: string
}

export interface SplitMarkdownByPagesResult {
  pages: MarkdownPageSlice[]
  markerCount: number
}

const PAGE_MARKER_REGEX = /^---\s*Seite\s*(\d+)\s*---\s*$/gm

/**
 * Removes YAML frontmatter from markdown to ensure markers are parsed from the body.
 * We keep this logic local to avoid coupling to any specific frontmatter parser.
 */
function stripFrontmatter(markdown: string): string {
  const fm = /^---\n([\s\S]*?)\n---\n?/
  return markdown.replace(fm, '')
}

/**
 * Splits markdown into per-page slices by looking for "--- Seite N ---" markers.
 * This function is intentionally strict: no markers means no pages.
 */
export function splitMarkdownByPageMarkers(markdown: string): SplitMarkdownByPagesResult {
  const body = stripFrontmatter(markdown)
  const matches: Array<{ index: number; length: number; pageNumber: number }> = []

  let match: RegExpExecArray | null
  while ((match = PAGE_MARKER_REGEX.exec(body))) {
    const pageNumber = Number(match[1])
    if (Number.isFinite(pageNumber) && pageNumber > 0 && typeof match.index === 'number') {
      matches.push({ index: match.index, length: match[0].length, pageNumber })
    }
  }

  if (matches.length === 0) {
    return { pages: [], markerCount: 0 }
  }

  const pages: MarkdownPageSlice[] = []
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i]
    const next = matches[i + 1]
    const start = current.index + current.length
    const end = next ? next.index : body.length
    const content = body.slice(start, end).trim()
    pages.push({ pageNumber: current.pageNumber, content })
  }

  return { pages, markerCount: matches.length }
}

/**
 * Derives a filesystem-safe folder name from a file name.
 * We avoid importing other helpers to keep this module small and testable.
 */
export function toSafeFolderName(fileName: string): string {
  const normalized = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || 'pages'
}

```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import path from 'path'

import { FileLogger } from '@/lib/debug/logger'
import { LibraryService } from '@/lib/services/library-service'
import { StorageFactory } from '@/lib/storage/storage-factory'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import {
  splitMarkdownByPageMarkers,
  toSafeFolderName,
} from '@/lib/markdown/markdown-page-splitter'

interface SplitPagesRequestBody {
  sourceFileId: string
  targetLanguage?: string
  outputFolderName?: string
}

interface SplitPagesError {
  code: string
  message: string
  status: number
  details?: Record<string, unknown>
}

function createSplitError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): SplitPagesError {
  return { code, message, status, details }
}

function isMarkdownFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.mdx')
}

function isMarkdownMimeType(mimeType: string | undefined): boolean {
  return (mimeType || '').toLowerCase().includes('markdown')
}

function buildPageFrontmatter(args: {
  sourceFileId: string
  sourceFileName: string
  pageNumber: number
  totalPages: number
}): string {
  // Dokumentiert: Wir fügen die Herkunft explizit hinzu, damit Explorer-Filter stabil bleiben.
  return [
    '---',
    `source_file_id: ${args.sourceFileId}`,
    `source_file_name: ${JSON.stringify(args.sourceFileName)}`,
    `page: ${args.pageNumber}`,
    `pages_total: ${args.totalPages}`,
    '---',
    '',
  ].join('\n')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'Keine Benutzer-E-Mail gefunden' }, { status: 401 })

    const { libraryId } = await params
    const body = (await request.json().catch(() => ({}))) as Partial<SplitPagesRequestBody>
    const sourceFileId = typeof body.sourceFileId === 'string' ? body.sourceFileId : ''
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    const outputFolderName = typeof body.outputFolderName === 'string' ? body.outputFolderName : ''

    if (!libraryId || !sourceFileId) {
      return NextResponse.json({ error: 'libraryId und sourceFileId erforderlich' }, { status: 400 })
    }

    // Library laden (Pflicht, da StorageFactory davon abhängt)
    const library = await LibraryService.getInstance()
      .getLibrary(userEmail, libraryId)
      .catch(() => undefined)
    if (!library) {
      return NextResponse.json({ error: 'Library nicht gefunden' }, { status: 404 })
    }

    // Storage-Provider initialisieren
    const factory = StorageFactory.getInstance()
    factory.setLibraries([
      {
        id: library.id,
        label: library.label,
        type: library.type,
        path: library.path,
        isEnabled: library.isEnabled,
        config: (library.config as unknown as Record<string, unknown>) || {},
      },
    ])
    const provider = await factory.getProvider(library.id)

    // Source-Datei laden, um Name/Parent zu kennen (für deterministischen Ordnernamen)
    const sourceItem = await provider.getItemById(sourceFileId)
    if (!sourceItem || sourceItem.type !== 'file') {
      return NextResponse.json({ error: 'Quelle ist keine Datei' }, { status: 400 })
    }

    const sourceFileName = sourceItem.metadata.name
    const parentId = sourceItem.parentId || 'root'
    const sourceBaseName = path.parse(sourceFileName).name

    // 1) Wenn die Quelle schon Markdown ist: direkt verwenden
    // 2) Sonst: Transcript per Shadow‑Twin Resolver suchen (Marker sind dort verlässlich)
    const resolvedMarkdown = isMarkdownFileName(sourceFileName) || isMarkdownMimeType(sourceItem.metadata.mimeType)
      ? { fileId: sourceFileId }
      : await resolveArtifact(provider, {
          sourceItemId: sourceFileId,
          sourceName: sourceFileName,
          parentId,
          targetLanguage,
          preferredKind: 'transcript',
        })

    if (!resolvedMarkdown?.fileId) {
      return NextResponse.json(
        { error: 'Transcript-Markdown nicht gefunden (kein Split möglich)' },
        { status: 404 }
      )
    }

    // Markdown laden
    const markdownBinary = await provider.getBinary(resolvedMarkdown.fileId)
    const markdown = await markdownBinary.blob.text()

    // Seiten splitten (harte Validierung: ohne Marker keine Ausgabe)
    const splitResult = splitMarkdownByPageMarkers(markdown)
    if (splitResult.pages.length === 0) {
      const splitError = createSplitError(
        'no_page_markers',
        'Keine Seitenmarker gefunden (Format: "--- Seite N ---")',
        422,
        { markerCount: splitResult.markerCount }
      )
      FileLogger.warn('split-pages', splitError.message, splitError.details)
      return NextResponse.json({ error: splitError.message, code: splitError.code }, { status: splitError.status })
    }

    // Zielordner finden oder erstellen
    const requestedFolder = outputFolderName.trim() || sourceBaseName
    const folderName = toSafeFolderName(requestedFolder)
    const siblings = await provider.listItemsById(parentId)
    const existingFolder = siblings.find(
      (it) => it.type === 'folder' && (it.metadata?.name || '') === folderName
    )
    const targetFolder = existingFolder || (await provider.createFolder(parentId, folderName))

    // Seiten als einzelne Markdown-Dateien speichern
    let createdCount = 0
    for (const page of splitResult.pages) {
      try {
        // Erklärung: deterministischer Dateiname für stabile Batch-Auswahl
        const padded = String(page.pageNumber).padStart(3, '0')
        const fileName = `page-${padded}.md`
        const frontmatter = buildPageFrontmatter({
          sourceFileId,
          sourceFileName,
          pageNumber: page.pageNumber,
          totalPages: splitResult.pages.length,
        })
        const content = `${frontmatter}${page.content.trim()}\n`
        const file = new File([content], fileName, { type: 'text/markdown' })
        await provider.uploadFile(targetFolder.id, file)
        createdCount += 1
      } catch (error) {
        // Fehler dokumentieren, aber den Split nicht komplett abbrechen (teilweise Ergebnisse sind erlaubt)
        FileLogger.error('split-pages', 'Fehler beim Speichern einer Seite', {
          sourceFileId,
          page: page.pageNumber,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      folderId: targetFolder.id,
      folderName: targetFolder.metadata.name,
      created: createdCount,
      pages: splitResult.pages.length,
      sourceMarkdownId: resolvedMarkdown.fileId,
    })
  } catch (error) {
    FileLogger.error('split-pages', 'Unerwarteter Fehler beim Splitten', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

```

```typescriptreact
*** Begin Patch
*** Update File: src/components/library/file-preview.tsx
@@
-import { Button } from '@/components/ui/button';
+import { Button } from '@/components/ui/button';
+import { toast } from "sonner"
@@
 export function FilePreview({ 
   className,
   provider,
   file,
   onRefreshFolder
 }: FilePreviewProps) {
@@
   const [state, dispatch] = React.useReducer(filePreviewReducer, initialState);
+  const [isSplittingPages, setIsSplittingPages] = React.useState(false)
@@
   if (!displayFile) {
@@
   return (
     <div className={cn("h-full flex flex-col", className)}>
       <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
@@
         <div className="flex items-center gap-2">
           <StoryStatusIcons steps={storyStatus.steps} />
@@
           <Button
             size="sm"
             variant="secondary"
             onClick={() => {
               const url = `/library/story-creator?libraryId=${encodeURIComponent(activeLibraryId)}&fileId=${encodeURIComponent(displayFile.id)}&parentId=${encodeURIComponent(displayFile.parentId)}&left=off`
               router.push(url)
             }}
           >
             Story Creator
           </Button>
+          {(fileType === 'pdf' || fileType === 'markdown') ? (
+            <Button
+              size="sm"
+              variant="outline"
+              disabled={isSplittingPages}
+              onClick={async () => {
+                if (!activeLibraryId || !displayFile.id) return
+                // Erklärung: Split startet serverseitig, damit große PDFs nicht im Browser zerlegt werden.
+                setIsSplittingPages(true)
+                try {
+                  const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
+                    method: 'POST',
+                    headers: { 'Content-Type': 'application/json' },
+                    body: JSON.stringify({
+                      sourceFileId: displayFile.id,
+                      targetLanguage: 'de',
+                    }),
+                  })
+                  const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderId?: string; folderName?: string; created?: number }
+                  if (!res.ok) {
+                    const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
+                    throw new Error(msg)
+                  }
+                  toast.success("Seiten gesplittet", {
+                    description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`
+                  })
+                  // UI-Liste aktualisieren, damit der neue Ordner sichtbar wird.
+                  if (onRefreshFolder && displayFile.parentId) {
+                    const refreshed = await provider?.listItemsById(displayFile.parentId)
+                    if (refreshed) onRefreshFolder(displayFile.parentId, refreshed)
+                  }
+                } catch (error) {
+                  toast.error("Split fehlgeschlagen", {
+                    description: error instanceof Error ? error.message : "Unbekannter Fehler"
+                  })
+                } finally {
+                  setIsSplittingPages(false)
+                }
+              }}
+            >
+              Seiten splitten
+            </Button>
+          ) : null}
*** End Patch
```

```typescriptreact
'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { MarkdownMetadata } from './markdown-metadata';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, librariesAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"
import { JobReportTab } from './job-report-tab';
// PdfPhasesView ist bewusst NICHT mehr Teil der File-Preview (zu heavy). Flow-View ist der Expertenmodus.
import { shadowTwinStateAtom } from '@/atoms/shadow-twin-atom';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';
import { DetailViewRenderer } from './detail-view-renderer';
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from "sonner"
import { resolveArtifactClient } from '@/lib/shadow-twin/artifact-client';
import { ExternalLink, RefreshCw } from "lucide-react";
import { SourceAndTranscriptPane } from "@/components/library/shared/source-and-transcript-pane"
import { useResolvedTranscriptItem } from "@/components/library/shared/use-resolved-transcript-item"
import { ArtifactInfoPanel } from "@/components/library/shared/artifact-info-panel"
import { useStoryStatus } from "@/components/library/shared/use-story-status"
import { StoryStatusIcons } from "@/components/library/shared/story-status-icons"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { StoryView } from "@/components/library/shared/story-view"
import { IngestionDataProvider } from "@/components/library/shared/ingestion-data-context"

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

// Komponente, die JobReportTab mit Shadow-Twin-Unterstützung umschließt
// Verwendet jetzt den zentralen resolveArtifactClient statt lokaler Heuristik
function JobReportTabWithShadowTwin({
  libraryId,
  fileId,
  fileName,
  parentId,
  provider
}: {
  libraryId: string;
  fileId: string;
  fileName: string;
  parentId: string;
  provider: StorageProvider | null;
}) {
  const [mdFileId, setMdFileId] = React.useState<string | null>(null);
  const [baseFileId, setBaseFileId] = React.useState<string>(fileId);
  const [isLoading, setIsLoading] = React.useState(true);

  // Variante C: Vollständig über API - kein lokales Parsing mehr
  React.useEffect(() => {
    async function resolveArtifact() {
      setIsLoading(true);

      // Rufe zentrale Resolver-API auf
      // Priorität 1: Transformation (hat Frontmatter)
      let resolved = await resolveArtifactClient({
        libraryId,
        sourceId: fileId,
        sourceName: fileName,
        parentId,
        targetLanguage: 'de', // Standard-Sprache
        preferredKind: 'transformation',
      });

      // Priorität 2: Fallback zu Transcript wenn keine Transformation gefunden
      if (!resolved) {
        resolved = await resolveArtifactClient({
          libraryId,
          sourceId: fileId,
          sourceName: fileName,
          parentId,
          targetLanguage: 'de', // Standard-Sprache
          preferredKind: 'transcript',
        });
      }

      if (resolved) {
        setMdFileId(resolved.fileId);
        setBaseFileId(fileId); // Basis-Datei bleibt fileId
        FileLogger.debug('JobReportTabWithShadowTwin', 'Artefakt über Resolver gefunden', {
          originalFileId: fileId,
          resolvedFileId: resolved.fileId,
          resolvedFileName: resolved.fileName,
          kind: resolved.kind,
          location: resolved.location,
        });
      } else {
        // Kein Artefakt gefunden - verwende Basis-Datei direkt
        setMdFileId(null);
        setBaseFileId(fileId);
        FileLogger.debug('JobReportTabWithShadowTwin', 'Kein Shadow-Twin-Artefakt gefunden, verwende Basis-Datei', {
          fileId,
          fileName,
          parentId,
        });
      }

      setIsLoading(false);
    }

    if (libraryId && fileId && parentId) {
      resolveArtifact().catch((error) => {
        FileLogger.error('JobReportTabWithShadowTwin', 'Fehler bei Artefakt-Auflösung', {
          fileId,
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
        setIsLoading(false);
        setMdFileId(null);
        setBaseFileId(fileId);
      });
    } else {
      setIsLoading(false);
    }
  }, [libraryId, fileId, fileName, parentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Lade Metadaten...</p>
      </div>
    );
  }

  return (
    <JobReportTab 
      libraryId={libraryId} 
      fileId={baseFileId} 
      fileName={fileName} 
      provider={provider}
      mdFileId={mdFileId}
      sourceMode="frontmatter"
      viewMode="metaOnly"
    />
  );
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    // Prüfe, ob es sich um einen Ordner handelt (root ist ein Ordner)
    if (item.type === 'folder' || item.id === 'root') {
      FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Ordner', {
        itemId: item.id,
        itemName: item.metadata.name,
        itemType: item.type
      });
      contentCache.current.set(item.id, { content: '', hasMetadata: false });
      onContentLoaded('', false);
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.type, item?.metadata?.name, provider, fileType, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}) {
  const [infoTab, setInfoTab] = React.useState<"original" | "story" | "info">("original")
  const transcript = useResolvedTranscriptItem({
    provider,
    libraryId: activeLibraryId,
    sourceFile: fileType === "audio" || fileType === "pdf" ? item : null,
    targetLanguage: "de",
  })

  const [activeTab, setActiveTab] = React.useState<string>("preview");
  // Statusabfrage-States (derzeit nicht genutzt – bei Bedarf aktivieren)
  // const [ragLoading, setRagLoading] = React.useState(false);
  // const [ragError, setRagError] = React.useState<string | null>(null);
  // const [ragStatus, setRagStatus] = React.useState<{
  //   status: 'ok' | 'stale' | 'not_indexed';
  //   fileName?: string;
  //   chunkCount?: number;
  //   upsertedAt?: string;
  //   docModifiedAt?: string;
  //   docMeta?: Record<string, unknown>;
  //   toc?: Array<Record<string, unknown>>;
  //   totals?: { docs: number; chunks: number };
  //   analyze?: { chapters?: Array<Record<string, unknown>>; toc?: Array<Record<string, unknown>> };
  // } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  const router = useRouter();
  
  // Hole Shadow-Twin-State für die aktuelle Datei
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom);
  const shadowTwinState = shadowTwinStates.get(item.id);
  
  // Hole Libraries-Atom für Markdown-Preview (muss vor allen frühen Returns sein)
  const libraries = useAtomValue(librariesAtom);
  
  // Bestimme das Verzeichnis für Bild-Auflösung im Markdown-Viewer:
  // 
  // Strategie:
  // 1. Wenn shadowTwinFolderId aus dem Shadow-Twin-State verfügbar ist, verwende es
  //    (für PDF-Dateien, deren Markdown im JobReportTab angezeigt wird)
  // 2. Wenn die Datei selbst eine Markdown-Datei im Shadow-Twin-Verzeichnis ist,
  //    dann ist item.parentId bereits das Shadow-Twin-Verzeichnis - verwende es
  // 3. Sonst verwende item.parentId (normale Dateien)
  //
  // WICHTIG: Für Markdown-Dateien, die im Shadow-Twin-Verzeichnis liegen, ist item.parentId
  // bereits das Shadow-Twin-Verzeichnis. Dies ist die korrekte Basis für Bild-Referenzen.
  // Der Shadow-Twin-State wird für die PDF-Datei gespeichert, nicht für die Markdown-Datei,
  // daher müssen wir item.parentId verwenden, wenn die Markdown-Datei direkt geöffnet wird.
  const currentFolderId = shadowTwinState?.shadowTwinFolderId || item.parentId;
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId,
      currentFolderId,
      shadowTwinFolderId: shadowTwinState?.shadowTwinFolderId,
      parentId: item.parentId,
      hasShadowTwinState: !!shadowTwinState,
      shadowTwinStateKeys: shadowTwinState ? Object.keys(shadowTwinState) : []
    });
  }, [item.id, item.metadata.name, fileType, content.length, error, provider, activeLibraryId, currentFolderId, shadowTwinState?.shadowTwinFolderId, item.parentId, shadowTwinState]);
  
  React.useEffect(() => {
    setActiveTab("preview");
    setInfoTab("original");
  }, [item.id]);

  // async function loadRagStatus() {
  //   try {
  //     setRagLoading(true);
  //     setRagError(null);
  //     const docMod = (() => {
  //       const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
  //       const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
  //       return dt ? dt.toISOString() : undefined;
  //     })();
  //     const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
  //     // Library-Stats parallel
  //     const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
  //     const stats = await statsRes.json().catch(() => ({}));
  //     setRagStatus({ ...data, totals: stats?.totals });
  //   } catch (e) {
  //     setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
  //   } finally {
  //     setRagLoading(false);
  //   }
  // }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  switch (fileType) {
    case 'audio': {
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v === "original" ? "original" : v === "story" ? "story" : "info")} className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="story">Story View</TabsTrigger>
              <TabsTrigger value="info">Story Info</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="audio"
                />
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <StoryView libraryId={activeLibraryId} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="info" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "info" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </IngestionDataProvider>
      )
    }
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
          showTransformControls={false}
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} showTransformControls={false} />;
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      
      // Prüfe, ob es eine Creation-Datei ist (mit Frontmatter-Metadaten)
      const parsed = parseFrontmatter(content);
      const meta = parsed.meta || {};
      const body = parsed.body || '';
      const creationTypeId = typeof meta.creationTypeId === 'string' ? meta.creationTypeId.trim() : undefined;
      
      // Bestimme detailViewType aus Frontmatter mit Fallback auf Library-Config
      const activeLibrary = activeLibraryId ? libraries.find(lib => lib.id === activeLibraryId) : undefined;
      const libraryConfig = activeLibrary?.config?.chat;
      const detailViewType = getDetailViewType(meta, libraryConfig);
      
      // Filtere System-Keys aus Metadaten (nur Template-Metadaten für DetailView)
      const templateMetadata: Record<string, unknown> = {};
      const systemKeys = new Set(['creationTypeId', 'creationTemplateId', 'creationDetailViewType', 'detailViewType', 'textSources', 'templateName']);
      for (const [key, value] of Object.entries(meta)) {
        if (!systemKeys.has(key)) {
          templateMetadata[key] = value;
        }
      }
      
      // Creation-Datei: wenn creationTypeId vorhanden ist (auch wenn detailViewType aus Fallback kommt)
      const isCreationFile = !!creationTypeId;
      
      // Prüfe, ob es ein Dialograum ist (für Button "Dialograum Ergebnis erstellen")
      const dialograumId = typeof meta.dialograum_id === 'string' ? meta.dialograum_id.trim() : undefined;
      const isDialograum = dialograumId && (
        creationTypeId === 'dialograum-creation-de' || 
        (typeof meta.creationTemplateId === 'string' && meta.creationTemplateId.includes('dialograum-creation'))
      );
      
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="metadata">Metadaten</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="report">Report</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                {isCreationFile ? (
                  <div className="h-full overflow-auto">
                    <DetailViewRenderer
                      detailViewType={detailViewType}
                      metadata={templateMetadata}
                      markdown={body}
                      libraryId={activeLibraryId}
                      showBackLink={false}
                    />
                  </div>
                ) : (
                  <MarkdownPreview 
                    content={content}
                    currentFolderId={currentFolderId}
                    provider={provider}
                    className="h-full"
                    compact
                    onTransform={() => setActiveTab("edit")}
                    onRefreshFolder={onRefreshFolder}
                  />
                )}
              </TabsContent>
              <TabsContent value="metadata" className="h-full mt-0">
                <div className="h-full overflow-auto px-4 py-2">
                  <MarkdownMetadata content={content} libraryId={activeLibraryId} />
                </div>
              </TabsContent>
              <TabsContent value="report" className="h-full mt-0">
                <JobReportTabWithShadowTwin 
                  libraryId={activeLibraryId} 
                  fileId={item.id} 
                  fileName={item.metadata.name}
                  parentId={item.parentId}
                  provider={provider}
                />
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0 flex flex-col">
                {/* Button zum Öffnen im Creation-Flow (nur wenn creationTypeId vorhanden) */}
                {isCreationFile && creationTypeId && (
                  <div className="px-4 py-2 border-b space-y-2">
                    <Button
                      onClick={() => {
                        if (!creationTypeId) return;
                        
                        const creationTemplateId = typeof meta.creationTemplateId === 'string' 
                          ? meta.creationTemplateId.trim()
                          : undefined;
                        const params = new URLSearchParams();
                        params.set('resumeFileId', item.id);
                        if (creationTemplateId) {
                          params.set('templateIdOverride', creationTemplateId);
                        }
                        // Trimme creationTypeId und encode für URL
                        const trimmedTypeId = creationTypeId.trim();
                        router.push(`/library/create/${encodeURIComponent(trimmedTypeId)}?${params.toString()}`);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Im Creation-Flow öffnen
                    </Button>
                    
                    {/* Button für Dialograum Ergebnis (nur wenn Dialograum erkannt) */}
                    {isDialograum && dialograumId && (
                      <Button
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set('seedFileId', item.id);
                          // Type-ID für Dialograum-Ergebnis (wird aus Template-Namen abgeleitet)
                          const ergebnisTypeId = 'dialograum-ergebnis-de';
                          router.push(`/library/create/${encodeURIComponent(ergebnisTypeId)}?${params.toString()}`);
                        }}
                        variant="default"
                        className="w-full"
                      >
                        Dialograum Ergebnis erstellen
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <TextEditor 
                    content={content}
                    provider={provider}
                    onSaveAction={async (newContent: string) => {
                FileLogger.info('FilePreview', 'onSaveAction gestartet', {
                  itemId: item.id,
                  itemName: item.metadata.name,
                  contentLength: newContent.length,
                  hasProvider: !!provider,
                  hasOnRefreshFolder: !!onRefreshFolder
                });
                
                if (provider && onRefreshFolder) {
                  try {
                    // Aktualisiere den lokalen State sofort
                    FileLogger.debug('FilePreview', 'Aktualisiere lokalen Content-State', {
                      oldContentLength: content.length,
                      newContentLength: newContent.length
                    });
                    onContentUpdated(newContent);
                    
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Lösche die alte Datei
                    FileLogger.info('FilePreview', 'Lösche alte Datei', {
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    await provider.deleteItem(item.id);
                    
                    // Lade die neue Datei hoch
                    FileLogger.info('FilePreview', 'Lade neue Datei hoch', {
                      fileName: file.name,
                      fileSize: file.size,
                      parentId: item.parentId
                    });
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    FileLogger.info('FilePreview', 'Upload abgeschlossen', {
                      success: !!updatedItem,
                      newItemId: updatedItem?.id,
                      newItemName: updatedItem?.metadata.name
                    });
                    
                    // Aktualisiere den Cache mit dem neuen Inhalt und der neuen ID
                    if (updatedItem) {
                      // Lösche den alten Cache-Eintrag
                      FileLogger.debug('FilePreview', 'Cache-Update: Lösche alten Eintrag', {
                        oldItemId: item.id,
                        cacheSize: contentCache.current.size
                      });
                      contentCache.current.delete(item.id);
                      
                      // Füge den neuen Inhalt zum Cache hinzu
                      const hasMetadata = !!extractFrontmatter(newContent);
                      FileLogger.debug('FilePreview', 'Cache-Update: Füge neuen Eintrag hinzu', {
                        newItemId: updatedItem.id,
                        hasMetadata,
                        contentLength: newContent.length
                      });
                      contentCache.current.set(updatedItem.id, { 
                        content: newContent, 
                        hasMetadata 
                      });
                      
                      // Aktualisiere das selectedFileAtom mit der neuen Datei
                      FileLogger.info('FilePreview', 'Aktualisiere selectedFileAtom', {
                        oldId: item.id,
                        newId: updatedItem.id
                      });
                      setSelectedFile(updatedItem);
                    }
                    
                    // Hole die aktualisierten Items
                    FileLogger.debug('FilePreview', 'Hole aktualisierte Dateiliste', {
                      parentId: item.parentId
                    });
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    FileLogger.info('FilePreview', 'Dateiliste aktualisiert', {
                      itemCount: updatedItems.length
                    });
                    
                    // Wechsle zur Vorschau
                    FileLogger.debug('FilePreview', 'Wechsle zu Vorschau-Tab');
                    setActiveTab("preview");
                    
                    // Informiere die übergeordnete Komponente
                    FileLogger.info('FilePreview', 'Rufe onRefreshFolder auf', {
                      parentId: item.parentId,
                      updatedItemsCount: updatedItems.length,
                      updatedItemId: updatedItem?.id
                    });
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    FileLogger.error('FilePreview', 'Fehler beim Aktualisieren der Datei', {
                      error,
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    throw error; // Werfe den Fehler weiter, damit TextEditor ihn anzeigen kann
                  }
                } else {
                  FileLogger.warn('FilePreview', 'Speichern nicht möglich', {
                    hasProvider: !!provider,
                    hasOnRefreshFolder: !!onRefreshFolder
                  });
                  // Werfe einen Fehler, damit TextEditor ihn anzeigen kann
                  throw new Error('Speichern nicht möglich: onRefreshFolder Callback fehlt');
                }
              }}
                    />
                  </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf': {
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v === "original" ? "original" : v === "story" ? "story" : "info")} className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="story">Story View</TabsTrigger>
              <TabsTrigger value="info">Story Info</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="pdf"
                />
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <StoryView libraryId={activeLibraryId} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="info" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "info" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </IngestionDataProvider>
      )
    }
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website':
      const urlContent = content.match(/URL=(.*)/)?.[1];
      return urlContent ? (
        <iframe 
          src={urlContent}
          title={item.metadata.name}
          className="w-full h-screen"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          Keine gültige URL gefunden.
        </div>
      );
    default:
      return (
        <div className="text-center text-muted-foreground">
          Keine Vorschau verfügbar für diesen Dateityp.
        </div>
      );
  }
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder
}: FilePreviewProps) {
  const router = useRouter()
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom)
  const [, setShadowTwinAnalysisTrigger] = useAtom(shadowTwinAnalysisTriggerAtom)
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  const shadowTwinState = displayFile ? shadowTwinStates.get(displayFile.id) : undefined
  const storyStatus = useStoryStatus({
    libraryId: activeLibraryId,
    file: displayFile,
    shadowTwinState,
  })
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });
  // Erklärung: separater State, damit der Split-Button sauber deaktiviert werden kann.
  const [isSplittingPages, setIsSplittingPages] = React.useState(false)

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  // Entfernt: isAudioFile und isVideoFile, da sie nicht verwendet werden

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id, displayFile?.metadata.name]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">Vorschau</div>
          <div className="truncate text-sm font-medium">{displayFile.metadata.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <StoryStatusIcons steps={storyStatus.steps} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShadowTwinAnalysisTrigger((v) => v + 1)}
                  aria-label="Shadow-Twin Status aktualisieren"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Status aktualisieren</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const url = `/library/story-creator?libraryId=${encodeURIComponent(activeLibraryId)}&fileId=${encodeURIComponent(displayFile.id)}&parentId=${encodeURIComponent(displayFile.parentId)}&left=off`
              router.push(url)
            }}
          >
            Story Creator
          </Button>
          {(fileType === 'pdf' || fileType === 'markdown') ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isSplittingPages}
              onClick={async () => {
                if (!activeLibraryId || !displayFile.id) return
                // Erklärung: Split läuft serverseitig, weil große PDFs im Browser zu schwer sind.
                setIsSplittingPages(true)
                try {
                  const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sourceFileId: displayFile.id,
                      targetLanguage: 'de',
                    }),
                  })
                  const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderName?: string; created?: number }
                  if (!res.ok) {
                    const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
                    throw new Error(msg)
                  }
                  toast.success("Seiten gesplittet", {
                    description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`
                  })
                  // UI-Liste aktualisieren, damit der neue Ordner sichtbar wird.
                  if (onRefreshFolder && displayFile.parentId) {
                    const refreshed = await provider?.listItemsById(displayFile.parentId)
                    if (refreshed) onRefreshFolder(displayFile.parentId, refreshed)
                  }
                } catch (error) {
                  toast.error("Split fehlgeschlagen", {
                    description: error instanceof Error ? error.message : "Unbekannter Fehler"
                  })
                } finally {
                  setIsSplittingPages(false)
                }
              }}
            >
              Seiten splitten
            </Button>
          ) : null}
          {provider ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const url = await provider.getStreamingUrl(displayFile.id)
                  window.open(url, "_blank", "noopener,noreferrer")
                } catch {}
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Quelle
            </Button>
          ) : null}
        </div>
      </div>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
        />
      </div>
    </div>
  );
}
```

```typescriptreact
'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { MarkdownMetadata } from './markdown-metadata';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, librariesAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"
import { JobReportTab } from './job-report-tab';
// PdfPhasesView ist bewusst NICHT mehr Teil der File-Preview (zu heavy). Flow-View ist der Expertenmodus.
import { shadowTwinStateAtom } from '@/atoms/shadow-twin-atom';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';
import { DetailViewRenderer } from './detail-view-renderer';
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner'
import { resolveArtifactClient } from '@/lib/shadow-twin/artifact-client';
import { ExternalLink, RefreshCw } from "lucide-react";
import { SourceAndTranscriptPane } from "@/components/library/shared/source-and-transcript-pane"
import { useResolvedTranscriptItem } from "@/components/library/shared/use-resolved-transcript-item"
import { ArtifactInfoPanel } from "@/components/library/shared/artifact-info-panel"
import { useStoryStatus } from "@/components/library/shared/use-story-status"
import { StoryStatusIcons } from "@/components/library/shared/story-status-icons"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { StoryView } from "@/components/library/shared/story-view"
import { IngestionDataProvider } from "@/components/library/shared/ingestion-data-context"

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

// Komponente, die JobReportTab mit Shadow-Twin-Unterstützung umschließt
// Verwendet jetzt den zentralen resolveArtifactClient statt lokaler Heuristik
function JobReportTabWithShadowTwin({
  libraryId,
  fileId,
  fileName,
  parentId,
  provider
}: {
  libraryId: string;
  fileId: string;
  fileName: string;
  parentId: string;
  provider: StorageProvider | null;
}) {
  const [mdFileId, setMdFileId] = React.useState<string | null>(null);
  const [baseFileId, setBaseFileId] = React.useState<string>(fileId);
  const [isLoading, setIsLoading] = React.useState(true);

  // Variante C: Vollständig über API - kein lokales Parsing mehr
  React.useEffect(() => {
    async function resolveArtifact() {
      setIsLoading(true);

      // Rufe zentrale Resolver-API auf
      // Priorität 1: Transformation (hat Frontmatter)
      let resolved = await resolveArtifactClient({
        libraryId,
        sourceId: fileId,
        sourceName: fileName,
        parentId,
        targetLanguage: 'de', // Standard-Sprache
        preferredKind: 'transformation',
      });

      // Priorität 2: Fallback zu Transcript wenn keine Transformation gefunden
      if (!resolved) {
        resolved = await resolveArtifactClient({
          libraryId,
          sourceId: fileId,
          sourceName: fileName,
          parentId,
          targetLanguage: 'de', // Standard-Sprache
          preferredKind: 'transcript',
        });
      }

      if (resolved) {
        setMdFileId(resolved.fileId);
        setBaseFileId(fileId); // Basis-Datei bleibt fileId
        FileLogger.debug('JobReportTabWithShadowTwin', 'Artefakt über Resolver gefunden', {
          originalFileId: fileId,
          resolvedFileId: resolved.fileId,
          resolvedFileName: resolved.fileName,
          kind: resolved.kind,
          location: resolved.location,
        });
      } else {
        // Kein Artefakt gefunden - verwende Basis-Datei direkt
        setMdFileId(null);
        setBaseFileId(fileId);
        FileLogger.debug('JobReportTabWithShadowTwin', 'Kein Shadow-Twin-Artefakt gefunden, verwende Basis-Datei', {
          fileId,
          fileName,
          parentId,
        });
      }

      setIsLoading(false);
    }

    if (libraryId && fileId && parentId) {
      resolveArtifact().catch((error) => {
        FileLogger.error('JobReportTabWithShadowTwin', 'Fehler bei Artefakt-Auflösung', {
          fileId,
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
        setIsLoading(false);
        setMdFileId(null);
        setBaseFileId(fileId);
      });
    } else {
      setIsLoading(false);
    }
  }, [libraryId, fileId, fileName, parentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Lade Metadaten...</p>
      </div>
    );
  }

  return (
    <JobReportTab 
      libraryId={libraryId} 
      fileId={baseFileId} 
      fileName={fileName} 
      provider={provider}
      mdFileId={mdFileId}
      sourceMode="frontmatter"
      viewMode="metaOnly"
    />
  );
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    // Prüfe, ob es sich um einen Ordner handelt (root ist ein Ordner)
    if (item.type === 'folder' || item.id === 'root') {
      FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Ordner', {
        itemId: item.id,
        itemName: item.metadata.name,
        itemType: item.type
      });
      contentCache.current.set(item.id, { content: '', hasMetadata: false });
      onContentLoaded('', false);
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.type, item?.metadata?.name, provider, fileType, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}) {
  const [infoTab, setInfoTab] = React.useState<"original" | "story" | "info">("original")
  const transcript = useResolvedTranscriptItem({
    provider,
    libraryId: activeLibraryId,
    sourceFile: fileType === "audio" || fileType === "pdf" ? item : null,
    targetLanguage: "de",
  })

  const [activeTab, setActiveTab] = React.useState<string>("preview");
  // Statusabfrage-States (derzeit nicht genutzt – bei Bedarf aktivieren)
  // const [ragLoading, setRagLoading] = React.useState(false);
  // const [ragError, setRagError] = React.useState<string | null>(null);
  // const [ragStatus, setRagStatus] = React.useState<{
  //   status: 'ok' | 'stale' | 'not_indexed';
  //   fileName?: string;
  //   chunkCount?: number;
  //   upsertedAt?: string;
  //   docModifiedAt?: string;
  //   docMeta?: Record<string, unknown>;
  //   toc?: Array<Record<string, unknown>>;
  //   totals?: { docs: number; chunks: number };
  //   analyze?: { chapters?: Array<Record<string, unknown>>; toc?: Array<Record<string, unknown>> };
  // } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  const router = useRouter();
  
  // Hole Shadow-Twin-State für die aktuelle Datei
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom);
  const shadowTwinState = shadowTwinStates.get(item.id);
  
  // Hole Libraries-Atom für Markdown-Preview (muss vor allen frühen Returns sein)
  const libraries = useAtomValue(librariesAtom);
  
  // Bestimme das Verzeichnis für Bild-Auflösung im Markdown-Viewer:
  // 
  // Strategie:
  // 1. Wenn shadowTwinFolderId aus dem Shadow-Twin-State verfügbar ist, verwende es
  //    (für PDF-Dateien, deren Markdown im JobReportTab angezeigt wird)
  // 2. Wenn die Datei selbst eine Markdown-Datei im Shadow-Twin-Verzeichnis ist,
  //    dann ist item.parentId bereits das Shadow-Twin-Verzeichnis - verwende es
  // 3. Sonst verwende item.parentId (normale Dateien)
  //
  // WICHTIG: Für Markdown-Dateien, die im Shadow-Twin-Verzeichnis liegen, ist item.parentId
  // bereits das Shadow-Twin-Verzeichnis. Dies ist die korrekte Basis für Bild-Referenzen.
  // Der Shadow-Twin-State wird für die PDF-Datei gespeichert, nicht für die Markdown-Datei,
  // daher müssen wir item.parentId verwenden, wenn die Markdown-Datei direkt geöffnet wird.
  const currentFolderId = shadowTwinState?.shadowTwinFolderId || item.parentId;
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId,
      currentFolderId,
      shadowTwinFolderId: shadowTwinState?.shadowTwinFolderId,
      parentId: item.parentId,
      hasShadowTwinState: !!shadowTwinState,
      shadowTwinStateKeys: shadowTwinState ? Object.keys(shadowTwinState) : []
    });
  }, [item.id, item.metadata.name, fileType, content.length, error, provider, activeLibraryId, currentFolderId, shadowTwinState?.shadowTwinFolderId, item.parentId, shadowTwinState]);
  
  React.useEffect(() => {
    setActiveTab("preview");
    setInfoTab("original");
  }, [item.id]);

  // async function loadRagStatus() {
  //   try {
  //     setRagLoading(true);
  //     setRagError(null);
  //     const docMod = (() => {
  //       const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
  //       const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
  //       return dt ? dt.toISOString() : undefined;
  //     })();
  //     const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
  //     // Library-Stats parallel
  //     const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
  //     const stats = await statsRes.json().catch(() => ({}));
  //     setRagStatus({ ...data, totals: stats?.totals });
  //   } catch (e) {
  //     setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
  //   } finally {
  //     setRagLoading(false);
  //   }
  // }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  switch (fileType) {
    case 'audio': {
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v === "original" ? "original" : v === "story" ? "story" : "info")} className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="story">Story View</TabsTrigger>
              <TabsTrigger value="info">Story Info</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="audio"
                />
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <StoryView libraryId={activeLibraryId} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="info" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "info" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </IngestionDataProvider>
      )
    }
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
          showTransformControls={false}
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} showTransformControls={false} />;
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      
      // Prüfe, ob es eine Creation-Datei ist (mit Frontmatter-Metadaten)
      const parsed = parseFrontmatter(content);
      const meta = parsed.meta || {};
      const body = parsed.body || '';
      const creationTypeId = typeof meta.creationTypeId === 'string' ? meta.creationTypeId.trim() : undefined;
      
      // Bestimme detailViewType aus Frontmatter mit Fallback auf Library-Config
      const activeLibrary = activeLibraryId ? libraries.find(lib => lib.id === activeLibraryId) : undefined;
      const libraryConfig = activeLibrary?.config?.chat;
      const detailViewType = getDetailViewType(meta, libraryConfig);
      
      // Filtere System-Keys aus Metadaten (nur Template-Metadaten für DetailView)
      const templateMetadata: Record<string, unknown> = {};
      const systemKeys = new Set(['creationTypeId', 'creationTemplateId', 'creationDetailViewType', 'detailViewType', 'textSources', 'templateName']);
      for (const [key, value] of Object.entries(meta)) {
        if (!systemKeys.has(key)) {
          templateMetadata[key] = value;
        }
      }
      
      // Creation-Datei: wenn creationTypeId vorhanden ist (auch wenn detailViewType aus Fallback kommt)
      const isCreationFile = !!creationTypeId;
      
      // Prüfe, ob es ein Dialograum ist (für Button "Dialograum Ergebnis erstellen")
      const dialograumId = typeof meta.dialograum_id === 'string' ? meta.dialograum_id.trim() : undefined;
      const isDialograum = dialograumId && (
        creationTypeId === 'dialograum-creation-de' || 
        (typeof meta.creationTemplateId === 'string' && meta.creationTemplateId.includes('dialograum-creation'))
      );
      
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="metadata">Metadaten</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="report">Report</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                {isCreationFile ? (
                  <div className="h-full overflow-auto">
                    <DetailViewRenderer
                      detailViewType={detailViewType}
                      metadata={templateMetadata}
                      markdown={body}
                      libraryId={activeLibraryId}
                      showBackLink={false}
                    />
                  </div>
                ) : (
                  <MarkdownPreview 
                    content={content}
                    currentFolderId={currentFolderId}
                    provider={provider}
                    className="h-full"
                    compact
                    onTransform={() => setActiveTab("edit")}
                    onRefreshFolder={onRefreshFolder}
                  />
                )}
              </TabsContent>
              <TabsContent value="metadata" className="h-full mt-0">
                <div className="h-full overflow-auto px-4 py-2">
                  <MarkdownMetadata content={content} libraryId={activeLibraryId} />
                </div>
              </TabsContent>
              <TabsContent value="report" className="h-full mt-0">
                <JobReportTabWithShadowTwin 
                  libraryId={activeLibraryId} 
                  fileId={item.id} 
                  fileName={item.metadata.name}
                  parentId={item.parentId}
                  provider={provider}
                />
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0 flex flex-col">
                {/* Button zum Öffnen im Creation-Flow (nur wenn creationTypeId vorhanden) */}
                {isCreationFile && creationTypeId && (
                  <div className="px-4 py-2 border-b space-y-2">
                    <Button
                      onClick={() => {
                        if (!creationTypeId) return;
                        
                        const creationTemplateId = typeof meta.creationTemplateId === 'string' 
                          ? meta.creationTemplateId.trim()
                          : undefined;
                        const params = new URLSearchParams();
                        params.set('resumeFileId', item.id);
                        if (creationTemplateId) {
                          params.set('templateIdOverride', creationTemplateId);
                        }
                        // Trimme creationTypeId und encode für URL
                        const trimmedTypeId = creationTypeId.trim();
                        router.push(`/library/create/${encodeURIComponent(trimmedTypeId)}?${params.toString()}`);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Im Creation-Flow öffnen
                    </Button>
                    
                    {/* Button für Dialograum Ergebnis (nur wenn Dialograum erkannt) */}
                    {isDialograum && dialograumId && (
                      <Button
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set('seedFileId', item.id);
                          // Type-ID für Dialograum-Ergebnis (wird aus Template-Namen abgeleitet)
                          const ergebnisTypeId = 'dialograum-ergebnis-de';
                          router.push(`/library/create/${encodeURIComponent(ergebnisTypeId)}?${params.toString()}`);
                        }}
                        variant="default"
                        className="w-full"
                      >
                        Dialograum Ergebnis erstellen
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <TextEditor 
                    content={content}
                    provider={provider}
                    onSaveAction={async (newContent: string) => {
                FileLogger.info('FilePreview', 'onSaveAction gestartet', {
                  itemId: item.id,
                  itemName: item.metadata.name,
                  contentLength: newContent.length,
                  hasProvider: !!provider,
                  hasOnRefreshFolder: !!onRefreshFolder
                });
                
                if (provider && onRefreshFolder) {
                  try {
                    // Aktualisiere den lokalen State sofort
                    FileLogger.debug('FilePreview', 'Aktualisiere lokalen Content-State', {
                      oldContentLength: content.length,
                      newContentLength: newContent.length
                    });
                    onContentUpdated(newContent);
                    
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Lösche die alte Datei
                    FileLogger.info('FilePreview', 'Lösche alte Datei', {
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    await provider.deleteItem(item.id);
                    
                    // Lade die neue Datei hoch
                    FileLogger.info('FilePreview', 'Lade neue Datei hoch', {
                      fileName: file.name,
                      fileSize: file.size,
                      parentId: item.parentId
                    });
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    FileLogger.info('FilePreview', 'Upload abgeschlossen', {
                      success: !!updatedItem,
                      newItemId: updatedItem?.id,
                      newItemName: updatedItem?.metadata.name
                    });
                    
                    // Aktualisiere den Cache mit dem neuen Inhalt und der neuen ID
                    if (updatedItem) {
                      // Lösche den alten Cache-Eintrag
                      FileLogger.debug('FilePreview', 'Cache-Update: Lösche alten Eintrag', {
                        oldItemId: item.id,
                        cacheSize: contentCache.current.size
                      });
                      contentCache.current.delete(item.id);
                      
                      // Füge den neuen Inhalt zum Cache hinzu
                      const hasMetadata = !!extractFrontmatter(newContent);
                      FileLogger.debug('FilePreview', 'Cache-Update: Füge neuen Eintrag hinzu', {
                        newItemId: updatedItem.id,
                        hasMetadata,
                        contentLength: newContent.length
                      });
                      contentCache.current.set(updatedItem.id, { 
                        content: newContent, 
                        hasMetadata 
                      });
                      
                      // Aktualisiere das selectedFileAtom mit der neuen Datei
                      FileLogger.info('FilePreview', 'Aktualisiere selectedFileAtom', {
                        oldId: item.id,
                        newId: updatedItem.id
                      });
                      setSelectedFile(updatedItem);
                    }
                    
                    // Hole die aktualisierten Items
                    FileLogger.debug('FilePreview', 'Hole aktualisierte Dateiliste', {
                      parentId: item.parentId
                    });
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    FileLogger.info('FilePreview', 'Dateiliste aktualisiert', {
                      itemCount: updatedItems.length
                    });
                    
                    // Wechsle zur Vorschau
                    FileLogger.debug('FilePreview', 'Wechsle zu Vorschau-Tab');
                    setActiveTab("preview");
                    
                    // Informiere die übergeordnete Komponente
                    FileLogger.info('FilePreview', 'Rufe onRefreshFolder auf', {
                      parentId: item.parentId,
                      updatedItemsCount: updatedItems.length,
                      updatedItemId: updatedItem?.id
                    });
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    FileLogger.error('FilePreview', 'Fehler beim Aktualisieren der Datei', {
                      error,
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    throw error; // Werfe den Fehler weiter, damit TextEditor ihn anzeigen kann
                  }
                } else {
                  FileLogger.warn('FilePreview', 'Speichern nicht möglich', {
                    hasProvider: !!provider,
                    hasOnRefreshFolder: !!onRefreshFolder
                  });
                  // Werfe einen Fehler, damit TextEditor ihn anzeigen kann
                  throw new Error('Speichern nicht möglich: onRefreshFolder Callback fehlt');
                }
              }}
                    />
                  </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf': {
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v === "original" ? "original" : v === "story" ? "story" : "info")} className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="story">Story View</TabsTrigger>
              <TabsTrigger value="info">Story Info</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="pdf"
                />
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <StoryView libraryId={activeLibraryId} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="info" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "info" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </IngestionDataProvider>
      )
    }
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website':
      const urlContent = content.match(/URL=(.*)/)?.[1];
      return urlContent ? (
        <iframe 
          src={urlContent}
          title={item.metadata.name}
          className="w-full h-screen"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          Keine gültige URL gefunden.
        </div>
      );
    default:
      return (
        <div className="text-center text-muted-foreground">
          Keine Vorschau verfügbar für diesen Dateityp.
        </div>
      );
  }
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder
}: FilePreviewProps) {
  const router = useRouter()
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom)
  const [, setShadowTwinAnalysisTrigger] = useAtom(shadowTwinAnalysisTriggerAtom)
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  const shadowTwinState = displayFile ? shadowTwinStates.get(displayFile.id) : undefined
  const storyStatus = useStoryStatus({
    libraryId: activeLibraryId,
    file: displayFile,
    shadowTwinState,
  })
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });
  // Erklärung: separater State, damit der Split-Button sauber deaktiviert werden kann.
  const [isSplittingPages, setIsSplittingPages] = React.useState(false)

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  // Entfernt: isAudioFile und isVideoFile, da sie nicht verwendet werden

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id, displayFile?.metadata.name]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">Vorschau</div>
          <div className="truncate text-sm font-medium">{displayFile.metadata.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <StoryStatusIcons steps={storyStatus.steps} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShadowTwinAnalysisTrigger((v) => v + 1)}
                  aria-label="Shadow-Twin Status aktualisieren"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Status aktualisieren</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const url = `/library/story-creator?libraryId=${encodeURIComponent(activeLibraryId)}&fileId=${encodeURIComponent(displayFile.id)}&parentId=${encodeURIComponent(displayFile.parentId)}&left=off`
              router.push(url)
            }}
          >
            Story Creator
          </Button>
          {(fileType === 'pdf' || fileType === 'markdown') ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isSplittingPages}
              onClick={async () => {
                if (!activeLibraryId || !displayFile.id) return
                // Erklärung: Split läuft serverseitig, weil große PDFs im Browser zu schwer sind.
                setIsSplittingPages(true)
                try {
                  const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sourceFileId: displayFile.id,
                      targetLanguage: 'de',
                    }),
                  })
                  const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderName?: string; created?: number }
                  if (!res.ok) {
                    const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
                    throw new Error(msg)
                  }
                  toast.success("Seiten gesplittet", {
                    description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`
                  })
                  // UI-Liste aktualisieren, damit der neue Ordner sichtbar wird.
                  if (onRefreshFolder && displayFile.parentId) {
                    const refreshed = await provider?.listItemsById(displayFile.parentId)
                    if (refreshed) onRefreshFolder(displayFile.parentId, refreshed)
                  }
                } catch (error) {
                  toast.error("Split fehlgeschlagen", {
                    description: error instanceof Error ? error.message : "Unbekannter Fehler"
                  })
                } finally {
                  setIsSplittingPages(false)
                }
              }}
            >
              Seiten splitten
            </Button>
          ) : null}
          {provider ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const url = await provider.getStreamingUrl(displayFile.id)
                  window.open(url, "_blank", "noopener,noreferrer")
                } catch {}
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Quelle
            </Button>
          ) : null}
        </div>
      </div>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
        />
      </div>
    </div>
  );
}
```

```typescript
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { TransformService } from './transform-service';
import { 
  BaseTransformOptions, 
  BatchTranscriptionItem,
  BatchTransformationItem,
  AudioTransformSettings,
  VideoTransformSettings
} from '@/atoms/transcription-options';
import { transformText, transformTextWithTemplate } from '@/lib/secretary/client';
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming';
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types';

// Default-Einstellungen
const DEFAULT_AUDIO_SETTINGS: AudioTransformSettings = {
  sourceLanguage: 'auto',
  template: 'Besprechung'
};

const DEFAULT_VIDEO_SETTINGS: VideoTransformSettings = {
  ...DEFAULT_AUDIO_SETTINGS,
  extractAudio: true,
  extractFrames: false,
  frameInterval: 1
};

export interface BatchTransformProgress {
  currentItem: number;
  totalItems: number;
  currentFileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export interface BatchTransformResult {
  success: boolean;
  results: Array<{
    item: StorageItem;
    success: boolean;
    error?: string;
    savedItem?: StorageItem;
    updatedItems?: StorageItem[];
  }>;
}

/**
 * Ermittelt Template-Inhalt für benutzerdefinierte Templates einmalig,
 * damit wir pro Seite nicht mehrfach aus Mongo laden müssen.
 */
async function resolveTemplateContent(args: {
  template: string
  libraryId: string
}): Promise<{ templateName: string; templateContent?: string; isStandard: boolean }> {
  const standardTemplates = ['Besprechung', 'Gedanken', 'Interview', 'Zusammenfassung']
  const isStandard = standardTemplates.includes(args.template)
  if (isStandard) {
    return { templateName: args.template, isStandard: true }
  }

  try {
    const { loadTemplate } = await import('@/lib/templates/template-service-client')
    const templateResult = await loadTemplate({
      libraryId: args.libraryId,
      preferredTemplateName: args.template,
    })
    return { templateName: args.template, templateContent: templateResult.templateContent, isStandard: false }
  } catch (error) {
    // Erklärung: Fallback auf Standard-Template, falls Custom-Template nicht geladen werden kann.
    console.error('[BatchTransformService] Template-Load fehlgeschlagen, Fallback auf Standard-Template', error)
    return { templateName: 'Besprechung', isStandard: true }
  }
}

export class BatchTransformService {
  /**
   * Transformiert eine Batch von Audio/Video-Dateien (jede einzeln)
   */
  static async transformBatch(
    items: BatchTranscriptionItem[],
    baseOptions: BaseTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    onProgress?: (progress: BatchTransformProgress) => void
  ): Promise<BatchTransformResult> {
    const results: BatchTransformResult['results'] = [];
    let hasError = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Progress-Update
      onProgress?.({
        currentItem: i + 1,
        totalItems: items.length,
        currentFileName: item.item.metadata.name,
        status: 'processing'
      });

      try {
        let result;
        
        // Hole die Datei als Blob
        const { blob } = await provider.getBinary(item.item.id);
        if (!blob) {
          throw new Error("Datei konnte nicht geladen werden");
        }

        // Konvertiere Blob zu File für die Verarbeitung
        const file = new File([blob], item.item.metadata.name, { type: item.item.metadata.mimeType });
        
        // Generiere den Shadow-Twin-Namen mit zentraler Logik
        const artifactKey: ArtifactKey = {
          sourceId: item.item.id,
          kind: 'transcript',
          targetLanguage: baseOptions.targetLanguage,
        };
        const shadowTwinName = buildArtifactName(artifactKey, item.item.metadata.name).replace(/\.md$/, '');
        
        switch (item.type) {
          case 'audio':
            result = await TransformService.transformAudio(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
              },
              provider,
              refreshItems,
              libraryId
            );
            break;
            
          case 'video':
            result = await TransformService.transformVideo(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
                ...DEFAULT_VIDEO_SETTINGS
              },
              provider,
              refreshItems,
              libraryId
            );
            break;
            
          case 'document':
            result = await TransformService.transformPdf(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
                extractionMethod: "mistral_ocr" // Globaler Default: mistral_ocr
              },
              provider,
              refreshItems,
              libraryId
            );
            break;
            
          default:
            throw new Error(`Unsupported media type: ${item.type}`);
        }

        results.push({
          item: item.item,
          success: true,
          savedItem: result.savedItem,
          updatedItems: result.updatedItems
        });

        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: item.item.metadata.name,
          status: 'success'
        });

      } catch (error) {
        hasError = true;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          item: item.item,
          success: false,
          error: errorMessage
        });

        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: item.item.metadata.name,
          status: 'error',
          error: errorMessage
        });
      }
    }

    return {
      success: !hasError,
      results
    };
  }

  /**
   * Transformiert eine Batch von Text-Dateien (alle zusammen als ein Dokument)
   */
  static async transformTextBatch(
    items: BatchTransformationItem[],
    baseOptions: BaseTransformOptions,
    template: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    onProgress?: (progress: BatchTransformProgress) => void
  ): Promise<BatchTransformResult> {
    const results: BatchTransformResult['results'] = [];
    let hasError = false;

    try {
      // Progress: Lade alle Texte
      onProgress?.({
        currentItem: 0,
        totalItems: items.length,
        currentFileName: 'Lade alle Texte...',
        status: 'processing'
      });

      // Alle Text-Inhalte laden
      const textContents: Array<{ item: StorageItem; content: string; fileName: string }> = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: `Lade ${item.item.metadata.name}...`,
          status: 'processing'
        });

        try {
          // Text-Inhalt laden
          const { blob } = await provider.getBinary(item.item.id);
          if (!blob) {
            throw new Error(`Datei ${item.item.metadata.name} konnte nicht geladen werden`);
          }

          const content = await blob.text();
          textContents.push({
            item: item.item,
            content: content,
            fileName: item.item.metadata.name
          });

          // Erfolg für diese Datei markieren
          results.push({
            item: item.item,
            success: true
          });

        } catch (error) {
          hasError = true;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          results.push({
            item: item.item,
            success: false,
            error: errorMessage
          });
        }
      }

      // Wenn alle Texte erfolgreich geladen wurden, führe die Transformation durch
      if (textContents.length > 0) {
        onProgress?.({
          currentItem: items.length,
          totalItems: items.length,
          currentFileName: 'Transformiere kombinierten Text...',
          status: 'processing'
        });

        // Alle Texte zusammenführen
        const combinedText = textContents.map(tc => 
          `## ${tc.fileName}\n\n${tc.content}\n\n---\n\n`
        ).join('');

        console.log('[BatchTransformService] Kombinierter Text erstellt:', {
          fileCount: textContents.length,
          combinedLength: combinedText.length,
          template: template
        });

        // Template-Typ bestimmen
        const standardTemplates = ['Besprechung', 'Gedanken', 'Interview', 'Zusammenfassung'];
        const isStandardTemplate = standardTemplates.includes(template);

        let transformedText: string;

        if (isStandardTemplate) {
          // Standard-Template verwenden
          transformedText = await transformText(
            combinedText,
            baseOptions.targetLanguage,
            libraryId,
            template
          );
        } else {
          // Benutzerdefiniertes Template: Lade Template-Inhalt
          try {
            // Verwende zentrale Client-Library für MongoDB-Templates
            const { loadTemplate } = await import('@/lib/templates/template-service-client')
            const templateResult = await loadTemplate({
              libraryId,
              preferredTemplateName: template
            })
            const templateContent = templateResult.templateContent
            
            // Direkter Secretary Service Call mit Template-Content
            transformedText = await transformTextWithTemplate(
              combinedText,
              baseOptions.targetLanguage,
              libraryId,
              templateContent
            );
          } catch (error) {
            console.error('[BatchTransformService] Fehler beim Laden des Template-Inhalts:', error);
            // Fallback auf Standard-Template
            transformedText = await transformText(
              combinedText,
              baseOptions.targetLanguage,
              libraryId,
              "Besprechung"
            );
          }
        }

        // Generiere Dateinamen für das kombinierte Ergebnis
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const combinedFileName = baseOptions.fileName || `Kombinierte_Transformation_${timestamp}`;
        
        // Ergebnis speichern
        if (baseOptions.createShadowTwin) {
          // Explizite Parameter übergeben statt aus Dateinamen zu parsen
          const result = await TransformService.saveTransformedText(
            transformedText,
            items[0].item, // Verwende das erste Item als Referenz
            {
              ...baseOptions,
              fileName: combinedFileName
            },
            provider,
            refreshItems,
            libraryId, // libraryId für Modus-Bestimmung
            'transformation', // artifactKind: Template-Transformation
            template // templateName: Explizit übergeben
          );

          // Aktualisiere das erste Ergebnis mit den Speicher-Informationen
          if (results.length > 0) {
            results[0] = {
              ...results[0],
              savedItem: result.savedItem,
              updatedItems: result.updatedItems
            };
          }
        }

        onProgress?.({
          currentItem: items.length,
          totalItems: items.length,
          currentFileName: 'Transformation abgeschlossen',
          status: 'success'
        });

      }

    } catch (error) {
      hasError = true;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('[BatchTransformService] Fehler bei der Batch-Text-Transformation:', error);
      
      // Markiere alle verbleibenden Items als fehlgeschlagen
      for (let i = results.length; i < items.length; i++) {
        results.push({
          item: items[i].item,
          success: false,
          error: errorMessage
        });
      }
    }

    return {
      success: !hasError,
      results
    };
  }

  /**
   * Transformiert eine Batch von Text-Dateien – jede Datei wird separat transformiert.
   * Diese Variante ist für Seiten-Splitting gedacht (1 Seite -> 1 Output).
   */
  static async transformTextBatchPerFile(
    items: BatchTransformationItem[],
    baseOptions: BaseTransformOptions,
    template: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    onProgress?: (progress: BatchTransformProgress) => void
  ): Promise<BatchTransformResult> {
    const results: BatchTransformResult['results'] = []
    let hasError = false

    // Erklärung: Template-Inhalt nur einmal laden, um wiederholte DB-Calls zu vermeiden.
    const resolvedTemplate = await resolveTemplateContent({ template, libraryId })

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      onProgress?.({
        currentItem: i + 1,
        totalItems: items.length,
        currentFileName: item.item.metadata.name,
        status: 'processing',
      })

      try {
        const { blob } = await provider.getBinary(item.item.id)
        if (!blob) {
          throw new Error(`Datei ${item.item.metadata.name} konnte nicht geladen werden`)
        }

        const content = await blob.text()
        let transformedText: string

        if (resolvedTemplate.isStandard) {
          transformedText = await transformText(
            content,
            baseOptions.targetLanguage,
            libraryId,
            resolvedTemplate.templateName
          )
        } else if (resolvedTemplate.templateContent) {
          transformedText = await transformTextWithTemplate(
            content,
            baseOptions.targetLanguage,
            libraryId,
            resolvedTemplate.templateContent
          )
        } else {
          // Defensive: wenn templateContent fehlt, fallback auf Standard-Template.
          transformedText = await transformText(
            content,
            baseOptions.targetLanguage,
            libraryId,
            'Besprechung'
          )
        }

        // Erklärung: per-file Output wird neben der Seite gespeichert (nicht als Shadow-Twin),
        // damit Explorer die Dokumente direkt sieht.
        const baseName = item.item.metadata.name.replace(/\.mdx?$/i, '')
        const extension = (baseOptions.fileExtension || 'md').replace(/^\./, '')
        const fileName = `${baseName}.${template}.${baseOptions.targetLanguage}.${extension}`
        const file = new File([transformedText], fileName, { type: 'text/markdown' })
        const targetParentId = item.item.parentId || 'root'
        const savedItem = await provider.uploadFile(targetParentId, file)

        results.push({
          item: item.item,
          success: true,
          savedItem,
        })
      } catch (error) {
        hasError = true
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          item: item.item,
          success: false,
          error: errorMessage,
        })
      }
    }

    // UI-Refresh: Wenn möglich, aktualisieren wir den Parent-Ordner einmalig.
    if (items.length > 0) {
      const parentId = items[0].item.parentId
      if (parentId) {
        try {
          await refreshItems(parentId)
        } catch (error) {
          console.error('[BatchTransformService] Refresh fehlgeschlagen', error)
        }
      }
    }

    onProgress?.({
      currentItem: items.length,
      totalItems: items.length,
      currentFileName: 'Transformation abgeschlossen',
      status: 'success',
    })

    return {
      success: !hasError,
      results,
    }
  }
} 
```

```typescriptreact
"use client";

import { useAtom } from 'jotai';
import { useState, useCallback, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, FileText, File, X } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  baseTransformOptionsAtom
} from '@/atoms/transcription-options';
import { BatchTransformService, BatchTransformProgress, BatchTransformResult } from '@/lib/transform/batch-transform-service';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { useRootItems } from '@/hooks/use-root-items';
import { activeLibraryIdAtom } from '@/atoms/library-atom';
import { SUPPORTED_LANGUAGES } from '@/lib/secretary/constants';
import { StorageItem } from '@/lib/storage/types';
import { CombinedChatDialog } from '@/components/library/combined-chat-dialog'
import { templateContextDocsAtom } from '@/atoms/template-context-atom'
import { useSetAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import { batchResolveArtifactsClient } from '@/lib/shadow-twin/artifact-client'

interface ProgressState {
  isProcessing: boolean;
  currentProgress: BatchTransformProgress | null;
  results: BatchTransformResult | null;
}

interface TransformationDialogProps {
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function TransformationDialog({ onRefreshFolder }: TransformationDialogProps) {
  const [isOpen, setIsOpen] = useAtom(transformationDialogOpenAtom);
  // setCombinedOpen ungenutzt entfernt
  const [selectedItems] = useAtom(selectedTransformationItemsAtom);
  const [progressState, setProgressState] = useState<ProgressState>({
    isProcessing: false,
    currentProgress: null,
    results: null
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Besprechung');
  const [customTemplateNames, setCustomTemplateNames] = useState<string[]>([]);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [fileNameError, setFileNameError] = useState<string>('');
  // Erklärung: Modus steuert, ob alle Texte kombiniert werden oder pro Datei ein Output entsteht.
  const [textTransformMode, setTextTransformMode] = useState<'combined' | 'per-file'>('combined');
  
  const { provider, refreshItems } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  // getRootItems wird aktuell nicht verwendet, aber für zukünftige Verwendung bereitgehalten
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused_getRootItems = useRootItems();
  const baseOptions = useAtomValue(baseTransformOptionsAtom);
  const setTemplateContext = useSetAtom(templateContextDocsAtom)
  const router = useRouter()
  
  // Initialisiere selectedLanguage mit dem Standard-Wert
  const [selectedLanguage, setSelectedLanguage] = useState<string>(baseOptions.targetLanguage);

  // Verwende konsistente Sprachauswahl aus den Constants
  const availableLanguages = SUPPORTED_LANGUAGES;

  // Standard-Templates definieren
  const standardTemplates = [
    { name: "Besprechung", isStandard: true },
    { name: "Gedanken", isStandard: true },
    { name: "Interview", isStandard: true },
    { name: "Zusammenfassung", isStandard: true }
  ];

  // Templates nur laden, wenn der Dialog geöffnet wird
  useEffect(() => {
    let cancelled = false;
    async function loadTemplatesIfNeeded() {
      if (!isOpen || !activeLibraryId) return;

      try {
        // Verwende zentrale Client-Library für MongoDB-Templates
        const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
        const templateNames = await listAvailableTemplates(activeLibraryId)
        if (!cancelled) setCustomTemplateNames(templateNames);
      } catch (error) {
        if (!cancelled) setCustomTemplateNames([]);
        console.error('Fehler beim Laden der Templates:', error);
      }
    }

    loadTemplatesIfNeeded();
    return () => { cancelled = true; };
  }, [isOpen, activeLibraryId]);

  // Erzeuge effektive Eingabeliste: nur Markdown; PDFs → Shadow‑Twin (Markdown) im gleichen Ordner
  const [effectiveItems, setEffectiveItems] = useState<typeof selectedItems>([]);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [excludedItemIds, setExcludedItemIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function computeEffective() {
      try {
        if (!provider || !activeLibraryId || selectedItems.length === 0) {
          if (!cancelled) { setEffectiveItems([]); setSkippedCount(0); }
          return;
        }
        const results: typeof selectedItems = []
        let skipped = 0

        // 1) Markdown direkt übernehmen (keine Heuristik nötig)
        const pdfSources: Array<{ sourceId: string; sourceName: string; parentId: string; targetLanguage?: string }> = []
        for (const sel of selectedItems) {
          const it = sel.item
          const name = (it.metadata.name || '').toLowerCase()
          const mime = (it.metadata.mimeType || '').toLowerCase()
          const isMarkdown = name.endsWith('.md') || mime === 'text/markdown'
          if (isMarkdown) {
            results.push({ item: it, type: 'text' })
            continue
          }

          const isPdf = name.endsWith('.pdf') || mime === 'application/pdf'
          if (!isPdf || !it.parentId) {
            skipped += 1
            continue
          }

          // 2) PDFs: Transcript-Markdown via zentralem Resolver (kein list+match)
          pdfSources.push({
            sourceId: it.id,
            sourceName: it.metadata.name,
            parentId: it.parentId,
            targetLanguage: selectedLanguage,
          })
        }

        if (pdfSources.length > 0) {
          try {
            const resolvedMap = await batchResolveArtifactsClient({
              libraryId: activeLibraryId,
              sources: pdfSources,
              preferredKind: 'transcript',
            })

            for (const src of pdfSources) {
              const resolved = resolvedMap.get(src.sourceId) || null
              if (resolved?.item) results.push({ item: resolved.item, type: 'text' })
              else skipped += 1
            }
          } catch {
            // Wenn resolver-call fehlschlägt, skippen wir PDFs (kein harter Crash des Dialogs)
            skipped += pdfSources.length
          }
        }

        // Anwender-entfernte IDs ausfiltern
        const filtered = results.filter(entry => !excludedItemIds.includes(entry.item.id));
        // Deduplizieren nach item.id
        const dedupMap = new Map<string, (typeof selectedItems)[number]>()
        for (const entry of filtered) dedupMap.set(entry.item.id, entry)
        const dedup = Array.from(dedupMap.values())
        if (!cancelled) { setEffectiveItems(dedup); setSkippedCount(skipped); }
      } catch {
        if (!cancelled) { setEffectiveItems([]); setSkippedCount(0); }
      }
    }
    void computeEffective();
    return () => { cancelled = true; };
  }, [provider, activeLibraryId, selectedItems, selectedLanguage, excludedItemIds]);

  const handleRemoveEffectiveItem = (id: string) => {
    setEffectiveItems(prev => prev.filter(entry => entry.item.id !== id));
    setExcludedItemIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Generiere Standard-Dateinamen basierend auf effektiven Dateien
  useEffect(() => {
    if (effectiveItems.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const languageName = availableLanguages.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage;
      
      // Erstelle einen aussagekräftigeren Namen basierend auf den ausgewählten Dateien
      let defaultName = '';
      
      if (effectiveItems.length === 1) {
        // Bei einer Datei: Verwende den ursprünglichen Namen + Transformation + Sprache
        const originalName = effectiveItems[0].item.metadata.name;
        const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
        defaultName = `${nameWithoutExt}_Transformiert_${languageName}_${timestamp}`;
      } else {
        // Bei mehreren Dateien: Verwende die ersten beiden Namen + Anzahl + Sprache
        const firstNames = effectiveItems.slice(0, 2).map(item => 
          item.item.metadata.name.split('.').slice(0, -1).join('.')
        );
        defaultName = `${firstNames.join('_')}_und_${effectiveItems.length - 2}_weitere_${languageName}_${timestamp}`;
      }
      
      setCustomFileName(defaultName);
      // Validiere den generierten Namen
      setFileNameError(validateFileName(defaultName));
    }
  }, [effectiveItems, selectedLanguage, availableLanguages]);

  // Validierung des Dateinamens
  const validateFileName = (fileName: string): string => {
    if (!fileName.trim()) {
      return 'Dateiname ist erforderlich';
    }
    
    // Prüfe auf ungültige Zeichen
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      return 'Dateiname enthält ungültige Zeichen (< > : " / \\ | ? *)';
    }
    
    // Prüfe auf zu lange Namen
    if (fileName.length > 100) {
      return 'Dateiname ist zu lang (max. 100 Zeichen)';
    }
    
    // Prüfe auf reservierte Namen
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(fileName.toUpperCase())) {
      return 'Dateiname ist reserviert';
    }
    
    return '';
  };

  // Validierung bei Änderung des Dateinamens
  const handleFileNameChange = (value: string) => {
    setCustomFileName(value);
    const error = validateFileName(value);
    setFileNameError(error);
  };

  // Handler für die Batch-Text-Transformation
  const handleStartBatchTransformation = useCallback(async () => {
    if (!provider || !activeLibraryId || selectedItems.length === 0) {
      toast.error("Fehler", {
        description: "Storage Provider oder Bibliothek nicht verfügbar"
      });
      return;
    }

    setProgressState({
      isProcessing: true,
      currentProgress: null,
      results: null
    });

    try {
      // Progress-Callback für Fortschrittsanzeige
      const onProgress = (progress: BatchTransformProgress) => {
        setProgressState(prev => ({
          ...prev,
          currentProgress: progress
        }));
      };

      // Batch-Text-Transformation starten (kombiniert oder pro Datei)
      const results = textTransformMode === 'per-file'
        ? await BatchTransformService.transformTextBatchPerFile(
            effectiveItems,
            {
              ...baseOptions,
              targetLanguage: selectedLanguage,
            },
            selectedTemplate,
            provider,
            refreshItems,
            activeLibraryId,
            onProgress
          )
        : await BatchTransformService.transformTextBatch(
            effectiveItems,
            {
              ...baseOptions,
              targetLanguage: selectedLanguage,
              fileName: customFileName.trim() || `Kombinierte_Transformation_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`
            },
            selectedTemplate,
            provider,
            refreshItems,
            activeLibraryId,
            onProgress
          );

      setProgressState(prev => ({
        ...prev,
        isProcessing: false,
        results
      }));

      // Erfolgs-/Fehlermeldung anzeigen
      if (results.success) {
        const successCount = results.results.filter(r => r.success).length;
        toast.success(textTransformMode === 'per-file' ? "Per-Datei Transformation abgeschlossen" : "Kombinierte Transformation abgeschlossen", {
          description: textTransformMode === 'per-file'
            ? `${successCount} von ${effectiveItems.length} Dateien erfolgreich verarbeitet.`
            : `${successCount} von ${effectiveItems.length} Dateien erfolgreich verarbeitet. Eine kombinierte Datei wurde erstellt.`
        });
        
        // Fileliste automatisch aktualisieren
        if (effectiveItems.length > 0) {
          const parentId = effectiveItems[0].item.parentId;
          if (parentId) {
            try {
              const updatedItems = await refreshItems(parentId);
              console.log('TransformationDialog: Fileliste aktualisiert', {
                parentId,
                itemCount: updatedItems.length
              });
              
              // Informiere die übergeordnete Komponente über die Aktualisierung
              if (onRefreshFolder) {
                onRefreshFolder(parentId, updatedItems);
              }
            } catch (error) {
              console.error('TransformationDialog: Fehler beim Aktualisieren der Fileliste', error);
            }
          }
        }
      } else {
        const errorCount = results.results.filter(r => !r.success).length;
        toast.error(textTransformMode === 'per-file' ? "Per-Datei Transformation mit Fehlern abgeschlossen" : "Kombinierte Transformation mit Fehlern abgeschlossen", {
          description: `${errorCount} von ${effectiveItems.length} Dateien konnten nicht verarbeitet werden.`
        });
      }

    } catch (error) {
      console.error('Combined text transformation error:', error);
      setProgressState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast.error("Fehler", {
        description: `${textTransformMode === 'per-file' ? 'Per-Datei' : 'Kombinierte'} Transformation fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, activeLibraryId, effectiveItems, baseOptions, selectedTemplate, refreshItems, customFileName, selectedLanguage, onRefreshFolder, selectedItems.length, textTransformMode]);

  // Dialog schließen und State zurücksetzen
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setProgressState({
      isProcessing: false,
      currentProgress: null,
      results: null
    });
    setExcludedItemIds([]);
  }, [setIsOpen]);

  // Fortschrittsanzeige berechnen
  const progressPercentage = progressState.currentProgress 
    ? (progressState.currentProgress.currentItem / progressState.currentProgress.totalItems) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mehrere Dateien transformieren</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          {/* Ausgewählte Dateien */}
          <div>
            <h4 className="mb-1 text-sm font-medium">
              Eingabedateien ({effectiveItems.length})
            </h4>
            {skippedCount > 0 && (
              <p className="text-xs text-amber-600 mb-2">{skippedCount} Elemente wurden übersprungen (keine Markdown-Quelle gefunden).</p>
            )}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {effectiveItems.map(({ item, type }) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  {type === 'text' ? (
                    <FileText className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="truncate">{item.metadata.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {type}
                  </Badge>
                  <button
                    type="button"
                    className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                    title="Aus Liste entfernen"
                    aria-label="Aus Liste entfernen"
                    onClick={() => handleRemoveEffectiveItem(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {textTransformMode === 'per-file'
                ? 'Jede Datei wird einzeln mit dem Template verarbeitet (ideal für Seiten-Splitting).'
                : 'Die ausgewählten Texte werden zu einem einzigen Dokument kombiniert und anschließend mit dem Template verarbeitet.'}
            </p>
          </div>

          {/* Template-Auswahl */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="mode">Transformationsmodus</Label>
                <Select
                  value={textTransformMode}
                  onValueChange={(value) => setTextTransformMode(value as 'combined' | 'per-file')}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="mode">
                    <SelectValue placeholder="Modus auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="combined">Alle Dateien kombinieren</SelectItem>
                    <SelectItem value="per-file">Pro Datei transformieren</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="template">Template für Transformation</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Template auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Benutzerdefinierte Templates zuerst */}
                    {customTemplateNames.length > 0 && (
                      <>
                        {customTemplateNames.map((templateName) => (
                          <SelectItem key={templateName} value={templateName}>
                            {templateName}
                          </SelectItem>
                        ))}
                        {/* Trenner zwischen benutzerdefinierten und Standard-Templates */}
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                          Standard-Templates
                        </div>
                      </>
                    )}
                    
                    {/* Standard-Templates */}
                    {standardTemplates.map((standardTemplate) => (
                      <SelectItem key={standardTemplate.name} value={standardTemplate.name}>
                        {standardTemplate.name} <span className="text-muted-foreground">(Standard)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">Zielsprache</Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={setSelectedLanguage}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Sprache auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {textTransformMode === 'combined' ? (
                <div>
                  <Label htmlFor="filename">Dateiname für kombinierte Datei</Label>
                  <Input
                    id="filename"
                    value={customFileName}
                    onChange={(e) => handleFileNameChange(e.target.value)}
                    placeholder="Dateiname eingeben..."
                    disabled={progressState.isProcessing}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Der Dateiname wird automatisch mit der Endung .{baseOptions.fileExtension} gespeichert.
                  </p>
                  {fileNameError && (
                    <p className="text-xs text-red-500 mt-1">
                      {fileNameError}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <Label>Ausgabe pro Datei</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Jede Datei erhält ein eigenes Ergebnis im gleichen Ordner
                    (Dateiname: &lt;input&gt;.&lt;template&gt;.&lt;sprache&gt;.md).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Fortschrittsanzeige */}
          {progressState.isProcessing && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Verarbeitung läuft...</h4>
              <Progress value={progressPercentage} className="w-full" />
              {progressState.currentProgress && (
                <div className="text-sm text-muted-foreground">
                  {progressState.currentProgress.currentFileName} ({progressState.currentProgress.currentItem}/{progressState.currentProgress.totalItems})
                </div>
              )}
            </div>
          )}

          {/* Ergebnisse */}
          {progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Ergebnisse</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {progressState.results.results.map((result) => (
                  <div key={result.item.id} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="truncate">{result.item.metadata.name}</span>
                    {!result.success && (
                      <span className="text-xs text-red-500 truncate">
                        {result.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {progressState.results.results.some(r => r.savedItem) && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  ✓ Eine kombinierte Datei wurde erfolgreich erstellt und gespeichert.
                </div>
              )}
            </div>
          )}

          {/* Einstellungen */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Einstellungen</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Zielsprache:</span>
                  <div className="font-medium">
                    {availableLanguages.find(lang => lang.code === selectedLanguage)?.name}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Dateiendung:</span>
                  <div className="font-medium">.{baseOptions.fileExtension}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={progressState.isProcessing}
          >
            {progressState.results ? 'Schließen' : 'Abbrechen'}
          </Button>
          
          {!progressState.isProcessing && !progressState.results && (
            <Button 
              onClick={handleStartBatchTransformation}
              disabled={effectiveItems.length === 0 || !!fileNameError}
              className="min-w-[280px]"
            >
              Kombinierte Transformation starten
            </Button>
          )}
          {!progressState.isProcessing && !progressState.results && (
            <Button 
              variant="secondary"
              onClick={() => {
                const docs = effectiveItems.map(e => ({ id: e.item.id, name: e.item.metadata.name, parentId: e.item.parentId }))
                setTemplateContext(docs)
                router.push('/templates')
              }}
              disabled={effectiveItems.length === 0}
            >
              Im Template‑Editor testen
            </Button>
          )}
        </div>
      </DialogContent>
      {/* Modal für Prompt-Design*/}
      {!progressState.isProcessing && !progressState.results && (
        <CombinedChatDialog 
          provider={provider}
          items={effectiveItems.map(e => e.item)}
          selectedTemplate={selectedTemplate}
          selectedLanguage={selectedLanguage}
          defaultFileName={customFileName}
        />
      )}
    </Dialog>
  );
} 
```

```typescriptreact
"use client";

import { useAtom } from 'jotai';
import { useState, useCallback, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, FileText, File, X } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  baseTransformOptionsAtom
} from '@/atoms/transcription-options';
import { BatchTransformService, BatchTransformProgress, BatchTransformResult } from '@/lib/transform/batch-transform-service';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { useRootItems } from '@/hooks/use-root-items';
import { activeLibraryIdAtom } from '@/atoms/library-atom';
import { SUPPORTED_LANGUAGES } from '@/lib/secretary/constants';
import { StorageItem } from '@/lib/storage/types';
import { CombinedChatDialog } from '@/components/library/combined-chat-dialog'
import { templateContextDocsAtom } from '@/atoms/template-context-atom'
import { useSetAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import { batchResolveArtifactsClient } from '@/lib/shadow-twin/artifact-client'

interface ProgressState {
  isProcessing: boolean;
  currentProgress: BatchTransformProgress | null;
  results: BatchTransformResult | null;
}

interface TransformationDialogProps {
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function TransformationDialog({ onRefreshFolder }: TransformationDialogProps) {
  const [isOpen, setIsOpen] = useAtom(transformationDialogOpenAtom);
  // setCombinedOpen ungenutzt entfernt
  const [selectedItems] = useAtom(selectedTransformationItemsAtom);
  const [progressState, setProgressState] = useState<ProgressState>({
    isProcessing: false,
    currentProgress: null,
    results: null
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Besprechung');
  const [customTemplateNames, setCustomTemplateNames] = useState<string[]>([]);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [fileNameError, setFileNameError] = useState<string>('');
  // Erklärung: Modus steuert, ob alle Texte kombiniert werden oder pro Datei ein Output entsteht.
  const [textTransformMode, setTextTransformMode] = useState<'combined' | 'per-file'>('combined');
  
  const { provider, refreshItems } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  // getRootItems wird aktuell nicht verwendet, aber für zukünftige Verwendung bereitgehalten
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused_getRootItems = useRootItems();
  const baseOptions = useAtomValue(baseTransformOptionsAtom);
  const setTemplateContext = useSetAtom(templateContextDocsAtom)
  const router = useRouter()
  
  // Initialisiere selectedLanguage mit dem Standard-Wert
  const [selectedLanguage, setSelectedLanguage] = useState<string>(baseOptions.targetLanguage);

  // Verwende konsistente Sprachauswahl aus den Constants
  const availableLanguages = SUPPORTED_LANGUAGES;

  // Standard-Templates definieren
  const standardTemplates = [
    { name: "Besprechung", isStandard: true },
    { name: "Gedanken", isStandard: true },
    { name: "Interview", isStandard: true },
    { name: "Zusammenfassung", isStandard: true }
  ];

  // Templates nur laden, wenn der Dialog geöffnet wird
  useEffect(() => {
    let cancelled = false;
    async function loadTemplatesIfNeeded() {
      if (!isOpen || !activeLibraryId) return;

      try {
        // Verwende zentrale Client-Library für MongoDB-Templates
        const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
        const templateNames = await listAvailableTemplates(activeLibraryId)
        if (!cancelled) setCustomTemplateNames(templateNames);
      } catch (error) {
        if (!cancelled) setCustomTemplateNames([]);
        console.error('Fehler beim Laden der Templates:', error);
      }
    }

    loadTemplatesIfNeeded();
    return () => { cancelled = true; };
  }, [isOpen, activeLibraryId]);

  // Erzeuge effektive Eingabeliste: nur Markdown; PDFs → Shadow‑Twin (Markdown) im gleichen Ordner
  const [effectiveItems, setEffectiveItems] = useState<typeof selectedItems>([]);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [excludedItemIds, setExcludedItemIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function computeEffective() {
      try {
        if (!provider || !activeLibraryId || selectedItems.length === 0) {
          if (!cancelled) { setEffectiveItems([]); setSkippedCount(0); }
          return;
        }
        const results: typeof selectedItems = []
        let skipped = 0

        // 1) Markdown direkt übernehmen (keine Heuristik nötig)
        const pdfSources: Array<{ sourceId: string; sourceName: string; parentId: string; targetLanguage?: string }> = []
        for (const sel of selectedItems) {
          const it = sel.item
          const name = (it.metadata.name || '').toLowerCase()
          const mime = (it.metadata.mimeType || '').toLowerCase()
          const isMarkdown = name.endsWith('.md') || mime === 'text/markdown'
          if (isMarkdown) {
            results.push({ item: it, type: 'text' })
            continue
          }

          const isPdf = name.endsWith('.pdf') || mime === 'application/pdf'
          if (!isPdf || !it.parentId) {
            skipped += 1
            continue
          }

          // 2) PDFs: Transcript-Markdown via zentralem Resolver (kein list+match)
          pdfSources.push({
            sourceId: it.id,
            sourceName: it.metadata.name,
            parentId: it.parentId,
            targetLanguage: selectedLanguage,
          })
        }

        if (pdfSources.length > 0) {
          try {
            const resolvedMap = await batchResolveArtifactsClient({
              libraryId: activeLibraryId,
              sources: pdfSources,
              preferredKind: 'transcript',
            })

            for (const src of pdfSources) {
              const resolved = resolvedMap.get(src.sourceId) || null
              if (resolved?.item) results.push({ item: resolved.item, type: 'text' })
              else skipped += 1
            }
          } catch {
            // Wenn resolver-call fehlschlägt, skippen wir PDFs (kein harter Crash des Dialogs)
            skipped += pdfSources.length
          }
        }

        // Anwender-entfernte IDs ausfiltern
        const filtered = results.filter(entry => !excludedItemIds.includes(entry.item.id));
        // Deduplizieren nach item.id
        const dedupMap = new Map<string, (typeof selectedItems)[number]>()
        for (const entry of filtered) dedupMap.set(entry.item.id, entry)
        const dedup = Array.from(dedupMap.values())
        if (!cancelled) { setEffectiveItems(dedup); setSkippedCount(skipped); }
      } catch {
        if (!cancelled) { setEffectiveItems([]); setSkippedCount(0); }
      }
    }
    void computeEffective();
    return () => { cancelled = true; };
  }, [provider, activeLibraryId, selectedItems, selectedLanguage, excludedItemIds]);

  const handleRemoveEffectiveItem = (id: string) => {
    setEffectiveItems(prev => prev.filter(entry => entry.item.id !== id));
    setExcludedItemIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Generiere Standard-Dateinamen basierend auf effektiven Dateien
  useEffect(() => {
    if (effectiveItems.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const languageName = availableLanguages.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage;
      
      // Erstelle einen aussagekräftigeren Namen basierend auf den ausgewählten Dateien
      let defaultName = '';
      
      if (effectiveItems.length === 1) {
        // Bei einer Datei: Verwende den ursprünglichen Namen + Transformation + Sprache
        const originalName = effectiveItems[0].item.metadata.name;
        const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
        defaultName = `${nameWithoutExt}_Transformiert_${languageName}_${timestamp}`;
      } else {
        // Bei mehreren Dateien: Verwende die ersten beiden Namen + Anzahl + Sprache
        const firstNames = effectiveItems.slice(0, 2).map(item => 
          item.item.metadata.name.split('.').slice(0, -1).join('.')
        );
        defaultName = `${firstNames.join('_')}_und_${effectiveItems.length - 2}_weitere_${languageName}_${timestamp}`;
      }
      
      setCustomFileName(defaultName);
      // Validiere den generierten Namen
      setFileNameError(validateFileName(defaultName));
    }
  }, [effectiveItems, selectedLanguage, availableLanguages]);

  // Validierung des Dateinamens
  const validateFileName = (fileName: string): string => {
    if (!fileName.trim()) {
      return 'Dateiname ist erforderlich';
    }
    
    // Prüfe auf ungültige Zeichen
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      return 'Dateiname enthält ungültige Zeichen (< > : " / \\ | ? *)';
    }
    
    // Prüfe auf zu lange Namen
    if (fileName.length > 100) {
      return 'Dateiname ist zu lang (max. 100 Zeichen)';
    }
    
    // Prüfe auf reservierte Namen
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(fileName.toUpperCase())) {
      return 'Dateiname ist reserviert';
    }
    
    return '';
  };

  // Validierung bei Änderung des Dateinamens
  const handleFileNameChange = (value: string) => {
    setCustomFileName(value);
    const error = validateFileName(value);
    setFileNameError(error);
  };

  // Handler für die Batch-Text-Transformation
  const handleStartBatchTransformation = useCallback(async () => {
    if (!provider || !activeLibraryId || selectedItems.length === 0) {
      toast.error("Fehler", {
        description: "Storage Provider oder Bibliothek nicht verfügbar"
      });
      return;
    }

    setProgressState({
      isProcessing: true,
      currentProgress: null,
      results: null
    });

    try {
      // Progress-Callback für Fortschrittsanzeige
      const onProgress = (progress: BatchTransformProgress) => {
        setProgressState(prev => ({
          ...prev,
          currentProgress: progress
        }));
      };

      // Batch-Text-Transformation starten (kombiniert oder pro Datei)
      const results = textTransformMode === 'per-file'
        ? await BatchTransformService.transformTextBatchPerFile(
            effectiveItems,
            {
              ...baseOptions,
              targetLanguage: selectedLanguage,
            },
            selectedTemplate,
            provider,
            refreshItems,
            activeLibraryId,
            onProgress
          )
        : await BatchTransformService.transformTextBatch(
            effectiveItems,
            {
              ...baseOptions,
              targetLanguage: selectedLanguage,
              fileName: customFileName.trim() || `Kombinierte_Transformation_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`
            },
            selectedTemplate,
            provider,
            refreshItems,
            activeLibraryId,
            onProgress
          );

      setProgressState(prev => ({
        ...prev,
        isProcessing: false,
        results
      }));

      // Erfolgs-/Fehlermeldung anzeigen
      if (results.success) {
        const successCount = results.results.filter(r => r.success).length;
        toast.success(textTransformMode === 'per-file' ? "Per-Datei Transformation abgeschlossen" : "Kombinierte Transformation abgeschlossen", {
          description: textTransformMode === 'per-file'
            ? `${successCount} von ${effectiveItems.length} Dateien erfolgreich verarbeitet.`
            : `${successCount} von ${effectiveItems.length} Dateien erfolgreich verarbeitet. Eine kombinierte Datei wurde erstellt.`
        });
        
        // Fileliste automatisch aktualisieren
        if (effectiveItems.length > 0) {
          const parentId = effectiveItems[0].item.parentId;
          if (parentId) {
            try {
              const updatedItems = await refreshItems(parentId);
              console.log('TransformationDialog: Fileliste aktualisiert', {
                parentId,
                itemCount: updatedItems.length
              });
              
              // Informiere die übergeordnete Komponente über die Aktualisierung
              if (onRefreshFolder) {
                onRefreshFolder(parentId, updatedItems);
              }
            } catch (error) {
              console.error('TransformationDialog: Fehler beim Aktualisieren der Fileliste', error);
            }
          }
        }
      } else {
        const errorCount = results.results.filter(r => !r.success).length;
        toast.error(textTransformMode === 'per-file' ? "Per-Datei Transformation mit Fehlern abgeschlossen" : "Kombinierte Transformation mit Fehlern abgeschlossen", {
          description: `${errorCount} von ${effectiveItems.length} Dateien konnten nicht verarbeitet werden.`
        });
      }

    } catch (error) {
      console.error('Combined text transformation error:', error);
      setProgressState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast.error("Fehler", {
        description: `${textTransformMode === 'per-file' ? 'Per-Datei' : 'Kombinierte'} Transformation fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, activeLibraryId, effectiveItems, baseOptions, selectedTemplate, refreshItems, customFileName, selectedLanguage, onRefreshFolder, selectedItems.length, textTransformMode]);

  // Dialog schließen und State zurücksetzen
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setProgressState({
      isProcessing: false,
      currentProgress: null,
      results: null
    });
    setExcludedItemIds([]);
  }, [setIsOpen]);

  // Fortschrittsanzeige berechnen
  const progressPercentage = progressState.currentProgress 
    ? (progressState.currentProgress.currentItem / progressState.currentProgress.totalItems) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mehrere Dateien transformieren</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          {/* Ausgewählte Dateien */}
          <div>
            <h4 className="mb-1 text-sm font-medium">
              Eingabedateien ({effectiveItems.length})
            </h4>
            {skippedCount > 0 && (
              <p className="text-xs text-amber-600 mb-2">{skippedCount} Elemente wurden übersprungen (keine Markdown-Quelle gefunden).</p>
            )}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {effectiveItems.map(({ item, type }) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  {type === 'text' ? (
                    <FileText className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="truncate">{item.metadata.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {type}
                  </Badge>
                  <button
                    type="button"
                    className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                    title="Aus Liste entfernen"
                    aria-label="Aus Liste entfernen"
                    onClick={() => handleRemoveEffectiveItem(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {textTransformMode === 'per-file'
                ? 'Jede Datei wird einzeln mit dem Template verarbeitet (ideal für Seiten-Splitting).'
                : 'Die ausgewählten Texte werden zu einem einzigen Dokument kombiniert und anschließend mit dem Template verarbeitet.'}
            </p>
          </div>

          {/* Template-Auswahl */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="mode">Transformationsmodus</Label>
                <Select
                  value={textTransformMode}
                  onValueChange={(value) => setTextTransformMode(value as 'combined' | 'per-file')}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="mode">
                    <SelectValue placeholder="Modus auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="combined">Alle Dateien kombinieren</SelectItem>
                    <SelectItem value="per-file">Pro Datei transformieren</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="template">Template für Transformation</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Template auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Benutzerdefinierte Templates zuerst */}
                    {customTemplateNames.length > 0 && (
                      <>
                        {customTemplateNames.map((templateName) => (
                          <SelectItem key={templateName} value={templateName}>
                            {templateName}
                          </SelectItem>
                        ))}
                        {/* Trenner zwischen benutzerdefinierten und Standard-Templates */}
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                          Standard-Templates
                        </div>
                      </>
                    )}
                    
                    {/* Standard-Templates */}
                    {standardTemplates.map((standardTemplate) => (
                      <SelectItem key={standardTemplate.name} value={standardTemplate.name}>
                        {standardTemplate.name} <span className="text-muted-foreground">(Standard)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">Zielsprache</Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={setSelectedLanguage}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Sprache auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {textTransformMode === 'combined' ? (
                <div>
                  <Label htmlFor="filename">Dateiname für kombinierte Datei</Label>
                  <Input
                    id="filename"
                    value={customFileName}
                    onChange={(e) => handleFileNameChange(e.target.value)}
                    placeholder="Dateiname eingeben..."
                    disabled={progressState.isProcessing}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Der Dateiname wird automatisch mit der Endung .{baseOptions.fileExtension} gespeichert.
                  </p>
                  {fileNameError && (
                    <p className="text-xs text-red-500 mt-1">
                      {fileNameError}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <Label>Ausgabe pro Datei</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Jede Datei erhält ein eigenes Ergebnis im gleichen Ordner
                    (Dateiname: &lt;input&gt;.&lt;template&gt;.&lt;sprache&gt;.md).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Fortschrittsanzeige */}
          {progressState.isProcessing && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Verarbeitung läuft...</h4>
              <Progress value={progressPercentage} className="w-full" />
              {progressState.currentProgress && (
                <div className="text-sm text-muted-foreground">
                  {progressState.currentProgress.currentFileName} ({progressState.currentProgress.currentItem}/{progressState.currentProgress.totalItems})
                </div>
              )}
            </div>
          )}

          {/* Ergebnisse */}
          {progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Ergebnisse</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {progressState.results.results.map((result) => (
                  <div key={result.item.id} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="truncate">{result.item.metadata.name}</span>
                    {!result.success && (
                      <span className="text-xs text-red-500 truncate">
                        {result.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {progressState.results.results.some(r => r.savedItem) && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  ✓ {textTransformMode === 'per-file'
                    ? 'Mehrere Einzeldokumente wurden erstellt.'
                    : 'Eine kombinierte Datei wurde erfolgreich erstellt und gespeichert.'}
                </div>
              )}
            </div>
          )}

          {/* Einstellungen */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Einstellungen</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Zielsprache:</span>
                  <div className="font-medium">
                    {availableLanguages.find(lang => lang.code === selectedLanguage)?.name}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Dateiendung:</span>
                  <div className="font-medium">.{baseOptions.fileExtension}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={progressState.isProcessing}
          >
            {progressState.results ? 'Schließen' : 'Abbrechen'}
          </Button>
          
          {!progressState.isProcessing && !progressState.results && (
            <Button 
              onClick={handleStartBatchTransformation}
              disabled={effectiveItems.length === 0 || !!fileNameError}
              className="min-w-[280px]"
            >
              Kombinierte Transformation starten
            </Button>
          )}
          {!progressState.isProcessing && !progressState.results && (
            <Button 
              variant="secondary"
              onClick={() => {
                const docs = effectiveItems.map(e => ({ id: e.item.id, name: e.item.metadata.name, parentId: e.item.parentId }))
                setTemplateContext(docs)
                router.push('/templates')
              }}
              disabled={effectiveItems.length === 0}
            >
              Im Template‑Editor testen
            </Button>
          )}
        </div>
      </DialogContent>
      {/* Modal für Prompt-Design*/}
      {!progressState.isProcessing && !progressState.results && (
        <CombinedChatDialog 
          provider={provider}
          items={effectiveItems.map(e => e.item)}
          selectedTemplate={selectedTemplate}
          selectedLanguage={selectedLanguage}
          defaultFileName={customFileName}
        />
      )}
    </Dialog>
  );
} 
```

```typescript
import { describe, expect, it } from 'vitest'
import { splitMarkdownByPageMarkers } from '@/lib/markdown/markdown-page-splitter'

describe('splitMarkdownByPageMarkers', () => {
  it('splits markdown by explicit page markers', () => {
    const markdown = [
      '---',
      'title: Test',
      '---',
      '--- Seite 1 ---',
      'Erste Seite',
      '',
      '--- Seite 2 ---',
      'Zweite Seite',
      '',
    ].join('\n')

    // Erwartung: zwei Seiten, korrekte Nummern und Inhalte.
    const result = splitMarkdownByPageMarkers(markdown)
    expect(result.pages).toHaveLength(2)
    expect(result.pages[0].pageNumber).toBe(1)
    expect(result.pages[0].content).toContain('Erste Seite')
    expect(result.pages[1].pageNumber).toBe(2)
    expect(result.pages[1].content).toContain('Zweite Seite')
  })

  it('returns empty result when no markers exist', () => {
    const markdown = 'Ohne Marker\nNur Text'
    const result = splitMarkdownByPageMarkers(markdown)
    expect(result.pages).toHaveLength(0)
    expect(result.markerCount).toBe(0)
  })
})

```

Bevor ich umgesetzt habe, habe ich die vorhandene Pipeline so bewertet: Die Seite‑Marker `--- Seite N ---` sind im Transcript‑Markdown bereits die verlässlichste Informationsquelle, während Template‑Outputs diese Marker verlieren können. Daher ist ein Splitter auf Transcript‑Basis der stabilste Weg, ohne OCR erneut anzustoßen. Gleichzeitig war wichtig, dass der spätere Batch‑Schritt **pro Datei** arbeiten kann, sonst landet alles wieder in einem Sammeldokument.

Zweitens habe ich geprüft, wie Speicherorte und Artefakte heute gehandhabt werden. Shadow‑Twin‑Outputs landen im Dot‑Folder und wären im Explorer schlecht sichtbar. Deshalb speichert die neue per‑Datei‑Transformation ihre Ergebnisse **als normale Dateien im gleichen Ordner** wie die gesplitteten Seiten. So kannst du die Dokumente direkt im Explorer finden und filtern.

Drittens habe ich die Lösung so gewählt, dass sie nur minimal in bestehende Abläufe eingreift: ein serverseitiger Split‑API‑Endpoint, ein Button in der Vorschau, plus eine neue Batch‑Option „pro Datei transformieren“. Damit bleibt der bestehende Story‑Creator unberührt und du bekommst den gewünschten Flow.

Änderungen, die das ermöglichen:
- Server‑Endpoint zum Splitten von Transcript‑Markdown in Einzelseiten unter `src/app/api/library/[libraryId]/markdown/split-pages/route.ts`.
- Markdown‑Splitter‑Utility mit Unit‑Test (`src/lib/markdown/markdown-page-splitter.ts`, `tests/unit/markdown/markdown-page-splitter.test.ts`).
- Batch‑Transformation erweitert um „pro Datei“-Modus (`transformTextBatchPerFile` in `src/lib/transform/batch-transform-service.ts`).
- UI‑Erweiterung: Button „Seiten splitten“ in der Vorschau (`src/components/library/file-preview.tsx`) und Modus‑Auswahl im Transformationsdialog (`src/components/library/transformation-dialog.tsx`).
- Analyse dokumentiert in `docs/analysis/markdown-page-splitting.md` und ins MkDocs‑Nav eingehängt.

Wichtig für deine Frage „wo werden die Dokumente gespeichert?“:
- **Splitter**: legt ein Ordner im **Parent der PDF** an, **benannt nach der Quelldatei** (sanitisiert/sicher).  
- **Per‑File Transformation**: speichert **neben jeder Seite** das Ergebnis als `page-001.<template>.<sprache>.md`.

So nutzt du den Flow:
1) PDF in der Vorschau öffnen und **„Seiten splitten“** klicken.  
2) In den neuen Ordner wechseln und alle Seiten‑Markdowns auswählen.  
3) **Transformieren** → **„Pro Datei transformieren“** wählen → Template wählen → Starten.  
Wenn die Ordner‑Auswahl in der Batch‑UI nicht greift, wähle die Dateien innerhalb des Ordners (z. B. „Alle auswählen“).

Tests:
- `pnpm vitest --run tests/unit/markdown/markdown-page-splitter.test.ts`  
  Ergebnis: 2 Tests bestanden. (Es gibt eine Vite‑CJS‑Deprecation‑Warnung, die ist nicht durch diese Änderung verursacht.)

Wenn du möchtest, kann ich als nächsten Schritt die Ordner‑Auswahl im Batch‑Dialog explizit unterstützen (rekursiv), damit du wirklich nur den Ordner markieren musst.

---

**User**

@Next.js: Debug Server-Side (1-29) Ich wähle "Seiten splitten" -> interner Fehler

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import path from 'path'

import { FileLogger } from '@/lib/debug/logger'
import { getServerProvider } from '@/lib/storage/server-provider'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import {
  splitMarkdownByPageMarkers,
  toSafeFolderName,
} from '@/lib/markdown/markdown-page-splitter'

interface SplitPagesRequestBody {
  sourceFileId: string
  targetLanguage?: string
  outputFolderName?: string
}

interface SplitPagesError {
  code: string
  message: string
  status: number
  details?: Record<string, unknown>
}

function createSplitError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): SplitPagesError {
  return { code, message, status, details }
}

function isMarkdownFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.mdx')
}

function isMarkdownMimeType(mimeType: string | undefined): boolean {
  return (mimeType || '').toLowerCase().includes('markdown')
}

function buildPageFrontmatter(args: {
  sourceFileId: string
  sourceFileName: string
  pageNumber: number
  totalPages: number
}): string {
  // Dokumentiert: Wir fügen die Herkunft explizit hinzu, damit Explorer-Filter stabil bleiben.
  return [
    '---',
    `source_file_id: ${args.sourceFileId}`,
    `source_file_name: ${JSON.stringify(args.sourceFileName)}`,
    `page: ${args.pageNumber}`,
    `pages_total: ${args.totalPages}`,
    '---',
    '',
  ].join('\n')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = getAuth(request)
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'Keine Benutzer-E-Mail gefunden' }, { status: 401 })

    const { libraryId } = await params
    const body = (await request.json().catch(() => ({}))) as Partial<SplitPagesRequestBody>
    const sourceFileId = typeof body.sourceFileId === 'string' ? body.sourceFileId : ''
    const targetLanguage = typeof body.targetLanguage === 'string' ? body.targetLanguage : 'de'
    const outputFolderName = typeof body.outputFolderName === 'string' ? body.outputFolderName : ''

    if (!libraryId || !sourceFileId) {
      return NextResponse.json({ error: 'libraryId und sourceFileId erforderlich' }, { status: 400 })
    }

    // Storage-Provider initialisieren (inkl. Base-URL + User-Email)
    const provider = await getServerProvider(userEmail, libraryId)

    // Source-Datei laden, um Name/Parent zu kennen (für deterministischen Ordnernamen)
    const sourceItem = await provider.getItemById(sourceFileId)
    if (!sourceItem || sourceItem.type !== 'file') {
      return NextResponse.json({ error: 'Quelle ist keine Datei' }, { status: 400 })
    }

    const sourceFileName = sourceItem.metadata.name
    const parentId = sourceItem.parentId || 'root'
    const sourceBaseName = path.parse(sourceFileName).name

    // 1) Wenn die Quelle schon Markdown ist: direkt verwenden
    // 2) Sonst: Transcript per Shadow‑Twin Resolver suchen (Marker sind dort verlässlich)
    const resolvedMarkdown = isMarkdownFileName(sourceFileName) || isMarkdownMimeType(sourceItem.metadata.mimeType)
      ? { fileId: sourceFileId }
      : await resolveArtifact(provider, {
          sourceItemId: sourceFileId,
          sourceName: sourceFileName,
          parentId,
          targetLanguage,
          preferredKind: 'transcript',
        })

    if (!resolvedMarkdown?.fileId) {
      return NextResponse.json(
        { error: 'Transcript-Markdown nicht gefunden (kein Split möglich)' },
        { status: 404 }
      )
    }

    // Markdown laden
    const markdownBinary = await provider.getBinary(resolvedMarkdown.fileId)
    const markdown = await markdownBinary.blob.text()

    // Seiten splitten (harte Validierung: ohne Marker keine Ausgabe)
    const splitResult = splitMarkdownByPageMarkers(markdown)
    if (splitResult.pages.length === 0) {
      const splitError = createSplitError(
        'no_page_markers',
        'Keine Seitenmarker gefunden (Format: "--- Seite N ---")',
        422,
        { markerCount: splitResult.markerCount }
      )
      FileLogger.warn('split-pages', splitError.message, splitError.details)
      return NextResponse.json({ error: splitError.message, code: splitError.code }, { status: splitError.status })
    }

    // Zielordner finden oder erstellen
    const requestedFolder = outputFolderName.trim() || sourceBaseName
    const folderName = toSafeFolderName(requestedFolder)
    const siblings = await provider.listItemsById(parentId)
    const existingFolder = siblings.find(
      (it) => it.type === 'folder' && (it.metadata?.name || '') === folderName
    )
    const targetFolder = existingFolder || (await provider.createFolder(parentId, folderName))

    // Seiten als einzelne Markdown-Dateien speichern
    let createdCount = 0
    for (const page of splitResult.pages) {
      try {
        // Erklärung: deterministischer Dateiname für stabile Batch-Auswahl
        const padded = String(page.pageNumber).padStart(3, '0')
        const fileName = `page-${padded}.md`
        const frontmatter = buildPageFrontmatter({
          sourceFileId,
          sourceFileName,
          pageNumber: page.pageNumber,
          totalPages: splitResult.pages.length,
        })
        const content = `${frontmatter}${page.content.trim()}\n`
        const file = new File([content], fileName, { type: 'text/markdown' })
        await provider.uploadFile(targetFolder.id, file)
        createdCount += 1
      } catch (error) {
        // Fehler dokumentieren, aber den Split nicht komplett abbrechen (teilweise Ergebnisse sind erlaubt)
        FileLogger.error('split-pages', 'Fehler beim Speichern einer Seite', {
          sourceFileId,
          page: page.pageNumber,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      folderId: targetFolder.id,
      folderName: targetFolder.metadata.name,
      created: createdCount,
      pages: splitResult.pages.length,
      sourceMarkdownId: resolvedMarkdown.fileId,
    })
  } catch (error) {
    FileLogger.error('split-pages', 'Unerwarteter Fehler beim Splitten', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

```

Ich habe die Ursache eingegrenzt: Der Split‑Endpoint hat einen Storage‑Provider ohne Base‑URL gebaut. Dadurch wurden serverseitige Fetches mit relativen URLs wie `/api/storage/filesystem?...` erzeugt und `fetch` hat **„Failed to parse URL“** geworfen. Das ist konsistent mit deinem Log.

Fix: Der Endpoint nutzt jetzt den Server‑Helper `getServerProvider`, der **Base‑URL + userEmail** korrekt setzt. Damit sollten die Storage‑Calls wieder absolute URLs erhalten.

Codeänderung:
- `src/app/api/library/[libraryId]/markdown/split-pages/route.ts`  
  Statt eigener `StorageFactory`‑Konfiguration wird jetzt `getServerProvider(...)` verwendet.

Bitte einmal erneut „Seiten splitten“ testen. Ich habe den Fix lokal nicht durch den UI‑Flow verifiziert.

Wenn der Fehler weiterhin auftritt, schick mir bitte die neue Server‑Logzeile (inkl. `split-pages`‑Error).

---

**User**

Ich möchte jetzt eine neue Detailseite kreieren und zwar und ein Template, Transformation für diese Detailseiten. Und zwar geht es geht um Klimamaßnahmen. Ich habe hunderte von Maßnahmen, die ich gerne als jede einzelne als Dokument, als Blogartikel anzeigen möchte. Und in meinen Rohdaten habe ich folgendes Beispiel. 

--- Seite 1 --- 
Vorschläge des Stakeholder Forum Klima mit der Bewertung: Proposte del Stakeholder Forum per il Clima con la valutazione: Stand 14.08.2025 www.klimaland.bz Vorschlag bereits in Umsetzung Proposta già in corso di attuazione Seite 1 von 120 
--- Seite 2 --- 
Nr. 335 Handlungsfeld Kommunikation und Bewusstseinsbildung Campo d´azione Comunicazione e Sensibilizzazione Zuständigkeit Ressort Umwelt-, Natur- und Klimaschutz, Energie, Raumentwicklung und Sport Responsabilità Dipartimento Protezione dell’ambiente, della natura e del clima, Energia, Sviluppo del territorio e Sport Vorschlag Klimabürgerrat Anmerkung Maßnahme AG Wohnen SHF: (1.1) Maßnahmen, die in Umsetzung sind oder bereits umgesetzt wurden, werden verlinkt. Zudem wird auf der Website KlimaLand die Möglichkeit geschaffen, Initiativen sowie öffentliche und private Best-Practice-Beispiele vorzustellen, die Südtirol als KlimaLand präsentieren. Dabei wird auf eine ausgewogene Darstellung geachtet, welche die drei Dimensionen Ökologie, Ökonomie und Soziales umfasst. Unter anderem wird eine eigene Unterseite „Wohnen“ erstellt, auf der Best-Practice-Beispiele von öffentlichen Gebäuden dargestellt werden. Es wird auch die Möglichkeit gegeben, Privatgebäude darzustellen. Proposta Consiglio dei cittadini per il clima Anmerkung Maßnahme AG Wohnen SHF: (1.1) Maßnahmen, die in Umsetzung sind oder bereits umgesetzt wurden, werden verlinkt. Zudem wird auf der Website KlimaLand die Möglichkeit geschaffen, Initiativen sowie öffentliche und private Best-Practice-Beispiele vorzustellen, die Südtirol als KlimaLand präsentieren. Dabei wird auf eine ausgewogene Darstellung geachtet, welche die drei Dimensionen Ökologie, Ökonomie und Soziales umfasst. Unter anderem wird eine eigene Unterseite „Wohnen“ erstellt, auf der Best-Practice-Beispiele von öffentlichen Gebäuden dargestellt werden. Es wird auch die Möglichkeit gegeben, Privatgebäude darzustellen. Rückmeldung Landesverwaltung Ressort Umwelt-, Natur- und Klimaschutz, Energie, Raumentwicklung und Sport: Dieser Vorschlag wird bereits umgesetzt und wird mit der Umgestaltung der Seite www.klimaland.bz, die innerhalb 2025 abgeschlossen wird, mitberücksichtigt. Risposta Amministrazione Provinciale Dipartimento Ambiente, Natura e Protezione del clima, Energia, Sviluppo territoriale e Sport: Questa proposta è già in fase di attuazione: sarà preso in considerazione con la riorganizzazione del sito www.klimaland.bz, che sarà completata entro il 2025. Bewertung Vorschlag bereits in Umsetzung Valutazione Proposta già in corso di attuazione Seite 2 von 120 
--- Seite 3 --- 
Nr. 336 Handlungsfeld Kommunikation und Bewusstseinsbildung Campo d´azione Comunicazione e Sensibilizzazione Zuständigkeit Ressort Umwelt-, Natur- und Klimaschutz, Energie, Raumentwicklung und Sport Responsabilità Dipartimento Protezione dell’ambiente, della natura e del clima, Energia, Sviluppo del territorio e Sport Vorschlag Klimabürgerrat Anmerkung Maßnahme AG Wohnen SHF: (1.2) Bewusstseinsarbeit ist hier wichtig. Es muss berücksichtigt werden, dass sich nicht alle politischen Vertreter aktiv über alle Themen informieren. Prinzipiell existieren bereits sehr viele Fortbildungen für alle möglichen Bereiche, auch für die Nachhaltigkeit. Die Veranstal tungen müssen daher spezifisch an die politischen Vertreter gerichtet werden, die sich nicht selbst aktiv um das Thema Klimaschutz kümmern. Es muss sichergestellt werden, dass alle über einen allgemeinen Kenntnisstand der Problematik sowie der entsprechenden politisch und rechtlich relevanten Richtlinien verfügen. Ein allgemeiner Teil vermittelt den allgemeinen Wissensstand und soll standardisiert werden. Dazu sollte die EURAC einen Standardvortrag ausarbeiten und vortragen, der einen spezifischen Bezug zu Südtirol (Einbindung des Klimamonitorings) hat. Das Ziel hierbei ist es, alle politischen Vertreter für das Thema zu sensibilisieren. Mit diesem Vortrag soll sofort gestartet werden. Es sollte geklärt werden, ob die EURAC nicht bereits in diesem Jahr spezifische Proposta Consiglio dei cittadini per il clima Anmerkung Maßnahme AG Wohnen SHF: (1.2) Bewusstseinsarbeit ist hier wichtig. Es muss berücksichtigt werden, dass sich nicht alle politischen Vertreter aktiv über alle Themen informieren. Prinzipiell existieren bereits sehr viele Fortbildungen für alle möglichen Bereiche, auch für die Nachhaltigkeit. Die Veranstal tungen müssen daher spezifisch an die politischen Vertreter gerichtet werden, die sich nicht selbst aktiv um das Thema Klimaschutz kümmern. Es muss sichergestellt werden, dass alle über einen allgemeinen Kenntnisstand der Problematik sowie der entsprechenden politisch und rechtlich relevanten Richtlinien verfügen. Ein allgemeiner Teil vermittelt den allgemeinen Wissensstand und soll standardisiert werden. Dazu sollte die EURAC einen Standardvortrag ausarbeiten und vortragen, der einen spezifischen Bezug zu Südtirol (Einbindung des Klimamonitorings) hat. Das Ziel hierbei ist es, alle politischen Vertreter für das Thema zu sensibilisieren. Mit diesem Vortrag soll sofort gestartet werden. Es sollte geklärt werden, ob die EURAC nicht bereits in diesem Jahr spezifische Rückmeldung Landesverwaltung Ressort Umwelt-, Natur- und Klimaschutz, Energie, Raumentwicklung und Sport: Dieser Vorschlag wird bereits umgesetzt: Seit April 2025 organisiert die Agentur für Energie Südtirol - KlimaHaus Fortbildungsveranstaltungen in den Bezirksgemeinschaften, die auf die lokalen politischen Entscheidungsträger ausgerichtet sind. Risposta Amministrazione Provinciale Dipartimento Protezione dell’ambiente, della natura e del clima, Energia, Sviluppo del territorio e Sport: Questa proposta è già in fase di attuazione: da aprile 2025 l'Agenzia per l'Energia Alto Adige - CasaClima organizza corsi di formazione continua nelle Comunità comprensorialei rivolti ai decisori politici locali. Bewertung Vorschlag bereits in Umsetzung Valutazione Proposta già in corso di attuazione Seite 3 von 120 --- 

Jeder Maßnahme ist gemeinsam versehen mit einer Nummer versehen, wie immer eine Pflicht beginnt immer mit einer neuen Seite, mit einer Nummer, mit einem Handlungsfeld. Die italienischen Texte können wir mal ignorieren. Dann gibt es eine Zuständigkeit. Danach gibt es einen Vorschlag von einem Klimabürgerrat oder von einem Stakeholderforum. Dann gibt es eine Anmerkung. Und dann gibt es eine Rückmeldung der Landesverwaltung und am Ende eine Bewertung. Also irgendwie möchte ich in dem Blogartikel jetzt auf diese Punkte würde ich gerne aufgreifen, aber den Blogartikel müsste schon für die Bevölkerung sehr populär erklärt werden, um was geht es, was ist geplant, wird es umgesetzt? Dann gibt es dann weitere Fragen, was es bringen würde und wie weit ist diese Umsetzung fortgeschritten. Und am Ende möchte ich dann Menschen Argumente aufzeigen oder einbringen lassen, die jetzt dieses Vorhaben bewerben und vielleicht auch Best-Practice-Beispiele, eine Liste von Beispielen, die zeigen, wie es funktioniert, wie dieses Vorhaben umgesetzt wurde.
Ich habe schon dieses Konzept erarbeitet? @docs/_analysis/templateFürKlimaMassnahmen 
Wie gehen wir vor?

---

**Cursor**

Ich sehe, dass du bereits ein sehr klares Konzept hast (`docs/_analysis/templateFürKlimaMassnahmen`). Die Rohdaten sind strukturiert genug, um ein **starkes, wiederholbares Template** zu erzeugen. Entscheidend ist jetzt: Wir müssen die Rohseite **stabil in strukturierte Felder parsen** (Nummer, Handlungsfeld, Zuständigkeit, Vorschlag, Anmerkung, Rückmeldung, Bewertung), bevor wir den „populären“ Blogtext erzeugen. Sonst ist der Output inkonsistent und schwer filterbar. Der zweite Schritt ist dann die **Template‑Transformation**, die die bevölkerungsnahe Erklärung schreibt und zusätzlich klare Frontmatter‑Metadaten liefert.

Bevor wir umsetzen, sollten wir das Vorgehen kurz dokumentieren (deine Regel). Das vorhandene Konzept ist die Basis, aber es fehlt ein **Parsing‑Schema** (Regeln + Edge Cases) und ein **konkretes Template‑Mapping** (welcher Rohblock füllt welches Feld). Damit vermeiden wir, dass die LLM‑Transformation zu viel „rät“.

### Drei Varianten (mit Trade‑off)
1) **Parser‑First (empfohlen)**  
   - Rohseite → deterministische Felder (Regex/Marker) → LLM‑Template für Blogtext.  
   - Vorteil: stabile Filterbarkeit + reproduzierbare Metadaten.  
   - Nachteil: etwas mehr Initialaufwand für Parsing‑Regeln.

2) **LLM‑Only (schnell, aber riskant)**  
   - Rohseite → direkt in Template „interpretieren“.  
   - Vorteil: schnell startklar.  
   - Nachteil: hohe Varianz, schlechtere Filterbarkeit.

3) **Hybrid**  
   - Parser extrahiert Kernfelder (Nummer, Handlungsfeld, Zuständigkeit, Bewertung).  
   - LLM ergänzt „Erklärung/Warum/Wirkung/Beispiele“.  
   - Vorteil: Balance aus Stabilität und Textqualität.

### Konkretes Vorgehen (pragmatisch)
1) **Parsing‑Regeln definieren**  
   - Marker: `Nr.` → `id`  
   - `Handlungsfeld` → `handlungsfeld`  
   - `Zuständigkeit` → `zustaendigkeit`  
   - `Vorschlag` + `Anmerkung` → `vorschlag`, `anmerkung`  
   - `Rückmeldung` → `rueckmeldung`  
   - `Bewertung` → `bewertung`  
   - Italienisch ignorieren (Spalten‑Trennung via Regex oder Heuristik).

2) **Template für Detailseite**  
   - Nimm dein Konzept und mappe Felder 1:1 in Frontmatter und Body.  
   - Beispiel: `title` aus Handlungsfeld + Vorschlag‑Kurzform.  
   - `umsetzungsstand` aus Bewertung + Rückmeldung.

3) **Transformation starten**  
   - Seite splitten → pro Seite Markdown → Parser → Template‑Transformation.

Wenn du willst, liefere ich dir jetzt **konkrete Regex‑Regeln** für das Parsing und ein **Template‑Skeleton** (Markdown + Frontmatter) als Copy‑Paste‑Block.  
Sag mir nur, ob du **Variante 1 (Parser‑First)** oder **Variante 3 (Hybrid)** willst.

---

**User**

@template-samples/pdfanalyse.md 

Wir nutzen bei Template Generierung ein dieses Quo-Element. Im den Frontmatter wird ja genau definiert, welche Felder wir brauchen, neben den klassischen Feldern, die wir sowieso immer mitführen. Und hier können wir mit Worten beschreiben, welche Inhalte woher kommen. Als Quelle verwenden wir die Markdown umgewandelten PDFs. Es kann sein, dass dort diese Überschriften nur im Text stehen. Deswegen sollten wir bei den Anweisungen einfach sagen, der Inhalt sollte nach diesem Text erscheinen, vor dem nächsten. Also die Titel sind ja irgendwie im Markdown vorhanden, allerdings die Formatierung nicht so richtig. Und sonst den Systemprompt können wir auch einfügen und diese Formatierung von diesem Blog, den können wir einfach im Body-Bereich einfügen, der normalerweise so formatiert ist:

@testimonial-creation-de.md (52-56) 

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Erstelle das Template gemäß Plan. Prüfe die Referenzdateien, um die Struktur zu verstehen.


Erstelle das Template gemäß Plan.


```markdown
---
id: {{id|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
region: Südtirol
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur:

1. Hauptüberschrift (# {{title}})
2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?)
3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext)
4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll)
5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung)
6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik)
7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte)
8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen)
9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder)
10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch)

Formatierungsregeln:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Extrahiere Informationen aus dem Markdown-Text:
- Ignoriere italienische Texte komplett (nur Deutsch verwenden)
- Erkenne Felder anhand der Marker im Text:
  * "Nr." → id
  * "Handlungsfeld" → handlungsfeld
  * "Zuständigkeit" → zustaendigkeit
  * "Vorschlag" + "Anmerkung" → vorschlag_erklaert
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert
  * "Bewertung" → bewertung
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker (z. B. "Vorschlag" bis "Rückmeldung")}}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → id (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Anmerkung" → anmerkung (Text nach "Anmerkung" bis zum nächsten Marker)
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "id": "string (nur Zahl)",
  "title": "string",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "region": "Südtirol",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

Template erstellt: `template-samples/klimamassnahme-detail-de.md`

**Was implementiert wurde:**

1. **Frontmatter** mit präzisen Feldbeschreibungen (wie in `pdfanalyse.md`):
   - Alle Felder aus deinem Konzept (id, title, handlungsfeld, thema, quelle, zustaendigkeit, umsetzungsstand, bewertung, status, stand)
   - Jedes Feld hat eine Beschreibung, woher der Inhalt kommt

2. **Body-Struktur mit Quo-Element** (wie in `testimonial-creation-de.md`):
   - `{{bodyInText|...}}` mit Anweisungen zur Blog-Struktur
   - Alle 10 Abschnitte aus deinem Konzept (Worum geht es, Vorschlag, Warum wichtig, etc.)
   - Formatierungsregeln integriert

3. **Systemprompt mit Parsing-Regeln**:
   - Nur Deutsch extrahieren (Italienisch ignorieren)
   - Marker-basierte Extraktion: "Nr." → id, "Handlungsfeld" → handlungsfeld, etc.
   - Abschnitte nach "nach diesem Text, vor dem nächsten"
   - Status-Ableitung aus Bewertung (geplant/in_umsetzung/umgesetzt)

4. **JSON-Schema** für die Transformation definiert

Das Template ist bereit für die Verwendung mit deinen gesplitteten Seiten-Markdown-Dateien. Keine Linter-Fehler gefunden.

---

**User**

Wir haben diese generische Logik für unsere facetten, die müssen wir immer mitführen in den Frontmatter Metaddaten
Und diese nummer ist nicht eine Id, sondern Massnahme_Nr@template-samples/klimamassnahme-detail-de.md @template-samples/pdfanalyse.md 

---

**Cursor**

Hinzufügen der generischen Facetten-Felder und Umbenennen von `id` zu `Massnahme_Nr`.


Hinzufügen der generischen Facetten-Felder und Umbenennen von `id` zu `Massnahme_Nr`.


```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur:

1. Hauptüberschrift (# {{title}})
2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?)
3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext)
4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll)
5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung)
6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik)
7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte)
8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen)
9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder)
10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch)

Formatierungsregeln:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Extrahiere Informationen aus dem Markdown-Text:
- Ignoriere italienische Texte komplett (nur Deutsch verwenden)
- Erkenne Felder anhand der Marker im Text:
  * "Nr." → id
  * "Handlungsfeld" → handlungsfeld
  * "Zuständigkeit" → zustaendigkeit
  * "Vorschlag" + "Anmerkung" → vorschlag_erklaert
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert
  * "Bewertung" → bewertung
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker (z. B. "Vorschlag" bis "Rückmeldung")}}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → id (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Anmerkung" → anmerkung (Text nach "Anmerkung" bis zum nächsten Marker)
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "id": "string (nur Zahl)",
  "title": "string",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "region": "Südtirol",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur:

1. Hauptüberschrift (# {{title}})
2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?)
3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext)
4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll)
5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung)
6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik)
7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte)
8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen)
9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder)
10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch)

Formatierungsregeln:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Extrahiere Informationen aus dem Markdown-Text:
- Ignoriere italienische Texte komplett (nur Deutsch verwenden)
- Erkenne Felder anhand der Marker im Text:
  * "Nr." → id
  * "Handlungsfeld" → handlungsfeld
  * "Zuständigkeit" → zustaendigkeit
  * "Vorschlag" + "Anmerkung" → vorschlag_erklaert
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert
  * "Bewertung" → bewertung
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker (z. B. "Vorschlag" bis "Rückmeldung")}}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Anmerkung" → anmerkung (Text nach "Anmerkung" bis zum nächsten Marker)
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "id": "string (nur Zahl)",
  "title": "string",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "region": "Südtirol",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur:

1. Hauptüberschrift (# {{title}})
2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?)
3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext)
4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll)
5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung)
6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik)
7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte)
8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen)
9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder)
10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch)

Formatierungsregeln:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Extrahiere Informationen aus dem Markdown-Text:
- Ignoriere italienische Texte komplett (nur Deutsch verwenden)
- Erkenne Felder anhand der Marker im Text:
  * "Nr." → id
  * "Handlungsfeld" → handlungsfeld
  * "Zuständigkeit" → zustaendigkeit
  * "Vorschlag" + "Anmerkung" → vorschlag_erklaert
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert
  * "Bewertung" → bewertung
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker (z. B. "Vorschlag" bis "Rückmeldung")}}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Anmerkung" → anmerkung (Text nach "Anmerkung" bis zum nächsten Marker)
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur:

1. Hauptüberschrift (# {{title}})
2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?)
3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext)
4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll)
5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung)
6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik)
7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte)
8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen)
9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder)
10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch)

Formatierungsregeln:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Extrahiere Informationen aus dem Markdown-Text:
- Ignoriere italienische Texte komplett (nur Deutsch verwenden)
- Erkenne Felder anhand der Marker im Text:
  * "Nr." → Massnahme_Nr
  * "Handlungsfeld" → handlungsfeld
  * "Zuständigkeit" → zustaendigkeit
  * "Vorschlag" + "Anmerkung" → vorschlag_erklaert
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert
  * "Bewertung" → bewertung
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker (z. B. "Vorschlag" bis "Rückmeldung")}}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Anmerkung" → anmerkung (Text nach "Anmerkung" bis zum nächsten Marker)
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

Änderungen umgesetzt:

1. **`id` zu `Massnahme_Nr` umbenannt** – im Frontmatter, Systemprompt und JSON-Schema
2. **Generische Facetten-Felder hinzugefügt**:
   - `authors` (string[])
   - `year` (number | null)
   - `region` (string, Standard: "Südtirol")
   - `docType` (string, Standard: "klimamassnahme")
   - `source` (string, Standard: "Stakeholder Forum Klima")
   - `tags` (string[])

3. **Parsing-Regeln erweitert** – Anweisungen für die generischen Felder im Systemprompt ergänzt

4. **JSON-Schema aktualisiert** – alle neuen Felder enthalten

Das Template enthält jetzt die Standard-Facetten und verwendet `Massnahme_Nr` statt `id`. Keine Linter-Fehler gefunden.

---

**User**

Ein mitarbeiter hat diese Massnahmen in eine excel Übertragen und diese zusatzspalten generiert:
Wie könnten wir das in den Metadaten berücksichtigen?
Nummer Vorschlag	Beschreibung Vorschlag	Bewertung Land	Kommentar	Sind Ergebnisse messbar	Liegt die Umsetzung in der Hand der Landesverwaltung?	Sind Maßnahmen mittelfristig umsetzbar	Gibt es ein effektives CO2 Einsparpotential?
344	"Veranstaltungen, die öffentliche Beiträge erhalten, bewerben
eine Anfahrt mit öffentlichen Verkehrsmitteln."	Dieser Vorschlag wird bereits umgesetzt: Die Kritierien der "Green Events" sehen schon die Einbindung der öffentlichen Verkehrsmittel vor.	Green Events sind nur ein Bruchteil der geförderten Veranstaltungen; Dieser Passus sollte aber für ALLE geförderten Veranstaltungen gelten.	Ja, Anzahl der geförderten Veranstaltungen, die Anfahrt mit Öffis bewerben (Ziel 100%)	Ja, Förderkriterien anpassen	Ja	Vermutlich (hängt von Nutzung ab)
348	Bei der Straßeninfrastruktur darf es keine Erhöhung der Verkehrskapazität geben.	Dieser Vorschlag wird bereits umgesetzt: Der Straßenbau verfolgt vorwiegend das Ziel den Bestand zu erhalten und bewohnte Orte vom Verkehr zu entlasten.	Vorwiegend deutet bereits auf eine relevante Abweichung hin. Als Kriterium im Klimaplan bereits enthalten, aber es fehlt an der effektiven Umsetzung. Heir bitte Kontrolle auf Kriterienerfüllung, verbindlich vorschreiben.	Ja, Anzahl geprüfter Straßenprojekte und ergebnisse der Prüfung	Ja	Ja	Nein, aber, jeder weitere Ausbau der straßenkapzität erzeugt direkte und inidrekte CO2-Emissionen, die Einsparung dieser ist nicht messbar, aber schätzbar

---

**Cursor**

Hinzufügen der zusätzlichen Metadaten-Felder aus der Excel-Datei als optionale Felder im Template.


Hinzufügen der zusätzlichen Metadaten-Felder aus der Excel-Datei als optionale Felder.


```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur:

1. Hauptüberschrift (# {{title}})
2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?)
3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext)
4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll)
5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung)
6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik)
7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte)
8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen)
9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder)
10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch)

Formatierungsregeln:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Extrahiere Informationen aus dem Markdown-Text:
- Ignoriere italienische Texte komplett (nur Deutsch verwenden)
- Erkenne Felder anhand der Marker im Text:
  * "Nr." → Massnahme_Nr
  * "Handlungsfeld" → handlungsfeld
  * "Zuständigkeit" → zustaendigkeit
  * "Vorschlag" + "Anmerkung" → vorschlag_erklaert
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert
  * "Bewertung" → bewertung
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker (z. B. "Vorschlag" bis "Rückmeldung")}}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Anmerkung" → anmerkung (Text nach "Anmerkung" bis zum nächsten Marker)
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur:

1. Hauptüberschrift (# {{title}})
2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?)
3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext)
4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll)
5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung)
6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik)
7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte)
8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen)
9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder)
10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch)

Formatierungsregeln:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Extrahiere Informationen aus dem Markdown-Text:
- Ignoriere italienische Texte komplett (nur Deutsch verwenden)
- Erkenne Felder anhand der Marker im Text:
  * "Nr." → Massnahme_Nr
  * "Handlungsfeld" → handlungsfeld
  * "Zuständigkeit" → zustaendigkeit
  * "Vorschlag" + "Anmerkung" → vorschlag_erklaert
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert
  * "Bewertung" → bewertung
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker (z. B. "Vorschlag" bis "Rückmeldung")}}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Anmerkung" → anmerkung (Text nach "Anmerkung" bis zum nächsten Marker)
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "beschreibung_vorschlag": "string | null",
  "bewertung_land": "string | null",
  "kommentar": "string | null",
  "ergebnisse_messbar": "boolean | null",
  "umsetzung_landesverwaltung": "boolean | null",
  "mittelfristig_umsetzbar": "boolean | null",
  "co2_einsparpotential": "string (\"Ja\" | \"Nein\" | \"Vermutlich\") | null",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

```markdown
---
title: {{title|Kurzer, verständlicher Titel für die Bevölkerung (max. 80 Zeichen, ohne Fachjargon)}}
Massnahme_Nr: {{Massnahme_Nr|Nummer der Maßnahme (extraktiv, aus "Nr. XXX" im Markdown-Text; nur Zahl, ohne "Nr.")}}
handlungsfeld: {{handlungsfeld|Handlungsfeld der Maßnahme (extraktiv, aus "Handlungsfeld" im Text; z. B. "Kommunikation und Bewusstseinsbildung")}}
thema: {{thema|Optional: Spezifisches Thema oder Schwerpunkt der Maßnahme (falls im Text erkennbar)}}
quelle: {{quelle|Quelle des Vorschlags (extraktiv: "Vorschlag Klimabürgerrat" oder "Vorschlag Stakeholder Forum Klima")}}
zustaendigkeit: {{zustaendigkeit|Zuständige Stelle (extraktiv, aus "Zuständigkeit" im Text; z. B. "Ressort Umwelt-, Natur- und Klimaschutz")}}
umsetzungsstand: {{umsetzungsstand|Aktueller Umsetzungsstand (extraktiv, aus "Rückmeldung Landesverwaltung"; kurze Zusammenfassung)}}
bewertung: {{bewertung|Bewertung der Maßnahme (extraktiv, aus "Bewertung" im Text; z. B. "Vorschlag bereits in Umsetzung")}}
status: {{status|Status der Maßnahme (geplant | in_umsetzung | umgesetzt; abgeleitet aus Bewertung und Rückmeldung)}}
stand: {{stand|Stand-Datum (extraktiv, aus Dokument; Format YYYY-MM-DD oder null wenn nicht bestimmbar)}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname" wenn möglich; optional, falls im Dokument erkennbar}}
year: {{year|YYYY oder null (extraktiv, aus Dokument oder Stand-Datum)}}
region: {{region|Region/Land; Standard: "Südtirol"}}
docType: {{docType|Eine aus: klimamassnahme, article, report, study, brochure, law, guideline, thesis, press_release, website, other; Standard: "klimamassnahme"}}
source: {{source|Erscheinungsorgan/Medium/Behörde; Standard: "Stakeholder Forum Klima" oder aus Dokument}}
tags: {{tags|Array, normalisiert: lowercase, ASCII, kebab-case, dedupliziert; streng extraktiv (z. B. aus Handlungsfeld, Thema)}}
beschreibung_vorschlag: {{beschreibung_vorschlag|Kurze Beschreibung des Vorschlags (optional, aus externer Quelle wie Excel-Daten)}}
bewertung_land: {{bewertung_land|Bewertung der Landesverwaltung (optional, detaillierter als "bewertung"; aus externer Quelle)}}
kommentar: {{kommentar|Zusätzliche Kommentare oder Notizen (optional, aus externer Quelle)}}
ergebnisse_messbar: {{ergebnisse_messbar|Sind Ergebnisse messbar? (boolean: true | false | null; optional, aus externer Quelle)}}
umsetzung_landesverwaltung: {{umsetzung_landesverwaltung|Liegt die Umsetzung in der Hand der Landesverwaltung? (boolean: true | false | null; optional, aus externer Quelle)}}
mittelfristig_umsetzbar: {{mittelfristig_umsetzbar|Sind Maßnahmen mittelfristig umsetzbar? (boolean: true | false | null; optional, aus externer Quelle)}}
co2_einsparpotential: {{co2_einsparpotential|Gibt es ein effektives CO2 Einsparpotential? (string: "Ja" | "Nein" | "Vermutlich" | null; optional, aus externer Quelle)}}
sprache: de
format: klimamassnahme-detail
---

{{bodyInText|Schreibe einen gut formatierten Markdown-Text für einen öffentlichen Blogartikel zu dieser Klimamaßnahme. Struktur:

1. Hauptüberschrift (# {{title}})
2. Intro (2-3 Sätze: Warum betrifft diese Maßnahme den Alltag? Welches Grundproblem steht dahinter?)
3. Abschnitt "## Worum geht es?" (Ziel der Maßnahme, gesellschaftlicher/klimatischer Kontext)
4. Abschnitt "## Was wird vorgeschlagen?" (konkrete Idee, was geändert werden soll)
5. Abschnitt "## Warum ist diese Maßnahme wichtig?" (Problem, das gelöst wird; langfristige Wirkung)
6. Abschnitt "## Wer ist dafür zuständig?" (öffentliche Stelle, Rolle von Verwaltung/Politik)
7. Abschnitt "## Wie ist der aktuelle Stand?" (geplant/in Umsetzung/umgesetzt; was wurde bereits getan; nächste Schritte)
8. Abschnitt "## Was bringt das konkret?" (Vorteile für Bürger:innen, Gemeinden, Initiativen)
9. Abschnitt "## Beispiele & Inspiration aus der Praxis" (ähnliche Ansätze, erfolgreiche Umsetzung, Vorbilder)
10. Abschnitt "## Wie kann man sich beteiligen oder davon lernen?" (wer kann sich einbringen, wie nutzen/adaptieren, Raum für Austausch)

Formatierungsregeln:
- Absätze max. 4-6 Zeilen
- Keine Aufzählungsorgien, nur wo sinnvoll
- Keine Amtsbegriffe ohne Erklärung
- Keine Zitate aus Verwaltungstexten
- Sprache: klar, ruhig, sachlich, zugänglich
- Perspektive: für die Bevölkerung, nicht für Expert:innen

Extrahiere Informationen aus dem Markdown-Text:
- Ignoriere italienische Texte komplett (nur Deutsch verwenden)
- Erkenne Felder anhand der Marker im Text:
  * "Nr." → Massnahme_Nr
  * "Handlungsfeld" → handlungsfeld
  * "Zuständigkeit" → zustaendigkeit
  * "Vorschlag" + "Anmerkung" → vorschlag_erklaert
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert
  * "Bewertung" → bewertung
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker (z. B. "Vorschlag" bis "Rückmeldung")}}

--- systemprompt
Rolle:
- Du bist eine redaktionelle Autorin bzw. ein redaktioneller Autor für öffentliche Klimakommunikation.
- Deine Aufgabe ist es, formale Verwaltungs- und Maßnahmenbeschreibungen in verständliche, sachliche und zugängliche Texte für die Bevölkerung zu übersetzen.

Arbeitsweise:
- Schreibe klar und ruhig
- Erkläre Zusammenhänge ohne Fachjargon
- Bleibe faktenbasiert und transparent
- Trenne Information von Bewertung
- Vermeide politische Wertungen oder Aktivismus

Ziel:
- Orientierung schaffen
- Vertrauen fördern
- Beteiligung ermöglichen

Zielgruppe:
- interessierte Bürger:innen
- zivilgesellschaftliche Initiativen
- Gemeinden und lokale Akteur:innen

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im Markdown-Text vorkommen. Keine Halluzinationen.
- Ignoriere italienische Texte komplett (nur deutsche Inhalte verwenden).
- Wenn Information nicht sicher vorliegt: gib "" (leere Zeichenkette) oder null zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Parsing-Regeln für Markdown-Quelle:
- Erkenne Felder anhand der im Text vorkommenden Marker:
  * "Nr." → Massnahme_Nr (nur die Zahl extrahieren)
  * "Handlungsfeld" → handlungsfeld (Text nach "Handlungsfeld" bis zum nächsten Marker)
  * "Zuständigkeit" → zustaendigkeit (Text nach "Zuständigkeit" bis zum nächsten Marker)
  * "Vorschlag" → vorschlag_erklaert (Text nach "Vorschlag" bis "Rückmeldung" oder "Bewertung")
  * "Anmerkung" → anmerkung (Text nach "Anmerkung" bis zum nächsten Marker)
  * "Rückmeldung Landesverwaltung" → umsetzungsstand_erklaert (Text nach diesem Marker bis "Bewertung")
  * "Bewertung" → bewertung (Text nach "Bewertung" bis Seitenende)
- Für Abschnitte: Nutze den Text nach einem Marker bis zum nächsten Marker.
- Überschriften im Markdown können unformatiert sein (ohne #), erkenne sie am Textinhalt.
- Seitenmarker ("--- Seite X ---") ignorieren für die Inhalts-Extraktion.
- Generische Felder:
  * authors: Nur wenn im Dokument explizit genannt (z. B. aus Impressum), sonst []
  * year: Aus Stand-Datum ableiten (YYYY) oder null
  * region: Standard "Südtirol" (kann aus Dokument überschrieben werden)
  * docType: Standard "klimamassnahme"
  * source: Standard "Stakeholder Forum Klima" (kann aus Dokument überschrieben werden)
  * tags: Aus Handlungsfeld und Thema ableiten (lowercase, kebab-case, dedupliziert)
- Zusätzliche Metadaten-Felder (optional, können aus externen Quellen wie Excel-Daten ergänzt werden):
  * beschreibung_vorschlag: Kurze Beschreibung des Vorschlags
  * bewertung_land: Detaillierte Bewertung der Landesverwaltung
  * kommentar: Zusätzliche Kommentare oder Notizen
  * ergebnisse_messbar: boolean (true/false/null) - Sind Ergebnisse messbar?
  * umsetzung_landesverwaltung: boolean (true/false/null) - Liegt die Umsetzung in der Hand der Landesverwaltung?
  * mittelfristig_umsetzbar: boolean (true/false/null) - Sind Maßnahmen mittelfristig umsetzbar?
  * co2_einsparpotential: string ("Ja"/"Nein"/"Vermutlich"/null) - Gibt es ein effektives CO2 Einsparpotential?
  * Diese Felder werden NICHT aus dem Markdown-Text extrahiert, sondern müssen aus externen Quellen ergänzt werden (z. B. Excel-Import)

Status-Ableitung:
- status = "geplant" wenn Bewertung "Vorschlag nicht umsetzbar" oder ähnlich
- status = "in_umsetzung" wenn Bewertung "Vorschlag bereits in Umsetzung" oder Rückmeldung "wird bereits umgesetzt"
- status = "umgesetzt" wenn Bewertung "Vorschlag bereits umgesetzt" oder ähnlich
- Fallback: status = "geplant"

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": "string",
  "Massnahme_Nr": "string (nur Zahl)",
  "handlungsfeld": "string",
  "thema": "string | null",
  "quelle": "string",
  "zustaendigkeit": "string",
  "umsetzungsstand": "string",
  "bewertung": "string",
  "status": "geplant" | "in_umsetzung" | "umgesetzt",
  "stand": "string (YYYY-MM-DD) | null",
  "authors": "string[]",
  "year": "number | null",
  "region": "string",
  "docType": "string",
  "source": "string",
  "tags": "string[]",
  "beschreibung_vorschlag": "string | null",
  "bewertung_land": "string | null",
  "kommentar": "string | null",
  "ergebnisse_messbar": "boolean | null",
  "umsetzung_landesverwaltung": "boolean | null",
  "mittelfristig_umsetzbar": "boolean | null",
  "co2_einsparpotential": "string (\"Ja\" | \"Nein\" | \"Vermutlich\") | null",
  "sprache": "de",
  "format": "klimamassnahme-detail",
  "bodyInText": "string (vollständiger Markdown-Body mit allen Abschnitten)"
}

```

Zusätzliche Metadaten-Felder aus der Excel-Datei hinzugefügt:

**Hinzugefügte Felder:**
1. `beschreibung_vorschlag` – Kurze Beschreibung des Vorschlags
2. `bewertung_land` – Detaillierte Bewertung der Landesverwaltung
3. `kommentar` – Zusätzliche Kommentare oder Notizen
4. `ergebnisse_messbar` – Boolean (true/false/null)
5. `umsetzung_landesverwaltung` – Boolean (true/false/null)
6. `mittelfristig_umsetzbar` – Boolean (true/false/null)
7. `co2_einsparpotential` – String ("Ja"/"Nein"/"Vermutlich"/null)

**Wichtige Hinweise:**
- Alle Felder sind optional (können null sein)
- Im Systemprompt dokumentiert: Diese Felder werden nicht aus dem Markdown-Text extrahiert, sondern müssen aus externen Quellen (z. B. Excel-Import) ergänzt werden
- JSON-Schema aktualisiert, um alle neuen Felder zu enthalten

Die Felder können später über einen Excel-Import oder manuelle Eingabe ergänzt werden. Keine Linter-Fehler gefunden.

