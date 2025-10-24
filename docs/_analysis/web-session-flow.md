---
title: Web-Session → Event → Job → Markdown+Assets – End-to-End Analyse
updated: 2025-10-24
status: draft
---

## Ziel

Präzise, verifizierte Beschreibung des Flows von Web‑URL‑Erfassung über Session/Job‑Erstellung bis zur Speicherung von Markdown mit Bildern in der Library. Zusätzlich: konkrete Quellen des Frontmatters und Ordnerstruktur der gespeicherten Dateien.

## High‑Level Ablauf

```mermaid
flowchart TD
  A[Benutzer gibt Session-URL ein] --> B[/api/secretary/import-from-url]
  B --> C{Template Extract}
  C -->|structured_data| D[Session anlegen in event_sessions]
  D --> E[/api/sessions/generate-jobs]
  E --> F[Event-Batch + Jobs in event_batches/event_jobs]
  F --> G[Worker ruft /api/external/jobs/{jobId} Callback]
  G --> H[Template/Chapters → Markdown mit Frontmatter]
  H --> I[saveMarkdown → Upload in Library (Ordner der Quelle)]
  G --> J{images_archive_url?}
  J -->|ja| K[maybeProcessImages → .<basename>/ Ordner + Page‑Markdown]
  H --> L[optional: Ingestion in Vektorindex]
  I --> M[Event‑Monitor zeigt Abschluss]
  K --> M
```

## Belegstellen (Code‑Referenzen)

### 1) URL‑Import und Vorschau

```39:59:src/components/session/session-import-modal.tsx
export default function SessionImportModal({ 
  open, 
  onOpenChange, 
  onSessionImported 
}: SessionImportModalProps) {
```

```128:143:src/components/session/session-import-modal.tsx
const response = await importSessionFromUrl(url, {
  sourceLanguage,
  targetLanguage,
  template: 'ExtractSessionDataFromWebsite',
  useCache: false
});
if (response.status === 'success' && response.data && response.data.structured_data) {
  const structuredData = response.data.structured_data;
  setImportedData(structuredData);
}
```

```43:56:src/app/api/secretary/import-from-url/route.ts
const { baseUrl } = getSecretaryConfig();
const apiUrl = `${baseUrl}/transformer/template`;
formData.append('template', template || 'ExtractSessionDataFromWebsite');
```

### 2) Session anlegen (MongoDB: event_sessions)

```167:184:src/components/session/session-import-modal.tsx
const sessionData = {
  event: importedData.event || '',
  session: importedData.session || '',
  // ... weitere Felder ...
  source_language: importedData.language || sourceLanguage,
  target_language: importedData.language || targetLanguage
};
```

```61:118:src/app/api/sessions/route.ts
// Validierung + Speicherung
const sessionIds = await repository.createSessions(body.sessions);
return NextResponse.json({ status: 'success', data: { sessionIds } }, { status: 201 });
```

```9:17:src/lib/session-repository.ts
export class SessionRepository {
  private collectionName = 'event_sessions';
```

### 3) Jobs/Batches erzeugen für Event‑Verarbeitung

```149:177:src/app/api/sessions/generate-jobs/route.ts
// Batch erstellen (optional groupByTrack)
const batchId = await jobRepository.createBatch({ batch_name: generatedBatchName, ... });
```

```177:206:src/app/api/sessions/generate-jobs/route.ts
// Pro Session ein Job mit Parametern (event, session, url, track, speakers, languages)
const jobData = { job_type: 'event', parameters: { ... } };
await jobRepository.createJob(jobData);
```

```29:45:src/lib/event-job-repository.ts
export class EventJobRepository {
  private jobCollectionName = 'event_jobs';
  private batchCollectionName = 'event_batches';
```

### 4) Verarbeitung und Speicherung als Markdown + Bilder

Callback‑Route verarbeitet finale Worker‑Payload, generiert Markdown mit Frontmatter und speichert in der Library:

```493:512:src/app/api/external/jobs/[jobId]/route.ts
const { createMarkdownWithFrontmatter } = await import('@/lib/markdown/compose')
const markdown = createMarkdownWithFrontmatter(bodyOnly, mergedMeta)
const saved = await saveMarkdown({ ctx, parentId: targetParentId, fileName: uniqueName, markdown })
```

Frontmatter‑Erzeugung (YAML‑Block + JSON‑Werte safe):

```3:9:src/lib/markdown/compose.ts
export function createMarkdownWithFrontmatter(body: string, meta: Record<string, unknown>): string {
  const fm = '---\n' + Object.entries(meta)
    .map(([k, v]) => `${k}: ${formatValue(v)}`)
    .join('\n') + '\n---\n'
  const cleansed = stripAllFrontmatter(body)
  return fm + cleansed
}
```

Speichern in die Library (z. B. OneDrive) in den Ordner der Quelle:

```7:17:src/lib/external-jobs/storage.ts
const provider = await getServerProvider(ctx.job.userEmail, ctx.job.libraryId)
const saved = await provider.uploadFile(parentId, file)
```

OneDrive‑Upload (Microsoft Graph `/content` PUT):

```942:956:src/lib/storage/onedrive-provider.ts
url = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${file.name}:/content`;
const response = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream' }, body: arrayBuffer });
```

Bildverarbeitung, falls der Worker `images_archive_url` liefert → Entpacken in Unterordner `.<basename>/` und optionale seitenweise `.md`:

```534:547:src/app/api/external/jobs/[jobId]/route.ts
const imageRes = await maybeProcessImages({ ctx, parentId: targetParentId, imagesZipUrl: imagesArchiveUrlFromWorker, extractedText, lang })
```

```59:67:src/lib/transform/image-extraction-service.ts
const folderName = this.generateImageFolderName(originalItem.metadata.name); // .<basename>
const folderItem = await provider.createFolder(originalItem.parentId, folderName);
```

```153:163:src/lib/transform/image-extraction-service.ts
const imageFile = new File([imageBlob], pageFileName, { type: mimeType });
const savedImageItem = await provider.uploadFile(folderItem.id, imageFile);
```

```176:187:src/lib/transform/image-extraction-service.ts
const markdownFile = new File([markdownBlob], markdownFileName, { type: 'text/markdown' });
const savedMarkdownItem = await provider.uploadFile(folderItem.id, markdownFile);
```

### 5) Ordner‑ und Dateistruktur

- Shadow‑Twin Markdown: `basename.<lang>.md` im selben Ordner wie die Quell‑Datei (Quelle = korrelierter Storage‑Eintrag der Session/Job‑Quelle).
- Bilder: Unterordner `.<basename>/` (z. B. `.MyTalk/`) mit `page_###.png|jpg` und optional `page_###.<lang>.md` je Seite.

### 6) Frontmatter – Inhalt und Herkunft

- Primäre Quelle: im Callback mitgelieferte `data.metadata` (vom Worker/Template). Sie wird ggf. mit Template‑Ergebnis gemerged und um SSOT‑Felder ergänzt:

```405:416:src/app/api/external/jobs/[jobId]/route.ts
const ssotFlat = {
  job_id: jobId,
  source_file: job.correlation.source?.name || baseName,
  extract_status: 'completed',
  template_status: templateStatus,
  summary_language: lang,
  summary_pages?: number,
  summary_chunks?: number
}
```

- Kapitel/Seiten werden über `analyzeAndMergeChapters` normalisiert und in das Frontmatter übernommen:

```455:461:src/app/api/external/jobs/[jobId]/route.ts
const chaptersRes = await analyzeAndMergeChapters({ ctx, baseMeta: mergedMeta, textForAnalysis, existingChapters })
mergedMeta = chaptersRes.mergedMeta
```

Ergebnis: Markdown beginnt mit einem YAML‑Frontmatter‑Block (`---`), danach der bereinigte Body (ohne etwaige doppelte Frontmatter aus der Quelle).

## Klarstellung: Keine PDF‑Erzeugung

Der Event‑Flow erzeugt keine neuen PDFs. Er verarbeitet Inhalte (Text/Bilder) zu:

- Markdown `basename.<lang>.md` (Shadow‑Twin) im Quellordner.
- Bilder + seitenweise Markdown im Unterordner `.<basename>/`, wenn ein Bilder‑Archiv bereitgestellt wird.
- Optional: ZIP‑Archiv in Job‑Ergebnissen (Base64) zur späteren Entnahme/Upload via UI (Event‑Monitor → Archiv‑Upload), nicht als Persistenzformat.

## Verifikation

- Speicherung Markdown: `saveMarkdown` → Provider.uploadFile → OneDrive PUT `/content`.
- Bilder-Unterordner: `ImageExtractionService.saveZipArchive` → `createFolder( .<basename> )` + Upload aller Dateien.
- Frontmatter vorhanden: `createMarkdownWithFrontmatter` fügt immer einen Frontmatter‑Block vor dem Body ein; vorher werden alle existierenden Blöcke entfernt (`stripAllFrontmatter`).
- Event‑Monitor „Archiv nach Library“: `batch-archive-dialog.tsx` extrahiert Job‑ZIPs und lädt Dateien per Provider wieder in die Librarypfade hoch.

## Test‑/Validierungsvorschlag

1. Einzel‑Import einer Session‑URL → Vorschau prüfen → Session erstellen.
2. In `Session Manager` ausgewählte Session → „Jobs generieren“.
3. Event‑Monitor: Abschluss abwarten; Job‑Details prüfen.
4. In der Library nach `basename.<lang>.md` suchen; Frontmatter inspizieren.
5. Falls Bilder vorhanden: Ordner `.<basename>/` prüfen; Beispiel‑Seite öffnen (`page_001.de.md`).

## Offene Punkte / Risiken

- Abhängigkeit von Worker‑Payload (`images_archive_url`). Ohne ZIP werden keine Bilder extrahiert.
- Mehrsprachige Shadow‑Twins schreiben gleiche Basenames mit anderem Sprachsuffix – Kollisionen durch OneDrive‑Versionierung möglich.
- Ingestion wird ggf. durch Gates übersprungen; Frontmatter bleibt dennoch im Markdown erhalten.

---

Kurzfazit: Die Event‑Verarbeitung endet in der Library mit einem Shadow‑Twin‑Markdown inklusive Frontmatter im Quellordner und – falls verfügbar – einem Bilder‑Unterordner `.<basename>/`. PDFs werden nicht erzeugt.



