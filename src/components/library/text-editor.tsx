'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StorageProvider } from '@/lib/storage/types';
import { toast } from 'sonner';
import { FileLogger } from "@/lib/debug/logger"

interface TextEditorProps {
  content: string;
  provider: StorageProvider | null;
  onSaveAction: (content: string) => Promise<void>;
}

export function TextEditor({ content, provider, onSaveAction }: TextEditorProps) {
  const [value, setValue] = useState(content);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSave = useCallback(async () => {
    FileLogger.info('TextEditor', 'Speichern gestartet', {
      contentLength: value.length,
      hasProvider: !!provider
    });
    
    if (!provider) {
      FileLogger.warn('TextEditor', 'Kein Storage Provider verfügbar');
      toast.error("Fehler", { 
        description: "Kein Storage Provider verfügbar",
        duration: 7000
      });
      return;
    }
    
    setIsLoading(true);
    try {
      FileLogger.debug('TextEditor', 'Rufe onSaveAction auf', {
        contentLength: value.length
      });
      
      await onSaveAction(value);
      
      FileLogger.info('TextEditor', 'Speichern erfolgreich abgeschlossen');
      toast.success("Gespeichert", { 
        description: "Die Datei wurde erfolgreich gespeichert",
        duration: 7000
      });
    } catch (error) {
      FileLogger.error('TextEditor', 'Fehler beim Speichern der Datei', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
      toast.error("Fehler", {
        description: `Die Datei konnte nicht gespeichert werden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    } finally {
      setIsLoading(false);
    }
  }, [value, provider, onSaveAction]);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 pb-2 min-h-0">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-full w-full font-mono resize-none"
          disabled={isLoading}
        />
      </div>
      <div className="flex justify-end p-4 pt-2">
        <Button 
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? "Wird gespeichert..." : "Speichern"}
        </Button>
      </div>
    </div>
  );
} 