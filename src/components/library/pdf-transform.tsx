"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StorageItem } from "@/lib/storage/types";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAtomValue } from "jotai";
import { activeLibraryAtom, selectedFileAtom } from "@/atoms/library-atom";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TransformService, TransformResult, PdfTransformOptions } from "@/lib/transform/transform-service";
import { TransformSaveOptions as SaveOptionsType } from "@/components/library/transform-save-options";
import { TransformSaveOptions as SaveOptionsComponent } from "@/components/library/transform-save-options";
import { TransformResultHandler } from "@/components/library/transform-result-handler";
import { FileLogger } from "@/lib/debug/logger"
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface PdfTransformProps {
  onTransformComplete?: (text: string, twinItem?: StorageItem, updatedItems?: StorageItem[]) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function PdfTransform({ onTransformComplete, onRefreshFolder }: PdfTransformProps) {
  const item = useAtomValue(selectedFileAtom);
  const [isLoading, setIsLoading] = useState(false);
  const provider = useStorageProvider();
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const { refreshItems } = useStorage();
  const [templateOptions, setTemplateOptions] = useState<string[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Referenz für den TransformResultHandler
  const transformResultHandlerRef = useRef<(result: TransformResult) => void>(() => {});
  
  
  // Generiere Shadow-Twin Dateinamen nach Konvention
  // Nutze zentrale buildArtifactName() Logik (wird in TransformService verwendet)
  
  const defaultLanguage = "de";
  
  // Generiere Dateinamen mit zentraler Logik
  const getInitialFileName = (): string => {
    if (!item) return '';
    const artifactKey: ArtifactKey = {
      sourceId: item.id,
      kind: 'transcript',
      targetLanguage: defaultLanguage,
    };
    return buildArtifactName(artifactKey, item.metadata.name).replace(/\.md$/, '');
  };
  
  const [saveOptions, setSaveOptions] = useState<PdfTransformOptions>({
    targetLanguage: defaultLanguage,
    fileName: getInitialFileName(),
    createShadowTwin: true,
    fileExtension: "md",
    extractionMethod: "mistral_ocr", // Globaler Default: mistral_ocr
    useCache: true, // Standardwert: Cache verwenden
    includeOcrImages: undefined, // Wird basierend auf extractionMethod gesetzt
    includePageImages: undefined, // Wird basierend auf extractionMethod gesetzt
    includeImages: false, // Rückwärtskompatibilität
    useIngestionPipeline: false,
    template: undefined
  });

  // Lade Templates aus MongoDB und setze Default (pdfanalyse > erstes Template)
  const loadTemplates = useCallback(async () => {
    if (!activeLibrary?.id) return;
    try {
      setIsLoadingTemplates(true);
      // Verwende zentrale Client-Library für MongoDB-Templates
      const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
      const templateNames = await listAvailableTemplates(activeLibrary.id)
      setTemplateOptions(templateNames);

      // Default bestimmen: pdfanalyse > erstes Template
      const preferred = templateNames.find((n: string) => n.toLowerCase() === 'pdfanalyse');
      const chosen = preferred || templateNames[0] || undefined;
      setSaveOptions(prev => ({ ...prev, template: chosen }));
    } catch (e) {
      FileLogger.warn('PdfTransform', 'Templates konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) });
      setTemplateOptions([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [activeLibrary?.id]);

  // Templates laden bei Library-Wechsel
  useEffect(() => {
    void loadTemplates();
  }, [activeLibrary?.id, loadTemplates]);
  
  // Prüfe ob item vorhanden ist
  if (!item) {
    return (
      <div className="flex flex-col gap-4 p-4 text-center text-muted-foreground">
        Keine PDF-Datei ausgewählt
      </div>
    );
  }
  
  const handleTransform = async () => {
    FileLogger.info('PdfTransform', 'handleTransform aufgerufen mit saveOptions', saveOptions as unknown as Record<string, unknown>);
    
    if (!provider) {
      toast.error("Fehler", {
        description: "Kein Storage Provider verfügbar",
        duration: 7000
      });
      return;
    }

    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Aktive Bibliothek nicht gefunden",
        duration: 7000
      });
      return;
    }
    setIsLoading(true);

    try {
      // Datei vom Server laden
      const { blob } = await provider.getBinary(item.id);
      if (!blob) {
        throw new Error("Datei konnte nicht geladen werden");
      }

      // Konvertiere Blob zu File für die Verarbeitung
      const file = new File([blob], item.metadata.name, { type: item.metadata.mimeType });

      // Transformiere die PDF-Datei mit dem TransformService
      const result = await TransformService.transformPdf(
        file,
        item,
        saveOptions,
        provider,
        refreshItems,
        activeLibrary.id
      );

      FileLogger.info('PdfTransform', 'PDF Transformation abgeschlossen', {
        textLength: result.text.length,
        savedItemId: result.savedItem?.id,
        updatedItemsCount: result.updatedItems.length
      });

      // Asynchroner Fall: Side-Panel sofort via lokalem Event informieren (Fallback, falls SSE spät verbindet)
      if (!result.text && !result.savedItem && result.jobId) {
        try {
          window.dispatchEvent(new CustomEvent('job_update_local', {
            detail: {
              jobId: result.jobId,
              status: 'queued',
              message: 'queued',
              progress: 0,
              jobType: 'pdf',
              fileName: item.metadata.name,
              updatedAt: new Date().toISOString()
            }
          }));
        } catch {}
        return;
      }

      // Wenn wir einen onRefreshFolder-Handler haben, informiere die übergeordnete Komponente
      if (onRefreshFolder && item.parentId && result.updatedItems.length > 0) {
        FileLogger.info('PdfTransform', 'Informiere Library über aktualisierte Dateiliste', {
          folderId: item.parentId,
          itemsCount: result.updatedItems.length,
          savedItemId: result.savedItem?.id
        });
        onRefreshFolder(item.parentId, result.updatedItems, result.savedItem || undefined);
      } else {
        // Wenn kein onRefreshFolder-Handler da ist, rufen wir selbst den handleTransformResult auf
        transformResultHandlerRef.current(result);
      }
      
      // Falls onTransformComplete-Callback existiert, auch für Abwärtskompatibilität aufrufen
      if (onTransformComplete) {
        onTransformComplete(result.text, result.savedItem || undefined, result.updatedItems);
      }
    } catch (error) {
      FileLogger.error('PdfTransform', 'Fehler bei der PDF-Transformation', error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler bei der PDF-Verarbeitung'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOptionsChange = (options: SaveOptionsType) => {
    FileLogger.debug('PdfTransform', 'handleSaveOptionsChange aufgerufen mit', options as unknown as Record<string, unknown>);
    // Konvertiere zu PdfTransformOptions mit sicherer extractionMethod und useCache
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = options.extractionMethod === 'mistral_ocr';
    const pdfOptions: PdfTransformOptions = {
      ...options,
      // Globaler Default: mistral_ocr (wenn nichts gesetzt ist)
      extractionMethod: options.extractionMethod || "mistral_ocr",
      useCache: options.useCache ?? true, // Standardwert: Cache verwenden
      // Bei Mistral OCR: includePageImages immer true (erzwungen)
      includePageImages: options.includePageImages !== undefined
        ? options.includePageImages
        : (isMistralOcr ? true : undefined), // Standard: true für Mistral OCR
      includeOcrImages: options.includeOcrImages !== undefined 
        ? options.includeOcrImages 
        : (isMistralOcr ? true : undefined), // Standard: true für Mistral OCR
      includeImages: options.includeImages ?? false // Rückwärtskompatibilität
    };
    FileLogger.debug('PdfTransform', 'useCache Wert:', { useCache: pdfOptions.useCache });
    setSaveOptions(pdfOptions);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <TransformResultHandler
        onResultProcessed={() => {
          FileLogger.info('PdfTransform', 'PDF-Transformation vollständig abgeschlossen und Datei ausgewählt');
        }}
        childrenAction={(handleTransformResult: (result: TransformResult) => void, isProcessingResult: boolean) => {
          // Speichere die handleTransformResult-Funktion in der Ref
          transformResultHandlerRef.current = handleTransformResult;
          
          return (
            <>
              <SaveOptionsComponent 
                originalFileName={item.metadata.name}
                onOptionsChangeAction={handleSaveOptionsChange}
                className="mb-4"
                showExtractionMethod={true}
                defaultExtractionMethod="native"
                showUseCache={true}
                defaultUseCache={true}
                showIncludeOcrImages={true}
                showIncludePageImages={true}
                defaultIncludeOcrImages={saveOptions.extractionMethod === 'mistral_ocr' ? true : undefined}
                defaultIncludePageImages={saveOptions.extractionMethod === 'mistral_ocr' ? true : undefined}
                showIncludeImages={false} // Deprecated, verwende showIncludeOcrImages/showIncludePageImages
                defaultIncludeImages={false}
                showCreateShadowTwin={false}
              />

              <div className="flex items-center gap-2 mb-2">
                <input
                  id="useIngestionPipeline"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!saveOptions.useIngestionPipeline}
                  onChange={(e) => setSaveOptions(prev => ({ ...prev, useIngestionPipeline: e.target.checked }))}
                />
                <label htmlFor="useIngestionPipeline" className="text-sm text-muted-foreground">
                  Use Ingestion Pipeline (Template→MD→RAG automatisch)
                </label>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <label htmlFor="templateName" className="text-sm text-muted-foreground w-40">Template (erforderlich)</label>
                <select
                  id="templateName"
                  className="flex-1 h-8 rounded border bg-background px-2 text-sm"
                  value={saveOptions.template || ''}
                  onChange={(e) => setSaveOptions(prev => ({ ...prev, template: e.target.value || undefined }))}
                  disabled={isLoadingTemplates}
                >
                  {templateOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              
              <Button 
                onClick={handleTransform} 
                disabled={isLoading || isProcessingResult}
                className="w-full"
              >
                {isLoading ? "Wird verarbeitet..." : "PDF verarbeiten"}
              </Button>
            </>
          );
        }}
      />
    </div>
  );
} 