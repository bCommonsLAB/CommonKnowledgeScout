'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle, Globe, Download, FileStack, Link } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { importSessionFromUrl, SecretaryServiceError } from '@/lib/secretary/client';
import { StructuredSessionData } from '@/lib/secretary/types';

interface SessionImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionImported?: (sessionData: unknown) => void;
}

// Typ für Session-Link aus Batch-Import
interface SessionLink {
  name: string;
  url: string;
  status?: 'pending' | 'importing' | 'success' | 'error';
  error?: string;
  track?: string; // Track Information aus der Liste
}

export default function SessionImportModal({ 
  open, 
  onOpenChange, 
  onSessionImported 
}: SessionImportModalProps) {
  // Single Import State
  const [url, setUrl] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<StructuredSessionData | null>(null);
  
  // Batch Import State
  const [batchUrl, setBatchUrl] = useState('');
  const [batchSourceLanguage, setBatchSourceLanguage] = useState('en');
  const [batchTargetLanguage, setBatchTargetLanguage] = useState('en');
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [sessionLinks, setSessionLinks] = useState<SessionLink[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [isImportingBatch, setIsImportingBatch] = useState(false);
  const [batchEvent, setBatchEvent] = useState<string>(''); // Globales Event aus der Batch-Liste
  const [shouldCancelBatch, setShouldCancelBatch] = useState(false); // Flag für Abbruch
  
  // Tab State
  const [activeTab, setActiveTab] = useState('single');

  // Modal zurücksetzen
  const resetModal = () => {
    // Single Import
    setUrl('');
    setSourceLanguage('en');
    setTargetLanguage('en');
    setImporting(false);
    setError(null);
    setSuccess(null);
    setImportedData(null);
    
    // Batch Import
    setBatchUrl('');
    setBatchSourceLanguage('en');
    setBatchTargetLanguage('en');
    setBatchImporting(false);
    setBatchError(null);
    setSessionLinks([]);
    setImportProgress(0);
    setIsImportingBatch(false);
    setBatchEvent('');
    setShouldCancelBatch(false);
    
    // Tab
    setActiveTab('single');
  };

  // Modal schließen
  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  // URL validieren
  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  // Session-Import durchführen (Single)
  const handleImport = async () => {
    if (!url.trim()) {
      setError('Bitte geben Sie eine URL ein.');
      return;
    }

    if (!isValidUrl(url)) {
      setError('Bitte geben Sie eine gültige URL ein.');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setSuccess(null);

      console.log('[SessionImportModal] Starte Import für URL:', url);
      
      const response = await importSessionFromUrl(url, {
        sourceLanguage,
        targetLanguage,
        template: 'ExtractSessionDataFromWebsite',
        useCache: false
      });

      console.log('[SessionImportModal] Import erfolgreich:', response);

      if (response.status === 'success' && response.data && response.data.structured_data) {
        const structuredData = response.data.structured_data;
        setImportedData(structuredData);
        setSuccess('Session-Daten erfolgreich extrahiert! Überprüfen Sie die Vorschau und bestätigen Sie die Erstellung.');
      } else {
        throw new Error('Keine Session-Daten erhalten');
      }
    } catch (error) {
      console.error('[SessionImportModal] Import-Fehler:', error);
      
      if (error instanceof SecretaryServiceError) {
        setError(error.message);
      } else {
        setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
      }
    } finally {
      setImporting(false);
    }
  };

  // Session erstellen (Single)
  const handleCreateSession = async () => {
    if (!importedData) return;

    try {
      setImporting(true);
      setError(null);

      // Session-Daten in korrekte Struktur transformieren
      const sessionData = {
        event: importedData.event || '',
        session: importedData.session || '',
        subtitle: importedData.subtitle || '',
        description: importedData.description || '',
        filename: importedData.filename || '',
        track: importedData.track || '',
        video_url: importedData.video_url || '',
        attachments_url: importedData.attachments_url || '',
        url: importedData.url || url,
        day: importedData.day || '',
        starttime: importedData.starttime || '',
        endtime: importedData.endtime || '',
        speakers: Array.isArray(importedData.speakers) ? importedData.speakers : [importedData.speakers || ''],
        source_language: importedData.language || sourceLanguage,
        target_language: importedData.language || targetLanguage
      };

      // Session-Daten an API senden
      console.log('[SessionImportModal] handleCreateSession - Sende Session-Daten an API:', JSON.stringify(sessionData, null, 2));
      
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessions: [sessionData]
        })
      });

      console.log('[SessionImportModal] handleCreateSession - API Response Status:', response.status);
      
      const data = await response.json();
      console.log('[SessionImportModal] handleCreateSession - API Response Data:', data);

      if (data.status === 'success') {
        setSuccess('Session erfolgreich erstellt!');
        
        // Callback aufrufen falls vorhanden
        if (onSessionImported) {
          onSessionImported(data.data);
        }
        
        // Nach kurzer Verzögerung Modal schließen
        setTimeout(() => {
          handleClose();
          // Seite neu laden oder Event auslösen für Session-Liste-Update
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(data.message || 'Fehler beim Erstellen der Session');
      }
    } catch (error) {
      console.error('[SessionImportModal] Fehler beim Erstellen der Session:', error);
      setError('Fehler beim Erstellen der Session. Bitte versuchen Sie es erneut.');
    } finally {
      setImporting(false);
    }
  };

  // Batch: Session-Liste von URL extrahieren
  const handleExtractSessionList = async () => {
    if (!batchUrl.trim()) {
      setBatchError('Bitte geben Sie eine URL ein.');
      return;
    }

    if (!isValidUrl(batchUrl)) {
      setBatchError('Bitte geben Sie eine gültige URL ein.');
      return;
    }

    try {
      setBatchImporting(true);
      setBatchError(null);
      setSessionLinks([]);

      console.log('[SessionImportModal] Extrahiere Session-Liste von URL:', batchUrl);
      
      // Hier verwenden wir ein spezielles Template für Session-Listen
      const response = await importSessionFromUrl(batchUrl, {
        sourceLanguage: batchSourceLanguage,
        targetLanguage: batchTargetLanguage,
        template: 'ExtractSessionListFromWebsite', // Neues Template für Listen
        useCache: false
      });

      console.log('[SessionImportModal] Session-Liste extrahiert:', response);

      if (response.status === 'success' && response.data && response.data.structured_data) {
        // Erwarte ein Array von Sessions oder ein Objekt mit sessions-Array
        const data = response.data.structured_data as unknown; // Flexiblere Typisierung für Batch-Import
        let sessions: SessionLink[] = [];
        
        // Type Guards für sicheren Zugriff auf unknown
        const isDataObject = (obj: unknown): obj is Record<string, unknown> => 
          typeof obj === 'object' && obj !== null && !Array.isArray(obj);
        
        const isSessionItem = (item: unknown): item is Record<string, unknown> => 
          typeof item === 'object' && item !== null;
        
        // Event und andere globale Daten speichern
        const globalEvent = isDataObject(data) && typeof data.event === 'string' ? data.event : '';
        
        if (Array.isArray(data)) {
          sessions = data.map((item: unknown) => {
            if (!isSessionItem(item)) {
              return {
                name: 'Unbenannte Session',
                url: '',
                status: 'pending' as const,
                track: ''
              };
            }
            return {
              name: (typeof item.name === 'string' ? item.name : 
                     typeof item.session === 'string' ? item.session : 
                     typeof item.title === 'string' ? item.title : 
                     'Unbenannte Session'),
              url: (typeof item.url === 'string' ? item.url : 
                    typeof item.link === 'string' ? item.link : ''),
              status: 'pending' as const,
              // Track aus dem Item speichern
              track: typeof item.track === 'string' ? item.track : ''
            };
          });
        } else if (isDataObject(data) && Array.isArray(data.sessions)) {
          sessions = data.sessions.map((item: unknown) => {
            if (!isSessionItem(item)) {
              return {
                name: 'Unbenannte Session',
                url: '',
                status: 'pending' as const,
                track: ''
              };
            }
            return {
              name: (typeof item.name === 'string' ? item.name : 
                     typeof item.session === 'string' ? item.session : 
                     typeof item.title === 'string' ? item.title : 
                     'Unbenannte Session'),
              url: (typeof item.url === 'string' ? item.url : 
                    typeof item.link === 'string' ? item.link : ''),
              status: 'pending' as const,
              // Track aus dem Item speichern
              track: typeof item.track === 'string' ? item.track : ''
            };
          });
        }
        
        if (sessions.length > 0) {
          setSessionLinks(sessions);
          // Globales Event speichern für späteren Gebrauch
          setBatchEvent(globalEvent);
        } else {
          throw new Error('Keine Session-Links gefunden');
        }
      } else {
        throw new Error('Keine Session-Liste erhalten');
      }
    } catch (error) {
      console.error('[SessionImportModal] Fehler beim Extrahieren der Session-Liste:', error);
      
      if (error instanceof SecretaryServiceError) {
        setBatchError(error.message);
      } else {
        setBatchError('Fehler beim Extrahieren der Session-Liste. Stellen Sie sicher, dass die URL eine Liste von Sessions enthält.');
      }
    } finally {
      setBatchImporting(false);
    }
  };

  // Batch: Alle Sessions importieren
  const handleBatchImport = async () => {
    if (sessionLinks.length === 0) return;

    setIsImportingBatch(true);
    setImportProgress(0);
    setShouldCancelBatch(false);

    let successCount = 0;
    let errorCount = 0;
    let processedCount = 0;

    for (let i = 0; i < sessionLinks.length; i++) {
      // Prüfen ob abgebrochen werden soll
      if (shouldCancelBatch) {
        console.log('[SessionImportModal] Batch-Import wurde abgebrochen');
        break;
      }
      
      processedCount = i;
      
      const sessionLink = sessionLinks[i];
      
      // Status auf 'importing' setzen
      setSessionLinks(prev => prev.map((link, idx) => 
        idx === i ? { ...link, status: 'importing' as const } : link
      ));

      try {
        // Session-Daten extrahieren
        const response = await importSessionFromUrl(sessionLink.url, {
          sourceLanguage: batchSourceLanguage,
          targetLanguage: batchTargetLanguage,
          template: 'ExtractSessionDataFromWebsite',
          useCache: false
        });

        if (response.status === 'success' && response.data && response.data.structured_data) {
          const structuredData = response.data.structured_data;
          
          // Session erstellen
          // Event und Track aus der Batch-Liste haben Vorrang
          const sessionData = {
            event: batchEvent || structuredData.event || '',
            session: structuredData.session || sessionLink.name,
            subtitle: structuredData.subtitle || '',
            description: structuredData.description || '',
            filename: structuredData.filename || '',
            track: sessionLink.track || structuredData.track || '', // Track aus der Liste hat Vorrang
            video_url: structuredData.video_url || '',
            attachments_url: structuredData.attachments_url || '',
            url: structuredData.url || sessionLink.url,
            day: structuredData.day || '',
            starttime: structuredData.starttime || '',
            endtime: structuredData.endtime || '',
            speakers: Array.isArray(structuredData.speakers) ? structuredData.speakers : [structuredData.speakers || ''],
            source_language: structuredData.language || batchSourceLanguage,
            target_language: structuredData.language || batchTargetLanguage
          };

          const createResponse = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessions: [sessionData]
            })
          });

          const createData = await createResponse.json();

          if (createData.status === 'success') {
            successCount++;
            setSessionLinks(prev => prev.map((link, idx) => 
              idx === i ? { ...link, status: 'success' as const } : link
            ));
          } else {
            throw new Error(createData.message || 'Fehler beim Erstellen der Session');
          }
        } else {
          throw new Error('Keine Session-Daten erhalten');
        }
      } catch (error) {
        errorCount++;
        console.error(`[SessionImportModal] Fehler beim Import von ${sessionLink.name}:`, error);
        
        setSessionLinks(prev => prev.map((link, idx) => 
          idx === i ? { 
            ...link, 
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unbekannter Fehler'
          } : link
        ));
      }

      // Progress aktualisieren
      setImportProgress(((i + 1) / sessionLinks.length) * 100);
      processedCount = i + 1;
      
      // Kleine Pause zwischen Requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsImportingBatch(false);

    // Zusammenfassung anzeigen
    if (shouldCancelBatch) {
      const remaining = sessionLinks.length - processedCount;
      setBatchError(`Import abgebrochen: ${successCount} erfolgreich, ${errorCount} fehlgeschlagen, ${remaining} übersprungen`);
    } else if (successCount > 0 && errorCount === 0) {
      setBatchError(null);
      // Nach kurzer Verzögerung Modal schließen und Seite neu laden
      setTimeout(() => {
        handleClose();
        window.location.reload();
      }, 2000);
    } else if (errorCount > 0) {
      setBatchError(`Import abgeschlossen: ${successCount} erfolgreich, ${errorCount} fehlgeschlagen`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Session importieren
          </DialogTitle>
          <DialogDescription>
            Importieren Sie Sessions einzeln oder als Batch von einer Website.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              Einzelne Session
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <FileStack className="w-4 h-4" />
              Batch-Import
            </TabsTrigger>
          </TabsList>

          {/* Single Import Tab */}
          <TabsContent value="single" className="flex-1 overflow-y-auto space-y-6 mt-6">
            {/* URL-Eingabe */}
            <div className="space-y-2">
              <Label htmlFor="url">Session-URL *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/session-page"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={importing}
                className="w-full"
              />
              <p className="text-sm text-gray-600">
                URL der Seite mit den Session-Informationen
              </p>
            </div>

            {/* Fehler-Anzeige */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Erfolg-Anzeige */}
            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Extrahierte Daten-Vorschau */}
            {importedData && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-medium mb-3 text-gray-900">Extrahierte Session-Daten:</h4>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-gray-700">Event:</span>
                    <span className="col-span-2 text-gray-900">{importedData.event || 'Nicht verfügbar'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-gray-700">Session:</span>
                    <span className="col-span-2 text-gray-900">{importedData.session || 'Nicht verfügbar'}</span>
                  </div>
                  {importedData.subtitle && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="font-medium text-gray-700">Untertitel:</span>
                      <span className="col-span-2 text-gray-900">{importedData.subtitle}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-gray-700">Track:</span>
                    <span className="col-span-2 text-gray-900">{importedData.track || 'Nicht verfügbar'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-gray-700">Tag:</span>
                    <span className="col-span-2 text-gray-900">{importedData.day || 'Nicht verfügbar'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-gray-700">Zeit:</span>
                    <span className="col-span-2 text-gray-900">
                      {importedData.starttime || 'Nicht verfügbar'} - {importedData.endtime || 'Nicht verfügbar'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="font-medium text-gray-700">Referenten:</span>
                    <span className="col-span-2 text-gray-900">
                      {Array.isArray(importedData.speakers) ? importedData.speakers.join(', ') : importedData.speakers || 'Nicht verfügbar'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Single Import Actions */}
            <div className="flex justify-end gap-2 pt-4">
              {!importedData ? (
                <Button 
                  onClick={handleImport} 
                  disabled={importing || !url.trim() || !isValidUrl(url)}
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Extrahiere...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Daten extrahieren
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={handleCreateSession} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Erstelle...
                    </>
                  ) : (
                    'Session erstellen'
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Batch Import Tab */}
          <TabsContent value="batch" className="flex-1 flex flex-col mt-6">
            <div className="space-y-6 flex-1 flex flex-col">
              {/* URL-Eingabe für Session-Liste */}
              <div className="space-y-2">
                <Label htmlFor="batchUrl">URL der Session-Liste *</Label>
                <Input
                  id="batchUrl"
                  type="url"
                  placeholder="https://example.com/sessions-overview"
                  value={batchUrl}
                  onChange={(e) => setBatchUrl(e.target.value)}
                  disabled={batchImporting || isImportingBatch}
                  className="w-full"
                />
                <p className="text-sm text-gray-600">
                  URL einer Seite, die Links zu mehreren Sessions enthält
                </p>
              </div>

              {/* Batch Fehler-Anzeige */}
              {batchError && (
                <Alert variant={batchError.includes('abgeschlossen') ? 'default' : 'destructive'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{batchError}</AlertDescription>
                </Alert>
              )}

              {/* Session-Liste - Wenn keine Sessions, Button anzeigen */}
              {sessionLinks.length === 0 ? (
                <div className="flex justify-end">
                  <Button 
                    onClick={handleExtractSessionList} 
                    disabled={batchImporting || !batchUrl.trim() || !isValidUrl(batchUrl)}
                  >
                    {batchImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Lade Session-Liste...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Session-Liste laden
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* Session-Liste mit Buttons */
                <div className="flex-1 flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">Gefundene Sessions ({sessionLinks.length})</h4>
                      {batchEvent && (
                        <p className="text-sm text-gray-600">Event: {batchEvent}</p>
                      )}
                    </div>
                    {isImportingBatch && (
                      <span className="text-sm text-gray-600">
                        {Math.round(importProgress)}% abgeschlossen
                      </span>
                    )}
                  </div>
                  
                  {isImportingBatch && (
                    <Progress value={importProgress} />
                  )}

                  <ScrollArea className="h-[300px] border rounded-lg">
                    <div className="px-4 pb-4 space-y-2">
                      {sessionLinks.map((link, index) => (
                        <div key={index} className="flex items-start justify-between px-3 pb-3 rounded hover:bg-gray-50 border-b last:border-b-0">
                          <div className="flex-1 min-w-0 space-y-1">
                            {link.track && (
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{link.track}</p>
                            )}
                            <p className="font-medium text-sm leading-tight">{link.name}</p>
                            <p className="text-xs text-gray-500 truncate">{link.url}</p>
                            {link.error && (
                              <p className="text-xs text-red-600 mt-1">{link.error}</p>
                            )}
                          </div>
                          <div className="ml-4 flex-shrink-0 pt-1">
                            {link.status === 'pending' && (
                              <span className="text-xs text-gray-500">Ausstehend</span>
                            )}
                            {link.status === 'importing' && (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            )}
                            {link.status === 'success' && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                            {link.status === 'error' && (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Batch Import Actions - Immer sichtbar */}
                  <div className="flex justify-end gap-2">
                    {isImportingBatch ? (
                      <>
                        <Button
                          variant="destructive"
                          onClick={() => setShouldCancelBatch(true)}
                        >
                          Import abbrechen
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSessionLinks([]);
                            setBatchEvent('');
                          }}
                        >
                          Zurücksetzen
                        </Button>
                        <Button 
                          onClick={handleBatchImport}
                        >
                          {`${sessionLinks.length} Sessions importieren`}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose} disabled={importing || batchImporting || isImportingBatch}>
            {isImportingBatch ? 'Schließen nach Abschluss' : 'Abbrechen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 