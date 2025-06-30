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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, FolderOpen, Download, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Batch, Job } from '@/types/event-job';
import { ClientLibrary } from '@/types/library';
import { useAtom } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';

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
  batch: Batch;
  completedJobs: Job[];
  onArchiveComplete: (result: ArchiveResult) => void;
}

export default function BatchArchiveDialog({
  open,
  onOpenChange,
  batch,
  completedJobs,
  onArchiveComplete
}: BatchArchiveDialogProps) {
  const [activeLibraryId] = useAtom(activeLibraryIdAtom);
  const [availableLibraries, setAvailableLibraries] = useState<ClientLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(activeLibraryId || '');
  const [targetDirectory, setTargetDirectory] = useState<string>('');
  const [preserveZipStructure, setPreserveZipStructure] = useState(true);
  const [flattenStructure, setFlattenStructure] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ArchiveProgress>({ current: 0, total: 0, status: '' });
  const [loadingLibraries, setLoadingLibraries] = useState(false);

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

  // Libraries beim Öffnen des Dialogs laden
  useEffect(() => {
    if (open) {
      loadAvailableLibraries();
      if (activeLibraryId && !selectedLibraryId) {
        setSelectedLibraryId(activeLibraryId);
      }
    }
  }, [open, activeLibraryId]);

  // Verfügbare Libraries laden
  const loadAvailableLibraries = async () => {
    try {
      setLoadingLibraries(true);
      const response = await fetch('/api/libraries');
      const data = await response.json();
      
      if (data.status === 'success') {
        setAvailableLibraries(data.data.libraries || []);
      } else {
        console.error('Fehler beim Laden der Libraries:', data.message);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Libraries:', error);
    } finally {
      setLoadingLibraries(false);
    }
  };

  // Archive-Verarbeitung starten
  const handleArchiveJobs = async () => {
    if (!selectedLibraryId || processing) return;

    try {
      setProcessing(true);
      setProgress({ current: 0, total: completedJobs.length, status: 'Starte Archivierung...' });

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

    // Basis-Zielverzeichnis bestimmen
    const baseDirectory = targetDirectory || '';

    for (let i = 0; i < completedJobs.length; i++) {
      const job = completedJobs[i];
      const sessionName = job.parameters?.session || job.job_name || `Job-${job.job_id}`;

      try {
        setProgress({
          current: i + 1,
          total: completedJobs.length,
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
        // Original ZIP-Struktur beibehalten
        targetPath = baseDirectory 
          ? `${baseDirectory}/${filename}`
          : filename;
      } else if (flattenStructure) {
        // Flache Struktur: Alle Dateien in einen Session-Ordner
        const sessionName = sanitizeFilename(
          job.parameters?.session || job.job_name || `job-${job.job_id}`
        );
        const filenameOnly = filename.split('/').pop() || filename;
        targetPath = baseDirectory 
          ? `${baseDirectory}/${sessionName}/${filenameOnly}`
          : `${sessionName}/${filenameOnly}`;
      } else {
        // Angepasste Struktur: Entferne "sessions/" Präfix, behalte Event/Language/Track
        const pathWithoutSessions = filename.startsWith('sessions/') 
          ? filename.substring('sessions/'.length)
          : filename;
        
        targetPath = baseDirectory 
          ? `${baseDirectory}/${pathWithoutSessions}`
          : pathWithoutSessions;
      }

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

  // Datei in Storage speichern
  const uploadFileToStorage = async (
    targetPath: string,
    content: Uint8Array,
    filename: string
  ): Promise<void> => {
    const mimeType = getMimeType(filename);
    
    const formData = new FormData();
    const file = new File([content], filename, { type: mimeType });
    formData.append('file', file);
    formData.append('path', targetPath);
    formData.append('libraryId', selectedLibraryId);

    const response = await fetch('/api/storage/filesystem', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed for ${filename}: ${response.statusText}`);
    }
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

  const jobsWithArchives = completedJobs.filter(job => job.results?.archive_data);
  const eventName = extractEventName(batch.batch_name || '');
  const trackName = extractTrackName(batch.batch_name || '');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Jobs in Library speichern
          </DialogTitle>
          <DialogDescription>
            {jobsWithArchives.length} von {completedJobs.length} abgeschlossene Jobs aus 
            "{batch.batch_name}" haben Archive und können gespeichert werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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

          {/* Library-Auswahl */}
          <div className="space-y-2">
            <Label>Ziel-Library</Label>
            <Select 
              value={selectedLibraryId} 
              onValueChange={setSelectedLibraryId}
              disabled={loadingLibraries || processing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Library auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {availableLibraries.map(library => (
                  <SelectItem key={library.id} value={library.id}>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      {library.label}
                      <Badge variant="outline" className="text-xs">
                        {library.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zielverzeichnis */}
          <div className="space-y-2">
            <Label>Basis-Verzeichnis (optional)</Label>
            <Input
              value={targetDirectory}
              onChange={(e) => setTargetDirectory(e.target.value)}
              placeholder="z.B. Conferences/2025"
              disabled={processing}
            />
          </div>

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
            <h4 className="font-medium mb-2">Jobs zum Speichern:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Jobs mit Archiven:</span>
                <Badge variant="default">{jobsWithArchives.length}</Badge>
              </div>
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
            disabled={!selectedLibraryId || processing || jobsWithArchives.length === 0}
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