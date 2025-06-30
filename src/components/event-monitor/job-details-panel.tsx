import React, { useState, useEffect, useCallback } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetClose
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Job, JobStatus } from '@/types/event-job';
import { formatDateTime } from '@/lib/utils';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  PauseCircle,
  RotateCw,
  Trash2,
  AlertTriangle,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface JobDetailsPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  onRefresh?: () => void;
}

export default function JobDetailsPanel({ isOpen, onOpenChange, jobId, onRefresh }: JobDetailsPanelProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);


  // Job laden
  const loadJob = useCallback(async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/event-job/jobs/${jobId}`);
      const data = await response.json();
      if (data.status === 'success') {
        setJob(data.data.job);
      } else {
        console.error('Fehler beim Laden des Jobs:', data.message);
        setError(data.message || 'Job konnte nicht geladen werden');
      }
    } catch (error) {
      console.error('Fehler beim Laden des Jobs:', error);
      setError('Fehler beim Laden des Jobs');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (isOpen && jobId) {
      loadJob();
    }
  }, [isOpen, jobId, loadJob]);

  // Job neu starten
  async function restartJob() {
    if (!jobId) return;
    if (!window.confirm('Möchten Sie diesen Job wirklich neu starten?')) {
      return;
    }
    
    try {
      setProcessing(true);
      
      const response = await fetch(`/api/event-job/jobs/${jobId}/restart`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        loadJob();
        // Auch die Elternliste aktualisieren, falls vorhanden
        if (onRefresh) onRefresh();
      } else {
        console.error('Fehler beim Neustarten des Jobs:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Neustarten des Jobs:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setProcessing(false);
    }
  }

  // Archive in Library speichern
  const handleSaveToLibrary = async () => {
    if (!job || !job.results?.archive_data) {
      alert('Dieser Job hat kein Archiv zum Speichern.');
      return;
    }

    try {
      setProcessing(true);
      
      // Einfacher Direct-Download für Testzwecke
      const response = await fetch(`/api/event-job/jobs/${job.job_id}/download-archive`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = job.results.archive_filename || `session-${job.job_id}.zip`;
        link.click();
        URL.revokeObjectURL(url);
        
        alert('Archiv erfolgreich heruntergeladen!');
      } else {
        throw new Error(`Download fehlgeschlagen: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('Fehler beim Archive-Download:', error);
      alert(`Fehler beim Download: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setProcessing(false);
    }
  };

  // Job löschen
  async function deleteJob() {
    if (!jobId) return;
    if (!window.confirm('Sind Sie sicher, dass Sie diesen Job unwiderruflich löschen möchten? Diese Aktion kann NICHT rückgängig gemacht werden!')) {
      return;
    }
    
    try {
      setProcessing(true);
      
      const response = await fetch(`/api/event-job/jobs/${jobId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Panel schließen
        onOpenChange(false);
        // Elternliste aktualisieren
        if (onRefresh) onRefresh();
      } else {
        console.error('Fehler beim Löschen des Jobs:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Jobs:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setProcessing(false);
    }
  }

  // Job-Status-Badge darstellen
  function getJobStatusBadge(status: JobStatus) {
    switch (status) {
      case JobStatus.PENDING:
        return <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"><Clock className="w-3 h-3 mr-1" /> Ausstehend</Badge>;
      case JobStatus.PROCESSING:
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse"><span className="animate-pulse">⚡</span> In Bearbeitung</Badge>;
      case JobStatus.COMPLETED:
        return <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Abgeschlossen</Badge>;
      case JobStatus.FAILED:
        return <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"><XCircle className="w-3 h-3 mr-1" /> Fehlgeschlagen</Badge>;
      case JobStatus.CANCELLED:
        return <Badge variant="outline" className="bg-gray-50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700"><PauseCircle className="w-3 h-3 mr-1" /> Abgebrochen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  // Fortschrittsbalken darstellen
  function getProgressBar(job: Job) {
    let progressPercent = 0;
    let progressColorClass = "bg-blue-500 dark:bg-blue-600";
    let progressText = "Verarbeitung läuft...";
    
    // Fortschritt berechnen
    if (job.progress?.percent !== undefined) {
      progressPercent = job.progress.percent;
    } else if (job.status === JobStatus.COMPLETED) {
      progressPercent = 100;
      progressColorClass = "bg-green-500 dark:bg-green-600";
      progressText = "Verarbeitung abgeschlossen";
    } else if (job.status === JobStatus.FAILED) {
      progressPercent = 100;
      progressColorClass = "bg-red-500 dark:bg-red-600";
      progressText = "Verarbeitung fehlgeschlagen";
    } else if (job.status === JobStatus.CANCELLED) {
      progressPercent = job.progress?.percent || 0;
      progressColorClass = "bg-gray-500 dark:bg-gray-600";
      progressText = "Verarbeitung abgebrochen";
    }
    
    return (
      <div className="w-full">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1">
          <div 
            className={`h-2.5 rounded-full ${progressColorClass}`} 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{job.progress?.message || progressText}</p>
      </div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            Job-Details
            {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          </SheetTitle>
          <div className="flex mt-2">
            <Button 
              onClick={loadJob} 
              variant="outline" 
              size="sm" 
              disabled={loading || processing}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
            </Button>
          </div>
        </SheetHeader>
        
        {loading && !job && (
          <div className="flex justify-center items-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        )}
        
        {error && !job && (
          <div className="mt-6">
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
              <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error || 'Job nicht gefunden'}</p>
            </div>
          </div>
        )}
        
        {job && (
          <div className="mt-6">
            {/* Job Details */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Job: {job.job_name || job.job_id}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                    <div>{getJobStatusBadge(job.status)}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Job ID</p>
                    <p className="font-mono text-xs break-all">{job.job_id}</p>
                  </div>
                  
                  {job.batch_id && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Batch ID</p>
                      <p className="font-mono text-xs break-all">{job.batch_id}</p>
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Erstellt</p>
                    <p>{formatDateTime(job.created_at)}</p>
                  </div>
                  
                  {job.processing_started_at && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Gestartet</p>
                      <p>{formatDateTime(job.processing_started_at)}</p>
                    </div>
                  )}
                  
                  {job.completed_at && (
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Abgeschlossen</p>
                      <p>{formatDateTime(job.completed_at)}</p>
                    </div>
                  )}
                  
                  <div className="col-span-full space-y-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Fortschritt</p>
                    {getProgressBar(job)}
                  </div>
                  
                  {job.parameters && (
                    <div className="col-span-full space-y-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Parameter</p>
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-md border border-gray-200 dark:border-gray-700">
                        <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                          {JSON.stringify(job.parameters, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {job.results && (
                    <div className="col-span-full space-y-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Ergebnisse</p>
                      <div className="bg-white dark:bg-gray-900 p-3 rounded-md border border-gray-200 dark:border-gray-700">
                        <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                          {typeof job.results === 'object'
                            ? JSON.stringify(job.results, null, 2)
                            : job.results}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {job.error && (
                    <div className="col-span-full space-y-1">
                      <p className="text-sm text-red-600 dark:text-red-400">Fehler</p>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800/50">
                        <pre className="text-xs text-red-800 dark:text-red-300 whitespace-pre-wrap">
                          {typeof job.error === 'object'
                            ? JSON.stringify(job.error, null, 2)
                            : job.error}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Aktionsbuttons */}
            <div className="flex gap-2 justify-between">
              <SheetClose asChild>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Schließen
                </Button>
              </SheetClose>
              
              <div className="flex gap-2">
                {/* Archive-Button */}
                {job.results?.archive_data && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSaveToLibrary}
                        variant="outline"
                        size="sm"
                        disabled={processing}
                        className="text-green-600 dark:text-green-400"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Archive herunterladen
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      ZIP-Archiv mit Markdown und Bildern herunterladen
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={restartJob}
                      variant="outline"
                      size="sm"
                      disabled={processing || job.status === JobStatus.PROCESSING}
                      className="text-blue-600 dark:text-blue-400"
                    >
                      <RotateCw className="h-4 w-4 mr-2" />
                      Neu starten
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {job.status === JobStatus.PROCESSING ? "Job wird gerade verarbeitet" : "Job neu starten"}
                  </TooltipContent>
                </Tooltip>
                
                <Button
                  onClick={deleteJob}
                  variant="outline"
                  size="sm"
                  disabled={processing}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
} 