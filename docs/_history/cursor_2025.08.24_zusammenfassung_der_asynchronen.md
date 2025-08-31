# Zusammenfassung der asynchronen PDF-Erstellung
_Exported on 8/30/2025 at 11:44:32 GMT+2 from Cursor (1.5.5)_

---

**User**

Wir haben jetzt diese PDF-Erstellung auf eine asynchrone Methode umgestellt, sodass der Secretary Service diese hintereinander abarbeiten kann und in unserer External-Job-Liste diese Verarbeitung angezeigt wird. Können wir das nochmal kurz zusammenfassen, was sind die wichtigsten Punkte, wie das funktioniert?

---

**Cursor**

Ich schaue mir die relevanten Routen und Helfer an, um den neuen asynchronen PDF-Verarbeitungsfluss korrekt und knapp zusammenzufassen. Anschließend fasse ich die wichtigsten Punkte, Events und Endpunkte in Bullet Points zusammen.

Ich habe die relevanten Routen und Services geprüft. Hier ist die knappe, technische Zusammenfassung des asynchronen Flows.

### Kerngedanke
- Die PDF-Verarbeitung läuft extern im Secretary Service. Unsere App legt dafür einen External-Job an, leitet die Datei weiter und erhält Fortschritt/Ergebnis über Callbacks zurück. Die UI zeigt Live-Status via SSE.

### Ablauf
- Auftrag erzeugen: POST `api/secretary/process-pdf`
  - Clerk-Auth prüfen. FormData lesen (PDF, Optionen).
  - External-Job anlegen: `jobId`, per-Job-Secret (nur Hash gespeichert), Status `queued`, Korrelation (Library, Quelle, Optionen).
  - Sofort SSE-Event: `queued`. Watchdog starten (~120s ohne Heartbeat).
  - Weiterleiten an Secretary `.../pdf/process` mit:
    - `callback_url`: `.../api/external/jobs/{jobId}`
    - `callback_token`: per-Job-Secret
    - API-Key-Header: `Authorization: Bearer` und `X-Service-Token` [[memory:6998386]].
  - Response an Client enthält zusätzlich `job: { id: jobId }`.

- Fortschritt/Callbacks: POST `api/external/jobs/{jobId}`
  - `callback_token` validieren (Header/Bearer/Body). Gegen gespeicherten Hash prüfen.
  - Status `running`, optional `process.id` speichern.
  - Progress/Phase/Message puffern, Watchdog heartbeat, SSE `job_update` an Benutzerkanal.

- Abschluss
  - Bei finaler Payload (`extracted_text`, optional `images_archive_data`):
    - Speicherung je nach Library:
      - Local: Markdown (optional mit Frontmatter) in Zielordner, Bilder-ZIP extrahieren und ablegen.
      - OneDrive: Markdown hochladen; bei Bildern Ordner `.<basename>` anlegen, Bilder (und optional pro Seite .md) hochladen.
    - Status `completed`, Logs aus Puffer persistieren, `result`-Referenzen (IDs) setzen, SSE final.

- Fehlerfall
  - Watchdog stoppen, Logs persistieren, Status `failed`, SSE `failed`.

### Live-Updates/Anzeige
- SSE-Stream: GET `api/external/jobs/stream`
  - Authentifiziert; sendet `job_update`-Events für die User-Mail.
- Job-Details: GET `api/external/jobs/{jobId}`
  - Liefert Status, Timestamps, Logs, Ergebnis-Referenzen.

### Sicherheit
- Per-Job-Secret nur als Hash gespeichert; Validierung bei jedem Callback.
- Keine sensiblen Korrelationen an den Worker senden (nur Callback-Infos).
- Secretary-API-Key nur serverseitig gesetzt; niemals an Client leaken.
- Watchdog erkennt hängende Jobs (Timeout ohne Progress).

### Umgebung
- Erforderlich: `SECRETARY_SERVICE_URL`, `SECRETARY_SERVICE_API_KEY`, `NEXT_PUBLIC_APP_URL`.

### UI-Status
- Einzelverarbeitung: voll integriert über `process-pdf`.
- Bulk-Dialog (`pdf-bulk-import-dialog.tsx`): Scan/Optionen fertig; Enqueue ist als Platzhalter vorgesehen und soll auf Secretary-Batch-API zeigen.

- Kürzestformel: Client lädt hoch → Job angelegt + SSE queued → Secretary arbeitet sequentiell → Callbacks treiben Status/Logs → Ergebnis gespeichert → SSE completed/failed.

---

**User**

Ok, als nächstes möchte ich eben ganze Verzeichnisstrukturen auslesen und auf diese External Jobs legen und schauen, wie der Secretary Service diese verarbeitet. Wir haben schon folgende Logik implementiert. Wie ist diese jetzt mit unserer neuen Jobmethode kompatibel? Müssen wir da noch was anpassen?@pdf-bulk-import-dialog.tsx @library-header.tsx 

---

**Cursor**

Ich prüfe jetzt, ob der Bulk-Dialog die Dateien als File/Blob laden kann und welche Provider-APIs verfügbar sind, damit wir sie an `api/secretary/process-pdf` schicken können. Dann bewerte ich, welche minimalen Anpassungen im Dialog nötig sind.

Ich beginne mit der minimalen Anpassung: Im `handleEnqueue` des `pdf-bulk-import-dialog.tsx` ersetze ich den Platzhalter durch das sequentielle Anlegen von External Jobs über die bestehende Route, mit Header `X-Library-Id` und allen erforderlichen FormData-Feldern. Danach prüfe ich kurz die Linter-Ergebnisse.

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
import { TransformSaveOptions as SaveOptionsComponent } from '@/components/library/transform-save-options';
import type { TransformSaveOptions as SaveOptionsType } from '@/components/library/transform-save-options';
import { FileLogger } from '@/lib/debug/logger';

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

  const [ignoreExisting, setIgnoreExisting] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [preview, setPreview] = useState<string[]>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });

  // Optionen wie im Einzel-PDF-Dialog
  const [saveOptions, setSaveOptions] = useState<SaveOptionsType>({
    targetLanguage: 'de',
    fileName: '',
    createShadowTwin: true,
    fileExtension: 'md',
    extractionMethod: 'native',
    useCache: true,
    includeImages: false,
  });

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
        const shouldSkip = ignoreExisting && hasTwinInFolder(items, base, saveOptions.targetLanguage);
        if (shouldSkip) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, ignoreExisting, hasTwinInFolder, saveOptions.targetLanguage]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreview([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      setPreview(result.previews);
      setStats({ totalPdfs: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Bei Öffnen initial Scannen
      void handleScan();
    }
  }, [open, handleScan]);

  const handleOptionsChange = useCallback((opts: SaveOptionsType) => {
    setSaveOptions({
      ...opts,
      extractionMethod: opts.extractionMethod || 'native',
      useCache: opts.useCache ?? true,
      includeImages: opts.includeImages ?? false,
    });
  }, []);

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      // Sequenzielles Anlegen von External-Jobs über unsere API-Route
      // Minimale Last, klare Reihenfolge (Secretary arbeitet der Reihe nach)
      for (const { file, parentId } of candidates) {
        try {
          const bin = await provider?.getBinary(file.id);
          if (!bin) continue;

          const pdfFile = new File([bin.blob], file.metadata.name, { type: bin.mimeType || 'application/pdf' });

          const form = new FormData();
          form.append('file', pdfFile);
          form.append('targetLanguage', saveOptions.targetLanguage || 'de');
          form.append('extractionMethod', saveOptions.extractionMethod || 'native');
          form.append('useCache', String(saveOptions.useCache ?? true));
          form.append('includeImages', String(saveOptions.includeImages ?? false));
          form.append('originalItemId', file.id);
          form.append('parentId', parentId);

          const res = await fetch('/api/secretary/process-pdf', {
            method: 'POST',
            headers: { 'X-Library-Id': activeLibraryId },
            body: form,
          });

          if (!res.ok) {
            const msg = await res.text().catch(() => 'unknown error');
            FileLogger.error('PdfBulkImportDialog', 'Job enqueue failed', { name: file.metadata.name, status: res.status, msg });
          } else {
            FileLogger.info('PdfBulkImportDialog', 'Job enqueued', { name: file.metadata.name });
          }
        } catch (error) {
          FileLogger.error('PdfBulkImportDialog', 'Fehler beim Enqueue für Datei', { fileId: file.id, error });
          // Weiter mit nächster Datei
        }
      }

      onOpenChange(false);
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates.length, saveOptions, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>PDF-Verzeichnis verarbeiten</DialogTitle>
          <DialogDescription>
            Wählen Sie Optionen wie beim Einzel-PDF-Dialog. Optional bereits transformierte PDFs ignorieren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="ignore-existing" checked={ignoreExisting} onCheckedChange={(v) => setIgnoreExisting(Boolean(v))} />
              <Label htmlFor="ignore-existing">Ignore existing transformations</Label>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <SaveOptionsComponent
              originalFileName={''}
              onOptionsChangeAction={handleOptionsChange}
              className="mb-0"
              showExtractionMethod={true}
              defaultExtractionMethod={saveOptions.extractionMethod || 'native'}
              showUseCache={true}
              defaultUseCache={saveOptions.useCache ?? true}
              showIncludeImages={true}
              defaultIncludeImages={saveOptions.includeImages ?? false}
            />
          </div>

          <div className="rounded-md border p-3">
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
              {preview.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm list-disc pl-5">
                  {preview.map((n, i) => (
                    <li key={i}>{n}</li>
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
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

Ich habe den Bulk-Dialog direkt an die neue External-Job-Methode angepasst: Beim Klick auf “Jobs starten” werden die gefundenen PDFs jetzt sequentiell via POST auf `api/secretary/process-pdf` eingereiht (mit `X-Library-Id` und allen FormData-Optionen). Lint ist grün.

### Kompatibilität und notwendige Anpassungen
- Pdf-Bulk-Scan/Erkennung: unverändert kompatibel. Eure bestehende Rekursion/Filterung bleibt so.
- Enqueue (neu umgesetzt): Für jedes PDF wird
  - der Binärinhalt geladen (`provider.getBinary`),
  - ein `File` erstellt,
  - FormData befüllt (`file`, `targetLanguage`, `extractionMethod`, `useCache`, `includeImages`, `originalItemId`, `parentId`),
  - ein Request gegen `POST /api/secretary/process-pdf` geschickt, Header: `X-Library-Id: <activeLibraryId>`.
  - Der Secretary arbeitet die Jobs nacheinander ab, Fortschritt/Resultat kommt über die Callback-Route und erscheint in eurer External-Job-Liste/SSE.
- Library-Header: keine Änderung nötig; er öffnet nur den Dialog.

### Hinweise
- Sequenzielles Enqueue ist bewusst gewählt (geringe Last, klare Reihenfolge). Wenn gewünscht, können wir später mit kleinem Parallelismus (2–3) throttle’n.
- UI zeigt im Dialog keinen Fortschritt; Status/Logs bekommt ihr wie gehabt über `api/external/jobs/stream` bzw. die Job-Liste.

### Kurzer Testplan
- Ordner öffnen, Dialog “PDF-Verzeichnis verarbeiten”, Scan prüfen.
- “Jobs starten” klicken. In externer Job-Liste/SSE sollten sofort `queued`-Events auftauchen, danach `running`/`completed` oder `failed`.
- Bei aktivierter Option “Bilder extrahieren” prüfen, dass zusätzliche Dateien/Ordner erzeugt werden (lokal oder OneDrive je nach Library).

- Zusammenfassung:
  - Bestehende Scan-Logik ist voll kompatibel.
  - Enqueue ist jetzt an die External-Job-API angebunden.
  - Keine Änderungen am `library-header.tsx` nötig.

---

**User**

Wie funktioniert das Scannen der Verzeichnisse in diesem Batch-Dialog? Ich habe mehrere Verzeichnisse mit unterschiedlichen untergeordneten Dokumente. Warum werden die nicht alle erkannt?

---

**Cursor**

Kurz: Der Dialog scannt rekursiv ab dem aktuell ausgewählten Ordner und sammelt alle Dateien, die als PDF erkannt werden. Viele “fehlende” Dateien werden bewusst übersprungen, z. B. wegen aktivem “Ignore existing transformations”, fehlender PDF-Erkennung (MIME/Endung), Provider-Fehlern oder Limitierungen (Pagination/Permissions).

### Wie der Scan arbeitet
```79:121:src/components/library/pdf-bulk-import-dialog.tsx
// rekursiver Scan (DFS mit Stack)
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
    continue; // Ordner wird ausgelassen, es wird weitergescannt
  }

  const folders = items.filter((i) => i.type === 'folder');
  folders.forEach((f) => stack.push(f.id));

  const files = items.filter((i) => i.type === 'file');
  for (const file of files) {
    const name = file.metadata.name.toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
    if (!isPdf) continue; // nur PDFs
    total++;

    const base = getBaseName(file.metadata.name);
    const shouldSkip = ignoreExisting && hasTwinInFolder(items, base, saveOptions.targetLanguage);
    if (shouldSkip) {
      skipped++;
      continue;
    }
    selected.push({ file, parentId: current });
    if (previews.length < 10) previews.push(file.metadata.name); // Vorschau limitiert auf 10
  }
}

return { total, skipped, selected, previews };
```

### Häufige Gründe, warum Dateien “nicht erkannt” werden
- Ignore-Option: Mit “Ignore existing transformations” aktiv werden PDFs übersprungen, wenn im gleichen Ordner bereits ein Twin für die Ziel-Sprache existiert (`name.<lang>.md`).
- Root-Auswahl: Es wird ab dem aktuell geöffneten Ordner gescannt (`currentFolderIdAtom`). Nicht der Bibliotheks-Root? Dann bleiben andere Teilbäume außen vor.
- PDF-Erkennung: Nur wenn Endung `.pdf` ODER MIME `application/pdf`. Dateien ohne Endung/MIME werden nicht erkannt.
- Provider-Fehler: Fehler beim Auflisten eines Ordners werden geloggt und der Ordner wird übersprungen. Sieht man in den Logs.
- Pagination/Rate Limits (Cloud): Falls der Provider `listItemsById` nicht paginiert komplett liefert, fehlen Einträge in tiefen/umfangreichen Ordnern.
- Vorschau-Irrtum: Die Liste zeigt nur die ersten 10 Kandidaten, nicht alle. Die Kennzahl “Zu verarbeiten” ist maßgeblich.

### Was prüfen/ändern
- Im Dialog die Meldungen “Gesamt PDFs / Ignoriert / Zu verarbeiten” prüfen; bei vielen “Ignoriert” ggf. “Ignore existing transformations” deaktivieren.
- In den Logs nach “Fehler beim Listen eines Ordners” suchen; betroffene Ordner neu prüfen.
- Sicherstellen, dass Sie im gewünschten obersten Ordner sind, bevor Sie den Dialog öffnen.
- Provider: Prüfen, ob `listItemsById` vollständig paginiert und `mimeType` setzt. Bei OneDrive/Cloud ggf. Pagination in der Provider-Implementierung fixen.
- PDFs ohne `.pdf`-Endung: Endung ergänzen oder MIME zuverlässig bereitstellen.

Kurztest: In einem Test-Ordner mit 3 Unterordnern je 5 PDFs “Ignore existing” aus → “Zu verarbeiten” sollte 15 zeigen; mit je einem vorhandenen `name.de.md` in den gleichen Ordnern sollte “Ignoriert” steigen und “Zu verarbeiten” entsprechend sinken.

```typescriptreact
// rekursiver Scan (DFS mit Stack)
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
    continue; // Ordner wird ausgelassen, es wird weitergescannt
  }

  const folders = items.filter((i) => i.type === 'folder');
  folders.forEach((f) => stack.push(f.id));

  const files = items.filter((i) => i.type === 'file');
  for (const file of files) {
    const name = file.metadata.name.toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.metadata.mimeType?.toLowerCase() === 'application/pdf';
    if (!isPdf) continue; // nur PDFs
    total++;

    const base = getBaseName(file.metadata.name);
    const shouldSkip = ignoreExisting && hasTwinInFolder(items, base, saveOptions.targetLanguage);
    if (shouldSkip) {
      skipped++;
      continue;
    }
    selected.push({ file, parentId: current });
    if (previews.length < 10) previews.push(file.metadata.name); // Vorschau limitiert auf 10
  }
}

return { total, skipped, selected, previews };
```

---

**User**

In die Liste der erkannten Dokumente würde ich vielleicht noch verbessern. Da können wir für jedes Dokument einen kleinen Teaser machen, der in der oberen Zeile das relative Verzeichnis anzeigt, in der unteren Zeile den Dateinamen, und ist es möglich, eventuell auch die Anzahl der Seiten auszulesen. Steht das in den Metadaten einer Datei oder ist das komplexer?

---

**Cursor**

Ich ergänze jetzt im Dialog eine detailliertere Vorschau: Für die ersten 10 Kandidaten zeige ich relative Ordnerpfade (ab aktuellem Wurzelordner) in der ersten Zeile und den Dateinamen in der zweiten. Die Seitenzahl lese ich derzeit nicht aus, da sie nicht in den Metadaten steckt; das erfordert PDF-Parsing und wäre ein separater Schritt. Ich mache die UI-Anpassung jetzt.

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
import { TransformSaveOptions as SaveOptionsComponent } from '@/components/library/transform-save-options';
import type { TransformSaveOptions as SaveOptionsType } from '@/components/library/transform-save-options';
import { FileLogger } from '@/lib/debug/logger';

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

  const [ignoreExisting, setIgnoreExisting] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });

  // Optionen wie im Einzel-PDF-Dialog
  const [saveOptions, setSaveOptions] = useState<SaveOptionsType>({
    targetLanguage: 'de',
    fileName: '',
    createShadowTwin: true,
    fileExtension: 'md',
    extractionMethod: 'native',
    useCache: true,
    includeImages: false,
  });

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
        const shouldSkip = ignoreExisting && hasTwinInFolder(items, base, saveOptions.targetLanguage);
        if (shouldSkip) {
          skipped++;
          continue;
        }
        selected.push({ file, parentId: current });
        if (previews.length < 10) previews.push(file.metadata.name);
      }
    }

    return { total, skipped, selected, previews };
  }, [provider, getBaseName, ignoreExisting, hasTwinInFolder, saveOptions.targetLanguage]);

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
    }
  }, [open, handleScan]);

  const handleOptionsChange = useCallback((opts: SaveOptionsType) => {
    setSaveOptions({
      ...opts,
      extractionMethod: opts.extractionMethod || 'native',
      useCache: opts.useCache ?? true,
      includeImages: opts.includeImages ?? false,
    });
  }, []);

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      // Sequenzielles Anlegen von External-Jobs über unsere API-Route
      // Minimale Last, klare Reihenfolge (Secretary arbeitet der Reihe nach)
      for (const { file, parentId } of candidates) {
        try {
          const bin = await provider?.getBinary(file.id);
          if (!bin) continue;

          const pdfFile = new File([bin.blob], file.metadata.name, { type: bin.mimeType || 'application/pdf' });

          const form = new FormData();
          form.append('file', pdfFile);
          form.append('targetLanguage', saveOptions.targetLanguage || 'de');
          form.append('extractionMethod', saveOptions.extractionMethod || 'native');
          form.append('useCache', String(saveOptions.useCache ?? true));
          form.append('includeImages', String(saveOptions.includeImages ?? false));
          form.append('originalItemId', file.id);
          form.append('parentId', parentId);

          const res = await fetch('/api/secretary/process-pdf', {
            method: 'POST',
            headers: { 'X-Library-Id': activeLibraryId },
            body: form,
          });

          if (!res.ok) {
            const msg = await res.text().catch(() => 'unknown error');
            FileLogger.error('PdfBulkImportDialog', 'Job enqueue failed', { name: file.metadata.name, status: res.status, msg });
          } else {
            FileLogger.info('PdfBulkImportDialog', 'Job enqueued', { name: file.metadata.name });
          }
        } catch (error) {
          FileLogger.error('PdfBulkImportDialog', 'Fehler beim Enqueue für Datei', { fileId: file.id, error });
          // Weiter mit nächster Datei
        }
      }

      onOpenChange(false);
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates.length, saveOptions, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>PDF-Verzeichnis verarbeiten</DialogTitle>
          <DialogDescription>
            Wählen Sie Optionen wie beim Einzel-PDF-Dialog. Optional bereits transformierte PDFs ignorieren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="ignore-existing" checked={ignoreExisting} onCheckedChange={(v) => setIgnoreExisting(Boolean(v))} />
              <Label htmlFor="ignore-existing">Ignore existing transformations</Label>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <SaveOptionsComponent
              originalFileName={''}
              onOptionsChangeAction={handleOptionsChange}
              className="mb-0"
              showExtractionMethod={true}
              defaultExtractionMethod={saveOptions.extractionMethod || 'native'}
              showUseCache={true}
              defaultUseCache={saveOptions.useCache ?? true}
              showIncludeImages={true}
              defaultIncludeImages={saveOptions.includeImages ?? false}
            />
          </div>

          <div className="rounded-md border p-3">
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
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;



```

Ich habe die Vorschau im Batch-Dialog so erweitert, wie gewünscht: Oben steht jetzt der relative Ordnerpfad, darunter der Dateiname. Die ersten 10 Kandidaten werden so angezeigt.

- Wie ermittelt: Für jedes Top-Kandidaten-Item hole ich mit `provider.getPathItemsById(parentId)` die Ordnerkette und bilde daraus den Pfad relativ zum aktuell gescannten Root (`currentFolderIdAtom`). Falls der Pfad nicht auflösbar ist, zeige ich “.”.
- Vorschau bleibt auf 10 Einträge limitiert; die Zähler oben (“Gesamt/ Ignoriert/ Zu verarbeiten”) beziehen sich weiterhin auf alle gefundenen Dateien.

Zu Seitenzahlen: Die stehen nicht in unseren `StorageItemMetadata` und werden von gängigen Providern nicht bereitgestellt. Man muss das PDF parsen. Das ist komplexer und hat Performance-/Kostenfolgen.

Mögliche Wege für Seitenzahlen:
- Client-seitig: Für die Top-10-Kandidaten `provider.getBinary` laden und z. B. mit pdfjs im Browser Seiten zählen. Nachteil: Datenvolumen und CPU im Client.
- Server-seitig (empfohlen): Eine kleine API-Route, die das PDF per Provider lädt, Seitenzahl mit `pdfjs-dist`/`pdf-parse` ermittelt und cached. UI holt das lazy (on demand) und zeigt es, sobald verfügbar.
- Batch-vorberechnung: Im Hintergrund Seitenzahlen für alle Kandidaten in kleinen Wellen (Throttle) ermitteln und zwischenspeichern.

Soll ich die serverseitige Variante mit Caching für die Seitenzahl umsetzen? Dann baue ich eine kleine `GET /api/pdf/pages?itemId=&libraryId=`-Route und zeige die Zahl lazy neben jedem Eintrag.

