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

---

### Log‑Referenz: Zuordnung der Phasen und Bedeutung
Die folgenden Log‑Phasen stammen aus einem realen Joblauf und sind dem obigen Flow zugeordnet. Ziel ist eine eindeutige Interpretation im UI und bei der Fehlersuche.

#### Orchestrierung/Allgemein
- request_sent: Aufruf an den Worker/Transformer wurde abgesetzt (mit Quelle/Ziel/Callback).
- request_ack (202 ACCEPTED): Backend hat den Auftrag entgegengenommen.
- completed: Gesamtjob abgeschlossen (alle geplanten Phasen fertig oder übersprungen).
- stored_path: Pfad/Dateiname des gespeicherten Shadow‑Twins (Transparenz/Verifikation).

#### Phase 1 – extract_pdf
- extract_gate_plan: Gate‑Entscheidung für Extraktion → „wird ausgeführt“ (nicht geskippt).
- initializing (progress ~5): Jobkontext im Worker angelegt.
- running (progress 10): Upload startet.
- running (progress 30): Upload abgeschlossen.
- running (progress 60): OCR‑Anfrage an Mistral gesendet.
- running (progress 75): OCR‑Antwort empfangen (keine Erfolgs‑Garantie, nur Zwischenstand).
- running (progress 85): Ergebnis geparst (Seitenanzahl erkannt).
- running (progress 90): Verarbeitung abgeschlossen (Worker‑intern, noch kein Endstatus).
- postprocessing (progress 95): Ergebnisse werden gespeichert (neutraler Post‑Processing‑Schritt; kein Erfolgsbeweis).

Hinweis zur Fehlersemantik: Ein finales Fehlerereignis kommt als phase:"failed" bzw. status:"error" im Callback. Nach einem „failed“ dürfen keine „running“‑Events mehr als heilend interpretiert werden.

#### Phase 2 – transform_template
- transform_gate_plan: Gate‑Entscheidung → Transformation wird ausgeführt.
- transform_meta: Metadaten aus Template berechnet (Frontmatter generiert/aktualisiert).
- stored_local: Shadow‑Twin (Markdown) gespeichert/überschrieben.
- doc_meta_upsert: Provisorisches Doc‑Meta (kind:'doc') upserted (Counter bleiben 0).

Interpretation: Nach `stored_local` muss der Shadow‑Twin im Storage lesbar sein (Write‑Commit). `doc_meta_upsert` bestätigt die Aktualisierung der Dokument‑Metadaten in Pinecone (meist 1 Vektor = Doc‑Meta).

#### Phase 3 – ingest_rag
- ingest_gate_plan: Gate‑Entscheidung → Ingestion wird ausgeführt.
- ingest_rag: Ingestion‑Policy/Entscheidung geloggt (z. B. "do").
- ingest_start: Ingestion startet; Zusatzinfo (z. B. pages=0) beschreibt Quelle/Erkennung.
- indextidy: Alte Vektoren gelöscht (Bereinigung vor Upsert), der Doc‑Meta‑Vektor wird danach erneut upserted.
- chapters_page_not_found: Kapitel mit unvollständigem Seitenbereich erkannt (z. B. `endPage=null`); Fallback setzt intern `endPage=startPage`.
- ingest_chunking_done: Chunking abgeschlossen (z. B. 0 Chunks, 1 Vektoren = nur Doc‑Meta).
- ingest_pinecone_upserted: Upsert abgeschlossen (Zählwerte spiegeln tatsächliche Einfügungen).
- ingest_rag (finale Zusammenfassung): Ergebnis der Ingestion (Chunks, Doc‑Meta).

Interpretation: Die Ingestion aktualisiert am Ende das Doc‑Meta mit `chunkCount` und `chaptersCount`. Skip ist nur zulässig, wenn Doc existiert UND `chunkCount ≥ 1`.

---

### Beispielauswertung der vorliegenden Logs (gekürzt)
- Extract‑Pfad: Erfolgreich bis Post‑Processing, keine Fehler‑Events → Phase 2 startet.
- Template‑Pfad: `transform_meta` + `stored_local` belegen, dass Frontmatter erzeugt und Shadow‑Twin gespeichert wurde; anschl. Doc‑Meta upsert.
- Ingestion‑Pfad: Gate/Policy "do" → Start; `chapters_page_not_found` zeigt ein Kapitel mit unklarem Seitenbereich; Chunking ergibt 0 Chunks, aber Doc‑Meta bleibt bestehen (1 Vektor). Dies ist konsistent, wenn z. B. ein Einseiten‑Dokument vorliegt oder Kapitel/Seiten nicht matchen. Mit den implementierten Fallbacks (endPage=startPage, Orphan‑Pages) sollten künftig mehr Chunks entstehen; mindestens aber bleibt Doc‑Meta korrekt.

---

## Job‑Dokument: Schema und Fülllogik

Das Job‑Dokument bündelt Orchestrierungs‑, Status‑ und Diagnosedaten. Unten eine typisierte Sicht mit kurzer Erläuterung, wann welches Feld gesetzt/aktualisiert wird.

```ts
interface ExternalJob {
  _id: string;                       // MongoDB ID (bei Erstellung)
  jobId: string;                     // UUID (bei Erstellung)
  jobSecretHash: string;             // Secret‑Hash für Callback‑Auth (bei Erstellung, bei Requeue erneuert)
  job_type: 'pdf';                   // Jobtyp (bei Erstellung)
  operation: 'extract';              // Startoperation (bei Erstellung)
  worker: 'secretary' | 'internal';  // initial 'secretary' (OCR), intern für Template‑Only/Retry (Callback‑Bypass)
  status: 'queued' | 'running' | 'completed' | 'failed'; // Phasen‑übergreifender Gesamtstatus
  libraryId: string;                 // Zielbibliothek (bei Erstellung)
  userEmail: string;                 // Initiator (bei Erstellung)

  correlation: {
    jobId: string;                   // Spiegel des jobId für Fremdsysteme
    libraryId: string;               // Spiegel
    source: {
      mediaType: 'pdf';
      mimeType: string;
      name: string;                  // Ursprungsdateiname
      itemId: string;                // Kanonischer PDF‑FileId (Base64 Pfad); wichtig für Pinecone IDs
      parentId: string;              // Zielordner
    };
    options: {
      targetLanguage: string;
      extractionMethod: string;      // z. B. 'mistral_ocr'
      includeImages: boolean;
      useCache: boolean;
    };
    batchId?: string | null;         // Batch‑Kontext
    batchName?: string | null;
  };

  createdAt: Date;                   // bei Erstellung
  updatedAt: Date;                   // bei jeder Mutation

  parameters: {
    targetLanguage: string;
    extractionMethod: string;
    includeImages: boolean;
    useCache: boolean;
    template?: string;               // Template‑Name (z. B. 'pdfanalyse')
    phases: { extract: boolean; template: boolean; ingest: boolean };
    policies: {                      // Orchestrierungs‑Policies (vereinheitlicht zu ingestPolicy im Callback)
      extract: 'do' | 'force' | 'ignore';
      metadata: 'do' | 'force' | 'ignore';
      ingest: 'do' | 'force' | 'ignore';
    };
  };

  steps: Array<{
    name: 'extract_pdf' | 'transform_template' | 'store_shadow_twin' | 'ingest_rag';
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt?: Date;
    endedAt?: Date;
    skipped?: boolean;               // wenn Gate skippt
  }>;                                 // wird phasenweise aktualisiert (Callback)

  logs: Array<{
    timestamp: Date;
    phase: string;                   // siehe Log‑Referenz oben
    message?: string;
    progress?: number;
    status?: number;                 // HTTP Status z. B. 202
    [k: string]: unknown;
  }>;                                 // nur Anfügen (append‑only)

  processId?: string;                // Lauf‑Korrelation; wechselt bei Requeue; Guard gegen alte Events

  metaHistory?: Array<{              // Historie signifikanter Metadatenstände
    at: Date;
    meta: Record<string, unknown>;
    source: 'template_pick' | 'template_transform' | 'ingestion' | 'manual';
  }>;

  cumulativeMeta?: Record<string, unknown>; // letztes konsolidiertes Metaset (nur Markdown‑/Template‑relevant)

  ingestion?: {                      // Ingestion‑Ergebnis (Dokumentebene)
    upsertAt?: Date;
    vectorsUpserted?: number;        // Anzahl upserteter Vektoren in der letzten Ingestion‑Runde
    index?: string;                  // Pinecone‑Indexname
  };

  payload?: {                        // Nur für kurzfristige Übergaben; keine Orchestrations‑Quelle
    extracted_text?: string;         // vom Worker; wird NICHT für Ingestion bevorzugt gelesen
    images_archive_url?: string | null;
    metadata?: { text_contents: string[] };
  };

  result?: {                         // Artefakt‑Ergebnis
    savedItemId?: string;            // Shadow‑Twin ID (Markdown)
    savedItems?: string[];           // ggf. weitere Artefakte
  };
}
```

### Fülllogik je Bereich (wann/wo gesetzt)
- Erstellung (API `secretary/process-pdf`)
  - Setzt: `jobId`, `jobSecretHash`, `job_type`, `operation`, `worker='secretary'`, `status='queued'|'running'`, `libraryId`, `userEmail`, `correlation`, `parameters`, `steps` (alle `pending`), `createdAt`, `updatedAt`.
  - Logs: `request_sent`, `extract_gate_plan`, `request_ack`.
  - `processId` initial vergeben.

- Worker‑Callback (`/api/external/jobs/[jobId]`)
  - Aktualisiert phasenweise `steps[*]` inkl. `startedAt`/`endedAt`, setzt bei Fehlern `status='failed'` (terminal).
  - Logs: `initializing`/`running`/`postprocessing` (Phase 1), Gate‑Logs, Abschluss‑Logs; `stored_local`/`stored_path` (nach Speichern).
  - Setzt/aktualisiert `payload.extracted_text` (bei Phase 1), löst Folgephasen (2/3) aus.
  - Schreibt `metaHistory`/`cumulativeMeta` bei Template‑Ergebnissen (Phase 2).
  - Schreibt `ingestion` bei Phase 3 (Zeitpunkt, Vektoranzahl, Indexname).

- Template‑Only/Retry (interner Callback)
  - Führt lokale Transformation aus, schreibt Shadow‑Twin, ruft internen Callback (mit `X-Internal-Token`), damit zentrale Route identisch orchestriert.
  - Logs analog: `transform_gate_plan`, `transform_meta`, `stored_local`, `doc_meta_upsert`.

- Ingestion (Service)
  - Liest Shadow‑Twin ausschließlich aus Storage (Determinismus), erzeugt Chunks/Embeddings.
  - Logs: `ingest_gate_plan`, `ingest_start`, `indextidy`, `ingest_chunking_done`, `ingest_pinecone_upserted`, finale `ingest_rag` Zusammenfassung.
  - Aktualisiert: `ingestion.upsertAt`, `ingestion.vectorsUpserted`, `ingestion.index`.
  - Achtung: Pinecone Doc‑Meta (`kind:'doc'`) wird außerhalb des Jobdokuments gepflegt; Zähler stehen dort, nicht im Jobdokument.

### Wiederholte/überschriebene Felder
- `updatedAt`: bei jeder Mutation.
- `steps[*]`: Statusübergänge (pending→running→completed|failed); Zeitstempel gesetzt/überschrieben pro Phase.
- `logs`: append‑only; nie überschreiben.
- `jobSecretHash`: kann bei Requeue erneuert werden (alte Worker‑Events werden dann abgewiesen; `processId`‑Guard zusätzlich aktiv).
- `result.savedItemId`: wird bei erneutem Speichern des Shadow‑Twins konsistent gesetzt (identisch, wenn gleicher Pfad/Name).
- `cumulativeMeta`: wird bei jeder Template‑Aktualisierung überschrieben (Quelle: `metaHistory` letzter Stand).

### Quellen‑IDs (Kanonisierung)
- Pinecone verwendet stets `correlation.source.itemId` (PDF‑ID) als kanonische `fileId` – auch wenn die Inhalte aus dem Shadow‑Twin stammen. Dadurch ist Lookup in `file-status` konsistent.


### Kapitel: Chunker‑Logik und Toleranz (Ingestion)

Ziel: Die Ingestion soll bereits normalisierte Kapitel (aus dem Analyze‑Endpoint) robust verwenden und nicht erneut scheitern, wenn Seitenanker im Body unvollständig sind.

- Body‑Extraktion: Frontmatter wird entfernt; der verbleibende Text wird mit `splitByPages` an `--- Seite N ---` Ankern in Seitenbereiche geteilt.
- Seitenanzahl: Wenn im Frontmatter `pages` gesetzt ist, wird dieser Wert für Statistiken und Clamping bevorzugt. Fehlen Seitenanker, behandelt der Chunker den gesamten Body als eine Seite.
- Toleranzregeln je Kapitel:
  - Fehlende `endPage` → auf `startPage` setzen.
  - Fehlende `startPage` → auf 1 setzen.
  - Unterlauf/Überlauf → auf [1, maxAvailablePage] clampen; `maxAvailablePage` ist `meta.pages` oder der letzte erkannte Seitenanker.
  - Keine Segmente gefunden → kein harter Abbruch; Kapitel kann trotzdem eine Summary‑Vektorisierung bekommen.
- Evidence‑Prüfung: Es wird eine einfache Regex ohne Unicode‑Property Escapes verwendet, um Start‑Snippets tolerant zu matchen; sie dient nur der Diagnose (Logs), nicht als Gate.
- Ergebnis: Kapiteltexte werden nach den korrigierten Bereichen zusammengesetzt, in Chunks geteilt, Embeddings erzeugt und upsertet. Zusätzlich wird ein Doc‑Meta‑Vektor gepflegt (Counter: `chunkCount`, `chaptersCount`).

Rationale: Die Kapitelstruktur wurde zuvor bereits analysiert und repariert. In der Ingestion validieren wir daher nicht hart erneut, sondern sorgen dafür, dass die Injektion in den Vektor‑Store möglichst deterministisch gelingt.


