## PDF Ingestion – Phasen, Gates, Start-/Endbedingungen

Ziel: Klarer, deterministischer Ablauf von PDF → Markdown → Metadaten → RAG‑Ingestion. Jede Phase startet erst, wenn die vorherige Phase abgeschlossen ist und ihre Artefakte im Filesystem verfügbar sind.

### Begriffe
- Shadow‑Twin: die erzeugte Markdown‑Datei (mit Frontmatter), gespeichert neben dem PDF.
- Doc‑Meta (Pinecone kind:'doc'): Status-/Metadatenvektor pro PDF (`fileId = PDF‑ID`), enthält u. a. `chunkCount`, `chaptersCount`.
- Chunks (Pinecone kind:'chunk'): inhaltliche Vektoren aus dem Markdown/Text.

### Datenfluss (hochlevel)
1) Phase 1: extract_pdf → erstellt Markdown (Shadow‑Twin) und provisorisches Doc‑Meta (Counter = 0)
2) Phase 2: transform_template → analysiert Template, aktualisiert Frontmatter, überschreibt Shadow‑Twin, aktualisiert Doc‑Meta (Counter = 0)
3) Phase 3: ingest_rag → chunkt/embeddet Markdown, upsertet Chunks, aktualisiert Doc‑Meta (Counter > 0)

Jede Phase commitet synchron in den Storage (Write → OK) bevor die nächste startet.

---

### Phase 1 – extract_pdf
**Eingänge**
- Quelle: PDF (Datei + `source.itemId`)
- Policies: `extract: 'do'|'force'|'ignore'`

**Schritte**
1. Worker (Secretary) extrahiert Text/Seitenbilder.
2. App erstellt Shadow‑Twin (Markdown, ggf. minimaler Frontmatter) und speichert ihn im Zielordner.
3. Doc‑Meta (kind:'doc') wird in Pinecone upsertet (Counter `chunkCount=0`, `chaptersCount=0`).

**Gates / Skip**
- `gateExtractPdf`: Kann Phase 1 überspringen, wenn Artefakt bereits existiert (z. B. Shadow‑Twin vorhanden) und Policy ≠ 'force'.

**Start der Phase 2**
- Wenn `store_shadow_twin` erfolgreich war und die Markdown‑Datei im Filesystem existiert (sichtbar über Provider‐API).

---

### Phase 2 – transform_template
**Eingänge**
- Shadow‑Twin (Markdown‐Inhalt), Policies: `metadata: 'do'|'force'|'ignore'`

**Schritte**
1. Markdown‐Inhalt ohne Frontmatter wird an den Template‑Transformer gesendet.
2. Strukturierte Metadaten (Frontmatter) werden gemerged, Shadow‑Twin wird überschrieben (neue Version).
3. Doc‑Meta (kind:'doc') wird erneut upsertet (Counter weiterhin `chunkCount=0`, `chaptersCount=0`).

**Gates / Skip**
- `transform_gate_skip` (z. B. `frontmatter_complete`) oder Policy 'ignore'.

**Start der Phase 3**
- Wenn Shadow‑Twin (aktualisierte Version) im Filesystem vorhanden ist. Kapitel im Frontmatter sind optional; fehlen sie, kann Phase 3 per Volltext‑Fallback chunken.

---

### Phase 3 – ingest_rag
**Eingänge**
- Shadow‑Twin (Markdown + Frontmatter)
- Policies: `ingest: 'do'|'force'|'ignore'` bzw. `ingestPolicy: 'do'|'force'|'skip'`

**Schritte**
1. Markdown wird gelesen (Quelle: Storage).
2. Kapitel‑basiertes Chunking; falls Kapitel fehlen/inkonsistent: Volltext‑Fallback (gesamter Body).
3. Embeddings werden erzeugt; Chunks werden als kind:'chunk' upsertet.
4. Doc‑Meta wird aktualisiert: `chunkCount` (≥ 0), `chaptersCount`.

**Gates / Skip**
- `gateIngestRag`: nur skippen, wenn Doc bereits existiert UND `chunkCount ≥ 1`.

**Ende / Ergebnis**
- Pinecone: Doc‑Meta + Chunks (Counter > 0 bei Vollingestion).

---

### Startpfade (Initiierung)
- Worker‑Callback (normaler Extraktionsfluss)
- Template‑Only / Retry‑Template: Shadow‑Twin wird lokal überschrieben; Abschluss erfolgt via interner Callback an den zentralen Handler; Phase 3 wird dort angestoßen.

---

### Phase‑Synchronisation – Minimalregeln
1. Phase 2 beginnt erst, wenn Shadow‑Twin existiert (Datei vorhanden, Provider gibt nicht‑leeren Inhalt zurück).
2. Phase 3 beginnt erst, wenn Shadow‑Twin existiert; Kapitel optional – bei fehlender Kapitelstruktur wird Volltext gechunkt.
3. Ingestion lädt ausschließlich aus dem Storage (kein Callback‑Inline‑Text), um Reihenfolge zu determinieren.

---

### Mermaid – Flow (Phasen, Gates, Artefakte)
```mermaid
flowchart TD
    A[Start: PDF ausgewählt] --> B{Gate Extract?}
    B -- Skip --> E[Shadow‑Twin vorhanden]
    B -- Run --> C[Phase 1: extract_pdf\nWorker OCR/Extraktion]
    C --> D[Save Shadow‑Twin (.md)\nUpsert DocMeta (Counters=0)]
    D --> E

    E --> F{Gate Template?}
    F -- Skip --> H[Shadow‑Twin bleibt]
    F -- Run --> G[Phase 2: transform_template\nTemplate anwenden]
    G --> H[Save Shadow‑Twin (.md)\nUpsert DocMeta (Counters=0)]

    H --> I{Gate Ingestion?\nDoc exists & chunkCount≥1}
    I -- Skip --> K[Ende]
    I -- Run --> J[Phase 3: ingest_rag\nChunking + Embeddings]
    J --> L[Upsert Chunks + Update DocMeta\nCounters>0]
    L --> K[Ende]
```

---

### Mögliche Fehlerstellen & Checks
- Doppel‑Upserts: Provisorisches Doc‑Meta (Counter=0) darf spätere Zählerwerte nicht überschreiben → Ingestion setzt final `chunkCount/chaptersCount`.
- Gate‑Präzision: Ingestion nur skippen, wenn `chunkCount ≥ 1`.
- Persistenz: Nach jedem Save bestätigt der Provider die erfolgreiche Speicherung (synchrones API‑Verhalten). Der Orchestrator startet die nächste Phase erst nach erfolgreichem Save‐Return.

---

### Zusammenfassung der Start-/Endkriterien je Phase
- P1 start: PDF vorhanden, Policy erlaubt (do|force).
- P1 end: Shadow‑Twin gespeichert, Doc‑Meta upsertet (Counter=0).
- P2 start: Shadow‑Twin existiert (lesbar).
- P2 end: Shadow‑Twin überschrieben (Frontmatter), Doc‑Meta upsertet (Counter=0).
- P3 start: Shadow‑Twin existiert (lesbar). Kapitel optional.
- P3 end: Chunks + Doc‑Meta aktualisiert (Counter>0 bei Vollingestion).


