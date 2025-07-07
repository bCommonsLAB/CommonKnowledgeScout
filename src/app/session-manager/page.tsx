'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  PlayCircle,
  Loader2,
  RefreshCw,
  Users,
  Clock,
  Globe,
  Video,
  FileText
} from 'lucide-react';
import { Session } from '@/types/session';
import { LANGUAGE_MAP } from '@/lib/secretary/constants';
import SessionEventFilter from '@/components/session/session-event-filter';
import SessionImportModal from '@/components/session/session-import-modal';

export default function SessionManagerPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [trackFilter, setTrackFilter] = useState<string>('');
  const [dayFilter, setDayFilter] = useState<string>('');
  const [languageFilter, setLanguageFilter] = useState<string>('');
  
  // Verfügbare Filter-Optionen
  const [availableTracks, setAvailableTracks] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  
  // Job-Generierung Dialog
  const [generateJobsDialog, setGenerateJobsDialog] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('de');
  const [batchName, setBatchName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [groupByTrack, setGroupByTrack] = useState(true);
  
  // Session-Import Dialog
  const [sessionImportDialog, setSessionImportDialog] = useState(false);
  
  // Event-Filter State
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  
  const router = useRouter();
  
  // Sessions laden
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (selectedEvent) params.set('event', selectedEvent);
      if (trackFilter) params.set('track', trackFilter);
      if (dayFilter) params.set('day', dayFilter);
      if (languageFilter) params.set('source_language', languageFilter);
      
      const response = await fetch(`/api/sessions?${params.toString()}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setSessions(data.data.sessions);
        
        // Filter-Optionen extrahieren
        const tracks = Array.from(new Set(data.data.sessions.map((s: Session) => s.track))).filter((t): t is string => typeof t === 'string' && t !== null && t !== undefined);
        const days = Array.from(new Set(data.data.sessions.map((s: Session) => s.day))).filter((d): d is string => typeof d === 'string' && d !== null && d !== undefined);
        const languages = Array.from(new Set(data.data.sessions.map((s: Session) => s.source_language))).filter((l): l is string => typeof l === 'string' && l !== null && l !== undefined);
        
        setAvailableTracks(tracks.sort());
        setAvailableDays(days.sort());
        setAvailableLanguages(languages.sort());
      } else {
        console.error('Fehler beim Laden der Sessions:', data.message);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedEvent, trackFilter, dayFilter, languageFilter]);
  
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);
  

  
  // Session auswählen/abwählen
  const toggleSessionSelection = (sessionId: string) => {
    const newSelection = new Set(selectedSessions);
    if (newSelection.has(sessionId)) {
      newSelection.delete(sessionId);
    } else {
      newSelection.add(sessionId);
    }
    setSelectedSessions(newSelection);
  };
  
  // Alle auswählen/abwählen
  const toggleSelectAll = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id!)));
    }
  };
  
  // Event-Jobs generieren
  const generateJobs = async () => {
    if (selectedSessions.size === 0) {
      alert('Bitte wählen Sie mindestens eine Session aus.');
      return;
    }
    
    try {
      setGenerating(true);
      
      const response = await fetch('/api/sessions/generate-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionIds: Array.from(selectedSessions),
          targetLanguage,
          batchName: batchName || undefined,
          groupByTrack
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        const jobCount = groupByTrack ? data.data.totalJobs : data.data.jobIds.length;
        const batchCount = groupByTrack ? data.data.batchCount : 1;
        
        if (groupByTrack) {
          alert(`Erfolgreich ${jobCount} Jobs in ${batchCount} Batches (nach Tracks gruppiert) generiert!`);
        } else {
          alert(`Erfolgreich ${jobCount} Jobs in 1 Batch generiert!`);
        }
        
        setGenerateJobsDialog(false);
        setSelectedSessions(new Set());
        
        // Zum Event-Monitor navigieren
        router.push('/event-monitor');
      } else {
        alert(`Fehler: ${data.message}`);
      }
    } catch (error) {
      console.error('Fehler beim Generieren der Jobs:', error);
      alert('Ein Fehler ist aufgetreten.');
    } finally {
      setGenerating(false);
    }
  };
  
  // Ausgewählte Sessions löschen
  const deleteSelectedSessions = async () => {
    if (selectedSessions.size === 0) {
      alert('Bitte wählen Sie mindestens eine Session aus.');
      return;
    }
    
    if (!window.confirm(`Möchten Sie wirklich ${selectedSessions.size} Sessions löschen?`)) {
      return;
    }
    
    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedSessions) })
      });
      
      if (response.ok) {
        setSelectedSessions(new Set());
        loadSessions();
      } else {
        alert('Fehler beim Löschen der Sessions.');
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Ein Fehler ist aufgetreten.');
    }
  };
  
  // Handler für erfolgreich importierte Session
  const handleSessionImported = (sessionData: unknown) => {
    console.log('[SessionManager] Session importiert:', sessionData);
    // Sessions neu laden um neue Session anzuzeigen
    loadSessions();
  };
  
  // Speakers Array editieren
  const renderSpeakersCell = (session: Session) => {
    const speakersText = session.speakers?.join(', ') || '';
    
    return (
      <div
        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded group max-w-48"
        title="Klicken zum Bearbeiten (Sprecher mit Komma trennen)"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm break-words whitespace-pre-line">{speakersText || <span className="text-gray-400">Keine Sprecher</span>}</span>
        </div>
      </div>
    );
  };
  
  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Session Manager</h1>
          
          {/* Event-Filter Dropdown */}
          <SessionEventFilter
            value={selectedEvent}
            onChange={setSelectedEvent}
            className="border-l pl-4 pr-4"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={() => setGenerateJobsDialog(true)} disabled={selectedSessions.size === 0}>
            <PlayCircle className="w-4 h-4 mr-2" />
            Jobs generieren ({selectedSessions.size})
          </Button>
          
          <Button variant="outline" onClick={loadSessions} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          
          <Button variant="outline" onClick={() => setSessionImportDialog(true)}>
            <Globe className="w-4 h-4 mr-2" />
            Aus Website importieren
          </Button>
          
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          
          <Button 
            variant="destructive" 
            onClick={deleteSelectedSessions}
            disabled={selectedSessions.size === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Löschen ({selectedSessions.size})
          </Button>
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
      
      {/* Filter-Leiste */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Session suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          <Select value={trackFilter === '' ? '__all__' : trackFilter} onValueChange={v => setTrackFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Track wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Tracks</SelectItem>
              {availableTracks.map(track => (
                <SelectItem key={track} value={track}>{track}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={dayFilter === '' ? '__all__' : dayFilter} onValueChange={v => setDayFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tag wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Tage</SelectItem>
              {availableDays.map(day => (
                <SelectItem key={day} value={day}>{day}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={languageFilter === '' ? '__all__' : languageFilter} onValueChange={v => setLanguageFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sprache" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle</SelectItem>
              {availableLanguages.map(lang => (
                <SelectItem key={lang} value={lang}>{lang?.toUpperCase() || 'UNBEKANNT'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {(searchTerm || trackFilter || dayFilter || languageFilter) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setTrackFilter('');
                setDayFilter('');
                setLanguageFilter('');
              }}
            >
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </Card>
      
      {/* Sessions Statistik */}
      <div className="mb-4 text-sm text-gray-600">
        {loading ? 'Lädt...' : `${sessions.length} Sessions gefunden`}
        {selectedSessions.size > 0 && ` • ${selectedSessions.size} ausgewählt`}
      </div>
      
      {/* Sessions Tabelle */}
      <Card className="overflow-hidden">
        <div>
          <Table className="table-auto w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={sessions.length > 0 && selectedSessions.size === sessions.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Session Details</TableHead>
                <TableHead>Zeit</TableHead>
                <TableHead>Sprecher</TableHead>
                <TableHead>Links</TableHead>
                <TableHead>Sprache</TableHead>
                <TableHead>Dateiname</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  </TableCell>
                </TableRow>
              ) : sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Keine Sessions gefunden
                    {(searchTerm || selectedEvent || trackFilter || dayFilter || languageFilter) && (
                      <div className="mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSearchTerm('');
                            setTrackFilter('');
                            setDayFilter('');
                            setLanguageFilter('');
                          }}
                        >
                          Filter zurücksetzen
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.id!)}
                        onChange={() => toggleSessionSelection(session.id!)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">{session.event} - {session.track}</div>
                        {session.url ? (
                          <a 
                            href={session.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:underline block"
                            title="Session-Webseite öffnen"
                          >
                            {session.session}
                          </a>
                        ) : (
                          <div className="font-medium">{session.session}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{session.day}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>{session.starttime} - {session.endtime}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="break-words whitespace-pre-line align-top">
                      {renderSpeakersCell(session)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        {session.video_url && (
                          <div className="flex items-center gap-2">
                            <Video className="w-3 h-3 text-gray-500" />
                            <a 
                              href={session.video_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs truncate max-w-32"
                              title={session.video_url}
                            >
                              Video
                            </a>
                          </div>
                        )}
                        {session.attachments_url && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-gray-500" />
                            <a 
                              href={session.attachments_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs truncate max-w-32"
                              title={session.attachments_url}
                            >
                              Anhänge
                            </a>
                          </div>
                        )}
                        {!session.video_url && !session.attachments_url && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <Badge>{session.source_language?.toUpperCase() || 'UNBEKANNT'}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-[10px] text-gray-500 truncate max-w-48" title={session.filename}>
                        {session.filename || '—'}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      
      {/* Job-Generierung Dialog */}
      <Dialog open={generateJobsDialog} onOpenChange={setGenerateJobsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event-Jobs generieren</DialogTitle>
            <DialogDescription>
              Erstelle Event-Jobs aus {selectedSessions.size} ausgewählten Sessions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Zielsprache</label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGE_MAP).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="groupByTrack"
                  checked={groupByTrack}
                  onChange={(e) => setGroupByTrack(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="groupByTrack" className="text-sm font-medium cursor-pointer">
                  Batches aus Tracks generieren
                </label>
              </div>
              <p className="text-xs text-gray-500 pl-6">
                {groupByTrack 
                  ? "Erstellt für jeden Track einen separaten Batch mit dem Track-Namen."
                  : "Erstellt einen einzigen Batch für alle ausgewählten Sessions."
                }
              </p>
            </div>
            
            {!groupByTrack && (
              <div>
                <label className="text-sm font-medium">Batch-Name (optional)</label>
                <Input
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Automatisch generiert falls leer"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateJobsDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={generateJobs} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Jobs generieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Session-Import Dialog */}
      <SessionImportModal
        open={sessionImportDialog}
        onOpenChange={setSessionImportDialog}
        onSessionImported={handleSessionImported}
      />
    </div>
  );
} 