'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Plus, AlertTriangle, Clock, FileCheck, FileX, Files, BookOpenText, Filter } from 'lucide-react'; // 🆕 Filter Icon hinzugefügt
import BatchList from '@/components/event-monitor/batch-list';
import { Batch } from '@/types/event-job';
import JobDetailsPanel from '@/components/event-monitor/job-details-panel';
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
import { createAllTrackSummaries, SecretaryServiceError } from '@/lib/secretary/client';
import { useAtom } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';
import { selectedEventAtom } from '@/atoms/event-filter-atom'; // 🆕 Event-Filter Atom
import { LANGUAGE_MAP, TEMPLATE_MAP } from '@/lib/secretary/constants';
import EventFilterDropdown from '@/components/event-monitor/event-filter-dropdown';
// JobArchiveTest entfernt - wird durch Job-spezifische Download-Buttons ersetzt

export default function EventMonitorPage() {
  const [currentTracks, setCurrentTracks] = useState<Batch[]>([]);
  const [archiveTracks, setArchiveTracks] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('current');
  const [error, setError] = useState<string | null>(null);
  
  // Job-Details Panel Zustand
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Statistiken
  const [statsTotal, setStatsTotal] = useState(0);
  const [statsCompleted, setStatsCompleted] = useState(0);
  const [statsFailed, setStatsFailed] = useState(0);
  
  // Sprachauswahl-Dialog
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("de");
  // Template-Dialog für Zusammenfassungen
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("track_eco_social");
  const [summarizing, setSummarizing] = useState(false);
  
  // Verwende useAtom statt useAtomValue für activeLibraryIdAtom
  const [activeLibraryId] = useAtom(activeLibraryIdAtom);
  const [selectedEvent] = useAtom(selectedEventAtom); // 🆕 Event-Filter State
  
  // Debug-Logging für die aktive Bibliothek
  useEffect(() => {
    console.log('EventMonitor: Aktive Bibliothek:', activeLibraryId || 'keine');
  }, [activeLibraryId]);
  
  const router = useRouter();
  
  // Laufende Tracks laden
  useEffect(() => {
    loadCurrentTracks();
    
    // Auto-Refresh Timer einrichten
    let intervalId: NodeJS.Timeout | undefined = undefined;
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        if (activeTab === 'current') {
          loadCurrentTracks(false);
        } else if (activeTab === 'archive') {
          loadArchiveTracks(false);
        }
      }, 10000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, activeTab, selectedEvent]); // 🆕 selectedEvent als Dependency hinzugefügt
  
  // Statistiken berechnen
  useEffect(() => {
    // Berechnung der Statistiken aus den aktuellen Tracks
    let total = 0;
    let completed = 0;
    let failed = 0;
    
    currentTracks.forEach(track => {
      total += track.total_jobs || 0;
      completed += track.completed_jobs || 0;
      failed += track.failed_jobs || 0;
    });
    
    setStatsTotal(total);
    setStatsCompleted(completed);
    setStatsFailed(failed);
  }, [currentTracks]);
  
  // URL für API-Aufrufe erweitern
  const buildApiUrl = (baseUrl: string, archived: boolean) => {
    const params = new URLSearchParams();
    params.set('archived', archived.toString());
    
    if (selectedEvent) {
      params.set('event', selectedEvent);
    }
    
    return `${baseUrl}?${params.toString()}`;
  };

  const loadCurrentTracks = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      
      const url = buildApiUrl('/api/event-job/batches', false);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentTracks(data.data.batches);
        setError(null);
      } else {
        console.error('Fehler beim Laden der Tracks:', data.message);
        setError(data.message || 'Fehler beim Laden der Tracks');
      }
    } catch (error) {
      console.error('Fehler beim Laden der Tracks:', error);
      setError('Fehler beim Laden der Tracks');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [selectedEvent]);
  
  const loadArchiveTracks = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setArchiveLoading(true);
      }
      
      const url = buildApiUrl('/api/event-job/batches', true);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'success') {
        setArchiveTracks(data.data.batches);
        setError(null);
      } else {
        console.error('Fehler beim Laden der archivierten Tracks:', data.message);
        setError(data.message || 'Fehler beim Laden der archivierten Tracks');
      }
    } catch (error) {
      console.error('Fehler beim Laden der archivierten Tracks:', error);
      setError('Fehler beim Laden der archivierten Tracks');
    } finally {
      if (showLoader) {
        setArchiveLoading(false);
      }
    }
  }, [selectedEvent]);
  
  async function handleTabChange(value: string) {
    setActiveTab(value);
    
    if (value === 'archive' && archiveTracks.length === 0) {
      loadArchiveTracks();
    }
  }
  
  async function handleFailAllBatches() {
    if (!window.confirm('Sind Sie sicher, dass Sie alle aktuellen Tracks auf "failed" setzen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/event-job/batches/fail-all', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ confirm: true })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(data.message);
        // Neu laden um Änderungen zu sehen
        loadCurrentTracks();
      } else {
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Setzen aller Tracks auf Failed:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  }
  
  async function handlePendingAllBatches() {
    // Sprachauswahl-Dialog öffnen statt direkter Bestätigung
    setLanguageDialogOpen(true);
  }
  
  async function confirmPendingAll() {
    try {
      setLoading(true);
      setLanguageDialogOpen(false);
      
      const response = await fetch('/api/event-job/batches/pending-all', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          confirm: true,
          targetLanguage: selectedLanguage
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(data.message);
        loadCurrentTracks();
      } else {
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Setzen aller Tracks auf Pending:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSummarizeAllBatches() {
    // Template-Auswahl-Dialog öffnen
    setSummaryDialogOpen(true);
  }
  
  async function confirmSummarizeAll() {
    try {
      // Prüfe ob eine Bibliotheks-ID vorhanden ist
      if (!activeLibraryId) {
        alert('Keine aktive Bibliothek ausgewählt. Bitte wählen Sie zuerst eine Bibliothek aus.');
        setSummaryDialogOpen(false);
        return;
      }
      
      setSummarizing(true);
      setSummaryDialogOpen(false);
      
      console.log('Erstelle Zusammenfassungen für alle Tracks...');
      console.log('Hinweis: Die API verwendet die Track-Namen (nicht die vollständigen Batch-Namen)');
      
      // Verwende die aktive Bibliotheks-ID aus dem Atom-State
      const data = await createAllTrackSummaries(
        selectedLanguage,
        activeLibraryId,
        selectedTemplate,
        false // useCache
      ) as { status: string; summary?: { successful_tracks: number; failed_tracks: number }; error?: { message: string } };
      
      if (data.status === 'success') {
        alert(`Erfolgreich: ${data.summary?.successful_tracks ?? 0} Tracks zusammengefasst, ${data.summary?.failed_tracks ?? 0} fehlgeschlagen.`);
        loadCurrentTracks();
      } else {
        alert(`Fehler: ${data.error?.message || 'Unbekannter Fehler bei der Erstellung der Zusammenfassungen'}`);
      }
    } catch (error) {
      console.error('Fehler bei der Erstellung der Zusammenfassungen:', error);
      if (error instanceof SecretaryServiceError) {
        alert(`Secretary Service Fehler: ${error.message}`);
      } else {
        alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
      }
    } finally {
      setSummarizing(false);
    }
  }
  
  // Event-Filter-Change Handler
  const handleEventFilterChange = useCallback((eventName: string | null) => {
    // Daten werden automatisch durch useEffect neu geladen wenn selectedEvent sich ändert
    console.log('Event-Filter geändert zu:', eventName);
  }, []);

  const handleJobDetailsPanelChange = (open: boolean) => {
    setJobDetailsOpen(open);
    if (!open) {
      // Nach dem Schließen den ausgewählten Job zurücksetzen
      setSelectedJobId(null);
    }
  };
  
  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Event-Track-Monitor</h1>
          
          {/* 🆕 Event-Filter Dropdown */}
          <EventFilterDropdown 
            onEventChange={handleEventFilterChange}
            className="border-l pl-4 pr-4"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => router.push('/event-monitor/create-batch')} 
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Track erstellen
          </Button>
          
          <Button 
            onClick={handleFailAllBatches} 
            variant="destructive" 
            size="sm"
            disabled={loading}
          >
            <AlertTriangle className="w-4 h-4 mr-2" /> Alle auf Failed
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="border-amber-500 text-amber-600 hover:bg-amber-50"
            onClick={handlePendingAllBatches}
            disabled={loading}
          >
            <Clock className="w-4 h-4 mr-2" /> Alle auf Pending
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={handleSummarizeAllBatches}
            disabled={loading || summarizing || !activeLibraryId}
            title={!activeLibraryId ? "Bitte wählen Sie zuerst eine Bibliothek aus" : "Zusammenfassung für alle Tracks erstellen"}
          >
            {summarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpenText className="w-4 h-4 mr-2" />} Alle zusammenfassen
          </Button>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Auto-Refresh (10s)</span>
            </label>
            
            <Button 
              onClick={() => activeTab === 'current' ? loadCurrentTracks() : loadArchiveTracks()} 
              variant="outline" 
              size="sm" 
              disabled={loading || archiveLoading}
            >
              {(loading || archiveLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Event-Filter Status anzeigen */}
      {selectedEvent && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-800 dark:text-blue-300">
              Gefiltert nach Event: <strong>{selectedEvent}</strong>
            </span>
          </div>
        </div>
      )}
      
      {/* Statistiken */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center space-x-4 border border-gray-200 dark:border-gray-700">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            <Files className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Gesamt</div>
            <div className="text-2xl font-bold">{statsTotal}</div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center space-x-4 border border-gray-200 dark:border-gray-700">
          <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Erfolgreich</div>
            <div className="text-2xl font-bold">{statsCompleted}</div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex items-center space-x-4 border border-gray-200 dark:border-gray-700">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            <FileX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Fehlerhaft</div>
            <div className="text-2xl font-bold">{statsFailed}</div>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {/* Archive-Test-Komponente entfernt - Download-Buttons sind jetzt direkt bei den Jobs integriert */}
      
      <Tabs 
        defaultValue="current" 
        onValueChange={handleTabChange}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="current">
            Aktuelle Tracks 
            <span className="ml-2 bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {currentTracks.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="archive">
            Archiv
            {archiveTracks.length > 0 && (
              <span className="ml-2 bg-gray-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {archiveTracks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="current" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : currentTracks.length > 0 ? (
            <BatchList 
              batches={currentTracks} 
              onRefresh={loadCurrentTracks} 
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Keine aktuellen Tracks gefunden.</p>
              <Button 
                onClick={() => router.push('/event-monitor/create-batch')} 
                variant="outline" 
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" /> Ersten Track erstellen
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="archive" className="space-y-4">
          {archiveLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : archiveTracks.length > 0 ? (
            <BatchList 
              batches={archiveTracks} 
              onRefresh={loadArchiveTracks} 
              isArchive={true}
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Keine archivierten Tracks gefunden.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Job-Details Seitenleiste */}
      <JobDetailsPanel 
        isOpen={jobDetailsOpen} 
        onOpenChange={handleJobDetailsPanelChange} 
        jobId={selectedJobId}
        onRefresh={() => activeTab === 'current' ? loadCurrentTracks() : loadArchiveTracks()}
      />
      
      {/* Sprachauswahl-Dialog */}
      <Dialog 
        open={languageDialogOpen} 
        onOpenChange={(open) => {
          if (!loading) setLanguageDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zielsprache auswählen</DialogTitle>
            <DialogDescription>
              Wählen Sie die Zielsprache, die für alle Jobs gesetzt werden soll.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="language-select" className="mb-2 block">Sprache</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger id="language-select">
                <SelectValue placeholder="Sprache wählen" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                  <SelectItem key={code} value={code}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setLanguageDialogOpen(false)}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={confirmPendingAll} 
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Template-Auswahl-Dialog für Zusammenfassungen */}
      <Dialog 
        open={summaryDialogOpen} 
        onOpenChange={(open) => {
          if (!summarizing) setSummaryDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zusammenfassungs-Template wählen</DialogTitle>
            <DialogDescription>
              Wählen Sie den Template-Typ und die Zielsprache für die Zusammenfassungen aller Tracks.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="template-select" className="mb-2 block">Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger id="template-select">
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
              <Label htmlFor="language-select-summary" className="mb-2 block">Sprache</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger id="language-select-summary">
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
              disabled={summarizing}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={confirmSummarizeAll} 
              disabled={summarizing}
            >
              {summarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Zusammenfassen starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 