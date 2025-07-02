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
  Loader2,
  BookOpenText,
  Download,
  AlertTriangle
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Batch, BatchStatus, Job, JobStatus } from '@/types/event-job';
import { ClientLibrary } from '@/types/library';
import { formatDateTime } from '@/lib/utils';
import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createTrackSummary, SecretaryServiceError } from '@/lib/secretary/client';
import { useAtom } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';
import { LANGUAGE_MAP, TEMPLATE_MAP } from '@/lib/secretary/constants';
import BatchArchiveDialog from './batch-archive-dialog';

// Archive-Dialog wird jetzt durch separate BatchArchiveDialog-Komponente ersetzt

interface BatchListProps {
  batches: Batch[];
  onRefresh: () => void;
  isArchive?: boolean;
  onJobClick?: (jobId: string) => void;
  selectedEvent?: string; // Aktuell gewähltes Event für Filterung
  onArchiveAllBatches?: () => void; // Neue Callback-Funktion für Multi-Batch-Archivierung
}

export default function BatchList({ batches, onRefresh, isArchive = false, onJobClick, selectedEvent, onArchiveAllBatches }: BatchListProps) {
  const router = useRouter();
  const [processingBatch, setProcessingBatch] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [jobsByBatch, setJobsByBatch] = useState<Record<string, Job[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<Record<string, boolean>>({});
  const [processingJob, setProcessingJob] = useState<string | null>(null);
  
  // Zustände für den Zusammenfassungs-Dialog
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("track_eco_social");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("de");
  const [creatingSummary, setCreatingSummary] = useState(false);
  
  // Aktive Bibliotheks-ID aus dem Atom-State mit useAtom
  const [activeLibraryId] = useAtom(activeLibraryIdAtom);
  
  // Archive-Dialog-Zustände
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [completedJobsForArchive, setCompletedJobsForArchive] = useState<Job[]>([]);
  
  // Dialog-Komponente für Batch-Restart
  const [batchRestartDialogOpen, setBatchRestartDialogOpen] = useState(false);
  const [selectedBatchForRestart, setSelectedBatchForRestart] = useState<Batch | null>(null);
  const [batchRestartDialogUseCache, setBatchRestartDialogUseCache] = useState(false);
  const [batchRestartDialogLoading, setBatchRestartDialogLoading] = useState(false);
  
  // Event-weiter Restart-Dialog
  const [eventRestartDialogOpen, setEventRestartDialogOpen] = useState(false);
  const [eventRestartUseCache, setEventRestartUseCache] = useState(false);
  const [eventRestartLoading, setEventRestartLoading] = useState(false);
  const [selectedEventForRestart, setSelectedEventForRestart] = useState<string>('');
  
  // Doppelte Batches nach batch_name finden
  const duplicateBatches = batches
    .map((batch, idx) => ({ ...batch, _idx: idx }))
    .filter((batch, _, arr) =>
      arr.findIndex(b => b.batch_name === batch.batch_name) !== batch._idx
    );

  // Debug-Ausgabe
  useEffect(() => {
    if (duplicateBatches.length > 0) {
      console.warn('Doppelte Batches gefunden:', duplicateBatches.map(b => b.batch_name));
    }
  }, [batches]);

  // Hilfsfunktion: Doppelte Jobs nach job_name innerhalb eines Batches finden
  function getDuplicateJobs(jobs: Job[]) {
    return jobs
      .map((job, idx) => ({ ...job, _idx: idx }))
      .filter((job, _, arr) =>
        arr.findIndex(j => j.job_name === job.job_name) !== job._idx
      );
  }

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
      
      const response = await fetch(`/api/event-job/batches/${batchId}/jobs?limit=1000`);
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
  async function toggleBatchActive(batchId: string) {
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
  
  // Zusammenfassung für einen Batch erstellen Dialog öffnen
  const openSummaryDialog = (batchId: string) => {
    setSelectedBatchId(batchId);
    setSummaryDialogOpen(true);
  };
  
  // Archive-Dialog öffnen
  const openArchiveDialog = async (batchId: string) => {
    const batch = batches.find(b => b.batch_id === batchId);
    if (!batch) return;
    
    try {
      // Alle abgeschlossenen Jobs mit Archiven laden
      const jobs = await loadCompletedJobsForBatch(batchId);
      
      setSelectedBatch(batch);
      setCompletedJobsForArchive(jobs);
      setArchiveDialogOpen(true);
    } catch (error) {
      console.error('Fehler beim Laden der Jobs für Archive:', error);
      alert('Fehler beim Laden der Jobs. Bitte versuchen Sie es erneut.');
    }
  };
  
  // Completed Jobs mit Archiven laden
  const loadCompletedJobsForBatch = async (batchId: string): Promise<Job[]> => {
    const response = await fetch(`/api/event-job/batches/${batchId}/jobs?limit=1000`);
    const data = await response.json();
    
    if (data.status === 'success') {
      const allJobs = data.data.jobs;
      const completedJobs = allJobs.filter((job: Job) => job.status === JobStatus.COMPLETED);
      
      console.log(`[Archive Debug] Batch ${batchId}:`);
      console.log(`  - Alle Jobs: ${allJobs.length}`);
      console.log(`  - COMPLETED Jobs: ${completedJobs.length}`);
      
      // Debug: Zeige Status-Verteilung
      const statusCounts = allJobs.reduce((acc: Record<string, number>, job: Job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {});
      console.log(`  - Status-Verteilung:`, statusCounts);
      
      // Debug: Analysiere alle COMPLETED Jobs
      completedJobs.forEach((job: Job, index: number) => {
        if (index < 3) { // Nur die ersten 3 zur Übersicht
          console.log(`  - COMPLETED Job ${index + 1}:`, {
            job_id: job.job_id,
            job_name: job.job_name,
            status: job.status,
            has_results: !!job.results,
            results_keys: job.results ? Object.keys(job.results) : [],
            has_archive_data: !!job.results?.archive_data,
            has_archive_filename: !!job.results?.archive_filename,
            archive_data_length: job.results?.archive_data ? job.results.archive_data.length : 0
          });
        }
      });
      
      // Gib alle COMPLETED Jobs zurück - Filterung passiert im Dialog
      return completedJobs;
    }
    
    return [];
  };
  
  // Archive-Verarbeitung abgeschlossen
  const handleArchiveComplete = (result: { success: Array<{ jobId: string; sessionName: string; filesCreated: number; markdownPath: string; assetsPath: string }>; failed: Array<{ jobId: string; sessionName: string; error: string }>; totalFiles: number }) => {
    setArchiveDialogOpen(false);
    setSelectedBatch(null);
    setCompletedJobsForArchive([]);
    
    // Erfolgs-Toast oder Notification
    if (result.success.length > 0) {
      const successMessage = `${result.success.length} Sessions erfolgreich in Library gespeichert. ${result.totalFiles} Dateien erstellt.`;
      if (result.failed.length > 0) {
        alert(`${successMessage}\n\n${result.failed.length} Session(s) fehlgeschlagen: ${result.failed.map(f => f.sessionName).join(', ')}`);
      } else {
        alert(successMessage);
      }
    } else if (result.failed.length > 0) {
      alert(`Alle ${result.failed.length} Sessions sind fehlgeschlagen: ${result.failed.map(f => f.error).join(', ')}`);
    } else {
      alert('Keine Sessions gefunden zum Verarbeiten.');
    }
  };
  
  // Hilfsfunktion: Zähle alle angezeigten Batches (bereits serverseitig gefiltert)
  const getBatchCountForFilteredEvent = (): number => {
    if (!selectedEvent) return 0;
    
    // Einfach: Verwende alle aktuell angezeigten Batches
    // Diese sind bereits serverseitig nach dem gewählten Event gefiltert
    console.log('[Event Restart] Event-Filter aktiv:', selectedEvent);
    console.log('[Event Restart] Verwende alle angezeigten Batches:', batches.length);
    console.log('[Event Restart] Batch-Namen:', batches.map(b => b.batch_name));
    
    return batches.length;
  };

  // Event-weiten Restart starten (für alle angezeigten Batches)
  const openEventRestartDialog = () => {
    if (!selectedEvent) {
      alert('Kein Event gefiltert. Bitte filtern Sie zuerst nach einem Event.');
      return;
    }
    
    if (batches.length === 0) {
      alert('Keine Batches zum Neustarten gefunden.');
      return;
    }
    
    setSelectedEventForRestart(selectedEvent);
    setEventRestartDialogOpen(true);
  };

  // Event-weiter Restart durchführen
  const handleEventRestart = async () => {
    if (!selectedEventForRestart) {
      alert('Bitte wählen Sie ein Event aus.');
      return;
    }
    
    // Verwende alle aktuell angezeigten Batches (bereits serverseitig gefiltert)
    const batchesForEvent = batches;
    
    const confirmMessage = `WARNUNG: Dies startet ALLE ${batchesForEvent.length} Batches des Events "${selectedEventForRestart}" neu.\n\n` +
      `Cache-Einstellung: ${eventRestartUseCache ? 'Cache VERWENDEN' : 'Cache NICHT verwenden (vollständige Neuverarbeitung)'}\n\n` +
      `Dies kann nicht rückgängig gemacht werden. Fortfahren?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      setEventRestartLoading(true);
      
      const response = await fetch(`/api/event-job/events/${encodeURIComponent(selectedEventForRestart)}/restart-all-batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          useCache: eventRestartUseCache,
          confirm: true 
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setEventRestartDialogOpen(false);
        
        // Erfolgs-Details anzeigen
        const { successful_batches, failed_batches, total_jobs_restarted } = data.data;
        const successMessage = `Event-Restart erfolgreich!\n\n` +
          `✅ ${successful_batches} Batches erfolgreich neu gestartet\n` +
          `❌ ${failed_batches} Batches fehlgeschlagen\n` +
          `📊 ${total_jobs_restarted} Jobs insgesamt neu gestartet\n` +
          `🔄 Cache: ${eventRestartUseCache ? 'Verwendet' : 'Deaktiviert'}`;
        
        alert(successMessage);
        onRefresh();
      } else {
        console.error('Fehler beim Event-Restart:', data.message);
        alert(`Fehler beim Event-Restart: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Event-Restart:', error);
      alert(`Fehler beim Event-Restart: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setEventRestartLoading(false);
    }
  };

  // Zusammenfassung für einen Batch erstellen
  async function createSummaryForBatch(batchId: string, template: string, targetLanguage: string) {
    try {
      // Prüfe ob eine Bibliotheks-ID vorhanden ist
      if (!activeLibraryId) {
        alert('Keine aktive Bibliothek ausgewählt. Bitte wählen Sie zuerst eine Bibliothek aus.');
        return;
      }
      
      setCreatingSummary(true);
      setSummaryDialogOpen(false);
      
      // Finde den Batch Namen (track_name) aus der batches-Liste
      const batch = batches.find(b => b.batch_id === batchId);
      if (!batch) {
        throw new Error('Batch nicht gefunden');
      }
      
      // Extrahiere den tatsächlichen Track-Namen aus dem Batch-Namen
      // Format: "EVENT - TRACK (X Jobs)" -> "TRACK"
      let trackName = batch.batch_name || "";
      const dashIndex = trackName.indexOf(' - ');
      if (dashIndex > 0) {
        const parenthesisIndex = trackName.lastIndexOf(' (');
        if (parenthesisIndex > dashIndex) {
          trackName = trackName.substring(dashIndex + 3, parenthesisIndex);
        } else {
          trackName = trackName.substring(dashIndex + 3);
        }
      }
      
      console.log(`Erstelle Zusammenfassung für Track: "${trackName}"`);
      
      // Verwende die aktive Bibliotheks-ID aus dem Atom-State
      const data = await createTrackSummary(
        trackName,
        targetLanguage,
        activeLibraryId,
        template,
        false // useCache
      );
      const result = data as { status: string; error?: { message?: string } };
      if (result.status === 'success') {
        alert(`Erfolgreich: Zusammenfassung für Track "${trackName}" erstellt.`);
      } else {
        alert(`Fehler: ${result.error?.message || 'Unbekannter Fehler bei der Erstellung der Zusammenfassung'}`);
      }
    } catch (error) {
      console.error('Fehler bei der Erstellung der Zusammenfassung:', error);
      if (error instanceof SecretaryServiceError) {
        alert(`Secretary Service Fehler: ${error.message}`);
      } else {
        alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
      }
    } finally {
      setCreatingSummary(false);
      setSelectedBatchId(null);
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Warnung für doppelte Batches */}
      {duplicateBatches.length > 0 && (
        <div className="bg-red-50 p-2 rounded text-red-700 text-sm">
          <strong>Doppelte Batches gefunden:</strong>
          <ul>
            {duplicateBatches.map(b => (
              <li key={b.batch_id}>{b.batch_name}</li>
            ))}
          </ul>
        </div>
      )}
      {/* Event-weite Steuerung - nur wenn Event gefiltert ist */}
      {selectedEvent && !isArchive && (
        <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-orange-900 dark:text-orange-100">Event-weite Aktionen</h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Alle <strong>{getBatchCountForFilteredEvent()}</strong> Batches des Events <strong>"{selectedEvent}"</strong> verwalten
                </p>
              </div>
              <div className="flex gap-2">
                {/* Alle Batches archivieren Button */}
                {onArchiveAllBatches && (
                  <Button
                    onClick={onArchiveAllBatches}
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-800"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Alle Batches archivieren
                  </Button>
                )}
                
                {/* Alle Batches neu starten Button */}
                <Button
                  onClick={() => openEventRestartDialog()}
                  variant="outline"
                  className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-800"
                  disabled={eventRestartLoading}
                >
                  {eventRestartLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCw className="w-4 h-4 mr-2" />
                  )}
                  Alle Batches neu starten
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {batches.map((batch) => {
        const jobs = jobsByBatch[batch.batch_id] || [];
        const duplicateJobs = getDuplicateJobs(jobs);
        return (
          <Card key={batch.batch_id} className="overflow-hidden">
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
                            <Button 
                              variant="ghost" 
                              className="h-8 w-8 p-0" 
                              disabled={processingBatch === batch.batch_id}
                            >
                              {processingBatch === batch.batch_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                              <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/event-monitor/batches/${batch.batch_id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> Details anzeigen
                            </DropdownMenuItem>
                            
                            {!isArchive && (
                              <>
                                <DropdownMenuItem onClick={() => toggleBatchActive(batch.batch_id)}>
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
                            
                            {/* Zusammenfassung erstellen Option */}
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                openSummaryDialog(batch.batch_id);
                              }}
                              disabled={processingBatch === batch.batch_id || creatingSummary}
                            >
                              <BookOpenText className="w-4 h-4 mr-2" />
                              Zusammenfassung erstellen
                            </DropdownMenuItem>
                            
                            {/* In Library speichern Option */}
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                openArchiveDialog(batch.batch_id);
                              }}
                              disabled={processingBatch === batch.batch_id}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              In Library speichern
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBatchForRestart(batch);
                                setBatchRestartDialogOpen(true);
                              }}
                              disabled={processingBatch === batch.batch_id}
                            >
                              <RotateCw className="w-4 h-4 mr-2" />
                              Batch neu starten
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
                            
                            {/* Warnung für doppelte Jobs im Batch */}
                            {duplicateJobs.length > 0 && (
                              <div className="bg-yellow-50 p-2 rounded text-yellow-800 text-xs border border-yellow-300 m-2">
                                <strong>Doppelte Jobs in diesem Batch:</strong>
                                <ul>
                                  {duplicateJobs.map(j => (
                                    <li key={j.job_id}>{j.job_name}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
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
              </TableBody>
            </Table>
          </Card>
        );
      })}
      
      {/* Zusammenfassungs-Dialog */}
      <Dialog 
        open={summaryDialogOpen} 
        onOpenChange={(open) => {
          if (!creatingSummary) setSummaryDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zusammenfassungs-Template wählen</DialogTitle>
            <DialogDescription>
              Wählen Sie den Template-Typ und die Zielsprache für die Zusammenfassung dieses Tracks.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="template-select-batch" className="mb-2 block">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template-select-batch">
                  <SelectValue placeholder="Template wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_MAP).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="language-select-batch" className="mb-2 block">Sprache</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger id="language-select-batch">
                  <SelectValue placeholder="Sprache wählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSummaryDialogOpen(false)}
              disabled={creatingSummary}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={() => selectedBatchId && createSummaryForBatch(selectedBatchId, selectedTemplate, selectedLanguage)} 
              disabled={creatingSummary || !selectedBatchId}
            >
              {creatingSummary ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Zusammenfassung erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Archive-Dialog */}
      {selectedBatch && (
        <BatchArchiveDialog
          batch={selectedBatch}
          completedJobs={completedJobsForArchive}
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
          onArchiveComplete={handleArchiveComplete}
        />
      )}
      
      {/* Dialog-Komponente für Batch-Restart */}
      {selectedBatchForRestart && (
        <Dialog open={batchRestartDialogOpen} onOpenChange={setBatchRestartDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Batch neu starten</DialogTitle>
              <DialogDescription>
                Alle Jobs im Batch "{selectedBatchForRestart.batch_name}" werden auf PENDING zurückgesetzt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="batch-use-cache"
                  checked={batchRestartDialogUseCache}
                  onCheckedChange={(checked) => setBatchRestartDialogUseCache(checked === true)}
                />
                <Label htmlFor="batch-use-cache" className="text-sm">
                  Cache verwenden
                </Label>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Wenn aktiviert, werden bereits verarbeitete Dateien aus dem Cache wiederverwendet.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBatchRestartDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button 
                onClick={async () => {
                  setBatchRestartDialogLoading(true);
                  try {
                    const response = await fetch(`/api/event-job/batches/${selectedBatchForRestart.batch_id}/restart`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ useCache: batchRestartDialogUseCache }),
                    });
                    const data = await response.json();
                    if (data.status === 'success') {
                      setBatchRestartDialogOpen(false);
                      setSelectedBatchForRestart(null);
                      onRefresh();
                    } else {
                      alert('Fehler: ' + data.message);
                    }
                  } catch (error) {
                    alert('Fehler beim Neustarten des Batches');
                  } finally {
                    setBatchRestartDialogLoading(false);
                  }
                }}
                disabled={batchRestartDialogLoading}
              >
                {batchRestartDialogLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Batch neu starten
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog-Komponente für Event-weiten Restart */}
      <Dialog open={eventRestartDialogOpen} onOpenChange={setEventRestartDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCw className="w-5 h-5 text-orange-600" />
              Alle Batches neu starten
            </DialogTitle>
            <DialogDescription>
              Startet alle Batches des Events <strong>"{selectedEventForRestart}"</strong> neu. 
              Dies ist eine mächtige Operation, die viele Jobs gleichzeitig beeinflusst.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Event-Info (nicht editierbar) */}
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Event: {selectedEventForRestart}
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    Gefiltertes Event wird neu gestartet
                  </p>
                </div>
              </div>
            </div>

            {/* Batch-Vorschau */}
            {selectedEventForRestart && (
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm font-medium mb-2">Betroffene Batches ({batches.length}):</p>
                <div className="text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                  {batches.map(batch => (
                    <div key={batch.batch_id} className="flex justify-between py-1">
                      <span className="truncate mr-2">{batch.batch_name}</span>
                      <span className="text-xs flex-shrink-0">({batch.total_jobs} Jobs)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cache-Option */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="event-use-cache"
                  checked={eventRestartUseCache}
                  onCheckedChange={(checked) => setEventRestartUseCache(checked === true)}
                  disabled={eventRestartLoading}
                />
                <Label htmlFor="event-use-cache" className="text-sm font-medium">
                  Cache verwenden
                </Label>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Cache aktiviert:</strong> Bereits verarbeitete Dateien werden wiederverwendet (schneller)<br/>
                <strong>Cache deaktiviert:</strong> Vollständige Neuverarbeitung aller Dateien (langsamer, aber aktueller)
              </div>
            </div>

            {/* Warnung */}
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800 dark:text-orange-200">Warnung</p>
                  <p className="text-orange-700 dark:text-orange-300">
                    Diese Aktion startet alle Jobs in allen Batches des gewählten Events neu. 
                    Laufende Verarbeitungen werden unterbrochen.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEventRestartDialogOpen(false)}
              disabled={eventRestartLoading}
            >
              Abbrechen
            </Button>
                          <Button 
                onClick={handleEventRestart}
                disabled={eventRestartLoading || !selectedEventForRestart}
                className="bg-orange-600 hover:bg-orange-700"
              >
                                {eventRestartLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCw className="w-4 h-4 mr-2" />
                )}
                {getBatchCountForFilteredEvent()} Batches neu starten
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 