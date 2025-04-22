'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Plus, AlertTriangle, Clock } from 'lucide-react';
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

export default function EventMonitorPage() {
  const [currentBatches, setCurrentBatches] = useState<Batch[]>([]);
  const [archiveBatches, setArchiveBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('current');
  const [error, setError] = useState<string | null>(null);
  
  // Job-Details Panel Zustand
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Sprachauswahl-Dialog
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("de");
  const language_map = {
    "de": "Deutsch",
    "en": "Englisch",
    "es": "Spanisch",
    "fr": "Französisch",
    "it": "Italienisch",
    "nl": "Niederländisch",
    "zh": "Chinesisch",
  };
  
  const router = useRouter();
  
  // Laufende Batches laden
  useEffect(() => {
    loadCurrentBatches();
    
    // Auto-Refresh Timer einrichten
    let intervalId: NodeJS.Timeout | undefined = undefined;
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        if (activeTab === 'current') {
          loadCurrentBatches(false);
        } else if (activeTab === 'archive') {
          loadArchiveBatches(false);
        }
      }, 10000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, activeTab]);
  
  async function loadCurrentBatches(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true);
      }
      
      const response = await fetch('/api/event-job/batches?archived=false');
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentBatches(data.data.batches);
        setError(null);
      } else {
        console.error('Fehler beim Laden der Batches:', data.message);
        setError(data.message || 'Fehler beim Laden der Batches');
      }
    } catch (error) {
      console.error('Fehler beim Laden der Batches:', error);
      setError('Fehler beim Laden der Batches');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }
  
  async function loadArchiveBatches(showLoader = true) {
    try {
      if (showLoader) {
        setArchiveLoading(true);
      }
      
      const response = await fetch('/api/event-job/batches?archived=true');
      const data = await response.json();
      
      if (data.status === 'success') {
        setArchiveBatches(data.data.batches);
        setError(null);
      } else {
        console.error('Fehler beim Laden der archivierten Batches:', data.message);
        setError(data.message || 'Fehler beim Laden der archivierten Batches');
      }
    } catch (error) {
      console.error('Fehler beim Laden der archivierten Batches:', error);
      setError('Fehler beim Laden der archivierten Batches');
    } finally {
      if (showLoader) {
        setArchiveLoading(false);
      }
    }
  }
  
  async function handleTabChange(value: string) {
    setActiveTab(value);
    
    if (value === 'archive' && archiveBatches.length === 0) {
      loadArchiveBatches();
    }
  }
  
  async function handleFailAllBatches() {
    if (!window.confirm('Sind Sie sicher, dass Sie alle aktuellen Batches auf "failed" setzen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
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
        loadCurrentBatches();
      } else {
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Setzen aller Batches auf Failed:', error);
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
        loadCurrentBatches();
      } else {
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Setzen aller Batches auf Pending:', error);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  }
  
  // Funktion zum Öffnen des Job-Detail Panels
  const openJobDetails = (jobId: string) => {
    setSelectedJobId(jobId);
    setJobDetailsOpen(true);
  };

  // Job-Details Panel schließen
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
        <h1 className="text-3xl font-bold">Event-Verarbeitungs-Monitor</h1>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => router.push('/event-monitor/create-batch')} 
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Batch erstellen
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
              onClick={() => activeTab === 'current' ? loadCurrentBatches() : loadArchiveBatches()} 
              variant="outline" 
              size="sm" 
              disabled={loading || archiveLoading}
            >
              {(loading || archiveLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      <Tabs 
        defaultValue="current" 
        onValueChange={handleTabChange}
      >
        <TabsList className="mb-4">
          <TabsTrigger value="current">
            Aktuelle Batches 
            <span className="ml-2 bg-blue-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {currentBatches.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="archive">
            Archiv
            {archiveBatches.length > 0 && (
              <span className="ml-2 bg-gray-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {archiveBatches.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="current" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : currentBatches.length > 0 ? (
            <BatchList 
              batches={currentBatches} 
              onRefresh={loadCurrentBatches} 
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Keine aktuellen Batches gefunden.</p>
              <Button 
                onClick={() => router.push('/event-monitor/create-batch')} 
                variant="outline" 
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" /> Ersten Batch erstellen
              </Button>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="archive" className="space-y-4">
          {archiveLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : archiveBatches.length > 0 ? (
            <BatchList 
              batches={archiveBatches} 
              onRefresh={loadArchiveBatches} 
              isArchive={true}
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Keine archivierten Batches gefunden.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Job-Details Seitenleiste */}
      <JobDetailsPanel 
        isOpen={jobDetailsOpen} 
        onOpenChange={handleJobDetailsPanelChange} 
        jobId={selectedJobId}
        onRefresh={() => activeTab === 'current' ? loadCurrentBatches() : loadArchiveBatches()}
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
                {Object.entries(language_map).map(([code, name]) => (
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
    </div>
  );
} 