'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, currentFolderIdAtom, activeLibraryAtom } from '@/atoms/library-atom';
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
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants';
// Zentrale Medientyp-Erkennung für alle unterstützten Dateitypen
import { getMediaKind, isPipelineSupported } from '@/lib/media-types';
// Shadow-Twin-Ordner erkennen (Prefix '_' oder '.'), damit sie beim Scan übersprungen werden
import { isShadowTwinFolderName } from '@/lib/storage/shadow-twin';

// Rückwärtskompatible Props-Benennung (Dialog unterstützt jetzt alle Medientypen)
interface PdfBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanStats {
  // Umbenannt für Medientyp-Neutralität
  totalFiles: number;
  skippedExisting: number;
  toProcess: number;
}

export function PdfBulkImportDialog({ open, onOpenChange }: PdfBulkImportDialogProps) {
  const { provider } = useStorage();
  const rootFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const pdfOverrides = useAtomValue(pdfOverridesAtom);
  
  // Lade targetLanguage aus Library-Config (config.chat.targetLanguage)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage;
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.template;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [candidates, setCandidates] = useState<Array<{ file: StorageItem; parentId: string }>>([]);
  const [previewItems, setPreviewItems] = useState<Array<{ id: string; name: string; relPath: string; pages?: number }>>([]);
  const [stats, setStats] = useState<ScanStats>({ totalFiles: 0, skippedExisting: 0, toProcess: 0 });
  const [batchName, setBatchName] = useState<string>('');
  // Set mit IDs der abgewaehlten Dateien (standardmaessig alle ausgewaehlt)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Phasensteuerung: Standard nur Phase 1 (Extraktion)
  const [runMetaPhase, setRunMetaPhase] = useState<boolean>(true); // Phase 2 standardmäßig aktiv
  const [runIngestionPhase, setRunIngestionPhase] = useState<boolean>(true); // Phase 3 standardmäßig aktiv
  // Erzwingen pro Phase
  const [forceExtract, setForceExtract] = useState<boolean>(false);
  const [forceMeta, setForceMeta] = useState<boolean>(false);
  // Cover-Bild-Generierung (aus Library-Config initialisiert)
  const [generateCoverImage, setGenerateCoverImage] = useState<boolean>(false);

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
        FileLogger.error('MediaBatchDialog', 'Fehler beim Listen eines Ordners', { folderId: current, error });
        continue;
      }

      // Shadow-Twin-Ordner (Prefix '_' oder '.') überspringen – diese enthalten
      // nur generierte Artefakte und keine zu verarbeitenden Quelldateien.
      const folders = items.filter(
        (i) => i.type === 'folder' && !isShadowTwinFolderName(i.metadata.name)
      );
      folders.forEach((f) => stack.push(f.id));

      const files = items.filter((i) => i.type === 'file');
      for (const file of files) {
        // Zentrale Medientyp-Erkennung: unterstützt PDF, Audio, Video, Markdown
        const mediaKind = getMediaKind(file);
        const isSupported = isPipelineSupported(mediaKind);
        if (!isSupported) continue;
        total++;

        const base = getBaseName(file.metadata.name);
        const defaults = activeLibraryId ? loadPdfDefaults(activeLibraryId) : {};
        const lang = (defaults as { targetLanguage?: string }).targetLanguage || TARGET_LANGUAGE_DEFAULT;
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
  }, [provider, getBaseName, hasTwinInFolder, activeLibraryId]);

  const handleScan = useCallback(async () => {
    if (!provider || !rootFolderId) return;
    setIsScanning(true);
    setCandidates([]);
    setPreviewItems([]);
    try {
      const result = await scanFolder(rootFolderId);
      setCandidates(result.selected);
      setExcludedIds(new Set());
      // Vorschau-Details fuer alle Kandidaten berechnen
      const details: Array<{ id: string; name: string; relPath: string; pages?: number }> = [];
      // Pfad-Cache: parentId -> relPath (vermeidet redundante API-Aufrufe)
      const pathCache = new Map<string, string>();
      for (const { file, parentId } of result.selected) {
        let relPath = pathCache.get(parentId);
        if (relPath === undefined) {
          try {
            const chain = await provider.getPathItemsById(parentId);
            const idx = chain.findIndex((it) => it.id === rootFolderId);
            const start = idx >= 0 ? idx + 1 : 1;
            const parts = chain.slice(start).map((it) => it.metadata.name).filter(Boolean);
            relPath = parts.length ? parts.join('/') : '.';
          } catch {
            relPath = '.';
          }
          pathCache.set(parentId, relPath);
        }
        details.push({ id: file.id, name: file.metadata.name, relPath });
      }
      setPreviewItems(details);
      setStats({ totalFiles: result.total, skippedExisting: result.skipped, toProcess: result.selected.length });
    } finally {
      setIsScanning(false);
    }
  }, [provider, rootFolderId, scanFolder]);

  useEffect(() => {
    if (open) {
      // Beim Öffnen immer Standard setzen: alle Phasen an, Erzwingen aus
      setRunMetaPhase(true);
      setRunIngestionPhase(true);
      setForceExtract(false);
      setForceMeta(false);
      // Cover-Bild aus Library-Config initialisieren
      setGenerateCoverImage(activeLibrary?.config?.secretaryService?.generateCoverImage === true);
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
  }, [open, handleScan, provider, rootFolderId]);

  // keine lokale Optionsbearbeitung nötig; Änderungen erfolgen im Settings-Dialog

  // Gefilterte Kandidaten: nur ausgewaehlte Dateien (nicht in excludedIds)
  const selectedCandidates = useMemo(
    () => candidates.filter((c) => !excludedIds.has(c.file.id)),
    [candidates, excludedIds]
  );

  const handleEnqueue = useCallback(async () => {
    if (!activeLibraryId) return;
    if (selectedCandidates.length === 0) return;
    setIsEnqueuing(true);
    try {
      const defaults = getEffectivePdfDefaults(
        activeLibraryId,
        loadPdfDefaults(activeLibraryId),
        pdfOverrides,
        libraryConfigChatTargetLanguage,
        libraryConfigPdfTemplate
      );
      
      // Neues Unified Pipeline Payload-Format
      const payload = {
        libraryId: activeLibraryId,
        batchName: (batchName || '').trim() || undefined,
        // Pipeline-Konfiguration
        config: {
          // Phasen-Aktivierung
          phases: {
            extract: true, // Phase 1 immer aktiv im Batch
            template: runMetaPhase,
            ingest: runIngestionPhase,
          },
          // Policies
          policies: {
            extract: forceExtract ? 'force' : 'do',
            metadata: runMetaPhase ? (forceMeta ? 'force' : 'do') : 'ignore',
            ingest: runIngestionPhase ? 'do' : 'ignore',
          },
          // Template und Sprache
          templateName: typeof defaults.template === 'string' ? defaults.template : undefined,
          targetLanguage: typeof defaults.targetLanguage === 'string' ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT,
          // Cover-Bild (nur wenn Phase 2 aktiv)
          generateCoverImage: runMetaPhase && generateCoverImage,
          coverImagePrompt: activeLibrary?.config?.secretaryService?.coverImagePrompt,
        },
        // Items fuer Batch-Verarbeitung (nur ausgewaehlte Dateien)
        items: selectedCandidates.map(({ file, parentId }) => ({ 
          fileId: file.id, 
          parentId, 
          name: file.metadata.name, 
          mimeType: file.metadata.mimeType 
        })),
        // PDF-spezifische Optionen (werden nur für PDFs verwendet)
        extractionMethod: typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr',
        includeOcrImages: defaults.includeOcrImages ?? true,
        includePageImages: defaults.includePageImages ?? true,
        useCache: defaults.useCache ?? true,
      };
      
      // Neuer Unified Pipeline Endpoint (unterstützt alle Medientypen)
      const requestPromise = fetch('/api/pipeline/process', {
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
        // Neues Response-Format vom Unified Endpoint
        const successCount = Number((json as { successCount?: number }).successCount || 0);
        const failureCount = Number((json as { failureCount?: number }).failureCount || 0);
        toast({ title: 'Batch gestartet', description: `Gestartet: ${successCount}, fehlgeschlagen: ${failureCount}` });
      }
    } finally {
      setIsEnqueuing(false);
    }
  }, [activeLibraryId, activeLibrary, selectedCandidates, runMetaPhase, runIngestionPhase, forceExtract, forceMeta, generateCoverImage, batchName, onOpenChange, pdfOverrides]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Verzeichnis verarbeiten</span>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Standardwerte öffnen">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Verarbeitet alle unterstützten Dateitypen (PDF, Audio, Video, Markdown) im aktuellen Verzeichnis.
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
                      const eff = getEffectivePdfDefaults(
                        activeLibraryId,
                        loadPdfDefaults(activeLibraryId),
                        pdfOverrides,
                        libraryConfigChatTargetLanguage,
                        libraryConfigPdfTemplate
                      );
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
                      const eff = getEffectivePdfDefaults(
                        activeLibraryId,
                        loadPdfDefaults(activeLibraryId),
                        pdfOverrides,
                        libraryConfigChatTargetLanguage,
                        libraryConfigPdfTemplate
                      );
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
              {/* Cover-Bild-Generierung - nur relevant wenn Phase 2 aktiv */}
              {runMetaPhase && (
                <div className="flex items-center gap-2 mt-2 pl-6 border-l-2 border-muted">
                  <Checkbox 
                    id="generate-cover-image" 
                    checked={generateCoverImage} 
                    onCheckedChange={(v) => setGenerateCoverImage(Boolean(v))} 
                  />
                  <Label htmlFor="generate-cover-image">Cover-Bild generieren</Label>
                </div>
              )}
            </div>
          </div>

          {/* Standardwerte werden aus der Library geladen; Anpassung über das Zahnrad oben */}

          <div className="rounded-md border p-3">
            <div className="mb-2">
              <Label htmlFor="batch-name">Batch-Name</Label>
              <input id="batch-name" className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="z.B. Ordnername" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-4">
                <div>
                  <span className="text-muted-foreground">Gesamt Dateien:</span> <span className="font-medium">{stats.totalFiles}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignoriert:</span> <span className="font-medium">{stats.skippedExisting}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ausgewählt:</span>{' '}
                  <span className="font-medium">{previewItems.length - excludedIds.size} / {previewItems.length}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleScan} disabled={isScanning}>
                {isScanning ? 'Scan läuft…' : 'Neu scannen'}
              </Button>
            </div>
            <Separator className="my-3" />
            {previewItems.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setExcludedIds(new Set())}
                  disabled={excludedIds.size === 0}
                >
                  Alle auswählen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setExcludedIds(new Set(previewItems.map((it) => it.id)))}
                  disabled={excludedIds.size === previewItems.length}
                >
                  Keine auswählen
                </Button>
              </div>
            )}
            <ScrollArea className="h-52">
              {previewItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>
              ) : (
                <ul className="text-sm space-y-1">
                  {previewItems.map((it) => {
                    const isSelected = !excludedIds.has(it.id);
                    return (
                      <li
                        key={it.id}
                        className={`flex items-start gap-2 rounded px-1 py-1 cursor-pointer hover:bg-muted/50 ${!isSelected ? 'opacity-50' : ''}`}
                        onClick={() => {
                          setExcludedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(it.id)) next.delete(it.id);
                            else next.add(it.id);
                            return next;
                          });
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="mt-1 shrink-0"
                          onCheckedChange={(checked) => {
                            setExcludedIds((prev) => {
                              const next = new Set(prev);
                              if (checked) next.delete(it.id);
                              else next.add(it.id);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-muted-foreground text-xs truncate">{it.relPath}</div>
                          <div className="font-medium break-all">{it.name}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnqueuing || isScanning}>Abbrechen</Button>
          <Button onClick={handleEnqueue} disabled={isEnqueuing || isScanning || selectedCandidates.length === 0}>
            {isEnqueuing ? 'Wird gestartet…' : `Jobs starten (${selectedCandidates.length})`}
          </Button>
        </DialogFooter>
        <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </DialogContent>
    </Dialog>
  );
}

export default PdfBulkImportDialog;


