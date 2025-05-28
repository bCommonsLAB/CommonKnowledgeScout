'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Batch, Job, JobStatus, BatchStatus } from '@/types/event-job';
import { formatDateTime, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
  ChevronDown
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CollapsibleContentProps {
  job: Job;
  onRestartJob?: (jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
}

const CollapsibleContent = ({ job, onRestartJob, onDeleteJob }: CollapsibleContentProps) => {
  const hasParameters = job.parameters && Object.keys(job.parameters).length > 0;
  const hasResults = job.results !== undefined && job.results !== null;
  const hasError = job.error !== undefined && job.error !== null;

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="space-y-4">
        {hasParameters && (
          <div>
            <h4 className="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Parameter:</h4>
            <div className="bg-white dark:bg-gray-900 p-3 rounded-md border border-gray-200 dark:border-gray-700">
              <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {JSON.stringify(job.parameters, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {hasResults && (
          <div>
            <h4 className="text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Ergebnis:</h4>
            <div className="bg-white dark:bg-gray-900 p-3 rounded-md border border-gray-200 dark:border-gray-700">
              <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {typeof job.results === 'object'
                  ? JSON.stringify(job.results, null, 2)
                  : job.results}
              </pre>
            </div>
          </div>
        )}

        {hasError && (
          <div>
            <h4 className="text-sm font-semibold mb-1 text-red-600 dark:text-red-400">Fehler:</h4>
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800/50">
              <pre className="text-xs text-red-800 dark:text-red-300 whitespace-pre-wrap">
                {typeof job.error === 'object'
                  ? JSON.stringify(job.error, null, 2)
                  : job.error}
              </pre>
            </div>
          </div>
        )}

        <div className="flex space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              if (onRestartJob) {
                onRestartJob(job.job_id);
              }
            }}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Neu starten
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              if (onDeleteJob) {
                onDeleteJob(job.job_id);
              }
            }}
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/30"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Löschen
          </Button>
        </div>
      </div>
    </div>
  );
};

interface JobItemProps {
  job: Job;
  onRestartJob?: (jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
}

const JobItem = ({ job, onRestartJob, onDeleteJob }: JobItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusColor = () => {
    switch (job.status) {
      case JobStatus.COMPLETED:
        return "bg-green-500 dark:bg-green-600";
      case JobStatus.PROCESSING:
        return "bg-blue-500 dark:bg-blue-600";
      case JobStatus.PENDING:
        return "bg-yellow-500 dark:bg-yellow-600";
      case "WAITING" as JobStatus:
        return "bg-purple-500 dark:bg-purple-600";
      case JobStatus.FAILED:
        return "bg-red-500 dark:bg-red-600";
      case JobStatus.CANCELLED:
        return "bg-gray-500 dark:bg-gray-600";
      default:
        return "bg-gray-400 dark:bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case JobStatus.COMPLETED:
        return "Abgeschlossen";
      case JobStatus.PROCESSING:
        return "In Bearbeitung";
      case JobStatus.PENDING:
        return "Ausstehend";
      case "WAITING" as JobStatus:
        return "Wartend";
      case JobStatus.FAILED:
        return "Fehlgeschlagen";
      case JobStatus.CANCELLED:
        return "Abgebrochen";
      default:
        return job.status;
    }
  };

  const jobCardClass = cn(
    "border rounded-md mb-2 overflow-hidden transition-all duration-200 ease-in-out",
    {
      "border-gray-200 dark:border-gray-700": !isOpen,
      "border-gray-300 dark:border-gray-600 shadow-sm": isOpen,
    }
  );

  return (
    <div className={jobCardClass}>
      <div
        className={cn(
          "p-4 cursor-pointer flex items-center justify-between",
          {
            "bg-white dark:bg-gray-900": !isOpen,
            "bg-gray-50 dark:bg-gray-800": isOpen,
          }
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center space-x-3">
          <div className={cn("w-3 h-3 rounded-full", getStatusColor())} />
          <div className="font-medium text-gray-900 dark:text-gray-100">{job.job_name || job.job_id}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{getStatusText()}</div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDateTime(job.created_at)}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-gray-500 transition-transform", {
              "transform rotate-180": isOpen,
            })}
          />
        </div>
      </div>
      {isOpen && <CollapsibleContent job={job} onRestartJob={onRestartJob} onDeleteJob={onDeleteJob} />}
    </div>
  );
};

export default function BatchDetailsPage({ params }: { params: Promise<{ batchId: string }> }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob] = useState<Job | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [batchId, setBatchId] = useState<string>('');
  
  const router = useRouter();

  // Params als Promise behandeln
  useEffect(() => {
    params.then(({ batchId: id }) => {
      setBatchId(id);
    });
  }, [params]);

  // Batch laden
  const loadBatch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/event-job/batches/${batchId}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setBatch(data.data.batch);
      } else {
        console.error('Fehler beim Laden des Batches:', data.message);
        setError(data.message || 'Batch konnte nicht geladen werden');
      }
    } catch (error) {
      console.error('Fehler beim Laden des Batches:', error);
      setError('Fehler beim Laden des Batches');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  const loadJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      
      // Die API-Route müsste noch implementiert werden
      const response = await fetch(`/api/event-job/batches/${batchId}/jobs`);
      
      if (!response.ok) {
        setJobs([]);
        return;
      }
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setJobs(data.data.jobs || []);
      } else {
        console.error('Fehler beim Laden der Jobs:', data.message);
        setJobs([]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Jobs:', error);
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batchId) {
      loadBatch();
      loadJobs();
    }
  }, [batchId, loadBatch, loadJobs]);

  function refreshData() {
    loadBatch();
    loadJobs();
  }

  // Job neu starten
  async function restartJob(jobId: string) {
    if (!window.confirm('Möchten Sie diesen Job wirklich neu starten?')) {
      return;
    }
    
    try {
      // Die API-Route müsste noch implementiert werden
      const response = await fetch(`/api/event-job/jobs/${jobId}/restart`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        refreshData();
      } else {
        console.error('Fehler beim Neustarten des Jobs:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Neustarten des Jobs:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  // Job löschen
  async function deleteJob(jobId: string) {
    if (!window.confirm('Sind Sie sicher, dass Sie diesen Job unwiderruflich löschen möchten? Diese Aktion kann NICHT rückgängig gemacht werden!')) {
      return;
    }
    
    try {
      // Die API-Route müsste noch implementiert werden
      const response = await fetch(`/api/event-job/jobs/${jobId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        refreshData();
      } else {
        console.error('Fehler beim Löschen des Jobs:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Jobs:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
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

  // Batch-Status-Badge darstellen
  function getBatchStatusBadge(status: BatchStatus) {
    switch (status) {
      case BatchStatus.PENDING:
        return <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"><Clock className="w-3 h-3 mr-1" /> Ausstehend</Badge>;
      case BatchStatus.RUNNING:
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse"><span className="animate-pulse">⚡</span> Aktiv</Badge>;
      case BatchStatus.PAUSED:
        return <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800"><PauseCircle className="w-3 h-3 mr-1" /> Pausiert</Badge>;
      case BatchStatus.COMPLETED:
        return <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"><CheckCircle2 className="w-3 h-3 mr-1" /> Abgeschlossen</Badge>;
      case BatchStatus.FAILED:
        return <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"><XCircle className="w-3 h-3 mr-1" /> Fehlgeschlagen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-lg text-red-600 mb-4">{error || 'Batch nicht gefunden'}</p>
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
        <Button 
          onClick={() => router.push('/event-monitor')}
          variant="outline"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
        </Button>
        <h1 className="text-2xl font-bold">{batch.batch_name || `Batch #${batch.batch_id}`}</h1>
        <Button
          onClick={refreshData}
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={loading || jobsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading || jobsLoading ? 'animate-spin' : ''}`} /> Aktualisieren
        </Button>
      </div>

      {/* Batch Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Batch-Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Status</p>
              <div>{getBatchStatusBadge(batch.status)}</div>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Erstellt am</p>
              <p>{formatDateTime(batch.created_at)}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Letzte Aktualisierung</p>
              <p>{formatDateTime(batch.updated_at)}</p>
            </div>
            
            {batch.completed_at && (
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Abgeschlossen am</p>
                <p>{formatDateTime(batch.completed_at)}</p>
              </div>
            )}
            
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Jobs Total</p>
              <p>{batch.total_jobs}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Erfolgreiche Jobs</p>
              <p>{batch.completed_jobs}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Fehlgeschlagene Jobs</p>
              <p>{batch.failed_jobs}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Aktiv</p>
              <p>{batch.isActive ? 'Ja' : 'Nein'}</p>
            </div>
            
            {batch.description && (
              <div className="col-span-full space-y-1">
                <p className="text-sm text-gray-500">Beschreibung</p>
                <p>{batch.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Jobs Liste */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : jobs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job-Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead className="hidden md:table-cell">Aktualisiert am</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <JobItem 
                    key={job.job_id} 
                    job={job} 
                    onRestartJob={restartJob} 
                    onDeleteJob={deleteJob} 
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6 text-gray-500">
              Keine Jobs für diesen Batch gefunden.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job-Details Dialog */}
      {selectedJob && (
        <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Job-Details</DialogTitle>
              <DialogDescription>
                {selectedJob.job_name || selectedJob.job_id}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Status</p>
                <div>{getJobStatusBadge(selectedJob.status)}</div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Erstellt am</p>
                <p>{formatDateTime(selectedJob.created_at)}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Aktualisiert am</p>
                <p>{formatDateTime(selectedJob.updated_at)}</p>
              </div>
              
              {selectedJob.completed_at && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Abgeschlossen am</p>
                  <p>{formatDateTime(selectedJob.completed_at)}</p>
                </div>
              )}
              
              {selectedJob.job_type && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Job-Typ</p>
                  <p>{selectedJob.job_type}</p>
                </div>
              )}
            </div>
            
            {selectedJob.parameters && (
              <div className="border-t pt-4 mt-2">
                <h3 className="font-medium mb-2">Parameter</h3>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-32">
                  {JSON.stringify(selectedJob.parameters, null, 2)}
                </pre>
              </div>
            )}
            
            {selectedJob.results && (
              <div className="border-t pt-4 mt-2">
                <h3 className="font-medium mb-2">Ergebnisse</h3>
                <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-32">
                  {JSON.stringify(selectedJob.results, null, 2)}
                </pre>
              </div>
            )}
            
            {selectedJob.error && (
              <div className="border-t pt-4 mt-2">
                <h3 className="font-medium mb-2 text-red-600">Fehler</h3>
                <Alert variant="destructive" className="mb-2">
                  <AlertTitle>{selectedJob.error.code}</AlertTitle>
                  <AlertDescription>{selectedJob.error.message}</AlertDescription>
                </Alert>
                {selectedJob.error.details && (
                  <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-32">
                    {JSON.stringify(selectedJob.error.details, null, 2)}
                  </pre>
                )}
              </div>
            )}
            
            {selectedJob.progress && (
              <div className="border-t pt-4 mt-2">
                <h3 className="font-medium mb-2">Fortschritt</h3>
                <div className="space-y-2">
                  <p><strong>Schritt:</strong> {selectedJob.progress.step}</p>
                  <p><strong>Prozent:</strong> {selectedJob.progress.percent}%</p>
                  {selectedJob.progress.message && (
                    <p><strong>Meldung:</strong> {selectedJob.progress.message}</p>
                  )}
                </div>
              </div>
            )}
            
            <DialogFooter className="flex justify-between gap-2">
              {selectedJob.status === JobStatus.FAILED && (
                <Button
                  onClick={() => {
                    setShowJobDetails(false);
                    restartJob(selectedJob.job_id);
                  }}
                  variant="outline"
                  className="text-blue-600"
                >
                  <RotateCw className="w-4 h-4 mr-2" /> Neu starten
                </Button>
              )}
              
              <div className="flex gap-2 ml-auto">
                <Button
                  onClick={() => {
                    if (window.confirm('Sind Sie sicher, dass Sie diesen Job löschen möchten?')) {
                      setShowJobDetails(false);
                      deleteJob(selectedJob.job_id);
                    }
                  }}
                  variant="outline"
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Löschen
                </Button>
                
                <Button
                  onClick={() => setShowJobDetails(false)}
                >
                  Schließen
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}