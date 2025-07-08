'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Loader2, FolderOpen, Download, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Batch, Job } from '@/types/event-job';
import { useAtom } from 'jotai';
import { activeLibraryAtom, currentPathAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';

interface ArchiveProgress {
  current: number;
  total: number;
  status: string;
  currentJob?: string;
}

interface ArchiveResult {
  success: Array<{
    jobId: string;
    sessionName: string;
    filesCreated: number;
    markdownPath: string;
    assetsPath: string;
  }>;
  failed: Array<{
    jobId: string;
    sessionName: string;
    error: string;
  }>;
  totalFiles: number;
}

interface BatchArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: Batch; // Optional für Multi-Batch-Modus
  batches?: Batch[]; // Neue Prop für Multi-Batch-Modus
  completedJobs: Job[];
  onArchiveComplete: (result: ArchiveResult) => void;
  isMultiBatch?: boolean; // Neue Prop für Multi-Batch-Modus
}

export default function BatchArchiveDialog({
  open,
  onOpenChange,
  batch,
  batches = [],
  completedJobs,
  onArchiveComplete,
  isMultiBatch = false
}: BatchArchiveDialogProps) {
  const [activeLibrary] = useAtom(activeLibraryAtom);
  const [currentPath] = useAtom(currentPathAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const { provider } = useStorage();
  const [preserveZipStructure, setPreserveZipStructure] = useState(true);
  const [flattenStructure, setFlattenStructure] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ArchiveProgress>({ current: 0, total: 0, status: '' });

  // Archive-Dialog funktioniert nur mit aktiver Library - keine Fallbacks!

  // Filtere Jobs mit Archiven im Dialog
  const jobsWithArchives = completedJobs.filter(job => job.results?.archive_data);

  // Debug-Ausgaben für Library und Jobs
  useEffect(() => {
    if (open) {
      console.log('[Archive Dialog Debug]:');
      console.log('  - Multi-Batch Mode:', isMultiBatch);
      console.log('  - Batches Count:', batches.length);
      console.log('  - Active Library:', activeLibrary);
      console.log('  - Active Library ID from Atom:', activeLibrary?.id);
      console.log('  - Current Path:', currentPath);
      console.log('  - Current Path String:', currentPath.map(item => item.metadata.name).join('/'));
      console.log('  - Current Path Length:', currentPath.length);
      console.log('  - Current Folder ID:', currentFolderId);
      console.log('  - Storage Provider:', provider);
      console.log('  - Completed Jobs:', completedJobs.length);
      console.log('  - Jobs with Archives:', jobsWithArchives.length);
      
      // KRITISCHER FEHLER: Wenn keine aktive Library vorhanden ist
      if (!activeLibrary) {
        console.error('❌ FEHLER: Keine aktive Library! Das ist ein Anwendungsfehler.');
      }
      
      // Debug: Zeige Details der ersten 3 Jobs
      completedJobs.slice(0, 3).forEach((job, index) => {
        console.log(`  - Job ${index + 1}:`, {
          job_id: job.job_id,
          has_results: !!job.results,
          results_keys: job.results ? Object.keys(job.results) : [],
          has_archive_data: !!job.results?.archive_data,
          archive_data_length: job.results?.archive_data ? job.results.archive_data.length : 0
        });
      });

      // Aktive Library ist erforderlich - keine Fallbacks!
      if (!activeLibrary) {
        console.error('❌ KRITISCHER FEHLER: Keine aktive Library gefunden! Archive kann nicht gespeichert werden.');
      } else {
        console.log('✅ Active library found:', {
          id: activeLibrary.id,
          label: activeLibrary.label,
          type: activeLibrary.type
        });
      }
    }
  }, [open, isMultiBatch, batches, activeLibrary, currentPath, completedJobs, jobsWithArchives]);

  // Archive-Dialog erfordert immer eine aktive Library - keine Fallback-Logik!

  // Verwende nur die aktive Library - keine Fallbacks!
  const effectiveLibrary = activeLibrary;
  const effectiveLibraryId = activeLibrary?.id;

  // Aktueller Pfad als String für Anzeige und als Zielverzeichnis
  const currentPathString = currentPath.map(item => item.metadata.name).join('/');
  
  // WICHTIG: Entferne Library-Namen aus dem Pfad falls er doppelt ist
  // currentPath kann so aussehen: ['Onedrive Test', 'Neuer Ordner'] 
  // Aber effectiveLibrary.label ist schon 'Onedrive Test'
  let targetPathFromLibrary = currentPathString || '';
  
  // Entferne Library-Namen wenn er am Anfang steht
  if (effectiveLibrary && targetPathFromLibrary.startsWith(effectiveLibrary.label + '/')) {
    targetPathFromLibrary = targetPathFromLibrary.substring(effectiveLibrary.label.length + 1);
  } else if (effectiveLibrary && targetPathFromLibrary === effectiveLibrary.label) {
    targetPathFromLibrary = '';
  }
  
  console.log('[Archive Dialog] Path processing:', {
    currentPathString,
    libraryLabel: effectiveLibrary?.label,
    targetPathFromLibrary
  });

  // Extrahiere Event-Name aus Batch-Name
  const extractEventName = (batchName: string): string => {
    const dashIndex = batchName.indexOf(' - ');
    if (dashIndex > 0) {
      return batchName.substring(0, dashIndex);
    }
    return batchName;
  };

  // Extrahiere Track-Name aus Batch-Name
  const extractTrackName = (batchName: string): string => {
    const dashIndex = batchName.indexOf(' - ');
    if (dashIndex > 0) {
      const parenthesisIndex = batchName.lastIndexOf(' (');
      if (parenthesisIndex > dashIndex) {
        return batchName.substring(dashIndex + 3, parenthesisIndex);
      } else {
        return batchName.substring(dashIndex + 3);
      }
    }
    return '';
  };

  // Archive-Verarbeitung starten
  const handleArchiveJobs = async () => {
    if (!effectiveLibrary || processing || jobsWithArchives.length === 0) return;

    try {
      setProcessing(true);
      setProgress({ current: 0, total: jobsWithArchives.length, status: 'Starte Archivierung...' });

      const result = await processJobArchives();
      onArchiveComplete(result);

    } catch (error) {
      console.error('Fehler bei der Archivierung:', error);
      alert(`Fehler bei der Archivierung: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setProcessing(false);
      setProgress({ current: 0, total: 0, status: '' });
    }
  };

  // Jobs verarbeiten
  const processJobArchives = async (): Promise<ArchiveResult> => {
    const result: ArchiveResult = {
      success: [],
      failed: [],
      totalFiles: 0
    };

    // WICHTIG: Verwende KEINEN zusätzlichen Pfad - der Storage Provider ist bereits im richtigen Verzeichnis!
    // currentFolderId zeigt bereits auf das gewünschte Zielverzeichnis
    const baseDirectory = ''; // Leer = direkt im aktuellen Verzeichnis

    for (let i = 0; i < jobsWithArchives.length; i++) {
      const job = jobsWithArchives[i];
      const sessionName = job.parameters?.session || job.job_name || `Job-${job.job_id}`;

      try {
        setProgress({
          current: i + 1,
          total: jobsWithArchives.length,
          status: `Verarbeite: ${sessionName}`,
          currentJob: sessionName
        });

        const jobResult = await processJobArchive(job, baseDirectory);
        
        result.success.push({
          jobId: job.job_id,
          sessionName,
          filesCreated: jobResult.filesCreated,
          markdownPath: jobResult.markdownPath,
          assetsPath: jobResult.assetsPath
        });
        
        result.totalFiles += jobResult.filesCreated;

      } catch (error) {
        console.error(`Fehler beim Verarbeiten von Job ${job.job_id}:`, error);
        result.failed.push({
          jobId: job.job_id,
          sessionName,
          error: error instanceof Error ? error.message : 'Unbekannter Fehler'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return result;
  };

  // Einzelnes Job-Archiv verarbeiten - ANGEPASST FÜR NEUE ZIP-STRUKTUR
  const processJobArchive = async (
    job: Job, 
    baseDirectory: string
  ): Promise<{ filesCreated: number; markdownPath: string; assetsPath: string }> => {
    if (!job.results?.archive_data || !job.results?.archive_filename) {
      throw new Error(`Job ${job.job_id} hat kein Archiv`);
    }

    // Archiv herunterladen
    const response = await fetch(`/api/event-job/jobs/${job.job_id}/download-archive`);
    if (!response.ok) {
      throw new Error(`Archive download failed: ${response.statusText}`);
    }

    const archiveBlob = await response.blob();
    const archiveBuffer = await archiveBlob.arrayBuffer();

    // ZIP extrahieren
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const zipFile = await zip.loadAsync(archiveBuffer);

    let filesCreated = 0;
    let markdownPath = '';
    let assetsPath = '';

    // NEUE STRUKTUR VERSTEHEN: sessions/Event_Name/assets/ und sessions/Event_Name/LANGUAGE/Track_Name/
    for (const [filename, zipEntry] of Object.entries(zipFile.files)) {
      if (zipEntry.dir) continue;

      const content = await zipEntry.async('uint8array');
      let targetPath: string;

      if (preserveZipStructure && !flattenStructure) {
        // Original ZIP-Struktur beibehalten - direkt im aktuellen Verzeichnis
        targetPath = filename;
      } else if (flattenStructure) {
        // Flache Struktur: Alle Dateien in einen Session-Ordner
        const sessionName = sanitizeFilename(
          job.parameters?.session || job.job_name || `job-${job.job_id}`
        );
        const filenameOnly = filename.split('/').pop() || filename;
        targetPath = `${sessionName}/${filenameOnly}`;
      } else {
        // Angepasste Struktur: Entferne "sessions/" Präfix, behalte Event/Language/Track
        targetPath = filename.startsWith('sessions/') 
          ? filename.substring('sessions/'.length)
          : filename;
      }

      console.log('[Archive Processing] File path mapping:', {
        originalFilename: filename,
        targetPath,
        preserveZipStructure,
        flattenStructure,
        baseDirectory // sollte leer sein
      });

      // Datei speichern
      await uploadFileToStorage(targetPath, content, filename.split('/').pop() || filename);
      filesCreated++;

      // Pfade für Reporting merken
      if (filename.endsWith('.md')) {
        markdownPath = targetPath;
      } else if (filename.includes('/assets/') && !assetsPath) {
        assetsPath = targetPath.split('/').slice(0, -1).join('/'); // Verzeichnis ohne Dateinamen
      }
    }

    return { filesCreated, markdownPath, assetsPath };
  };

  // Datei in Storage speichern - verwendet den Storage Provider wie in der Library
  const uploadFileToStorage = async (
    targetPath: string,
    content: Uint8Array,
    filename: string
  ): Promise<void> => {
    if (!provider) {
      throw new Error('Kein Storage Provider verfügbar');
    }

    const mimeType = getMimeType(filename);
    
    console.log('[Archive Upload] Starting upload:', {
      filename,
      targetPath,
      libraryType: effectiveLibrary?.type,
      libraryId: effectiveLibraryId,
      currentFolderId,
      hasProvider: !!provider,
      mimeType,
      contentSize: content.length
    });

    try {
      // Datei-Objekt erstellen
      const file = new File([content], filename, { type: mimeType });

      // Verzeichnis-Struktur erstellen und navigieren
      const targetFolderId = await ensureDirectoryPath(targetPath);
      
      console.log('[Archive Upload] About to upload file:', {
        filename,
        targetFolderId,
        fileSize: file.size,
        fileType: file.type
      });
      
      // Datei mit Storage Provider hochladen - genau wie in der Library!
      const result = await provider.uploadFile(targetFolderId, file);
      
      console.log('[Archive Upload] Upload successful:', {
        filename,
        targetPath,
        targetFolderId,
        result
      });
    } catch (error) {
      console.error('[Archive Upload] Upload failed:', {
        filename,
        targetPath,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  };

  // Stelle sicher, dass der Verzeichnispfad existiert und gib die Ziel-Folder-ID zurück
  const ensureDirectoryPath = async (targetPath: string): Promise<string> => {
    if (!provider) {
      throw new Error('Kein Storage Provider verfügbar');
    }

    // Verwende Root als Fallback wenn currentFolderId leer ist
    const rootFolderId = currentFolderId || 'root';
    
    console.log('[Archive Upload] ensureDirectoryPath:', {
      targetPath,
      currentFolderId,
      rootFolderId,
      libraryType: effectiveLibrary?.type
    });

    // Wenn kein Pfad angegeben, verwende aktuelles Verzeichnis oder Root
    if (!targetPath || !targetPath.includes('/')) {
      console.log('[Archive Upload] Using root folder ID:', rootFolderId);
      return rootFolderId;
    }

    // Pfad in Teile aufteilen
    const pathParts = targetPath.split('/').filter(part => part.length > 0);
    if (pathParts.length === 0) {
      console.log('[Archive Upload] Empty path parts, using root folder ID:', rootFolderId);
      return rootFolderId;
    }

    // Entferne Dateinamen (letzter Teil)
    const directoryParts = pathParts.slice(0, -1);
    if (directoryParts.length === 0) {
      console.log('[Archive Upload] No directory parts, using root folder ID:', rootFolderId);
      return rootFolderId;
    }

    // Navigiere durch die Verzeichnisstruktur, erstelle Ordner falls nötig
    let parentFolderId = rootFolderId;
    
    for (const directoryName of directoryParts) {
      try {
        // Liste aktuelle Ordnerinhalte
        const items = await provider.listItemsById(parentFolderId);
        
        // Suche nach existierendem Ordner
        const existingFolder = items.find(item => 
          item.type === 'folder' && 
          item.metadata.name === directoryName
        );

        if (existingFolder) {
          // Verwende existierenden Ordner
          parentFolderId = existingFolder.id;
          console.log('[Archive Upload] Using existing folder:', {
            name: directoryName,
            id: existingFolder.id
          });
        } else {
          // Erstelle neuen Ordner
          const newFolder = await provider.createFolder(parentFolderId, directoryName);
          parentFolderId = newFolder.id;
          console.log('[Archive Upload] Created new folder:', {
            name: directoryName,
            id: newFolder.id,
            parentId: parentFolderId
          });
        }
      } catch (error) {
        console.error(`Fehler beim Erstellen/Finden von Ordner "${directoryName}":`, error);
        throw new Error(`Konnte Verzeichnis "${directoryName}" nicht erstellen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
      }
    }

    return parentFolderId;
  };

  // Dateiname bereinigen
  const sanitizeFilename = (filename: string): string => {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);
  };

  // MIME-Type bestimmen
  const getMimeType = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'md': 'text/markdown',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'txt': 'text/plain'
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  };

  const handleClose = () => {
    if (!processing) {
      onOpenChange(false);
    }
  };

  const eventName = extractEventName(batch?.batch_name || '');
  const trackName = extractTrackName(batch?.batch_name || '');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            {isMultiBatch ? 'Alle gefilterten Batches in Library speichern' : 'Jobs in Library speichern'}
          </DialogTitle>
          <DialogDescription>
            {isMultiBatch ? (
              <>
                {jobsWithArchives.length} von {completedJobs.length} abgeschlossene Jobs aus 
                {batches.length} gefilterten Batches haben Archive und können gespeichert werden.
                {completedJobs.length === 0 && (
                  <div className="mt-2 text-amber-600">
                    Keine abgeschlossenen Jobs gefunden. Stellen Sie sicher, dass die Jobs erfolgreich verarbeitet wurden.
                  </div>
                )}
              </>
            ) : (
              <>
                {jobsWithArchives.length} von {completedJobs.length} abgeschlossene Jobs aus 
                &quot;{batch?.batch_name}&quot; haben Archive und können gespeichert werden.
                {completedJobs.length === 0 && (
                  <div className="mt-2 text-amber-600">
                    Keine abgeschlossenen Jobs gefunden. Stellen Sie sicher, dass die Jobs erfolgreich verarbeitet wurden.
                  </div>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Debug-Informationen für Jobs ohne Archive */}
          {completedJobs.length > 0 && jobsWithArchives.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Keine Archive verfügbar</p>
                  <p>Die abgeschlossenen Jobs haben keine ZIP-Archive generiert.</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">Job-Details anzeigen</summary>
                    <div className="mt-2 space-y-1 text-xs">
                      {completedJobs.slice(0, 5).map(job => (
                        <div key={job.job_id} className="border-l-2 border-amber-300 pl-2">
                          <p><strong>{job.job_name || job.job_id}</strong></p>
                          <p>Status: {job.status}</p>
                          <p>Results: {job.results ? Object.keys(job.results).join(', ') : 'Keine'}</p>
                          <p>Archive: {job.results?.archive_data ? '✓ Vorhanden' : '✗ Fehlt'}</p>
                        </div>
                      ))}
                      {completedJobs.length > 5 && (
                        <p className="text-gray-600">... und {completedJobs.length - 5} weitere</p>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}

          {/* ZIP-Struktur Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Neue ZIP-Archiv-Struktur</p>
                <p>Die Archive verwenden jetzt die Struktur: sessions/Event/assets/ und sessions/Event/LANGUAGE/Track/</p>
              </div>
            </div>
          </div>

          {/* Ziel-Library und Verzeichnis */}
          {effectiveLibrary ? (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <FolderOpen className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="text-sm text-green-800 dark:text-green-200">
                  <p className="font-medium">Ziel-Library & Verzeichnis</p>
                  <p><strong>{effectiveLibrary.label}</strong> ({effectiveLibrary.type})</p>
                  <div className="mt-2 p-2 bg-green-100 dark:bg-green-800/30 rounded border">
                    <p className="text-xs font-medium">Zielverzeichnis:</p>
                    <p className="font-mono text-sm">
                      {!targetPathFromLibrary ? 
                        `📁 ${effectiveLibrary.label}/ (Root)` : 
                        `📁 .../${targetPathFromLibrary}/`
                      }
                    </p>
                    <p className="text-xs mt-1 text-green-700 dark:text-green-300">
                      ✅ Archive werden direkt in das aktuell gewählte Library-Verzeichnis gespeichert
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-medium">❌ ANWENDUNGSFEHLER: Keine aktive Library</p>
                  <p>Der Archive-Dialog wurde ohne aktive Library geöffnet. Das ist ein Fehler der Anwendung.</p>
                  <p className="mt-2 font-medium">Lösung:</p>
                  <ol className="list-decimal list-inside text-xs mt-1">
                    <li>Gehen Sie zur <a href="/library" className="underline font-medium">Library-Seite</a></li>
                    <li>Wählen Sie eine Library aus</li>
                    <li>Navigieren Sie zum gewünschten Verzeichnis</li>
                    <li>Kehren Sie zum Event-Monitor zurück</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Struktur-Optionen */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="preserve-zip-structure"
                checked={preserveZipStructure}
                onCheckedChange={(checked) => setPreserveZipStructure(checked === true)}
                disabled={processing}
              />
              <Label htmlFor="preserve-zip-structure">
                ZIP-Struktur vollständig beibehalten (sessions/Event/assets/ und sessions/Event/LANGUAGE/Track/)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="flatten-structure"
                checked={flattenStructure}
                onCheckedChange={(checked) => setFlattenStructure(checked === true)}
                disabled={processing || preserveZipStructure}
              />
              <Label htmlFor="flatten-structure">
                Flache Struktur (alle Dateien pro Session in einen Ordner)
              </Label>
            </div>
          </div>

          {/* Job-Übersicht */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <h4 className="font-medium mb-2">
              {isMultiBatch ? 'Gefilterte Batches & Jobs:' : 'Jobs zum Speichern:'}
            </h4>
            <div className="space-y-1 text-sm">
              {isMultiBatch && (
                <>
                  <div className="flex justify-between">
                    <span>Gefilterte Batches:</span>
                    <Badge variant="default">{batches.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Alle Jobs:</span>
                    <Badge variant="secondary">{completedJobs.length}</Badge>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>Jobs mit Archiven:</span>
                <Badge variant="default">{jobsWithArchives.length}</Badge>
              </div>
              {!isMultiBatch && (
                <>
                  <div className="flex justify-between">
                    <span>Event:</span>
                    <Badge variant="secondary">{eventName}</Badge>
                  </div>
                  {trackName && (
                    <div className="flex justify-between">
                      <span>Track:</span>
                      <Badge variant="secondary">{trackName}</Badge>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between">
                <span>Struktur:</span>
                <span className="text-xs">
                  {preserveZipStructure ? 'Original ZIP' : flattenStructure ? 'Flach' : 'Angepasst'}
                </span>
              </div>
            </div>
          </div>

          {/* Fortschrittsanzeige */}
          {processing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Verarbeitung läuft...</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {progress.status}
              </p>
              {progress.currentJob && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {progress.currentJob}
                </div>
              )}
            </div>
          )}

          {/* Warnhinweis */}
          {jobsWithArchives.length < completedJobs.length && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Nicht alle Jobs haben Archive</p>
                <p>
                  {completedJobs.length - jobsWithArchives.length} Jobs werden übersprungen, 
                  da sie keine ZIP-Archive enthalten.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={processing}
          >
            Abbrechen
          </Button>
          <Button 
            onClick={handleArchiveJobs}
            disabled={!effectiveLibrary || processing || jobsWithArchives.length === 0}
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Speichere...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {jobsWithArchives.length} Jobs speichern
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 