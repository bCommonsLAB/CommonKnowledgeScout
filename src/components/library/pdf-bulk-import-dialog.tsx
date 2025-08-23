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
      // HINWEIS: Der eigentliche Enqueue erfolgt gegen die Secretary-API (/jobs/batch).
      // Hier nur Platzhalter-Implementierung. Die konkrete API-Integration folgt im nächsten Schritt.
      FileLogger.info('PdfBulkImportDialog', 'Enqueue planned items', {
        libraryId: activeLibraryId,
        count: candidates.length,
        options: saveOptions as unknown as Record<string, unknown>,
      });
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


