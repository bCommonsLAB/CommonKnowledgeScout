"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { StorageItem } from "@/lib/storage/types";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAtomValue } from "jotai";
import { activeLibraryAtom, selectedFileAtom } from "@/atoms/library-atom";
import { toast } from "sonner";
import type { TransformResult } from "@/lib/transform/transform-service";
import { TransformSaveOptions as SaveOptionsType } from "@/components/library/transform-save-options";
import { TransformSaveOptions as SaveOptionsComponent } from "@/components/library/transform-save-options";
import { TransformResultHandler } from "@/components/library/transform-result-handler";
import { getUserFriendlyVideoErrorMessage } from "@/lib/utils";
import { FileLogger } from "@/lib/debug/logger";
import { buildArtifactName } from "@/lib/shadow-twin/artifact-naming";
import type { ArtifactKey } from "@/lib/shadow-twin/artifact-types";

interface VideoTransformProps {
  onTransformComplete?: (text: string, twinItem?: StorageItem, updatedItems?: StorageItem[]) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function VideoTransform({ 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onTransformComplete: _onTransformComplete, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRefreshFolder: _onRefreshFolder 
}: VideoTransformProps) {
  const item = useAtomValue(selectedFileAtom);
  const [isLoading, setIsLoading] = useState(false);
  const provider = useStorageProvider();
  const activeLibrary = useAtomValue(activeLibraryAtom);
  
  // Referenz für den TransformResultHandler
  const transformResultHandlerRef = useRef<(result: TransformResult) => void>(() => {});
  
  // Generiere Shadow-Twin Dateinamen mit zentraler buildArtifactName Funktion
  const generateShadowTwinName = (sourceFileName: string, targetLanguage: string): string => {
    const artifactKey: ArtifactKey = {
      sourceId: 'placeholder', // Wird beim Speichern durch TransformService ersetzt
      kind: 'transcript',
      targetLanguage,
    };
    const artifactName = buildArtifactName(artifactKey, sourceFileName);
    // Entferne .md Extension für die UI-Anzeige (wird später wieder hinzugefügt)
    return artifactName.replace(/\.md$/, '');
  };
  
  const defaultLanguage = "de";
  
  const [saveOptions, setSaveOptions] = useState<SaveOptionsType>({
    targetLanguage: defaultLanguage,
    fileName: item ? generateShadowTwinName(item.metadata.name, defaultLanguage) : '',
    createShadowTwin: true,
    fileExtension: "md"
  });
  
  // Prüfe ob item vorhanden ist
  if (!item) {
    return (
      <div className="flex flex-col gap-4 p-4 text-center text-muted-foreground">
        Keine Video-Datei ausgewählt
      </div>
    );
  }
  
  const handleTransform = async () => {
    FileLogger.info('VideoTransform', 'handleTransform aufgerufen mit saveOptions', saveOptions as unknown as Record<string, unknown>);
    
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
      // V3/External Jobs: Video wird als Job enqueued (Orchestrierung via Worker + SSE)
      const res = await fetch('/api/secretary/process-video/job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Library-Id': activeLibrary.id,
        },
        body: JSON.stringify({
          originalItemId: item.id,
          parentId: item.parentId || 'root',
          fileName: item.metadata.name,
          mimeType: item.metadata.mimeType,
          targetLanguage: saveOptions.targetLanguage,
          sourceLanguage: 'auto',
          useCache: true,
          template: 'Besprechung',
          policies: {
            extract: 'do',
            metadata: 'do',
            ingest: 'do',
          },
        }),
      })

      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const msg = typeof (json as { error?: unknown }).error === 'string' ? (json as { error: string }).error : `HTTP ${res.status}`
        throw new Error(msg)
      }

      const jobId = typeof (json as { job?: { id?: unknown } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : ''
      if (!jobId) throw new Error('Job-ID fehlt in Response')

      try {
        window.dispatchEvent(new CustomEvent('job_update_local', {
          detail: {
            jobId,
            status: 'queued',
            message: 'queued',
            progress: 0,
            jobType: 'video',
            fileName: item.metadata.name,
            sourceItemId: item.id,
            updatedAt: new Date().toISOString(),
            libraryId: activeLibrary.id,
          }
        }))
      } catch {}

      FileLogger.info('VideoTransform', 'Job enqueued (Video)', { jobId })
      toast.success('Job gestartet', { description: 'Transkription läuft im Hintergrund. Ergebnis erscheint nach Abschluss im Shadow‑Twin.' })
    } catch (error) {
      FileLogger.error('VideoTransform', 'Fehler bei der Video-Transformation', error);
      toast.error("Fehler", {
        description: getUserFriendlyVideoErrorMessage(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOptionsChange = (options: SaveOptionsType) => {
    FileLogger.debug('VideoTransform', 'handleSaveOptionsChange aufgerufen mit', options as unknown as Record<string, unknown>);
    setSaveOptions(options);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <TransformResultHandler
        onResultProcessed={() => {
          FileLogger.info('VideoTransform', 'Video-Transkription vollständig abgeschlossen und Datei ausgewählt');
        }}
        childrenAction={(handleTransformResult, isProcessingResult) => {
          // Speichere die handleTransformResult-Funktion in der Ref
          transformResultHandlerRef.current = handleTransformResult;
          
          return (
            <>
              <SaveOptionsComponent 
                originalFileName={item.metadata.name}
                onOptionsChangeAction={handleSaveOptionsChange}
                className="mb-4"
                showUseCache={true}
                defaultUseCache={true}
              />
              
              <Button 
                onClick={handleTransform} 
                disabled={isLoading || isProcessingResult}
                className="w-full"
              >
                {isLoading ? "Wird transkribiert..." : "Transkribieren"}
              </Button>
            </>
          );
        }}
      />
    </div>
  );
} 