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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, CheckCircle, Globe, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { importSessionFromUrl, SecretaryServiceError } from '@/lib/secretary/client';
import { LANGUAGE_MAP } from '@/lib/secretary/constants';
import { TemplateExtractionResponse, StructuredSessionData } from '@/lib/secretary/types';

interface SessionImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionImported?: (sessionData: any) => void;
}

export default function SessionImportModal({ 
  open, 
  onOpenChange, 
  onSessionImported 
}: SessionImportModalProps) {
  const [url, setUrl] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<StructuredSessionData | null>(null);

  // Modal zurücksetzen
  const resetModal = () => {
    setUrl('');
    setSourceLanguage('en');
    setTargetLanguage('en');
    setImporting(false);
    setError(null);
    setSuccess(null);
    setImportedData(null);
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

  // Session-Import durchführen
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
        template: 'ExtractSessiondataFromWebsite',
        useCache: false
      });

      console.log('[SessionImportModal] Import erfolgreich:', response);

      if (response.status === 'success' && response.data && response.data.structured_data) {
        const structuredData = response.data.structured_data;
        setImportedData(structuredData);
        setSuccess('Session-Daten erfolgreich extrahiert!');
        
        // Session aus den extrahierten Daten erstellen
        try {
          const sessionData = {
            event: structuredData.event || '',
            title: structuredData.title || '',
            subtitle: structuredData.subtitle || '',
            description: structuredData.description || '',
            track: structuredData.track || '',
            day: structuredData.day || '',
            starttime: structuredData.starttime || '',
            endtime: structuredData.endtime || '',
            speakers: Array.isArray(structuredData.speakers) ? structuredData.speakers.join(', ') : structuredData.speakers || '',
            source_language: structuredData.language || sourceLanguage,
            video_url: structuredData.video_url || '',
            attachments_url: structuredData.attachments_url || '',
            url: structuredData.url || url,
            filename: structuredData.filename || ''
          };
          
          // Session über API erstellen
          const createResponse = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
          });
          
          if (createResponse.ok) {
            const createdSession = await createResponse.json();
            setSuccess(`Session "${sessionData.title}" erfolgreich erstellt!`);
            
            // Callback aufrufen falls vorhanden
            if (onSessionImported) {
              onSessionImported(createdSession);
            }
          } else {
            const errorData = await createResponse.json();
            throw new Error(`Fehler beim Erstellen der Session: ${errorData.error || 'Unbekannter Fehler'}`);
          }
        } catch (createError) {
          console.error('Fehler beim Erstellen der Session:', createError);
          setError(`Fehler beim Erstellen der Session: ${createError instanceof Error ? createError.message : 'Unbekannter Fehler'}`);
        }
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

  // Session erstellen
  const handleCreateSession = async () => {
    if (!importedData) return;

    try {
      setImporting(true);
      setError(null);

      // Session-Daten an API senden
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessions: [importedData]
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        setSuccess('Session erfolgreich erstellt!');
        
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Session aus Website importieren
          </DialogTitle>
          <DialogDescription>
            Geben Sie eine URL ein, um automatisch Session-Daten zu extrahieren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* URL-Eingabe */}
          <div className="space-y-2">
            <Label htmlFor="url">Website-URL *</Label>
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
              URL der Website, die Session-Informationen enthält
            </p>
          </div>

          {/* Sprach-Optionen */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sourceLanguage">Quellsprache</Label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage} disabled={importing}>
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
              <Label htmlFor="targetLanguage">Zielsprache</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={importing}>
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
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Extrahierte Daten:</h4>
              <div className="space-y-2 text-sm">
                <div><strong>Event:</strong> {importedData.event}</div>
                <div><strong>Titel:</strong> {importedData.title}</div>
                <div><strong>Untertitel:</strong> {importedData.subtitle}</div>
                <div><strong>Track:</strong> {importedData.track}</div>
                <div><strong>Tag:</strong> {importedData.day}</div>
                <div><strong>Zeit:</strong> {importedData.starttime} - {importedData.endtime}</div>
                <div><strong>Referenten:</strong> {Array.isArray(importedData.speakers) ? importedData.speakers.join(', ') : importedData.speakers}</div>
                <div><strong>Sprache:</strong> {importedData.language}</div>
                {importedData.description && (
                  <div><strong>Beschreibung:</strong> {importedData.description.substring(0, 200)}...</div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Abbrechen
          </Button>
          
          <div className="flex gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 