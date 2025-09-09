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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalPdfs: 0, skippedExisting: 0, toProcess: 0 });

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(false); // Phase 2
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(false); // Phase 3

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
    }
  }, [open, handleScan]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (candidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      // Sequenzielles Anlegen von External-Jobs über unsere API-Route
      // Minimale Last, klare Reihenfolge (Secretary arbeitet der Reihe nach)
      let okCount = 0; let failCount = 0;
      for (const { file, parentId } of candidates) {
        try {
          const bin = await provider?.getBinary(file.id);
          if (!bin) continue;

          const pdfFile = new File([bin.blob], file.metadata.name, { type: bin.mimeType || 'application/pdf' });

          const form = new FormData();
          form.append('file', pdfFile);
          // form.append('targetLanguage', saveOptions.targetLanguage || 'de'); // saveOptions was removed
          // form.append('extractionMethod', saveOptions.extractionMethod || 'native'); // saveOptions was removed
          // form.append('useCache', String(saveOptions.useCache ?? true)); // saveOptions was removed
          // form.append('includeImages', String(saveOptions.includeImages ?? false)); // saveOptions was removed
          form.append('originalItemId', file.id);
          form.append('parentId', parentId);

          const res = await fetch('/api/secretary/process-pdf', {
            method: 'POST',
            headers: { 'X-Library-Id': activeLibraryId },
            body: (() => {
              // Phase 1 ist immer aktiv (idempotent via Gates) → doExtractPDF true
              form.append('doExtractPDF', 'true');
              form.append('doExtractMetadata', String(!!runMetaPhase));
              form.append('doIngestRAG', String(!!runIngestionPhase));
              return form;
            })(),
          });

          if (!res.ok) {
            let msg = '';
            try {
              const ct = res.headers.get('content-type') || '';
              if (ct.includes('application/json')) {
                const j = await res.json();
                msg = typeof (j as { error?: unknown })?.error === 'string' ? (j as { error: string }).error : JSON.stringify(j);
              } else {
                msg = await res.text();
              }
            } catch {
              msg = res.statusText || 'unknown error';
            }
            const friendly = res.status === 503 ? 'Secretary Service nicht erreichbar' : msg || 'Unbekannter Fehler';
            FileLogger.error('PdfBulkImportDialog', 'Job enqueue failed', { file: file.metadata.name, status: res.status, statusText: res.statusText, message: friendly });
            failCount++;
            toast({ title: 'Fehler beim Starten', description: `${file.metadata.name}: ${res.status} ${friendly}`, variant: 'destructive' });
          } else {
            FileLogger.info('PdfBulkImportDialog', 'Job enqueued', { name: file.metadata.name });
            okCount++;
            toast({ title: 'Job gestartet', description: file.metadata.name });
          }
        } catch (error) {
          FileLogger.error('PdfBulkImportDialog', 'Fehler beim Enqueue für Datei', { fileId: file.id, error });
          failCount++;
          const msg = error instanceof Error ? error.message : 'unbekannter Fehler';
          toast({ title: 'Fehler beim Starten', description: `${file.metadata.name}: ${msg}`, variant: 'destructive' });
          // Weiter mit nächster Datei
        }
      }

      toast({ title: 'Batch abgeschlossen', description: `Gestartet: ${okCount}, fehlgeschlagen: ${failCount}` });
      onOpenChange(false);
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, candidates.length, runMetaPhase, runIngestionPhase, onOpenChange]);

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
                <Label htmlFor="phase-1">Phase 1: Extraktion (durch Gates idempotent)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-2" checked={runMetaPhase} onCheckedChange={(v) => setRunMetaPhase(Boolean(v))} />
                <Label htmlFor="phase-2">Phase 2: Metadaten (Template)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="phase-3" checked={runIngestionPhase} onCheckedChange={(v) => setRunIngestionPhase(Boolean(v))} />
                <Label htmlFor="phase-3">Phase 3: RAG-Ingestion</Label>
              </div>
            </div>
          </div>

          {/* PDF-Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

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
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;


