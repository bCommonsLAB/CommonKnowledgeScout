'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StorageProvider } from '@/lib/storage/types';
import { toast } from 'sonner';

interface TextEditorProps {
  content: string;
  provider: StorageProvider | null;
  onSaveAction: (content: string) => Promise<void>;
}

export function TextEditor({ content, provider, onSaveAction }: TextEditorProps) {
  const [value, setValue] = useState(content);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSave = useCallback(async () => {
    if (!provider) {
      toast.error("Fehler", { 
        description: "Kein Storage Provider verfügbar",
        duration: 7000
      });
      return;
    }
    
    setIsLoading(true);
    try {
      await onSaveAction(value);
      toast.success("Gespeichert", { 
        description: "Die Datei wurde erfolgreich gespeichert",
        duration: 7000
      });
    } catch (error) {
      console.error("Fehler beim Speichern der Datei:", error);
      toast.error("Fehler", { 
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
        duration: 7000
      });
    } finally {
      setIsLoading(false);
    }
  }, [value, provider, onSaveAction]);
  
  return (
    <div className="flex flex-col gap-4 p-4">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[400px] font-mono resize-none"
        disabled={isLoading}
      />
      <div className="flex justify-end">
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