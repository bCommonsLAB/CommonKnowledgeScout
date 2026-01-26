# Architektur: Einheitliche Pipeline für alle Formate

## Ausgangslage

Bisherige External-Job-Pipeline ist **PDF-zentriert**:
- `findPdfMarkdown()` nutzt PDF-Annahmen (`${baseName}.pdf` als Fallback)
- Step-Naming (`extract_pdf`) ist hardcoded
- Template/Ingest-Preprocessor suchen primär Transformationen im Shadow-Twin-Kontext

**Problem**: Jeder neue Dateityp (Audio, Markdown, Website, CSV, …) erfordert ad-hoc Entscheidungen über Phasen, Artefakt-Konventionen und Validierungsregeln.

## Zielbild (Variante C)

### Leitidee: Canonical Markdown als gemeinsame Repräsentation

Jede Quelle wird zuerst in **Canonical Markdown** normalisiert, danach laufen für alle Quellen dieselben Phasen:

```
Source (PDF/Audio/MD/TXT/HTML/CSV/...)
  ↓
[Normalize] → Canonical Markdown + Frontmatter + Raw Origin Ref
  ↓
[Template] → Structured Markdown (Frontmatter validiert/erweitert)
  ↓
[Ingest] → Vectors + Meta in MongoDB Vector Search
```

### Canonical Markdown Definition

**Minimum-Anforderungen** (basierend auf User-Requirements):

- **Text-only Normalisierung**: Keine Asset-Downloads im Normalize-Schritt (Bilder bleiben Links/Refs)
- **Frontmatter verpflichtend**: Jedes Canonical Markdown muss Frontmatter enthalten:
  - `source`: Quelle (Dateiname, URL, etc.)
  - `title`: Titel (aus Quelle extrahiert oder generiert)
  - `date`: Datum/Crawl-Zeit
  - `type`: Format-Typ (`pdf`, `audio`, `markdown`, `txt`, `website`, `csv`, etc.)
  - `originRef`: Referenz auf Original-Rohdaten-Artefakt (lossless)
- **Lossless Origin**: Original-Rohdaten werden zusätzlich als Artefakt gespeichert/verlinkt

### Artefakt-Typen (Shadow-Twin)

Wir unterscheiden drei Artefakt-Typen pro Quelle:

1. **`canonical`** (neu): Normalisiertes Markdown mit Frontmatter (Output von Normalize-Schritt)
2. **`raw`** (neu): Original-Rohdaten (HTML, CSV, TXT, etc.) als lossless Backup
3. **`transformation`** (bestehend): Template-transformiertes Markdown (Output von Template-Schritt)
4. **`transcript`** (bestehend): Für Audio/PDF – Transcript-Markdown (wird zu `canonical` für Textquellen)

**Naming-Konvention**:
- `canonical`: `{sourceName}.canonical.{lang}.md`
- `raw`: `{sourceName}.raw.{ext}` (z.B. `.html`, `.csv`, `.txt`)
- `transformation`: `{sourceName}.{template}.{lang}.md` (wie bisher)

### Source Adapter Interface

Jede Quelle implementiert einen **Source Adapter**:

```typescript
interface SourceAdapter {
  /**
   * Normalisiert die Quelle zu Canonical Markdown.
   * 
   * @param source Source-Daten (StorageItem, URL, etc.)
   * @returns Canonical Markdown + Meta + Raw Origin Referenz
   */
  normalize(source: SourceInput): Promise<CanonicalMarkdownResult>
}

interface CanonicalMarkdownResult {
  /** Normalisiertes Markdown mit Frontmatter */
  canonicalMarkdown: string
  /** Frontmatter-Metadaten */
  canonicalMeta: Record<string, unknown>
  /** Referenz auf gespeichertes Raw-Origin-Artefakt */
  rawOriginRef?: { fileId: string; fileName: string }
}
```

### Step-Naming (External-Jobs)

**Dynamisches Step-Naming** basierend auf `job.job_type`:

- `job_type: 'pdf'` → `extract_pdf`
- `job_type: 'audio'` → `extract_audio`
- `job_type: 'video'` → `extract_video`
- `job_type: 'text'` → `normalize_text` (neu, für Markdown/TXT)
- `job_type: 'website'` → `normalize_website` (neu)
- `job_type: 'csv'` → `normalize_csv` (neu)

**Template/Ingest Steps** bleiben einheitlich (`template`, `ingest`).

### Normalize-Adapter (Format-spezifisch)

#### Markdown (`normalize_text`)

- **Input**: Markdown-Datei (`.md`, `.mdx`)
- **Normalize**:
  - Trim Whitespace
  - Frontmatter erzwingen (falls fehlt: generiere aus Dateiname/Datum)
  - Body normalisieren (einheitliche Zeilenumbrüche)
- **Raw Origin**: Original-Markdown-Datei als `raw` Artefakt

#### TXT (`normalize_text`)

- **Input**: Plain-Text-Datei (`.txt`, `.log`)
- **Normalize**:
  - Wrap Text in Markdown-Body
  - Frontmatter generieren (Titel aus Dateiname, Datum, Typ)
- **Raw Origin**: Original-TXT-Datei als `raw` Artefakt

#### Website (`normalize_website`)

- **Input**: URL oder HTML-Datei
- **Normalize**:
  - Fetch HTML (falls URL)
  - Boilerplate-Reduktion (Readability-Algorithmus)
  - HTML → Markdown (z.B. via `turndown` oder Secretary Service)
  - Frontmatter mit URL, `fetchedAt`, `title` (aus `<title>` oder Meta)
- **Raw Origin**: Original-HTML als `raw` Artefakt
- **Bilder**: Zunächst nur Links/Refs; Asset-Download später als Add-on

#### CSV (`normalize_csv`)

- **Input**: CSV/TSV-Datei
- **Normalize**:
  - Parse CSV → Markdown-Tabellen
  - Frontmatter mit Spalten-Info, Zeilenanzahl, Delimiter
- **Raw Origin**: Original-CSV-Datei als `raw` Artefakt

### Preprocess-Core Generalisierung

**Aktuell**: `findPdfMarkdown()` ist PDF-zentriert.

**Ziel**: Generalisieren zu `findSourceMarkdown()`:

```typescript
async function findSourceMarkdown(
  provider: StorageProvider,
  parentId: string,
  sourceItemId: string,
  sourceName: string,
  lang: string,
  library: Library,
  options: FindSourceMarkdownOptions,
  userEmail: string
): Promise<FoundMarkdown> {
  // 1) Shadow-Twin-Service-Prüfung (wie bisher, aber ohne PDF-Annahmen)
  // 2) Fallback: Provider-basierte Suche (ohne `${baseName}.pdf` Fallback)
  // 3) Artefakt-Typ bestimmen (canonical/transformation/transcript) aus options.preferredKind
}
```

### Validierungsregeln (einheitlich)

**Globale Contracts** (für alle Formate):

1. **Canonical Markdown non-empty**: `canonicalMarkdown.trim().length > 0`
2. **Frontmatter required**: `canonicalMeta` muss mindestens `source`, `title`, `date`, `type` enthalten
3. **Raw Origin exists**: Wenn `rawOriginRef` gesetzt, muss das Artefakt existieren
4. **Template Output**: Transformation erzeugt Markdown mit Frontmatter
5. **Ingest Vectors**: `chunksUpserted > 0` und Meta/Chunks in Vector Search

**Format-spezifische Validierung** (optional):

- Markdown: Frontmatter-Syntax validieren
- Website: URL erreichbar, HTML parseable
- CSV: Delimiter erkannt, Spalten konsistent

### Integrationstest-Strategie

**Testcases pro Format**:

- Jedes Format hat mindestens einen **Happy-Path Testcase**:
  - `{format}_normalize.happy_path`: Normalize → Canonical Markdown
  - `{format}_template.happy_path`: Template → Transformation
  - `{format}_ingest.happy_path`: Ingest → Vectors

**Alle Testcases prüfen dieselben globalen Contracts** (siehe oben).

**Format-spezifische Checks** (optional):
- Markdown: Frontmatter-Syntax
- Website: URL-Erreichbarkeit, HTML→MD Konvertierung
- CSV: Tabellen-Struktur

### Implementations-Roadmap

1. ✅ **Docs-Update**: Zielbild dokumentiert (dieses Dokument)
2. 🚧 **Canonical Source Adapter Interface**: Neue Abstraktion (`src/lib/external-jobs/sources/*`)
3. 🚧 **Normalize für Markdown/TXT**: Implementierung
4. 🚧 **Normalize für Website**: Implementierung
5. 🚧 **Preprocess-Core Generalisierung**: `findPdfMarkdown` → `findSourceMarkdown`
6. 🚧 **Integrationstests vereinheitlichen**: Alle Formate testen dieselben Contracts

### Trade-offs

**Vorteile**:
- Einheitliche Pipeline für alle Formate
- Keine ad-hoc Entscheidungen pro Format
- Testbarkeit: Alle Formate testen dieselben Contracts
- Erweiterbarkeit: Neues Format = neuer Normalize-Adapter

**Nachteile**:
- Größerer Umbau (mehr Regression-Risiko)
- Normalize-Schritt für "triviale" Quellen (Markdown) kann Overhead sein
- Raw-Origin-Speicherung erhöht Storage-Anforderungen

**Mitigation**:
- Inkrementelle Implementierung (erst Markdown/TXT, dann Website)
- Unit-Tests für jeden Normalize-Adapter
- Integrationstests für Regression-Schutz

### Referenzen

- [`docs/guides/integration-tests.md`](../guides/integration-tests.md): Integrationstest-Guide
- [`docs/analysis/markdown-processing-pipeline.md`](./markdown-processing-pipeline.md): Markdown-spezifische Analyse
