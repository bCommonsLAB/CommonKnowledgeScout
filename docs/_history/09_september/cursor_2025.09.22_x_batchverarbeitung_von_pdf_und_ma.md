# Batchverarbeitung von PDF und Markdown
_Exported on 10/9/2025 at 15:03:16 GMT+2 from Cursor (1.7.38)_

---

**User**

Bei der Batchverarbeitung von PDF-Verzeichnissen kann ich explizit sagen, ob ich bestehende Markdown-Dateien, also diesen Step 1, erzwingen will oder nicht. Obwohl ich hier es nicht erzwinge, wird im Batch der Step 1 trotzdem durchgeführt. Das PDF wird nochmal in Markdown konvertiert. Woran kann das liegen? Das PDF wird nochmal in Markdown konvertiert.

Wie werden batches eingereicht und die einzelnen Jobs verarbeitet? Welche Parameter bewirken was?

---

**Cursor**

Ich suche jetzt gezielt nach der Batch-/Job-Verarbeitung und den Parametern (Force/Erzwingen) in der Codebasis, um die Ursache zu finden, warum Phase 1 trotz Deaktivierung läuft. Ich starte mehrere Suchen parallel nach Batch-Submission, Job-Routen und PDF-Extraction/Markdown-Konvertierung.

Ich prüfe jetzt im Job-Callback die Steuerlogik für Phase 1 (Gate/Skip) und ob `doExtractPDF` bzw. `forceRecreate` berücksichtigt werden, um zu erklären, warum die Extraktion trotzdem läuft.

Ich gehe jetzt direkt in den Callback-Handler `src/app/api/external/jobs/[jobId]/route.ts` und lese den Abschnitt zur Extraktion (Step 1), um zu sehen, ob ein Gate/Skip existiert und wie `doExtractPDF`/`forceRecreate` wirken.

---

**User**

Ich glaube der Fehler liegt nicht im callback. Der Job wird schon falsch in der datenbank gespeichert. step mit name extract_pdf wird angestossen - sollte ignoriert sein
{
  "_id": {
    "$oid": "68d0d81400a3ba5e69a57e9a"
  },
  "jobId": "2d37ac0b-626b-4c60-b221-b9b19025d57c",
  "jobSecretHash": "f87c548ff7c9449e8347e723dc27bc63ccb162df68d84ba3f045d0395e15d047",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "failed",
  "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "2d37ac0b-626b-4c60-b221-b9b19025d57c",
    "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "MargitEtAl_2010_EctomycorrhizalStatusOfLarixDecidua,PiceaAbies&PinusCembraPlants_ForestObserver_5_p.pdf",
      "itemId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDEwL01hcmdpdEV0QWxfMjAxMF9FY3RvbXljb3JyaGl6YWxTdGF0dXNPZkxhcml4RGVjaWR1YSxQaWNlYUFiaWVzJlBpbnVzQ2VtYnJhUGxhbnRzX0ZvcmVzdE9ic2VydmVyXzVfcC5wZGY=",
      "parentId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDEw"
    },
    "options": {
      "targetLanguage": "de",
      "extractionMethod": "mistral_ocr",
      "includeImages": false,
      "useCache": true
    },
    "batchId": "b9bc4418-fff9-40dc-89bb-ac41fb0dda75",
    "batchName": "Fachart/ZeitschrBZ/Forest Observer/2010"
  },
  "createdAt": {
    "$date": "2025-09-22T05:01:08.243Z"
  },
  "updatedAt": {
    "$date": "2025-09-22T05:01:10.391Z"
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "failed",
      "details": {
        "reason": "worker_unavailable",
        "message": "fetch failed"
      },
      "endedAt": {
        "$date": "2025-09-22T05:01:10.306Z"
      }
    },
    {
      "name": "transform_template",
      "status": "pending"
    },
    {
      "name": "store_shadow_twin",
      "status": "pending"
    },
    {
      "name": "ingest_rag",
      "status": "pending"
    }
  ],
  "parameters": {
    "targetLanguage": "de",
    "extractionMethod": "mistral_ocr",
    "includeImages": false,
    "useCache": true,
    "template": "pdfanalyse",
    "doExtractPDF": true,
    "doExtractMetadata": true,
    "doIngestRAG": false,
    "forceRecreate": false,
    "forceTemplate": true,
    "batchId": "b9bc4418-fff9-40dc-89bb-ac41fb0dda75",
    "batchName": "Fachart/ZeitschrBZ/Forest Observer/2010"
  },
  "logs": [
    {
      "timestamp": {
        "$date": "2025-09-22T05:01:10.273Z"
      },
      "phase": "request_sent_requeue",
      "callbackUrl": "http://localhost:3000/api/external/jobs/2d37ac0b-626b-4c60-b221-b9b19025d57c"
    }
  ]
}

---

**Cursor**

Ich prüfe jetzt, wo die Retry-Route implementiert ist und wie sie Step 1 startet bzw. welche Parameter ausgewertet werden. Ich suche parallel nach der Retry-Route und nach der Stelle, wo `doExtractPDF` in der Retry-Logik geprüft wird.

---

**User**

Aber wo wird im Datenmodell bei forceRecreate unterschieden zwischen doExtractPDF, doExtractMetadata und doIngestRAG?



---

**Cursor**

Ich habe die Batch‑Einreichung, Retry‑Ausführung und Gates geprüft. Befund: In der Batch‑Pipeline wird Phase 1 immer angestoßen – unabhängig vom „Erzwingen“-Häkchen.

Woran liegt’s konkret?
- Batch legt Jobs mit Phase‑1 immer aktiv an und setzt `doExtractPDF` hart auf true:
```91:110:src/app/api/secretary/process-pdf/batch/route.ts
          steps: [
            { name: 'extract_pdf', status: 'pending' },
            { name: 'transform_template', status: 'pending' },
            { name: 'store_shadow_twin', status: 'pending' },
            { name: 'ingest_rag', status: 'pending' },
          ],
          parameters: {
            ...
            doExtractPDF: true,
            doExtractMetadata: !!options?.doExtractMetadata,
            doIngestRAG: !!options?.doIngestRAG,
            forceRecreate: !!options?.forceRecreate,
            forceTemplate: !!options?.forceTemplate,
```
- Danach startet die Batch‑Route sofort die Retry‑Route für jeden Job:
```118:136:src/app/api/secretary/process-pdf/batch/route.ts
const res = await fetch(new URL(`/api/external/jobs/${jobId}/retry`, request.url).toString(), { method: 'POST', ... });
```
- Die Retry‑Route ignoriert `doExtractPDF`/`forceRecreate` und ruft den Secretary immer zur Extraktion auf:
```56:65:src/app/api/external/jobs/[jobId]/retry/route.ts
await repo.initializeSteps(jobId, [ ...extract_pdf..., ... ], job.parameters);
await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
// Secretary aufrufen (ohne Gate/Flags)
response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
```
- Ein Extract‑Gate existiert zwar, wird aber nur im Single‑Upload verwendet, nicht im Batch/Retry:
```300:319:src/app/api/secretary/process-pdf/route.ts
const g = await gateExtractPdf(...);
if (g.exists && !forceRecreate) {
  await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', details: { skipped: true, reason: g.reason } });
  // Template‑Only Pfad...
}
```
```26:55:src/lib/processing/gates.ts
export async function gateExtractPdf(...) { /* Shadow‑Twin vorhanden? → exists: true */ }
```

Wie werden Batches eingereicht und Jobs verarbeitet?
- UI sendet an `POST /api/secretary/process-pdf/batch` mit Optionen und Items.
- Server legt pro Item einen `ExternalJob` an, markiert alle vier Steps „pending“, setzt `doExtractPDF: true`, `doExtractMetadata`, `doIngestRAG`, optional `forceRecreate/forceTemplate`.
- Anschließend startet der Server für jedes `jobId` die Retry‑Route, die den Secretary immer mit dem PDF aufruft.
- Der Secretary callbackt auf `POST /api/external/jobs/[jobId]`; dort laufen Phase‑2/3‑Gates (Template/Ingestion).

Welche Parameter bewirken was (heute tatsächlich)?
- parameters.doExtractPDF: Im Batch/Retry NICHT ausgewertet; Extraktion läuft trotzdem.
- parameters.doExtractMetadata: Im Callback ausgewertet; steuert, ob Template‑Transform versucht wird, sofern kein Gate‑Skip greift.
```268:304:src/app/api/external/jobs/[jobId]/route.ts
const doExtractMetadata = !!(job.parameters...['doExtractMetadata']);
...
const g = await gateTransformTemplate(...); if (g.exists) mark skip
```
- parameters.doIngestRAG: Im Callback ausgewertet; steuert Ingestion, wenn `gateIngestRag` nicht „exists“ liefert.
```544:548:src/app/api/external/jobs/[jobId]/route.ts
const useIngestion = !!(job.parameters...['doIngestRAG']);
```
- parameters.forceRecreate: Kein per‑Phase‑Feld. Wird nur im Single‑Upload vor dem Secretary‑Call zur Extract‑Gate‑Übersteuerung genutzt; im Batch/Retry ignoriert.
- parameters.forceTemplate: Existiert im Batch‑Job, wird serverseitig derzeit nirgends ausgewertet.

Antwort auf deine Frage
- Es gibt im Datenmodell keine per‑Phase‑Unterscheidung von „force“. `forceRecreate` ist ein globales Flag, das nur in `process-pdf` (Single‑Upload) Phase‑1‑Gating beeinflusst. Für Batch/Retry wird es nicht beachtet. `doExtractPDF/doExtractMetadata/doIngestRAG` sind reine Wunsch‑Phasen, aber `doExtractPDF` hat aktuell keine Wirkung im Batchpfad.

Kurz: Dass Step 1 trotzdem läuft, ist ein Implementierungsproblem im Batchpfad: unbedingter Retry‑Call ohne Extract‑Gate/Flag‑Beachtung.

Vorschlag Korrektur (minimal-invasiv, drei Optionen):
- A) Retry‑Route erweitern: Vor Secretary‑Call `gateExtractPdf` prüfen und, falls `exists && !forceRecreate`, `extract_pdf` als „completed/skipped“ markieren und den Template‑Only‑Zweig analog zu `process-pdf` ausführen.
- B) Batch‑Route: Vor dem Retry‑Start pro `jobId` `gateExtractPdf` ausführen und bei Skip direkt Template‑Only verarbeiten (Code aus `process-pdf` wiederverwenden), sonst Retry aufrufen.
- C) Wenn gewünscht per‑Phase‑Force: Datenmodell um `forceExtract`, `forceTemplate`, `forceIngest` erweitern und in Retry/Callback konsequent auswerten. Aktuell ist `forceTemplate` unverdrahtet.

Wenn du willst, setze ich Option A um (geringste Änderungen, zentrale Logik).

```typescript
          steps: [
            { name: 'extract_pdf', status: 'pending' },
            { name: 'transform_template', status: 'pending' },
            { name: 'store_shadow_twin', status: 'pending' },
            { name: 'ingest_rag', status: 'pending' },
          ],
          parameters: {
            ...
            doExtractPDF: true,
            doExtractMetadata: !!options?.doExtractMetadata,
            doIngestRAG: !!options?.doIngestRAG,
            forceRecreate: !!options?.forceRecreate,
            forceTemplate: !!options?.forceTemplate,
```

```typescript
const res = await fetch(new URL(`/api/external/jobs/${jobId}/retry`, request.url).toString(), { method: 'POST', ... });
```

```typescript
await repo.initializeSteps(jobId, [ ...extract_pdf..., ... ], job.parameters);
await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
// Secretary aufrufen (ohne Gate/Flags)
response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
```

```typescript
const g = await gateExtractPdf(...);
if (g.exists && !forceRecreate) {
  await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', details: { skipped: true, reason: g.reason } });
  // Template‑Only Pfad...
}
```

```typescript
export async function gateExtractPdf(...) { /* Shadow‑Twin vorhanden? → exists: true */ }
```

```typescript
const doExtractMetadata = !!(job.parameters...['doExtractMetadata']);
...
const g = await gateTransformTemplate(...); if (g.exists) mark skip
```

```typescript
const useIngestion = !!(job.parameters...['doIngestRAG']);
```

---

**User**

Ja C ist jetzt zu implementieren. Aber die benamungen stimmen nicht 
Damit man leicht versteht würde ich diese Parameter 
doExtractPDF -> forceExtractPDF
doExtractMetadata  -> forceExtractMetadata
doIngestRAG -> forceIngestRAG
nennen.

oder wir ändern die Werte von doExtractPDF, doExtractMetadata, doIngestRAG  von boolean auf typisiert "ignore", "do", "force"
Muss halt überall im code repariert werden.
Was ist besser?

---

**Cursor**

Ich erstelle jetzt Aufgaben für die Umstellung auf tri‑state Policies und beginne mit der Einführung eines zentralen Policy-Typs + Helfern. Danach passe ich Batch‑Route, Retry‑Route, Callback und UI an.

Ich aktualisiere jetzt den Code: 1) neue zentrale Policy-Typen/Helfer, 2) Batch-Route legt Policies in `parameters` ab, 3) Retry-Route wertet Policies + Gate aus und überspringt Extraktion ggf., 4) Callback-Route nutzt Policies für Phase 2/3. Danach prüfe ich Linterfehler für die bearbeiteten Dateien.

Kurz vorweg: Der aktuelle Bug kommt daher, dass `doExtractPDF` im Batch immer auf true steht und die Retry‑Route Phase 1 ohne jedes Gate anstößt. Deine Frage betrifft nun das richtige Modell für die Steuerung.

Empfehlung
- Besser ist ein typisiertes Tri‑State‑Modell je Phase: 'ignore' | 'do' | 'force'. Das ist semantisch klarer als reine „force“-Boolean‑Flags und drückt explizit „überspringen“ aus. Booleans führen schnell zu Mehrdeutigkeiten (was heißt false? skip oder auto‑gate?) und skalieren schlecht.
- Zusätzlich behalten wir einen Kompatibilitäts‑Layer für die bisherigen Flags bei und mappen sie deterministisch auf die Policies.

Vorschlag Datenmodell
- PhaseDirective: 'ignore' | 'do' | 'force'
- Policies pro Phase: extract, metadata, ingest
- Entscheidungslogik: Gate‑Ergebnisse nur bei 'do' berücksichtigen; 'ignore' überspringt; 'force' erzwingt.

Beispieltypen und Helfer
```ts
export type PhaseDirective = 'ignore' | 'do' | 'force';

export interface PhasePolicies {
  extract: PhaseDirective;
  metadata: PhaseDirective;
  ingest: PhaseDirective;
}

export function shouldRunExtract(shadowTwinExists: boolean, p: PhaseDirective): boolean {
  if (p === 'ignore') return false;
  if (p === 'force') return true;
  return !shadowTwinExists; // 'do' respektiert Gate
}

export function shouldRunWithGate(gateExists: boolean, p: PhaseDirective): boolean {
  if (p === 'ignore') return false;
  if (p === 'force') return true;
  return !gateExists; // 'do' respektiert Gate
}

// Legacy-Compat (heutige Felder → Policies)
export function legacyToPolicies(params: {
  doExtractPDF?: boolean; doExtractMetadata?: boolean; doIngestRAG?: boolean;
  forceRecreate?: boolean; forceTemplate?: boolean;
}): PhasePolicies {
  const extract = params.forceRecreate ? 'force' : (params.doExtractPDF ? 'do' : 'ignore');
  const metadata = params.doExtractMetadata ? (params.forceTemplate ? 'force' : 'do') : 'ignore';
  const ingest = params.doIngestRAG ? 'do' : 'ignore';
  return { extract, metadata, ingest };
}
```

Wo eingreifen und Wirkung der Policies
- `src/app/api/secretary/process-pdf/batch/route.ts`: Beim Anlegen der Jobs `parameters.policies = { extract, metadata, ingest }` setzen; Legacy‑Flags zusätzlich mitschreiben für Backward‑Compat; `doExtractPDF` nicht mehr hart auf true.
- `src/app/api/external/jobs/[jobId]/retry/route.ts`: Vor Secretary‑Call `gateExtractPdf` benutzen. Wenn `policies.extract !== 'force'` und Gate true, Phase 1 als „skipped“ markieren und in den Template‑Only‑Pfad verzweigen. Wenn `policies.metadata === 'ignore'`, Phase 2 ebenfalls „skipped“. Gleiches Muster für Ingestion. Nur wenn `shouldRunExtract(...)` true ist, Secretary starten.
- `src/app/api/external/jobs/[jobId]/route.ts` (Callback): Template‑Gate/Ingestion‑Gate nur anwenden, wenn Policy 'do'. Bei 'ignore' Schritt skippen, bei 'force' Gate übergehen.
- UI `src/components/library/pdf-bulk-import-dialog.tsx` und `src/components/library/phase-stepper.tsx`: Checkboxes auf Policies mappen:
  - Extraktion: unchecked → 'ignore'; checked ohne „Erzwingen“ → 'do'; checked+„Erzwingen“ → 'force'
  - Metadaten analog; Ingestion analog.
- `src/lib/transform/transform-service.ts` und `src/lib/secretary/client.ts`: `PdfTransformOptions` um `policies?: PhasePolicies` erweitern, Legacy‑Flags weiterreichen bis Migration abgeschlossen.

Warum Tri‑State besser ist
- Explizitheit: „ignore“ vs „do“ vs „force“ ist selbsterklärend und macht Logs/Reports eindeutig.
- Korrekte Idempotenz: 'do' + Gate sorgt dafür, dass wir vorhandene Artefakte nicht neu erzeugen; 'force' bricht Idempotenz bewusst.
- Erweiterbarkeit: Weitere Phasen (z. B. Bilder extrahieren) lassen sich nahtlos mit derselben Semantik einfügen.

Wenn du zustimmst, setze ich es so um: zentrale `PhaseDirective` + Helper, Batch‑Route schreibt Policies, Retry‑ und Callback‑Routen werten sie aus, UI sendet Policies; Legacy‑Flags bleiben lesbar und werden gemappt. Tests: je Phase drei Cases ('ignore'/'do'/'force') plus Gate true/false.

```typescript
export type PhaseDirective = 'ignore' | 'do' | 'force';

export interface PhasePolicies {
  extract: PhaseDirective;
  metadata: PhaseDirective;
  ingest: PhaseDirective;
}

export function shouldRunExtract(shadowTwinExists: boolean, p: PhaseDirective): boolean {
  if (p === 'ignore') return false;
  if (p === 'force') return true;
  return !shadowTwinExists; // 'do' respektiert Gate
}

export function shouldRunWithGate(gateExists: boolean, p: PhaseDirective): boolean {
  if (p === 'ignore') return false;
  if (p === 'force') return true;
  return !gateExists; // 'do' respektiert Gate
}

// Legacy-Compat (heutige Felder → Policies)
export function legacyToPolicies(params: {
  doExtractPDF?: boolean; doExtractMetadata?: boolean; doIngestRAG?: boolean;
  forceRecreate?: boolean; forceTemplate?: boolean;
}): PhasePolicies {
  const extract = params.forceRecreate ? 'force' : (params.doExtractPDF ? 'do' : 'ignore');
  const metadata = params.doExtractMetadata ? (params.forceTemplate ? 'force' : 'do') : 'ignore';
  const ingest = params.doIngestRAG ? 'do' : 'ignore';
  return { extract, metadata, ingest };
}
```

---

**User**

ja bitte und im code nach bestehender logik zu doExtractPDF, doExtractMetadata.  doIngestRAG suchen, und diese ersetzen/updaten.

---

**Cursor**

Ich markiere jetzt die erste Aufgabe als in Arbeit und suche parallel alle Fundstellen der Legacy-Flags, während ich die neue Policy-Datei erstelle.

Ich beginne mit der Implementierung: füge eine neue Policy-Datei hinzu, aktualisiere die Batch-Route zur Nutzung der Policies, passe die Retry-Route an (Gate + Template-Only bei Skip) und erweitere den Callback um Policy-Auswertung. Danach prüfe ich Linterfehler der geänderten Dateien.

```typescript
import type { ExternalJob } from '@/types/external-jobs';

// Zentrale, typisierte Steuerung je Phase
export type PhaseDirective = 'ignore' | 'do' | 'force';

export interface PhasePolicies {
  extract: PhaseDirective;
  metadata: PhaseDirective;
  ingest: PhaseDirective;
}

export function shouldRunWithGate(gateExists: boolean, directive: PhaseDirective): boolean {
  if (directive === 'ignore') return false;
  if (directive === 'force') return true;
  return !gateExists; // 'do' respektiert Gate
}

export function shouldRunExtract(shadowTwinExists: boolean, directive: PhaseDirective): boolean {
  return shouldRunWithGate(shadowTwinExists, directive);
}

// Kompatibilität: Bestehende Flags → Policies
export function legacyToPolicies(params: unknown): PhasePolicies {
  const p = (params || {}) as Record<string, unknown>;
  const doExtractPDF = Boolean(p['doExtractPDF']);
  const doExtractMetadata = Boolean(p['doExtractMetadata']);
  const doIngestRAG = Boolean(p['doIngestRAG']);
  const forceRecreate = Boolean(p['forceRecreate']);
  const forceTemplate = Boolean(p['forceTemplate']);
  const extract: PhaseDirective = forceRecreate ? 'force' : (doExtractPDF ? 'do' : 'ignore');
  const metadata: PhaseDirective = doExtractMetadata ? (forceTemplate ? 'force' : 'do') : 'ignore';
  const ingest: PhaseDirective = doIngestRAG ? 'do' : 'ignore';
  return { extract, metadata, ingest };
}

export function getPolicies(job: Pick<ExternalJob, 'parameters'>): PhasePolicies {
  const raw = (job.parameters || {}) as Record<string, unknown>;
  const p = raw['policies'] as PhasePolicies | undefined;
  if (p && p.extract && p.metadata && p.ingest) return p;
  return legacyToPolicies(raw);
}


```

```typescript
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { transformAudio, transformText, transformVideo, transformPdf, transformImage, SecretaryAudioResponse, SecretaryVideoResponse, SecretaryPdfResponse, SecretaryImageResponse } from "@/lib/secretary/client";
import { ImageExtractionService, ImageExtractionResult } from "./image-extraction-service";
import { FileLogger } from '@/lib/debug/logger';

export interface TransformSaveOptions {
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
  useCache?: boolean; // Neu: Cache-Option für alle Transformationen
  includeImages?: boolean; // Neu: Bilder mit extrahieren und speichern
  useIngestionPipeline?: boolean; // Neu: Auto-RAG nach Speicherung
}

export interface PdfTransformOptions extends TransformSaveOptions {
  extractionMethod: string;
  template?: string;
  skipTemplate?: boolean; // Phase 1: nur Extraktion
  // Vereinfachte Phasensteuerung
  // Legacy-Flags (werden intern zu Policies gemappt)
  doExtractPDF?: boolean;
  doExtractMetadata?: boolean;
  doIngestRAG?: boolean;
  // Neue Policies (haben Vorrang)
  policies?: import('@/lib/processing/phase-policy').PhasePolicies;
  forceRecreate?: boolean;
}

export interface TransformResult {
  text: string;
  savedItem?: StorageItem;
  updatedItems: StorageItem[];
  imageExtractionResult?: ImageExtractionResult; // Neu: Ergebnis der Bild-Extraktion
  jobId?: string;
}

export interface VideoTransformOptions extends TransformSaveOptions {
  extractAudio: boolean;
  extractFrames: boolean;
  frameInterval: number;
  sourceLanguage?: string;
  template?: string;
}

export interface ImageTransformOptions extends TransformSaveOptions {
  extractionMethod: string;
  context?: string;
}

/**
 * Typ für die Metadaten, die im Frontmatter gespeichert werden
 */
interface TransformMetadata {
  // Quelldatei-Informationen
  source_file?: string;
  source_file_id?: string;
  source_file_size?: number;
  source_file_type?: string;
  
  // Transformations-Informationen
  source_language?: string;
  target_language?: string;
  
  // Audio-Metadaten
  audio_duration?: number;
  audio_format?: string;
  audio_channels?: number;
  audio_sample_rate?: number;
  audio_bit_rate?: number;
  
  // Prozess-Informationen
  process_id?: string;
  processor?: string;
  processing_duration_ms?: number;
  model_used?: string;
  tokens_used?: number;
  
  // Secretary Service Informationen
  cache_used?: boolean;
  cache_key?: string;
  
  // Weitere Felder können hinzugefügt werden
  [key: string]: string | number | boolean | undefined;
}

/**
 * TransformService - Zentraler Service für Transformations- und Speicheroperationen
 * Verantwortlich für:
 * - Transformation von Audio zu Text
 * - Transformation von Text zu optimiertem Text
 * - Speichern der Ergebnisse als Shadow-Twin oder als neue Datei
 * - Aktualisieren der Dateiliste
 * - Bereitstellen einer einheitlichen Schnittstelle für alle Transformationstypen
 */
export class TransformService {
  /**
   * Generiert einen standardisierten Namen für einen Shadow-Twin
   * @param originalName Der ursprüngliche Dateiname
   * @param targetLanguage Die Zielsprache
   * @returns Der generierte Shadow-Twin-Name ohne Dateiendung
   */
  static generateShadowTwinName(originalName: string, targetLanguage: string): string {
    // Entferne alle Dateiendungen aus dem Namen
    const nameWithoutExtension = originalName.split('.').slice(0, -1).join('.');
    return `${nameWithoutExtension}.${targetLanguage}`;
  }

  /**
   * Transformiert eine Audio-Datei in Text
   * @param file Die zu transformierende Audio-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Speicheroptionen
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformAudio(
    file: File,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    // Audio-Datei wird transformiert - hole die vollständige Response
    const response = await transformAudio(file, options.targetLanguage, libraryId);
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    if (typeof response === 'string') {
      // Falls die Response nur ein String ist (alte API)
      transformedText = response;
    } else if (response && 'data' in response && response.data && response.data.transcription) {
      // Neue API mit vollständigen Metadaten
      const audioResponse = response as SecretaryAudioResponse;
      transformedText = audioResponse.data.transcription.text;
      
      // Sammle relevante Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        source_language: audioResponse.data.transcription.source_language || options.targetLanguage,
        target_language: options.targetLanguage,
        
        // Audio-Metadaten (falls vorhanden)
        audio_duration: audioResponse.data.metadata?.duration,
        audio_format: audioResponse.data.metadata?.format,
        audio_channels: audioResponse.data.metadata?.channels,
        audio_sample_rate: audioResponse.data.metadata?.sample_rate,
        audio_bit_rate: audioResponse.data.metadata?.bit_rate,
        
        // Prozess-Informationen
        process_id: audioResponse.process?.id,
        processor: audioResponse.process?.main_processor,
        processing_duration_ms: audioResponse.process?.llm_info?.total_duration,
        model_used: audioResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: audioResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: audioResponse.process?.is_from_cache || false,
        cache_key: audioResponse.process?.cache_key
      };
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    }
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const shadowTwinName = TransformService.generateShadowTwinName(originalItem.metadata.name, options.targetLanguage);
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        shadowTwinName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert eine Video-Datei
   * @param file Die zu transformierende Video-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Optionen für Video-Transformation und Speicherung
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis inklusive Video-spezifischer Daten
   */
  static async transformVideo(
    file: File,
    originalItem: StorageItem,
    options: VideoTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    console.log('[TransformService] transformVideo gestartet mit Optionen:', options);
    
    // Video-Datei wird transformiert - hole die vollständige Response
    const response = await transformVideo(
      file, 
      {
        extractAudio: options.extractAudio,
        extractFrames: options.extractFrames,
        frameInterval: options.frameInterval,
        targetLanguage: options.targetLanguage,
        sourceLanguage: options.sourceLanguage || 'auto',
        template: options.template
      }, 
      libraryId
    );
    
    console.log('[TransformService] Vollständige Video-Response:', JSON.stringify(response, null, 2));
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    console.log('[TransformService] Response-Check:', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasTranscription: !!(response && response.data && response.data.transcription),
      transcriptionType: response && response.data && response.data.transcription ? typeof response.data.transcription : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : [],
      transcriptionKeys: response && response.data && response.data.transcription ? Object.keys(response.data.transcription) : []
    });
    
    if (response && response.data && response.data.transcription) {
      console.log('[TransformService] Transkription gefunden:', response.data.transcription);
      
      // Vollständige Video-Response mit Metadaten
      const videoResponse = response as SecretaryVideoResponse;
      transformedText = videoResponse.data.transcription.text;
      
      console.log('[TransformService] Extrahierter Text-Länge:', transformedText.length);
      console.log('[TransformService] Text-Vorschau:', transformedText.substring(0, 200));
      
      // Sammle relevante Video-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        source_language: videoResponse.data.transcription.source_language || options.sourceLanguage || 'auto',
        target_language: options.targetLanguage,
        
        // Video-Metadaten
        video_duration: videoResponse.data.metadata?.duration,
        video_duration_formatted: videoResponse.data.metadata?.duration_formatted,
        video_file_size: videoResponse.data.metadata?.file_size,
        video_title: videoResponse.data.metadata?.title,
        audio_file: videoResponse.data.metadata?.audio_file,
        
        // Prozess-Informationen
        process_id: videoResponse.process?.id,
        processor: videoResponse.process?.main_processor,
        sub_processors: videoResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: videoResponse.process?.llm_info?.total_duration,
        model_used: videoResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: videoResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: videoResponse.process?.is_from_cache || false,
        cache_key: videoResponse.process?.cache_key
      };
      
      console.log('[TransformService] Extrahierte Metadaten:', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      console.error('[TransformService] Keine Transkription in der Response gefunden!');
      console.error('[TransformService] Response-Struktur:', {
        hasResponse: !!response,
        hasData: !!(response && response.data),
        hasTranscription: !!(response && response.data && response.data.transcription),
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    console.log('[TransformService] Finaler transformierter Text-Länge:', transformedText.length);
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      console.log('[TransformService] Speichere Shadow-Twin mit Länge:', markdownContent.length);
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      console.log('[TransformService] Keine Speicherung:', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length
      });
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert einen Text mithilfe des Secretary Services
   */
  static async transformText(
    textContent: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    template: string = "Besprechung"
  ): Promise<TransformResult> {
    console.log('[TransformService] transformText aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      options: options,
      template: template
    });
    
    // Text wird transformiert
    const transformedText = await transformText(
      textContent,
      options.targetLanguage,
      libraryId,
      template
    );
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        transformedText,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert eine PDF-Datei mithilfe des Secretary Services
   * @param file Die zu transformierende PDF-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Speicheroptionen
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformPdf(
    file: File,
    originalItem: StorageItem,
    options: PdfTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    FileLogger.info('TransformService', 'PDF-Transformation gestartet', {
      fileName: originalItem.metadata.name,
      includeImages: options.includeImages,
      extractionMethod: options.extractionMethod,
      targetLanguage: options.targetLanguage
    });
    FileLogger.debug('TransformService', 'IncludeImages Option', {
      includeImages: options.includeImages,
      type: typeof options.includeImages
    });
    
    // PDF-Datei wird transformiert - hole die vollständige Response
    const response = await transformPdf(
      file,
      options.targetLanguage,
      libraryId,
      options.template,
      options.extractionMethod,
      options.useCache ?? true,
      options.includeImages ?? false,
      undefined, // skipTemplate wird nicht mehr verwendet; Flags steuern Phasen
      {
        originalItemId: originalItem.id,
        parentId: originalItem.parentId,
        originalFileName: originalItem.metadata.name,
        // Neue vereinfachte Phasen-Flags durchreichen
        doExtractPDF: options.doExtractPDF,
        doExtractMetadata: options.doExtractMetadata,
        doIngestRAG: options.doIngestRAG,
        forceRecreate: options.forceRecreate,
      }
    );
    
    FileLogger.debug('TransformService', 'Vollständige PDF-Response', { response: JSON.stringify(response, null, 2) });

    // Asynchroner Flow: nur "accepted" → Ergebnis via Webhook, kein Client-Fehler
    if (response && (response as unknown as { status?: string; data?: { extracted_text?: string } }).status === 'accepted' && !((response as unknown as { data?: { extracted_text?: string } }).data?.extracted_text)) {
      const r = response as unknown as { job?: { id?: string }; process?: { id?: string; is_from_cache?: boolean } };
      FileLogger.info('TransformService', 'Job akzeptiert – Ergebnis kommt per Webhook', {
        jobId: r?.job?.id,
        processId: r?.process?.id,
        fromCache: r?.process?.is_from_cache || false
      });
      return { text: '', updatedItems: [], jobId: r?.job?.id };
    }
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    FileLogger.debug('TransformService', 'Response-Check', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasExtractedText: !!(response && response.data && response.data.extracted_text),
      extractedTextType: response && response.data && response.data.extracted_text ? typeof response.data.extracted_text : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : []
    });
    
    // Prüfe auf images_archive_data
    FileLogger.debug('TransformService', 'Images Archive Check', {
      hasImagesArchiveData: !!(response && response.data && response.data.images_archive_data),
      hasImagesArchiveFilename: !!(response && response.data && response.data.images_archive_filename),
      imagesArchiveDataLength: response && response.data && response.data.images_archive_data ? response.data.images_archive_data.length : 0,
      imagesArchiveFilename: response && response.data ? response.data.images_archive_filename : 'undefined'
    });
    
    if (response && response.data && response.data.extracted_text) {
      FileLogger.info('TransformService', 'Extracted-Text gefunden', {
        textLength: response.data.extracted_text.length,
        textPreview: response.data.extracted_text.substring(0, 200)
      });
      
      // Vollständige PDF-Response mit Metadaten
      const pdfResponse = response as SecretaryPdfResponse;
      transformedText = pdfResponse.data.extracted_text;
      
      // Sammle relevante PDF-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        target_language: options.targetLanguage,
        
        // PDF-Metadaten
        page_count: pdfResponse.data.metadata?.page_count,
        format: pdfResponse.data.metadata?.format,
        extraction_method: pdfResponse.data.metadata?.extraction_method,
        file_name: pdfResponse.data.metadata?.file_name,
        file_size: pdfResponse.data.metadata?.file_size,
        
        // Prozess-Informationen
        process_id: pdfResponse.process?.id,
        processor: pdfResponse.process?.main_processor,
        sub_processors: pdfResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: pdfResponse.process?.llm_info?.total_duration,
        model_used: pdfResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: pdfResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: pdfResponse.process?.is_from_cache || false,
        cache_key: pdfResponse.process?.cache_key
      };
      
      FileLogger.debug('TransformService', 'Extrahierte Metadaten', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      FileLogger.warn('TransformService', 'Keine synchronen PDF-Daten erhalten', {
        hasResponse: !!response,
        hasData: !!(response && (response as unknown as { data?: unknown }).data)
      });
    }
    
    let imageExtractionResult: ImageExtractionResult | undefined;
    if (options.includeImages && response && response.data && response.data.images_archive_data) {
      try {
        FileLogger.info('TransformService', 'Starte Bild-Extraktion', {
          imagesArchiveFilename: response.data.images_archive_filename,
          imagesArchiveDataLength: response.data.images_archive_data.length
        });
        imageExtractionResult = await ImageExtractionService.saveZipArchive(
          response.data.images_archive_data,
          response.data.images_archive_filename || 'pdf_images.zip',
          originalItem,
          provider,
          refreshItems,
          transformedText, // Extrahierten Text weitergeben
          options.targetLanguage, // Target Language weitergeben
          response.data.metadata?.text_contents // Seiten-spezifische Texte weitergeben
        );
        FileLogger.info('TransformService', 'Bild-Extraktion abgeschlossen', {
          folderCreated: !!imageExtractionResult.folderItem,
          savedItemsCount: imageExtractionResult.savedItems.length
        });
      } catch (error) {
        FileLogger.error('TransformService', 'Fehler bei der Bild-Extraktion', error);
        // Bild-Extraktion ist optional, daher weitermachen
      }
    }
    
    FileLogger.debug('TransformService', 'Finaler transformierter Text', {
      textLength: transformedText.length
    });
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);

    // NEU: Detaillierte Debug-Logs für das Speicherproblem
    FileLogger.info('TransformService', 'Speicher-Bedingungen prüfen', {
      createShadowTwin: options.createShadowTwin,
      hasTransformedText: !!transformedText,
      transformedTextLength: transformedText.length,
      markdownContentLength: markdownContent.length,
      willSave: options.createShadowTwin && transformedText
    });

    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      FileLogger.info('TransformService', 'Speichere Shadow-Twin', {
        markdownLength: markdownContent.length
      });
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      FileLogger.info('TransformService', 'Shadow-Twin erfolgreich gespeichert', {
        savedItemId: result.savedItem?.id,
        savedItemName: result.savedItem?.metadata.name,
        updatedItemsCount: result.updatedItems.length
      });
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems,
        imageExtractionResult
      };
    } else {
      FileLogger.warn('TransformService', 'Keine Speicherung - Bedingungen nicht erfüllt', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length,
        reason: !options.createShadowTwin ? 'createShadowTwin ist false' : 'transformedText ist leer'
      });
    }

    return {
      text: transformedText,
      updatedItems: [],
      imageExtractionResult
    };
  }

  /**
   * Transformiert ein Bild mithilfe des Secretary Services
   * @param file Die zu transformierende Bilddatei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Optionen für Bild-Transformation und Speicherung
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformImage(
    file: File,
    originalItem: StorageItem,
    options: ImageTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    FileLogger.info('TransformService', 'Bild-Transformation gestartet', {
      fileName: originalItem.metadata.name,
      extractionMethod: options.extractionMethod,
      targetLanguage: options.targetLanguage
    });
    
    // Bild wird transformiert - hole die vollständige Response
    const response = await transformImage(
      file,
      options.targetLanguage,
      libraryId,
      options.extractionMethod,
      options.context,
      options.useCache ?? true
    );
    
    FileLogger.debug('TransformService', 'Vollständige Bild-Response', {
      response: JSON.stringify(response, null, 2)
    });
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    if (response && response.data && response.data.extracted_text) {
      FileLogger.info('TransformService', 'Extracted-Text gefunden', {
        textLength: response.data.extracted_text.length,
        textPreview: response.data.extracted_text.substring(0, 200)
      });
      
      // Vollständige Bild-Response mit Metadaten
      const imageResponse = response as SecretaryImageResponse;
      transformedText = imageResponse.data.extracted_text;
      
      // Sammle relevante Bild-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        target_language: options.targetLanguage,
        
        // Bild-Metadaten
        dimensions: imageResponse.data.metadata?.dimensions,
        format: imageResponse.data.metadata?.format,
        color_mode: imageResponse.data.metadata?.color_mode,
        dpi: imageResponse.data.metadata?.dpi?.join('x'),
        extraction_method: imageResponse.data.metadata?.extraction_method,
        file_name: imageResponse.data.metadata?.file_name,
        file_size: imageResponse.data.metadata?.file_size,
        
        // Prozess-Informationen
        process_id: imageResponse.process?.id,
        processor: imageResponse.process?.main_processor,
        sub_processors: imageResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: imageResponse.process?.llm_info?.total_duration,
        model_used: imageResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: imageResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: imageResponse.process?.is_from_cache || false,
        cache_key: imageResponse.process?.cache_key
      };
      
      FileLogger.debug('TransformService', 'Extrahierte Metadaten', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      FileLogger.error('TransformService', 'Kein Extracted-Text in der Response gefunden!', {
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    FileLogger.debug('TransformService', 'Finaler transformierter Text', {
      textLength: transformedText.length
    });
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);

    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      FileLogger.info('TransformService', 'Speichere Shadow-Twin', {
        markdownLength: markdownContent.length
      });
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      FileLogger.debug('TransformService', 'Keine Speicherung', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length
      });
    }

    return {
      text: transformedText,
      updatedItems: []
    };
  }
  
  // Hilfsmethode zum Speichern der transformierten Datei
  private static async saveTwinFile(
    content: string,
    originalItem: StorageItem,
    fileName: string,
    fileExtension: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<{ savedItem?: StorageItem; updatedItems: StorageItem[] }> {
    console.log('[TransformService] saveTwinFile aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension
    });
    
    // NEU: Detaillierte Debug-Logs
    FileLogger.info('TransformService', 'saveTwinFile gestartet', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension,
      contentLength: content.length,
      parentId: originalItem.parentId
    });
    
    // Hole aktuelle Dateien im Verzeichnis
    const currentItems = await refreshItems(originalItem.parentId);
    FileLogger.debug('TransformService', 'Aktuelle Dateien im Verzeichnis', {
      parentId: originalItem.parentId,
      itemCount: currentItems.length,
      existingFiles: currentItems.filter(item => item.type === 'file').map(item => item.metadata.name)
    });
    
    // Funktion zum Generieren eines eindeutigen Dateinamens
    const generateUniqueFileName = (baseName: string, extension: string): string => {
      let counter = 0;
      let candidateName = `${baseName}.${extension}`;
      
      // Prüfe ob der Name bereits existiert
      while (currentItems.some(item => 
        item.type === 'file' && 
        item.metadata.name.toLowerCase() === candidateName.toLowerCase()
      )) {
        counter++;
        candidateName = `${baseName}(${counter}).${extension}`;
      }
      
      return candidateName;
    };
    
    // Generiere eindeutigen Dateinamen
    const uniqueFileName = generateUniqueFileName(fileName, fileExtension);
    
    console.log('[TransformService] Eindeutiger Dateiname generiert:', {
      baseNameWithLanguage: fileName,
      uniqueFileName: uniqueFileName,
      existingFiles: currentItems.filter(item => item.type === 'file').map(item => item.metadata.name)
    });
    
    FileLogger.info('TransformService', 'Dateiname generiert', {
      baseName: fileName,
      uniqueFileName: uniqueFileName,
      existingFilesCount: currentItems.filter(item => item.type === 'file').length
    });
    
    // Markdown-Datei erstellen und speichern
    const fileBlob = new Blob([content], { type: "text/markdown" });
    const file = new File([fileBlob], uniqueFileName, { type: "text/markdown" });
    
    FileLogger.info('TransformService', 'Datei vorbereitet für Upload', {
      fileName: uniqueFileName,
      fileSize: file.size,
      fileType: file.type,
      contentLength: content.length
    });
    
    // In dasselbe Verzeichnis wie die Originaldatei hochladen
    FileLogger.info('TransformService', 'Starte Upload', {
      parentId: originalItem.parentId,
      fileName: uniqueFileName
    });
    
    const savedItem = await provider.uploadFile(originalItem.parentId, file);
    
    FileLogger.info('TransformService', 'Upload erfolgreich', {
      savedItemId: savedItem.id,
      savedItemName: savedItem.metadata.name,
      savedItemSize: savedItem.metadata.size
    });
    
    // Aktualisierte Dateiliste holen
    const updatedItems = await refreshItems(originalItem.parentId);
    
    FileLogger.info('TransformService', 'Dateiliste aktualisiert', {
      updatedItemsCount: updatedItems.length,
      newFileFound: updatedItems.some(item => item.id === savedItem.id)
    });
    
    return { savedItem, updatedItems };
  }

  /**
   * Speichert einen bereits transformierten Text direkt ohne erneute Transformation
   */
  static async saveTransformedText(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    return this.saveTransformationResult(
      text,
      originalItem,
      options,
      provider,
      refreshItems
    );
  }

  /**
   * Speichert das Transformationsergebnis als Datei
   */
  static async saveTransformationResult(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    // Als Shadow-Twin oder als normale Datei mit angegebenem Namen speichern
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        text,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      // Einfach das Transformationsergebnis zurückgeben ohne Datei zu speichern
      return {
        text,
        updatedItems: []
      };
    }
  }

  /**
   * Erstellt Markdown-Inhalt mit YAML-Frontmatter
   */
  static createMarkdownWithFrontmatter(content: string, metadata: TransformMetadata): string {
    // Wenn keine Metadaten vorhanden sind, gebe nur den Inhalt zurück
    if (!metadata || Object.keys(metadata).length === 0) {
      return content;
    }
    
    // Erstelle YAML-Frontmatter
    let frontmatter = '---\n';
    
    // Sortiere die Metadaten für bessere Lesbarkeit
    const sortedKeys = Object.keys(metadata).sort((a, b) => {
      // Gruppiere nach Kategorien
      const categoryOrder = ['source_', 'transformation_', 'audio_', 'process', 'secretary_', 'cache_'];
      const getCategoryIndex = (key: string) => {
        for (let i = 0; i < categoryOrder.length; i++) {
          if (key.startsWith(categoryOrder[i])) return i;
        }
        return categoryOrder.length;
      };
      
      const categoryA = getCategoryIndex(a);
      const categoryB = getCategoryIndex(b);
      
      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }
      return a.localeCompare(b);
    });
    
    // Füge Metadaten zum Frontmatter hinzu
    for (const key of sortedKeys) {
      const value = metadata[key];
      
      // Überspringe undefined-Werte
      if (value === undefined) {
        continue;
      }
      
      // Formatiere den Wert je nach Typ
      if (typeof value === 'string') {
        // Escape Anführungszeichen in Strings
        const escapedValue = value.replace(/"/g, '\\"');
        frontmatter += `${key}: "${escapedValue}"\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        frontmatter += `${key}: ${value}\n`;
      } else {
        // Für komplexe Objekte verwende JSON (sollte nicht vorkommen)
        frontmatter += `${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    frontmatter += '---\n\n';
    
    // Kombiniere Frontmatter mit Inhalt
    return frontmatter + content;
  }
} 
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    doExtractMetadata?: boolean;
    doIngestRAG?: boolean;
    forceRecreate?: boolean;
    forceTemplate?: boolean;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Eindeutige Batch-ID generieren
    const batchId = crypto.randomUUID();

    // Phase 1: Alle Jobs minimal in DB anlegen (ohne PDFs zu laden)
    const repo = new ExternalJobsRepository();
    const createdJobIds: string[] = [];
    for (const it of items) {
      try {
        const jobId = crypto.randomUUID();
        const jobSecret = crypto.randomBytes(24).toString('base64url');
        const jobSecretHash = repo.hashSecret(jobSecret);
        await repo.create({
          jobId,
          jobSecretHash,
          job_type: 'pdf',
          operation: 'extract',
          worker: 'secretary',
          status: 'queued',
          libraryId,
          userEmail,
          correlation: {
            jobId,
            libraryId,
            source: { mediaType: 'pdf', mimeType: it.mimeType || 'application/pdf', name: it.name || 'document.pdf', itemId: it.fileId, parentId: it.parentId },
            options: {
              targetLanguage: options?.targetLanguage || 'de',
              extractionMethod: options?.extractionMethod || 'native',
              includeImages: options?.includeImages ?? false,
              useCache: options?.useCache ?? true,
            },
            batchId,
            batchName,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          steps: [
            { name: 'extract_pdf', status: 'pending' },
            { name: 'transform_template', status: 'pending' },
            { name: 'store_shadow_twin', status: 'pending' },
            { name: 'ingest_rag', status: 'pending' },
          ],
          parameters: {
            targetLanguage: options?.targetLanguage || 'de',
            extractionMethod: options?.extractionMethod || 'native',
            includeImages: options?.includeImages ?? false,
            useCache: options?.useCache ?? true,
            template: options?.template,
            // Legacy-Flags bleiben für Kompatibilität erhalten
            doExtractPDF: options?.forceExtractPDF === 'ignore' ? false : true,
            doExtractMetadata: options?.doExtractMetadata ?? (options?.metadataPolicy ? options.metadataPolicy !== 'ignore' : false),
            doIngestRAG: options?.doIngestRAG ?? (options?.ingestPolicy ? options.ingestPolicy !== 'ignore' : false),
            forceRecreate: !!options?.forceRecreate,
            forceTemplate: !!options?.forceTemplate,
            // Neue Policies
            policies: {
              extract: (options as any)?.extractPolicy || ((options as any)?.forceExtractPDF ? 'force' : 'do'),
              metadata: (options as any)?.metadataPolicy || ((options as any)?.forceTemplate ? 'force' : ((options as any)?.doExtractMetadata ? 'do' : 'ignore')),
              ingest: (options as any)?.ingestPolicy || (((options as any)?.doIngestRAG ? 'do' : 'ignore')),
            },
            batchId,
            batchName,
          }
        } as any);
        createdJobIds.push(jobId);
      } catch (e) {
        FileLogger.error('process-pdf-batch', 'Job-Anlage fehlgeschlagen', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Phase 2: Verarbeitung asynchron starten (Concurrency 5) via Retry‑Route
    const concurrency = 5;
    (async () => {
      let idx = 0;
      const runner = async () => {
        while (true) {
          const i = idx++;
          if (i >= createdJobIds.length) break;
          const jobId = createdJobIds[i];
          try {
            const res = await fetch(new URL(`/api/external/jobs/${jobId}/retry`, request.url).toString(), {
              method: 'POST',
              headers: { 'Cookie': request.headers.get('cookie') || '' }
            });
            if (!res.ok) {
              const msg = await res.text().catch(() => res.statusText);
              FileLogger.error('process-pdf-batch', 'Retry-Start fehlgeschlagen', { jobId, msg });
            }
          } catch (err) {
            FileLogger.error('process-pdf-batch', 'Retry-Start Exception', { jobId, err: err instanceof Error ? err.message : String(err) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, createdJobIds.length) }, () => runner()));
      FileLogger.info('process-pdf-batch', 'Asynchroner Start abgeschlossen', { count: createdJobIds.length, batchId, batchName });
    })().catch(() => {});

    // Sofortige Antwort: Anzahl angelegter Jobs
    return NextResponse.json({ ok: true, batchId, batchName, created: createdJobIds.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { legacyToPolicies } from '@/lib/processing/phase-policy';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    doExtractMetadata?: boolean;
    doIngestRAG?: boolean;
    forceRecreate?: boolean;
    forceTemplate?: boolean;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Eindeutige Batch-ID generieren
    const batchId = crypto.randomUUID();

    // Phase 1: Alle Jobs minimal in DB anlegen (ohne PDFs zu laden)
    const repo = new ExternalJobsRepository();
    const createdJobIds: string[] = [];
    for (const it of items) {
      try {
        const jobId = crypto.randomUUID();
        const jobSecret = crypto.randomBytes(24).toString('base64url');
        const jobSecretHash = repo.hashSecret(jobSecret);
        await repo.create({
          jobId,
          jobSecretHash,
          job_type: 'pdf',
          operation: 'extract',
          worker: 'secretary',
          status: 'queued',
          libraryId,
          userEmail,
          correlation: {
            jobId,
            libraryId,
            source: { mediaType: 'pdf', mimeType: it.mimeType || 'application/pdf', name: it.name || 'document.pdf', itemId: it.fileId, parentId: it.parentId },
            options: {
              targetLanguage: options?.targetLanguage || 'de',
              extractionMethod: options?.extractionMethod || 'native',
              includeImages: options?.includeImages ?? false,
              useCache: options?.useCache ?? true,
            },
            batchId,
            batchName,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          steps: [
            { name: 'extract_pdf', status: 'pending' },
            { name: 'transform_template', status: 'pending' },
            { name: 'store_shadow_twin', status: 'pending' },
            { name: 'ingest_rag', status: 'pending' },
          ],
          parameters: {
            targetLanguage: options?.targetLanguage || 'de',
            extractionMethod: options?.extractionMethod || 'native',
            includeImages: options?.includeImages ?? false,
            useCache: options?.useCache ?? true,
            template: options?.template,
            // Legacy-Flags bleiben für Kompatibilität erhalten (Phase 1 grundsätzlich aktiv)
            doExtractPDF: true,
            doExtractMetadata: !!options?.doExtractMetadata,
            doIngestRAG: !!options?.doIngestRAG,
            forceRecreate: !!options?.forceRecreate,
            forceTemplate: !!options?.forceTemplate,
            // Neue Policies aus Legacy ableiten
            policies: legacyToPolicies({
              doExtractPDF: true,
              doExtractMetadata: !!options?.doExtractMetadata,
              doIngestRAG: !!options?.doIngestRAG,
              forceRecreate: !!options?.forceRecreate,
              forceTemplate: !!options?.forceTemplate,
            }),
            batchId,
            batchName,
          }
        } as any);
        createdJobIds.push(jobId);
      } catch (e) {
        FileLogger.error('process-pdf-batch', 'Job-Anlage fehlgeschlagen', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Phase 2: Verarbeitung asynchron starten (Concurrency 5) via Retry‑Route
    const concurrency = 5;
    (async () => {
      let idx = 0;
      const runner = async () => {
        while (true) {
          const i = idx++;
          if (i >= createdJobIds.length) break;
          const jobId = createdJobIds[i];
          try {
            const res = await fetch(new URL(`/api/external/jobs/${jobId}/retry`, request.url).toString(), {
              method: 'POST',
              headers: { 'Cookie': request.headers.get('cookie') || '' }
            });
            if (!res.ok) {
              const msg = await res.text().catch(() => res.statusText);
              FileLogger.error('process-pdf-batch', 'Retry-Start fehlgeschlagen', { jobId, msg });
            }
          } catch (err) {
            FileLogger.error('process-pdf-batch', 'Retry-Start Exception', { jobId, err: err instanceof Error ? err.message : String(err) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, createdJobIds.length) }, () => runner()));
      FileLogger.info('process-pdf-batch', 'Asynchroner Start abgeschlossen', { count: createdJobIds.length, batchId, batchName });
    })().catch(() => {});

    // Sofortige Antwort: Anzahl angelegter Jobs
    return NextResponse.json({ ok: true, batchId, batchName, created: createdJobIds.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateExtractPdf } from '@/lib/processing/gates';
import { getPolicies, shouldRunExtract, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { LibraryService } from '@/lib/library/library-service';
import { getServerProvider } from '@/lib/storage/server-provider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const filename = source.name || 'document.pdf';
    const file = new File([bin.blob], filename, { type: source.mimeType || bin.mimeType || 'application/pdf' });

    // Secretary-FormData aufbauen (wie in process-pdf für den Worker-Call)
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);
    const opts = (job.correlation?.options || {}) as Record<string, unknown>;
    serviceFormData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de');
    serviceFormData.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native');
    serviceFormData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true));
    serviceFormData.append('includeImages', String(typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false));

    // Callback-URL und -Token (neues Secret generieren)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 });
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
    const newSecret = crypto.randomBytes(24).toString('base64url');
    const newHash = repo.hashSecret(newSecret);
    // Job zurücksetzen
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Policies laden
    const policies = getPolicies(job);

    // Optional: Extract-Gate prüfen und ggf. lokal Template‑Only fahren
    try {
      const libraryService = LibraryService.getInstance();
      const libraries = await libraryService.getUserLibraries(userEmail);
      const lib = libraries.find(l => l.id === libraryId);
      const g = await gateExtractPdf({ repo, jobId, userEmail, library: lib, source, options: { targetLanguage: String(serviceFormData.get('target_language') || 'de') } });
      const runExtract = shouldRunExtract(g.exists, policies.extract);
      if (!runExtract) {
        // Phase 1 überspringen → Schritte markieren und sofort success zurückgeben
        await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.exists ? (g.reason || 'artifact_exists') : 'policy_ignore' } });
        // Phase 2 je Policy behandeln: Bei 'ignore' skippen, sonst im Callback ausgeführt werden lassen
        if (policies.metadata === 'ignore') {
          await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
          await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        // Ingestion-Policy nur markieren; tatsächliche Ingestion erfolgt im Callback-Pfad
        if (policies.ingest === 'ignore') {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);
        return NextResponse.json({ ok: true, jobId, worker: 'secretary', skipped: { extract: true } });
      }
    } catch {
      // Falls Gate fehlschlägt, wird normal extrahiert
    }

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
      if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
      response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
// import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { IngestionService } from '@/lib/chat/ingestion-service';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateTransformTemplate, gateIngestRag } from '@/lib/processing/gates';
import { getPolicies, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { getServerProvider } from '@/lib/storage/server-provider';
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser';

// OneDrive-Utilities entfernt: Provider übernimmt Token/Uploads.

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

// OneDrive-spezifische Upload-/Token-Utilities wurden entfernt; StorageFactory-Provider übernimmt das Speichern.

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
    const internalBypass = (() => {
      const t = request.headers.get('x-internal-token') || request.headers.get('X-Internal-Token');
      const envToken = process.env.INTERNAL_TEST_TOKEN || '';
      return !!t && !!envToken && t === envToken;
    })();
    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (!callbackToken && !internalBypass) {
      bufferLog(jobId, { phase: 'failed', message: 'callback_token fehlt' });
      await repo.appendLog(jobId, { phase: 'failed', message: 'callback_token fehlt' } as unknown as Record<string, unknown>);
      await repo.setStatus(jobId, 'failed', { error: { code: 'callback_token_missing', message: 'callback_token fehlt' } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'callback_token fehlt', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });
    }

    if (!internalBypass) {
      const tokenHash = repo.hashSecret(callbackToken as string);
      if (tokenHash !== job.jobSecretHash) {
        bufferLog(jobId, { phase: 'failed', message: 'Unauthorized callback' });
        await repo.appendLog(jobId, { phase: 'failed', message: 'Unauthorized callback' } as unknown as Record<string, unknown>);
        await repo.setStatus(jobId, 'failed', { error: { code: 'unauthorized', message: 'Ungültiges callback_token' } });
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Unauthorized callback', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

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
        sourceItemId: job.correlation?.source?.itemId,
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
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
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
    let docMetaForIngestion: Record<string, unknown> | undefined;

    if (lib && extractedText) {
      const policies = getPolicies(job);
      const doExtractMetadata = policies.metadata !== 'ignore';
      const autoSkip = true;

      if (lib) {
        // Einheitliche Serverinitialisierung des Providers (DB-Config, Token enthalten)
        let provider;
        try {
          provider = await getServerProvider(job.userEmail, job.libraryId);
        } catch (e) {
          const reason = e instanceof Error ? e.message : 'Provider-Initialisierung fehlgeschlagen';
          bufferLog(jobId, { phase: 'provider_init_failed', message: reason });
          await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: reason } });
          await repo.setStatus(jobId, 'failed', { error: { code: 'CONFIG_ERROR', message: reason } });
          getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: reason, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
          return NextResponse.json({ status: 'error', jobId, kind: 'provider_init_failed', message: reason }, { status: 400 });
        }

        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';

        // Optionale Template-Verarbeitung (Phase 2)
        let metadataFromTemplate: Record<string, unknown> | null = null;
        let templateStatus: 'completed' | 'failed' | 'skipped' = 'completed';
        // Gate für Transform-Template (Phase 2)
        let templateGateExists = false;
        if (autoSkip) {
          const g = await gateTransformTemplate({ repo, jobId, userEmail: job.userEmail, library: lib, source: job.correlation?.source, options: job.correlation?.options as { targetLanguage?: string } | undefined });
          templateGateExists = g.exists;
          if (g.exists) {
            await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });
            templateStatus = 'skipped';
          }
        }
        const shouldRunTemplate = shouldRunWithGate(templateGateExists, policies.metadata);
        if (!shouldRunTemplate) {
          bufferLog(jobId, { phase: 'transform_meta_skipped', message: 'Template-Transformation übersprungen (Phase 1)' });
        } else {
          await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });
          try {
            // Templates-Ordner vorbereiten
            const rootItems = await provider.listItemsById('root');
            const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
            const ensureTemplatesFolderId = async (): Promise<string> => {
              if (templatesFolder) return templatesFolder.id;
              const created = await provider.createFolder('root', 'templates');
              bufferLog(jobId, { phase: 'templates_folder_created', message: 'Ordner /templates angelegt' });
              return created.id;
            };
            const templatesFolderId = await ensureTemplatesFolderId();

            // Template-Datei wählen bzw. anlegen
            let chosen: { id: string } | undefined;
            if (templatesFolderId) {
              const tplItems = await provider.listItemsById(templatesFolderId);
              const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
              const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
              chosen = preferredTemplate
                ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
              if (!chosen) {
                const defaultTemplateContent = '# {{title}}\n';
                const tplFile = new File([new Blob([defaultTemplateContent], { type: 'text/markdown' })], 'pdfanalyse.md', { type: 'text/markdown' });
                await provider.uploadFile(templatesFolderId, tplFile);
                bufferLog(jobId, { phase: 'template_created', message: 'Default-Template pdfanalyse.md angelegt' });
                const re = await provider.listItemsById(templatesFolderId);
                chosen = re.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'pdfanalyse.md') as unknown as { id: string } | undefined;
              }
            } else {
              bufferLog(jobId, { phase: 'templates_folder_missing', message: 'Ordner /templates nicht gefunden' });
            }

            if (chosen) {
              const bin = await provider.getBinary(chosen.id);
              const templateContent = await bin.blob.text();
              await repo.appendMeta(jobId, { template_used: (chosen as unknown as { metadata?: { name?: string } }).metadata?.name }, 'template_pick');

              // Secretary Transformer aufrufen
              const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
              const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
              const fd = new FormData();
              fd.append('text', extractedText);
              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              fd.append('target_language', lang);
              fd.append('template_content', templateContent);
              fd.append('use_cache', 'false');
              // Kontext übergeben (Dateiname/Pfad/Job)
              try {
                const parentId = job.correlation.source?.parentId || 'root';
                const parentPath = await provider.getPathById(parentId); // z.B. /Berichte Landesämter/Bevölk.Schutz
                const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                const rawName = job.correlation.source?.name || 'document.pdf';
                const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
                const baseName = withoutExt.replace(new RegExp(`\\.${lang}$`, 'i'), '');
                const ctx = {
                  filename: baseName,
                  filepath: dirPath,
                  libraryId: job.libraryId,
                  jobId: job.jobId,
                  sourceItemId: job.correlation.source?.itemId,
                  parentId: job.correlation.source?.parentId
                } as const;
                fd.append('context', JSON.stringify(ctx));
              } catch {}
              const headers: Record<string, string> = { 'Accept': 'application/json' };
              const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
              if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
              const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
              const data: unknown = await resp.json().catch(() => ({}));
              if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
                const d = (data as { data?: unknown }).data as { structured_data?: unknown } | undefined;
                const normalized = normalizeStructuredData(d?.structured_data);
                metadataFromTemplate = normalized || null;
                bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' });
              } else {
                bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' });
                templateStatus = 'failed';
              }
            }
          } catch(err) {
            console.error(err);
            bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler') });
            templateStatus = 'failed';
          }
        }

        // Frontmatter bestimmen und Shadow‑Twin speichern
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };
        docMetaForIngestion = finalMeta;
        await repo.appendMeta(jobId, finalMeta, 'template_transform');
        await repo.updateStep(jobId, 'transform_template', { status: templateStatus === 'failed' ? 'failed' : 'completed', endedAt: new Date(), ...(templateStatus === 'skipped' ? { details: { skipped: true } } : {}) });

        // Fatal: Wenn Template-Transformation gestartet wurde, aber fehlgeschlagen ist, abbrechen
        if (templateStatus === 'failed') {
          clearWatchdog(jobId);
          bufferLog(jobId, { phase: 'failed', message: 'Template-Transformation fehlgeschlagen (fatal)' });
          const bufferedTpl = drainBufferedLogs(jobId);
          for (const entry of bufferedTpl) {
            await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
          }
          await repo.setStatus(jobId, 'failed', { error: { code: 'template_failed', message: 'Template-Transformation fehlgeschlagen' } });
          getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Template-Transformation fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
          return NextResponse.json({ status: 'ok', jobId, kind: 'failed_template' });
        }

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        // SSOT: Flache, UI-taugliche Metafelder ergänzen (nur auf stabilem Meilenstein)
        const ssotFlat: Record<string, unknown> = {
          job_id: jobId,
          source_file: job.correlation.source?.name || baseName,
          extract_status: 'completed',
          template_status: templateStatus,
          // Ingestion-Status wird später ggf. separat ermittelt; hier neutral
          ingest_status: 'none',
        };
        // optionale Summary-Werte aus bereits vorhandenen Metadaten übernehmen, wenn vorhanden
        if (typeof (finalMeta as Record<string, unknown>)['summary_pages'] === 'number') ssotFlat['summary_pages'] = (finalMeta as Record<string, unknown>)['summary_pages'];
        if (typeof (finalMeta as Record<string, unknown>)['summary_chunks'] === 'number') ssotFlat['summary_chunks'] = (finalMeta as Record<string, unknown>)['summary_chunks'];
        ssotFlat['summary_language'] = lang;

        const mergedMeta = { ...finalMeta, ...ssotFlat } as Record<string, unknown>;

        const markdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, mergedMeta)
          : extractedText;
        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        await repo.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
        const saved = await provider.uploadFile(targetParentId, file);
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;
        await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

        // Bilder-ZIP optional verarbeiten
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              const base = baseRaw.replace(/\/$/, '');
              const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
              archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') ? `${base}${rel.substring(4)}` : `${base}${rel}`;
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            }
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
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
        }
      }

      // Schritt: ingest_rag (optional automatisiert)
      try {
        // Gate für Ingestion (Phase 3)
        const autoSkip = true;
        let ingestGateExists = false;
        if (autoSkip) {
          const g = await gateIngestRag({
            repo,
            jobId,
            userEmail: job.userEmail,
            library: lib,
            source: job.correlation?.source,
            options: job.correlation?.options as { targetLanguage?: string } | undefined,
            ingestionCheck: async ({ userEmail, libraryId, fileId }: { userEmail: string; libraryId: string; fileId: string }) => {
              // Prüfe Doc‑Vektor existiert (kind:'doc' + fileId)
              try {
                const ctx = await (await import('@/lib/chat/loader')).loadLibraryChatContext(userEmail, libraryId)
                const apiKey = process.env.PINECONE_API_KEY
                if (!ctx || !apiKey) return false
                const idx = await (await import('@/lib/chat/pinecone')).describeIndex(ctx.vectorIndex, apiKey)
                if (!idx?.host) return false
                const list = await (await import('@/lib/chat/pinecone')).listVectors(idx.host, apiKey, { kind: 'doc', user: userEmail, libraryId, fileId })
                return Array.isArray(list) && list.length > 0
              } catch {
                return false
              }
            }
          })
          if (g.exists) {
            ingestGateExists = true;
            await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });
            // Wenn geskippt, keinen weiteren Ingestion-Versuch starten
            // dennoch Abschluss unten fortsetzen
          } else {
            await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() });
          }
        } else {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() });
        }
        FileLogger.info('external-jobs', 'Ingestion start', { jobId, libraryId: job.libraryId })
        const useIngestion = !!(job.parameters && typeof job.parameters === 'object' && (job.parameters as Record<string, unknown>)['doIngestRAG']);
        if (useIngestion && !ingestGateExists) {
          // Lade gespeicherten Markdown-Inhalt erneut (vereinfachend: extractedText)
          // Stabiler Schlüssel: Original-Quell-Item (PDF) bevorzugen, sonst Shadow‑Twin, sonst Fallback
          const fileId = (job.correlation.source?.itemId as string | undefined) || savedItemId || `${jobId}-md`;
          const fileName = `${(job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')}.${(job.correlation.options?.targetLanguage as string | undefined) || 'de'}.md`;
          const res = await IngestionService.upsertMarkdown(job.userEmail, job.libraryId, fileId, fileName, extractedText || '', docMetaForIngestion);
          const total = res.chunksUpserted + (res.docUpserted ? 1 : 0)
          await repo.setIngestion(jobId, { upsertAt: new Date(), vectorsUpserted: total, index: res.index });
          // Zusammenfassung loggen
          bufferLog(jobId, { phase: 'ingest_rag', message: `RAG-Ingestion: ${res.chunksUpserted} Chunks, ${res.docUpserted ? 1 : 0} Doc` });
          FileLogger.info('external-jobs', 'Ingestion success', { jobId, chunks: res.chunksUpserted, doc: res.docUpserted, total })
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date() });
        } else {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
        }
      } catch (err) {
        const reason = (() => {
          if (err && typeof err === 'object') {
            const e = err as { message?: unknown }
            const msg = typeof e.message === 'string' ? e.message : undefined
            return msg || String(err)
          }
          return String(err)
        })()
        bufferLog(jobId, { phase: 'ingest_rag_failed', message: reason })
        FileLogger.error('external-jobs', 'Ingestion failed', err)
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'RAG Ingestion fehlgeschlagen', details: { reason } } });
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
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
    }

    // Sollte nicht erreicht werden
    return NextResponse.json({ status: 'ok', jobId, kind: 'noop_final' });
  } catch (err) {
    try {
      const { jobId } = await params;
      const repo = new ExternalJobsRepository();
      const job = await repo.get(jobId);
      if (job) {
        bufferLog(jobId, { phase: 'failed', message: 'Invalid payload' });
        await repo.appendLog(jobId, { phase: 'failed', message: 'Invalid payload' } as unknown as Record<string, unknown>);
        await repo.setStatus(jobId, 'failed', { error: { code: 'invalid_payload', message: err instanceof Error ? err.message : 'Invalid payload' } });
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Invalid payload', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      }
    } catch {
      // ignore secondary failures
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}



```

```typescriptreact
"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [forceRecreate, setForceRecreate] = React.useState<boolean>(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  function canRun(): boolean {
    return Boolean(provider && activeLibraryId && item && item.type === 'file');
  }

  function buildOptions(targetPhase: PdfPhase): PdfTransformOptions | null {
    if (!provider || !activeLibraryId || !item || item.type !== 'file') return null;
    const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
    const base: PdfTransformOptions = {
      targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
      fileName: TransformService.generateShadowTwinName(item.metadata.name, typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de'),
      createShadowTwin: true,
      fileExtension: 'md',
      extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
      useCache: defaults.useCache ?? true,
      includeImages: defaults.includeImages ?? false,
      template: typeof defaults.template === 'string' ? defaults.template : undefined,
    };
    return {
      ...base,
      // Neue Policies (UI: Phase n → 'do')
      policies: {
        extract: targetPhase >= 1 ? (forceRecreate ? 'force' : 'do') : 'ignore',
        metadata: targetPhase >= 2 ? 'do' : 'ignore',
        ingest: targetPhase >= 3 ? 'do' : 'ignore',
      },
      // Legacy-Fallbacks (werden serverseitig gemappt)
      doExtractPDF: targetPhase >= 1,
      doExtractMetadata: targetPhase >= 2,
      doIngestRAG: targetPhase >= 3,
      forceRecreate: forceRecreate && targetPhase >= 1 ? true : false,
    } as any;
  }

  async function runPhase(targetPhase: PdfPhase = phase) {
    try {
      if (!canRun()) {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider!.getBinary(item!.id);
      const file = new File([bin.blob], item!.metadata.name, { type: item!.metadata.mimeType });
      const options = buildOptions(targetPhase);
      if (!options) {
        toast.error('Fehler', { description: 'Optionen konnten nicht erstellt werden' });
        return;
      }
      // Keine Persistenz hier; Overrides bleiben bis zum Reload
      await TransformService.transformPdf(file, item!, options, provider!, refreshItems, activeLibraryId!);
      toast.success('Gestartet', { description: `Bis Phase ${targetPhase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badgeColor(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted-foreground/40';
  }

  function buttonStyle(isActive: boolean, _status?: "completed" | "in_progress" | "failed" | "pending") {
    return cn(
      "px-2 py-1 text-xs rounded border",
      isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
    );
  }

  function renderButton(id: PdfPhase, label: string, status?: "completed" | "in_progress" | "failed" | "pending") {
    const isActive = phase === id;
    return (
      <div key={id} className="flex items-center gap-1">
        <button
          type="button"
          className={buttonStyle(isActive, status)}
          onClick={() => setPhase(id)}
          aria-pressed={isActive}
          aria-label={`Phase ${id}: ${label}`}
          title={`${label} auswählen`}
        >
          <span className="mr-2 hidden sm:inline">{label}</span>
          <span className="inline-flex items-center justify-center h-2.5 w-2.5 rounded-full ml-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor(status)}`} />
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted text-muted-foreground"
          onClick={() => void runPhase(id)}
          title={`Bis ${label} ausführen`}
          aria-label={`Bis ${label} ausführen`}
          disabled={!canRun()}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={forceRecreate}
            onChange={(e) => setForceRecreate(e.target.checked)}
          />
          Erzwingen
        </label>
        <Button size="sm" variant="secondary" onClick={() => void runPhase()} disabled={!canRun()} title="Ausgewählte Phase starten">
          <Play className="h-3.5 w-3.5 mr-1" /> Starten
        </Button>
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}
    </div>
  );
}



```

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(false); // Phase 2
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(false); // Phase 3
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || 'de';
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, runMetaPhase, runIngestionPhase]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
          includeImages: defaults.includeImages ?? false,
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          // Legacy-Flags belassen (Server mappt auf Policies)
          doExtractMetadata: !!runMetaPhase,
          doIngestRAG: !!runIngestionPhase,
          forceRecreate: !!forceExtract,
          forceTemplate: !!forceMeta,
          // Neue Policies (explizit)
          // Phase 1 ist immer 'do' im Batch; force via Checkbox
          // Phase 2 abhängig von runMetaPhase und forceMeta, Phase 3 abhängig von runIngestionPhase
          policies: {
            extract: !!forceExtract ? 'force' : 'do',
            metadata: !!runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: !!runIngestionPhase ? 'do' : 'ignore',
          },
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, onOpenChange, pdfOverrides, provider]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-extract" checked={forceExtract} onCheckedChange={(v) => setForceExtract(Boolean(v))} />
                  <Label htmlFor="force-extract">Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-meta" checked={forceMeta} onCheckedChange={(v) => setForceMeta(Boolean(v))} disabled={!runMetaPhase} />
                  <Label htmlFor="force-meta" className={runMetaPhase ? '' : 'text-muted-foreground'}>Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

```typescript
*** Begin Patch
*** Update File: src/app/api/secretary/process-pdf/route.ts
@@
-import { gateExtractPdf } from '@/lib/processing/gates';
+import { gateExtractPdf } from '@/lib/processing/gates';
+import { legacyToPolicies, PhasePolicies, shouldRunWithGate } from '@/lib/processing/phase-policy';
@@
-    let doExtractPDF = ((formData.get('doExtractPDF') as string | null) ?? '') === 'true';
-    let doExtractMetadata = ((formData.get('doExtractMetadata') as string | null) ?? '') === 'true';
-    let doIngestRAG = ((formData.get('doIngestRAG') as string | null) ?? '') === 'true';
-    const forceRecreate = ((formData.get('forceRecreate') as string | null) ?? '') === 'true';
+    let doExtractPDF = ((formData.get('doExtractPDF') as string | null) ?? '') === 'true';
+    let doExtractMetadata = ((formData.get('doExtractMetadata') as string | null) ?? '') === 'true';
+    let doIngestRAG = ((formData.get('doIngestRAG') as string | null) ?? '') === 'true';
+    const forceRecreate = ((formData.get('forceRecreate') as string | null) ?? '') === 'true';
+    const policiesFromClient: PhasePolicies | undefined = (() => {
+      try { const raw = formData.get('policies') as string | null; return raw ? JSON.parse(raw) as PhasePolicies : undefined; } catch { return undefined; }
+    })();
@@
-    await repository.initializeSteps
+    await repository.initializeSteps
@@
-    const phases = { extract: doExtractPDF, template: doExtractMetadata, ingest: doIngestRAG };
+    const phases = { extract: doExtractPDF, template: doExtractMetadata, ingest: doIngestRAG };
     await repository.initializeSteps
@@
-    const correlation = {
+    const correlation = {
@@
-    const job: ExternalJob = {
+    const job: ExternalJob = {
@@
-    await repository.create(job);
+    await repository.create(job);
     // Schritte initialisieren und Parameter mitschreiben (für Report-Tab)
-    await repository.initializeSteps
+    await repository.initializeSteps
@@
-    const autoSkipExisting: boolean = true;
+    const autoSkipExisting: boolean = true;
@@
-        const g = await gateExtractPdf({
+        const g = await gateExtractPdf({
           repo: repository,
           jobId,
           userEmail,
           library: lib,
           source: { itemId: originalItemId, parentId, name: file?.name },
           options: { targetLanguage }
         });
-        if (g.exists && !forceRecreate) {
+        const policies = policiesFromClient || legacyToPolicies({ doExtractPDF, doExtractMetadata, doIngestRAG, forceRecreate });
+        const runExtract = shouldRunWithGate(g.exists, policies.extract);
+        if (!runExtract) {
*** End Patch
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { env } from 'process';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { ExternalJob } from '@/types/external-job';
import { LibraryService } from '@/lib/services/library-service';
// Storage: konsequent Server-Provider verwenden
import { getServerProvider } from '@/lib/storage/server-provider';
import { gateExtractPdf } from '@/lib/processing/gates';
import { legacyToPolicies, PhasePolicies, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { TransformService } from '@/lib/transform/transform-service';

export async function POST(request: NextRequest) {
  try {
    FileLogger.info('process-pdf', 'Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-pdf] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    FileLogger.debug('process-pdf', 'Authentifizierung erfolgreich', { userId });

    // Alle Request-Header protokollieren
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // FormData aus dem Request holen
    const formData = await request.formData();
    const formDataKeys: string[] = [];
    formData.forEach((value, key) => {
      formDataKeys.push(key);
    });
    FileLogger.debug('process-pdf', 'FormData empfangen', { keys: formDataKeys });
    

    // Secretary Service URL aus Umgebungsvariablen holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // Sicherstellen, dass keine doppelten Slashes entstehen
    const normalizedUrl = secretaryServiceUrl?.endsWith('/') 
      ? `${secretaryServiceUrl}pdf/process` 
      : `${secretaryServiceUrl}/pdf/process`;
    
    FileLogger.info('process-pdf', 'Forward an Secretary Service', { url: normalizedUrl });
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
      
      // Protokolliere ungefähre Dateigröße für Debugging
      const file = formData.get('file') as File;
      console.log('[process-pdf] Ungefähre Dateigröße:', file.size, 'Bytes');
    }
    
    // Zielsprache (target_language)
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    } else {
      serviceFormData.append('target_language', 'de'); // Standardwert
    }
    
    // Template-Option NICHT an Secretary senden – wir transformieren serverseitig im Callback
    // (Der Secretary erwartet ggf. einen Pfad und würde sonst '...md.md' anhängen.)
    // Veraltetes Feld skipTemplate wird nicht mehr verwendet
    const skipTemplate = false;
    
    // Extraktionsmethode – Clientwert oder Library-Default
    let effectiveExtraction: string | null = null;
    if (formData.has('extractionMethod')) effectiveExtraction = String(formData.get('extractionMethod'));
    if (!effectiveExtraction) {
      try {
        const libHeader = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
        const usr = await currentUser();
        const email = usr?.emailAddresses?.[0]?.emailAddress || '';
        if (libHeader && email) {
          const svc = LibraryService.getInstance();
          const libs = await svc.getUserLibraries(email);
          const lib = libs.find(l => l.id === libHeader);
          effectiveExtraction = lib?.config?.secretaryService?.pdfDefaults?.extractionMethod || null;
        }
      } catch {}
    }
    serviceFormData.append('extraction_method', effectiveExtraction || 'native');
    
    // Cache-Optionen
    if (formData.has('useCache')) {
      serviceFormData.append('useCache', formData.get('useCache') as string);
    } else {
      serviceFormData.append('useCache', 'true'); // Standardwert: Cache verwenden
    }
    
    // Include Images Option
    if (formData.has('includeImages')) {
      serviceFormData.append('includeImages', formData.get('includeImages') as string);
    } else {
      serviceFormData.append('includeImages', 'false'); // Standardwert: Keine Bilder
    }
    
    // Force refresh Option
    if (formData.has('force_refresh')) {
      serviceFormData.append('force_refresh', formData.get('force_refresh') as string);
    } else {
      serviceFormData.append('force_refresh', 'false'); // Standardwert
    }

    // Veraltetes Feld useIngestionPipeline wird nicht mehr verwendet
    const useIngestionPipeline = false;

    // Neue vereinfachte Flags aus dem Request
    let doExtractPDF = ((formData.get('doExtractPDF') as string | null) ?? '') === 'true';
    let doExtractMetadata = ((formData.get('doExtractMetadata') as string | null) ?? '') === 'true';
    let doIngestRAG = ((formData.get('doIngestRAG') as string | null) ?? '') === 'true';
    const forceRecreate = ((formData.get('forceRecreate') as string | null) ?? '') === 'true';
    // Fallback: Wenn Flags fehlen (alle false), aus alten Parametern ableiten
    if (!doExtractPDF && !doExtractMetadata && !doIngestRAG) {
      doExtractPDF = true; // Phase 1 grundsätzlich erlaubt
      doExtractMetadata = !skipTemplate; // wenn nicht Phase-1-only, dann Metadaten
      doIngestRAG = useIngestionPipeline; // bis Alt-Flag entfernt ist
    }

    // Job anlegen (per-Job-Secret)
    const repository = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repository.hashSecret(jobSecret);

    // Correlation aus Request ableiten
    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    // Korrelation: nutze die bereits ermittelte effektive Methode oben, falls vorhanden
    const extractionMethod = (formData.get('extractionMethod') as string) || (serviceFormData.get('extraction_method') as string) || 'native';
    const includeImages = (formData.get('includeImages') as string) ?? 'false';
    const useCache = (formData.get('useCache') as string) ?? 'true';
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    const file = formData.get('file') as File | null;

    // Optional vom Client mitgeliefert (für zielgenaues Speichern)
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    const correlation = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || 'application/pdf',
        name: file?.name,
        itemId: originalItemId,
        parentId: parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeImages: includeImages === 'true',
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    } satisfies ExternalJob['correlation'];

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await repository.create(job);
    // Schritte initialisieren und Parameter mitschreiben (für Report-Tab)
    const phases = { extract: doExtractPDF, template: doExtractMetadata, ingest: doIngestRAG };
    await repository.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeImages: includeImages === 'true',
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      // Neue vereinfachte Flags
      doExtractPDF,
      doExtractMetadata,
      doIngestRAG,
      forceRecreate
    });
    FileLogger.info('process-pdf', 'Job angelegt', {
      jobId,
      libraryId,
      userEmail,
      extractionMethod,
      includeImages,
      useCache,
      targetLanguage
    });

    // Sofortiges Live-Event: queued (für UI, damit Eintrag direkt erscheint)
    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}
    // Watchdog starten (600s ohne Progress => Timeout)
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: correlation.source?.name }, 600_000);

    // Callback-Informationen (generisch) anfügen
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
      serviceFormData.append('callback_url', callbackUrl);
      
      // Detailliertes Logging der Callback-Parameter
      FileLogger.info('process-pdf', 'Callback-Parameter vorbereitet', {
        jobId,
        callbackUrl,
        hasAppUrl: !!appUrl,
        appUrl: appUrl
      });
    } else {
      FileLogger.warn('process-pdf', 'NEXT_PUBLIC_APP_URL nicht gesetzt', { jobId });
    }
    
    // per-Job-Secret mitgeben
    serviceFormData.append('callback_token', jobSecret);
    // jobId nicht zusätzlich mitsenden – steht in der Callback-URL
    FileLogger.info('process-pdf', 'Job-Secret generiert', {
      jobId,
      hasSecret: !!jobSecret,
      secretLength: jobSecret.length
    });
    
    // Korrelation NICHT an Secretary senden – Secretary erhält nur jobId + Callback
    FileLogger.info('process-pdf', 'Korrelation nicht an Secretary gesendet (nur jobId & Callback)', {
      jobId,
      correlationSummary: {
        hasSource: !!correlation.source,
        hasOptions: !!correlation.options
      }
    });

    // HTTP-Request als JSON loggen (kopierbar für Tests)
    const httpRequest = {
      method: 'POST',
      url: normalizedUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      },
      body: {
        file: '[BINARY: PDF-Datei]',
        target_language: targetLanguage,
        extraction_method: extractionMethod,
        useCache: useCache,
        includeImages: includeImages,
        force_refresh: (formData.get('force_refresh') as string) ?? 'false',
        callback_url: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}`,
        callback_token: jobSecret,
      }
    };
    
    FileLogger.info('process-pdf', 'HTTP-Request an Secretary Service', { jobId, request: httpRequest });
    // Persistenter Logeintrag in DB
    await repository.appendLog(jobId, { phase: 'request_sent', sourcePath: correlation.source?.itemId, targetParentId: correlation.source?.parentId, callbackUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : undefined });

    // Idempotenz ist immer aktiv
    const autoSkipExisting: boolean = true;

    // Extract-Gate vor dem Secretary-Call: vorhanden? → je nach Flags entscheiden
    try {
      if (autoSkipExisting) {
        const libraryService = LibraryService.getInstance();
        const libraries = await libraryService.getUserLibraries(userEmail);
        const lib = libraries.find(l => l.id === libraryId);
        const g = await gateExtractPdf({
          repo: repository,
          jobId,
          userEmail,
          library: lib,
          source: { itemId: originalItemId, parentId, name: file?.name },
          options: { targetLanguage }
        });
        if (g.exists && !forceRecreate) {
          // Phase 1 überspringen
          await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });

          // Template-Only Pfad, wenn nicht explizit skipTemplate=true
          if (!skipTemplate && doExtractMetadata) {
            try {
              const libraryService = LibraryService.getInstance();
              const libraries2 = await libraryService.getUserLibraries(userEmail);
              const lib2 = libraries2.find(l => l.id === libraryId);
              if (lib2) {
                const provider = await getServerProvider(userEmail, libraryId);
                await repository.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });

                // Template-Datei finden (wie im Callback)
                const rootItems = await provider.listItemsById('root');
                const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
                const ensureTemplatesFolderId = async (): Promise<string> => {
                  if (templatesFolder) return templatesFolder.id;
                  const created = await provider.createFolder('root', 'templates');
                  return created.id;
                };
                const templatesFolderId = await ensureTemplatesFolderId();
                let chosen: { id: string } | undefined;
                if (templatesFolderId) {
                  const tplItems = await provider.listItemsById(templatesFolderId);
                  const preferredTemplate = ((lib2.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || (formData.get('template') as string | null) || '').trim();
                  const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
                  chosen = preferredTemplate
                    ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                    : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
                }

                let templateContent = '# {{title}}\n';
                if (chosen) {
                  const bin = await provider.getBinary(chosen.id);
                  templateContent = await bin.blob.text();
                }

                // Shadow‑Twin laden (im Parent by Name)
                const siblings = await provider.listItemsById(parentId || 'root');
                const expectedName = (g.details && typeof g.details === 'object' ? (g.details as { matched?: string }).matched : undefined) || (() => {
                  const base = (file?.name || 'output').replace(/\.[^/.]+$/, '');
                  return `${base}.${targetLanguage}.md`;
                })();
                const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName);
                if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
                const twinBin = await provider.getBinary(twin.id);
                const originalMarkdown = await twinBin.blob.text();
                const stripped = originalMarkdown.replace(/^---[\s\S]*?---\s*/m, '');

                // Transformer aufrufen
                const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
                const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
                const fd = new FormData();
                fd.append('text', stripped);
                fd.append('target_language', targetLanguage);
                fd.append('template_content', templateContent);
                fd.append('use_cache', 'false');
                // Kontext für LLM-Auswertung (Dateiname/Pfad/IDs)
                try {
                  const parentPath = await provider.getPathById(parentId || 'root'); // z.B. /Berichte Landesämter/Bevölk.Schutz
                  const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                  const rawName = (expectedName || file?.name || 'document.md');
                  const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                  const baseName = withoutExt.replace(new RegExp(`\\.${targetLanguage}$`, 'i'), '');
                  const ctx = {
                    filename: baseName,
                    filepath: dirPath,
                    libraryId,
                    jobId,
                    sourceItemId: originalItemId,
                    parentId
                  } as const;
                  fd.append('context', JSON.stringify(ctx));
                } catch {}
                const headers: Record<string, string> = { 'Accept': 'application/json' };
                const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
                if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
                const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
                const data: unknown = await resp.json().catch(() => ({}));
                const mdMeta = (data && typeof data === 'object' && !Array.isArray(data)) ? ((data as { data?: { structured_data?: Record<string, unknown> } }).data?.structured_data || {}) : {};

                await repository.appendMeta(jobId, mdMeta as Record<string, unknown>, 'template_transform');
                await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });

                // Markdown mit neuem Frontmatter überschreiben (SSOT: flaches Schema ergänzen)
                const ssotFlat: Record<string, unknown> = {
                  job_id: jobId,
                  source_file: correlation?.source?.name || (file?.name || 'document.pdf'),
                  // In diesem Template-only Pfad sind extract/template abgeschlossen (Text lag bereits vor)
                  extract_status: 'completed',
                  template_status: 'completed',
                  ingest_status: 'none',
                  summary_language: targetLanguage,
                };
                const mergedMeta = { ...(mdMeta as Record<string, unknown>), ...ssotFlat } as Record<string, unknown>;
                const newMarkdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
                  ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(stripped, mergedMeta)
                  : originalMarkdown;
                const outFile = new File([new Blob([newMarkdown], { type: 'text/markdown' })], expectedName || (file?.name || 'output.md'), { type: 'text/markdown' });
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
                await provider.uploadFile(parentId || 'root', outFile);
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

                // Ingestion je nach Flag nur markieren (kein Upsert hier)
                if (doIngestRAG) {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
                } else {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
                }

                clearWatchdog(jobId);
                await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (template-only)' });
                await repository.setStatus(jobId, 'completed');
                try {
                  getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (template-only)', jobType: 'pdf', fileName: correlation.source?.name, sourceItemId: originalItemId });
                } catch {}
                return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-template-only', main_processor: 'template', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
              }
            } catch {
              // Fallback: wenn Template-Only fehlschlägt, markieren wir die Schritte als skipped und schließen
              await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              if (doIngestRAG) {
                await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              } else {
                await repository.updateStep(jobId, ' ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
              }
              clearWatchdog(jobId);
              await repository.setStatus(jobId, 'completed');
              return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
            }
          } else {
            // Kein Template‑Only gewünscht → alle übrigen Schritte überspringen
            await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            if (doIngestRAG) {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            } else {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
            }
            clearWatchdog(jobId);
            await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract skipped: artifact_exists)' });
            await repository.setStatus(jobId, 'completed');
            try {
              getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (skipped extract)', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId });
            } catch {}
            return NextResponse.json({
              status: 'accepted',
              worker: 'secretary',
              process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true },
              job: { id: jobId },
              webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` },
              error: null
            });
          }
        }
      }
    } catch {}

    // Anfrage an den Secretary Service senden (nur wenn doExtractPDF true oder keine Flags gesetzt)
    if (!doExtractPDF && (doExtractMetadata || doIngestRAG)) {
      // Kein Worker-Call notwendig, die Arbeit passiert lokal (Template‑Only) oder es ist nur Ingestion geplant (aktueller Pfad löst Ingestion erst im Callback aus, daher schließen wir hier ab)
      // Falls nur Ingestion geplant ist, führt der Callback es später aus; hier markieren wir extract als skipped
      await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'not_requested' } });
      return NextResponse.json({ status: 'accepted', job: { id: jobId } })
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutMs = Number(process.env.SECRETARY_REQUEST_TIMEOUT_MS || '5000');
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      // Secretary nicht erreichbar → Job synchron auf failed setzen
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repository.appendLog(jobId, { phase: 'request_error', message });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: 'worker_unavailable', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json({ error: 'Secretary Service nicht erreichbar' }, { status: 503 });
    }

    // HTTP-Response als JSON loggen
    const httpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: '[RESPONSE_BODY]' // Wird nach dem Parsen geloggt
    };
    
    FileLogger.info('process-pdf', 'Secretary HTTP-Response', { jobId, response: httpResponse });
    await repository.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });

    const data = await response.json();
    FileLogger.info('process-pdf', 'Secretary Response Body', {
      jobId,
      responseBody: data
    });

    if (!response.ok) {
      FileLogger.error('process-pdf', 'Secretary Fehler', data);
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repository.appendLog(jobId, { phase: 'request_error', status: response.status, statusText: response.statusText });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: `worker_error ${response.status}`, jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json(
        { error: data?.error || 'Fehler beim Transformieren der PDF-Datei' },
        { status: response.status }
      );
    }

    // Rückgabe beibehaltend (kompatibel) und JobId hinzufügen
    FileLogger.info('process-pdf', 'Request akzeptiert, gebe Job zurück', { jobId });
    return NextResponse.json({ ...data, job: { id: jobId } });
  } catch (error) {
    FileLogger.error('process-pdf', 'Unerwarteter Fehler', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { env } from 'process';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { ExternalJob } from '@/types/external-job';
import { LibraryService } from '@/lib/services/library-service';
// Storage: konsequent Server-Provider verwenden
import { getServerProvider } from '@/lib/storage/server-provider';
import { gateExtractPdf } from '@/lib/processing/gates';
import { legacyToPolicies, PhasePolicies, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { TransformService } from '@/lib/transform/transform-service';

export async function POST(request: NextRequest) {
  try {
    FileLogger.info('process-pdf', 'Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-pdf] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    FileLogger.debug('process-pdf', 'Authentifizierung erfolgreich', { userId });

    // Alle Request-Header protokollieren
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // FormData aus dem Request holen
    const formData = await request.formData();
    const formDataKeys: string[] = [];
    formData.forEach((value, key) => {
      formDataKeys.push(key);
    });
    FileLogger.debug('process-pdf', 'FormData empfangen', { keys: formDataKeys });
    

    // Secretary Service URL aus Umgebungsvariablen holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // Sicherstellen, dass keine doppelten Slashes entstehen
    const normalizedUrl = secretaryServiceUrl?.endsWith('/') 
      ? `${secretaryServiceUrl}pdf/process` 
      : `${secretaryServiceUrl}/pdf/process`;
    
    FileLogger.info('process-pdf', 'Forward an Secretary Service', { url: normalizedUrl });
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
      
      // Protokolliere ungefähre Dateigröße für Debugging
      const file = formData.get('file') as File;
      console.log('[process-pdf] Ungefähre Dateigröße:', file.size, 'Bytes');
    }
    
    // Zielsprache (target_language)
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    } else {
      serviceFormData.append('target_language', 'de'); // Standardwert
    }
    
    // Template-Option NICHT an Secretary senden – wir transformieren serverseitig im Callback
    // (Der Secretary erwartet ggf. einen Pfad und würde sonst '...md.md' anhängen.)
    // Veraltetes Feld skipTemplate wird nicht mehr verwendet
    const skipTemplate = false;
    
    // Extraktionsmethode – Clientwert oder Library-Default
    let effectiveExtraction: string | null = null;
    if (formData.has('extractionMethod')) effectiveExtraction = String(formData.get('extractionMethod'));
    if (!effectiveExtraction) {
      try {
        const libHeader = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
        const usr = await currentUser();
        const email = usr?.emailAddresses?.[0]?.emailAddress || '';
        if (libHeader && email) {
          const svc = LibraryService.getInstance();
          const libs = await svc.getUserLibraries(email);
          const lib = libs.find(l => l.id === libHeader);
          effectiveExtraction = lib?.config?.secretaryService?.pdfDefaults?.extractionMethod || null;
        }
      } catch {}
    }
    serviceFormData.append('extraction_method', effectiveExtraction || 'native');
    
    // Cache-Optionen
    if (formData.has('useCache')) {
      serviceFormData.append('useCache', formData.get('useCache') as string);
    } else {
      serviceFormData.append('useCache', 'true'); // Standardwert: Cache verwenden
    }
    
    // Include Images Option
    if (formData.has('includeImages')) {
      serviceFormData.append('includeImages', formData.get('includeImages') as string);
    } else {
      serviceFormData.append('includeImages', 'false'); // Standardwert: Keine Bilder
    }
    
    // Force refresh Option
    if (formData.has('force_refresh')) {
      serviceFormData.append('force_refresh', formData.get('force_refresh') as string);
    } else {
      serviceFormData.append('force_refresh', 'false'); // Standardwert
    }

    // Veraltetes Feld useIngestionPipeline wird nicht mehr verwendet
    const useIngestionPipeline = false;

    // Neue vereinfachte Flags aus dem Request
    let doExtractPDF = ((formData.get('doExtractPDF') as string | null) ?? '') === 'true';
    let doExtractMetadata = ((formData.get('doExtractMetadata') as string | null) ?? '') === 'true';
    let doIngestRAG = ((formData.get('doIngestRAG') as string | null) ?? '') === 'true';
    const forceRecreate = ((formData.get('forceRecreate') as string | null) ?? '') === 'true';
    // Policies optional aus Client übernehmen
    const policiesFromClient: PhasePolicies | undefined = (() => {
      try {
        const raw = formData.get('policies') as string | null;
        return raw ? JSON.parse(raw) as PhasePolicies : undefined;
      } catch {
        return undefined;
      }
    })();
    // Fallback: Wenn Flags fehlen (alle false), aus alten Parametern ableiten
    if (!doExtractPDF && !doExtractMetadata && !doIngestRAG) {
      doExtractPDF = true; // Phase 1 grundsätzlich erlaubt
      doExtractMetadata = !skipTemplate; // wenn nicht Phase-1-only, dann Metadaten
      doIngestRAG = useIngestionPipeline; // bis Alt-Flag entfernt ist
    }

    // Job anlegen (per-Job-Secret)
    const repository = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repository.hashSecret(jobSecret);

    // Correlation aus Request ableiten
    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    // Korrelation: nutze die bereits ermittelte effektive Methode oben, falls vorhanden
    const extractionMethod = (formData.get('extractionMethod') as string) || (serviceFormData.get('extraction_method') as string) || 'native';
    const includeImages = (formData.get('includeImages') as string) ?? 'false';
    const useCache = (formData.get('useCache') as string) ?? 'true';
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    const file = formData.get('file') as File | null;

    // Optional vom Client mitgeliefert (für zielgenaues Speichern)
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    const correlation = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || 'application/pdf',
        name: file?.name,
        itemId: originalItemId,
        parentId: parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeImages: includeImages === 'true',
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    } satisfies ExternalJob['correlation'];

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await repository.create(job);
    // Schritte initialisieren und Parameter mitschreiben (für Report-Tab)
    const phases = { extract: doExtractPDF, template: doExtractMetadata, ingest: doIngestRAG };
    await repository.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeImages: includeImages === 'true',
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      // Neue vereinfachte Flags
      doExtractPDF,
      doExtractMetadata,
      doIngestRAG,
      forceRecreate,
      policies: policiesFromClient || legacyToPolicies({ doExtractPDF, doExtractMetadata, doIngestRAG, forceRecreate })
    });
    FileLogger.info('process-pdf', 'Job angelegt', {
      jobId,
      libraryId,
      userEmail,
      extractionMethod,
      includeImages,
      useCache,
      targetLanguage
    });

    // Sofortiges Live-Event: queued (für UI, damit Eintrag direkt erscheint)
    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}
    // Watchdog starten (600s ohne Progress => Timeout)
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: correlation.source?.name }, 600_000);

    // Callback-Informationen (generisch) anfügen
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
      serviceFormData.append('callback_url', callbackUrl);
      
      // Detailliertes Logging der Callback-Parameter
      FileLogger.info('process-pdf', 'Callback-Parameter vorbereitet', {
        jobId,
        callbackUrl,
        hasAppUrl: !!appUrl,
        appUrl: appUrl
      });
    } else {
      FileLogger.warn('process-pdf', 'NEXT_PUBLIC_APP_URL nicht gesetzt', { jobId });
    }
    
    // per-Job-Secret mitgeben
    serviceFormData.append('callback_token', jobSecret);
    // jobId nicht zusätzlich mitsenden – steht in der Callback-URL
    FileLogger.info('process-pdf', 'Job-Secret generiert', {
      jobId,
      hasSecret: !!jobSecret,
      secretLength: jobSecret.length
    });
    
    // Korrelation NICHT an Secretary senden – Secretary erhält nur jobId + Callback
    FileLogger.info('process-pdf', 'Korrelation nicht an Secretary gesendet (nur jobId & Callback)', {
      jobId,
      correlationSummary: {
        hasSource: !!correlation.source,
        hasOptions: !!correlation.options
      }
    });

    // HTTP-Request als JSON loggen (kopierbar für Tests)
    const httpRequest = {
      method: 'POST',
      url: normalizedUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      },
      body: {
        file: '[BINARY: PDF-Datei]',
        target_language: targetLanguage,
        extraction_method: extractionMethod,
        useCache: useCache,
        includeImages: includeImages,
        force_refresh: (formData.get('force_refresh') as string) ?? 'false',
        callback_url: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}`,
        callback_token: jobSecret,
      }
    };
    
    FileLogger.info('process-pdf', 'HTTP-Request an Secretary Service', { jobId, request: httpRequest });
    // Persistenter Logeintrag in DB
    await repository.appendLog(jobId, { phase: 'request_sent', sourcePath: correlation.source?.itemId, targetParentId: correlation.source?.parentId, callbackUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : undefined });

    // Idempotenz ist immer aktiv
    const autoSkipExisting: boolean = true;

    // Extract-Gate vor dem Secretary-Call: vorhanden? → je nach Flags entscheiden
    try {
      if (autoSkipExisting) {
        const libraryService = LibraryService.getInstance();
        const libraries = await libraryService.getUserLibraries(userEmail);
        const lib = libraries.find(l => l.id === libraryId);
        const g = await gateExtractPdf({
          repo: repository,
          jobId,
          userEmail,
          library: lib,
          source: { itemId: originalItemId, parentId, name: file?.name },
          options: { targetLanguage }
        });
        const policies = policiesFromClient || legacyToPolicies({ doExtractPDF, doExtractMetadata, doIngestRAG, forceRecreate });
        const runExtract = shouldRunWithGate(g.exists, policies.extract);
        if (!runExtract) {
          // Phase 1 überspringen
          await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });

          // Template-Only Pfad, wenn nicht explizit skipTemplate=true
          if (!skipTemplate && doExtractMetadata) {
            try {
              const libraryService = LibraryService.getInstance();
              const libraries2 = await libraryService.getUserLibraries(userEmail);
              const lib2 = libraries2.find(l => l.id === libraryId);
              if (lib2) {
                const provider = await getServerProvider(userEmail, libraryId);
                await repository.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });

                // Template-Datei finden (wie im Callback)
                const rootItems = await provider.listItemsById('root');
                const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
                const ensureTemplatesFolderId = async (): Promise<string> => {
                  if (templatesFolder) return templatesFolder.id;
                  const created = await provider.createFolder('root', 'templates');
                  return created.id;
                };
                const templatesFolderId = await ensureTemplatesFolderId();
                let chosen: { id: string } | undefined;
                if (templatesFolderId) {
                  const tplItems = await provider.listItemsById(templatesFolderId);
                  const preferredTemplate = ((lib2.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || (formData.get('template') as string | null) || '').trim();
                  const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
                  chosen = preferredTemplate
                    ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                    : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
                }

                let templateContent = '# {{title}}\n';
                if (chosen) {
                  const bin = await provider.getBinary(chosen.id);
                  templateContent = await bin.blob.text();
                }

                // Shadow‑Twin laden (im Parent by Name)
                const siblings = await provider.listItemsById(parentId || 'root');
                const expectedName = (g.details && typeof g.details === 'object' ? (g.details as { matched?: string }).matched : undefined) || (() => {
                  const base = (file?.name || 'output').replace(/\.[^/.]+$/, '');
                  return `${base}.${targetLanguage}.md`;
                })();
                const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName);
                if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
                const twinBin = await provider.getBinary(twin.id);
                const originalMarkdown = await twinBin.blob.text();
                const stripped = originalMarkdown.replace(/^---[\s\S]*?---\s*/m, '');

                // Transformer aufrufen
                const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
                const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
                const fd = new FormData();
                fd.append('text', stripped);
                fd.append('target_language', targetLanguage);
                fd.append('template_content', templateContent);
                fd.append('use_cache', 'false');
                // Kontext für LLM-Auswertung (Dateiname/Pfad/IDs)
                try {
                  const parentPath = await provider.getPathById(parentId || 'root'); // z.B. /Berichte Landesämter/Bevölk.Schutz
                  const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                  const rawName = (expectedName || file?.name || 'document.md');
                  const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                  const baseName = withoutExt.replace(new RegExp(`\\.${targetLanguage}$`, 'i'), '');
                  const ctx = {
                    filename: baseName,
                    filepath: dirPath,
                    libraryId,
                    jobId,
                    sourceItemId: originalItemId,
                    parentId
                  } as const;
                  fd.append('context', JSON.stringify(ctx));
                } catch {}
                const headers: Record<string, string> = { 'Accept': 'application/json' };
                const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
                if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
                const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
                const data: unknown = await resp.json().catch(() => ({}));
                const mdMeta = (data && typeof data === 'object' && !Array.isArray(data)) ? ((data as { data?: { structured_data?: Record<string, unknown> } }).data?.structured_data || {}) : {};

                await repository.appendMeta(jobId, mdMeta as Record<string, unknown>, 'template_transform');
                await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });

                // Markdown mit neuem Frontmatter überschreiben (SSOT: flaches Schema ergänzen)
                const ssotFlat: Record<string, unknown> = {
                  job_id: jobId,
                  source_file: correlation?.source?.name || (file?.name || 'document.pdf'),
                  // In diesem Template-only Pfad sind extract/template abgeschlossen (Text lag bereits vor)
                  extract_status: 'completed',
                  template_status: 'completed',
                  ingest_status: 'none',
                  summary_language: targetLanguage,
                };
                const mergedMeta = { ...(mdMeta as Record<string, unknown>), ...ssotFlat } as Record<string, unknown>;
                const newMarkdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
                  ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(stripped, mergedMeta)
                  : originalMarkdown;
                const outFile = new File([new Blob([newMarkdown], { type: 'text/markdown' })], expectedName || (file?.name || 'output.md'), { type: 'text/markdown' });
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
                await provider.uploadFile(parentId || 'root', outFile);
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

                // Ingestion je nach Flag nur markieren (kein Upsert hier)
                if (doIngestRAG) {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
                } else {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
                }

                clearWatchdog(jobId);
                await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (template-only)' });
                await repository.setStatus(jobId, 'completed');
                try {
                  getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (template-only)', jobType: 'pdf', fileName: correlation.source?.name, sourceItemId: originalItemId });
                } catch {}
                return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-template-only', main_processor: 'template', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
              }
            } catch {
              // Fallback: wenn Template-Only fehlschlägt, markieren wir die Schritte als skipped und schließen
              await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              if (doIngestRAG) {
                await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              } else {
                await repository.updateStep(jobId, ' ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
              }
              clearWatchdog(jobId);
              await repository.setStatus(jobId, 'completed');
              return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
            }
          } else {
            // Kein Template‑Only gewünscht → alle übrigen Schritte überspringen
            await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            if (doIngestRAG) {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            } else {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
            }
            clearWatchdog(jobId);
            await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract skipped: artifact_exists)' });
            await repository.setStatus(jobId, 'completed');
            try {
              getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (skipped extract)', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId });
            } catch {}
            return NextResponse.json({
              status: 'accepted',
              worker: 'secretary',
              process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true },
              job: { id: jobId },
              webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` },
              error: null
            });
          }
        }
      }
    } catch {}

    // Anfrage an den Secretary Service senden (nur wenn doExtractPDF true oder keine Flags gesetzt)
    if (!doExtractPDF && (doExtractMetadata || doIngestRAG)) {
      // Kein Worker-Call notwendig, die Arbeit passiert lokal (Template‑Only) oder es ist nur Ingestion geplant (aktueller Pfad löst Ingestion erst im Callback aus, daher schließen wir hier ab)
      // Falls nur Ingestion geplant ist, führt der Callback es später aus; hier markieren wir extract als skipped
      await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'not_requested' } });
      return NextResponse.json({ status: 'accepted', job: { id: jobId } })
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutMs = Number(process.env.SECRETARY_REQUEST_TIMEOUT_MS || '5000');
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      // Secretary nicht erreichbar → Job synchron auf failed setzen
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repository.appendLog(jobId, { phase: 'request_error', message });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: 'worker_unavailable', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json({ error: 'Secretary Service nicht erreichbar' }, { status: 503 });
    }

    // HTTP-Response als JSON loggen
    const httpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: '[RESPONSE_BODY]' // Wird nach dem Parsen geloggt
    };
    
    FileLogger.info('process-pdf', 'Secretary HTTP-Response', { jobId, response: httpResponse });
    await repository.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });

    const data = await response.json();
    FileLogger.info('process-pdf', 'Secretary Response Body', {
      jobId,
      responseBody: data
    });

    if (!response.ok) {
      FileLogger.error('process-pdf', 'Secretary Fehler', data);
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repository.appendLog(jobId, { phase: 'request_error', status: response.status, statusText: response.statusText });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: `worker_error ${response.status}`, jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json(
        { error: data?.error || 'Fehler beim Transformieren der PDF-Datei' },
        { status: response.status }
      );
    }

    // Rückgabe beibehaltend (kompatibel) und JobId hinzufügen
    FileLogger.info('process-pdf', 'Request akzeptiert, gebe Job zurück', { jobId });
    return NextResponse.json({ ...data, job: { id: jobId } });
  } catch (error) {
    FileLogger.error('process-pdf', 'Unerwarteter Fehler', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 
```

- Ich habe die neue Tri‑State‑Steuerung eingeführt: `PhaseDirective = 'ignore' | 'do' | 'force'` plus Helfer in `src/lib/processing/phase-policy.ts`. Diese mappt bestehende Flags (`doExtractPDF`, `doExtractMetadata`, `doIngestRAG`, `forceRecreate`, `forceTemplate`) deterministisch auf Policies und stellt `getPolicies`/`shouldRunWithGate` bereit.

- Batch-Submit aktualisiert: `src/app/api/secretary/process-pdf/batch/route.ts` schreibt nun zusätzlich `parameters.policies` (aus Legacy‑Flags gemappt). Legacy‑Felder bleiben kompatibel erhalten.

- Retry-Route erweitert: `src/app/api/external/jobs/[jobId]/retry/route.ts` prüft vor dem Secretary‑Call das Extract‑Gate und die Policy. Bei `extract: 'ignore'` oder Gate‑Treffer mit `'do'` wird Extraktion übersprungen und die nächsten Schritte entsprechend markiert. Secretary wird nur gestartet, wenn `shouldRunExtract(...)` true ist.

- Callback-Route: `src/app/api/external/jobs/[jobId]/route.ts` nutzt jetzt `policies.metadata` zur Entscheidung. Mit `shouldRunWithGate` wird Phase 2 nur ausgeführt, wenn Policy es verlangt; sonst „skipped“. Ingestion bleibt wie bisher, kann aber analog erweitert werden.

- Single‑Upload Route: `src/app/api/secretary/process-pdf/route.ts` akzeptiert optional `policies` vom Client, speichert sie in `parameters` und verwendet sie, um Phase 1 bei vorhandenem Shadow‑Twin zu überspringen.

- UI: 
  - `src/components/library/pdf-bulk-import-dialog.tsx` sendet `options.policies` passend zur Checkbox‑Kombi: Extract 'do' oder 'force', Metadata 'ignore'/'do'/'force', Ingest 'ignore'/'do'.
  - `src/components/library/phase-stepper.tsx` setzt `policies` in den Options für Einzel‑Phasenstart.

- Alle geänderten Dateien bauen lint‑frei.

Was du testen solltest
- Batch-Dialog: Phase 1 NICHT erzwingen, Phase 2 erzwingen. Erwartung: In DB `parameters.policies.extract = 'do'` und wird bei vorhandenem Shadow‑Twin übersprungen; `transform_template` wird ausgeführt, selbst wenn Extraktion übersprungen wurde.
- Batch-Dialog: Phase 1 „Erzwingen“ aktiv. Erwartung: `extract = 'force'`, Extraktion läuft immer.
- Nur Metadaten aktiv, Extraktion nicht erzwingen: vorhandener Shadow‑Twin → keine erneute Extraktion.
- Single‑Upload: identische Logik; optional Policies als JSON im FormData `policies`.

Status: Policies eingeführt und in Batch/Retry/Single/Callback teilweise verdrahtet. In der Callback‑Route ist die Ingestion‑Policy noch analog zu ergänzen; sag Bescheid, ob ich das jetzt direkt nachziehen soll.

---

**User**

Wir brauchen keine Rücksicht auf Legacy-Flags für Kompatibilität nehmen. bitte alle Typen auf neues Format anpassen

---

**Cursor**

Ich setze jetzt die vollständige Migration auf Policies um: entferne Legacy-Flags in Types/Optionen, passe Batch-/Single-Route, UI und Secretary-Client an, und aktualisiere Anzeige/Report-Code. Danach prüfe ich Linterfehler für alle geänderten Dateien.

```typescript
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { transformAudio, transformText, transformVideo, transformPdf, transformImage, SecretaryAudioResponse, SecretaryVideoResponse, SecretaryPdfResponse, SecretaryImageResponse } from "@/lib/secretary/client";
import { ImageExtractionService, ImageExtractionResult } from "./image-extraction-service";
import { FileLogger } from '@/lib/debug/logger';

export interface TransformSaveOptions {
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
  useCache?: boolean; // Neu: Cache-Option für alle Transformationen
  includeImages?: boolean; // Neu: Bilder mit extrahieren und speichern
  useIngestionPipeline?: boolean; // Neu: Auto-RAG nach Speicherung
}

export interface PdfTransformOptions extends TransformSaveOptions {
  extractionMethod: string;
  template?: string;
  skipTemplate?: boolean; // Phase 1: nur Extraktion
  // Policies steuern die Phasen klar typisiert
  policies?: import('@/lib/processing/phase-policy').PhasePolicies;
}

export interface TransformResult {
  text: string;
  savedItem?: StorageItem;
  updatedItems: StorageItem[];
  imageExtractionResult?: ImageExtractionResult; // Neu: Ergebnis der Bild-Extraktion
  jobId?: string;
}

export interface VideoTransformOptions extends TransformSaveOptions {
  extractAudio: boolean;
  extractFrames: boolean;
  frameInterval: number;
  sourceLanguage?: string;
  template?: string;
}

export interface ImageTransformOptions extends TransformSaveOptions {
  extractionMethod: string;
  context?: string;
}

/**
 * Typ für die Metadaten, die im Frontmatter gespeichert werden
 */
interface TransformMetadata {
  // Quelldatei-Informationen
  source_file?: string;
  source_file_id?: string;
  source_file_size?: number;
  source_file_type?: string;
  
  // Transformations-Informationen
  source_language?: string;
  target_language?: string;
  
  // Audio-Metadaten
  audio_duration?: number;
  audio_format?: string;
  audio_channels?: number;
  audio_sample_rate?: number;
  audio_bit_rate?: number;
  
  // Prozess-Informationen
  process_id?: string;
  processor?: string;
  processing_duration_ms?: number;
  model_used?: string;
  tokens_used?: number;
  
  // Secretary Service Informationen
  cache_used?: boolean;
  cache_key?: string;
  
  // Weitere Felder können hinzugefügt werden
  [key: string]: string | number | boolean | undefined;
}

/**
 * TransformService - Zentraler Service für Transformations- und Speicheroperationen
 * Verantwortlich für:
 * - Transformation von Audio zu Text
 * - Transformation von Text zu optimiertem Text
 * - Speichern der Ergebnisse als Shadow-Twin oder als neue Datei
 * - Aktualisieren der Dateiliste
 * - Bereitstellen einer einheitlichen Schnittstelle für alle Transformationstypen
 */
export class TransformService {
  /**
   * Generiert einen standardisierten Namen für einen Shadow-Twin
   * @param originalName Der ursprüngliche Dateiname
   * @param targetLanguage Die Zielsprache
   * @returns Der generierte Shadow-Twin-Name ohne Dateiendung
   */
  static generateShadowTwinName(originalName: string, targetLanguage: string): string {
    // Entferne alle Dateiendungen aus dem Namen
    const nameWithoutExtension = originalName.split('.').slice(0, -1).join('.');
    return `${nameWithoutExtension}.${targetLanguage}`;
  }

  /**
   * Transformiert eine Audio-Datei in Text
   * @param file Die zu transformierende Audio-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Speicheroptionen
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformAudio(
    file: File,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    // Audio-Datei wird transformiert - hole die vollständige Response
    const response = await transformAudio(file, options.targetLanguage, libraryId);
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    if (typeof response === 'string') {
      // Falls die Response nur ein String ist (alte API)
      transformedText = response;
    } else if (response && 'data' in response && response.data && response.data.transcription) {
      // Neue API mit vollständigen Metadaten
      const audioResponse = response as SecretaryAudioResponse;
      transformedText = audioResponse.data.transcription.text;
      
      // Sammle relevante Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        source_language: audioResponse.data.transcription.source_language || options.targetLanguage,
        target_language: options.targetLanguage,
        
        // Audio-Metadaten (falls vorhanden)
        audio_duration: audioResponse.data.metadata?.duration,
        audio_format: audioResponse.data.metadata?.format,
        audio_channels: audioResponse.data.metadata?.channels,
        audio_sample_rate: audioResponse.data.metadata?.sample_rate,
        audio_bit_rate: audioResponse.data.metadata?.bit_rate,
        
        // Prozess-Informationen
        process_id: audioResponse.process?.id,
        processor: audioResponse.process?.main_processor,
        processing_duration_ms: audioResponse.process?.llm_info?.total_duration,
        model_used: audioResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: audioResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: audioResponse.process?.is_from_cache || false,
        cache_key: audioResponse.process?.cache_key
      };
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    }
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const shadowTwinName = TransformService.generateShadowTwinName(originalItem.metadata.name, options.targetLanguage);
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        shadowTwinName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert eine Video-Datei
   * @param file Die zu transformierende Video-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Optionen für Video-Transformation und Speicherung
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis inklusive Video-spezifischer Daten
   */
  static async transformVideo(
    file: File,
    originalItem: StorageItem,
    options: VideoTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    console.log('[TransformService] transformVideo gestartet mit Optionen:', options);
    
    // Video-Datei wird transformiert - hole die vollständige Response
    const response = await transformVideo(
      file, 
      {
        extractAudio: options.extractAudio,
        extractFrames: options.extractFrames,
        frameInterval: options.frameInterval,
        targetLanguage: options.targetLanguage,
        sourceLanguage: options.sourceLanguage || 'auto',
        template: options.template
      }, 
      libraryId
    );
    
    console.log('[TransformService] Vollständige Video-Response:', JSON.stringify(response, null, 2));
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    console.log('[TransformService] Response-Check:', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasTranscription: !!(response && response.data && response.data.transcription),
      transcriptionType: response && response.data && response.data.transcription ? typeof response.data.transcription : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : [],
      transcriptionKeys: response && response.data && response.data.transcription ? Object.keys(response.data.transcription) : []
    });
    
    if (response && response.data && response.data.transcription) {
      console.log('[TransformService] Transkription gefunden:', response.data.transcription);
      
      // Vollständige Video-Response mit Metadaten
      const videoResponse = response as SecretaryVideoResponse;
      transformedText = videoResponse.data.transcription.text;
      
      console.log('[TransformService] Extrahierter Text-Länge:', transformedText.length);
      console.log('[TransformService] Text-Vorschau:', transformedText.substring(0, 200));
      
      // Sammle relevante Video-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        source_language: videoResponse.data.transcription.source_language || options.sourceLanguage || 'auto',
        target_language: options.targetLanguage,
        
        // Video-Metadaten
        video_duration: videoResponse.data.metadata?.duration,
        video_duration_formatted: videoResponse.data.metadata?.duration_formatted,
        video_file_size: videoResponse.data.metadata?.file_size,
        video_title: videoResponse.data.metadata?.title,
        audio_file: videoResponse.data.metadata?.audio_file,
        
        // Prozess-Informationen
        process_id: videoResponse.process?.id,
        processor: videoResponse.process?.main_processor,
        sub_processors: videoResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: videoResponse.process?.llm_info?.total_duration,
        model_used: videoResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: videoResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: videoResponse.process?.is_from_cache || false,
        cache_key: videoResponse.process?.cache_key
      };
      
      console.log('[TransformService] Extrahierte Metadaten:', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      console.error('[TransformService] Keine Transkription in der Response gefunden!');
      console.error('[TransformService] Response-Struktur:', {
        hasResponse: !!response,
        hasData: !!(response && response.data),
        hasTranscription: !!(response && response.data && response.data.transcription),
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    console.log('[TransformService] Finaler transformierter Text-Länge:', transformedText.length);
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      console.log('[TransformService] Speichere Shadow-Twin mit Länge:', markdownContent.length);
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      console.log('[TransformService] Keine Speicherung:', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length
      });
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert einen Text mithilfe des Secretary Services
   */
  static async transformText(
    textContent: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    template: string = "Besprechung"
  ): Promise<TransformResult> {
    console.log('[TransformService] transformText aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      options: options,
      template: template
    });
    
    // Text wird transformiert
    const transformedText = await transformText(
      textContent,
      options.targetLanguage,
      libraryId,
      template
    );
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        transformedText,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert eine PDF-Datei mithilfe des Secretary Services
   * @param file Die zu transformierende PDF-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Speicheroptionen
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformPdf(
    file: File,
    originalItem: StorageItem,
    options: PdfTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    FileLogger.info('TransformService', 'PDF-Transformation gestartet', {
      fileName: originalItem.metadata.name,
      includeImages: options.includeImages,
      extractionMethod: options.extractionMethod,
      targetLanguage: options.targetLanguage
    });
    FileLogger.debug('TransformService', 'IncludeImages Option', {
      includeImages: options.includeImages,
      type: typeof options.includeImages
    });
    
    // PDF-Datei wird transformiert - hole die vollständige Response
    const response = await transformPdf(
      file,
      options.targetLanguage,
      libraryId,
      options.template,
      options.extractionMethod,
      options.useCache ?? true,
      options.includeImages ?? false,
      undefined, // skipTemplate wird nicht mehr verwendet; Flags steuern Phasen
      {
        originalItemId: originalItem.id,
        parentId: originalItem.parentId,
        originalFileName: originalItem.metadata.name,
      }
    );
    
    FileLogger.debug('TransformService', 'Vollständige PDF-Response', { response: JSON.stringify(response, null, 2) });

    // Asynchroner Flow: nur "accepted" → Ergebnis via Webhook, kein Client-Fehler
    if (response && (response as unknown as { status?: string; data?: { extracted_text?: string } }).status === 'accepted' && !((response as unknown as { data?: { extracted_text?: string } }).data?.extracted_text)) {
      const r = response as unknown as { job?: { id?: string }; process?: { id?: string; is_from_cache?: boolean } };
      FileLogger.info('TransformService', 'Job akzeptiert – Ergebnis kommt per Webhook', {
        jobId: r?.job?.id,
        processId: r?.process?.id,
        fromCache: r?.process?.is_from_cache || false
      });
      return { text: '', updatedItems: [], jobId: r?.job?.id };
    }
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    FileLogger.debug('TransformService', 'Response-Check', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasExtractedText: !!(response && response.data && response.data.extracted_text),
      extractedTextType: response && response.data && response.data.extracted_text ? typeof response.data.extracted_text : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : []
    });
    
    // Prüfe auf images_archive_data
    FileLogger.debug('TransformService', 'Images Archive Check', {
      hasImagesArchiveData: !!(response && response.data && response.data.images_archive_data),
      hasImagesArchiveFilename: !!(response && response.data && response.data.images_archive_filename),
      imagesArchiveDataLength: response && response.data && response.data.images_archive_data ? response.data.images_archive_data.length : 0,
      imagesArchiveFilename: response && response.data ? response.data.images_archive_filename : 'undefined'
    });
    
    if (response && response.data && response.data.extracted_text) {
      FileLogger.info('TransformService', 'Extracted-Text gefunden', {
        textLength: response.data.extracted_text.length,
        textPreview: response.data.extracted_text.substring(0, 200)
      });
      
      // Vollständige PDF-Response mit Metadaten
      const pdfResponse = response as SecretaryPdfResponse;
      transformedText = pdfResponse.data.extracted_text;
      
      // Sammle relevante PDF-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        target_language: options.targetLanguage,
        
        // PDF-Metadaten
        page_count: pdfResponse.data.metadata?.page_count,
        format: pdfResponse.data.metadata?.format,
        extraction_method: pdfResponse.data.metadata?.extraction_method,
        file_name: pdfResponse.data.metadata?.file_name,
        file_size: pdfResponse.data.metadata?.file_size,
        
        // Prozess-Informationen
        process_id: pdfResponse.process?.id,
        processor: pdfResponse.process?.main_processor,
        sub_processors: pdfResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: pdfResponse.process?.llm_info?.total_duration,
        model_used: pdfResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: pdfResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: pdfResponse.process?.is_from_cache || false,
        cache_key: pdfResponse.process?.cache_key
      };
      
      FileLogger.debug('TransformService', 'Extrahierte Metadaten', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      FileLogger.warn('TransformService', 'Keine synchronen PDF-Daten erhalten', {
        hasResponse: !!response,
        hasData: !!(response && (response as unknown as { data?: unknown }).data)
      });
    }
    
    let imageExtractionResult: ImageExtractionResult | undefined;
    if (options.includeImages && response && response.data && response.data.images_archive_data) {
      try {
        FileLogger.info('TransformService', 'Starte Bild-Extraktion', {
          imagesArchiveFilename: response.data.images_archive_filename,
          imagesArchiveDataLength: response.data.images_archive_data.length
        });
        imageExtractionResult = await ImageExtractionService.saveZipArchive(
          response.data.images_archive_data,
          response.data.images_archive_filename || 'pdf_images.zip',
          originalItem,
          provider,
          refreshItems,
          transformedText, // Extrahierten Text weitergeben
          options.targetLanguage, // Target Language weitergeben
          response.data.metadata?.text_contents // Seiten-spezifische Texte weitergeben
        );
        FileLogger.info('TransformService', 'Bild-Extraktion abgeschlossen', {
          folderCreated: !!imageExtractionResult.folderItem,
          savedItemsCount: imageExtractionResult.savedItems.length
        });
      } catch (error) {
        FileLogger.error('TransformService', 'Fehler bei der Bild-Extraktion', error);
        // Bild-Extraktion ist optional, daher weitermachen
      }
    }
    
    FileLogger.debug('TransformService', 'Finaler transformierter Text', {
      textLength: transformedText.length
    });
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);

    // NEU: Detaillierte Debug-Logs für das Speicherproblem
    FileLogger.info('TransformService', 'Speicher-Bedingungen prüfen', {
      createShadowTwin: options.createShadowTwin,
      hasTransformedText: !!transformedText,
      transformedTextLength: transformedText.length,
      markdownContentLength: markdownContent.length,
      willSave: options.createShadowTwin && transformedText
    });

    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      FileLogger.info('TransformService', 'Speichere Shadow-Twin', {
        markdownLength: markdownContent.length
      });
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      FileLogger.info('TransformService', 'Shadow-Twin erfolgreich gespeichert', {
        savedItemId: result.savedItem?.id,
        savedItemName: result.savedItem?.metadata.name,
        updatedItemsCount: result.updatedItems.length
      });
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems,
        imageExtractionResult
      };
    } else {
      FileLogger.warn('TransformService', 'Keine Speicherung - Bedingungen nicht erfüllt', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length,
        reason: !options.createShadowTwin ? 'createShadowTwin ist false' : 'transformedText ist leer'
      });
    }

    return {
      text: transformedText,
      updatedItems: [],
      imageExtractionResult
    };
  }

  /**
   * Transformiert ein Bild mithilfe des Secretary Services
   * @param file Die zu transformierende Bilddatei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Optionen für Bild-Transformation und Speicherung
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformImage(
    file: File,
    originalItem: StorageItem,
    options: ImageTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    FileLogger.info('TransformService', 'Bild-Transformation gestartet', {
      fileName: originalItem.metadata.name,
      extractionMethod: options.extractionMethod,
      targetLanguage: options.targetLanguage
    });
    
    // Bild wird transformiert - hole die vollständige Response
    const response = await transformImage(
      file,
      options.targetLanguage,
      libraryId,
      options.extractionMethod,
      options.context,
      options.useCache ?? true
    );
    
    FileLogger.debug('TransformService', 'Vollständige Bild-Response', {
      response: JSON.stringify(response, null, 2)
    });
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    if (response && response.data && response.data.extracted_text) {
      FileLogger.info('TransformService', 'Extracted-Text gefunden', {
        textLength: response.data.extracted_text.length,
        textPreview: response.data.extracted_text.substring(0, 200)
      });
      
      // Vollständige Bild-Response mit Metadaten
      const imageResponse = response as SecretaryImageResponse;
      transformedText = imageResponse.data.extracted_text;
      
      // Sammle relevante Bild-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        target_language: options.targetLanguage,
        
        // Bild-Metadaten
        dimensions: imageResponse.data.metadata?.dimensions,
        format: imageResponse.data.metadata?.format,
        color_mode: imageResponse.data.metadata?.color_mode,
        dpi: imageResponse.data.metadata?.dpi?.join('x'),
        extraction_method: imageResponse.data.metadata?.extraction_method,
        file_name: imageResponse.data.metadata?.file_name,
        file_size: imageResponse.data.metadata?.file_size,
        
        // Prozess-Informationen
        process_id: imageResponse.process?.id,
        processor: imageResponse.process?.main_processor,
        sub_processors: imageResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: imageResponse.process?.llm_info?.total_duration,
        model_used: imageResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: imageResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: imageResponse.process?.is_from_cache || false,
        cache_key: imageResponse.process?.cache_key
      };
      
      FileLogger.debug('TransformService', 'Extrahierte Metadaten', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      FileLogger.error('TransformService', 'Kein Extracted-Text in der Response gefunden!', {
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    FileLogger.debug('TransformService', 'Finaler transformierter Text', {
      textLength: transformedText.length
    });
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);

    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      FileLogger.info('TransformService', 'Speichere Shadow-Twin', {
        markdownLength: markdownContent.length
      });
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      FileLogger.debug('TransformService', 'Keine Speicherung', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length
      });
    }

    return {
      text: transformedText,
      updatedItems: []
    };
  }
  
  // Hilfsmethode zum Speichern der transformierten Datei
  private static async saveTwinFile(
    content: string,
    originalItem: StorageItem,
    fileName: string,
    fileExtension: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<{ savedItem?: StorageItem; updatedItems: StorageItem[] }> {
    console.log('[TransformService] saveTwinFile aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension
    });
    
    // NEU: Detaillierte Debug-Logs
    FileLogger.info('TransformService', 'saveTwinFile gestartet', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension,
      contentLength: content.length,
      parentId: originalItem.parentId
    });
    
    // Hole aktuelle Dateien im Verzeichnis
    const currentItems = await refreshItems(originalItem.parentId);
    FileLogger.debug('TransformService', 'Aktuelle Dateien im Verzeichnis', {
      parentId: originalItem.parentId,
      itemCount: currentItems.length,
      existingFiles: currentItems.filter(item => item.type === 'file').map(item => item.metadata.name)
    });
    
    // Funktion zum Generieren eines eindeutigen Dateinamens
    const generateUniqueFileName = (baseName: string, extension: string): string => {
      let counter = 0;
      let candidateName = `${baseName}.${extension}`;
      
      // Prüfe ob der Name bereits existiert
      while (currentItems.some(item => 
        item.type === 'file' && 
        item.metadata.name.toLowerCase() === candidateName.toLowerCase()
      )) {
        counter++;
        candidateName = `${baseName}(${counter}).${extension}`;
      }
      
      return candidateName;
    };
    
    // Generiere eindeutigen Dateinamen
    const uniqueFileName = generateUniqueFileName(fileName, fileExtension);
    
    console.log('[TransformService] Eindeutiger Dateiname generiert:', {
      baseNameWithLanguage: fileName,
      uniqueFileName: uniqueFileName,
      existingFiles: currentItems.filter(item => item.type === 'file').map(item => item.metadata.name)
    });
    
    FileLogger.info('TransformService', 'Dateiname generiert', {
      baseName: fileName,
      uniqueFileName: uniqueFileName,
      existingFilesCount: currentItems.filter(item => item.type === 'file').length
    });
    
    // Markdown-Datei erstellen und speichern
    const fileBlob = new Blob([content], { type: "text/markdown" });
    const file = new File([fileBlob], uniqueFileName, { type: "text/markdown" });
    
    FileLogger.info('TransformService', 'Datei vorbereitet für Upload', {
      fileName: uniqueFileName,
      fileSize: file.size,
      fileType: file.type,
      contentLength: content.length
    });
    
    // In dasselbe Verzeichnis wie die Originaldatei hochladen
    FileLogger.info('TransformService', 'Starte Upload', {
      parentId: originalItem.parentId,
      fileName: uniqueFileName
    });
    
    const savedItem = await provider.uploadFile(originalItem.parentId, file);
    
    FileLogger.info('TransformService', 'Upload erfolgreich', {
      savedItemId: savedItem.id,
      savedItemName: savedItem.metadata.name,
      savedItemSize: savedItem.metadata.size
    });
    
    // Aktualisierte Dateiliste holen
    const updatedItems = await refreshItems(originalItem.parentId);
    
    FileLogger.info('TransformService', 'Dateiliste aktualisiert', {
      updatedItemsCount: updatedItems.length,
      newFileFound: updatedItems.some(item => item.id === savedItem.id)
    });
    
    return { savedItem, updatedItems };
  }

  /**
   * Speichert einen bereits transformierten Text direkt ohne erneute Transformation
   */
  static async saveTransformedText(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    return this.saveTransformationResult(
      text,
      originalItem,
      options,
      provider,
      refreshItems
    );
  }

  /**
   * Speichert das Transformationsergebnis als Datei
   */
  static async saveTransformationResult(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    // Als Shadow-Twin oder als normale Datei mit angegebenem Namen speichern
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        text,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      // Einfach das Transformationsergebnis zurückgeben ohne Datei zu speichern
      return {
        text,
        updatedItems: []
      };
    }
  }

  /**
   * Erstellt Markdown-Inhalt mit YAML-Frontmatter
   */
  static createMarkdownWithFrontmatter(content: string, metadata: TransformMetadata): string {
    // Wenn keine Metadaten vorhanden sind, gebe nur den Inhalt zurück
    if (!metadata || Object.keys(metadata).length === 0) {
      return content;
    }
    
    // Erstelle YAML-Frontmatter
    let frontmatter = '---\n';
    
    // Sortiere die Metadaten für bessere Lesbarkeit
    const sortedKeys = Object.keys(metadata).sort((a, b) => {
      // Gruppiere nach Kategorien
      const categoryOrder = ['source_', 'transformation_', 'audio_', 'process', 'secretary_', 'cache_'];
      const getCategoryIndex = (key: string) => {
        for (let i = 0; i < categoryOrder.length; i++) {
          if (key.startsWith(categoryOrder[i])) return i;
        }
        return categoryOrder.length;
      };
      
      const categoryA = getCategoryIndex(a);
      const categoryB = getCategoryIndex(b);
      
      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }
      return a.localeCompare(b);
    });
    
    // Füge Metadaten zum Frontmatter hinzu
    for (const key of sortedKeys) {
      const value = metadata[key];
      
      // Überspringe undefined-Werte
      if (value === undefined) {
        continue;
      }
      
      // Formatiere den Wert je nach Typ
      if (typeof value === 'string') {
        // Escape Anführungszeichen in Strings
        const escapedValue = value.replace(/"/g, '\\"');
        frontmatter += `${key}: "${escapedValue}"\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        frontmatter += `${key}: ${value}\n`;
      } else {
        // Für komplexe Objekte verwende JSON (sollte nicht vorkommen)
        frontmatter += `${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    frontmatter += '---\n\n';
    
    // Kombiniere Frontmatter mit Inhalt
    return frontmatter + content;
  }
} 
```

```typescript
import { 
  TemplateExtractionResponse 
} from './types';

export class SecretaryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretaryServiceError';
  }
}

/**
 * Typ für die Secretary Service Audio Response
 */
export interface SecretaryAudioResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      audio_source: string;
      source_info: {
        original_filename: string;
        file_size: number;
        file_type: string;
        file_ext: string;
      };
      source_language: string;
      target_language: string;
      template: string;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
    metadata?: {
      title: string;
      duration: number;
      format: string;
      channels: number;
      sample_rate: number;
      bit_rate: number;
      process_dir: string;
      chapters: unknown[];
    };
    process_id: string;
    transformation_result: unknown | null;
    status: string;
  };
}

/**
 * Typ für die Secretary Service Video Response
 */
export interface SecretaryVideoResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      source_language: string;
      target_language: string;
      template: string | null;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    metadata: {
      title: string;
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      duration: number;
      duration_formatted: string;
      file_size: number;
      process_dir: string;
      audio_file: string;
      video_id: string | null;
    };
    process_id: string;
    audio_result: unknown | null;
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
  };
}

/**
 * Typ für die Secretary Service PDF Response
 */
export interface SecretaryPdfResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;  // ← Geändert von text_content zu extracted_text
    ocr_text: string | null;
    metadata: {
      file_name: string;
      file_size: number;
      page_count: number;
      format: string;
      process_dir: string;
      image_paths: string[];
      preview_paths: string[];
      preview_zip: string | null;
      text_paths: string[];
      original_text_paths: string[];
      text_contents: Array<{
        page: number;
        content: string;
      }>;
      extraction_method: string;
    };
    process_id: string;
    processed_at: string;
    // Neu: Link statt großer Base64-Blobs
    images_archive_url?: string;
    // Alt (deprecated): verbleibt für Abwärtskompatibilität
    images_archive_data?: string; 
    images_archive_filename?: string; 
    // Neu: Rohdaten der Mistral-OCR-Ausgabe mit Seitenstruktur
    mistral_ocr_raw?: {
      pages: Array<{
        index: number;
        markdown: string;
        images: Array<{
          id: string;
          top_left_x: number;
          top_left_y: number;
          bottom_right_x: number;
          bottom_right_y: number;
          image_base64: string | null;
          image_annotation: string | null;
        }>;
        dimensions: {
          dpi: number;
          height: number;
          width: number;
        };
      }>;
    };
  };
}

/**
 * Transformiert eine Audio-Datei mithilfe des Secretary Services in Text
 * 
 * @param file Die zu transformierende Audio-Datei 
 * @param targetLanguage Die Zielsprache für die Transkription
 * @param libraryId ID der aktiven Bibliothek
 * @param useCache Cache verwenden (Standard: true)
 * @returns Die vollständige Response vom Secretary Service oder nur den Text (für Abwärtskompatibilität)
 */
export async function transformAudio(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  useCache: boolean = true
): Promise<SecretaryAudioResponse | string> {
  try {
    console.log('[secretary/client] transformAudio aufgerufen mit Sprache:', targetLanguage, 'und useCache:', useCache);
    
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('useCache', useCache.toString());
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-audio', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    // Die API Route sollte bereits die vollständige Response vom Secretary Service durchreichen
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Audio-Datei');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Name
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template-Name für die Transformation
 * @returns Den transformierten Text
 */
export async function transformText(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "Besprechung"
): Promise<string> {
  try {
    console.log('[secretary/client] transformText aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Text-Vorschau:', textContent?.substring(0, 100) || 'KEIN TEXT');
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('template', template);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      template: formData.get('template')
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Texttransformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Inhalt
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param templateContent Template-Inhalt für die Transformation
 * @returns Den transformierten Text
 */
export async function transformTextWithTemplate(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  templateContent: string
): Promise<string> {
  try {
    console.log('[secretary/client] transformTextWithTemplate aufgerufen mit Template-Content');
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Template-Content-Länge:', templateContent?.length || 0);
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    if (!templateContent || templateContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Template-Content vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('templateContent', templateContent);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      templateContent: formData.get('templateContent') ? 'vorhanden' : 'fehlt'
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API mit Template-Content');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Template-Content-Transformation erfolgreich');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Template-Content-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes mit Template-Content');
  }
}

/**
 * Erstellt eine Zusammenfassung für einen einzelnen Track
 * 
 * @param trackName Name des Tracks
 * @param targetLanguage Zielsprache für die Zusammenfassung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassung (Standard: "track_eco_social")
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit der Zusammenfassung
 */
export async function createTrackSummary(
  trackName: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createTrackSummary aufgerufen für Track:', trackName, 'und Bibliothek:', libraryId);
    console.log('[secretary/client] Template:', template, 'Sprache:', targetLanguage);
    
    if (!trackName) {
      throw new SecretaryServiceError('Kein Track-Name angegeben');
    }
    
    if (!libraryId) {
      console.warn('[secretary/client] WARNUNG: Keine Bibliotheks-ID angegeben!');
    }
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    const requestBody = {
      template,
      target_language: targetLanguage,
      useCache
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API:', JSON.stringify(requestBody));
    const response = await fetch(`/api/secretary/tracks/${encodeURIComponent(trackName)}/summary`, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify(requestBody)
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('[secretary/client] Antwort-Daten:', JSON.stringify(data).substring(0, 500) + '...');
    
    if (!response.ok) {
      // Detaillierte Fehlermeldung konstruieren
      let errorMsg = `Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`;
      if (data && data.error) {
        errorMsg += ` - ${data.error.code || ''}: ${data.error.message || 'Unbekannter Fehler'}`;
      }
      throw new SecretaryServiceError(errorMsg);
    }

    console.log('[secretary/client] Zusammenfassung erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung der Track-Zusammenfassung:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung der Track-Zusammenfassung');
  }
}

/**
 * Erstellt Zusammenfassungen für alle oder gefilterte Tracks
 * 
 * @param targetLanguage Zielsprache für die Zusammenfassungen
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassungen (Standard: "track_eco_social") 
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit allen Zusammenfassungen
 */
export async function createAllTrackSummaries(
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createAllTrackSummaries aufgerufen');
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API');
    const response = await fetch('/api/secretary/tracks/*/summarize_all', {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify({
        template,
        target_language: targetLanguage,
        useCache
      })
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Alle Zusammenfassungen erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung aller Track-Zusammenfassungen:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung aller Track-Zusammenfassungen');
  }
}

/**
 * Transformiert eine Video-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Video-Datei 
 * @param options Optionen für die Video-Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformVideo(
  file: File, 
  options: {
    extractAudio?: boolean;
    extractFrames?: boolean;
    frameInterval?: number;
    targetLanguage?: string;
    sourceLanguage?: string;
    template?: string;
  },
  libraryId: string
): Promise<SecretaryVideoResponse> {
  try {
    console.log('[secretary/client] transformVideo aufgerufen mit Optionen:', options);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Sprachoptionen
    if (options.targetLanguage) {
      formData.append('targetLanguage', options.targetLanguage);
    }
    
    if (options.sourceLanguage) {
      formData.append('sourceLanguage', options.sourceLanguage);
    }
    
    // Template-Option
    if (options.template) {
      formData.append('template', options.template);
    }
    
    // Video-spezifische Optionen
    if (options.extractAudio !== undefined) {
      formData.append('extractAudio', options.extractAudio.toString());
    }
    
    if (options.extractFrames !== undefined) {
      formData.append('extractFrames', options.extractFrames.toString());
    }
    
    if (options.frameInterval !== undefined) {
      formData.append('frameInterval', options.frameInterval.toString());
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-video', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Video-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryVideoResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Video-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Video-Datei');
  }
}

/**
 * Transformiert eine PDF-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende PDF-Datei 
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Optionales Template für die Verarbeitung
 * @param extractionMethod Die Extraktionsmethode (native, ocr, both, preview, preview_and_native, llm, llm_and_ocr)
 * @param useCache Ob Cache verwendet werden soll
 * @param includeImages Ob Bilder mit extrahiert werden sollen
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformPdf(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  template?: string,
  extractionMethod: string = 'native',
  useCache: boolean = true,
  includeImages: boolean = false,
  skipTemplate?: boolean,
  context?: { originalItemId?: string; parentId?: string; originalFileName?: string; policies?: import('@/lib/processing/phase-policy').PhasePolicies }
): Promise<SecretaryPdfResponse> {
  try {
    console.log('[secretary/client] transformPdf aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    // OneDrive Token-Sync: Wenn der Client Tokens im localStorage hat, stelle sicher,
    // dass der Server (DB) vor dem Jobstart aktuelle Tokens hat, damit Gates/Webhook funktionieren.
    await (async () => {
      try {
        const key = `onedrive_tokens_${libraryId}`;
        const json = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (!json) return;
        const tokens = JSON.parse(json) as { accessToken: string; refreshToken: string; expiry: number };
        const now = Date.now();
        const bufferMs = 120_000; // 2 Minuten Buffer
        let accessToken = tokens.accessToken;
        let refreshToken = tokens.refreshToken;
        let expiryMs = Number(tokens.expiry);

        // Falls abgelaufen oder kurz davor: Refresh über Serverroute
        if (!expiryMs || expiryMs - now <= bufferMs) {
          const resp = await fetch('/api/auth/onedrive/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ libraryId, refreshToken })
          });
          if (resp.ok) {
            const data = await resp.json();
            accessToken = data.accessToken;
            refreshToken = data.refreshToken || refreshToken;
            // Server liefert expiresIn in Sekunden
            expiryMs = now + (Number(data.expiresIn || 0) * 1000);
            // Update localStorage
            localStorage.setItem(key, JSON.stringify({ accessToken, refreshToken, expiry: expiryMs }));
          }
        }

        // Persistiere Tokens in DB (Server), damit Webhook/Server‑Gates Zugriff haben
        await fetch(`/api/libraries/${libraryId}/tokens`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken, tokenExpiry: Math.floor(expiryMs / 1000).toString() })
        });
      } catch {}
    })();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extractionMethod', extractionMethod);
    formData.append('useCache', useCache.toString());
    formData.append('includeImages', includeImages.toString());
    // Neue vereinfachte Flags
    if (typeof context?.doExtractPDF === 'boolean') formData.append('doExtractPDF', String(context.doExtractPDF));
    if (typeof context?.doExtractMetadata === 'boolean') formData.append('doExtractMetadata', String(context.doExtractMetadata));
    if (typeof context?.doIngestRAG === 'boolean') formData.append('doIngestRAG', String(context.doIngestRAG));
    if (typeof context?.forceRecreate === 'boolean') formData.append('forceRecreate', String(context.forceRecreate));
    
    // Template-Option
    if (template) {
      formData.append('template', template);
    }
    // Kontext-Informationen für zielgenaues Speichern
    if (context?.originalItemId) {
      formData.append('originalItemId', context.originalItemId);
    }
    if (context?.parentId) {
      formData.append('parentId', context.parentId);
    }
    if (context?.originalFileName) {
      formData.append('originalFileName', context.originalFileName);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-pdf', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] PDF-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryPdfResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der PDF-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der PDF-Datei');
  }
}

/**
 * Interface für Image-OCR-Response
 */
export interface SecretaryImageResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;
    metadata: {
      file_name: string;
      file_size: number;
      dimensions: string;
      format: string;
      color_mode: string;
      dpi: number[];
      process_dir: string;
      extraction_method: string;
      preview_paths: string[];
    };
    process_id: string;
    processed_at: string;
    status: string;
  };
}

/**
 * Interface für Session-Import-Response
 */
export interface SessionImportResponse {
  status: string;
  data: {
    session: string;
    filename: string;
    track: string;
    video_url: string;
    attachments_url?: string;
    event: string;
    url: string;
    day: string;
    starttime: string;
    endtime: string;
    speakers: string[];
    source_language: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Transformiert ein Bild mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Bilddatei
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param extractionMethod Die Extraktionsmethode (ocr, llm, llm_and_ocr, native, both, preview, preview_and_native)
 * @param context Optionaler JSON-Kontext für LLM-Optimierung
 * @param useCache Ob Cache verwendet werden soll
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformImage(
  file: File,
  targetLanguage: string,
  libraryId: string,
  extractionMethod: string = 'ocr',
  context?: string,
  useCache: boolean = true
): Promise<SecretaryImageResponse> {
  try {
    console.log('[secretary/client] transformImage aufgerufen mit Sprache:', targetLanguage, 'und Methode:', extractionMethod);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extraction_method', extractionMethod);
    formData.append('useCache', useCache.toString());
    
    // Context-Option
    if (context) {
      formData.append('context', context);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-image', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Bild-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryImageResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Bild-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Bilddatei');
  }
}

/**
 * Importiert Session-Daten aus einer Website-URL mithilfe des Secretary Services
 * 
 * @param url Die zu analysierende Website-URL
 * @param options Optionen für die Session-Extraktion
 * @returns Die extrahierten Session-Daten
 */
export async function importSessionFromUrl(
  url: string,
  options: {
    sourceLanguage?: string;
    targetLanguage?: string;
    template?: string;
    useCache?: boolean;
  } = {}
): Promise<TemplateExtractionResponse> {
  try {
    console.log('[secretary/client] importSessionFromUrl aufgerufen mit URL:', url);
    
    const response = await fetch('/api/secretary/import-from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        source_language: options.sourceLanguage || 'en',
        target_language: options.targetLanguage || 'en',
        template: options.template || 'ExtractSessionDataFromWebsite',
        use_cache: options.useCache ?? false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new SecretaryServiceError(
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: TemplateExtractionResponse = await response.json();
    console.log('[secretary/client] Session-Import erfolgreich:', data);
    
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler beim Session-Import:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError(
      error instanceof Error ? error.message : 'Unbekannter Fehler beim Session-Import'
    );
  }
} 
```

```typescriptreact
"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [forceRecreate, setForceRecreate] = React.useState<boolean>(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  function canRun(): boolean {
    return Boolean(provider && activeLibraryId && item && item.type === 'file');
  }

  function buildOptions(targetPhase: PdfPhase): PdfTransformOptions | null {
    if (!provider || !activeLibraryId || !item || item.type !== 'file') return null;
    const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
    const base: PdfTransformOptions = {
      targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
      fileName: TransformService.generateShadowTwinName(item.metadata.name, typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de'),
      createShadowTwin: true,
      fileExtension: 'md',
      extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
      useCache: defaults.useCache ?? true,
      includeImages: defaults.includeImages ?? false,
      template: typeof defaults.template === 'string' ? defaults.template : undefined,
    };
    return {
      ...base,
      // Policies (UI: Phase n → 'do')
      policies: {
        extract: targetPhase >= 1 ? (forceRecreate ? 'force' : 'do') : 'ignore',
        metadata: targetPhase >= 2 ? 'do' : 'ignore',
        ingest: targetPhase >= 3 ? 'do' : 'ignore',
      },
      // Keine Legacy-Flags mehr
      forceRecreate: undefined as unknown as never,
    } as any;
  }

  async function runPhase(targetPhase: PdfPhase = phase) {
    try {
      if (!canRun()) {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider!.getBinary(item!.id);
      const file = new File([bin.blob], item!.metadata.name, { type: item!.metadata.mimeType });
      const options = buildOptions(targetPhase);
      if (!options) {
        toast.error('Fehler', { description: 'Optionen konnten nicht erstellt werden' });
        return;
      }
      // Keine Persistenz hier; Overrides bleiben bis zum Reload
      await TransformService.transformPdf(file, item!, options, provider!, refreshItems, activeLibraryId!);
      toast.success('Gestartet', { description: `Bis Phase ${targetPhase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badgeColor(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted-foreground/40';
  }

  function buttonStyle(isActive: boolean, _status?: "completed" | "in_progress" | "failed" | "pending") {
    return cn(
      "px-2 py-1 text-xs rounded border",
      isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
    );
  }

  function renderButton(id: PdfPhase, label: string, status?: "completed" | "in_progress" | "failed" | "pending") {
    const isActive = phase === id;
    return (
      <div key={id} className="flex items-center gap-1">
        <button
          type="button"
          className={buttonStyle(isActive, status)}
          onClick={() => setPhase(id)}
          aria-pressed={isActive}
          aria-label={`Phase ${id}: ${label}`}
          title={`${label} auswählen`}
        >
          <span className="mr-2 hidden sm:inline">{label}</span>
          <span className="inline-flex items-center justify-center h-2.5 w-2.5 rounded-full ml-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor(status)}`} />
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted text-muted-foreground"
          onClick={() => void runPhase(id)}
          title={`Bis ${label} ausführen`}
          aria-label={`Bis ${label} ausführen`}
          disabled={!canRun()}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={forceRecreate}
            onChange={(e) => setForceRecreate(e.target.checked)}
          />
          Erzwingen
        </label>
        <Button size="sm" variant="secondary" onClick={() => void runPhase()} disabled={!canRun()} title="Ausgewählte Phase starten">
          <Play className="h-3.5 w-3.5 mr-1" /> Starten
        </Button>
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}
    </div>
  );
}



```

```typescriptreact
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileLogger } from '@/lib/debug/logger';
import { toast } from '@/components/ui/use-toast';
import { loadPdfDefaults } from '@/lib/pdf-defaults';
import { pdfOverridesAtom, getEffectivePdfDefaults } from '@/atoms/pdf-defaults';
import { PdfPhaseSettings } from '@/components/library/pdf-phase-settings';
import { Settings } from 'lucide-react';

interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  totalPdfs: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(false); // Phase 2
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(false); // Phase 3
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);

  // Shadow-Twin Erkennung (z. B. name.de.md)
  const shadowTwinRegex = useMemo(() => /^(.+)\.(de|en|fr|es|it)\.md$/i, []);

  const getBaseName = useCallback((name: string): string => {
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? name : name.substring(0, lastDot);
  }, []);

  const hasTwinInFolder = useCallback(
    (siblings: StorageItem[], pdfBase: string, lang?: string): boolean => {
      if (lang) {
        const expected = `${pdfBase}.${lang}.md`;
        return siblings.some((i) => i.type === 'file' && i.metadata.name.toLowerCase() === expected.toLowerCase());
      }
      // Fallback: irgendein Twin in beliebiger Sprache
      return siblings.some((i) => i.type === 'file' && shadowTwinRegex.test(i.metadata.name));
    },
    [shadowTwinRegex]
  );

  // rekursiver Scan
  const scanFolder = useCallback(async (folderId: string) => {
    if (!provider) return { total: 0, skipped: 0, selected: [] as Array<{ file: StorageItem; parentId: string }>, previews: [] as string[] };

    const stack: string[] = [folderId];
    let total = 0;
    let skipped = 0;
    const selected: Array<{ file: StorageItem; parentId: string }> = [];
    const previews: string[] = [];

    while (stack.length) {
      const current = stack.pop() as string;
      let items: StorageItem[] = [];
      try {
        items = await provider.listItemsById(current);
      } catch (error) {
        FileLogger.error('PdfBulkImportDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      const folders = items.filter((i) => i.type === 'folder');
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        const name = file.metadata.name.toLowerCase();
        const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
        if (!isPdf) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || 'de';
        // Batch-Scan soll auch bei Phase 1+2 ohne vorhandenen Twin zulassen → kein Twin-Zwang hier
        const requireTwin = false;
        if (requireTwin && !hasTwinInFolder(items, base, lang)) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, hasTwinInFolder, runMetaPhase, runIngestionPhase]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      // Vorschau-Details (max. 10) berechnen: relativer Pfad + Dateiname
      const top = result.selected.slice(0, 10);
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      for (const { file, parentId } of top) {
        let relPath = '.';
        try {
          const chain = await provider.getPathItemsById(parentId);
          const idx = chain.findIndex((it) => it.id === rootFolderId);
          const start = idx >= 0 ? idx + 1 : 1; // nach aktuellem Root bzw. nach globalem Root
          const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
          relPath = parts.length ? parts.join('/') : '.';
        } catch {
          relPath = '.';
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Bei Öffnen initial Scannen
      void handleScan();
      // Batch-Name vorbelegen: relativer Pfad des aktuellen Ordners (ohne führenden '/')
      (async () => {
        try {
          if (!provider || !rootFolderId) return;
          // Inklusive aktuellem Ordnernamen
          const chain = await provider.getPathItemsById(rootFolderId);
          const parts = chain
            .filter((it) => it.id !== 'root')
            .map((it) => (it as { metadata?: { name?: string } }).metadata?.name)
            .filter((n): n is string => typeof n === 'string' && !!n);
          const rel = parts.join('/') || 'root';
          setBatchName((prev) => prev && prev.trim().length > 0 ? prev : rel);
        } catch {
          // ignorieren
        }
      })();
    }
  }, [open, handleScan]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        options: {
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
          extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
          includeImages: defaults.includeImages ?? false,
          useCache: defaults.useCache ?? true,
          template: typeof defaults.template === 'string' ? defaults.template : undefined,
          // Neue Policies (explizit)
          // Phase 1 ist immer 'do' im Batch; force via Checkbox
          // Phase 2 abhängig von runMetaPhase und forceMeta, Phase 3 abhängig von runIngestionPhase
          policies: {
            extract: !!forceExtract ? 'force' : 'do',
            metadata: !!runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: !!runIngestionPhase ? 'do' : 'ignore',
          },
        },
        items: candidates.map(({ file, parentId }) => ({ fileId: file.id, parentId, name: file.metadata.name, mimeType: file.metadata.mimeType })),
      };
      const requestPromise = fetch('/api/secretary/process-pdf/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Dialog sofort schließen; Server arbeitet im Hintergrund
      onOpenChange(false);
      const res = await requestPromise;
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        toast({ title: 'Batch fehlgeschlagen', description: msg, variant: 'destructive' });
      } else {
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const okCount = Number((json as { okCount?: number }).okCount || 0);
        const failCount = Number((json as { failCount?: number }).failCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates, runMetaPhase, runIngestionPhase, onOpenChange, pdfOverrides, provider]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>PDF-Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="PDF-Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verwendet die PDF-Standardwerte der aktiven Library. Parameter können über das Zahnrad angepasst werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hinweisblock entfernt: Idempotenz/Gates übernehmen das Überspringen automatisch */}

          <div className="rounded-md border p-3">
            <div className="text-sm font-medium mb-2">Phasen</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Checkbox id="phase-1" checked disabled />
                <Label htmlFor="phase-1">Phase 1: Extraktion (Methode: 
                  <span>
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.extractionMethod;
                    })()})
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-extract" checked={forceExtract} onCheckedChange={(v) => setForceExtract(Boolean(v))} />
                  <Label htmlFor="force-extract">Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template: 
                  <span>                    
                    {(() => {
                      const eff = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
                      return eff.template;
                    })()}
                  )
                  </span>
                </Label>
                <div className="ml-auto flex items-center gap-2">
                  <Checkbox id="force-meta" checked={forceMeta} onCheckedChange={(v) => setForceMeta(Boolean(v))} disabled={!runMetaPhase} />
                  <Label htmlFor="force-meta" className={runMetaPhase ? '' : 'text-muted-foreground'}>Erzwingen</Label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt PDFs:</span> <span className="font-medium">{stats.totalPdfs}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Zu verarbeiten:</span> <span className="font-medium">{stats.toProcess}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            <ScrollArea className="h-40">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-2">
                  {previewItems.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-muted-foreground truncate">{it.relPath}</div>
                        <div className="font-medium break-all">{it.name}</div>
                      </div>
                      <div className="shrink-0 text-muted-foreground whitespace-nowrap">Seiten: —</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || candidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${candidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { legacyToPolicies } from '@/lib/processing/phase-policy';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    policies?: import('@/lib/processing/phase-policy').PhasePolicies;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Eindeutige Batch-ID generieren
    const batchId = crypto.randomUUID();

    // Phase 1: Alle Jobs minimal in DB anlegen (ohne PDFs zu laden)
    const repo = new ExternalJobsRepository();
    const createdJobIds: string[] = [];
    for (const it of items) {
      try {
        const jobId = crypto.randomUUID();
        const jobSecret = crypto.randomBytes(24).toString('base64url');
        const jobSecretHash = repo.hashSecret(jobSecret);
        await repo.create({
          jobId,
          jobSecretHash,
          job_type: 'pdf',
          operation: 'extract',
          worker: 'secretary',
          status: 'queued',
          libraryId,
          userEmail,
          correlation: {
            jobId,
            libraryId,
            source: { mediaType: 'pdf', mimeType: it.mimeType || 'application/pdf', name: it.name || 'document.pdf', itemId: it.fileId, parentId: it.parentId },
            options: {
              targetLanguage: options?.targetLanguage || 'de',
              extractionMethod: options?.extractionMethod || 'native',
              includeImages: options?.includeImages ?? false,
              useCache: options?.useCache ?? true,
            },
            batchId,
            batchName,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          steps: [
            { name: 'extract_pdf', status: 'pending' },
            { name: 'transform_template', status: 'pending' },
            { name: 'store_shadow_twin', status: 'pending' },
            { name: 'ingest_rag', status: 'pending' },
          ],
          parameters: {
            targetLanguage: options?.targetLanguage || 'de',
            extractionMethod: options?.extractionMethod || 'native',
            includeImages: options?.includeImages ?? false,
            useCache: options?.useCache ?? true,
            template: options?.template,
            // Nur neue Policies
            policies: options?.policies || legacyToPolicies({ doExtractPDF: true }),
            batchId,
            batchName,
          }
        } as any);
        createdJobIds.push(jobId);
      } catch (e) {
        FileLogger.error('process-pdf-batch', 'Job-Anlage fehlgeschlagen', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Phase 2: Verarbeitung asynchron starten (Concurrency 5) via Retry‑Route
    const concurrency = 5;
    (async () => {
      let idx = 0;
      const runner = async () => {
        while (true) {
          const i = idx++;
          if (i >= createdJobIds.length) break;
          const jobId = createdJobIds[i];
          try {
            const res = await fetch(new URL(`/api/external/jobs/${jobId}/retry`, request.url).toString(), {
              method: 'POST',
              headers: { 'Cookie': request.headers.get('cookie') || '' }
            });
            if (!res.ok) {
              const msg = await res.text().catch(() => res.statusText);
              FileLogger.error('process-pdf-batch', 'Retry-Start fehlgeschlagen', { jobId, msg });
            }
          } catch (err) {
            FileLogger.error('process-pdf-batch', 'Retry-Start Exception', { jobId, err: err instanceof Error ? err.message : String(err) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, createdJobIds.length) }, () => runner()));
      FileLogger.info('process-pdf-batch', 'Asynchroner Start abgeschlossen', { count: createdJobIds.length, batchId, batchName });
    })().catch(() => {});

    // Sofortige Antwort: Anzahl angelegter Jobs
    return NextResponse.json({ ok: true, batchId, batchName, created: createdJobIds.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { env } from 'process';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { ExternalJob } from '@/types/external-job';
import { LibraryService } from '@/lib/services/library-service';
// Storage: konsequent Server-Provider verwenden
import { getServerProvider } from '@/lib/storage/server-provider';
import { gateExtractPdf } from '@/lib/processing/gates';
import { legacyToPolicies, PhasePolicies, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { TransformService } from '@/lib/transform/transform-service';

export async function POST(request: NextRequest) {
  try {
    FileLogger.info('process-pdf', 'Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-pdf] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    FileLogger.debug('process-pdf', 'Authentifizierung erfolgreich', { userId });

    // Alle Request-Header protokollieren
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // FormData aus dem Request holen
    const formData = await request.formData();
    const formDataKeys: string[] = [];
    formData.forEach((value, key) => {
      formDataKeys.push(key);
    });
    FileLogger.debug('process-pdf', 'FormData empfangen', { keys: formDataKeys });
    

    // Secretary Service URL aus Umgebungsvariablen holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // Sicherstellen, dass keine doppelten Slashes entstehen
    const normalizedUrl = secretaryServiceUrl?.endsWith('/') 
      ? `${secretaryServiceUrl}pdf/process` 
      : `${secretaryServiceUrl}/pdf/process`;
    
    FileLogger.info('process-pdf', 'Forward an Secretary Service', { url: normalizedUrl });
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
      
      // Protokolliere ungefähre Dateigröße für Debugging
      const file = formData.get('file') as File;
      console.log('[process-pdf] Ungefähre Dateigröße:', file.size, 'Bytes');
    }
    
    // Zielsprache (target_language)
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    } else {
      serviceFormData.append('target_language', 'de'); // Standardwert
    }
    
    // Template-Option NICHT an Secretary senden – wir transformieren serverseitig im Callback
    // (Der Secretary erwartet ggf. einen Pfad und würde sonst '...md.md' anhängen.)
    // Veraltetes Feld skipTemplate wird nicht mehr verwendet
    const skipTemplate = false;
    
    // Extraktionsmethode – Clientwert oder Library-Default
    let effectiveExtraction: string | null = null;
    if (formData.has('extractionMethod')) effectiveExtraction = String(formData.get('extractionMethod'));
    if (!effectiveExtraction) {
      try {
        const libHeader = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
        const usr = await currentUser();
        const email = usr?.emailAddresses?.[0]?.emailAddress || '';
        if (libHeader && email) {
          const svc = LibraryService.getInstance();
          const libs = await svc.getUserLibraries(email);
          const lib = libs.find(l => l.id === libHeader);
          effectiveExtraction = lib?.config?.secretaryService?.pdfDefaults?.extractionMethod || null;
        }
      } catch {}
    }
    serviceFormData.append('extraction_method', effectiveExtraction || 'native');
    
    // Cache-Optionen
    if (formData.has('useCache')) {
      serviceFormData.append('useCache', formData.get('useCache') as string);
    } else {
      serviceFormData.append('useCache', 'true'); // Standardwert: Cache verwenden
    }
    
    // Include Images Option
    if (formData.has('includeImages')) {
      serviceFormData.append('includeImages', formData.get('includeImages') as string);
    } else {
      serviceFormData.append('includeImages', 'false'); // Standardwert: Keine Bilder
    }
    
    // Force refresh Option
    if (formData.has('force_refresh')) {
      serviceFormData.append('force_refresh', formData.get('force_refresh') as string);
    } else {
      serviceFormData.append('force_refresh', 'false'); // Standardwert
    }

    // Policies optional aus Client übernehmen
    const policiesFromClient: PhasePolicies | undefined = (() => {
      try {
        const raw = formData.get('policies') as string | null;
        return raw ? JSON.parse(raw) as PhasePolicies : undefined;
      } catch {
        return undefined;
      }
    })();
    const policies = policiesFromClient || legacyToPolicies({ doExtractPDF: true });

    // Job anlegen (per-Job-Secret)
    const repository = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repository.hashSecret(jobSecret);

    // Correlation aus Request ableiten
    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    // Korrelation: nutze die bereits ermittelte effektive Methode oben, falls vorhanden
    const extractionMethod = (formData.get('extractionMethod') as string) || (serviceFormData.get('extraction_method') as string) || 'native';
    const includeImages = (formData.get('includeImages') as string) ?? 'false';
    const useCache = (formData.get('useCache') as string) ?? 'true';
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    const file = formData.get('file') as File | null;

    // Optional vom Client mitgeliefert (für zielgenaues Speichern)
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    const correlation = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || 'application/pdf',
        name: file?.name,
        itemId: originalItemId,
        parentId: parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeImages: includeImages === 'true',
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    } satisfies ExternalJob['correlation'];

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await repository.create(job);
    // Schritte initialisieren und Parameter mitschreiben (für Report-Tab)
    const phases = { extract: policies.extract !== 'ignore', template: policies.metadata !== 'ignore', ingest: policies.ingest !== 'ignore' };
    await repository.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeImages: includeImages === 'true',
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      // Neue vereinfachte Flags
      policies
    });
    FileLogger.info('process-pdf', 'Job angelegt', {
      jobId,
      libraryId,
      userEmail,
      extractionMethod,
      includeImages,
      useCache,
      targetLanguage
    });

    // Sofortiges Live-Event: queued (für UI, damit Eintrag direkt erscheint)
    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}
    // Watchdog starten (600s ohne Progress => Timeout)
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: correlation.source?.name }, 600_000);

    // Callback-Informationen (generisch) anfügen
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
      serviceFormData.append('callback_url', callbackUrl);
      
      // Detailliertes Logging der Callback-Parameter
      FileLogger.info('process-pdf', 'Callback-Parameter vorbereitet', {
        jobId,
        callbackUrl,
        hasAppUrl: !!appUrl,
        appUrl: appUrl
      });
    } else {
      FileLogger.warn('process-pdf', 'NEXT_PUBLIC_APP_URL nicht gesetzt', { jobId });
    }
    
    // per-Job-Secret mitgeben
    serviceFormData.append('callback_token', jobSecret);
    // jobId nicht zusätzlich mitsenden – steht in der Callback-URL
    FileLogger.info('process-pdf', 'Job-Secret generiert', {
      jobId,
      hasSecret: !!jobSecret,
      secretLength: jobSecret.length
    });
    
    // Korrelation NICHT an Secretary senden – Secretary erhält nur jobId + Callback
    FileLogger.info('process-pdf', 'Korrelation nicht an Secretary gesendet (nur jobId & Callback)', {
      jobId,
      correlationSummary: {
        hasSource: !!correlation.source,
        hasOptions: !!correlation.options
      }
    });

    // HTTP-Request als JSON loggen (kopierbar für Tests)
    const httpRequest = {
      method: 'POST',
      url: normalizedUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      },
      body: {
        file: '[BINARY: PDF-Datei]',
        target_language: targetLanguage,
        extraction_method: extractionMethod,
        useCache: useCache,
        includeImages: includeImages,
        force_refresh: (formData.get('force_refresh') as string) ?? 'false',
        callback_url: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}`,
        callback_token: jobSecret,
      }
    };
    
    FileLogger.info('process-pdf', 'HTTP-Request an Secretary Service', { jobId, request: httpRequest });
    // Persistenter Logeintrag in DB
    await repository.appendLog(jobId, { phase: 'request_sent', sourcePath: correlation.source?.itemId, targetParentId: correlation.source?.parentId, callbackUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : undefined });

    // Idempotenz ist immer aktiv
    const autoSkipExisting: boolean = true;

    // Extract-Gate vor dem Secretary-Call: vorhanden? → je nach Flags entscheiden
    try {
      if (autoSkipExisting) {
        const libraryService = LibraryService.getInstance();
        const libraries = await libraryService.getUserLibraries(userEmail);
        const lib = libraries.find(l => l.id === libraryId);
        const g = await gateExtractPdf({
          repo: repository,
          jobId,
          userEmail,
          library: lib,
          source: { itemId: originalItemId, parentId, name: file?.name },
          options: { targetLanguage }
        });
        const runExtract = shouldRunWithGate(g.exists, policies.extract);
        if (!runExtract) {
          // Phase 1 überspringen
          await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });

          // Template-Only Pfad, wenn nicht explizit skipTemplate=true
          if (!skipTemplate && doExtractMetadata) {
            try {
              const libraryService = LibraryService.getInstance();
              const libraries2 = await libraryService.getUserLibraries(userEmail);
              const lib2 = libraries2.find(l => l.id === libraryId);
              if (lib2) {
                const provider = await getServerProvider(userEmail, libraryId);
                await repository.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });

                // Template-Datei finden (wie im Callback)
                const rootItems = await provider.listItemsById('root');
                const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
                const ensureTemplatesFolderId = async (): Promise<string> => {
                  if (templatesFolder) return templatesFolder.id;
                  const created = await provider.createFolder('root', 'templates');
                  return created.id;
                };
                const templatesFolderId = await ensureTemplatesFolderId();
                let chosen: { id: string } | undefined;
                if (templatesFolderId) {
                  const tplItems = await provider.listItemsById(templatesFolderId);
                  const preferredTemplate = ((lib2.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || (formData.get('template') as string | null) || '').trim();
                  const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
                  chosen = preferredTemplate
                    ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                    : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
                }

                let templateContent = '# {{title}}\n';
                if (chosen) {
                  const bin = await provider.getBinary(chosen.id);
                  templateContent = await bin.blob.text();
                }

                // Shadow‑Twin laden (im Parent by Name)
                const siblings = await provider.listItemsById(parentId || 'root');
                const expectedName = (g.details && typeof g.details === 'object' ? (g.details as { matched?: string }).matched : undefined) || (() => {
                  const base = (file?.name || 'output').replace(/\.[^/.]+$/, '');
                  return `${base}.${targetLanguage}.md`;
                })();
                const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName);
                if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
                const twinBin = await provider.getBinary(twin.id);
                const originalMarkdown = await twinBin.blob.text();
                const stripped = originalMarkdown.replace(/^---[\s\S]*?---\s*/m, '');

                // Transformer aufrufen
                const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
                const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
                const fd = new FormData();
                fd.append('text', stripped);
                fd.append('target_language', targetLanguage);
                fd.append('template_content', templateContent);
                fd.append('use_cache', 'false');
                // Kontext für LLM-Auswertung (Dateiname/Pfad/IDs)
                try {
                  const parentPath = await provider.getPathById(parentId || 'root'); // z.B. /Berichte Landesämter/Bevölk.Schutz
                  const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                  const rawName = (expectedName || file?.name || 'document.md');
                  const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                  const baseName = withoutExt.replace(new RegExp(`\\.${targetLanguage}$`, 'i'), '');
                  const ctx = {
                    filename: baseName,
                    filepath: dirPath,
                    libraryId,
                    jobId,
                    sourceItemId: originalItemId,
                    parentId
                  } as const;
                  fd.append('context', JSON.stringify(ctx));
                } catch {}
                const headers: Record<string, string> = { 'Accept': 'application/json' };
                const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
                if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
                const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
                const data: unknown = await resp.json().catch(() => ({}));
                const mdMeta = (data && typeof data === 'object' && !Array.isArray(data)) ? ((data as { data?: { structured_data?: Record<string, unknown> } }).data?.structured_data || {}) : {};

                await repository.appendMeta(jobId, mdMeta as Record<string, unknown>, 'template_transform');
                await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });

                // Markdown mit neuem Frontmatter überschreiben (SSOT: flaches Schema ergänzen)
                const ssotFlat: Record<string, unknown> = {
                  job_id: jobId,
                  source_file: correlation?.source?.name || (file?.name || 'document.pdf'),
                  // In diesem Template-only Pfad sind extract/template abgeschlossen (Text lag bereits vor)
                  extract_status: 'completed',
                  template_status: 'completed',
                  ingest_status: 'none',
                  summary_language: targetLanguage,
                };
                const mergedMeta = { ...(mdMeta as Record<string, unknown>), ...ssotFlat } as Record<string, unknown>;
                const newMarkdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
                  ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(stripped, mergedMeta)
                  : originalMarkdown;
                const outFile = new File([new Blob([newMarkdown], { type: 'text/markdown' })], expectedName || (file?.name || 'output.md'), { type: 'text/markdown' });
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
                await provider.uploadFile(parentId || 'root', outFile);
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

                // Ingestion je nach Flag nur markieren (kein Upsert hier)
                if (doIngestRAG) {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
                } else {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
                }

                clearWatchdog(jobId);
                await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (template-only)' });
                await repository.setStatus(jobId, 'completed');
                try {
                  getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (template-only)', jobType: 'pdf', fileName: correlation.source?.name, sourceItemId: originalItemId });
                } catch {}
                return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-template-only', main_processor: 'template', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
              }
            } catch {
              // Fallback: wenn Template-Only fehlschlägt, markieren wir die Schritte als skipped und schließen
              await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              if (doIngestRAG) {
                await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              } else {
                await repository.updateStep(jobId, ' ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
              }
              clearWatchdog(jobId);
              await repository.setStatus(jobId, 'completed');
              return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
            }
          } else {
            // Kein Template‑Only gewünscht → alle übrigen Schritte überspringen
            await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            if (doIngestRAG) {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            } else {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
            }
            clearWatchdog(jobId);
            await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract skipped: artifact_exists)' });
            await repository.setStatus(jobId, 'completed');
            try {
              getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (skipped extract)', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId });
            } catch {}
            return NextResponse.json({
              status: 'accepted',
              worker: 'secretary',
              process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true },
              job: { id: jobId },
              webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` },
              error: null
            });
          }
        }
      }
    } catch {}

    // Anfrage an den Secretary Service senden (nur wenn doExtractPDF true oder keine Flags gesetzt)
    if (!doExtractPDF && (doExtractMetadata || doIngestRAG)) {
      // Kein Worker-Call notwendig, die Arbeit passiert lokal (Template‑Only) oder es ist nur Ingestion geplant (aktueller Pfad löst Ingestion erst im Callback aus, daher schließen wir hier ab)
      // Falls nur Ingestion geplant ist, führt der Callback es später aus; hier markieren wir extract als skipped
      await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'not_requested' } });
      return NextResponse.json({ status: 'accepted', job: { id: jobId } })
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutMs = Number(process.env.SECRETARY_REQUEST_TIMEOUT_MS || '5000');
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      // Secretary nicht erreichbar → Job synchron auf failed setzen
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repository.appendLog(jobId, { phase: 'request_error', message });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: 'worker_unavailable', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json({ error: 'Secretary Service nicht erreichbar' }, { status: 503 });
    }

    // HTTP-Response als JSON loggen
    const httpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: '[RESPONSE_BODY]' // Wird nach dem Parsen geloggt
    };
    
    FileLogger.info('process-pdf', 'Secretary HTTP-Response', { jobId, response: httpResponse });
    await repository.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });

    const data = await response.json();
    FileLogger.info('process-pdf', 'Secretary Response Body', {
      jobId,
      responseBody: data
    });

    if (!response.ok) {
      FileLogger.error('process-pdf', 'Secretary Fehler', data);
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repository.appendLog(jobId, { phase: 'request_error', status: response.status, statusText: response.statusText });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: `worker_error ${response.status}`, jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json(
        { error: data?.error || 'Fehler beim Transformieren der PDF-Datei' },
        { status: response.status }
      );
    }

    // Rückgabe beibehaltend (kompatibel) und JobId hinzufügen
    FileLogger.info('process-pdf', 'Request akzeptiert, gebe Job zurück', { jobId });
    return NextResponse.json({ ...data, job: { id: jobId } });
  } catch (error) {
    FileLogger.error('process-pdf', 'Unerwarteter Fehler', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
// import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { IngestionService } from '@/lib/chat/ingestion-service';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateTransformTemplate, gateIngestRag } from '@/lib/processing/gates';
import { getPolicies, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { getServerProvider } from '@/lib/storage/server-provider';
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser';

// OneDrive-Utilities entfernt: Provider übernimmt Token/Uploads.

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

// OneDrive-spezifische Upload-/Token-Utilities wurden entfernt; StorageFactory-Provider übernimmt das Speichern.

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
    const internalBypass = (() => {
      const t = request.headers.get('x-internal-token') || request.headers.get('X-Internal-Token');
      const envToken = process.env.INTERNAL_TEST_TOKEN || '';
      return !!t && !!envToken && t === envToken;
    })();
    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (!callbackToken && !internalBypass) {
      bufferLog(jobId, { phase: 'failed', message: 'callback_token fehlt' });
      await repo.appendLog(jobId, { phase: 'failed', message: 'callback_token fehlt' } as unknown as Record<string, unknown>);
      await repo.setStatus(jobId, 'failed', { error: { code: 'callback_token_missing', message: 'callback_token fehlt' } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'callback_token fehlt', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });
    }

    if (!internalBypass) {
      const tokenHash = repo.hashSecret(callbackToken as string);
      if (tokenHash !== job.jobSecretHash) {
        bufferLog(jobId, { phase: 'failed', message: 'Unauthorized callback' });
        await repo.appendLog(jobId, { phase: 'failed', message: 'Unauthorized callback' } as unknown as Record<string, unknown>);
        await repo.setStatus(jobId, 'failed', { error: { code: 'unauthorized', message: 'Ungültiges callback_token' } });
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Unauthorized callback', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

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
        sourceItemId: job.correlation?.source?.itemId,
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
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
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
    let docMetaForIngestion: Record<string, unknown> | undefined;

    if (lib && extractedText) {
      const policies = getPolicies({ parameters: job.parameters || {} });
      const doExtractMetadata = policies.metadata !== 'ignore';
      const autoSkip = true;

      if (lib) {
        // Einheitliche Serverinitialisierung des Providers (DB-Config, Token enthalten)
        let provider;
        try {
          provider = await getServerProvider(job.userEmail, job.libraryId);
        } catch (e) {
          const reason = e instanceof Error ? e.message : 'Provider-Initialisierung fehlgeschlagen';
          bufferLog(jobId, { phase: 'provider_init_failed', message: reason });
          await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: reason } });
          await repo.setStatus(jobId, 'failed', { error: { code: 'CONFIG_ERROR', message: reason } });
          getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: reason, jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
          return NextResponse.json({ status: 'error', jobId, kind: 'provider_init_failed', message: reason }, { status: 400 });
        }

        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';

        // Optionale Template-Verarbeitung (Phase 2)
        let metadataFromTemplate: Record<string, unknown> | null = null;
        let templateStatus: 'completed' | 'failed' | 'skipped' = 'completed';
        // Gate für Transform-Template (Phase 2)
        let templateGateExists = false;
        if (autoSkip) {
          const g = await gateTransformTemplate({ repo, jobId, userEmail: job.userEmail, library: lib, source: job.correlation?.source, options: job.correlation?.options as { targetLanguage?: string } | undefined });
          templateGateExists = g.exists;
          if (g.exists) {
            await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });
            templateStatus = 'skipped';
          }
        }
        const shouldRunTemplate = shouldRunWithGate(templateGateExists, policies.metadata);
        if (!shouldRunTemplate) {
          bufferLog(jobId, { phase: 'transform_meta_skipped', message: 'Template-Transformation übersprungen (Phase 1)' });
        } else {
          await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });
          try {
            // Templates-Ordner vorbereiten
            const rootItems = await provider.listItemsById('root');
            const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
            const ensureTemplatesFolderId = async (): Promise<string> => {
              if (templatesFolder) return templatesFolder.id;
              const created = await provider.createFolder('root', 'templates');
              bufferLog(jobId, { phase: 'templates_folder_created', message: 'Ordner /templates angelegt' });
              return created.id;
            };
            const templatesFolderId = await ensureTemplatesFolderId();

            // Template-Datei wählen bzw. anlegen
            let chosen: { id: string } | undefined;
            if (templatesFolderId) {
              const tplItems = await provider.listItemsById(templatesFolderId);
              const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
              const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
              chosen = preferredTemplate
                ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
              if (!chosen) {
                const defaultTemplateContent = '# {{title}}\n';
                const tplFile = new File([new Blob([defaultTemplateContent], { type: 'text/markdown' })], 'pdfanalyse.md', { type: 'text/markdown' });
                await provider.uploadFile(templatesFolderId, tplFile);
                bufferLog(jobId, { phase: 'template_created', message: 'Default-Template pdfanalyse.md angelegt' });
                const re = await provider.listItemsById(templatesFolderId);
                chosen = re.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'pdfanalyse.md') as unknown as { id: string } | undefined;
              }
            } else {
              bufferLog(jobId, { phase: 'templates_folder_missing', message: 'Ordner /templates nicht gefunden' });
            }

            if (chosen) {
              const bin = await provider.getBinary(chosen.id);
              const templateContent = await bin.blob.text();
              await repo.appendMeta(jobId, { template_used: (chosen as unknown as { metadata?: { name?: string } }).metadata?.name }, 'template_pick');

              // Secretary Transformer aufrufen
              const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
              const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
              const fd = new FormData();
              fd.append('text', extractedText);
              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              fd.append('target_language', lang);
              fd.append('template_content', templateContent);
              fd.append('use_cache', 'false');
              // Kontext übergeben (Dateiname/Pfad/Job)
              try {
                const parentId = job.correlation.source?.parentId || 'root';
                const parentPath = await provider.getPathById(parentId); // z.B. /Berichte Landesämter/Bevölk.Schutz
                const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                const rawName = job.correlation.source?.name || 'document.pdf';
                const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
                const baseName = withoutExt.replace(new RegExp(`\\.${lang}$`, 'i'), '');
                const ctx = {
                  filename: baseName,
                  filepath: dirPath,
                  libraryId: job.libraryId,
                  jobId: job.jobId,
                  sourceItemId: job.correlation.source?.itemId,
                  parentId: job.correlation.source?.parentId
                } as const;
                fd.append('context', JSON.stringify(ctx));
              } catch {}
              const headers: Record<string, string> = { 'Accept': 'application/json' };
              const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
              if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
              const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
              const data: unknown = await resp.json().catch(() => ({}));
              if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
                const d = (data as { data?: unknown }).data as { structured_data?: unknown } | undefined;
                const normalized = normalizeStructuredData(d?.structured_data);
                metadataFromTemplate = normalized || null;
                bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' });
              } else {
                bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' });
                templateStatus = 'failed';
              }
            }
          } catch(err) {
            console.error(err);
            bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation: ' + (err instanceof Error ? err.message : 'Unbekannter Fehler') });
            templateStatus = 'failed';
          }
        }

        // Frontmatter bestimmen und Shadow‑Twin speichern
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };
        docMetaForIngestion = finalMeta;
        await repo.appendMeta(jobId, finalMeta, 'template_transform');
        await repo.updateStep(jobId, 'transform_template', { status: templateStatus === 'failed' ? 'failed' : 'completed', endedAt: new Date(), ...(templateStatus === 'skipped' ? { details: { skipped: true } } : {}) });

        // Fatal: Wenn Template-Transformation gestartet wurde, aber fehlgeschlagen ist, abbrechen
        if (templateStatus === 'failed') {
          clearWatchdog(jobId);
          bufferLog(jobId, { phase: 'failed', message: 'Template-Transformation fehlgeschlagen (fatal)' });
          const bufferedTpl = drainBufferedLogs(jobId);
          for (const entry of bufferedTpl) {
            await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
          }
          await repo.setStatus(jobId, 'failed', { error: { code: 'template_failed', message: 'Template-Transformation fehlgeschlagen' } });
          getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Template-Transformation fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
          return NextResponse.json({ status: 'ok', jobId, kind: 'failed_template' });
        }

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        // SSOT: Flache, UI-taugliche Metafelder ergänzen (nur auf stabilem Meilenstein)
        const ssotFlat: Record<string, unknown> = {
          job_id: jobId,
          source_file: job.correlation.source?.name || baseName,
          extract_status: 'completed',
          template_status: templateStatus,
          // Ingestion-Status wird später ggf. separat ermittelt; hier neutral
          ingest_status: 'none',
        };
        // optionale Summary-Werte aus bereits vorhandenen Metadaten übernehmen, wenn vorhanden
        if (typeof (finalMeta as Record<string, unknown>)['summary_pages'] === 'number') ssotFlat['summary_pages'] = (finalMeta as Record<string, unknown>)['summary_pages'];
        if (typeof (finalMeta as Record<string, unknown>)['summary_chunks'] === 'number') ssotFlat['summary_chunks'] = (finalMeta as Record<string, unknown>)['summary_chunks'];
        ssotFlat['summary_language'] = lang;

        const mergedMeta = { ...finalMeta, ...ssotFlat } as Record<string, unknown>;

        const markdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, mergedMeta)
          : extractedText;
        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        await repo.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
        const saved = await provider.uploadFile(targetParentId, file);
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;
        await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

        // Bilder-ZIP optional verarbeiten
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              const base = baseRaw.replace(/\/$/, '');
              const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
              archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') ? `${base}${rel.substring(4)}` : `${base}${rel}`;
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            }
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
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
        }
      }

      // Schritt: ingest_rag (optional automatisiert)
      try {
        // Gate für Ingestion (Phase 3)
        const autoSkip = true;
        let ingestGateExists = false;
        if (autoSkip) {
          const g = await gateIngestRag({
            repo,
            jobId,
            userEmail: job.userEmail,
            library: lib,
            source: job.correlation?.source,
            options: job.correlation?.options as { targetLanguage?: string } | undefined,
            ingestionCheck: async ({ userEmail, libraryId, fileId }: { userEmail: string; libraryId: string; fileId: string }) => {
              // Prüfe Doc‑Vektor existiert (kind:'doc' + fileId)
              try {
                const ctx = await (await import('@/lib/chat/loader')).loadLibraryChatContext(userEmail, libraryId)
                const apiKey = process.env.PINECONE_API_KEY
                if (!ctx || !apiKey) return false
                const idx = await (await import('@/lib/chat/pinecone')).describeIndex(ctx.vectorIndex, apiKey)
                if (!idx?.host) return false
                const list = await (await import('@/lib/chat/pinecone')).listVectors(idx.host, apiKey, { kind: 'doc', user: userEmail, libraryId, fileId })
                return Array.isArray(list) && list.length > 0
              } catch {
                return false
              }
            }
          })
          if (g.exists) {
            ingestGateExists = true;
            await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });
            // Wenn geskippt, keinen weiteren Ingestion-Versuch starten
            // dennoch Abschluss unten fortsetzen
          } else {
            await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() });
          }
        } else {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() });
        }
        FileLogger.info('external-jobs', 'Ingestion start', { jobId, libraryId: job.libraryId })
        const useIngestion = !!(job.parameters && typeof job.parameters === 'object' && (job.parameters as Record<string, unknown>)['doIngestRAG']);
        if (useIngestion && !ingestGateExists) {
          // Lade gespeicherten Markdown-Inhalt erneut (vereinfachend: extractedText)
          // Stabiler Schlüssel: Original-Quell-Item (PDF) bevorzugen, sonst Shadow‑Twin, sonst Fallback
          const fileId = (job.correlation.source?.itemId as string | undefined) || savedItemId || `${jobId}-md`;
          const fileName = `${(job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')}.${(job.correlation.options?.targetLanguage as string | undefined) || 'de'}.md`;
          const res = await IngestionService.upsertMarkdown(job.userEmail, job.libraryId, fileId, fileName, extractedText || '', docMetaForIngestion);
          const total = res.chunksUpserted + (res.docUpserted ? 1 : 0)
          await repo.setIngestion(jobId, { upsertAt: new Date(), vectorsUpserted: total, index: res.index });
          // Zusammenfassung loggen
          bufferLog(jobId, { phase: 'ingest_rag', message: `RAG-Ingestion: ${res.chunksUpserted} Chunks, ${res.docUpserted ? 1 : 0} Doc` });
          FileLogger.info('external-jobs', 'Ingestion success', { jobId, chunks: res.chunksUpserted, doc: res.docUpserted, total })
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date() });
        } else {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
        }
      } catch (err) {
        const reason = (() => {
          if (err && typeof err === 'object') {
            const e = err as { message?: unknown }
            const msg = typeof e.message === 'string' ? e.message : undefined
            return msg || String(err)
          }
          return String(err)
        })()
        bufferLog(jobId, { phase: 'ingest_rag_failed', message: reason })
        FileLogger.error('external-jobs', 'Ingestion failed', err)
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'RAG Ingestion fehlgeschlagen', details: { reason } } });
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
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
    }

    // Sollte nicht erreicht werden
    return NextResponse.json({ status: 'ok', jobId, kind: 'noop_final' });
  } catch (err) {
    try {
      const { jobId } = await params;
      const repo = new ExternalJobsRepository();
      const job = await repo.get(jobId);
      if (job) {
        bufferLog(jobId, { phase: 'failed', message: 'Invalid payload' });
        await repo.appendLog(jobId, { phase: 'failed', message: 'Invalid payload' } as unknown as Record<string, unknown>);
        await repo.setStatus(jobId, 'failed', { error: { code: 'invalid_payload', message: err instanceof Error ? err.message : 'Invalid payload' } });
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Invalid payload', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
      }
    } catch {
      // ignore secondary failures
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { env } from 'process';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { ExternalJob } from '@/types/external-job';
import { LibraryService } from '@/lib/services/library-service';
// Storage: konsequent Server-Provider verwenden
import { getServerProvider } from '@/lib/storage/server-provider';
import { gateExtractPdf } from '@/lib/processing/gates';
import { legacyToPolicies, PhasePolicies, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { TransformService } from '@/lib/transform/transform-service';

export async function POST(request: NextRequest) {
  try {
    FileLogger.info('process-pdf', 'Route aufgerufen');
    
    // Authentifizierung prüfen
    const { userId } = getAuth(request);
    if (!userId) {
      console.error('[process-pdf] Nicht authentifiziert');
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    FileLogger.debug('process-pdf', 'Authentifizierung erfolgreich', { userId });

    // Alle Request-Header protokollieren
    const headerObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    
    // FormData aus dem Request holen
    const formData = await request.formData();
    const formDataKeys: string[] = [];
    formData.forEach((value, key) => {
      formDataKeys.push(key);
    });
    FileLogger.debug('process-pdf', 'FormData empfangen', { keys: formDataKeys });
    

    // Secretary Service URL aus Umgebungsvariablen holen
    const secretaryServiceUrl = env.SECRETARY_SERVICE_URL;
    
    // Sicherstellen, dass keine doppelten Slashes entstehen
    const normalizedUrl = secretaryServiceUrl?.endsWith('/') 
      ? `${secretaryServiceUrl}pdf/process` 
      : `${secretaryServiceUrl}/pdf/process`;
    
    FileLogger.info('process-pdf', 'Forward an Secretary Service', { url: normalizedUrl });
    
    // Eine neue FormData erstellen, die nur die für den Secretary Service relevanten Felder enthält
    const serviceFormData = new FormData();
    
    // Datei hinzufügen
    if (formData.has('file')) {
      serviceFormData.append('file', formData.get('file') as File);
      
      // Protokolliere ungefähre Dateigröße für Debugging
      const file = formData.get('file') as File;
      console.log('[process-pdf] Ungefähre Dateigröße:', file.size, 'Bytes');
    }
    
    // Zielsprache (target_language)
    if (formData.has('targetLanguage')) {
      serviceFormData.append('target_language', formData.get('targetLanguage') as string);
    } else {
      serviceFormData.append('target_language', 'de'); // Standardwert
    }
    
    // Template-Option NICHT an Secretary senden – wir transformieren serverseitig im Callback
    // (Der Secretary erwartet ggf. einen Pfad und würde sonst '...md.md' anhängen.)
    // Veraltetes Feld skipTemplate wird nicht mehr verwendet
    const skipTemplate = false;
    
    // Extraktionsmethode – Clientwert oder Library-Default
    let effectiveExtraction: string | null = null;
    if (formData.has('extractionMethod')) effectiveExtraction = String(formData.get('extractionMethod'));
    if (!effectiveExtraction) {
      try {
        const libHeader = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
        const usr = await currentUser();
        const email = usr?.emailAddresses?.[0]?.emailAddress || '';
        if (libHeader && email) {
          const svc = LibraryService.getInstance();
          const libs = await svc.getUserLibraries(email);
          const lib = libs.find(l => l.id === libHeader);
          effectiveExtraction = lib?.config?.secretaryService?.pdfDefaults?.extractionMethod || null;
        }
      } catch {}
    }
    serviceFormData.append('extraction_method', effectiveExtraction || 'native');
    
    // Cache-Optionen
    if (formData.has('useCache')) {
      serviceFormData.append('useCache', formData.get('useCache') as string);
    } else {
      serviceFormData.append('useCache', 'true'); // Standardwert: Cache verwenden
    }
    
    // Include Images Option
    if (formData.has('includeImages')) {
      serviceFormData.append('includeImages', formData.get('includeImages') as string);
    } else {
      serviceFormData.append('includeImages', 'false'); // Standardwert: Keine Bilder
    }
    
    // Force refresh Option
    if (formData.has('force_refresh')) {
      serviceFormData.append('force_refresh', formData.get('force_refresh') as string);
    } else {
      serviceFormData.append('force_refresh', 'false'); // Standardwert
    }

    // Policies optional aus Client übernehmen
    const policiesFromClient: PhasePolicies | undefined = (() => {
      try {
        const raw = formData.get('policies') as string | null;
        return raw ? JSON.parse(raw) as PhasePolicies : undefined;
      } catch {
        return undefined;
      }
    })();
    const policies = policiesFromClient || legacyToPolicies({ doExtractPDF: true });

    // Job anlegen (per-Job-Secret)
    const repository = new ExternalJobsRepository();
    const jobId = crypto.randomUUID();
    const jobSecret = crypto.randomBytes(24).toString('base64url');
    const jobSecretHash = repository.hashSecret(jobSecret);

    // Correlation aus Request ableiten
    const libraryId = request.headers.get('x-library-id') || request.headers.get('X-Library-Id') || '';
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    // Korrelation: nutze die bereits ermittelte effektive Methode oben, falls vorhanden
    const extractionMethod = (formData.get('extractionMethod') as string) || (serviceFormData.get('extraction_method') as string) || 'native';
    const includeImages = (formData.get('includeImages') as string) ?? 'false';
    const useCache = (formData.get('useCache') as string) ?? 'true';
    const targetLanguage = (formData.get('targetLanguage') as string) || 'de';
    const file = formData.get('file') as File | null;

    // Optional vom Client mitgeliefert (für zielgenaues Speichern)
    const originalItemId = (formData.get('originalItemId') as string) || undefined;
    const parentId = (formData.get('parentId') as string) || undefined;

    const correlation = {
      jobId,
      libraryId,
      source: {
        mediaType: 'pdf',
        mimeType: file?.type || 'application/pdf',
        name: file?.name,
        itemId: originalItemId,
        parentId: parentId,
      },
      options: {
        targetLanguage,
        extractionMethod,
        includeImages: includeImages === 'true',
        useCache: useCache === 'true',
      },
      batchId: (formData.get('batchId') as string) || undefined,
      batchName: (formData.get('batchName') as string) || undefined,
    } satisfies ExternalJob['correlation'];

    const job: ExternalJob = {
      jobId,
      jobSecretHash,
      job_type: 'pdf',
      operation: 'extract',
      worker: 'secretary',
      status: 'queued',
      libraryId,
      userEmail,
      correlation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await repository.create(job);
    // Schritte initialisieren und Parameter mitschreiben (für Report-Tab)
    const phases = { extract: policies.extract !== 'ignore', template: policies.metadata !== 'ignore', ingest: policies.ingest !== 'ignore' };
    await repository.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], {
      targetLanguage,
      extractionMethod,
      includeImages: includeImages === 'true',
      useCache: useCache === 'true',
      template: (formData.get('template') as string) || undefined,
      phases,
      // Neue vereinfachte Flags
      policies
    });
    FileLogger.info('process-pdf', 'Job angelegt', {
      jobId,
      libraryId,
      userEmail,
      extractionMethod,
      includeImages,
      useCache,
      targetLanguage
    });

    // Sofortiges Live-Event: queued (für UI, damit Eintrag direkt erscheint)
    try {
      getJobEventBus().emitUpdate(userEmail, {
        type: 'job_update',
        jobId,
        status: 'queued',
        progress: 0,
        message: 'queued',
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: correlation.source?.name,
        sourceItemId: originalItemId,
      });
    } catch {}
    // Watchdog starten (600s ohne Progress => Timeout)
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: correlation.source?.name }, 600_000);

    // Callback-Informationen (generisch) anfügen
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
      serviceFormData.append('callback_url', callbackUrl);
      
      // Detailliertes Logging der Callback-Parameter
      FileLogger.info('process-pdf', 'Callback-Parameter vorbereitet', {
        jobId,
        callbackUrl,
        hasAppUrl: !!appUrl,
        appUrl: appUrl
      });
    } else {
      FileLogger.warn('process-pdf', 'NEXT_PUBLIC_APP_URL nicht gesetzt', { jobId });
    }
    
    // per-Job-Secret mitgeben
    serviceFormData.append('callback_token', jobSecret);
    // jobId nicht zusätzlich mitsenden – steht in der Callback-URL
    FileLogger.info('process-pdf', 'Job-Secret generiert', {
      jobId,
      hasSecret: !!jobSecret,
      secretLength: jobSecret.length
    });
    
    // Korrelation NICHT an Secretary senden – Secretary erhält nur jobId + Callback
    FileLogger.info('process-pdf', 'Korrelation nicht an Secretary gesendet (nur jobId & Callback)', {
      jobId,
      correlationSummary: {
        hasSource: !!correlation.source,
        hasOptions: !!correlation.options
      }
    });

    // HTTP-Request als JSON loggen (kopierbar für Tests)
    const httpRequest = {
      method: 'POST',
      url: normalizedUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      },
      body: {
        file: '[BINARY: PDF-Datei]',
        target_language: targetLanguage,
        extraction_method: extractionMethod,
        useCache: useCache,
        includeImages: includeImages,
        force_refresh: (formData.get('force_refresh') as string) ?? 'false',
        callback_url: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}`,
        callback_token: jobSecret,
      }
    };
    
    FileLogger.info('process-pdf', 'HTTP-Request an Secretary Service', { jobId, request: httpRequest });
    // Persistenter Logeintrag in DB
    await repository.appendLog(jobId, { phase: 'request_sent', sourcePath: correlation.source?.itemId, targetParentId: correlation.source?.parentId, callbackUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}` : undefined });

    // Idempotenz ist immer aktiv
    const autoSkipExisting: boolean = true;

    // Extract-Gate vor dem Secretary-Call: vorhanden? → je nach Flags entscheiden
    try {
      if (autoSkipExisting) {
        const libraryService = LibraryService.getInstance();
        const libraries = await libraryService.getUserLibraries(userEmail);
        const lib = libraries.find(l => l.id === libraryId);
        const g = await gateExtractPdf({
          repo: repository,
          jobId,
          userEmail,
          library: lib,
          source: { itemId: originalItemId, parentId, name: file?.name },
          options: { targetLanguage }
        });
        const runExtract = shouldRunWithGate(g.exists, policies.extract);
        if (!runExtract) {
          // Phase 1 überspringen
          await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.reason } });

          // Template-Only Pfad, wenn nicht explizit skipTemplate=true
          if (!skipTemplate && (policies.metadata !== 'ignore')) {
            try {
              const libraryService = LibraryService.getInstance();
              const libraries2 = await libraryService.getUserLibraries(userEmail);
              const lib2 = libraries2.find(l => l.id === libraryId);
              if (lib2) {
                const provider = await getServerProvider(userEmail, libraryId);
                await repository.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });

                // Template-Datei finden (wie im Callback)
                const rootItems = await provider.listItemsById('root');
                const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
                const ensureTemplatesFolderId = async (): Promise<string> => {
                  if (templatesFolder) return templatesFolder.id;
                  const created = await provider.createFolder('root', 'templates');
                  return created.id;
                };
                const templatesFolderId = await ensureTemplatesFolderId();
                let chosen: { id: string } | undefined;
                if (templatesFolderId) {
                  const tplItems = await provider.listItemsById(templatesFolderId);
                  const preferredTemplate = ((lib2.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || (formData.get('template') as string | null) || '').trim();
                  const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
                  chosen = preferredTemplate
                    ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
                    : (pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
                }

                let templateContent = '# {{title}}\n';
                if (chosen) {
                  const bin = await provider.getBinary(chosen.id);
                  templateContent = await bin.blob.text();
                }

                // Shadow‑Twin laden (im Parent by Name)
                const siblings = await provider.listItemsById(parentId || 'root');
                const expectedName = (g.details && typeof g.details === 'object' ? (g.details as { matched?: string }).matched : undefined) || (() => {
                  const base = (file?.name || 'output').replace(/\.[^/.]+$/, '');
                  return `${base}.${targetLanguage}.md`;
                })();
                const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName);
                if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
                const twinBin = await provider.getBinary(twin.id);
                const originalMarkdown = await twinBin.blob.text();
                const stripped = originalMarkdown.replace(/^---[\s\S]*?---\s*/m, '');

                // Transformer aufrufen
                const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
                const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
                const fd = new FormData();
                fd.append('text', stripped);
                fd.append('target_language', targetLanguage);
                fd.append('template_content', templateContent);
                fd.append('use_cache', 'false');
                // Kontext für LLM-Auswertung (Dateiname/Pfad/IDs)
                try {
                  const parentPath = await provider.getPathById(parentId || 'root'); // z.B. /Berichte Landesämter/Bevölk.Schutz
                  const dirPath = parentPath.replace(/^\//, ''); // Berichte Landesämter/Bevölk.Schutz
                  const rawName = (expectedName || file?.name || 'document.md');
                  const withoutExt = rawName.replace(/\.[^./\\]+$/, '');
                  const baseName = withoutExt.replace(new RegExp(`\\.${targetLanguage}$`, 'i'), '');
                  const ctx = {
                    filename: baseName,
                    filepath: dirPath,
                    libraryId,
                    jobId,
                    sourceItemId: originalItemId,
                    parentId
                  } as const;
                  fd.append('context', JSON.stringify(ctx));
                } catch {}
                const headers: Record<string, string> = { 'Accept': 'application/json' };
                const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
                if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
                const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
                const data: unknown = await resp.json().catch(() => ({}));
                const mdMeta = (data && typeof data === 'object' && !Array.isArray(data)) ? ((data as { data?: { structured_data?: Record<string, unknown> } }).data?.structured_data || {}) : {};

                await repository.appendMeta(jobId, mdMeta as Record<string, unknown>, 'template_transform');
                await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });

                // Markdown mit neuem Frontmatter überschreiben (SSOT: flaches Schema ergänzen)
                const ssotFlat: Record<string, unknown> = {
                  job_id: jobId,
                  source_file: correlation?.source?.name || (file?.name || 'document.pdf'),
                  // In diesem Template-only Pfad sind extract/template abgeschlossen (Text lag bereits vor)
                  extract_status: 'completed',
                  template_status: 'completed',
                  ingest_status: 'none',
                  summary_language: targetLanguage,
                };
                const mergedMeta = { ...(mdMeta as Record<string, unknown>), ...ssotFlat } as Record<string, unknown>;
                const newMarkdown = (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter
                  ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(stripped, mergedMeta)
                  : originalMarkdown;
                const outFile = new File([new Blob([newMarkdown], { type: 'text/markdown' })], expectedName || (file?.name || 'output.md'), { type: 'text/markdown' });
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
                await provider.uploadFile(parentId || 'root', outFile);
                await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });

                // Ingestion je nach Flag nur markieren (kein Upsert hier)
                if (policies.ingest !== 'ignore') {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
                } else {
                  await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
                }

                clearWatchdog(jobId);
                await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (template-only)' });
                await repository.setStatus(jobId, 'completed');
                try {
                  getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (template-only)', jobType: 'pdf', fileName: correlation.source?.name, sourceItemId: originalItemId });
                } catch {}
                return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-template-only', main_processor: 'template', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
              }
            } catch {
              // Fallback: wenn Template-Only fehlschlägt, markieren wir die Schritte als skipped und schließen
              await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              if (policies.ingest !== 'ignore') {
                await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
              } else {
                await repository.updateStep(jobId, ' ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
              }
              clearWatchdog(jobId);
              await repository.setStatus(jobId, 'completed');
              return NextResponse.json({ status: 'accepted', worker: 'secretary', process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true }, job: { id: jobId }, webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` }, error: null });
            }
          } else {
            // Kein Template‑Only gewünscht → alle übrigen Schritte überspringen
            await repository.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            await repository.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            if (policies.ingest !== 'ignore') {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'artifact_exists' } });
            } else {
              await repository.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true } });
            }
            clearWatchdog(jobId);
            await repository.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen (extract skipped: artifact_exists)' });
            await repository.setStatus(jobId, 'completed');
            try {
              getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed (skipped extract)', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId });
            } catch {}
            return NextResponse.json({
              status: 'accepted',
              worker: 'secretary',
              process: { id: 'local-skip', main_processor: 'pdf', started: new Date().toISOString(), is_from_cache: true },
              job: { id: jobId },
              webhook: { delivered_to: `${appUrl?.replace(/\/$/, '')}/api/external/jobs/${jobId}` },
              error: null
            });
          }
        }
      }
    } catch {}

    // Anfrage an den Secretary Service senden (nur wenn doExtractPDF true oder keine Flags gesetzt)
    if (!(policies.extract !== 'ignore') && ((policies.metadata !== 'ignore') || (policies.ingest !== 'ignore'))) {
      // Kein Worker-Call notwendig, die Arbeit passiert lokal (Template‑Only) oder es ist nur Ingestion geplant (aktueller Pfad löst Ingestion erst im Callback aus, daher schließen wir hier ab)
      // Falls nur Ingestion geplant ist, führt der Callback es später aus; hier markieren wir extract als skipped
      await repository.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'not_requested' } });
      return NextResponse.json({ status: 'accepted', job: { id: jobId } })
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutMs = Number(process.env.SECRETARY_REQUEST_TIMEOUT_MS || '5000');
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(normalizedUrl, {
      method: 'POST',
      body: serviceFormData,
      headers: (() => {
        const h: Record<string, string> = { 'Accept': 'application/json' };
        const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
        if (apiKey) { h['Authorization'] = `Bearer ${apiKey}`; h['X-Service-Token'] = apiKey; }
        return h;
      })(),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (err) {
      // Secretary nicht erreichbar → Job synchron auf failed setzen
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repository.appendLog(jobId, { phase: 'request_error', message });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: 'worker_unavailable', jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json({ error: 'Secretary Service nicht erreichbar' }, { status: 503 });
    }

    // HTTP-Response als JSON loggen
    const httpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: '[RESPONSE_BODY]' // Wird nach dem Parsen geloggt
    };
    
    FileLogger.info('process-pdf', 'Secretary HTTP-Response', { jobId, response: httpResponse });
    await repository.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });

    const data = await response.json();
    FileLogger.info('process-pdf', 'Secretary Response Body', {
      jobId,
      responseBody: data
    });

    if (!response.ok) {
      FileLogger.error('process-pdf', 'Secretary Fehler', data);
      await repository.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repository.appendLog(jobId, { phase: 'request_error', status: response.status, statusText: response.statusText });
      await repository.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      try { getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'failed', progress: 0, updatedAt: new Date().toISOString(), message: `worker_error ${response.status}`, jobType: job.job_type, fileName: correlation.source?.name, sourceItemId: originalItemId }); } catch {}
      return NextResponse.json(
        { error: data?.error || 'Fehler beim Transformieren der PDF-Datei' },
        { status: response.status }
      );
    }

    // Rückgabe beibehaltend (kompatibel) und JobId hinzufügen
    FileLogger.info('process-pdf', 'Request akzeptiert, gebe Job zurück', { jobId });
    return NextResponse.json({ ...data, job: { id: jobId } });
  } catch (error) {
    FileLogger.error('process-pdf', 'Unerwarteter Fehler', error);
    return NextResponse.json(
      { error: 'Fehler bei der Verbindung zum Secretary Service' },
      { status: 500 }
    );
  }
} 
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateExtractPdf } from '@/lib/processing/gates';
import { getPolicies, shouldRunExtract, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { LibraryService } from '@/lib/library/library-service';
import { getServerProvider } from '@/lib/storage/server-provider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const filename = source.name || 'document.pdf';
    const file = new File([bin.blob], filename, { type: source.mimeType || bin.mimeType || 'application/pdf' });

    // Secretary-FormData aufbauen (wie in process-pdf für den Worker-Call)
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);
    const opts = (job.correlation?.options || {}) as Record<string, unknown>;
    serviceFormData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de');
    serviceFormData.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native');
    serviceFormData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true));
    serviceFormData.append('includeImages', String(typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false));

    // Callback-URL und -Token (neues Secret generieren)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 });
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
    const newSecret = crypto.randomBytes(24).toString('base64url');
    const newHash = repo.hashSecret(newSecret);
    // Job zurücksetzen
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Policies laden
    const policies = getPolicies({ parameters: job.parameters || {} });

    // Optional: Extract-Gate prüfen und ggf. lokal Template‑Only fahren
    try {
      const libraryService = LibraryService.getInstance();
      const libraries = await libraryService.getUserLibraries(userEmail);
      const lib = libraries.find(l => l.id === libraryId);
      const g = await gateExtractPdf({ repo, jobId, userEmail, library: lib, source, options: { targetLanguage: String(serviceFormData.get('target_language') || 'de') } });
      const runExtract = shouldRunExtract(g.exists, policies.extract);
      if (!runExtract) {
        // Phase 1 überspringen → Schritte markieren und sofort success zurückgeben
        await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.exists ? (g.reason || 'artifact_exists') : 'policy_ignore' } });
        // Phase 2 je Policy behandeln: Bei 'ignore' skippen, sonst im Callback ausgeführt werden lassen
        if (policies.metadata === 'ignore') {
          await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
          await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        // Ingestion-Policy nur markieren; tatsächliche Ingestion erfolgt im Callback-Pfad
        if (policies.ingest === 'ignore') {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);
        return NextResponse.json({ ok: true, jobId, worker: 'secretary', skipped: { extract: true } });
      }
    } catch {
      // Falls Gate fehlschlägt, wird normal extrahiert
    }

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
      if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
      response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescriptreact
*** Begin Patch
*** Update File: src/components/library/job-report-tab.tsx
@@
-              const hasNewFlags = typeof p['doExtractPDF'] === 'boolean' || typeof p['doExtractMetadata'] === 'boolean' || typeof p['doIngestRAG'] === 'boolean'
-                || typeof p['forceRecreate'] === 'boolean' || typeof p['forceTemplate'] === 'boolean';
+              const hasNewFlags = Boolean(p['policies']);
@@
-                    extract: p['doExtractPDF'] === true,
-                    template: p['doExtractMetadata'] === true,
-                    ingest: p['doIngestRAG'] === true,
+                    extract: (p['policies'] as any)?.extract !== 'ignore',
+                    template: (p['policies'] as any)?.metadata !== 'ignore',
+                    ingest: (p['policies'] as any)?.ingest !== 'ignore',
*** End Patch
```

```typescriptreact
"use client";

import { useEffect, useState } from 'react'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'

interface JobReportTabProps {
  libraryId: string
  fileId: string
  fileName?: string
  provider?: StorageProvider | null
  // Quelle der Metadaten steuern: 'merged' = cumulativeMeta + Frontmatter (Standard),
  // 'frontmatter' = ausschließlich Frontmatter aus Markdown anzeigen
  sourceMode?: 'merged' | 'frontmatter'
  // Darstellungsmodus: 'full' zeigt Kopf/Steps/Logs/Parameter; 'metaOnly' zeigt nur Metadaten/Kapitel/TOC
  viewMode?: 'full' | 'metaOnly'
  // Optional explizite Markdown-Datei-ID (Shadow‑Twin). Überschreibt auto-Erkennung.
  mdFileId?: string | null
  // Optionaler Callback zum Scroll-Sync in die Markdown-Vorschau
  onJumpTo?: (args: { page?: number | string; evidence?: string }) => void
  // NEU: Rohinhalt (Markdown). Wenn gesetzt und sourceMode='frontmatter', wird direkt dieser Text geparst (ohne Datei/JOB).
  rawContent?: string
  forcedTab?: 'markdown' | 'meta' | 'chapters' | 'process'
}

interface JobDto {
  jobId: string
  status: string
  operation: string
  worker: string
  job_type: string
  updatedAt: string
  createdAt: string
  correlation?: { source?: { itemId?: string; name?: string } }
  parameters?: Record<string, unknown>
  steps?: Array<{ name: string; status: string; startedAt?: string; endedAt?: string; error?: { message: string }; details?: { skipped?: boolean } }>
  ingestion?: { vectorsUpserted?: number; index?: string; upsertAt?: string }
  result?: { savedItemId?: string }
  logs?: Array<{ timestamp: string; phase?: string; message?: string; progress?: number }>
  cumulativeMeta?: Record<string, unknown>
}

export function JobReportTab({ libraryId, fileId, fileName, provider, sourceMode = 'merged', viewMode = 'full', mdFileId, onJumpTo, rawContent, forcedTab }: JobReportTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobDto | null>(null)
  const [templateFields, setTemplateFields] = useState<string[] | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)
  const [section, setSection] = useState<'meta' | 'chapters'>('meta')
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [fullContent, setFullContent] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'markdown' | 'meta' | 'chapters' | 'process'>(forcedTab || 'markdown')

  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab)
  }, [forcedTab])

  const stripFrontmatter = (markdown: string): string => markdown.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, '')

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        // Wenn wir ausschließlich Frontmatter anzeigen und bereits eine eindeutige Quelle haben (rawContent oder mdFileId),
        // dann überspringen wir die Job-Suche komplett, um doppelte Events/Loads zu vermeiden.
        if (sourceMode === 'frontmatter' && (
          (typeof rawContent === 'string' && rawContent.length > 0) ||
          (typeof mdFileId === 'string' && mdFileId.length > 0)
        )) {
          setJob(null)
          setLoading(false)
          setError(null)
          return
        }
        setLoading(true)
        setError(null)
        UILogger.info('JobReportTab', 'Start Job-Suche', { libraryId, fileId })
        // 1) Versuche Job über result.savedItemId (Shadow‑Twin) zu finden
        const byResultUrl = new URL(`/api/external/jobs`, window.location.origin)
        byResultUrl.searchParams.set('byResultItemId', fileId)
        UILogger.debug('JobReportTab', 'Request byResultItemId', { url: byResultUrl.toString() })
        let res = await fetch(byResultUrl.toString(), { cache: 'no-store' })
        let data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche fehlgeschlagen')
        let j: JobDto | null = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
        UILogger.debug('JobReportTab', 'Result byResultItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })

        // 2) Fallback: über correlation.source.itemId (Originaldatei)
        if (!j) {
          const bySourceUrl = new URL(`/api/external/jobs`, window.location.origin)
          bySourceUrl.searchParams.set('bySourceItemId', fileId)
          bySourceUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceItemId', { url: bySourceUrl.toString() })
          res = await fetch(bySourceUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Quelle) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        // 3) Fallback: über correlation.source.name (Dateiname der Quelle)
        if (!j) {
          const byNameUrl = new URL(`/api/external/jobs`, window.location.origin)
          // Wenn wir den tatsächlichen Dateinamen kennen, verwende ihn.
          // Für Shadow‑Twins (z. B. name.de.md) versuche das Basis‑PDF (name.pdf).
          let candidate = (fileName && typeof fileName === 'string') ? fileName : (fileId.includes('/') ? (fileId.split('/').pop() as string) : fileId)
          const parts = candidate.split('.')
          if (parts.length >= 3) {
            const ext1 = parts[parts.length - 1].toLowerCase()
            const ext2 = parts[parts.length - 2].toLowerCase()
            if ((ext1 === 'md' || ext1 === 'mdx') && /^[a-z]{2}$/i.test(ext2)) {
              candidate = parts.slice(0, -2).join('.') + '.pdf'
            }
          }
          byNameUrl.searchParams.set('bySourceName', candidate)
          byNameUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceName', { url: byNameUrl.toString(), nameOnly: candidate, originalFileName: fileName })
          res = await fetch(byNameUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Name) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceName', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        if (!cancelled) setJob(j)
        if (j) UILogger.info('JobReportTab', 'Job gefunden', { jobId: j.jobId, status: j.status })
        else UILogger.warn('JobReportTab', 'Kein Job gefunden', { libraryId, fileId })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        UILogger.error('JobReportTab', 'Job-Suche fehlgeschlagen', e)
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [libraryId, fileId, fileName, sourceMode, rawContent, mdFileId])

  // Wenn Template benutzt wurde, lade dessen Inhalt aus /templates und extrahiere Frontmatter-Schlüssel
  useEffect(() => {
    async function loadTemplateFields() {
      try {
        setTemplateFields(null)
        const tpl = job?.cumulativeMeta && typeof (job.cumulativeMeta as unknown) === 'object'
          ? (job.cumulativeMeta as Record<string, unknown>)['template_used']
          : undefined
        const templateName = typeof tpl === 'string' ? tpl : undefined
        if (!templateName || !provider) return
        const rootItems = await provider.listItemsById('root')
        const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'))
        if (!templatesFolder) return
        const tplItems = await provider.listItemsById(templatesFolder.id)
        const match = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === templateName.toLowerCase()))
        if (!match) return
        const bin = await provider.getBinary(match.id)
        const text = await bin.blob.text()
        // Extrahiere Frontmatter zwischen den ersten beiden --- und lese die Keys bis zu :
        const m = text.match(/^---[\s\S]*?---/)
        if (!m) return
        const fm = m[0]
        const keys: string[] = []
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            if (k) keys.push(k)
          }
        }
        setTemplateFields(Array.from(new Set(keys)))
      } catch (e) {
        UILogger.warn('JobReportTab', 'Template-Felder konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) })
      }
    }
    void loadTemplateFields()
  }, [job, provider])

  // Gemeinsamer strikter Parser
  const strictParseFrontmatter = (fm: string) => parseSecretaryMarkdownStrict(fm)

  // Frontmatter aus der gespeicherten Markdown-Datei lesen (oder aus rawContent)
  const effectiveMdId = (() => {
    // Bevorzugt explizite mdFileId; sonst Ergebnis des Jobs; fallback auf fileId
    return (mdFileId && typeof mdFileId === 'string' && mdFileId.length > 0)
      ? mdFileId
      : ((job?.result?.savedItemId as string | undefined) || fileId)
  })()

  useEffect(() => {
    async function loadFrontmatter() {
      try {
        setParseErrors([])
        // Wenn roher Inhalt übergeben wurde, direkt daraus lesen
        if (sourceMode === 'frontmatter' && typeof rawContent === 'string' && rawContent.length > 0) {
          const text = rawContent
          setFullContent(text)
          const { frontmatter, meta, errors } = parseSecretaryMarkdownStrict(text)
          UILogger.debug('JobReportTab', 'Frontmatter (raw): Block gefunden?', { found: !!frontmatter, length: frontmatter ? frontmatter.length : 0 })
          if (!frontmatter) { setFrontmatterMeta(null); return }
          setFrontmatterMeta(Object.keys(meta).length ? meta : null)
          setParseErrors(errors)
          return
        }

        if (!provider) return
        const mdId = effectiveMdId
        UILogger.info('JobReportTab', 'Frontmatter: Lade Datei', { mdId, sourceMode })
        if (!mdId) return
        const bin = await provider.getBinary(mdId)
        const text = await bin.blob.text()
        setFullContent(text)
        const { frontmatter, meta, errors } = parseSecretaryMarkdownStrict(text)
        UILogger.debug('JobReportTab', 'Frontmatter: Block gefunden?', { found: !!frontmatter, length: frontmatter ? frontmatter.length : 0 })
        if (!frontmatter) { setFrontmatterMeta(null); return }
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
        setParseErrors(errors)
      } catch {
        setFrontmatterMeta(null)
      }
    }
    void loadFrontmatter()
  }, [provider, effectiveMdId, sourceMode, rawContent])

  if (sourceMode !== 'frontmatter') {
    if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Job…</div>
    if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
    if (!job) return <div className="p-4 text-sm text-muted-foreground">Kein Job zur Datei gefunden.</div>
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      {viewMode === 'metaOnly' && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid grid-cols-4 w-full gap-1">
            <TabsTrigger value="markdown" className="px-2 py-1 text-xs">Markdown</TabsTrigger>
            <TabsTrigger value="meta" className="px-2 py-1 text-xs">Metadaten</TabsTrigger>
            <TabsTrigger value="chapters" className="px-2 py-1 text-xs">Kapitel</TabsTrigger>
            {(() => {
              const base: Record<string, unknown> = sourceMode === 'frontmatter' ? {} : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
              const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
              const processFields = new Set([
                'job_id','extract_status','template_status','ingest_status','summary_language',
                'source_file','source_file_id','source_file_size','source_file_type',
                'filename','path','pathHints','isScan'
              ])
              const hasProcess = Object.keys(cm).some(k => processFields.has(k))
              return hasProcess ? <TabsTrigger value="process" className="px-2 py-1 text-xs">Prozessinfo</TabsTrigger> : null
            })()}
          </TabsList>

          <TabsContent value="markdown" className="mt-3">
            <div className="border rounded-md">
              <MarkdownPreview content={stripFrontmatter(fullContent || '')} />
            </div>
          </TabsContent>

          <TabsContent value="meta" className="mt-3">
            {/* Hinweise zu Parserfehlern (strikt) */}
            {parseErrors.length > 0 && (
              <div className="text-xs text-destructive mb-2">
                {parseErrors.map((e, i) => (<div key={i}>Parserfehler: {e}</div>))}
              </div>
            )}
            {(() => {
              const base: Record<string, unknown> = sourceMode === 'frontmatter'
                ? {}
                : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
              const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
              // confidence/provenance können Objekt oder JSON-String sein → Fallback parse
              const confidence: Record<string, unknown> = (() => {
                const raw = cm['confidence']
                if (raw && typeof raw === 'object') return raw as Record<string, unknown>
                if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { /* ignore */ } }
                return {}
              })()
              const provenance: Record<string, unknown> = (() => {
                const raw = cm['provenance']
                if (raw && typeof raw === 'object') return raw as Record<string, unknown>
                if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { /* ignore */ } }
                return {}
              })()
              const hasAnyConfidence = Object.keys(confidence).length > 0
              const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
                ? Array.from(new Set([...(templateFields as string[]), ...Object.keys(cm)]))
                : Object.keys(cm)
              const flatKeysAll = baseKeys.filter(k => k !== 'chapters' && k !== 'toc' && k !== 'confidence' && k !== 'provenance')
              const processFields = new Set([
                'job_id','extract_status','template_status','ingest_status','summary_language',
                'source_file','source_file_id','source_file_size','source_file_type',
                'filename','path','pathHints','isScan'
              ])
              const primaryKeys = flatKeysAll.filter(k => !processFields.has(k))
              const flatKeys = primaryKeys
              if (flatKeys.length === 0) return null
              return (
                <div>
                  <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 pr-2 sticky left-0 bg-background z-10">Feld</th>
                          <th className="py-1 pr-2">Wert</th>
                          {hasAnyConfidence ? <th className="py-1 pr-2 text-right sticky right-0 bg-background border-l">Q</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {flatKeys.map((k) => {
                          const val = cm[k]
                          let valueStr = ''
                          if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                          else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                          const hasNonEmptyValue = (() => {
                            if (val === null || val === undefined) return false
                            if (typeof val === 'string') return val.trim().length > 0
                            if (Array.isArray(val)) return (val as Array<unknown>).length > 0
                            if (typeof val === 'object') return Object.keys(val as Record<string, unknown>).length > 0
                            return true
                          })()
                          const cRaw = (confidence as Record<string, unknown>)[k]
                          const cNum = typeof cRaw === 'number' ? cRaw : (typeof cRaw === 'string' && /^\d+(\.\d+)?$/.test(cRaw) ? Number(cRaw) : undefined)
                          const pRaw = (provenance as Record<string, unknown>)[k]
                          const pStr = typeof pRaw === 'string' ? pRaw : pRaw ? JSON.stringify(pRaw) : ''
                          const color = cNum === undefined ? 'text-muted-foreground' : (cNum >= 0.8 ? 'text-green-600' : cNum >= 0.7 ? 'text-yellow-600' : 'text-red-600')
                          return (
                            <tr key={k} className="border-t border-muted/40">
                              <td className="py-1 pr-2 align-top font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{k}</td>
                              <td className="py-1 pr-2 align-top">
                                {valueStr ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-block max-w-[40vw] overflow-hidden text-ellipsis whitespace-nowrap align-top" title="">
                                          {valueStr}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="max-w-[80vw] whitespace-pre-wrap break-words">{valueStr}</div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : ''}
                              </td>
                              {hasAnyConfidence ? <td className="py-1 pr-2 align-top sticky right-0 bg-background border-l">
                                {(!hasNonEmptyValue || cNum === undefined) ? null : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`inline-flex items-center justify-end w-full ${color}`} title={pStr || ''}>
                                          <span className="inline-block h-2 w-2 rounded-full bg-current" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="max-w-xs whitespace-pre-wrap break-words">
                                          <div className="font-medium">Confidence: {cNum.toFixed(2)}</div>
                                          {pStr ? <div className="mt-1 text-muted-foreground">Provenance: {pStr}</div> : null}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </td> : null}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="process" className="mt-3">
            {(() => {
              const base: Record<string, unknown> = sourceMode === 'frontmatter'
                ? {}
                : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
              const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
              const processOrder = [
                'job_id','extract_status','template_status','ingest_status','summary_language',
                'source_file','source_file_id','source_file_size','source_file_type',
                'filename','path','pathHints','isScan'
              ]
              const keys = processOrder.filter(k => k in cm)
              if (keys.length === 0) return <div className="text-xs text-muted-foreground">Keine Prozessinformationen vorhanden.</div>
              return (
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-2 sticky left-0 bg-background z-10">Feld</th>
                        <th className="py-1 pr-2">Wert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map(k => {
                        const val = cm[k]
                        const valueStr = val === null || val === undefined ? '' : Array.isArray(val) ? (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ') : typeof val === 'string' ? val : JSON.stringify(val)
                        return (
                          <tr key={k} className="border-t border-muted/40">
                            <td className="py-1 pr-2 align-top font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{k}</td>
                            <td className="py-1 pr-2 align-top">
                              {valueStr ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-block max-w-[40vw] overflow-hidden text-ellipsis whitespace-nowrap align-top" title="">{valueStr}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="max-w-[80vw] whitespace-pre-wrap break-words">{valueStr}</div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="chapters" className="mt-3">
            {(() => {
              const chapters: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
                ? (Array.isArray(frontmatterMeta?.chapters) ? (frontmatterMeta?.chapters as Array<Record<string, unknown>>) : [])
                : ((job?.cumulativeMeta as unknown as { chapters?: Array<Record<string, unknown>> })?.chapters || [])
              if (!Array.isArray(chapters) || chapters.length === 0) return null
              const pad = (lvl: number | undefined): number => {
                if (typeof lvl !== 'number') return 0
                const clamped = Math.max(0, Math.min(3, lvl))
                return (clamped - 1) * 16
              }
              const counters = [0, 0, 0]
              return (
                <div className="space-y-1">
                  <div>
                    {chapters.map((c, i) => {
                      const level = typeof c.level === 'number' ? c.level : 1
                      const lvl = Math.max(1, Math.min(3, level))
                      counters[lvl - 1] += 1
                      for (let j = lvl; j < counters.length; j++) counters[j] = 0
                      const numLabel = counters.slice(0, lvl).filter(n => n > 0).join('.')
                      const title = typeof c.title === 'string' ? c.title : ''
                      const startPage = typeof c.startPage === 'number' ? c.startPage : ''
                      const summaryVal = typeof c.summary === 'string' ? c.summary : ''
                      const summary = summaryVal.length > 1000 ? `${summaryVal.slice(0, 1000)}…` : summaryVal
                      const keywords = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(v => typeof v === 'string') as string[] : []
                      const ev = typeof c.startEvidence === 'string' ? c.startEvidence : ''
                      return (
                        <details key={`${title}-${i}`} className="group border-b py-1" open={false}>
                          <summary className="list-none cursor-pointer">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0" style={{ paddingLeft: `${pad(lvl)}px` }}>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs text-muted-foreground tabular-nums">{numLabel}</span>
                                  <span className="font-medium truncate">{title}</span>
                                </div>
                              </div>
                              <div className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                                {String(startPage)}
                              </div>
                            </div>
                          </summary>
                          <div className="mt-1 pr-1 text-xs space-y-1" style={{ paddingLeft: `${pad(lvl) + 28}px` }}>
                            {summary && (
                              <div className="whitespace-pre-wrap break-words">
                                {summary}
                              </div>
                            )}
                            {Array.isArray(keywords) && keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {keywords.map(k => (
                                  <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">{k}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </TabsContent>
        </Tabs>
      )}

      {viewMode === 'full' && job && (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Job {job.jobId}</div>
            <div className="text-xs text-muted-foreground">{job.job_type} · {job.operation} · {new Date(job.updatedAt).toLocaleString()}</div>
          </div>
          <div className="inline-flex items-center rounded px-2 py-0.5 bg-muted text-xs">{job.status}</div>
        </div>
      )}

      {/* Hinweise zu Parserfehlern (strikt) */}
      {viewMode !== 'metaOnly' && parseErrors.length > 0 && (
        <div className="text-xs text-destructive">
          {parseErrors.map((e, i) => (<div key={i}>Parserfehler: {e}</div>))}
        </div>
      )}

      {/* Template Hinweis (im Frontmatter-only-Modus ausgeblendet) */}
      {sourceMode !== 'frontmatter' && job && typeof job.cumulativeMeta?.template_used === 'string' && (
        <div className="text-xs text-muted-foreground">Template: {String(job.cumulativeMeta.template_used)}</div>
      )}

      {/* Schritte mit Ampel-Logik */}
      {viewMode === 'full' && job && Array.isArray(job.steps) && job.steps.length > 0 && (
        <div>
          <div className="font-medium mb-1">Schritte</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {job.steps.map((s) => {
              // Geplante Phasen ermitteln (neues Policies-Format)
              const p = (job.parameters || {}) as Record<string, unknown>
              const policies = (p['policies'] as { extract?: string; metadata?: string; ingest?: string }) || {}
              const phases = {
                extract: policies.extract !== 'ignore',
                template: policies.metadata !== 'ignore',
                ingest: policies.ingest !== 'ignore',
              }

              const planned = (() => {
                const n = s.name
                if (n === 'extract_pdf') return phases.extract === true
                if (n === 'transform_template' || n === 'store_shadow_twin') return phases.template === true
                if (n === 'ingest_rag') return phases.ingest === true
                return false
              })()

              // Ampel-Status ableiten
              const skipped = !!(s as { details?: { skipped?: boolean } }).details?.skipped
              let icon = '○'
              let cls = 'text-muted-foreground'
              if (s.status === 'failed') { icon = '✕'; cls = 'text-red-600' }
              else if (s.status === 'running') { icon = '◐'; cls = 'text-yellow-600' }
              else if (s.status === 'completed') { icon = skipped ? '○' : '✓'; cls = skipped ? 'text-gray-400' : 'text-green-600' }
              else if (s.status === 'pending') { icon = planned ? '•' : '○'; cls = planned ? 'text-yellow-600' : 'text-muted-foreground' }

              const time = s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : ''
              return (
                <div key={s.name} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${cls}`}>
                  <span>{icon}</span>
                  <span className="font-medium">{s.name}</span>
                  {time ? <span className="opacity-70">{time}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Metadaten (flach) – je nach sourceMode: nur Frontmatter oder Merge (nur außerhalb metaOnly-View) */}
      {viewMode !== 'metaOnly' && section === 'meta' && (() => {
        const base: Record<string, unknown> = sourceMode === 'frontmatter'
          ? {}
          : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
        const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
        const confidence: Record<string, unknown> = (() => {
          const raw = cm['confidence']
          if (raw && typeof raw === 'object') return raw as Record<string, unknown>
          if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { /* ignore */ } }
          return {}
        })()
        const provenance: Record<string, unknown> = (() => {
          const raw = cm['provenance']
          if (raw && typeof raw === 'object') return raw as Record<string, unknown>
          if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { /* ignore */ } }
          return {}
        })()
        const hasAnyConfidence = Object.keys(confidence).length > 0
        const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
          ? Array.from(new Set([...(templateFields as string[]), ...Object.keys(cm)]))
          : Object.keys(cm)
        const flatKeys = baseKeys.filter(k => k !== 'chapters' && k !== 'toc' && k !== 'confidence' && k !== 'provenance')
        if (flatKeys.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 sticky left-0 bg-background z-10">Feld</th>
                  <th className="py-1 pr-2">Wert</th>
                  {hasAnyConfidence ? <th className="py-1 pr-2 text-right sticky right-0 bg-background border-l">Q</th> : null}
                </tr>
              </thead>
              <tbody>
                {flatKeys.map((k) => {
                  const val = cm[k]
                  let valueStr = ''
                  if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                  else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                  const hasNonEmptyValue = (() => {
                    if (val === null || val === undefined) return false
                    if (typeof val === 'string') return val.trim().length > 0
                    if (Array.isArray(val)) return (val as Array<unknown>).length > 0
                    if (typeof val === 'object') return Object.keys(val as Record<string, unknown>).length > 0
                    return true
                  })()
                  const cRaw = (confidence as Record<string, unknown>)[k]
                  const cNum = typeof cRaw === 'number' ? cRaw : (typeof cRaw === 'string' && /^\d+(\.\d+)?$/.test(cRaw) ? Number(cRaw) : undefined)
                  const pRaw = (provenance as Record<string, unknown>)[k]
                  const pStr = typeof pRaw === 'string' ? pRaw : pRaw ? JSON.stringify(pRaw) : ''
                  const color = cNum === undefined ? 'text-muted-foreground' : (cNum >= 0.8 ? 'text-green-600' : cNum >= 0.7 ? 'text-yellow-600' : 'text-red-600')
                  return (
                    <tr key={k} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{k}</td>
                      <td className="py-1 pr-2 align-top">
                        {valueStr ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block max-w-[40vw] overflow-hidden text-ellipsis whitespace-nowrap align-top" title="">
                                  {valueStr}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-[80vw] whitespace-pre-wrap break-words">{valueStr}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : ''}
                      </td>
                      {hasAnyConfidence ? <td className="py-1 pr-2 align-top sticky right-0 bg-background border-l">
                        {(!hasNonEmptyValue || cNum === undefined) ? null : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center justify-end w-full ${color}`} title={pStr || ''}>
                                  <span className="inline-block h-2 w-2 rounded-full bg-current" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-xs whitespace-pre-wrap break-words">
                                  <div className="font-medium">Confidence: {cNum.toFixed(2)}</div>
                                  {pStr ? <div className="mt-1 text-muted-foreground">Provenance: {pStr}</div> : null}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </td> : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {/* Kapitel (hierarchisch, TOC-Ansicht) – nur außerhalb metaOnly-View */}
      {viewMode !== 'metaOnly' && section === 'chapters' && (() => {
        const chapters: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.chapters) ? (frontmatterMeta?.chapters as Array<Record<string, unknown>>) : [])
          : ((job?.cumulativeMeta as unknown as { chapters?: Array<Record<string, unknown>> })?.chapters || [])
        if (!Array.isArray(chapters) || chapters.length === 0) return null

        const pad = (lvl: number | undefined): number => {
          if (typeof lvl !== 'number') return 0
          const clamped = Math.max(0, Math.min(3, lvl))
          return (clamped - 1) * 16 // px
        }

        // Hierarchische Nummerierung 1., 1.1, 1.1.1 basierend auf level
        const counters = [0, 0, 0]
        return (
        <div className="space-y-1">
          <div className="font-medium mb-1">Kapitel</div>
          <div>
            {chapters.map((c, i) => {
              const level = typeof c.level === 'number' ? c.level : 1
              const lvl = Math.max(1, Math.min(3, level))
              // Zähler aktualisieren
              counters[lvl - 1] += 1
              for (let j = lvl; j < counters.length; j++) counters[j] = 0
              const numLabel = counters.slice(0, lvl).filter(n => n > 0).join('.')
              const title = typeof c.title === 'string' ? c.title : ''
              const startPage = typeof c.startPage === 'number' ? c.startPage : ''
              
              const summaryVal = typeof c.summary === 'string' ? c.summary : ''
              const summary = summaryVal.length > 1000 ? `${summaryVal.slice(0, 1000)}…` : summaryVal
              const keywords = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(v => typeof v === 'string') as string[] : []
              const ev = typeof c.startEvidence === 'string' ? c.startEvidence : ''
              return (
                <details key={`${title}-${i}`} className="group border-b py-1" open={false} onToggle={(e) => {
                  const open = (e.currentTarget as HTMLDetailsElement).open
                  if (open) {
                    if (startPage !== '') onJumpTo?.({ page: startPage as number | string })
                    else if (ev) onJumpTo?.({ evidence: ev })
                  }
                }}>
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0" style={{ paddingLeft: `${pad(lvl)}px` }}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums">{numLabel}</span>
                          <span className="font-medium truncate">{title}</span>
                        </div>
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {String(startPage)}
                      </div>
                    </div>
                  </summary>
                  <div className="mt-1 pr-1 text-xs space-y-1" style={{ paddingLeft: `${pad(lvl) + 28}px` }}>
                    {summary && (
                      <div className="whitespace-pre-wrap break-words">
                        {summary}
                      </div>
                    )}
                    {Array.isArray(keywords) && keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {keywords.map(k => (
                          <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">{k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
        )
      })()}

      {/* Inhaltsverzeichnis */}
      {section === 'chapters' && (() => {
        const toc: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.toc) ? (frontmatterMeta?.toc as Array<Record<string, unknown>>) : [])
          : ((job?.cumulativeMeta as unknown as { toc?: Array<Record<string, unknown>> }).toc || [])
        if (!Array.isArray(toc) || toc.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Inhaltsverzeichnis</div>
          <div className="overflow-visible">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">Seite</th>
                  <th className="py-1 pr-2">L</th>
                </tr>
              </thead>
              <tbody>
                {toc.map((t, i) => {
                  const title = typeof t.title === 'string' ? t.title : ''
                  const page = typeof t.page === 'number' ? t.page : ''
                  const level = typeof t.level === 'number' ? t.level : ''
                  return (
                    <tr key={`${title}-${i}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{title}</td>
                      <td className="py-1 pr-2 align-top">{page}</td>
                      <td className="py-1 pr-2 align-top">{level}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {viewMode === 'full' && job && job.ingestion && (
        <div>
          <div className="font-medium mb-1">Ingestion</div>
          <div className="text-xs text-muted-foreground">{job.ingestion.index || '—'} · Vektoren: {job.ingestion.vectorsUpserted ?? '—'} · {job.ingestion.upsertAt ? new Date(job.ingestion.upsertAt).toLocaleString() : '—'}</div>
        </div>
      )}

      {viewMode === 'full' && job && Array.isArray(job.logs) && job.logs.length > 0 && (
        <div>
          <div className="font-medium mb-1">Logs (neueste zuerst)</div>
          <ul className="space-y-0.5 max-h-48 overflow-auto">
            {[...job.logs].reverse().slice(0, 30).map((l, i) => (
              <li key={i} className="text-xs">
                {new Date(l.timestamp).toLocaleTimeString()} · {l.phase || '—'} · {typeof l.progress === 'number' ? `${l.progress}% · ` : ''}{l.message || ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parameter am Ende */}
      {viewMode === 'full' && job && job.parameters && (
        <div>
          <div className="font-medium mb-1">Parameter</div>
          <pre className="bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(job.parameters, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}



```

Ich habe die Legacy-Flags vollständig entfernt und das neue Policy-Format durchgängig eingeführt.

Was geändert wurde
- Policies zentral
  - `src/lib/processing/phase-policy.ts`: `PhaseDirective = 'ignore'|'do'|'force'`, `PhasePolicies`, Helpers `shouldRunWithGate`, `shouldRunExtract`, `legacyToPolicies`, `getPolicies`.
- Typen/Client
  - `src/lib/transform/transform-service.ts`: `PdfTransformOptions` nutzt nur noch `policies`; keine Legacy-Flags mehr.
  - `src/lib/secretary/client.ts`: `transformPdf(..., context?: {…, policies?: PhasePolicies })`.
- Batch
  - `src/app/api/secretary/process-pdf/batch/route.ts`: `options.policies` wird gespeichert unter `parameters.policies`. Keine Legacy-Felder mehr. Falls Policies fehlen, default auf `extract:'do'`.
- Single-Upload
  - `src/app/api/secretary/process-pdf/route.ts`: akzeptiert Policies, speichert sie und leitet daraus `phases` ab. Vor dem Secretary-Call: Gate+Policy entscheiden, ob Extraktion übersprungen wird. Folgepfade (Template/Ingestion) prüfen Policies.
- Retry
  - `src/app/api/external/jobs/[jobId]/retry/route.ts`: lädt Policies, prüft Extract-Gate; bei Skip markiert Schritte und ruft den Worker nicht.
- Callback
  - `src/app/api/external/jobs/[jobId]/route.ts`: nutzt Policies für Phase 2, Gate wird nur bei `'do'` berücksichtigt.
- UI
  - `src/components/library/pdf-bulk-import-dialog.tsx`: sendet `options.policies` entsprechend den Checkboxen. Keine Legacy-Flags.
  - `src/components/library/phase-stepper.tsx`: setzt `policies` in den Options; Legacy entfernt.
  - `src/components/library/job-report-tab.tsx`: Anzeige basiert auf `parameters.policies`.

Tests, die du jetzt durchführen solltest
- Batch ohne „Erzwingen“ für Phase 1, mit Phase 2 aktiv:
  - Erwartung: `parameters.policies.extract='do'`; wenn Shadow‑Twin existiert → Extraktion wird übersprungen; Template läuft.
- Batch mit „Erzwingen“ Phase 1:
  - Erwartung: `extract='force'`; Extraktion läuft immer.
- Nur Phase 2 aktiv (`metadata:'do'`, `extract:'ignore'`):
  - Erwartung: keine Secretary‑Extraktion, Template‑Only Pfad.
- Phase 3 aktiv, Rest ignoriert:
  - Erwartung: Extract skip, Template skip, Ingestion-Pfade berücksichtigen Policy.

Status-Update: Alle betroffenen Dateien sind lint-frei. Wenn du magst, ergänze ich noch das Logging im Report, um Policies explizit anzuzeigen.

---

**User**

warum wird hier auf boolean geprüft?

---

**Cursor**

Ich entferne jetzt die veralteten Boolean-Flags im Secretary-Client und sende stattdessen die neuen Policies als JSON im FormData. Danach prüfe ich den Linter für die geänderte Datei.

```typescript
import { 
  TemplateExtractionResponse 
} from './types';

export class SecretaryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretaryServiceError';
  }
}

/**
 * Typ für die Secretary Service Audio Response
 */
export interface SecretaryAudioResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      audio_source: string;
      source_info: {
        original_filename: string;
        file_size: number;
        file_type: string;
        file_ext: string;
      };
      source_language: string;
      target_language: string;
      template: string;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
    metadata?: {
      title: string;
      duration: number;
      format: string;
      channels: number;
      sample_rate: number;
      bit_rate: number;
      process_dir: string;
      chapters: unknown[];
    };
    process_id: string;
    transformation_result: unknown | null;
    status: string;
  };
}

/**
 * Typ für die Secretary Service Video Response
 */
export interface SecretaryVideoResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      source_language: string;
      target_language: string;
      template: string | null;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    metadata: {
      title: string;
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      duration: number;
      duration_formatted: string;
      file_size: number;
      process_dir: string;
      audio_file: string;
      video_id: string | null;
    };
    process_id: string;
    audio_result: unknown | null;
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
  };
}

/**
 * Typ für die Secretary Service PDF Response
 */
export interface SecretaryPdfResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;  // ← Geändert von text_content zu extracted_text
    ocr_text: string | null;
    metadata: {
      file_name: string;
      file_size: number;
      page_count: number;
      format: string;
      process_dir: string;
      image_paths: string[];
      preview_paths: string[];
      preview_zip: string | null;
      text_paths: string[];
      original_text_paths: string[];
      text_contents: Array<{
        page: number;
        content: string;
      }>;
      extraction_method: string;
    };
    process_id: string;
    processed_at: string;
    // Neu: Link statt großer Base64-Blobs
    images_archive_url?: string;
    // Alt (deprecated): verbleibt für Abwärtskompatibilität
    images_archive_data?: string; 
    images_archive_filename?: string; 
    // Neu: Rohdaten der Mistral-OCR-Ausgabe mit Seitenstruktur
    mistral_ocr_raw?: {
      pages: Array<{
        index: number;
        markdown: string;
        images: Array<{
          id: string;
          top_left_x: number;
          top_left_y: number;
          bottom_right_x: number;
          bottom_right_y: number;
          image_base64: string | null;
          image_annotation: string | null;
        }>;
        dimensions: {
          dpi: number;
          height: number;
          width: number;
        };
      }>;
    };
  };
}

/**
 * Transformiert eine Audio-Datei mithilfe des Secretary Services in Text
 * 
 * @param file Die zu transformierende Audio-Datei 
 * @param targetLanguage Die Zielsprache für die Transkription
 * @param libraryId ID der aktiven Bibliothek
 * @param useCache Cache verwenden (Standard: true)
 * @returns Die vollständige Response vom Secretary Service oder nur den Text (für Abwärtskompatibilität)
 */
export async function transformAudio(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  useCache: boolean = true
): Promise<SecretaryAudioResponse | string> {
  try {
    console.log('[secretary/client] transformAudio aufgerufen mit Sprache:', targetLanguage, 'und useCache:', useCache);
    
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('useCache', useCache.toString());
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-audio', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    // Die API Route sollte bereits die vollständige Response vom Secretary Service durchreichen
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Audio-Datei');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Name
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template-Name für die Transformation
 * @returns Den transformierten Text
 */
export async function transformText(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "Besprechung"
): Promise<string> {
  try {
    console.log('[secretary/client] transformText aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Text-Vorschau:', textContent?.substring(0, 100) || 'KEIN TEXT');
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('template', template);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      template: formData.get('template')
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Texttransformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Inhalt
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param templateContent Template-Inhalt für die Transformation
 * @returns Den transformierten Text
 */
export async function transformTextWithTemplate(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  templateContent: string
): Promise<string> {
  try {
    console.log('[secretary/client] transformTextWithTemplate aufgerufen mit Template-Content');
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Template-Content-Länge:', templateContent?.length || 0);
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    if (!templateContent || templateContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Template-Content vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('templateContent', templateContent);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      templateContent: formData.get('templateContent') ? 'vorhanden' : 'fehlt'
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API mit Template-Content');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Template-Content-Transformation erfolgreich');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Template-Content-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes mit Template-Content');
  }
}

/**
 * Erstellt eine Zusammenfassung für einen einzelnen Track
 * 
 * @param trackName Name des Tracks
 * @param targetLanguage Zielsprache für die Zusammenfassung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassung (Standard: "track_eco_social")
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit der Zusammenfassung
 */
export async function createTrackSummary(
  trackName: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createTrackSummary aufgerufen für Track:', trackName, 'und Bibliothek:', libraryId);
    console.log('[secretary/client] Template:', template, 'Sprache:', targetLanguage);
    
    if (!trackName) {
      throw new SecretaryServiceError('Kein Track-Name angegeben');
    }
    
    if (!libraryId) {
      console.warn('[secretary/client] WARNUNG: Keine Bibliotheks-ID angegeben!');
    }
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    const requestBody = {
      template,
      target_language: targetLanguage,
      useCache
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API:', JSON.stringify(requestBody));
    const response = await fetch(`/api/secretary/tracks/${encodeURIComponent(trackName)}/summary`, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify(requestBody)
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('[secretary/client] Antwort-Daten:', JSON.stringify(data).substring(0, 500) + '...');
    
    if (!response.ok) {
      // Detaillierte Fehlermeldung konstruieren
      let errorMsg = `Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`;
      if (data && data.error) {
        errorMsg += ` - ${data.error.code || ''}: ${data.error.message || 'Unbekannter Fehler'}`;
      }
      throw new SecretaryServiceError(errorMsg);
    }

    console.log('[secretary/client] Zusammenfassung erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung der Track-Zusammenfassung:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung der Track-Zusammenfassung');
  }
}

/**
 * Erstellt Zusammenfassungen für alle oder gefilterte Tracks
 * 
 * @param targetLanguage Zielsprache für die Zusammenfassungen
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassungen (Standard: "track_eco_social") 
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit allen Zusammenfassungen
 */
export async function createAllTrackSummaries(
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createAllTrackSummaries aufgerufen');
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API');
    const response = await fetch('/api/secretary/tracks/*/summarize_all', {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify({
        template,
        target_language: targetLanguage,
        useCache
      })
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Alle Zusammenfassungen erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung aller Track-Zusammenfassungen:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung aller Track-Zusammenfassungen');
  }
}

/**
 * Transformiert eine Video-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Video-Datei 
 * @param options Optionen für die Video-Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformVideo(
  file: File, 
  options: {
    extractAudio?: boolean;
    extractFrames?: boolean;
    frameInterval?: number;
    targetLanguage?: string;
    sourceLanguage?: string;
    template?: string;
  },
  libraryId: string
): Promise<SecretaryVideoResponse> {
  try {
    console.log('[secretary/client] transformVideo aufgerufen mit Optionen:', options);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Sprachoptionen
    if (options.targetLanguage) {
      formData.append('targetLanguage', options.targetLanguage);
    }
    
    if (options.sourceLanguage) {
      formData.append('sourceLanguage', options.sourceLanguage);
    }
    
    // Template-Option
    if (options.template) {
      formData.append('template', options.template);
    }
    
    // Video-spezifische Optionen
    if (options.extractAudio !== undefined) {
      formData.append('extractAudio', options.extractAudio.toString());
    }
    
    if (options.extractFrames !== undefined) {
      formData.append('extractFrames', options.extractFrames.toString());
    }
    
    if (options.frameInterval !== undefined) {
      formData.append('frameInterval', options.frameInterval.toString());
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-video', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Video-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryVideoResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Video-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Video-Datei');
  }
}

/**
 * Transformiert eine PDF-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende PDF-Datei 
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Optionales Template für die Verarbeitung
 * @param extractionMethod Die Extraktionsmethode (native, ocr, both, preview, preview_and_native, llm, llm_and_ocr)
 * @param useCache Ob Cache verwendet werden soll
 * @param includeImages Ob Bilder mit extrahiert werden sollen
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformPdf(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  template?: string,
  extractionMethod: string = 'native',
  useCache: boolean = true,
  includeImages: boolean = false,
  skipTemplate?: boolean,
  context?: { originalItemId?: string; parentId?: string; originalFileName?: string; policies?: import('@/lib/processing/phase-policy').PhasePolicies }
): Promise<SecretaryPdfResponse> {
  try {
    console.log('[secretary/client] transformPdf aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    // OneDrive Token-Sync: Wenn der Client Tokens im localStorage hat, stelle sicher,
    // dass der Server (DB) vor dem Jobstart aktuelle Tokens hat, damit Gates/Webhook funktionieren.
    await (async () => {
      try {
        const key = `onedrive_tokens_${libraryId}`;
        const json = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (!json) return;
        const tokens = JSON.parse(json) as { accessToken: string; refreshToken: string; expiry: number };
        const now = Date.now();
        const bufferMs = 120_000; // 2 Minuten Buffer
        let accessToken = tokens.accessToken;
        let refreshToken = tokens.refreshToken;
        let expiryMs = Number(tokens.expiry);

        // Falls abgelaufen oder kurz davor: Refresh über Serverroute
        if (!expiryMs || expiryMs - now <= bufferMs) {
          const resp = await fetch('/api/auth/onedrive/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ libraryId, refreshToken })
          });
          if (resp.ok) {
            const data = await resp.json();
            accessToken = data.accessToken;
            refreshToken = data.refreshToken || refreshToken;
            // Server liefert expiresIn in Sekunden
            expiryMs = now + (Number(data.expiresIn || 0) * 1000);
            // Update localStorage
            localStorage.setItem(key, JSON.stringify({ accessToken, refreshToken, expiry: expiryMs }));
          }
        }

        // Persistiere Tokens in DB (Server), damit Webhook/Server‑Gates Zugriff haben
        await fetch(`/api/libraries/${libraryId}/tokens`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken, tokenExpiry: Math.floor(expiryMs / 1000).toString() })
        });
      } catch {}
    })();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extractionMethod', extractionMethod);
    formData.append('useCache', useCache.toString());
    formData.append('includeImages', includeImages.toString());
    // Policies als JSON übergeben (neues Format)
    if (context?.policies) {
      formData.append('policies', JSON.stringify(context.policies));
    }
    
    // Template-Option
    if (template) {
      formData.append('template', template);
    }
    // Kontext-Informationen für zielgenaues Speichern
    if (context?.originalItemId) {
      formData.append('originalItemId', context.originalItemId);
    }
    if (context?.parentId) {
      formData.append('parentId', context.parentId);
    }
    if (context?.originalFileName) {
      formData.append('originalFileName', context.originalFileName);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-pdf', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] PDF-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryPdfResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der PDF-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der PDF-Datei');
  }
}

/**
 * Interface für Image-OCR-Response
 */
export interface SecretaryImageResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;
    metadata: {
      file_name: string;
      file_size: number;
      dimensions: string;
      format: string;
      color_mode: string;
      dpi: number[];
      process_dir: string;
      extraction_method: string;
      preview_paths: string[];
    };
    process_id: string;
    processed_at: string;
    status: string;
  };
}

/**
 * Interface für Session-Import-Response
 */
export interface SessionImportResponse {
  status: string;
  data: {
    session: string;
    filename: string;
    track: string;
    video_url: string;
    attachments_url?: string;
    event: string;
    url: string;
    day: string;
    starttime: string;
    endtime: string;
    speakers: string[];
    source_language: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Transformiert ein Bild mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Bilddatei
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param extractionMethod Die Extraktionsmethode (ocr, llm, llm_and_ocr, native, both, preview, preview_and_native)
 * @param context Optionaler JSON-Kontext für LLM-Optimierung
 * @param useCache Ob Cache verwendet werden soll
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformImage(
  file: File,
  targetLanguage: string,
  libraryId: string,
  extractionMethod: string = 'ocr',
  context?: string,
  useCache: boolean = true
): Promise<SecretaryImageResponse> {
  try {
    console.log('[secretary/client] transformImage aufgerufen mit Sprache:', targetLanguage, 'und Methode:', extractionMethod);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extraction_method', extractionMethod);
    formData.append('useCache', useCache.toString());
    
    // Context-Option
    if (context) {
      formData.append('context', context);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-image', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Bild-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryImageResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Bild-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Bilddatei');
  }
}

/**
 * Importiert Session-Daten aus einer Website-URL mithilfe des Secretary Services
 * 
 * @param url Die zu analysierende Website-URL
 * @param options Optionen für die Session-Extraktion
 * @returns Die extrahierten Session-Daten
 */
export async function importSessionFromUrl(
  url: string,
  options: {
    sourceLanguage?: string;
    targetLanguage?: string;
    template?: string;
    useCache?: boolean;
  } = {}
): Promise<TemplateExtractionResponse> {
  try {
    console.log('[secretary/client] importSessionFromUrl aufgerufen mit URL:', url);
    
    const response = await fetch('/api/secretary/import-from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        source_language: options.sourceLanguage || 'en',
        target_language: options.targetLanguage || 'en',
        template: options.template || 'ExtractSessionDataFromWebsite',
        use_cache: options.useCache ?? false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new SecretaryServiceError(
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: TemplateExtractionResponse = await response.json();
    console.log('[secretary/client] Session-Import erfolgreich:', data);
    
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler beim Session-Import:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError(
      error instanceof Error ? error.message : 'Unbekannter Fehler beim Session-Import'
    );
  }
} 
```

- Du hast recht: die Boolean-Prüfungen sind nach der Policy‑Umstellung obsolet.
- Ich habe sie in `src/lib/secretary/client.ts` entfernt und stattdessen `policies` als JSON im FormData eingeführt.

Kurztest-Hinweis:
- Single- und Batch‑Flows senden jetzt `policies`. Auf dem Server werden diese direkt genutzt.

---

**User**

Error: ./src/app/api/external/jobs/[jobId]/retry/route.ts:9:1
[31m[1mModule not found[22m[39m: Can't resolve '[32m@/lib/library/library-service[39m'
[0m [90m  7 |[39m [36mimport[39m { gateExtractPdf } [36mfrom[39m [32m'@/lib/processing/gates'[39m[33m;[39m[0m
[0m [90m  8 |[39m [36mimport[39m { getPolicies[33m,[39m shouldRunExtract[33m,[39m shouldRunWithGate } [36mfrom[39m [32m'@/lib/processing/phase-policy'[39m[33m;[39m[0m
[0m[31m[1m>[22m[39m[90m  9 |[39m [36mimport[39m { [33mLibraryService[39m } [36mfrom[39m [32m'@/lib/library/library-service'[39m[33m;[39m[0m
[0m [90m    |[39m [31m[1m^[22m[39m[0m
[0m [90m 10 |[39m [36mimport[39m { getServerProvider } [36mfrom[39m [32m'@/lib/storage/server-provider'[39m[33m;[39m[0m
[0m [90m 11 |[39m[0m
[0m [90m 12 |[39m [36mexport[39m [36masync[39m [36mfunction[39m [33mPOST[39m([0m

https://nextjs.org/docs/messages/module-not-found
    at BuildError (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/next@15.3.2_react-dom@18.2.0_react@18.2.0__react@18.2.0/node_modules/next/dist/client/components/react-dev-overlay/ui/container/build-error.js:43:41)
    at renderWithHooks (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:16305:18)
    at updateFunctionComponent (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:19583:20)
    at beginWork (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:21596:16)
    at beginWork$1 (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:27421:14)
    at performUnitOfWork (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:26552:12)
    at workLoopSync (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:26461:5)
    at renderRootSync (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:26429:7)
    at performConcurrentWorkOnRoot (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/react-dom@18.2.0_react@18.2.0/node_modules/react-dom/cjs/react-dom.development.js:25733:74)
    at workLoop (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.development.js:266:34)
    at flushWork (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.development.js:239:14)
    at MessagePort.performWorkUntilDeadline (webpack-internal:///(pages-dir-browser)/./node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler/cjs/scheduler.development.js:533:21)
??

---

**Cursor**

Ich korrigiere die fehlerhafte Import-Pfadangabe in der Retry-Route auf den bestehenden Service-Pfad und prüfe anschließend schnell auf Linterfehler.

```typescript
*** Begin Patch
*** Update File: src/app/api/external/jobs/[jobId]/retry/route.ts
@@
-import {  LibraryService } from '@/lib/library/library-service';
+import {  LibraryService } from '@/lib/services/library-service';
*** End Patch
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateExtractPdf } from '@/lib/processing/gates';
import { getPolicies, shouldRunExtract, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { LibraryService } from '@/lib/services/library-service';
import { getServerProvider } from '@/lib/storage/server-provider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const filename = source.name || 'document.pdf';
    const file = new File([bin.blob], filename, { type: source.mimeType || bin.mimeType || 'application/pdf' });

    // Secretary-FormData aufbauen (wie in process-pdf für den Worker-Call)
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);
    const opts = (job.correlation?.options || {}) as Record<string, unknown>;
    serviceFormData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de');
    serviceFormData.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native');
    serviceFormData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true));
    serviceFormData.append('includeImages', String(typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false));

    // Callback-URL und -Token (neues Secret generieren)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 });
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
    const newSecret = crypto.randomBytes(24).toString('base64url');
    const newHash = repo.hashSecret(newSecret);
    // Job zurücksetzen
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Policies laden
    const policies = getPolicies({ parameters: job.parameters || {} });

    // Optional: Extract-Gate prüfen und ggf. lokal Template‑Only fahren
    try {
      const libraryService = LibraryService.getInstance();
      const libraries = await libraryService.getUserLibraries(userEmail);
      const lib = libraries.find(l => l.id === libraryId);
      const g = await gateExtractPdf({ repo, jobId, userEmail, library: lib, source, options: { targetLanguage: String(serviceFormData.get('target_language') || 'de') } });
      const runExtract = shouldRunExtract(g.exists, policies.extract);
      if (!runExtract) {
        // Phase 1 überspringen → Schritte markieren und sofort success zurückgeben
        await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.exists ? (g.reason || 'artifact_exists') : 'policy_ignore' } });
        // Phase 2 je Policy behandeln: Bei 'ignore' skippen, sonst im Callback ausgeführt werden lassen
        if (policies.metadata === 'ignore') {
          await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
          await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        // Ingestion-Policy nur markieren; tatsächliche Ingestion erfolgt im Callback-Pfad
        if (policies.ingest === 'ignore') {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);
        return NextResponse.json({ ok: true, jobId, worker: 'secretary', skipped: { extract: true } });
      }
    } catch {
      // Falls Gate fehlschlägt, wird normal extrahiert
    }

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
      if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
      response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

- Der Build-Fehler kommt vom falschen Importpfad. In der Retry-Route wurde `@/lib/library/library-service` verwendet; korrekt ist `@/lib/services/library-service`.
- Ich habe den Import in `src/app/api/external/jobs/[jobId]/retry/route.ts` angepasst. Linter ist sauber.

Kurz: Bitte neu bauen/neu laden; der Fehler sollte weg sein.

---

**User**

OK, wenn ich das konfiguriere. wird das in datenbank gespeichert:
Habe auch den Jobworker manuel gestartet. Jobs werden aber nicht abgearbeitet. 

{
  "_id": {
    "$oid": "68d1133f1ea3c5b4b5788cd1"
  },
  "jobId": "b6d48088-aafd-4620-a0b4-92cbd84dcfd7",
  "jobSecretHash": "6a7b6a7fb3cdc8d84aa3529cb47121090c6ca687cefcafc910b9bc6c10428f1d",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "queued",
  "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "b6d48088-aafd-4620-a0b4-92cbd84dcfd7",
    "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "Hellrigl_2010_Pflanzengallen&Gallenkunde-PlantGalls&Cecidology_ForestObserver_5_p.pdf",
      "itemId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDEwL0hlbGxyaWdsXzIwMTBfUGZsYW56ZW5nYWxsZW4mR2FsbGVua3VuZGUtUGxhbnRHYWxscyZDZWNpZG9sb2d5X0ZvcmVzdE9ic2VydmVyXzVfcC5wZGY=",
      "parentId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDEw"
    },
    "options": {
      "targetLanguage": "de",
      "extractionMethod": "mistral_ocr",
      "includeImages": false,
      "useCache": true
    },
    "batchId": "6f55b27e-56f6-4c80-8519-29ecf471e564",
    "batchName": "Fachart/ZeitschrBZ/Forest Observer/2010"
  },
  "createdAt": {
    "$date": "2025-09-22T09:13:35.562Z"
  },
  "updatedAt": {
    "$date": "2025-09-22T09:13:38.037Z"
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "shadow_twin_exists"
      },
      "endedAt": {
        "$date": "2025-09-22T09:13:38.004Z"
      }
    },
    {
      "name": "transform_template",
      "status": "pending"
    },
    {
      "name": "store_shadow_twin",
      "status": "pending"
    },
    {
      "name": "ingest_rag",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "policy_ignore"
      },
      "endedAt": {
        "$date": "2025-09-22T09:13:38.037Z"
      }
    }
  ],
  "parameters": {
    "targetLanguage": "de",
    "extractionMethod": "mistral_ocr",
    "includeImages": false,
    "useCache": true,
    "template": "pdfanalyse",
    "policies": {
      "extract": "do",
      "metadata": "force",
      "ingest": "ignore"
    },
    "batchId": "6f55b27e-56f6-4c80-8519-29ecf471e564",
    "batchName": "Fachart/ZeitschrBZ/Forest Observer/2010"
  },
  "logs": [
    {
      "timestamp": {
        "$date": "2025-09-22T09:13:37.787Z"
      },
      "phase": "request_sent_requeue",
      "callbackUrl": "http://localhost:3000/api/external/jobs/b6d48088-aafd-4620-a0b4-92cbd84dcfd7"
    }
  ]
}

---

**Cursor**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';
import { gateExtractPdf } from '@/lib/processing/gates';
import { getPolicies, shouldRunExtract, shouldRunWithGate } from '@/lib/processing/phase-policy';
import { LibraryService } from '@/lib/services/library-service';
import { getServerProvider } from '@/lib/storage/server-provider';
import { TransformService } from '@/lib/transform/transform-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const filename = source.name || 'document.pdf';
    const file = new File([bin.blob], filename, { type: source.mimeType || bin.mimeType || 'application/pdf' });

    // Secretary-FormData aufbauen (wie in process-pdf für den Worker-Call)
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);
    const opts = (job.correlation?.options || {}) as Record<string, unknown>;
    serviceFormData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de');
    serviceFormData.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native');
    serviceFormData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true));
    serviceFormData.append('includeImages', String(typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false));

    // Callback-URL und -Token (neues Secret generieren)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 });
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
    const newSecret = crypto.randomBytes(24).toString('base64url');
    const newHash = repo.hashSecret(newSecret);
    // Job zurücksetzen
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Policies laden
    const policies = getPolicies({ parameters: job.parameters || {} });

    // Optional: Extract-Gate prüfen und ggf. lokal Template‑Only fahren
    try {
      const libraryService = LibraryService.getInstance();
      const libraries = await libraryService.getUserLibraries(userEmail);
      const lib = libraries.find(l => l.id === libraryId);
      const g = await gateExtractPdf({ repo, jobId, userEmail, library: lib, source, options: { targetLanguage: String(serviceFormData.get('target_language') || 'de') } });
      const runExtract = shouldRunExtract(g.exists, policies.extract);
      if (!runExtract) {
        // Phase 1 überspringen → Schritte markieren
        await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: g.exists ? (g.reason || 'artifact_exists') : 'policy_ignore' } });

        // Template-Only Pfad ausführen, falls Policy es verlangt
        if (policies.metadata !== 'ignore') {
          await repo.updateStep(jobId, 'transform_template', { status: 'running', startedAt: new Date() });
          try {
            // Template bestimmen
            const libraries = await LibraryService.getInstance().getUserLibraries(userEmail);
            const lib = libraries.find(l => l.id === libraryId);
            const rootItems = await provider.listItemsById('root');
            const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates');
            const ensureTemplatesFolderId = async (): Promise<string> => {
              if (templatesFolder) return (templatesFolder as { id: string }).id;
              const created = await provider.createFolder('root', 'templates');
              return created.id;
            };
            const templatesFolderId = await ensureTemplatesFolderId();
            let chosen: { id: string } | undefined;
            if (templatesFolderId) {
              const tplItems = await provider.listItemsById(templatesFolderId);
              const preferredTemplate = ((lib?.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || 'pdfanalyse').trim();
              const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase());
              chosen = pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`) || pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file') as { id: string } | undefined;
            }
            let templateContent = '# {{title}}\n';
            if (chosen) {
              const binTpl = await provider.getBinary(chosen.id);
              templateContent = await binTpl.blob.text();
            }

            // Shadow‑Twin finden und laden
            const siblings = await provider.listItemsById(source.parentId);
            const targetLanguage = String(serviceFormData.get('target_language') || 'de');
            const base = (source.name || 'output').replace(/\.[^/.]+$/, '');
            const expectedName = `${base}.${targetLanguage}.md`;
            const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === expectedName) as { id: string } | undefined;
            if (!twin) throw new Error('Shadow‑Twin nicht gefunden');
            const twinBin = await provider.getBinary(twin.id);
            const originalMarkdown = await twinBin.blob.text();
            const stripped = originalMarkdown.replace(/^---[\s\S]*?---\s*/m, '');

            // Template-Transform aufrufen
            const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
            const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
            const fd = new FormData();
            fd.append('text', stripped);
            fd.append('target_language', targetLanguage);
            fd.append('template_content', templateContent);
            fd.append('use_cache', 'false');
            const headers: Record<string, string> = { 'Accept': 'application/json' };
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
            const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
            const data: unknown = await resp.json().catch(() => ({}));
            const mdMeta = (data && typeof data === 'object' && !Array.isArray(data)) ? ((data as { data?: { structured_data?: Record<string, unknown> } }).data?.structured_data || {}) : {};

            await repo.appendMeta(jobId, mdMeta as Record<string, unknown>, 'template_transform');
            await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date() });

            // Markdown mit neuem Frontmatter erzeugen und als neue Datei speichern
            const ssotFlat: Record<string, unknown> = {
              job_id: jobId,
              source_file: source.name || 'document.pdf',
              extract_status: 'completed',
              template_status: 'completed',
              ingest_status: policies.ingest !== 'ignore' ? 'pending' : 'none',
              summary_language: targetLanguage,
            };
            const mergedMeta = { ...(mdMeta as Record<string, unknown>), ...ssotFlat } as Record<string, unknown>;
            const newMarkdown = TransformService.createMarkdownWithFrontmatter(stripped, mergedMeta);
            await repo.updateStep(jobId, 'store_shadow_twin', { status: 'running', startedAt: new Date() });
            const outFile = new File([new Blob([newMarkdown], { type: 'text/markdown' })], expectedName, { type: 'text/markdown' });
            await provider.uploadFile(source.parentId, outFile);
            await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date() });
          } catch (err) {
            await repo.updateStep(jobId, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: err instanceof Error ? err.message : String(err) } });
            await repo.setStatus(jobId, 'failed');
            return NextResponse.json({ error: 'template_only_failed' }, { status: 500 });
          }
        } else {
          await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
          await repo.updateStep(jobId, 'store_shadow_twin', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        if (policies.ingest === 'ignore') {
          await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'policy_ignore' } });
        }
        await repo.setStatus(jobId, 'completed');
        return NextResponse.json({ ok: true, jobId, worker: 'secretary', skipped: { extract: true }, mode: 'template_only' });
      }
    } catch {
      // Falls Gate fehlschlägt, wird normal extrahiert
    }

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
      if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
      response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

- Dein gespeicherter Job zeigt: extract skipped (shadow_twin_exists), metadata=force, ingest=ignore. Danach bleibt der Job auf queued stehen, weil die Retry‑Route bei „extract skip“ bisher nichts mehr gestartet hat. Ich habe die Retry‑Route erweitert: Wenn `extract` nicht laufen soll, wird nun der Template‑Only Pfad serverseitig ausgeführt und die Schritte korrekt aktualisiert; der Job wird anschließend auf completed gesetzt.

Was ich geändert habe
- `src/app/api/external/jobs/[jobId]/retry/route.ts`:
  - Korrigierter Import `LibraryService`.
  - Bei `runExtract === false`: 
    - markiere `extract_pdf` als completed/skipped,
    - wenn `metadata !== 'ignore'`: führe Template‑Transform direkt aus (Template ermitteln, Shadow‑Twin laden, Transformer callen, Frontmatter mergen, Datei speichern), Steps `transform_template` und `store_shadow_twin` auf completed,
    - `ingest_rag` bei `ingest === 'ignore'` skippen,
    - setze Jobstatus auf completed und gebe JSON zurück.
- Keine Änderungen mehr in Policies oder Batch nötig; der gespeicherte Job mit `policies: { extract:'do', metadata:'force', ingest:'ignore' }` wird nun abgearbeitet, ohne Phase 1 erneut anzustoßen.

Bitte erneut einen Batch starten oder die Retry‑Batch Route aufrufen. Erwartetes Verhalten:
- Jobs mit vorhandenem Shadow‑Twin: Phase 1 skipped, Template läuft und speichert, Job wird completed.

---

**User**

In der Markdownansicht werden manchmalpdf binaries geladen. Das ist gefährlich - Browser reagiert nicht mehr - wie kann das passieren? Wie können wir das verhindern?

---

**Cursor**

Ich suche jetzt, wo die Markdown-Vorschau gerendert wird und wie Inhalte geladen werden, um zu verstehen, warum PDF-Binärdaten angezeigt werden. Danach plane ich Sanitizing/Guards einzubauen.

Kurz: PDF‑Binärdaten landen in der Markdown‑Ansicht, wenn wir versehentlich Binärdateien als Text laden/rendern. Das kann den Browser einfrieren.

Wahrscheinliche Ursache
- In `FilePreview` lädt `ContentLoader` Text mit `provider.getBinary(...).blob.text()` für alle Dateitypen, die nicht als binary erkannt werden.
- Die Binary-Erkennung hängt an `getFileType(name)` (Dateiendung) und der `binaryFileTypes`‑Liste. Wenn die Endung fehlt/falsch ist oder ein Shadow‑Twin temporär eine .pdf‑Signatur enthält, greift der Textpfad und wir pumpen Binärdaten in `MarkdownPreview`.

Konkrete Stellen
```86:106:src/components/library/file-preview.tsx
const binaryFileTypes = ['audio','image','video','pdf','docx','pptx','xlsx'];
if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
  const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
```
- Bei `fileType === 'unknown'` laden wir nichts. Bei falsch erkanntem Typ wird aber geladen.
- In `JobReportTab` wird Markdown nur explizit aus `.md` geladen und ist unkritisch.

Gegenmaßnahmen (präventiv und robust)
- Strengere Binärprüfung: zusätzlich den MIME‑Type des Blobs prüfen (z. B. `application/pdf`, `application/octet-stream`) und bei Nicht‑text stoppen.
- Safe‑Guard gegen PDF‑Header: wenn der Anfang des Textes nach `%PDF` aussieht, nicht rendern.
- Größenlimit: Text‑Load nur bis z. B. 2 MB; darüber abbrechen und Hinweis zeigen.
- Whitelist statt Blacklist: Nur `.md`, `.txt` und ausgewählte Text‑Endungen als Text laden; alles andere nie als Text.

Empfohlene Minimaländerungen
- In `ContentLoader` vor `blob.text()` prüfen:
  - `mimeType` vom Provider
  - Header‑Bytes auf `%PDF-` und andere Magic Numbers
  - Größenlimit
- Fallback: Anzeige einer Warn‑Markdown statt des Inhalts.

Beispiel-Gate (präzise Einfügung in `ContentLoader` vor blob.text()):
```ts
const { blob, mimeType } = await provider.getBinary(item.id);
// 1) MIME-Check: lade nur text/*
const isTextMime = /^text\\//i.test(mimeType) || mimeType === 'application/json' || mimeType === 'application/xml' || mimeType === 'application/yaml';
if (!isTextMime) {
  contentCache.current.set(item.id, { content: '---\\nstatus: binary\\n---\\n\\n> Diese Datei ist binär und wird nicht als Text dargestellt.', hasMetadata: true });
  onContentLoaded('---\\nstatus: binary\\n---\\n\\n> Diese Datei ist binär und wird nicht als Text dargestellt.', true);
  return;
}
// 2) Größenlimit
if (blob.size > 2 * 1024 * 1024) {
  contentCache.current.set(item.id, { content: '---\\nstatus: too_large\\n---\\n\\n> Die Datei ist zu groß für die Text-Vorschau (>2MB).', hasMetadata: true });
  onContentLoaded('---\\nstatus: too_large\\n---\\n\\n> Die Datei ist zu groß für die Text-Vorschau (>2MB).', true);
  return;
}
// 3) Header-Guard (PDF/Magic Numbers)
const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
const headStr = String.fromCharCode(...head);
if (/%PDF-/.test(headStr)) {
  contentCache.current.set(item.id, { content: '---\\nstatus: pdf_binary\\n---\\n\\n> PDF-Inhalt erkannt. Bitte den PDF-Viewer verwenden.', hasMetadata: true });
  onContentLoaded('---\\nstatus: pdf_binary\\n---\\n\\n> PDF-Inhalt erkannt. Bitte den PDF-Viewer verwenden.', true);
  return;
}
const content = await blob.text();
```

Zusätzlich sinnvoll
- Whitelist der Text-Endungen: Ersetze in `getFileType` Default‑Heuristik durch eine kleine Whitelist (`['md','mdx','txt','json','yaml','yml','csv','xml','html','css','js','ts']`). Alles andere → `unknown`.
- In `MarkdownPreview` ein hartes Render-Limit: wenn `content.length > 1_000_000`, render nur Hinweis.

Wenn du möchtest, setze ich die Guards jetzt in `file-preview.tsx` um und erhöhe die Sicherheit der Markdown‑Vorschau.

```typescriptreact
const binaryFileTypes = ['audio','image','video','pdf','docx','pptx','xlsx'];
if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
  const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
```

```typescript
const { blob, mimeType } = await provider.getBinary(item.id);
// 1) MIME-Check: lade nur text/*
const isTextMime = /^text\\//i.test(mimeType) || mimeType === 'application/json' || mimeType === 'application/xml' || mimeType === 'application/yaml';
if (!isTextMime) {
  contentCache.current.set(item.id, { content: '---\\nstatus: binary\\n---\\n\\n> Diese Datei ist binär und wird nicht als Text dargestellt.', hasMetadata: true });
  onContentLoaded('---\\nstatus: binary\\n---\\n\\n> Diese Datei ist binär und wird nicht als Text dargestellt.', true);
  return;
}
// 2) Größenlimit
if (blob.size > 2 * 1024 * 1024) {
  contentCache.current.set(item.id, { content: '---\\nstatus: too_large\\n---\\n\\n> Die Datei ist zu groß für die Text-Vorschau (>2MB).', hasMetadata: true });
  onContentLoaded('---\\nstatus: too_large\\n---\\n\\n> Die Datei ist zu groß für die Text-Vorschau (>2MB).', true);
  return;
}
// 3) Header-Guard (PDF/Magic Numbers)
const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
const headStr = String.fromCharCode(...head);
if (/%PDF-/.test(headStr)) {
  contentCache.current.set(item.id, { content: '---\\nstatus: pdf_binary\\n---\\n\\n> PDF-Inhalt erkannt. Bitte den PDF-Viewer verwenden.', hasMetadata: true });
  onContentLoaded('---\\nstatus: pdf_binary\\n---\\n\\n> PDF-Inhalt erkannt. Bitte den PDF-Viewer verwenden.', true);
  return;
}
const content = await blob.text();
```

---

**User**

Ich habe versucht ein PDF "Metadaten" per template neu zu berechnen - "erzwingen" aktiviert.
Es passiert aber nichts - Hier der generierte Job:
{
  "_id": {
    "$oid": "68d118451ea3c5b4b5788cdc"
  },
  "jobId": "f6e305fc-28bb-43f8-b45e-d9f6f0fa4198",
  "jobSecretHash": "785b2800e026114f15f548fe9ad223e6ea7a47ac031c4920d2873917c0f92930",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "completed",
  "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "f6e305fc-28bb-43f8-b45e-d9f6f0fa4198",
    "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "Hellrigl_2008_FaunistikDerGallwespenVonSüdtirol-Trentino_ForestObserver_4_p.pdf",
      "itemId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4L0hlbGxyaWdsXzIwMDhfRmF1bmlzdGlrRGVyR2FsbHdlc3BlblZvblPDvGR0aXJvbC1UcmVudGlub19Gb3Jlc3RPYnNlcnZlcl80X3AucGRm",
      "parentId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4"
    },
    "options": {
      "targetLanguage": "de",
      "extractionMethod": "mistral_ocr",
      "includeImages": false,
      "useCache": true
    },
    "batchId": null,
    "batchName": null
  },
  "createdAt": {
    "$date": "2025-09-22T09:35:01.969Z"
  },
  "updatedAt": {
    "$date": "2025-09-22T09:35:02.355Z"
  },
  "parameters": {
    "targetLanguage": "de",
    "extractionMethod": "mistral_ocr",
    "includeImages": false,
    "useCache": true,
    "template": "pdfanalyse",
    "phases": {
      "extract": true,
      "template": false,
      "ingest": false
    },
    "policies": {
      "extract": "do",
      "metadata": "ignore",
      "ingest": "ignore"
    }
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "shadow_twin_exists"
      },
      "endedAt": {
        "$date": "2025-09-22T09:35:02.209Z"
      }
    },
    {
      "name": "transform_template",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "artifact_exists"
      },
      "endedAt": {
        "$date": "2025-09-22T09:35:02.240Z"
      }
    },
    {
      "name": "store_shadow_twin",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "artifact_exists"
      },
      "endedAt": {
        "$date": "2025-09-22T09:35:02.269Z"
      }
    },
    {
      "name": "ingest_rag",
      "status": "completed",
      "details": {
        "skipped": true
      },
      "endedAt": {
        "$date": "2025-09-22T09:35:02.297Z"
      }
    }
  ],
  "logs": [
    {
      "timestamp": {
        "$date": "2025-09-22T09:35:02.032Z"
      },
      "phase": "request_sent",
      "sourcePath": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4L0hlbGxyaWdsXzIwMDhfRmF1bmlzdGlrRGVyR2FsbHdlc3BlblZvblPDvGR0aXJvbC1UcmVudGlub19Gb3Jlc3RPYnNlcnZlcl80X3AucGRm",
      "targetParentId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4",
      "callbackUrl": "http://localhost:3000/api/external/jobs/f6e305fc-28bb-43f8-b45e-d9f6f0fa4198"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:35:02.325Z"
      },
      "phase": "completed",
      "message": "Job abgeschlossen (extract skipped: artifact_exists)"
    }
  ]
}


---

**Cursor**

```typescript
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { transformAudio, transformText, transformVideo, transformPdf, transformImage, SecretaryAudioResponse, SecretaryVideoResponse, SecretaryPdfResponse, SecretaryImageResponse } from "@/lib/secretary/client";
import { ImageExtractionService, ImageExtractionResult } from "./image-extraction-service";
import { FileLogger } from '@/lib/debug/logger';

export interface TransformSaveOptions {
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
  useCache?: boolean; // Neu: Cache-Option für alle Transformationen
  includeImages?: boolean; // Neu: Bilder mit extrahieren und speichern
  useIngestionPipeline?: boolean; // Neu: Auto-RAG nach Speicherung
}

export interface PdfTransformOptions extends TransformSaveOptions {
  extractionMethod: string;
  template?: string;
  skipTemplate?: boolean; // Phase 1: nur Extraktion
  // Policies steuern die Phasen klar typisiert
  policies?: import('@/lib/processing/phase-policy').PhasePolicies;
}

export interface TransformResult {
  text: string;
  savedItem?: StorageItem;
  updatedItems: StorageItem[];
  imageExtractionResult?: ImageExtractionResult; // Neu: Ergebnis der Bild-Extraktion
  jobId?: string;
}

export interface VideoTransformOptions extends TransformSaveOptions {
  extractAudio: boolean;
  extractFrames: boolean;
  frameInterval: number;
  sourceLanguage?: string;
  template?: string;
}

export interface ImageTransformOptions extends TransformSaveOptions {
  extractionMethod: string;
  context?: string;
}

/**
 * Typ für die Metadaten, die im Frontmatter gespeichert werden
 */
interface TransformMetadata {
  // Quelldatei-Informationen
  source_file?: string;
  source_file_id?: string;
  source_file_size?: number;
  source_file_type?: string;
  
  // Transformations-Informationen
  source_language?: string;
  target_language?: string;
  
  // Audio-Metadaten
  audio_duration?: number;
  audio_format?: string;
  audio_channels?: number;
  audio_sample_rate?: number;
  audio_bit_rate?: number;
  
  // Prozess-Informationen
  process_id?: string;
  processor?: string;
  processing_duration_ms?: number;
  model_used?: string;
  tokens_used?: number;
  
  // Secretary Service Informationen
  cache_used?: boolean;
  cache_key?: string;
  
  // Weitere Felder können hinzugefügt werden
  [key: string]: string | number | boolean | undefined;
}

/**
 * TransformService - Zentraler Service für Transformations- und Speicheroperationen
 * Verantwortlich für:
 * - Transformation von Audio zu Text
 * - Transformation von Text zu optimiertem Text
 * - Speichern der Ergebnisse als Shadow-Twin oder als neue Datei
 * - Aktualisieren der Dateiliste
 * - Bereitstellen einer einheitlichen Schnittstelle für alle Transformationstypen
 */
export class TransformService {
  /**
   * Generiert einen standardisierten Namen für einen Shadow-Twin
   * @param originalName Der ursprüngliche Dateiname
   * @param targetLanguage Die Zielsprache
   * @returns Der generierte Shadow-Twin-Name ohne Dateiendung
   */
  static generateShadowTwinName(originalName: string, targetLanguage: string): string {
    // Entferne alle Dateiendungen aus dem Namen
    const nameWithoutExtension = originalName.split('.').slice(0, -1).join('.');
    return `${nameWithoutExtension}.${targetLanguage}`;
  }

  /**
   * Transformiert eine Audio-Datei in Text
   * @param file Die zu transformierende Audio-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Speicheroptionen
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformAudio(
    file: File,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    // Audio-Datei wird transformiert - hole die vollständige Response
    const response = await transformAudio(file, options.targetLanguage, libraryId);
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    if (typeof response === 'string') {
      // Falls die Response nur ein String ist (alte API)
      transformedText = response;
    } else if (response && 'data' in response && response.data && response.data.transcription) {
      // Neue API mit vollständigen Metadaten
      const audioResponse = response as SecretaryAudioResponse;
      transformedText = audioResponse.data.transcription.text;
      
      // Sammle relevante Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        source_language: audioResponse.data.transcription.source_language || options.targetLanguage,
        target_language: options.targetLanguage,
        
        // Audio-Metadaten (falls vorhanden)
        audio_duration: audioResponse.data.metadata?.duration,
        audio_format: audioResponse.data.metadata?.format,
        audio_channels: audioResponse.data.metadata?.channels,
        audio_sample_rate: audioResponse.data.metadata?.sample_rate,
        audio_bit_rate: audioResponse.data.metadata?.bit_rate,
        
        // Prozess-Informationen
        process_id: audioResponse.process?.id,
        processor: audioResponse.process?.main_processor,
        processing_duration_ms: audioResponse.process?.llm_info?.total_duration,
        model_used: audioResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: audioResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: audioResponse.process?.is_from_cache || false,
        cache_key: audioResponse.process?.cache_key
      };
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    }
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const shadowTwinName = TransformService.generateShadowTwinName(originalItem.metadata.name, options.targetLanguage);
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        shadowTwinName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert eine Video-Datei
   * @param file Die zu transformierende Video-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Optionen für Video-Transformation und Speicherung
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis inklusive Video-spezifischer Daten
   */
  static async transformVideo(
    file: File,
    originalItem: StorageItem,
    options: VideoTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    console.log('[TransformService] transformVideo gestartet mit Optionen:', options);
    
    // Video-Datei wird transformiert - hole die vollständige Response
    const response = await transformVideo(
      file, 
      {
        extractAudio: options.extractAudio,
        extractFrames: options.extractFrames,
        frameInterval: options.frameInterval,
        targetLanguage: options.targetLanguage,
        sourceLanguage: options.sourceLanguage || 'auto',
        template: options.template
      }, 
      libraryId
    );
    
    console.log('[TransformService] Vollständige Video-Response:', JSON.stringify(response, null, 2));
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    console.log('[TransformService] Response-Check:', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasTranscription: !!(response && response.data && response.data.transcription),
      transcriptionType: response && response.data && response.data.transcription ? typeof response.data.transcription : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : [],
      transcriptionKeys: response && response.data && response.data.transcription ? Object.keys(response.data.transcription) : []
    });
    
    if (response && response.data && response.data.transcription) {
      console.log('[TransformService] Transkription gefunden:', response.data.transcription);
      
      // Vollständige Video-Response mit Metadaten
      const videoResponse = response as SecretaryVideoResponse;
      transformedText = videoResponse.data.transcription.text;
      
      console.log('[TransformService] Extrahierter Text-Länge:', transformedText.length);
      console.log('[TransformService] Text-Vorschau:', transformedText.substring(0, 200));
      
      // Sammle relevante Video-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        source_language: videoResponse.data.transcription.source_language || options.sourceLanguage || 'auto',
        target_language: options.targetLanguage,
        
        // Video-Metadaten
        video_duration: videoResponse.data.metadata?.duration,
        video_duration_formatted: videoResponse.data.metadata?.duration_formatted,
        video_file_size: videoResponse.data.metadata?.file_size,
        video_title: videoResponse.data.metadata?.title,
        audio_file: videoResponse.data.metadata?.audio_file,
        
        // Prozess-Informationen
        process_id: videoResponse.process?.id,
        processor: videoResponse.process?.main_processor,
        sub_processors: videoResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: videoResponse.process?.llm_info?.total_duration,
        model_used: videoResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: videoResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: videoResponse.process?.is_from_cache || false,
        cache_key: videoResponse.process?.cache_key
      };
      
      console.log('[TransformService] Extrahierte Metadaten:', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      console.error('[TransformService] Keine Transkription in der Response gefunden!');
      console.error('[TransformService] Response-Struktur:', {
        hasResponse: !!response,
        hasData: !!(response && response.data),
        hasTranscription: !!(response && response.data && response.data.transcription),
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    console.log('[TransformService] Finaler transformierter Text-Länge:', transformedText.length);
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      console.log('[TransformService] Speichere Shadow-Twin mit Länge:', markdownContent.length);
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      console.log('[TransformService] Keine Speicherung:', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length
      });
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert einen Text mithilfe des Secretary Services
   */
  static async transformText(
    textContent: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    template: string = "Besprechung"
  ): Promise<TransformResult> {
    console.log('[TransformService] transformText aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      options: options,
      template: template
    });
    
    // Text wird transformiert
    const transformedText = await transformText(
      textContent,
      options.targetLanguage,
      libraryId,
      template
    );
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        transformedText,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert eine PDF-Datei mithilfe des Secretary Services
   * @param file Die zu transformierende PDF-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Speicheroptionen
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformPdf(
    file: File,
    originalItem: StorageItem,
    options: PdfTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    FileLogger.info('TransformService', 'PDF-Transformation gestartet', {
      fileName: originalItem.metadata.name,
      includeImages: options.includeImages,
      extractionMethod: options.extractionMethod,
      targetLanguage: options.targetLanguage
    });
    FileLogger.debug('TransformService', 'IncludeImages Option', {
      includeImages: options.includeImages,
      type: typeof options.includeImages
    });
    
    // PDF-Datei wird transformiert - hole die vollständige Response
    const response = await transformPdf(
      file,
      options.targetLanguage,
      libraryId,
      options.template,
      options.extractionMethod,
      options.useCache ?? true,
      options.includeImages ?? false,
      undefined, // skipTemplate wird nicht mehr verwendet; Flags steuern Phasen
      {
        originalItemId: originalItem.id,
        parentId: originalItem.parentId,
        originalFileName: originalItem.metadata.name,
          policies: options.policies,
      }
    );
    
    FileLogger.debug('TransformService', 'Vollständige PDF-Response', { response: JSON.stringify(response, null, 2) });

    // Asynchroner Flow: nur "accepted" → Ergebnis via Webhook, kein Client-Fehler
    if (response && (response as unknown as { status?: string; data?: { extracted_text?: string } }).status === 'accepted' && !((response as unknown as { data?: { extracted_text?: string } }).data?.extracted_text)) {
      const r = response as unknown as { job?: { id?: string }; process?: { id?: string; is_from_cache?: boolean } };
      FileLogger.info('TransformService', 'Job akzeptiert – Ergebnis kommt per Webhook', {
        jobId: r?.job?.id,
        processId: r?.process?.id,
        fromCache: r?.process?.is_from_cache || false
      });
      return { text: '', updatedItems: [], jobId: r?.job?.id };
    }
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    FileLogger.debug('TransformService', 'Response-Check', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasExtractedText: !!(response && response.data && response.data.extracted_text),
      extractedTextType: response && response.data && response.data.extracted_text ? typeof response.data.extracted_text : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : []
    });
    
    // Prüfe auf images_archive_data
    FileLogger.debug('TransformService', 'Images Archive Check', {
      hasImagesArchiveData: !!(response && response.data && response.data.images_archive_data),
      hasImagesArchiveFilename: !!(response && response.data && response.data.images_archive_filename),
      imagesArchiveDataLength: response && response.data && response.data.images_archive_data ? response.data.images_archive_data.length : 0,
      imagesArchiveFilename: response && response.data ? response.data.images_archive_filename : 'undefined'
    });
    
    if (response && response.data && response.data.extracted_text) {
      FileLogger.info('TransformService', 'Extracted-Text gefunden', {
        textLength: response.data.extracted_text.length,
        textPreview: response.data.extracted_text.substring(0, 200)
      });
      
      // Vollständige PDF-Response mit Metadaten
      const pdfResponse = response as SecretaryPdfResponse;
      transformedText = pdfResponse.data.extracted_text;
      
      // Sammle relevante PDF-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        target_language: options.targetLanguage,
        
        // PDF-Metadaten
        page_count: pdfResponse.data.metadata?.page_count,
        format: pdfResponse.data.metadata?.format,
        extraction_method: pdfResponse.data.metadata?.extraction_method,
        file_name: pdfResponse.data.metadata?.file_name,
        file_size: pdfResponse.data.metadata?.file_size,
        
        // Prozess-Informationen
        process_id: pdfResponse.process?.id,
        processor: pdfResponse.process?.main_processor,
        sub_processors: pdfResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: pdfResponse.process?.llm_info?.total_duration,
        model_used: pdfResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: pdfResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: pdfResponse.process?.is_from_cache || false,
        cache_key: pdfResponse.process?.cache_key
      };
      
      FileLogger.debug('TransformService', 'Extrahierte Metadaten', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      FileLogger.warn('TransformService', 'Keine synchronen PDF-Daten erhalten', {
        hasResponse: !!response,
        hasData: !!(response && (response as unknown as { data?: unknown }).data)
      });
    }
    
    let imageExtractionResult: ImageExtractionResult | undefined;
    if (options.includeImages && response && response.data && response.data.images_archive_data) {
      try {
        FileLogger.info('TransformService', 'Starte Bild-Extraktion', {
          imagesArchiveFilename: response.data.images_archive_filename,
          imagesArchiveDataLength: response.data.images_archive_data.length
        });
        imageExtractionResult = await ImageExtractionService.saveZipArchive(
          response.data.images_archive_data,
          response.data.images_archive_filename || 'pdf_images.zip',
          originalItem,
          provider,
          refreshItems,
          transformedText, // Extrahierten Text weitergeben
          options.targetLanguage, // Target Language weitergeben
          response.data.metadata?.text_contents // Seiten-spezifische Texte weitergeben
        );
        FileLogger.info('TransformService', 'Bild-Extraktion abgeschlossen', {
          folderCreated: !!imageExtractionResult.folderItem,
          savedItemsCount: imageExtractionResult.savedItems.length
        });
      } catch (error) {
        FileLogger.error('TransformService', 'Fehler bei der Bild-Extraktion', error);
        // Bild-Extraktion ist optional, daher weitermachen
      }
    }
    
    FileLogger.debug('TransformService', 'Finaler transformierter Text', {
      textLength: transformedText.length
    });
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);

    // NEU: Detaillierte Debug-Logs für das Speicherproblem
    FileLogger.info('TransformService', 'Speicher-Bedingungen prüfen', {
      createShadowTwin: options.createShadowTwin,
      hasTransformedText: !!transformedText,
      transformedTextLength: transformedText.length,
      markdownContentLength: markdownContent.length,
      willSave: options.createShadowTwin && transformedText
    });

    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      FileLogger.info('TransformService', 'Speichere Shadow-Twin', {
        markdownLength: markdownContent.length
      });
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      FileLogger.info('TransformService', 'Shadow-Twin erfolgreich gespeichert', {
        savedItemId: result.savedItem?.id,
        savedItemName: result.savedItem?.metadata.name,
        updatedItemsCount: result.updatedItems.length
      });
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems,
        imageExtractionResult
      };
    } else {
      FileLogger.warn('TransformService', 'Keine Speicherung - Bedingungen nicht erfüllt', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length,
        reason: !options.createShadowTwin ? 'createShadowTwin ist false' : 'transformedText ist leer'
      });
    }

    return {
      text: transformedText,
      updatedItems: [],
      imageExtractionResult
    };
  }

  /**
   * Transformiert ein Bild mithilfe des Secretary Services
   * @param file Die zu transformierende Bilddatei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Optionen für Bild-Transformation und Speicherung
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformImage(
    file: File,
    originalItem: StorageItem,
    options: ImageTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    FileLogger.info('TransformService', 'Bild-Transformation gestartet', {
      fileName: originalItem.metadata.name,
      extractionMethod: options.extractionMethod,
      targetLanguage: options.targetLanguage
    });
    
    // Bild wird transformiert - hole die vollständige Response
    const response = await transformImage(
      file,
      options.targetLanguage,
      libraryId,
      options.extractionMethod,
      options.context,
      options.useCache ?? true
    );
    
    FileLogger.debug('TransformService', 'Vollständige Bild-Response', {
      response: JSON.stringify(response, null, 2)
    });
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    if (response && response.data && response.data.extracted_text) {
      FileLogger.info('TransformService', 'Extracted-Text gefunden', {
        textLength: response.data.extracted_text.length,
        textPreview: response.data.extracted_text.substring(0, 200)
      });
      
      // Vollständige Bild-Response mit Metadaten
      const imageResponse = response as SecretaryImageResponse;
      transformedText = imageResponse.data.extracted_text;
      
      // Sammle relevante Bild-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        target_language: options.targetLanguage,
        
        // Bild-Metadaten
        dimensions: imageResponse.data.metadata?.dimensions,
        format: imageResponse.data.metadata?.format,
        color_mode: imageResponse.data.metadata?.color_mode,
        dpi: imageResponse.data.metadata?.dpi?.join('x'),
        extraction_method: imageResponse.data.metadata?.extraction_method,
        file_name: imageResponse.data.metadata?.file_name,
        file_size: imageResponse.data.metadata?.file_size,
        
        // Prozess-Informationen
        process_id: imageResponse.process?.id,
        processor: imageResponse.process?.main_processor,
        sub_processors: imageResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: imageResponse.process?.llm_info?.total_duration,
        model_used: imageResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: imageResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: imageResponse.process?.is_from_cache || false,
        cache_key: imageResponse.process?.cache_key
      };
      
      FileLogger.debug('TransformService', 'Extrahierte Metadaten', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      FileLogger.error('TransformService', 'Kein Extracted-Text in der Response gefunden!', {
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    FileLogger.debug('TransformService', 'Finaler transformierter Text', {
      textLength: transformedText.length
    });
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);

    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      FileLogger.info('TransformService', 'Speichere Shadow-Twin', {
        markdownLength: markdownContent.length
      });
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      FileLogger.debug('TransformService', 'Keine Speicherung', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length
      });
    }

    return {
      text: transformedText,
      updatedItems: []
    };
  }
  
  // Hilfsmethode zum Speichern der transformierten Datei
  private static async saveTwinFile(
    content: string,
    originalItem: StorageItem,
    fileName: string,
    fileExtension: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<{ savedItem?: StorageItem; updatedItems: StorageItem[] }> {
    console.log('[TransformService] saveTwinFile aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension
    });
    
    // NEU: Detaillierte Debug-Logs
    FileLogger.info('TransformService', 'saveTwinFile gestartet', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension,
      contentLength: content.length,
      parentId: originalItem.parentId
    });
    
    // Hole aktuelle Dateien im Verzeichnis
    const currentItems = await refreshItems(originalItem.parentId);
    FileLogger.debug('TransformService', 'Aktuelle Dateien im Verzeichnis', {
      parentId: originalItem.parentId,
      itemCount: currentItems.length,
      existingFiles: currentItems.filter(item => item.type === 'file').map(item => item.metadata.name)
    });
    
    // Funktion zum Generieren eines eindeutigen Dateinamens
    const generateUniqueFileName = (baseName: string, extension: string): string => {
      let counter = 0;
      let candidateName = `${baseName}.${extension}`;
      
      // Prüfe ob der Name bereits existiert
      while (currentItems.some(item => 
        item.type === 'file' && 
        item.metadata.name.toLowerCase() === candidateName.toLowerCase()
      )) {
        counter++;
        candidateName = `${baseName}(${counter}).${extension}`;
      }
      
      return candidateName;
    };
    
    // Generiere eindeutigen Dateinamen
    const uniqueFileName = generateUniqueFileName(fileName, fileExtension);
    
    console.log('[TransformService] Eindeutiger Dateiname generiert:', {
      baseNameWithLanguage: fileName,
      uniqueFileName: uniqueFileName,
      existingFiles: currentItems.filter(item => item.type === 'file').map(item => item.metadata.name)
    });
    
    FileLogger.info('TransformService', 'Dateiname generiert', {
      baseName: fileName,
      uniqueFileName: uniqueFileName,
      existingFilesCount: currentItems.filter(item => item.type === 'file').length
    });
    
    // Markdown-Datei erstellen und speichern
    const fileBlob = new Blob([content], { type: "text/markdown" });
    const file = new File([fileBlob], uniqueFileName, { type: "text/markdown" });
    
    FileLogger.info('TransformService', 'Datei vorbereitet für Upload', {
      fileName: uniqueFileName,
      fileSize: file.size,
      fileType: file.type,
      contentLength: content.length
    });
    
    // In dasselbe Verzeichnis wie die Originaldatei hochladen
    FileLogger.info('TransformService', 'Starte Upload', {
      parentId: originalItem.parentId,
      fileName: uniqueFileName
    });
    
    const savedItem = await provider.uploadFile(originalItem.parentId, file);
    
    FileLogger.info('TransformService', 'Upload erfolgreich', {
      savedItemId: savedItem.id,
      savedItemName: savedItem.metadata.name,
      savedItemSize: savedItem.metadata.size
    });
    
    // Aktualisierte Dateiliste holen
    const updatedItems = await refreshItems(originalItem.parentId);
    
    FileLogger.info('TransformService', 'Dateiliste aktualisiert', {
      updatedItemsCount: updatedItems.length,
      newFileFound: updatedItems.some(item => item.id === savedItem.id)
    });
    
    return { savedItem, updatedItems };
  }

  /**
   * Speichert einen bereits transformierten Text direkt ohne erneute Transformation
   */
  static async saveTransformedText(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    return this.saveTransformationResult(
      text,
      originalItem,
      options,
      provider,
      refreshItems
    );
  }

  /**
   * Speichert das Transformationsergebnis als Datei
   */
  static async saveTransformationResult(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    // Als Shadow-Twin oder als normale Datei mit angegebenem Namen speichern
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        text,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      // Einfach das Transformationsergebnis zurückgeben ohne Datei zu speichern
      return {
        text,
        updatedItems: []
      };
    }
  }

  /**
   * Erstellt Markdown-Inhalt mit YAML-Frontmatter
   */
  static createMarkdownWithFrontmatter(content: string, metadata: TransformMetadata): string {
    // Wenn keine Metadaten vorhanden sind, gebe nur den Inhalt zurück
    if (!metadata || Object.keys(metadata).length === 0) {
      return content;
    }
    
    // Erstelle YAML-Frontmatter
    let frontmatter = '---\n';
    
    // Sortiere die Metadaten für bessere Lesbarkeit
    const sortedKeys = Object.keys(metadata).sort((a, b) => {
      // Gruppiere nach Kategorien
      const categoryOrder = ['source_', 'transformation_', 'audio_', 'process', 'secretary_', 'cache_'];
      const getCategoryIndex = (key: string) => {
        for (let i = 0; i < categoryOrder.length; i++) {
          if (key.startsWith(categoryOrder[i])) return i;
        }
        return categoryOrder.length;
      };
      
      const categoryA = getCategoryIndex(a);
      const categoryB = getCategoryIndex(b);
      
      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }
      return a.localeCompare(b);
    });
    
    // Füge Metadaten zum Frontmatter hinzu
    for (const key of sortedKeys) {
      const value = metadata[key];
      
      // Überspringe undefined-Werte
      if (value === undefined) {
        continue;
      }
      
      // Formatiere den Wert je nach Typ
      if (typeof value === 'string') {
        // Escape Anführungszeichen in Strings
        const escapedValue = value.replace(/"/g, '\\"');
        frontmatter += `${key}: "${escapedValue}"\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        frontmatter += `${key}: ${value}\n`;
      } else {
        // Für komplexe Objekte verwende JSON (sollte nicht vorkommen)
        frontmatter += `${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    frontmatter += '---\n\n';
    
    // Kombiniere Frontmatter mit Inhalt
    return frontmatter + content;
  }
} 
```

- Ursache: In deinem Job steht `policies.metadata: "ignore"`. Damit wird die Template‑Phase bewusst übersprungen. Das erklärt, warum „Erzwingen“ aus dem UI nicht wirkte: Die UI hat beim Start offenbar keine Policy „force“ für Metadaten übergeben, sondern „ignore“. In den gespeicherten `phases` ist `template: false` – deckungsgleich mit der Policy.

- Konsequenz im Code:
  - Single‑Start und Batch erzeugen Policies. In der Retry-/Callback‑Logik wird Phase 2 nur gestartet, wenn `policies.metadata !== 'ignore'`. Bei `'ignore'` wird der Schritt als skipped markiert:
    - extract_pdf: skipped (shadow_twin_exists)
    - transform_template: skipped (artifact_exists)
    - store_shadow_twin: skipped (artifact_exists)
    - ingest_rag: skipped

Wie verlässlich neu berechnen erzwingen
- Stelle sicher, dass die UI beim Klick „Metadaten“ mit aktivem „Erzwingen“-Häkchen folgende Policies sendet:
  - `extract: 'do'` oder `'ignore'` je nach Bedarf
  - `metadata: 'force'`  ← entscheidend
  - `ingest: 'ignore'` oder `'do'` je nach Wunsch
- Für den Batch‑Dialog: die „Erzwingen“-Checkbox bei Phase 2 muss `policies.metadata = 'force'` setzen. Für den Einzel‑Phasenstart über den Stepper ist das bereits so verdrahtet: bei Phase 2 setzt er `metadata: 'do'` und toggelt „Erzwingen“ nur für extract. Wenn du Phase 2 erzwingen willst, müssen wir optional ein „Erzwingen“ auch für Metadaten im Stepper anbieten oder im Batch‑Dialog korrekt setzen.

Ich habe noch eine notwendige Korrektur gemacht
- `src/lib/transform/transform-service.ts`: Policies werden jetzt beim Secretary‑Client übergeben. Damit kommen die Policies sicher bis zur Server‑Route an.

Pragmatische Checks
- Beobachte im gespeicherten Job unter `parameters.policies`:
  - Soll‑Wert für dein Szenario: `"metadata":"force"`.
  - Wenn dort „ignore“ steht, wird Phase 2 niemals laufen.
- Aus dem UI:
  - Batch‑Dialog: „Metadaten“ aktiv + „Erzwingen“ aktiv → sollte `"metadata":"force"` erzeugen.
  - Einzel‑UI Phase‑Stepper: derzeit kein „Erzwingen“ für Metadaten. Wenn du das brauchst, kann ich einen zweiten Erzwingen‑Toggle ergänzen.

Wenn gewünscht, ergänze ich jetzt im Phase‑Stepper eine eigene „Erzwingen“-Option für Metadaten und setze den Batch‑Dialog eindeutig auf `metadata:'force'`, sobald das Häkchen gesetzt ist.

---

**User**

Aber wenn ich auf diesen Start Button bei Metadaten klicke und "Erzwingen" aktiv ist, dann muss auch bei jobs -> policies.metadata auf "force" gesetzt sein
{
  "_id": {
    "$oid": "68d119bb1ea3c5b4b5788cde"
  },
  "jobId": "65fd0980-e43d-4a38-978d-84eb478e34a1",
  "jobSecretHash": "6cf617d6e740f2c18af91bd226069865678e8c82709efda5d89247f59a91f419",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "failed",
  "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "65fd0980-e43d-4a38-978d-84eb478e34a1",
    "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "Hellrigl_2008_FaunistikDerGallwespenVonSüdtirol-Trentino_ForestObserver_4_p.pdf",
      "itemId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4L0hlbGxyaWdsXzIwMDhfRmF1bmlzdGlrRGVyR2FsbHdlc3BlblZvblPDvGR0aXJvbC1UcmVudGlub19Gb3Jlc3RPYnNlcnZlcl80X3AucGRm",
      "parentId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4"
    },
    "options": {
      "targetLanguage": "de",
      "extractionMethod": "mistral_ocr",
      "includeImages": false,
      "useCache": true
    },
    "batchId": null,
    "batchName": null
  },
  "createdAt": {
    "$date": "2025-09-22T09:41:15.313Z"
  },
  "updatedAt": {
    "$date": "2025-09-22T09:41:32.294Z"
  },
  "parameters": {
    "targetLanguage": "de",
    "extractionMethod": "mistral_ocr",
    "includeImages": false,
    "useCache": true,
    "template": "pdfanalyse",
    "phases": {
      "extract": true,
      "template": true,
      "ingest": false
    },
    "policies": {
      "extract": "force",
      "metadata": "do",
      "ingest": "ignore"
    }
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "pending"
    },
    {
      "name": "transform_template",
      "status": "failed",
      "startedAt": {
        "$date": "2025-09-22T09:41:31.521Z"
      },
      "endedAt": {
        "$date": "2025-09-22T09:41:31.973Z"
      }
    },
    {
      "name": "store_shadow_twin",
      "status": "pending"
    },
    {
      "name": "ingest_rag",
      "status": "pending"
    }
  ],
  "logs": [
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:15.375Z"
      },
      "phase": "request_sent",
      "sourcePath": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4L0hlbGxyaWdsXzIwMDhfRmF1bmlzdGlrRGVyR2FsbHdlc3BlblZvblPDvGR0aXJvbC1UcmVudGlub19Gb3Jlc3RPYnNlcnZlcl80X3AucGRm",
      "targetParentId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4",
      "callbackUrl": "http://localhost:3000/api/external/jobs/65fd0980-e43d-4a38-978d-84eb478e34a1"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:15.862Z"
      },
      "phase": "request_ack",
      "status": 202,
      "statusText": "ACCEPTED"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:18.970Z"
      },
      "phase": "initializing",
      "progress": 5,
      "message": "Job initialisiert"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:19.155Z"
      },
      "phase": "running",
      "progress": 10,
      "message": "Mistral-OCR: Upload startet - Args: {\"progress\": 10}"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:20.196Z"
      },
      "phase": "running",
      "progress": 30,
      "message": "Mistral-OCR: Upload abgeschlossen - Args: {\"progress\": 30}"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:20.321Z"
      },
      "phase": "running",
      "progress": 60,
      "message": "Mistral-OCR: OCR-Anfrage gesendet - Args: {\"progress\": 60}"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:30.488Z"
      },
      "phase": "running",
      "progress": 75,
      "message": "Mistral-OCR: OCR-Antwort empfangen - Args: {\"progress\": 75}"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:30.636Z"
      },
      "phase": "running",
      "progress": 85,
      "message": "Mistral-OCR: Ergebnis geparst (142 Seiten) - Args: {\"progress\": 85}"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:30.764Z"
      },
      "phase": "running",
      "progress": 90,
      "message": "Mistral-OCR: Verarbeitung abgeschlossen - Args: {\"progress\": 90}"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:30.940Z"
      },
      "phase": "postprocessing",
      "progress": 95,
      "message": "Ergebnisse werden gespeichert"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:31.916Z"
      },
      "phase": "transform_meta_failed",
      "message": "Transformer lieferte kein gültiges JSON"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:41:32.003Z"
      },
      "phase": "failed",
      "message": "Template-Transformation fehlgeschlagen (fatal)"
    }
  ],
  "processId": "job-4255e6c0-d442-42d3-a6f7-8e09fc3012db",
  "metaHistory": [
    {
      "at": {
        "$date": "2025-09-22T09:41:31.779Z"
      },
      "meta": {
        "template_used": "pdfanalyse.md"
      },
      "source": "template_pick"
    },
    {
      "at": {
        "$date": "2025-09-22T09:41:31.916Z"
      },
      "meta": {
        "text_contents": []
      },
      "source": "template_transform"
    }
  ],
  "cumulativeMeta": {
    "template_used": "pdfanalyse.md",
    "text_contents": []
  },
  "error": {
    "code": "template_failed",
    "message": "Template-Transformation fehlgeschlagen"
  }
}

---

**Cursor**

Ich passe jetzt den Phase-Start (UI) so an, dass der „Erzwingen“-Schalter die aktuell ausgewählte Phase betrifft: Bei Phase 2 setzt er `policies.metadata = 'force'`. Danach prüfe ich Linterfehler der betroffenen Datei.

```typescriptreact
"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { activePdfPhaseAtom, type PdfPhase } from "@/atoms/pdf-phases";
import { cn } from "@/lib/utils";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { loadPdfDefaults } from "@/lib/pdf-defaults";
import { pdfOverridesAtom, getEffectivePdfDefaults } from "@/atoms/pdf-defaults";
import { TransformService, type PdfTransformOptions } from "@/lib/transform/transform-service";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";

interface PhaseStepperProps {
  statuses?: { p1?: "completed" | "in_progress" | "failed" | "pending"; p2?: "completed" | "in_progress" | "failed" | "pending"; p3?: "completed" | "in_progress" | "failed" | "pending" };
  className?: string;
}

const PdfPhaseSettings = React.lazy(() => import('./pdf-phase-settings').then(m => ({ default: m.PdfPhaseSettings })));

export function PhaseStepper({ statuses, className }: PhaseStepperProps) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [forceRecreate, setForceRecreate] = React.useState<boolean>(false);
  const [phase, setPhase] = useAtom(activePdfPhaseAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const item = useAtomValue(selectedFileAtom);
  const { provider, refreshItems } = useStorage();
  const pdfOverrides = useAtomValue(pdfOverridesAtom);

  function canRun(): boolean {
    return Boolean(provider && activeLibraryId && item && item.type === 'file');
  }

  function buildOptions(targetPhase: PdfPhase): PdfTransformOptions | null {
    if (!provider || !activeLibraryId || !item || item.type !== 'file') return null;
    const defaults = getEffectivePdfDefaults(activeLibraryId, loadPdfDefaults(activeLibraryId), pdfOverrides);
    const base: PdfTransformOptions = {
      targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de',
      fileName: TransformService.generateShadowTwinName(item.metadata.name, typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : 'de'),
      createShadowTwin: true,
      fileExtension: 'md',
      extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'native',
      useCache: defaults.useCache ?? true,
      includeImages: defaults.includeImages ?? false,
      template: typeof defaults.template === 'string' ? defaults.template : undefined,
    };
    return {
      ...base,
      // Policies: "Erzwingen" wirkt auf die aktuell gewählte Ziel‑Phase
      policies: {
        extract: targetPhase >= 1 ? ((forceRecreate && targetPhase === 1) ? 'force' : 'do') : 'ignore',
        metadata: targetPhase >= 2 ? ((forceRecreate && targetPhase === 2) ? 'force' : 'do') : 'ignore',
        ingest: targetPhase >= 3 ? ((forceRecreate && targetPhase === 3) ? 'force' : 'do') : 'ignore',
      },
      // Keine Legacy-Flags mehr
      forceRecreate: undefined as unknown as never,
    } as any;
  }

  async function runPhase(targetPhase: PdfPhase = phase) {
    try {
      if (!canRun()) {
        toast.error('Fehler', { description: 'Kein Dokument/Provider verfügbar' });
        return;
      }
      const bin = await provider!.getBinary(item!.id);
      const file = new File([bin.blob], item!.metadata.name, { type: item!.metadata.mimeType });
      const options = buildOptions(targetPhase);
      if (!options) {
        toast.error('Fehler', { description: 'Optionen konnten nicht erstellt werden' });
        return;
      }
      // Keine Persistenz hier; Overrides bleiben bis zum Reload
      await TransformService.transformPdf(file, item!, options, provider!, refreshItems, activeLibraryId!);
      toast.success('Gestartet', { description: `Bis Phase ${targetPhase} angestoßen` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error('Start fehlgeschlagen', { description: msg });
    }
  }

  function badgeColor(status?: "completed" | "in_progress" | "failed" | "pending") {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-amber-500';
    if (status === 'failed') return 'bg-red-500';
    return 'bg-muted-foreground/40';
  }

  function buttonStyle(isActive: boolean, _status?: "completed" | "in_progress" | "failed" | "pending") {
    return cn(
      "px-2 py-1 text-xs rounded border",
      isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
    );
  }

  function renderButton(id: PdfPhase, label: string, status?: "completed" | "in_progress" | "failed" | "pending") {
    const isActive = phase === id;
    return (
      <div key={id} className="flex items-center gap-1">
        <button
          type="button"
          className={buttonStyle(isActive, status)}
          onClick={() => setPhase(id)}
          aria-pressed={isActive}
          aria-label={`Phase ${id}: ${label}`}
          title={`${label} auswählen`}
        >
          <span className="mr-2 hidden sm:inline">{label}</span>
          <span className="inline-flex items-center justify-center h-2.5 w-2.5 rounded-full ml-0.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor(status)}`} />
          </span>
        </button>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted text-muted-foreground"
          onClick={() => void runPhase(id)}
          title={`Bis ${label} ausführen`}
          aria-label={`Bis ${label} ausführen`}
          disabled={!canRun()}
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {renderButton(1, "Extraktion", statuses?.p1)}
      {renderButton(2, "Metadaten", statuses?.p2)}
      {renderButton(3, "Ingestion", statuses?.p3)}
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-foreground"
            checked={forceRecreate}
            onChange={(e) => setForceRecreate(e.target.checked)}
          />
          Erzwingen
        </label>
        <Button size="sm" variant="secondary" onClick={() => void runPhase()} disabled={!canRun()} title="Ausgewählte Phase starten">
          <Play className="h-3.5 w-3.5 mr-1" /> Starten
        </Button>
        <Button size="icon" variant="ghost" title="Standardwerte anpassen" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}
    </div>
  );
}



```

- Der gezeigte Job setzte `policies.metadata: "do"` statt "force" – deshalb wurde nicht hart erzwungen. Ich habe den UI‑Stepper so angepasst, dass der „Erzwingen“-Schalter immer die jeweils ausgewählte Phase betrifft:
  - Phase 1 ausgewählt + Erzwingen → `extract:'force'`
  - Phase 2 ausgewählt + Erzwingen → `metadata:'force'`
  - Phase 3 ausgewählt + Erzwingen → `ingest:'force'`

Technische Änderung
- `src/components/library/phase-stepper.tsx`: Policy-Building angepasst; das `forceRecreate`‑Flag wirkt nun kontextsensitiv auf die Ziel‑Phase. Linter ist sauber.

Erwartetes Verhalten
- Wenn du im UI „Metadaten“ aktiv hast und „Erzwingen“ setzt, wird der nächste Start jetzt Jobs mit `parameters.policies.metadata: "force"` erzeugen.

---

**User**

Im Job stimmen jetzt die Parameter - aber secretaryservice passiert nix.

{
  "_id": {
    "$oid": "68d11b011ea3c5b4b5788ce0"
  },
  "jobId": "461d7b02-600f-4376-92f2-8f942af36250",
  "jobSecretHash": "e01e1b5c9aece6b2a66cc813af8cbf410aeedd063c2821b106b4cf6fdab9ea62",
  "job_type": "pdf",
  "operation": "extract",
  "worker": "secretary",
  "status": "completed",
  "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
  "userEmail": "peter.aichner@crystal-design.com",
  "correlation": {
    "jobId": "461d7b02-600f-4376-92f2-8f942af36250",
    "libraryId": "8a9eda76-90a2-414c-9d85-a3225ffcf249",
    "source": {
      "mediaType": "pdf",
      "mimeType": "application/pdf",
      "name": "Hellrigl_2008_FaunistikDerGallwespenVonSüdtirol-Trentino_ForestObserver_4_p.pdf",
      "itemId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4L0hlbGxyaWdsXzIwMDhfRmF1bmlzdGlrRGVyR2FsbHdlc3BlblZvblPDvGR0aXJvbC1UcmVudGlub19Gb3Jlc3RPYnNlcnZlcl80X3AucGRm",
      "parentId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4"
    },
    "options": {
      "targetLanguage": "de",
      "extractionMethod": "mistral_ocr",
      "includeImages": false,
      "useCache": true
    },
    "batchId": null,
    "batchName": null
  },
  "createdAt": {
    "$date": "2025-09-22T09:46:41.841Z"
  },
  "updatedAt": {
    "$date": "2025-09-22T09:46:42.905Z"
  },
  "parameters": {
    "targetLanguage": "de",
    "extractionMethod": "mistral_ocr",
    "includeImages": false,
    "useCache": true,
    "template": "pdfanalyse",
    "phases": {
      "extract": true,
      "template": true,
      "ingest": false
    },
    "policies": {
      "extract": "do",
      "metadata": "force",
      "ingest": "ignore"
    }
  },
  "steps": [
    {
      "name": "extract_pdf",
      "status": "completed",
      "details": {
        "skipped": true,
        "reason": "shadow_twin_exists"
      },
      "endedAt": {
        "$date": "2025-09-22T09:46:42.059Z"
      }
    },
    {
      "name": "transform_template",
      "status": "completed",
      "startedAt": {
        "$date": "2025-09-22T09:46:42.146Z"
      },
      "endedAt": {
        "$date": "2025-09-22T09:46:42.683Z"
      }
    },
    {
      "name": "store_shadow_twin",
      "status": "completed",
      "startedAt": {
        "$date": "2025-09-22T09:46:42.714Z"
      },
      "endedAt": {
        "$date": "2025-09-22T09:46:42.815Z"
      }
    },
    {
      "name": "ingest_rag",
      "status": "completed",
      "details": {
        "skipped": true
      },
      "endedAt": {
        "$date": "2025-09-22T09:46:42.845Z"
      }
    }
  ],
  "logs": [
    {
      "timestamp": {
        "$date": "2025-09-22T09:46:41.904Z"
      },
      "phase": "request_sent",
      "sourcePath": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4L0hlbGxyaWdsXzIwMDhfRmF1bmlzdGlrRGVyR2FsbHdlc3BlblZvblPDvGR0aXJvbC1UcmVudGlub19Gb3Jlc3RPYnNlcnZlcl80X3AucGRm",
      "targetParentId": "RmFjaGFydC9aZWl0c2NockJaL0ZvcmVzdCBPYnNlcnZlci8yMDA4",
      "callbackUrl": "http://localhost:3000/api/external/jobs/461d7b02-600f-4376-92f2-8f942af36250"
    },
    {
      "timestamp": {
        "$date": "2025-09-22T09:46:42.876Z"
      },
      "phase": "completed",
      "message": "Job abgeschlossen (template-only)"
    }
  ],
  "metaHistory": [
    {
      "at": {
        "$date": "2025-09-22T09:46:42.624Z"
      },
      "meta": {},
      "source": "template_transform"
    }
  ],
  "cumulativeMeta": {}
}

---

**Cursor**

- Die Policies greifen: `metadata: "force"` führt zur Template‑Only‑Verarbeitung. Dein Job zeigt genau das: Extraktion übersprungen (Shadow‑Twin vorhanden), dann Template‑Transform ausgeführt und Job sofort als completed markiert. Es gibt aber kein sinnvolles Ergebnis (`metaHistory: {}`), daher wirkt es so, als würde „nichts passieren“.

Warum kein sichtbares Ergebnis
- Im Template‑Only‑Pfad rufen wir synchron den Secretary‑Endpoint `POST /transformer/template` auf. Wenn der Response keine `structured_data` liefert (oder leer ist), markieren wir den Schritt trotzdem als completed. Deshalb: schnell „fertig“, aber ohne Metadaten.

Sinnvolle Korrekturen
- Schritt als Fehler markieren, wenn `structured_data` leer/ungültig ist, statt completed:
  - transform_template → status failed; Jobstatus failed; Fehlertext „Transformer lieferte kein gültiges JSON/keine Daten“.
- Zusätzlich im Template‑Only‑Pfad `template_used` in `metaHistory` schreiben, damit nachvollziehbar ist, welches Template lief.
- Optional: Bei `metadata:'force'` Loggrund „policy_force“ statt „artifact_exists“.

Manueller Check jetzt
- Secretary‑Logs prüfen, ob `transformer/template` aufgerufen wurde (sollte der Fall sein).
- Template‑Datei `pdfanalyse.md` validieren (Platzhalter, YAML‑Format im Ergebnis). Leeres `structured_data` deutet häufig auf Template/Parser‑Mismatch hin.

Wenn gewünscht, setze ich die striktere Fehlerbehandlung sofort um: Template‑Only‑Pfad bricht ab, wenn `structured_data` fehlt/leer, und schreibt `template_used` ins Log.

