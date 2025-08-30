# Optimizing PDF processing and metadata extraction
_Exported on 8/30/2025 at 11:39:22 GMT+2 from Cursor (1.5.5)_

---

**User**

@Überblick über das Common Chat Repository 
So wir haben jetzt von unserem RAG diese Ingestion Pipeline und auch diesen Retriever gebaut. Bevor wir das jetzt noch technisch verbessern möchte ich aber noch an den eigentlichen Quelldaten und an den Pinecone Dokumenten und Metadaten was noch verbessern, um danach auch diesen Workflow zu optimieren, der momentan sehr aufwendig ist. Aber schauen wir uns zuerst noch an, welche Daten wir noch nicht verarbeiten. 
Wie schaut das Markdown-Dokument aus, das uns das Secretary Service liefert, diese PDF-Verarbeitung? Dort möchte ich diese Frontmatter-Metadaten besser berechnen und so formatieren, dass wir sie 1 zu 1 weiterverarbeiten können. 
Da diese Logik von Library zu Library unterschiedlich sein kann, nutzen wir dazu unsere eigene Template-Verwaltung, bei der man ja diese frontmatter.yaml-Parameter bestimmen können. In meinem Library-eigenen Template-Folder erstelle ich so ein PDFAnalyse-Template. Ein Beispiel sehen wir weiter unten - das müssen wir auf unsere Bedürfnisse anpassen.

Wir können dann einfach das von unserem Sekretär Service bereitgestellte Text Transformer Logik nutzen, dieses Context-Features übergeben und das template auswerten. Es müsste sogar innerhalb des PDF Processors automatisch passieren. Das können wir im secretary Service analysieren (github analyse: https://github.com/bCommonsLAB/CommonSecretaryServices - src/processors/pdf_processor.py)
Das heißt, wir können jetzt Kontextinformationen an diese PDF-Processor mitgeben, z.B. die Verzeichnishierarchie, und im Template genau erklären, wie er das analysieren soll. 
Das generierte PDF-Markdown enthält im body diese raw Text gegliedert nach diesen Seitenzahlen und der Frontmatter die Metadaten.

Zur Logik der Verzeichnisstruktur und Dateiname: Bedeutung nach Quelle, Themengebiet und auch Dokumentenart, Erscheinungsjahr, Autor, vielleicht auch Region. Wir haben dann am Ende vielleicht so 7 bis 8 Metadaten, die wir beim Ingestion speichern müssen. 

Beispiel Template pdfanalyse.md:
---
title: {{title|Titel des Dokuments als string}}
shortTitle: {{shortTitlel|kurzer Titel, max. 40 Zeichen, gut lesbar, ohne abschließende Satzzeichen}}
slug: {{slug|nur Kleinbuchstaben, kebab-case, nur ASCII-Zeichen, max. 80 Zeichen; Leerzeichen und doppelte Bindestriche zusammenfassen}}
summary: {{summary|1–2 Sätze, max. 120 Zeichen, neutraler Ton, ohne Anführungszeichen oder Backticks}}
teaser: {{teaser|2–3 Sätze, max.  Zeichen, darf nicht identisch mit summary sein}}
authors: {{authors|Welches sind die Autoren aus dem Text, Komma separiert}}
tags: {{tags|Relevante Tags, Komma separiert,  Leerzeichen und doppelte Bindestriche zusammenfassen}}
---

# {{title|Passenden Berichttitel}}

## Zusammenfassung
{{summary|Kurze Zusammenfassung für eine Präsentation bei Vertriebsleitung}}

--- systemprompt
Du bist ein professioneller Sachbearbeiter und extrem penibel. Du hilfst dabei, aus Vertriebsunterlagen wichtige Informationen zu ziehen, um daraus ein Mengengerüst für ein Angebotslegung als Bericht zu formulieren. Bitte kleingedrucktes genau lesen, Abweichungen von der Norm sind preisrelevant - bitte anmerken. Die Antwort soll möglich kurz und bündig sein, aber schon Spezialitäten erkennen - nichts erfinden!

WICHTIG: Ihre Antwort muss ein gültiges JSON-Objekt sein, bei dem jeder Schlüssel einer Vorlagenvariablen entspricht.


---

**Cursor**

Ich starte mit einer kurzen Bestandsaufnahme: Ich suche zuerst im Code nach der Ingestion-Logik, Frontmatter-Verarbeitung und Pinecone-Metadaten sowie nach einem Beispiel-Output des Secretary Services. Danach skizziere ich eine Template-Struktur und wie Kontext an den PDF-Processor übergeben wird.

Ich suche jetzt gezielt nach dem Webhook/Callback-Fluss vom Secretary Service, wo das generierte Markdown gespeichert und ggf. für Pinecone aufbereitet wird, und prüfe, ob das PDF-Processing die Template-Parameter weiterreicht. Anschließend lese ich die relevanten Dateien parallel.

Ich lese jetzt die relevanten API-Routen, um genau zu sehen, welche Felder wir an den Secretary-Service senden (inkl. Template und Kontext) und wie das Callback die erzeugten Markdown-Dateien speichert und für die Ingestion aufbereitet. Danach schlage ich konkrete Änderungen vor.

Ich habe die Stellen identifiziert, wo das PDF-Markdown entsteht und welche Metadaten aktuell fließen. Kurz: Wir speichern exakt den vom Secretary gelieferten Text als Body und bauen die YAML‑Frontmatter bei uns aus dem vom Secretary gelieferten Metadata‑Objekt zusammen. Ein Template‑Name wird bereits an den Secretary durchgereicht; freier Template‑Inhalt und Kontext werden bei PDF derzeit nicht übergeben.

Überlegungen
- Ziel ist, dass der Secretary bereits „richtige“ Metadaten berechnet (bibliotheksspezifisch) und wir diese 1:1 in die Frontmatter schreiben. Dafür brauchen wir pro Library ein Template inkl. klarer Regeln (Slug, Arrays, Limits) und optional Kontext (Verzeichnisstruktur, Dateiname).
- Technisch ist unser Speicherpfad schon da: Der Webhook nimmt extracted_text und metadata vom Secretary, erzeugt daraus Markdown mit YAML‑Frontmatter und speichert es im Ziel‑Storage. Für Pinecone haben wir eine Stelle, an der wir docMeta als JSON stringifizieren. Wenn wir Frontmatter und docMeta konsistent definieren, kann die Ingestion beide pflegen.
- Lücke: process-pdf reicht aktuell nur den Template‑Namen, nicht „template_content“ oder „context“. Das ist die Stellschraube, um Library‑spezifische Regeln (Ordnerlogik, Dateinamensregeln) schon beim Secretary auswerten zu lassen.

Wo das passiert (Belege aus dem Code)
```72:75:src/app/api/secretary/process-pdf/route.ts
// Template-Option
if (formData.has('template')) {
  serviceFormData.append('template', formData.get('template') as string);
}
```

```225:233:src/app/api/external/jobs/[jobId]/route.ts
const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
  ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
  : extractedText;

const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
```

```913:969:src/lib/transform/transform-service.ts
static createMarkdownWithFrontmatter(content: string, metadata: TransformMetadata): string {
  // Wenn keine Metadaten vorhanden sind, gebe nur den Inhalt zurück
  if (!metadata || Object.keys(metadata).length === 0) {
    return content;
  }
  
  // Erstelle YAML-Frontmatter
  let frontmatter = '---\n';
  // ...
  if (typeof value === 'string') {
    const escapedValue = value.replace(/"/g, '\\"');
    frontmatter += `${key}: "${escapedValue}"\n`;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    frontmatter += `${key}: ${value}\n`;
  } else {
    frontmatter += `${key}: ${JSON.stringify(value)}\n`;
  }
  // ...
  return frontmatter + content;
}
```

```126:133:src/app/api/chat/[libraryId]/upsert-file/route.ts
// Hinweis: Pinecone-Serverless erlaubt nur primitive Metadaten oder List<string>.
// Deshalb serialisieren wir strukturierte Felder als JSON-String.
docMetaJson: docMeta ? JSON.stringify(docMeta) : undefined,
```

Antwort auf „Wie schaut das Markdown-Dokument aus …?“
- Struktur: YAML‑Frontmatter (aus body.data.metadata) + Body = exakt `extracted_text` vom Secretary.
- YAML‑Format: Strings werden gequotet; Zahlen/Booleans nativ; komplexe Objekte als JSON‑String.
- Speicherort/Name: Shadow‑Twin unter demselben Ordner, Dateiname `<original>.<lang>.md`.

Vorschlag für die Frontmatter‑Zielstruktur (7–8 Felder, ingestion‑tauglich)
- title: string
- shortTitle: string (≤40 Zeichen)
- slug: string (lowercase, kebab‑case, ASCII, ≤80)
- summary: string (≤120 Zeichen)
- teaser: string (2–3 Sätze, ≠ summary)
- authors: string[] oder string (kommasepariert; wir können in YAML als Array schreiben)
- tags: string[] (normalisiert: lowercase, kebab‑case)
- docType: string (z. B. report, brochure, study)
- year: number (vierstellig)
- region: string (optional: ISO‑Code oder Klartext)
- sourcePath: string (aus der Verzeichnishierarchie generiert)
- language: string (z. B. de)

Hinweis: Für Pinecone sollten wir parallel `docMeta` spiegeln mit denselben Keys (docMetaJson), damit Filter/Facetten funktionieren.

Beispiel‑Template pdfanalyse.md (Secretary‑Seite, Library‑spezifisch)
- Frontmatter‑Teil (Secretary befüllt Variablen; wir übernehmen 1:1):
```markdown
---
title: {{title|Titel des Dokuments als string}}
shortTitle: {{shortTitle|kurzer Titel, max. 40 Zeichen, ohne Satzzeichen}}
slug: {{slug|nur Kleinbuchstaben, kebab-case, ASCII, max. 80}}
summary: {{summary|1–2 Sätze, max. 120 Zeichen, neutral, ohne Quotes/Backticks}}
teaser: {{teaser|2–3 Sätze, darf nicht identisch mit summary sein}}
authors: {{authors|Autoren im Text, kommasepariert}}
tags: {{tags|Relevante Tags, kommasepariert; normalisiert (lowercase, kebab-case)}}
docType: {{docType|Dokumentenart (report, brochure, study,...)}}
year: {{year|vierstelliges Jahr}}
region: {{region|Region oder Land, falls erkennbar}}
sourcePath: {{sourcePath|aus Verzeichnisstruktur ableiten}}
language: {{language|ISO-2 (de/en)}}
---
```

- Body‑Teil bleibt frei (wir übernehmen Secretary `extracted_text` unverändert). Optional:
```markdown
# {{title|Passender Berichttitel}}

## Zusammenfassung
{{summary|Kurze Zusammenfassung für Management-Präsentation}}

--- systemprompt
Du bist ein penibler Sachbearbeiter ...
WICHTIG: Ihre Antwort muss ein gültiges JSON-Objekt sein, bei dem jeder Schlüssel einer Vorlagenvariablen entspricht.
```

Kontextübergabe an den PDF‑Processor
- Derzeit: process-pdf sendet `template` (Name), aber keinen „template_content“ und keinen Kontext.
- Empfohlen:
  - template_content: Direktes Übergeben des Templates aus dem Library‑Template‑Ordner (falls Secretary das bereits beim Text‑Transformer kann, sollten wir das auch beim PDF‑Processor nutzen).
  - context_json: JSON mit z. B. `{ libraryId, originalFileName, folderPathSegments: [...], inferred: { source, topic, docType? } }`.
  - secretary nutzt dies, um `sourcePath`, `slug`, `tags`, `docType` abzuleiten.

Mapping in unserer Ingestion
- Frontmatter → docMeta: Beim Upsert die Frontmatter 1:1 in `docMeta` übernehmen (bereits vorgesehen via `docMetaJson`).
- Pinecone‑Vektoren: dedizierter Meta‑Vektor enthält `docMetaJson`; Chunk‑Vektoren behalten minimale Felder (user, libraryId, fileId, chunkIndex, text, mode).
- Suche/Filter: Facettierung über year, docType, tags, region; Slug für Deep-Link.

Minimal notwendige Änderungen (ohne Implementierung jetzt)
- API: `process-pdf` um optionale Felder erweitern:
  - `template_content` (string) → an Secretary forwarden.
  - `context_json` (string) → an Secretary forwarden.
  - Optional: `sourceLanguage`.
- UI/Client: Beim Start eines PDF‑Jobs aus Library‑Template‑Ordner `pdfanalyse.md` laden und als `template_content` senden; zusätzlich `context_json` aus Ordnerstruktur/Dateiname generieren.
- Webhook/Markdown: Keine Änderung nötig; wir übernehmen `metadata` → Frontmatter bereits heute korrekt.
- Ingestion: Beim Upsert aus Frontmatter ein `docMeta` bauen (falls nicht bereits im Aufrufer vorhanden) und in `docMetaJson` speichern.

Validierung/Tests (kurz)
- 1 PDF mit Template‑Name (Legacy) → Markdown wird wie bisher erzeugt.
- 1 PDF mit `template_content` + `context_json` → Frontmatter enthält alle Felder korrekt formatiert (Slug, Arrays).
- Upsert eines generierten .md → prüfe, dass `docMetaJson` in Pinecone‑Meta‑Vektor vorhanden ist und filterbar (z. B. year, docType).
- Edge‑Cases: Leere Autoren/Tags → leere Arrays; zu lange Strings → Secretary muss kürzen.

Nächste Schritte
- Soll ich die API‑Route `process-pdf` um `template_content` und `context_json` erweitern und ein kleines Utility schreiben, das `folderPathSegments` für `context_json` aus der aktuellen Library ableitet? Danach können wir ein erstes `pdfanalyse.md`‑Template in den Library‑Ordner legen und mit 1–2 Beispieldateien testen.

Ich habe die relevanten Routen und Services geprüft und die Erzeugungs- und Speicherstelle des PDF‑Markdowns verifiziert. Als Nächstes kann ich die beiden neuen Felder in `process-pdf` ergänzen und eine minimalinvasive Übergabe an den Secretary umsetzen, damit wir die Frontmatter‑Qualität mit Templates und Kontext heben.

```typescript
// Template-Option
if (formData.has('template')) {
  serviceFormData.append('template', formData.get('template') as string);
}
```

```typescript
const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
  ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
  : extractedText;

const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
```

```typescript
static createMarkdownWithFrontmatter(content: string, metadata: TransformMetadata): string {
  // Wenn keine Metadaten vorhanden sind, gebe nur den Inhalt zurück
  if (!metadata || Object.keys(metadata).length === 0) {
    return content;
  }
  
  // Erstelle YAML-Frontmatter
  let frontmatter = '---\n';
  // ...
  if (typeof value === 'string') {
    const escapedValue = value.replace(/"/g, '\\"');
    frontmatter += `${key}: "${escapedValue}"\n`;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    frontmatter += `${key}: ${value}\n`;
  } else {
    frontmatter += `${key}: ${JSON.stringify(value)}\n`;
  }
  // ...
  return frontmatter + content;
}
```

```typescript
// Hinweis: Pinecone-Serverless erlaubt nur primitive Metadaten oder List<string>.
// Deshalb serialisieren wir strukturierte Felder als JSON-String.
docMetaJson: docMeta ? JSON.stringify(docMeta) : undefined,
```

```markdown
---
title: {{title|Titel des Dokuments als string}}
shortTitle: {{shortTitle|kurzer Titel, max. 40 Zeichen, ohne Satzzeichen}}
slug: {{slug|nur Kleinbuchstaben, kebab-case, ASCII, max. 80}}
summary: {{summary|1–2 Sätze, max. 120 Zeichen, neutral, ohne Quotes/Backticks}}
teaser: {{teaser|2–3 Sätze, darf nicht identisch mit summary sein}}
authors: {{authors|Autoren im Text, kommasepariert}}
tags: {{tags|Relevante Tags, kommasepariert; normalisiert (lowercase, kebab-case)}}
docType: {{docType|Dokumentenart (report, brochure, study,...)}}
year: {{year|vierstelliges Jahr}}
region: {{region|Region oder Land, falls erkennbar}}
sourcePath: {{sourcePath|aus Verzeichnisstruktur ableiten}}
language: {{language|ISO-2 (de/en)}}
---
```

```markdown
# {{title|Passender Berichttitel}}

## Zusammenfassung
{{summary|Kurze Zusammenfassung für Management-Präsentation}}

--- systemprompt
Du bist ein penibler Sachbearbeiter ...
WICHTIG: Ihre Antwort muss ein gültiges JSON-Objekt sein, bei dem jeder Schlüssel einer Vorlagenvariablen entspricht.
```

---

**User**

Ok, es gäbe noch eine alternative Logik, indem wir unsere jetzige Kapitalanalyse, wo wir ja den gesamten Text als Kontext verwenden, und dann diese strukturierten Output generieren, ob wir ja nicht diesen Large Language Call, der ja auch sehr rechenintensiv ist, nutzen, um diese Metadaten zu berechnen. Und wir könnten dazu den im Secretary Service angebotenen Text Transformer verwenden, der ja auch auf Template Basis funktioniert, und damit mit einem, mit einer Klappe, mit einem Schlag, sowohl diese Metadaten berechnen, als auch diese Kapitelgliederung berechnen, und das mit einem Template, das wir pro Library anpassen können. So hätten wir minimale LLM Calls und die größte Flexibilität durch anpassbare Templates. Könnten, wäre das nicht auch eine Lösung?

---

**Cursor**

Kurz: Ja, das ist eine valide Lösung – und sogar preferiert. Ein einzelner, template‑basierter Transformer‑Call kann sowohl die Frontmatter‑Metadaten als auch die Kapitelgliederung liefern und damit eure aktuelle, teurere Mehrfach‑LLM‑Analyse ersetzen. Das passt zu eurer RAG‑Architektur mit Kapitel‑Summaries für Vector Search und Fulltext für Kontext [[memory:5008426]].

### Varianten
- Variante A: Ein Request (PDF‑Processor mit Template)
  - Wenn der Secretary PDF‑Processor `template`/`template_content` und optional `context_json` unterstützt, berechnet er beim Extrahieren direkt Frontmatter + Kapitel. Wir speichern anschließend das Markdown und upserten Metadaten/Kapitel.
  - Änderung bei uns: in `POST /api/secretary/process-pdf` zusätzlich `template_content` und `context_json` durchreichen; Webhook verarbeitet Chapters.

- Variante B: Zwei Schritte, aber nur 1 LLM‑Call
  - 1) PDF‑Extractor (ohne LLM) liefert `extracted_text`.
  - 2) `POST /api/secretary/transformer/template` mit vollem Text + `template_content` + `context_json` erzeugt Frontmatter + Kapitel.
  - Vorteil: Sofort umsetzbar, weil `process-text` bereits existiert; robust, falls der PDF‑Processor Templates (noch) nicht voll unterstützt.

- Variante C: In‑App LLM (wie bisher) mit vollem Kontext
  - Möglich, aber rechenintensiver und weniger standardisiert; ich würde A/B vorziehen.

### Technische Einbindung (konkret, minimalinvasiv)
- API-Erweiterung
  - `src/app/api/secretary/process-pdf/route.ts`: optionale Felder `template_content` und `context_json` an den Secretary weiterleiten. Aktuell leiten wir nur `template` durch.
  - Fallback: Wenn `template_content` gesetzt ist, hat es Vorrang vor `template`.
- Orchestrierung
  - Variante B sofort: Im Webhook nach Erhalt von `extracted_text` einen internen Follow‑Up‑Call an `transformer/template` auslösen (einmalig, mit Library‑Template + Kontext). Ergebnis: JSON mit
    - frontmatter: { title, shortTitle, slug, summary, teaser, authors[], tags[], docType, year, region, sourcePath, language }
    - chapters: [{ chapterId, title, order, summary, keywords[] }]
  - Markdown speichern: Frontmatter 1:1 übernehmen, Body = Original `extracted_text`.
- Pinecone-Ingestion
  - Meta‑Vektor bekommt `docMetaJson` (Frontmatter 1:1). Kapitel‑Summaries als eigene Vektoren (Retriever‑Ziel). Volltext wie bisher in Chunks (Such‑Kontext).
- Kontextübergabe
  - `context_json`: Verzeichnis‑Segmente, Dateiname, abgeleitete Felder (Quelle/Thema/Dokumentenart/Jahr/Autor/Region), damit das Template deterministisch normalisiert (kebab‑case Slug, Tag‑Normalisierung, Längenlimits).

### Vorteile
- Ein LLM‑Call pro Dokument, hohe Template‑Flexibilität pro Library, deterministische Normalisierung, direkte Weiterverarbeitung ohne Post‑Heuristiken.

### Risiken/Begrenzungen
- Sehr lange PDFs: Prüfen, ob der Transformer im Secretary Service das komplette `extracted_text` skaliert. Sonst fallback: Grob‑Chunking mit „map‑reduce“ im Template (nur falls nötig).
- Template‑Disziplin: Strikte JSON‑Ausgabe sicherstellen (der Secretary‑Template‑Runner kann das, bitte „Antwort muss gültiges JSON…“ weiter nutzen).

### Tests (kurz)
- Kleines PDF: Template‑Name vs. `template_content` + `context_json` vergleichen; Frontmatter‑Felder validieren (Slug, Authors[], Tags[], Year).
- Webhook‑Speicherung: .md entsteht mit Frontmatter; Kapitel‑Summaries upserted.
- Pinecone‑Filter: Query nach `docType=report AND year=2024` funktioniert via `docMetaJson`.

Sollen wir Variante B sofort implementieren (keine Abhängigkeit am Secretary PDF‑Processor) und parallel Variante A aktivieren, indem wir `template_content`/`context_json` im PDF‑Proxy durchreichen?

---

**User**

Ich würde auch Variante B vorziehen, da wir vielleicht abhängig davon, was im extrahierten Text steht, unterschiedliche Templates dann verwenden können. Zum Beispiel können wir vielleicht schon erkennen, ob der Text sehr lang ist oder viele Seiten hat oder nur ein kurzer Text ist. Oder da hätten wir dann mehr Varianten. Mit einer bestimmten Heuristik könnten wir dann Texte gezielt auswerben.

---

**Cursor**

Ja, Variante B ist genau dafür geeignet. Einmal extrahieren (ohne LLM), danach genau ein Transformer‑Call mit Bibliotheks‑Template und Kontext – damit können wir per Heuristik das passende Template wählen und in einem Rutsch Frontmatter‑Metadaten und Kapitel liefern. Das passt auch zu eurer RAG‑Architektur mit Kapitel‑Summaries und Full‑Markdown [[memory:5008426]].

### Vorschlag: Heuristik + Templates
- Heuristik-Eingaben:
  - text_length (Zeichen), page_count (falls vom PDF‑Extractor verfügbar), language_guess, file_name, folder_path_segments.
- Template‑Auswahl (Beispiele):
  - long vs. short: text_length > 60k oder page_count > 30 → `pdfanalyse_long.md`; sonst `pdfanalyse_short.md`.
  - domain‑spezifisch: Keywords/RegEx (z. B. „Angebot“, „Leistungsbeschreibung“) → `pdfanalyse_offer.md`.
  - fallback: `pdfanalyse_default.md`.
- Kontextübergabe an den Transformer:
  - `context_json`: `{ libraryId, fileName, folderSegments, languageGuess, heuristics: { pageCount, textLength }, inferred: { source, topic, docType? } }`.

### Datenfluss (Variante B)
1) PDF‑Extractor liefert `extracted_text` (keine LLM‑Kosten).
2) Interner Folgeschritt: `transformer/template` mit
   - `text`: `extracted_text`
   - `template_content` (aus Library‑Template‑Ordner per Heuristik gewählt)
   - `context_json`
3) Transformer‑Antwort (valide JSON‑Objekte) enthält:
   - Frontmatter‑Felder: `title, shortTitle, slug, summary, teaser, authors[], tags[], docType, year, region, sourcePath, language` (ggf. weitere).
   - `chapters[]`: `[{ chapterId, title, order, summary, keywords[] }]`.
4) Speicherung:
   - Markdown = Frontmatter (1:1 aus JSON) + Original‑Body (`extracted_text`).
   - Kapitel‑Summaries separat in Pinecone upserten (Retriever‑Ziel).
   - Meta‑Vektor: `docMetaJson` = Frontmatter (1:1) für Filter/Facetten.

### Minimalinvasive Umsetzung (serverseitig)
- Webhook (`src/app/api/external/jobs/[jobId]/route.ts`), sobald `extracted_text` vorliegt:
  - Heuristik-Funktion: bestimmt Template‑Datei aus Library‑Template‑Ordner und baut `context_json`.
  - Aufruf Secretary Transformer: POST `/transformer/template` mit `template_content` + `context_json`.
  - Validierung: JSON strikt prüfen; Feldlängen/Slug normalisieren, falls nötig.
  - Markdown bauen und speichern (bestehende `TransformService.createMarkdownWithFrontmatter` nutzen).
  - Kapitel‑Summaries upserten (existierende Upsert‑Route/Logik weiterverwenden).
- Optional: `process-pdf` lässt man unverändert; spätere Optimierung möglich.

### Beispiel-Heuristik (kurz)
```ts
function chooseTemplate(meta: { textLength: number; pageCount?: number; fileName: string; folderSegments: string[] }): string {
  if ((meta.pageCount ?? 0) > 30 || meta.textLength > 60000) return 'pdfanalyse_long.md';
  if (/\bangebot|ausschreibung|leistungsbeschreibung\b/i.test(meta.fileName)) return 'pdfanalyse_offer.md';
  return 'pdfanalyse_short.md';
}
```

### Tests
- Kurzes PDF: erwartet `pdfanalyse_short.md`; Frontmatter‑Felder gesetzt; Kapitel 3–8 Einträge.
- Langes PDF: `pdfanalyse_long.md`; Kapitel‑Summaries chunk‑freundlich; Pinecone‑Meta enthält `docMetaJson`.
- Edge‑Cases: Keine Autoren/Tags → leere Arrays; Slug ≤80, ASCII, kebab‑case; year vierstellig.

Soll ich die Heuristik + den internen Transformer‑Schritt im Webhook implementieren (Variante B), inkl. Laden eines Library‑Templates (`pdfanalyse_*.md`) und Übergabe von `context_json`?

```typescript
function chooseTemplate(meta: { textLength: number; pageCount?: number; fileName: string; folderSegments: string[] }): string {
  if ((meta.pageCount ?? 0) > 30 || meta.textLength > 60000) return 'pdfanalyse_long.md';
  if (/\bangebot|ausschreibung|leistungsbeschreibung\b/i.test(meta.fileName)) return 'pdfanalyse_offer.md';
  return 'pdfanalyse_short.md';
}
```

---

**User**

Nein, ich möchte... das lassen wir für uns für die Zukunft offen. Momentan möchte ich eigentlich nur eine sehr einfache Anwendung. Das heißt, ich habe ein Template pro Library, das ich definiere. Welches Template er verwendet, sollte in Chat Settings gespeichert oder auswählbar sein. Dieses Template verwenden wir jetzt mal als nachgelagerten Transformer zur Berechnung der FrontMatter Metadaten. Schauen wir mal bei einigen Dokumenten, wie das funktioniert. Und können uns danach das noch vielleicht verfeinern. Auf alle Fälle sollten diese Kapitelstruktur, die Summaries der Kapitel, aber auch dieser Kurztext für das Gesamtdokument, auch in dem FrontMatter von diesem BDF Markdown gespeichert sein. Pinecone ist für mich nur eine Zweitverwertung. Da... keep the human in the loop, ich als Anwender nochmal die Möglichkeit habe, das zu kontrollieren. Und Ähnliches zu korrigieren.

---

**Cursor**

Ich erstelle eine kurze To-Do-Liste für diese Variante-B-Implementierung und lese parallel die relevanten Stellen für Library-/Chat-Settings und Templates, um minimalinvasive Änderungen umzusetzen. Danach erweitere ich den Webhook um den Transformer-Aufruf mit Template-Content.

Ich suche jetzt parallel nach den Einstellungsquellen für Chat/Library (wo wir das Template referenzieren können) und nach vorhandenen Template-Ladefunktionen, um minimale Änderungen zu planen. Danach erweitere ich den Webhook schrittweise.

Ich markiere die Aufgaben "Template-Auswahl in Chat/Library-Settings ermitteln (Schlüssel/Ort)" als erledigt und setze "Webhook erweitert: Nach extracted_text Transform-Aufruf mit template_content" auf in Arbeit. Ich erweitere dann den Webhook `src/app/api/external/jobs/[jobId]/route.ts`, um nach `extracted_text` den Secretary Transformer mit dem pro Library definierten Template aufzurufen, das Ergebnis robust zu parsen und die Frontmatter (inkl. summary und chapters) im Markdown zu speichern.

Ich suche jetzt die Normalisierung der Chat-Konfiguration, um zu sehen, wo wir ein Feld für das Template pro Library ergänzen/auslesen können. Danach plane ich, im Webhook das Template aus ctx.chat zu lesen und den Transformer aufzurufen.

Ich erweitere jetzt den Webhook in `src/app/api/external/jobs/[jobId]/route.ts`, um nach Erhalt von `extracted_text` das Library-Template (`/templates/pdfanalyse.md` oder das in `chat.transformerTemplate`) zu laden, den Secretary-Transformer mit `template_content` aufzurufen und die daraus resultierenden Metadaten als Frontmatter (inkl. summary und chapters) im Markdown zu speichern. Danach prüfe ich Linter-Hinweise.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import type { Library } from '@/types/library';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

interface OneDriveAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

async function ensureOneDriveAccessToken(lib: Library): Promise<string> {
  const cfg = lib.config as unknown as OneDriveAuthConfig | undefined;
  const accessToken = cfg?.accessToken as string | undefined;
  const refreshToken = cfg?.refreshToken as string | undefined;
  const tokenExpiry = Number(cfg?.tokenExpiry || 0);
  const isExpired = !tokenExpiry || Date.now() / 1000 > tokenExpiry - 60;

  if (accessToken && !isExpired) return accessToken;
  if (!refreshToken) throw new Error('OneDrive Refresh-Token fehlt in der Library-Konfiguration');

  const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')}/api/auth/onedrive/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryId: lib.id, refreshToken })
  });
  if (!resp.ok) throw new Error(`OneDrive Token-Refresh fehlgeschlagen (${resp.status})`);
  const data = await resp.json();
  return data.accessToken as string;
}

async function onedriveUploadFile(accessToken: string, parentId: string, name: string, mime: string, buffer: Buffer): Promise<{ id: string }> {
  const base = parentId === 'root'
    ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(name)}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(name)}:/content`;
  let url = `${base}?@microsoft.graph.conflictBehavior=replace`;
  let res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  if (res.status === 409) {
    url = `${base}?@microsoft.graph.conflictBehavior=rename`;
    res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  }
  if (!res.ok) throw new Error(`OneDrive Upload fehlgeschlagen: ${res.status}`);
  const json: unknown = await res.json();
  return { id: (json as { id?: string }).id as string };
}

// onedriveEnsureFolder wurde entfernt, da nicht verwendet

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(_request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (job.userEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optional: Nur letzte N Logs zurückgeben via ?limit=...
    // Query-Params sind in App Router bei Route Handlern nicht direkt verfügbar ohne request.url zu parsen
    const url = new URL(_request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : undefined;
    const buffered: Array<Record<string, unknown>> = [];
    const persisted = Array.isArray(job.logs) ? job.logs : [];
    const merged = [...persisted, ...buffered];
    const logs = limit ? merged.slice(-limit) : merged;

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      worker: job.worker,
      operation: job.operation,
      processId: job.processId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      logs,
      result: job.result,
    });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const body = await request.json();

    // Token kann im Body, im X-Callback-Token-Header oder als Bearer kommen
    let callbackToken: string | undefined = body?.callback_token;
    if (!callbackToken) {
      const headerToken = request.headers.get('x-callback-token') || request.headers.get('X-Callback-Token');
      if (headerToken) callbackToken = headerToken;
    }
    if (!callbackToken) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) callbackToken = authHeader.substring('Bearer '.length);
    }
    if (!callbackToken) return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    const tokenHash = repo.hashSecret(callbackToken);
    if (tokenHash !== job.jobSecretHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);

    // Progress-Handling
    const progressValue = typeof body?.progress === 'number'
      ? body.progress
      : typeof body?.data?.progress === 'number'
        ? body.data.progress
        : typeof body?.percent === 'number'
          ? body.percent
          : typeof body?.data?.percent === 'number'
            ? body.data.percent
            : undefined;
    const phase = (typeof body?.phase === 'string' && body.phase) || (typeof body?.data?.phase === 'string' && body.data.phase) || undefined;
    const message = (typeof body?.message === 'string' && body.message) || (typeof body?.data?.message === 'string' && body.data.message) || undefined;

    const hasError = !!body?.error;
    const hasFinalPayload = !!(body?.data?.extracted_text || body?.data?.images_archive_url || body?.status === 'completed');

    if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
      // Watchdog heartbeat
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
      FileLogger.info('external-jobs', 'Progress-Event', {
        jobId,
        phase: phase || 'progress',
        progress: progressValue,
        message
      });
      // Push-Event für UI (SSE)
      getJobEventBus().emitUpdate(job.userEmail, {
        type: 'job_update',
        jobId,
        status: 'running',
        phase: phase || 'progress',
        progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined,
        message,
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: job.correlation?.source?.name,
      });
      return NextResponse.json({ status: 'ok', jobId, kind: 'progress' });
    }

    if (hasError) {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', details: body.error });
      // Bei Fehler: gepufferte Logs persistieren
      const buffered = drainBufferedLogs(jobId);
      for (const entry of buffered) {
        await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
      }
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveUrlFromWorker: string | undefined = body?.data?.images_archive_url;

    if (!extractedText && !imagesArchiveUrlFromWorker) {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    let savedItemId: string | undefined;
    const savedItems: string[] = [];

    if (lib && extractedText) {
      if (lib.type === 'local') {
        const provider = new FileSystemProvider(lib.path);
        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';
        // Pfade nur bei Bedarf auflösen (derzeit nicht benötigt)
        // await provider.getPathById(sourceId ?? '').catch(() => undefined);
        // await provider.getPathById(targetParentId).catch(() => '/');
        // Pfade ermitteln (aktuell nur für Debugging/Logging nutzbar)
        // const sourceAbsPath = sourceRelPath und targetAbsPath aktuell ungenutzt

        // 1) Optionalen Template-Content laden (aus /templates oder per Chat-Setting 'transformerTemplate')
        let metadataFromTemplate: Record<string, unknown> | null = null;
        try {
          // Bevorzugter Template-Name aus Chat-Config (falls vorhanden)
          const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
          // Templates-Ordner im Root suchen
          const rootItems = await provider.listItemsById('root');
          const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'));
          if (templatesFolder) {
            const tplItems = await provider.listItemsById(templatesFolder.id);
            // Auswahllogik: bevorzugt preferredTemplate, sonst 'pdfanalyse.md', sonst erstes .md
            const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase()));
            const byPreferred = preferredTemplate ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`) : undefined;
            const byDefault = pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md');
            const anyMd = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
            const chosen = byPreferred || byDefault || anyMd;
            if (chosen) {
              const bin = await provider.getBinary(chosen.id);
              const templateContent = await bin.blob.text();
              // 2) Secretary Transformer mit template_content aufrufen
              const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
              const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
              const fd = new FormData();
              fd.append('text', extractedText);
              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              fd.append('target_language', lang);
              fd.append('template_content', templateContent);
              fd.append('use_cache', 'false');
              const headers: Record<string, string> = { 'Accept': 'application/json' };
              const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
              if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
              const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
              const data: unknown = await resp.json().catch(() => ({}));
              if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
                metadataFromTemplate = data as Record<string, unknown>;
                bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' });
              } else {
                bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' });
              }
            } else {
              bufferLog(jobId, { phase: 'template_missing', message: 'Kein Template gefunden' });
            }
          } else {
            bufferLog(jobId, { phase: 'templates_folder_missing', message: 'Ordner /templates nicht gefunden' });
          }
        } catch {
          bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation' });
        }

        // 3) Frontmatter-Metadaten bestimmen (Template bevorzugt, sonst Worker-Metadaten)
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };

        // 4) Markdown mit Frontmatter erzeugen (Body = Originaltext)
        const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, finalMeta)
          : extractedText;

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        const saved = await provider.uploadFile(targetParentId, file);
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              try {
                archiveUrl = new URL(imagesArchiveUrlFromWorker, baseRaw).toString();
              } catch {
                const base = baseRaw.replace(/\/$/, '');
                const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
                archiveUrl = base.endsWith('/api') && rel.startsWith('/api/')
                  ? `${base}${rel.substring(4)}`
                  : `${base}${rel}`;
              }
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              // Markiere Job als fehlgeschlagen und beende
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) {
                await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              }
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            } else {
              const arrayBuf = await resp.arrayBuffer();
              const base64Zip = Buffer.from(arrayBuf).toString('base64');
              const originalItemForImages = {
                id: sourceId || 'unknown',
                parentId: targetParentId,
                type: 'file' as const,
                metadata: {
                  name: job.correlation.source?.name || 'source.pdf',
                  size: 0,
                  modifiedAt: new Date(),
                  mimeType: job.correlation.source?.mimeType || 'application/pdf',
                },
              };
              const textContents = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
              const imageResult = await ImageExtractionService.saveZipArchive(
                base64Zip,
                'images.zip',
                originalItemForImages,
                provider,
                async (folderId: string) => provider.listItemsById(folderId),
                extractedText,
                lang,
                textContents
              );
              for (const it of imageResult.savedItems) savedItems.push(it.id);
              bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            // Markiere Job als fehlgeschlagen und beende
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) {
              await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            }
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
        }
      } else if (lib && lib.type === 'onedrive') {
        const accessToken = await ensureOneDriveAccessToken(lib);
        const targetParentId = job.correlation?.source?.parentId || 'root';
        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;
        const md = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
          : extractedText;
        const contentBuffer = Buffer.from(md, 'utf8');
        const saved = await onedriveUploadFile(accessToken, targetParentId, uniqueName, 'text/markdown', contentBuffer);
        savedItemId = saved.id;
        savedItems.push(saved.id);

        bufferLog(jobId, { phase: 'stored_cloud', message: 'Shadow‑Twin gespeichert' });

        // Bilder nicht mehr vom Webhook-ZIP extrahieren – Link wird bereitgestellt
      }
    }

    await repo.setStatus(jobId, 'completed');
    clearWatchdog(jobId);
    // gepufferte Logs persistieren
    const buffered = drainBufferedLogs(jobId);
    for (const entry of buffered) {
      await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
    }
    await repo.setResult(jobId, {
      extracted_text: extractedText,
      images_archive_url: imagesArchiveUrlFromWorker || undefined,
      metadata: body?.data?.metadata,
    }, { savedItemId, savedItems });

    // Finalen Logeintrag für den sichtbaren Verlauf hinzufügen
    await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });

    FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
    return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}



```

Ich habe den Webhook so erweitert, dass nach der PDF-Extraktion genau ein nachgelagerter Transformer-Call mit dem Bibliotheks-Template ausgeführt wird. Das erzeugte JSON wird 1:1 als Frontmatter übernommen; Body bleibt der Original-Text. Fallback-Logik und Logging sind drin.

Was jetzt funktioniert
- Ein Template pro Library: Es wird aus dem Library‑Ordner `/templates` geladen.
  - Priorität: `config.chat.transformerTemplate` (optional) → `pdfanalyse.md` → erstes `.md` in `/templates`.
- Nach Erhalt von `extracted_text` wird `transformer/template` mit `template_content` aufgerufen.
- Antwort muss ein valides JSON sein; wir schreiben die Schlüssel 1:1 in die Frontmatter (inkl. `summary`, `chapters`), dann den Original‑Text als Markdown‑Body.

Wie du es jetzt nutzt
1) Lege in der aktiven Library einen Ordner `templates` an und füge `pdfanalyse.md` hinein.
2) Inhalt (kurzes Beispiel, frei anpassbar):
```markdown
---
title: {{title|Titel}}
shortTitle: {{shortTitle|kurzer Titel ≤40}}
slug: {{slug|kebab-case, ASCII, ≤80}}
summary: {{summary|1–2 Sätze, ≤120}}
teaser: {{teaser|2–3 Sätze, ≠ summary}}
authors: {{authors|Autoren, kommasepariert}}
tags: {{tags|Tags, kommasepariert}}
docType: {{docType|report|study|...}}
year: {{year|YYYY}}
region: {{region|Region/Land}}
language: {{language|de|en}}
chapters: {{chapters|Liste von Kapiteln mit title, order, summary, keywords}}
---
```
Am Ende des Templates den Systemprompt mit „Antwort muss gültiges JSON‑Objekt sein“.

3) Optional: Wenn du einen anderen Dateinamen willst, trage ihn (vorerst manuell) in `library.config.chat.transformerTemplate` ein. Sonst wird automatisch `pdfanalyse.md` genommen.

Test (human in the loop)
- Lade ein PDF wie gewohnt. Es entsteht ein `.md` mit Frontmatter und Original‑Text.
- Prüfe in der Markdown‑Datei:
  - `summary` (Kurztext fürs Gesamtdokument)
  - `chapters` (Struktur + Summaries)
  - weitere Felder (title, slug, tags, year, …)
- Korrigiere bei Bedarf das Frontmatter direkt im Markdown. Pinecone ist erst „Zweitverwertung“, d. h. du kannst nach Sichtung manuell anpassen.

Hinweise
- Wenn der Transformer kein valides JSON liefert, fällt die Verarbeitung kontrolliert zurück; das siehst du in den Job‑Logs als `transform_meta_failed`.
- UI‑Einstellung „Template wählen“ ist noch nicht verdrahtet. Aktuell: Standard `pdfanalyse.md` oder `config.chat.transformerTemplate`.

Nächste sinnvolle, kleine Schritte
- Template‑Auswahl in den Chat‑Settings ergänzen (ein Select auf die Dateien in `/templates`).
- Mini‑Dokumentation mit Beispiel‑Template pro Library.

- Ich habe „Webhook erweitert …“ abgeschlossen und arbeite als Nächstes an „Frontmatter-Integration: summary, chapters“. Wenn du mir 1–2 Beispiel‑PDFs gibst, verifiziere ich das Verhalten zügig.

Kurzfassung der Änderungen
- Webhook `src/app/api/external/jobs/[jobId]/route.ts`: Nach `extracted_text` rufen wir `transformer/template` mit `template_content` aus `/templates` (oder `chat.transformerTemplate`) auf und schreiben das Ergebnis als Frontmatter in die erzeugte `.md`.

```markdown
---
title: {{title|Titel}}
shortTitle: {{shortTitle|kurzer Titel ≤40}}
slug: {{slug|kebab-case, ASCII, ≤80}}
summary: {{summary|1–2 Sätze, ≤120}}
teaser: {{teaser|2–3 Sätze, ≠ summary}}
authors: {{authors|Autoren, kommasepariert}}
tags: {{tags|Tags, kommasepariert}}
docType: {{docType|report|study|...}}
year: {{year|YYYY}}
region: {{region|Region/Land}}
language: {{language|de|en}}
chapters: {{chapters|Liste von Kapiteln mit title, order, summary, keywords}}
---
```

---

**User**

In unserem Template können wir diese metradaten genauer formulieren und auch diese Systempromt formulieren. Wir haben da ja kürzlich dieses Capital Analyzer programmiert. Mit einer sehr präzisen Formulierung können wir daraus was für unser Template übernehmen?

aktuelles Template:
---
title: {{title|Titel}}
shortTitle: {{shortTitle|kurzer Titel ≤40}}
slug: {{slug|kebab-case, ASCII, ≤80}}
summary: {{summary|1–2 Sätze, ≤120}}
teaser: {{teaser|2–3 Sätze, ≠ summary}}
authors: {{authors|Autoren, kommasepariert}}
tags: {{tags|Tags, kommasepariert}}
docType: {{docType|report|study|...}}
year: {{year|YYYY}}
region: {{region|Region/Land}}
language: {{language|de|en}}
chapters: {{chapters|Liste von Kapiteln mit title, order, summary, keywords}}
---

--- systemprompt
Du bist ein professioneller Sachbearbeiter und extrem penibel. Du hilfst dabei, aus Vertriebsunterlagen wichtige Informationen zu ziehen, um daraus ein Mengengerüst für ein Angebotslegung als Bericht zu formulieren. Bitte kleingedrucktes genau lesen, Abweichungen von der Norm sind preisrelevant - bitte anmerken. Die Antwort soll möglich kurz und bündig sein, aber schon Spezialitäten erkennen - nichts erfinden!

WICHTIG: Ihre Antwort muss ein gültiges JSON-Objekt sein, bei dem jeder Schlüssel einer Vorlagenvariablen entspricht.

---

**Cursor**

Ja. Wir übernehmen die strikten, extraktiven Regeln aus eurer Kapitel‑Analyse und bauen sie in ein präzises Template + Systemprompt ein. So erzwingen wir: keine Halluzinationen, klare Längenlimits, saubere Normalisierung (Slug/Tags), valide JSON‑Antwort. Hier ist ein überarbeitetes Template für `pdfanalyse.md`, das Frontmatter, Kapitelstruktur und einen präzisen Systemprompt enthält.

```markdown
---
title: {{title|Vollständiger Titel des Dokuments (string)}}
shortTitle: {{shortTitle|Kurzer Titel ≤40 Zeichen, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute/Diakritika normalisieren; max 80; keine doppelten Bindestriche}}
summary: {{summary|1–2 Sätze, ≤120 Zeichen, neutral, nur aus Text extrahiert}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, prägnant, extraktiv}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname“ wenn möglich}}
tags: {{tags|Array relevanter Tags, normalisiert: lowercase, ASCII, kebab-case, dedupliziert}}
docType: {{docType|Eine aus: report, study, brochure, offer, contract, manual, law, guideline, other}}
year: {{year|Vierstelliges Jahr als number; wenn unbekannt: null}}
region: {{region|Region/Land aus Text; wenn unbekannt: ""}}
language: {{language|Dokumentsprache, z. B. "de" oder "en"}}
chapters: {{chapters|Array von Kapiteln mit title, level (1..3), order (int, 1-basiert), startEvidence (≤160), summary (≤1000, extraktiv), keywords (5–12)}}
toc: {{toc|Optionales Array von { title, page?, level? }, nur wenn explizit im Text erkennbar}}
---

# {{title|Dokumenttitel}}

## Zusammenfassung
{{summary|Kurzfassung für Management/Vertrieb}}

--- systemprompt
Rolle:
- Du bist ein penibler, rein EXTRAKTIVER Sachbearbeiter. Du liest Kleingedrucktes genau. Abweichungen von der Norm sind preisrelevant – knapp anmerken, aber nichts erfinden.

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im gelieferten Text vorkommen. Keine Halluzinationen.
- Wenn eine geforderte Information im Text nicht sicher vorliegt: gib "" (leere Zeichenkette) bzw. null (für year) zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Format-/Normalisierungsregeln:
- shortTitle: ≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen.
- slug: ASCII, lowercase, kebab-case, max 80, Diakritika/Um­laute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss), mehrere Leerzeichen/Bindestriche zu einem Bindestrich zusammenfassen.
- summary: 1–2 Sätze, ≤120 Zeichen, neutraler Ton, extraktiv.
- teaser: 2–3 Sätze, nicht identisch zu summary, extraktiv.
- authors: Array von Strings, dedupliziert. Format „Nachname, Vorname“ wenn eindeutig ableitbar.
- tags: Array von Strings; normalisieren (lowercase, ASCII, kebab-case), deduplizieren; nur, wenn klar aus Text ableitbar.
- docType: klassifiziere streng nach Textsignalen in { report, study, brochure, offer, contract, manual, law, guideline }; wenn unklar: "other".
- year: vierstelliges Jahr als number; nur übernehmen, wenn eindeutig (z. B. „Copyright 2024“, „Stand: 2023“).
- region: aus Text (z. B. Länder/Bundesländer/Regionen); sonst "".
- language: bestmögliche Schätzung (z. B. "de", "en") anhand des Textes.

Kapitelanalyse (extraktiv, inspiriert Capital Analyzer):
- Erkenne echte Kapitel-/Unterkapitelstarts (Level 1..3), nur wenn sie im Text vorkommen.
- Für JEDES Kapitel liefere:
  - title (string)
  - level (1..3)
  - order (integer, 1-basiert, in Dokumentreihenfolge)
  - startEvidence (string, ≤160 Zeichen, GENAUES Textfragment vom Kapitelanfang)
  - summary (string, ≤1000 Zeichen, extraktiv: nur Inhalte bis zum nächsten Kapitelstart)
  - keywords (Array mit 5–12 kurzen Stichwörtern; extraktiv/nahe am Wortlaut)
- toc (optional): Liste von { title, page?, level? } nur, wenn explizit als Inhaltsverzeichnis erkennbar; Titel müssen existierenden Kapiteln entsprechen.

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": string,
  "shortTitle": string,
  "slug": string,
  "summary": string,
  "teaser": string,
  "authors": string[],
  "tags": string[],
  "docType": "report" | "study" | "brochure" | "offer" | "contract" | "manual" | "law" | "guideline" | "other",
  "year": number | null,
  "region": string,
  "language": string,
  "chapters": [
    {
      "title": string,
      "level": 1 | 2 | 3,
      "order": number,
      "startEvidence": string,
      "summary": string,
      "keywords": string[]
    }
  ],
  "toc": [
    { "title": string, "page": number?, "level": number? }
  ] | []
}
```

Kurzer Hinweis zur Wirkung:
- Das JSON landet 1:1 in der Frontmatter; `chapters` und `toc` werden als JSON in einer Zeile gespeichert. Das passt zu eurer späteren Pinecone‑Zweitverwertung und lässt euch vorab im Markdown alles prüfen/anpassen.

Wenn du willst, erstelle ich dir daraus sofort eine `pdfanalyse.md` im `/templates`‑Ordner deiner aktiven Library und starte einen kurzen Smoke‑Test (1 PDF).

```markdown
---
title: {{title|Vollständiger Titel des Dokuments (string)}}
shortTitle: {{shortTitle|Kurzer Titel ≤40 Zeichen, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute/Diakritika normalisieren; max 80; keine doppelten Bindestriche}}
summary: {{summary|1–2 Sätze, ≤120 Zeichen, neutral, nur aus Text extrahiert}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, prägnant, extraktiv}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname“ wenn möglich}}
tags: {{tags|Array relevanter Tags, normalisiert: lowercase, ASCII, kebab-case, dedupliziert}}
docType: {{docType|Eine aus: report, study, brochure, offer, contract, manual, law, guideline, other}}
year: {{year|Vierstelliges Jahr als number; wenn unbekannt: null}}
region: {{region|Region/Land aus Text; wenn unbekannt: ""}}
language: {{language|Dokumentsprache, z. B. "de" oder "en"}}
chapters: {{chapters|Array von Kapiteln mit title, level (1..3), order (int, 1-basiert), startEvidence (≤160), summary (≤1000, extraktiv), keywords (5–12)}}
toc: {{toc|Optionales Array von { title, page?, level? }, nur wenn explizit im Text erkennbar}}
---

# {{title|Dokumenttitel}}

## Zusammenfassung
{{summary|Kurzfassung für Management/Vertrieb}}

--- systemprompt
Rolle:
- Du bist ein penibler, rein EXTRAKTIVER Sachbearbeiter. Du liest Kleingedrucktes genau. Abweichungen von der Norm sind preisrelevant – knapp anmerken, aber nichts erfinden.

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im gelieferten Text vorkommen. Keine Halluzinationen.
- Wenn eine geforderte Information im Text nicht sicher vorliegt: gib "" (leere Zeichenkette) bzw. null (für year) zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Format-/Normalisierungsregeln:
- shortTitle: ≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen.
- slug: ASCII, lowercase, kebab-case, max 80, Diakritika/Um­laute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss), mehrere Leerzeichen/Bindestriche zu einem Bindestrich zusammenfassen.
- summary: 1–2 Sätze, ≤120 Zeichen, neutraler Ton, extraktiv.
- teaser: 2–3 Sätze, nicht identisch zu summary, extraktiv.
- authors: Array von Strings, dedupliziert. Format „Nachname, Vorname“ wenn eindeutig ableitbar.
- tags: Array von Strings; normalisieren (lowercase, ASCII, kebab-case), deduplizieren; nur, wenn klar aus Text ableitbar.
- docType: klassifiziere streng nach Textsignalen in { report, study, brochure, offer, contract, manual, law, guideline }; wenn unklar: "other".
- year: vierstelliges Jahr als number; nur übernehmen, wenn eindeutig (z. B. „Copyright 2024“, „Stand: 2023“).
- region: aus Text (z. B. Länder/Bundesländer/Regionen); sonst "".
- language: bestmögliche Schätzung (z. B. "de", "en") anhand des Textes.

Kapitelanalyse (extraktiv, inspiriert Capital Analyzer):
- Erkenne echte Kapitel-/Unterkapitelstarts (Level 1..3), nur wenn sie im Text vorkommen.
- Für JEDES Kapitel liefere:
  - title (string)
  - level (1..3)
  - order (integer, 1-basiert, in Dokumentreihenfolge)
  - startEvidence (string, ≤160 Zeichen, GENAUES Textfragment vom Kapitelanfang)
  - summary (string, ≤1000 Zeichen, extraktiv: nur Inhalte bis zum nächsten Kapitelstart)
  - keywords (Array mit 5–12 kurzen Stichwörtern; extraktiv/nahe am Wortlaut)
- toc (optional): Liste von { title, page?, level? } nur, wenn explizit als Inhaltsverzeichnis erkennbar; Titel müssen existierenden Kapiteln entsprechen.

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": string,
  "shortTitle": string,
  "slug": string,
  "summary": string,
  "teaser": string,
  "authors": string[],
  "tags": string[],
  "docType": "report" | "study" | "brochure" | "offer" | "contract" | "manual" | "law" | "guideline" | "other",
  "year": number | null,
  "region": string,
  "language": string,
  "chapters": [
    {
      "title": string,
      "level": 1 | 2 | 3,
      "order": number,
      "startEvidence": string,
      "summary": string,
      "keywords": string[]
    }
  ],
  "toc": [
    { "title": string, "page": number?, "level": number? }
  ] | []
}
```

---

**User**

ja bitte

---

**Cursor**

Ich erweitere jetzt den Webhook weiter: Falls der Templates-Ordner oder die Template-Datei fehlt, wird automatisch ein Standard-Template `pdfanalyse.md` im `/templates`-Ordner erzeugt und anschließend sofort verwendet. Danach prüfe ich Linter-Hinweise.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import type { Library } from '@/types/library';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

interface OneDriveAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

async function ensureOneDriveAccessToken(lib: Library): Promise<string> {
  const cfg = lib.config as unknown as OneDriveAuthConfig | undefined;
  const accessToken = cfg?.accessToken as string | undefined;
  const refreshToken = cfg?.refreshToken as string | undefined;
  const tokenExpiry = Number(cfg?.tokenExpiry || 0);
  const isExpired = !tokenExpiry || Date.now() / 1000 > tokenExpiry - 60;

  if (accessToken && !isExpired) return accessToken;
  if (!refreshToken) throw new Error('OneDrive Refresh-Token fehlt in der Library-Konfiguration');

  const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')}/api/auth/onedrive/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryId: lib.id, refreshToken })
  });
  if (!resp.ok) throw new Error(`OneDrive Token-Refresh fehlgeschlagen (${resp.status})`);
  const data = await resp.json();
  return data.accessToken as string;
}

async function onedriveUploadFile(accessToken: string, parentId: string, name: string, mime: string, buffer: Buffer): Promise<{ id: string }> {
  const base = parentId === 'root'
    ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(name)}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(name)}:/content`;
  let url = `${base}?@microsoft.graph.conflictBehavior=replace`;
  let res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  if (res.status === 409) {
    url = `${base}?@microsoft.graph.conflictBehavior=rename`;
    res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  }
  if (!res.ok) throw new Error(`OneDrive Upload fehlgeschlagen: ${res.status}`);
  const json: unknown = await res.json();
  return { id: (json as { id?: string }).id as string };
}

// onedriveEnsureFolder wurde entfernt, da nicht verwendet

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(_request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (job.userEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optional: Nur letzte N Logs zurückgeben via ?limit=...
    // Query-Params sind in App Router bei Route Handlern nicht direkt verfügbar ohne request.url zu parsen
    const url = new URL(_request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : undefined;
    const buffered: Array<Record<string, unknown>> = [];
    const persisted = Array.isArray(job.logs) ? job.logs : [];
    const merged = [...persisted, ...buffered];
    const logs = limit ? merged.slice(-limit) : merged;

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      worker: job.worker,
      operation: job.operation,
      processId: job.processId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      logs,
      result: job.result,
    });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const body = await request.json();

    // Token kann im Body, im X-Callback-Token-Header oder als Bearer kommen
    let callbackToken: string | undefined = body?.callback_token;
    if (!callbackToken) {
      const headerToken = request.headers.get('x-callback-token') || request.headers.get('X-Callback-Token');
      if (headerToken) callbackToken = headerToken;
    }
    if (!callbackToken) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) callbackToken = authHeader.substring('Bearer '.length);
    }
    if (!callbackToken) return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    const tokenHash = repo.hashSecret(callbackToken);
    if (tokenHash !== job.jobSecretHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);

    // Progress-Handling
    const progressValue = typeof body?.progress === 'number'
      ? body.progress
      : typeof body?.data?.progress === 'number'
        ? body.data.progress
        : typeof body?.percent === 'number'
          ? body.percent
          : typeof body?.data?.percent === 'number'
            ? body.data.percent
            : undefined;
    const phase = (typeof body?.phase === 'string' && body.phase) || (typeof body?.data?.phase === 'string' && body.data.phase) || undefined;
    const message = (typeof body?.message === 'string' && body.message) || (typeof body?.data?.message === 'string' && body.data.message) || undefined;

    const hasError = !!body?.error;
    const hasFinalPayload = !!(body?.data?.extracted_text || body?.data?.images_archive_url || body?.status === 'completed');

    if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
      // Watchdog heartbeat
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
      FileLogger.info('external-jobs', 'Progress-Event', {
        jobId,
        phase: phase || 'progress',
        progress: progressValue,
        message
      });
      // Push-Event für UI (SSE)
      getJobEventBus().emitUpdate(job.userEmail, {
        type: 'job_update',
        jobId,
        status: 'running',
        phase: phase || 'progress',
        progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined,
        message,
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: job.correlation?.source?.name,
      });
      return NextResponse.json({ status: 'ok', jobId, kind: 'progress' });
    }

    if (hasError) {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', details: body.error });
      // Bei Fehler: gepufferte Logs persistieren
      const buffered = drainBufferedLogs(jobId);
      for (const entry of buffered) {
        await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
      }
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveUrlFromWorker: string | undefined = body?.data?.images_archive_url;

    if (!extractedText && !imagesArchiveUrlFromWorker) {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    let savedItemId: string | undefined;
    const savedItems: string[] = [];

    if (lib && extractedText) {
      if (lib.type === 'local') {
        const provider = new FileSystemProvider(lib.path);
        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';
        // Pfade nur bei Bedarf auflösen (derzeit nicht benötigt)
        // await provider.getPathById(sourceId ?? '').catch(() => undefined);
        // await provider.getPathById(targetParentId).catch(() => '/');
        // Pfade ermitteln (aktuell nur für Debugging/Logging nutzbar)
        // const sourceAbsPath = sourceRelPath und targetAbsPath aktuell ungenutzt

        // 1) Optionalen Template-Content laden (aus /templates oder per Chat-Setting 'transformerTemplate')
        let metadataFromTemplate: Record<string, unknown> | null = null;
        try {
          // Standard-Template-Inhalt (wird angelegt, falls kein Template gefunden wird)
          const defaultTemplateContent = `---
title: {{title|Vollständiger Titel des Dokuments (string)}}
shortTitle: {{shortTitle|Kurzer Titel ≤40 Zeichen, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute/Diakritika normalisieren; max 80; keine doppelten Bindestriche}}
summary: {{summary|1–2 Sätze, ≤120 Zeichen, neutral, nur aus Text extrahiert}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, prägnant, extraktiv}}
authors: {{authors|Array von Autoren, dedupliziert, Format "Nachname, Vorname" wenn möglich}}
tags: {{tags|Array relevanter Tags, normalisiert: lowercase, ASCII, kebab-case, dedupliziert}}
docType: {{docType|Eine aus: report, study, brochure, offer, contract, manual, law, guideline, other}}
year: {{year|Vierstelliges Jahr als number; wenn unbekannt: null}}
region: {{region|Region/Land aus Text; wenn unbekannt: ""}}
language: {{language|Dokumentsprache, z. B. "de" oder "en"}}
chapters: {{chapters|Array von Kapiteln mit title, level (1..3), order (int, 1-basiert), startEvidence (≤160), summary (≤1000, extraktiv), keywords (5–12)}}
toc: {{toc|Optionales Array von { title, page?, level? }, nur wenn explizit im Text erkennbar}}
---

# {{title|Dokumenttitel}}

## Zusammenfassung
{{summary|Kurzfassung für Management/Vertrieb}}

--- systemprompt
Rolle:
- Du bist ein penibler, rein EXTRAKTIVER Sachbearbeiter. Du liest Kleingedrucktes genau. Abweichungen von der Norm sind preisrelevant – knapp anmerken, aber nichts erfinden.

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im gelieferten Text vorkommen. Keine Halluzinationen.
- Wenn eine geforderte Information im Text nicht sicher vorliegt: gib "" (leere Zeichenkette) bzw. null (für year) zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Format-/Normalisierungsregeln:
- shortTitle: ≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen.
- slug: ASCII, lowercase, kebab-case, max 80, Diakritika/Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss), mehrere Leerzeichen/Bindestriche zu einem Bindestrich zusammenfassen.
- summary: 1–2 Sätze, ≤120 Zeichen, neutraler Ton, extraktiv.
- teaser: 2–3 Sätze, nicht identisch zu summary, extraktiv.
- authors: Array von Strings, dedupliziert. Format „Nachname, Vorname“ wenn eindeutig ableitbar.
- tags: Array von Strings; normalisieren (lowercase, ASCII, kebab-case), deduplizieren; nur, wenn klar aus Text ableitbar.
- docType: klassifiziere streng nach Textsignalen in { report, study, brochure, offer, contract, manual, law, guideline }; wenn unklar: "other".
- year: vierstelliges Jahr als number; nur übernehmen, wenn eindeutig (z. B. „Copyright 2024“, „Stand: 2023“).
- region: aus Text (z. B. Länder/Bundesländer/Regionen); sonst "".
- language: bestmögliche Schätzung (z. B. "de", "en") anhand des Textes.

Kapitelanalyse (extraktiv):
- Erkenne echte Kapitel-/Unterkapitelstarts (Level 1..3), nur wenn sie im Text vorkommen.
- Für JEDES Kapitel liefere: title, level (1..3), order (1-basiert), startEvidence (≤160, exakter Anfangstext), summary (≤1000, extraktiv bis zum nächsten Kapitelstart), keywords (5–12, kurz und textnah).
- toc (optional): Liste von { title, page?, level? } nur, wenn explizit als Inhaltsverzeichnis erkennbar; Titel müssen existierenden Kapiteln entsprechen.

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": string,
  "shortTitle": string,
  "slug": string,
  "summary": string,
  "teaser": string,
  "authors": string[],
  "tags": string[],
  "docType": "report" | "study" | "brochure" | "offer" | "contract" | "manual" | "law" | "guideline" | "other",
  "year": number | null,
  "region": string,
  "language": string,
  "chapters": [ { "title": string, "level": 1 | 2 | 3, "order": number, "startEvidence": string, "summary": string, "keywords": string[] } ],
  "toc": [ { "title": string, "page": number?, "level": number? } ] | []
}`;

          // Bevorzugter Template-Name aus Chat-Config (falls vorhanden)
          const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
          // Templates-Ordner im Root suchen
          const rootItems = await provider.listItemsById('root');
          const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'));
          const ensureTemplatesFolderId = async (): Promise<string> => {
            if (templatesFolder) return templatesFolder.id;
            const created = await provider.createFolder('root', 'templates');
            bufferLog(jobId, { phase: 'templates_folder_created', message: 'Ordner /templates angelegt' });
            return created.id;
          };

          const templatesFolderId = await ensureTemplatesFolderId();

          if (templatesFolderId) {
            const tplItems = await provider.listItemsById(templatesFolderId);
            // Auswahllogik: bevorzugt preferredTemplate, sonst 'pdfanalyse.md', sonst erstes .md
            const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase()));
            const byPreferred = preferredTemplate ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`) : undefined;
            const byDefault = pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md');
            const anyMd = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
            let chosen = byPreferred || byDefault || anyMd;
            if (!chosen) {
              // Default-Template anlegen
              const tplFile = new File([new Blob([defaultTemplateContent], { type: 'text/markdown' })], 'pdfanalyse.md', { type: 'text/markdown' });
              const savedTpl = await provider.uploadFile(templatesFolderId, tplFile);
              bufferLog(jobId, { phase: 'template_created', message: 'Default-Template pdfanalyse.md angelegt' });
              // Neu laden
              const re = await provider.listItemsById(templatesFolderId);
              chosen = re.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'pdfanalyse.md'));
            }
            if (chosen) {
              const bin = await provider.getBinary(chosen.id);
              const templateContent = await bin.blob.text();
              // 2) Secretary Transformer mit template_content aufrufen
              const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
              const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
              const fd = new FormData();
              fd.append('text', extractedText);
              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              fd.append('target_language', lang);
              fd.append('template_content', templateContent);
              fd.append('use_cache', 'false');
              const headers: Record<string, string> = { 'Accept': 'application/json' };
              const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
              if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
              const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
              const data: unknown = await resp.json().catch(() => ({}));
              if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
                metadataFromTemplate = data as Record<string, unknown>;
                bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' });
              } else {
                bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' });
              }
            } else {
              bufferLog(jobId, { phase: 'template_missing', message: 'Kein Template gefunden' });
            }
          } else {
            bufferLog(jobId, { phase: 'templates_folder_missing', message: 'Ordner /templates nicht gefunden' });
          }
        } catch {
          bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation' });
        }

        // 3) Frontmatter-Metadaten bestimmen (Template bevorzugt, sonst Worker-Metadaten)
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };

        // 4) Markdown mit Frontmatter erzeugen (Body = Originaltext)
        const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, finalMeta)
          : extractedText;

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        const saved = await provider.uploadFile(targetParentId, file);
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              try {
                archiveUrl = new URL(imagesArchiveUrlFromWorker, baseRaw).toString();
              } catch {
                const base = baseRaw.replace(/\/$/, '');
                const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
                archiveUrl = base.endsWith('/api') && rel.startsWith('/api/')
                  ? `${base}${rel.substring(4)}`
                  : `${base}${rel}`;
              }
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              // Markiere Job als fehlgeschlagen und beende
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) {
                await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              }
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            } else {
              const arrayBuf = await resp.arrayBuffer();
              const base64Zip = Buffer.from(arrayBuf).toString('base64');
              const originalItemForImages = {
                id: sourceId || 'unknown',
                parentId: targetParentId,
                type: 'file' as const,
                metadata: {
                  name: job.correlation.source?.name || 'source.pdf',
                  size: 0,
                  modifiedAt: new Date(),
                  mimeType: job.correlation.source?.mimeType || 'application/pdf',
                },
              };
              const textContents = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
              const imageResult = await ImageExtractionService.saveZipArchive(
                base64Zip,
                'images.zip',
                originalItemForImages,
                provider,
                async (folderId: string) => provider.listItemsById(folderId),
                extractedText,
                lang,
                textContents
              );
              for (const it of imageResult.savedItems) savedItems.push(it.id);
              bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            // Markiere Job als fehlgeschlagen und beende
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) {
              await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            }
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
        }
      } else if (lib && lib.type === 'onedrive') {
        const accessToken = await ensureOneDriveAccessToken(lib);
        const targetParentId = job.correlation?.source?.parentId || 'root';
        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;
        const md = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
          : extractedText;
        const contentBuffer = Buffer.from(md, 'utf8');
        const saved = await onedriveUploadFile(accessToken, targetParentId, uniqueName, 'text/markdown', contentBuffer);
        savedItemId = saved.id;
        savedItems.push(saved.id);

        bufferLog(jobId, { phase: 'stored_cloud', message: 'Shadow‑Twin gespeichert' });

        // Bilder nicht mehr vom Webhook-ZIP extrahieren – Link wird bereitgestellt
      }
    }

    await repo.setStatus(jobId, 'completed');
    clearWatchdog(jobId);
    // gepufferte Logs persistieren
    const buffered = drainBufferedLogs(jobId);
    for (const entry of buffered) {
      await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
    }
    await repo.setResult(jobId, {
      extracted_text: extractedText,
      images_archive_url: imagesArchiveUrlFromWorker || undefined,
      metadata: body?.data?.metadata,
    }, { savedItemId, savedItems });

    // Finalen Logeintrag für den sichtbaren Verlauf hinzufügen
    await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });

    FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
    return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}



```

Ich habe im Webhook folgendes umgesetzt:
- Standard-Template `pdfanalyse.md` wird bei fehlendem `/templates`-Ordner automatisch angelegt (inkl. extraktivem Capital‑Analyzer‑Systemprompt).
- Template-Auswahl: `chat.transformerTemplate` → `pdfanalyse.md` → erstes `.md` in `/templates`.
- Danach 1 Transformer‑Call mit `template_content`; JSON wird als Frontmatter übernommen.

Testvorschlag
- Lade ein PDF in eine Library ohne `/templates` → es wird automatisch `templates/pdfanalyse.md` erzeugt; das erzeugte `.md` enthält Frontmatter (inkl. `summary`, `chapters`, `toc`) und den Originaltext.
- Passe `templates/pdfanalyse.md` an und teste erneut.

- Ich habe die Erstellung des Templates automatisiert und die Frontmatter‑Pflege integriert. Wenn du willst, testen wir jetzt mit 1 PDF in einer leeren Library.

---

**User**

Achtung die structured data sind in der response verschachtelt:
{
  status: "success",
  request: {
    processor: "transformer",
    timestamp: "2025-08-27T14:50:39.831788",
    parameters: {
      text: "\r\n--- Seite 1 ---\r\n60—61\r\nUMWELT\r\nLandwirtschaftsreport\r\nArten kommt der Landwirtschaft besonders gr...",
      url: null,
      template: null,
      template_content: "---\r\ntitle: {{title|Titel des Dokuments als string}}\r\nshortTitle: {{shortTitlel|kurzer Titel, max. 4...",
      source_language: "de",
      target_language: "de",
      context: {
      },
      additional_field_descriptions: {
      },
      use_cache: false,
      duration_ms: 5088,
    },
  },
  process: {
    id: "762a7db3-c7ec-4351-9f07-7d36d658bbe1",
    main_processor: "TransformerProcessor",
    started: "2025-08-27T14:50:34.744781",
    sub_processors: [
    ],
    completed: null,
    duration: null,
    is_from_cache: false,
    cache_key: "",
    llm_info: {
      requests: [
        {
          model: "gpt-4.1-mini",
          purpose: "template_transform",
          tokens: 15511,
          duration: 4474.3030071258545,
          processor: "WhisperTranscriber",
          timestamp: "2025-08-27T14:50:39.827788",
        },
      ],
      requests_count: 1,
      total_tokens: 15511,
      total_duration: 4474.3030071258545,
    },
  },
  error: null,
  data: {
    text: "---\r\ntitle: Landwirtschaftsreport Umwelt Südtirol\r\nshortTitle: landwirtschaftsreport umwelt südtirol\r\nslug: landwirtschaftsreport-umwelt-suedtirol\r\nsummary: Der Bericht analysiert die Auswirkungen der Landwirtschaft auf Biodiversität und Naturschutz in Südtirol.\r\nteaser: Der Landwirtschaftsreport untersucht die Biodiversität in Südtirols Agrarlandschaften und zeigt Gefährdungsursachen auf. Er behandelt Kulturformen, gefährdete Arten und Naturschutzmaßnahmen.\r\nauthors: Andreas Hilpold\r\ntags: Biodiversität, Landwirtschaft, Südtirol, Naturschutz, Gefährdung, Artenvielfalt, Grünland, Obstanlagen, Weinbau, FFH-Richtlinie, Rote Liste, Nutztiere, Kulturpflanzen, Monitoring\r\n---\r\n\r\n# Landwirtschaftsreport Umwelt Südtirol\r\n\r\n## Zusammenfassung\r\nDer Bericht analysiert die Auswirkungen der Landwirtschaft auf Biodiversität und Naturschutz in Südtirol.",
    language: "de",
    format: "text",
    summarized: false,
    structured_data: {
      title: "Landwirtschaftsreport Umwelt Südtirol",
      shortTitlel: "landwirtschaftsreport umwelt südtirol",
      slug: "landwirtschaftsreport-umwelt-suedtirol",
      summary: "Der Bericht analysiert die Auswirkungen der Landwirtschaft auf Biodiversität und Naturschutz in Südtirol.",
      teaser: "Der Landwirtschaftsreport untersucht die Biodiversität in Südtirols Agrarlandschaften und zeigt Gefährdungsursachen auf. Er behandelt Kulturformen, gefährdete Arten und Naturschutzmaßnahmen.",
      authors: "Andreas Hilpold",
      tags: "Biodiversität, Landwirtschaft, Südtirol, Naturschutz, Gefährdung, Artenvielfalt, Grünland, Obstanlagen, Weinbau, FFH-Richtlinie, Rote Liste, Nutztiere, Kulturpflanzen, Monitoring",
    },
  },
  translation: null,
}

---

**Cursor**

Ich werde die verschachtelte structured_data korrekt aus der Secretary-Antwort extrahieren und normalisieren (Kurzschreibweise/Typo bei shortTitle, Autoren/Tags-Listen, Slug-Normalisierung), indem ich Hilfsfunktionen im Webhook ergänze und die Zuweisung von metadataFromTemplate anpasse. Danach prüfe ich den Linter und hake die Frontmatter-Aufgabe ab.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import type { Library } from '@/types/library';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

function toAsciiKebab(input: unknown, maxLen: number = 80): string | undefined {
  if (typeof input !== 'string') return undefined;
  const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
  const replaced = input
    .trim()
    .toLowerCase()
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  const cut = replaced.slice(0, maxLen).replace(/-+$/g, '');
  return cut || undefined;
}

function splitToArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const arr = value
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(arr));
  }
  if (typeof value === 'string') {
    const arr = value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    return Array.from(new Set(arr));
  }
  return undefined;
}

function normalizeStructuredData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...r };

  // shortTitle variants
  const shortTitleCandidate = (r['shortTitle'] ?? r['shortTitel'] ?? r['shortTitlel']) as unknown;
  if (typeof shortTitleCandidate === 'string') {
    const cleaned = shortTitleCandidate.replace(/[.!?]+$/g, '').trim();
    out['shortTitle'] = cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned;
  }
  delete out['shortTitel'];
  delete out['shortTitlel'];

  // slug normalization
  const slug = toAsciiKebab(r['slug']);
  if (slug) out['slug'] = slug;

  // authors and tags arrays
  const authors = splitToArray(r['authors']);
  if (authors) out['authors'] = authors;
  const tags = splitToArray(r['tags']);
  if (tags) {
    const norm = tags
      .map(t => toAsciiKebab(t, 80) || '')
      .filter(Boolean) as string[];
    out['tags'] = Array.from(new Set(norm));
  }

  // year number
  const yearVal = r['year'];
  if (typeof yearVal === 'string' && /^\d{4}$/.test(yearVal)) out['year'] = Number(yearVal);

  return out;
}

interface OneDriveAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

async function ensureOneDriveAccessToken(lib: Library): Promise<string> {
  const cfg = lib.config as unknown as OneDriveAuthConfig | undefined;
  const accessToken = cfg?.accessToken as string | undefined;
  const refreshToken = cfg?.refreshToken as string | undefined;
  const tokenExpiry = Number(cfg?.tokenExpiry || 0);
  const isExpired = !tokenExpiry || Date.now() / 1000 > tokenExpiry - 60;

  if (accessToken && !isExpired) return accessToken;
  if (!refreshToken) throw new Error('OneDrive Refresh-Token fehlt in der Library-Konfiguration');

  const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')}/api/auth/onedrive/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryId: lib.id, refreshToken })
  });
  if (!resp.ok) throw new Error(`OneDrive Token-Refresh fehlgeschlagen (${resp.status})`);
  const data = await resp.json();
  return data.accessToken as string;
}

async function onedriveUploadFile(accessToken: string, parentId: string, name: string, mime: string, buffer: Buffer): Promise<{ id: string }> {
  const base = parentId === 'root'
    ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(name)}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(name)}:/content`;
  let url = `${base}?@microsoft.graph.conflictBehavior=replace`;
  let res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  if (res.status === 409) {
    url = `${base}?@microsoft.graph.conflictBehavior=rename`;
    res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  }
  if (!res.ok) throw new Error(`OneDrive Upload fehlgeschlagen: ${res.status}`);
  const json: unknown = await res.json();
  return { id: (json as { id?: string }).id as string };
}

// onedriveEnsureFolder wurde entfernt, da nicht verwendet

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(_request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (job.userEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optional: Nur letzte N Logs zurückgeben via ?limit=...
    // Query-Params sind in App Router bei Route Handlern nicht direkt verfügbar ohne request.url zu parsen
    const url = new URL(_request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : undefined;
    const buffered: Array<Record<string, unknown>> = [];
    const persisted = Array.isArray(job.logs) ? job.logs : [];
    const merged = [...persisted, ...buffered];
    const logs = limit ? merged.slice(-limit) : merged;

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      worker: job.worker,
      operation: job.operation,
      processId: job.processId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      logs,
      result: job.result,
    });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const body = await request.json();

    // Token kann im Body, im X-Callback-Token-Header oder als Bearer kommen
    let callbackToken: string | undefined = body?.callback_token;
    if (!callbackToken) {
      const headerToken = request.headers.get('x-callback-token') || request.headers.get('X-Callback-Token');
      if (headerToken) callbackToken = headerToken;
    }
    if (!callbackToken) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) callbackToken = authHeader.substring('Bearer '.length);
    }
    if (!callbackToken) return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    const tokenHash = repo.hashSecret(callbackToken);
    if (tokenHash !== job.jobSecretHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);

    // Progress-Handling
    const progressValue = typeof body?.progress === 'number'
      ? body.progress
      : typeof body?.data?.progress === 'number'
        ? body.data.progress
        : typeof body?.percent === 'number'
          ? body.percent
          : typeof body?.data?.percent === 'number'
            ? body.data.percent
            : undefined;
    const phase = (typeof body?.phase === 'string' && body.phase) || (typeof body?.data?.phase === 'string' && body.data.phase) || undefined;
    const message = (typeof body?.message === 'string' && body.message) || (typeof body?.data?.message === 'string' && body.data.message) || undefined;

    const hasError = !!body?.error;
    const hasFinalPayload = !!(body?.data?.extracted_text || body?.data?.images_archive_url || body?.status === 'completed');

    if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
      // Watchdog heartbeat
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
      FileLogger.info('external-jobs', 'Progress-Event', {
        jobId,
        phase: phase || 'progress',
        progress: progressValue,
        message
      });
      // Push-Event für UI (SSE)
      getJobEventBus().emitUpdate(job.userEmail, {
        type: 'job_update',
        jobId,
        status: 'running',
        phase: phase || 'progress',
        progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined,
        message,
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: job.correlation?.source?.name,
      });
      return NextResponse.json({ status: 'ok', jobId, kind: 'progress' });
    }

    if (hasError) {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', details: body.error });
      // Bei Fehler: gepufferte Logs persistieren
      const buffered = drainBufferedLogs(jobId);
      for (const entry of buffered) {
        await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
      }
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveUrlFromWorker: string | undefined = body?.data?.images_archive_url;

    if (!extractedText && !imagesArchiveUrlFromWorker) {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    let savedItemId: string | undefined;
    const savedItems: string[] = [];

    if (lib && extractedText) {
      if (lib.type === 'local') {
        const provider = new FileSystemProvider(lib.path);
        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';
        // Pfade nur bei Bedarf auflösen (derzeit nicht benötigt)
        // await provider.getPathById(sourceId ?? '').catch(() => undefined);
        // await provider.getPathById(targetParentId).catch(() => '/');
        // Pfade ermitteln (aktuell nur für Debugging/Logging nutzbar)
        // const sourceAbsPath = sourceRelPath und targetAbsPath aktuell ungenutzt

        // 1) Optionalen Template-Content laden (aus /templates oder per Chat-Setting 'transformerTemplate')
        let metadataFromTemplate: Record<string, unknown> | null = null;
        try {
          // Standard-Template-Inhalt (wird angelegt, falls kein Template gefunden wird)
          const defaultTemplateContent = `---
title: {{title|Vollständiger Titel des Dokuments (string)}}
shortTitle: {{shortTitle|Kurzer Titel ≤40 Zeichen, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute/Diakritika normalisieren; max 80; keine doppelten Bindestriche}}
summary: {{summary|1–2 Sätze, ≤120 Zeichen, neutral, nur aus Text extrahiert}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, prägnant, extraktiv}}
authors: {{authors|Array von Autoren, dedupliziert, Format "Nachname, Vorname" wenn möglich}}
tags: {{tags|Array relevanter Tags, normalisiert: lowercase, ASCII, kebab-case, dedupliziert}}
docType: {{docType|Eine aus: report, study, brochure, offer, contract, manual, law, guideline, other}}
year: {{year|Vierstelliges Jahr als number; wenn unbekannt: null}}
region: {{region|Region/Land aus Text; wenn unbekannt: ""}}
language: {{language|Dokumentsprache, z. B. "de" oder "en"}}
chapters: {{chapters|Array von Kapiteln mit title, level (1..3), order (int, 1-basiert), startEvidence (≤160), summary (≤1000, extraktiv), keywords (5–12)}}
toc: {{toc|Optionales Array von { title, page?, level? }, nur wenn explizit im Text erkennbar}}
---

# {{title|Dokumenttitel}}

## Zusammenfassung
{{summary|Kurzfassung für Management/Vertrieb}}

--- systemprompt
Rolle:
- Du bist ein penibler, rein EXTRAKTIVER Sachbearbeiter. Du liest Kleingedrucktes genau. Abweichungen von der Norm sind preisrelevant – knapp anmerken, aber nichts erfinden.

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im gelieferten Text vorkommen. Keine Halluzinationen.
- Wenn eine geforderte Information im Text nicht sicher vorliegt: gib "" (leere Zeichenkette) bzw. null (für year) zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Format-/Normalisierungsregeln:
- shortTitle: ≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen.
- slug: ASCII, lowercase, kebab-case, max 80, Diakritika/Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss), mehrere Leerzeichen/Bindestriche zu einem Bindestrich zusammenfassen.
- summary: 1–2 Sätze, ≤120 Zeichen, neutraler Ton, extraktiv.
- teaser: 2–3 Sätze, nicht identisch zu summary, extraktiv.
- authors: Array von Strings, dedupliziert. Format „Nachname, Vorname“ wenn eindeutig ableitbar.
- tags: Array von Strings; normalisieren (lowercase, ASCII, kebab-case), deduplizieren; nur, wenn klar aus Text ableitbar.
- docType: klassifiziere streng nach Textsignalen in { report, study, brochure, offer, contract, manual, law, guideline }; wenn unklar: "other".
- year: vierstelliges Jahr als number; nur übernehmen, wenn eindeutig (z. B. „Copyright 2024“, „Stand: 2023“).
- region: aus Text (z. B. Länder/Bundesländer/Regionen); sonst "".
- language: bestmögliche Schätzung (z. B. "de", "en") anhand des Textes.

Kapitelanalyse (extraktiv):
- Erkenne echte Kapitel-/Unterkapitelstarts (Level 1..3), nur wenn sie im Text vorkommen.
- Für JEDES Kapitel liefere: title, level (1..3), order (1-basiert), startEvidence (≤160, exakter Anfangstext), summary (≤1000, extraktiv bis zum nächsten Kapitelstart), keywords (5–12, kurz und textnah).
- toc (optional): Liste von { title, page?, level? } nur, wenn explizit als Inhaltsverzeichnis erkennbar; Titel müssen existierenden Kapiteln entsprechen.

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": string,
  "shortTitle": string,
  "slug": string,
  "summary": string,
  "teaser": string,
  "authors": string[],
  "tags": string[],
  "docType": "report" | "study" | "brochure" | "offer" | "contract" | "manual" | "law" | "guideline" | "other",
  "year": number | null,
  "region": string,
  "language": string,
  "chapters": [ { "title": string, "level": 1 | 2 | 3, "order": number, "startEvidence": string, "summary": string, "keywords": string[] } ],
  "toc": [ { "title": string, "page": number?, "level": number? } ] | []
}`;

          // Bevorzugter Template-Name aus Chat-Config (falls vorhanden)
          const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
          // Templates-Ordner im Root suchen
          const rootItems = await provider.listItemsById('root');
          const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'));
          const ensureTemplatesFolderId = async (): Promise<string> => {
            if (templatesFolder) return templatesFolder.id;
            const created = await provider.createFolder('root', 'templates');
            bufferLog(jobId, { phase: 'templates_folder_created', message: 'Ordner /templates angelegt' });
            return created.id;
          };

          const templatesFolderId = await ensureTemplatesFolderId();

          if (templatesFolderId) {
            const tplItems = await provider.listItemsById(templatesFolderId);
            // Auswahllogik: bevorzugt preferredTemplate, sonst 'pdfanalyse.md', sonst erstes .md
            const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase()));
            const byPreferred = preferredTemplate ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`) : undefined;
            const byDefault = pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md');
            const anyMd = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
            let chosen = byPreferred || byDefault || anyMd;
            if (!chosen) {
              // Default-Template anlegen
              const tplFile = new File([new Blob([defaultTemplateContent], { type: 'text/markdown' })], 'pdfanalyse.md', { type: 'text/markdown' });
              const savedTpl = await provider.uploadFile(templatesFolderId, tplFile);
              bufferLog(jobId, { phase: 'template_created', message: 'Default-Template pdfanalyse.md angelegt' });
              // Neu laden
              const re = await provider.listItemsById(templatesFolderId);
              chosen = re.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'pdfanalyse.md'));
            }
            if (chosen) {
              const bin = await provider.getBinary(chosen.id);
              const templateContent = await bin.blob.text();
              // 2) Secretary Transformer mit template_content aufrufen
              const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
              const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
              const fd = new FormData();
              fd.append('text', extractedText);
              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              fd.append('target_language', lang);
              fd.append('template_content', templateContent);
              fd.append('use_cache', 'false');
              const headers: Record<string, string> = { 'Accept': 'application/json' };
              const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
              if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
              const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
              const data: unknown = await resp.json().catch(() => ({}));
              if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
                const d = (data as { data?: unknown }).data as { structured_data?: unknown; text?: unknown } | undefined;
                const normalized = normalizeStructuredData(d?.structured_data);
                if (normalized) {
                  metadataFromTemplate = normalized;
                } else {
                  metadataFromTemplate = null;
                }
                bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' });
              } else {
                bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' });
              }
            } else {
              bufferLog(jobId, { phase: 'template_missing', message: 'Kein Template gefunden' });
            }
          } else {
            bufferLog(jobId, { phase: 'templates_folder_missing', message: 'Ordner /templates nicht gefunden' });
          }
        } catch {
          bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation' });
        }

        // 3) Frontmatter-Metadaten bestimmen (Template bevorzugt, sonst Worker-Metadaten)
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };

        // 4) Markdown mit Frontmatter erzeugen (Body = Originaltext)
        const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, finalMeta)
          : extractedText;

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        const saved = await provider.uploadFile(targetParentId, file);
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              try {
                archiveUrl = new URL(imagesArchiveUrlFromWorker, baseRaw).toString();
              } catch {
                const base = baseRaw.replace(/\/$/, '');
                const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
                archiveUrl = base.endsWith('/api') && rel.startsWith('/api/')
                  ? `${base}${rel.substring(4)}`
                  : `${base}${rel}`;
              }
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              // Markiere Job als fehlgeschlagen und beende
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) {
                await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              }
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            } else {
              const arrayBuf = await resp.arrayBuffer();
              const base64Zip = Buffer.from(arrayBuf).toString('base64');
              const originalItemForImages = {
                id: sourceId || 'unknown',
                parentId: targetParentId,
                type: 'file' as const,
                metadata: {
                  name: job.correlation.source?.name || 'source.pdf',
                  size: 0,
                  modifiedAt: new Date(),
                  mimeType: job.correlation.source?.mimeType || 'application/pdf',
                },
              };
              const textContents = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
              const imageResult = await ImageExtractionService.saveZipArchive(
                base64Zip,
                'images.zip',
                originalItemForImages,
                provider,
                async (folderId: string) => provider.listItemsById(folderId),
                extractedText,
                lang,
                textContents
              );
              for (const it of imageResult.savedItems) savedItems.push(it.id);
              bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            // Markiere Job als fehlgeschlagen und beende
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) {
              await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            }
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
        }
      } else if (lib && lib.type === 'onedrive') {
        const accessToken = await ensureOneDriveAccessToken(lib);
        const targetParentId = job.correlation?.source?.parentId || 'root';
        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;
        const md = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
          : extractedText;
        const contentBuffer = Buffer.from(md, 'utf8');
        const saved = await onedriveUploadFile(accessToken, targetParentId, uniqueName, 'text/markdown', contentBuffer);
        savedItemId = saved.id;
        savedItems.push(saved.id);

        bufferLog(jobId, { phase: 'stored_cloud', message: 'Shadow‑Twin gespeichert' });

        // Bilder nicht mehr vom Webhook-ZIP extrahieren – Link wird bereitgestellt
      }
    }

    await repo.setStatus(jobId, 'completed');
    clearWatchdog(jobId);
    // gepufferte Logs persistieren
    const buffered = drainBufferedLogs(jobId);
    for (const entry of buffered) {
      await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
    }
    await repo.setResult(jobId, {
      extracted_text: extractedText,
      images_archive_url: imagesArchiveUrlFromWorker || undefined,
      metadata: body?.data?.metadata,
    }, { savedItemId, savedItems });

    // Finalen Logeintrag für den sichtbaren Verlauf hinzufügen
    await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });

    FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
    return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}



```

Verstanden. Ich habe den Webhook so angepasst, dass er die verschachtelte Antwort korrekt ausliest und normalisiert:

- structured_data wird aus `response.data.structured_data` extrahiert.
- shortTitle-Typo-Fälle (`shortTitel`, `shortTitlel`) werden auf `shortTitle` vereinheitlicht und auf ≤40 Zeichen gekürzt.
- slug wird robust ASCII/lower/kebab-case normalisiert (Umlaute → ae/oe/ue/ss, max 80).
- authors/tags werden aus Strings zu Arrays gesplittet, dedupliziert; tags zusätzlich in kebab-case normalisiert.
- year aus „YYYY“ als number gesetzt, sonst unverändert.

Damit landet die bereinigte Frontmatter zuverlässig im Markdown. Wenn du willst, testen wir mit dem gezeigten Beispiel erneut und prüfen, ob `shortTitle`, `tags[]`, `authors[]` und `slug` jetzt wie erwartet erscheinen.

---

**User**

Ich verstehe das nicht. Im template steht:
---
title: {{title|Vollständiger Titel des Dokuments (string)}}
shortTitle: {{shortTitle|Kurzer Titel ≤40 Zeichen, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute/Diakritika normalisieren; max 80; keine doppelten Bindestriche}}
summary: {{summary|1–2 Sätze, ≤120 Zeichen, neutral, nur aus Text extrahiert}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, prägnant, extraktiv}}
authors: {{authors|Array von Autoren, dedupliziert, Format „Nachname, Vorname“ wenn möglich}}
tags: {{tags|Array relevanter Tags, normalisiert: lowercase, ASCII, kebab-case, dedupliziert}}
docType: {{docType|Eine aus: report, study, brochure, offer, contract, manual, law, guideline, other}}
year: {{year|Vierstelliges Jahr als number; wenn unbekannt: null}}
region: {{region|Region/Land aus Text; wenn unbekannt: ""}}
language: {{language|Dokumentsprache, z. B. "de" oder "en"}}
chapters: {{chapters|Array von Kapiteln mit title, level (1..3), order (int, 1-basiert), startEvidence (≤160), summary (≤1000, extraktiv), keywords (5–12)}}
toc: {{toc|Optionales Array von { title, page?, level? }, nur wenn explizit im Text erkennbar}}
---
In Antwort steht das:
---
authors: ["Andreas Hilpold","Niederfringer O","Huemer P","Tarmann G","Wilhalm T","Poggio S L","Chaneton E J","Ghersa C M","Tasser E","Sternbach E","Rüdisser J","Peham T","Meyer E","Platter W","Marsoner T","Egarter-Vigl L","Manck F","Jaritz G"]
shortTitle: "Landwirtschaftsreport Umwelt Südtirol"
slug: "landwirtschaftsreport-umwelt-suedtirol"
summary: "Der Bericht analysiert die Auswirkungen der Landwirtschaft auf Biodiversität und Naturschutz in Südtirol."
tags: ["landwirtschaft","biodiversitaet","suedtirol","naturschutz","gefaehrdung","monitoring","artenvielfalt","gruenland","obstanlagen","weinbau","ffh-richtlinie","rote-liste","nutztiere","kulturpflanzen","pflanzenschutz","klimaschutz","wassernutzung"]
teaser: "Der Landwirtschaftsreport behandelt die Bedeutung der Landwirtschaft für den Erhalt gefährdeter Arten und Lebensräume in Südtirol. Er zeigt Ursachen der Gefährdung auf und beschreibt Monitoringprojekte sowie Schutzmaßnahmen."
title: "Landwirtschaftsreport Umwelt Südtirol"
---

---

**Cursor**

Kurzantwort: Das passt jetzt. Der Secretary liefert zwei Outputs – wir verwenden das strukturierte JSON aus data.structured_data und bauen daraus die Frontmatter. Deine gezeigte Antwort entspricht dem Template: authors und tags sind Arrays, shortTitle und slug sind normalisiert.

Was genau passiert
- Secretary-Response: data.text enthält eine Markdown-/YAML-Fassung; data.structured_data enthält das „saubere“ JSON.
- Webhook: Liest data.structured_data, fixt shortTitle-Typos, normalisiert slug (ASCII, kebab-case), wandelt authors/tags zu Arrays (dedupliziert). year wird zu number, falls „YYYY“.
- Frontmatter: Wir schreiben genau diese normalisierten Werte in die Frontmatter. Arrays bleiben als JSON-Arrays in der YAML (bewusst, konsistent mit docMetaJson).

Warum das anders aussehen kann als „klassische“ YAML
- Arrays erscheinen als JSON-Listen ["…"] statt YAML-Listen mit -; das ist beabsichtigt, damit die Werte 1:1 in Pinecone/Filters passen.

Optional (kann ich direkt ergänzen)
- Fehlende Felder strikt vorbelegen: docType="other", year=null, region="", language="de", chapters=[], toc=[].
- Erzwingen, dass authors/tags immer Arrays sind, auch wenn das Modell Strings liefern würde (Fallback greift bereits).

Wenn du mir sagst, ob du Defaults erzwingen willst, setze ich das sofort.

---

**User**

Haben wir nicht bei den breadcrumbs das mit den Favoriten gebaut?

---

**Cursor**

Ich prüfe, wo die Breadcrumbs und eine Favoriten-Funktion implementiert sind, um deine Frage sicher zu beantworten.

Ich schaue nach, ob und wo die Favoriten-Funktionen (`loadFavorites`, `toggleFavorite`) in UI-Komponenten verwendet werden, z. B. Breadcrumbs oder Datei-/Ordner-Ansicht. Danach bestätige ich, ob Breadcrumbs selbst Favoriten haben.

Kurz: Nein, in `Breadcrumb` selbst haben wir keine Favoriten-UI. Es gibt aber bereits eine Favoriten-Logik auf Dateiebene, die aktuell nirgends im UI verdrahtet ist.

Referenzen
```1:12:src/components/library/breadcrumb.tsx
'use client';

import * as React from "react";
...
export function Breadcrumb({ className }: BreadcrumbProps) {
```

```54:66:src/lib/library/favorites.ts
export async function loadFavorites(provider: StorageProvider, libraryId: string): Promise<LibraryFavoritesData> {
  const data = await readFavoritesFile(provider);
  if (data && data.libraryId === libraryId) return data;
  return { libraryId, favorites: [] };
}

export async function toggleFavorite(
```

Vorschlag (klein, optional):
- Stern-Icon neben dem aktuellen Ordner im `Breadcrumb` einblenden: Klick → `toggleFavorite(...)`.
- Optional: Dropdown „Favoriten“ im `LibraryHeader`, geladen via `loadFavorites(...)`.

```typescriptreact
'use client';

import * as React from "react";
...
export function Breadcrumb({ className }: BreadcrumbProps) {
```

```typescript
export async function loadFavorites(provider: StorageProvider, libraryId: string): Promise<LibraryFavoritesData> {
  const data = await readFavoritesFile(provider);
  if (data && data.libraryId === libraryId) return data;
  return { libraryId, favorites: [] };
}

export async function toggleFavorite(
```

---

**User**

Haben wir hier favoriten Logik bei breadcrumb?

---

**Cursor**

Kurz: Nein.

- In `src/components/library/breadcrumb.tsx` gibt es aktuell keine Favoriten-Logik.
- Favoriten-Hilfsfunktionen existieren separat in `src/lib/library/favorites.ts` (z. B. `loadFavorites`, `toggleFavorite`), sind aber im Breadcrumb nicht verdrahtet.

Wenn gewünscht: Stern-Icon neben dem aktuellen Ordner im Breadcrumb einbauen und per `toggleFavorite(...)` schalten.

