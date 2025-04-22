'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  PauseCircle,
  PlayCircle,
  ArchiveIcon, 
  Trash2,
  Eye,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  RotateCw,
  Loader2
} from 'lucide-react';
import { Batch, BatchStatus, Job, JobStatus } from '@/types/event-job';
import { formatDateTime } from '@/lib/utils';
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BatchListProps {
  batches: Batch[];
  onRefresh: () => void;
  isArchive?: boolean;
  onJobClick?: (jobId: string) => void;
}

export default function BatchList({ batches, onRefresh, isArchive = false, onJobClick }: BatchListProps) {
  const router = useRouter();
  const [processingBatch, setProcessingBatch] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [jobsByBatch, setJobsByBatch] = useState<Record<string, Job[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({});
  const [processingJob, setProcessingJob] = useState<string | null>(null);
  
  // Status-Badge darstellen
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
  
  // Batch expandieren/kollabieren
  const toggleBatchExpansion = async (batchId: string) => {
    const isExpanded = expandedBatches[batchId];
    setExpandedBatches({
      ...expandedBatches,
      [batchId]: !isExpanded
    });
    
    // Jobs laden, wenn Batch expandiert wird und noch keine Jobs geladen wurden
    if (!isExpanded && !jobsByBatch[batchId]) {
      await loadJobsForBatch(batchId);
    }
  };
  
  // Jobs für einen Batch laden
  const loadJobsForBatch = async (batchId: string) => {
    try {
      setLoadingJobs({
        ...loadingJobs,
        [batchId]: true
      });
      
      const response = await fetch(`/api/event-job/batches/${batchId}/jobs`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setJobsByBatch({
          ...jobsByBatch,
          [batchId]: data.data.jobs || []
        });
      } else {
        console.error('Fehler beim Laden der Jobs:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Jobs:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoadingJobs({
        ...loadingJobs,
        [batchId]: false
      });
    }
  };
  
  // Job neu starten
  async function restartJob(jobId: string, batchId: string) {
    if (!window.confirm('Möchten Sie diesen Job wirklich neu starten?')) {
      return;
    }
    
    try {
      setProcessingJob(jobId);
      
      const response = await fetch(`/api/event-job/jobs/${jobId}/restart`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        await loadJobsForBatch(batchId);
        onRefresh();
      } else {
        console.error('Fehler beim Neustarten des Jobs:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Neustarten des Jobs:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setProcessingJob(null);
    }
  }
  
  // Job löschen
  async function deleteJob(jobId: string, batchId: string) {
    if (!window.confirm('Sind Sie sicher, dass Sie diesen Job unwiderruflich löschen möchten? Diese Aktion kann NICHT rückgängig gemacht werden!')) {
      return;
    }
    
    try {
      setProcessingJob(jobId);
      
      const response = await fetch(`/api/event-job/jobs/${jobId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        await loadJobsForBatch(batchId);
        onRefresh();
      } else {
        console.error('Fehler beim Löschen des Jobs:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Jobs:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setProcessingJob(null);
    }
  }
  
  // Batch aktivieren/deaktivieren
  async function toggleBatchActive(batchId: string, isCurrentlyActive: boolean) {
    try {
      setProcessingBatch(batchId);
      const response = await fetch(`/api/event-job/batches/${batchId}/toggle-active`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        onRefresh();
      } else {
        console.error('Fehler beim Umschalten des Batch-Status:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Umschalten des Batch-Status:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setProcessingBatch(null);
    }
  }
  
  // Batch archivieren
  async function archiveBatch(batchId: string) {
    if (!window.confirm('Sind Sie sicher, dass Sie diesen Batch archivieren möchten?')) {
      return;
    }
    
    try {
      setProcessingBatch(batchId);
      const response = await fetch(`/api/event-job/batches/${batchId}/archive`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        onRefresh();
      } else {
        console.error('Fehler beim Archivieren des Batches:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Archivieren des Batches:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setProcessingBatch(null);
    }
  }
  
  // Batch löschen
  async function deleteBatch(batchId: string) {
    if (!window.confirm('Sind Sie sicher, dass Sie diesen Batch unwiderruflich löschen möchten? Diese Aktion kann NICHT rückgängig gemacht werden!')) {
      return;
    }
    
    try {
      setProcessingBatch(batchId);
      const response = await fetch(`/api/event-job/batches/${batchId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        onRefresh();
      } else {
        console.error('Fehler beim Löschen des Batches:', data.message);
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Batches:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setProcessingBatch(null);
    }
  }
  
  // Funktion zum Behandeln von Klicks auf Job-Details
  const handleJobClick = (jobId: string) => {
    if (onJobClick) {
      // Wenn onJobClick bereitgestellt wurde, verwende es
      onJobClick(jobId);
    } else {
      // Andernfalls navigiere zur Detailseite (Rückfallverhalten)
      router.push(`/event-monitor/jobs/${jobId}`);
    }
  };
  
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Batch-Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erstellungsdatum</TableHead>
            <TableHead>Letzte Aktualisierung</TableHead>
            <TableHead>Jobs Total</TableHead>
            <TableHead>Jobs Erfolgreich</TableHead>
            <TableHead>Jobs Fehlgeschlagen</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <React.Fragment key={batch.batch_id}>
              <TableRow 
                className={`${batch.isActive && !isArchive ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${processingBatch === batch.batch_id ? 'opacity-50' : ''}`}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mr-2 p-0 h-6 w-6"
                      onClick={() => toggleBatchExpansion(batch.batch_id)}
                    >
                      {expandedBatches[batch.batch_id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    {batch.batch_name}
                    {batch.isActive && !isArchive && <Badge className="ml-2 bg-blue-600 dark:bg-blue-500">Aktiv</Badge>}
                  </div>
                </TableCell>
                <TableCell>{getBatchStatusBadge(batch.status)}</TableCell>
                <TableCell>{formatDateTime(batch.created_at)}</TableCell>
                <TableCell>{formatDateTime(batch.updated_at)}</TableCell>
                <TableCell>{batch.total_jobs || 0}</TableCell>
                <TableCell>{batch.completed_jobs || 0}</TableCell>
                <TableCell>{batch.failed_jobs || 0}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={processingBatch === batch.batch_id}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/event-monitor/batches/${batch.batch_id}`)}>
                        <Eye className="mr-2 h-4 w-4" /> Details anzeigen
                      </DropdownMenuItem>
                      
                      {!isArchive && (
                        <>
                          <DropdownMenuItem onClick={() => toggleBatchActive(batch.batch_id, batch.isActive)}>
                            {batch.isActive ? (
                              <>
                                <PauseCircle className="mr-2 h-4 w-4" /> Deaktivieren
                              </>
                            ) : (
                              <>
                                <PlayCircle className="mr-2 h-4 w-4" /> Aktivieren
                              </>
                            )}
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => archiveBatch(batch.batch_id)}>
                            <ArchiveIcon className="mr-2 h-4 w-4" /> Archivieren
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      <DropdownMenuItem onClick={() => router.push(`/event-monitor/batches/${batch.batch_id}/export`)}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportieren
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem 
                        onClick={() => deleteBatch(batch.batch_id)}
                        className="text-red-600 focus:text-red-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              
              {/* Jobs für diesen Batch anzeigen, wenn expandiert */}
              {expandedBatches[batch.batch_id] && (
                <TableRow className="bg-gray-50 dark:bg-gray-900/20">
                  <TableCell colSpan={8} className="p-0">
                    <div className="py-2 px-6 ml-6 border-l-2 border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium mb-2">Jobs in diesem Batch</h4>
                      
                      {loadingJobs[batch.batch_id] ? (
                        <div className="flex justify-center items-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                          <span className="text-sm text-gray-500 dark:text-gray-400">Jobs werden geladen...</span>
                        </div>
                      ) : jobsByBatch[batch.batch_id]?.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Job-Name</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Erstellt</TableHead>
                              <TableHead className="text-right">Aktionen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {jobsByBatch[batch.batch_id].map(job => (
                              <TableRow 
                                key={job.job_id} 
                                className={processingJob === job.job_id ? 'opacity-50' : ''}
                              >
                                <TableCell className="font-medium">{job.job_name || job.job_id}</TableCell>
                                <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                                <TableCell>{formatDateTime(job.created_at)}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-2 justify-end">
                                    <Button 
                                      onClick={() => handleJobClick(job.job_id)}
                                      variant="outline" 
                                      size="sm"
                                      disabled={processingJob === job.job_id}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          onClick={() => restartJob(job.job_id, batch.batch_id)}
                                          variant="outline"
                                          size="sm"
                                          disabled={processingJob === job.job_id || job.status === JobStatus.PROCESSING}
                                          className="text-blue-600 dark:text-blue-400"
                                        >
                                          <RotateCw className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {job.status === JobStatus.PROCESSING ? "Job wird gerade verarbeitet" : "Job neu starten"}
                                      </TooltipContent>
                                    </Tooltip>
                                    
                                    <Button 
                                      onClick={() => deleteJob(job.job_id, batch.batch_id)}
                                      variant="outline"
                                      size="sm"
                                      disabled={processingJob === job.job_id}
                                      className="text-red-600 dark:text-red-400"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                          Keine Jobs in diesem Batch gefunden.
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
          
          {batches.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6 text-gray-500 dark:text-gray-400">
                Keine Batches gefunden.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
} 