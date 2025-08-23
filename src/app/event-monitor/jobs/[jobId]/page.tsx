'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
// SingleJobArchiveDialog entfernt - verwende direkten Download

export default function JobDetailsPage() {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Archive-Dialog entfernt - verwende direkten Download
  
  const router = useRouter();
  // In Next.js 15 useParams() verwenden statt params direkt zu nutzen
  const params = useParams();
  const jobId = params?.jobId as string;

  // Job laden
  const loadJob = useCallback(async () => {
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
    if (jobId) {
      loadJob();
    }
  }, [jobId, loadJob]);

  // Job neu starten
  async function restartJob() {
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

  // Vereinfacht: Nur direkter Download verfuegbar

  // Direkter Download (zusätzlich zum Library-Save)
  const handleDirectDownload = async () => {
    if (!job || !job.results?.archive_data) {
      alert('Dieser Job hat kein Archiv zum Herunterladen.');
      return;
    }

    try {
      setProcessing(true);
      
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
        // Bei erfolgreicher Löschung zurück zur Batch-Seite navigieren
        if (job?.batch_id) {
          router.push(`/event-monitor/batches/${job.batch_id}`);
        } else {
          router.push('/event-monitor');
        }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
              <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error || 'Job nicht gefunden'}</p>
              <Button 
                onClick={() => router.push('/event-monitor')} 
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Zurück zur Übersicht
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="flex items-center gap-4 mb-6">
        {job.batch_id && (
          <Button 
            onClick={() => router.push(`/event-monitor/batches/${job.batch_id}`)}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Zurück zum Batch
          </Button>
        )}
        <h1 className="text-2xl font-bold">Job-Details</h1>
        <Button
          onClick={loadJob}
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={loading || processing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading || processing ? 'animate-spin' : ''}`} /> Aktualisieren
        </Button>
      </div>

      {/* Job Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Job-Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
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
            
            {job.started_at && (
              <div className="space-y-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">Gestartet</p>
                <p>{formatDateTime(job.started_at)}</p>
              </div>
            )}
            
            {!job.started_at && (
              <div className="space-y-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">Gestartet</p>
                <p>-</p>
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
      <div className="flex gap-2 justify-end">
        {/* Archive-Button */}
        {job.results?.archive_data && (
          <Button
            onClick={handleDirectDownload}
            variant="outline"
            disabled={processing}
            className="text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30"
          >
            <Download className="h-4 w-4 mr-2" />
            Archive herunterladen
          </Button>
        )}

        {job.status === JobStatus.FAILED && (
          <Button
            onClick={restartJob}
            variant="outline"
            disabled={processing}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30"
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Job neu starten
          </Button>
        )}
        <Button
          onClick={deleteJob}
          variant="outline"
          disabled={processing}
          className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/30"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Job löschen
        </Button>
      </div>

      {/* Archive-Dialog entfernt - verwende direkten Download */}
    </div>
  );
} 