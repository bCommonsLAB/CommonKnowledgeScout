'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StorageItem } from '@/lib/storage/types';
import { transformAudio } from '@/lib/secretary/client';
import { saveShadowTwin } from '@/lib/storage/shadow-twin';
import { StorageService } from '@/lib/storage/storage-service';
import { toast } from 'sonner';

interface AudioTransformProps {
  item: StorageItem;
  onTransformComplete?: (text: string) => void;
}

const LANGUAGES = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'Englisch' },
];

export function AudioTransform({ item, onTransformComplete }: AudioTransformProps) {
  const [isTransforming, setIsTransforming] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('de');

  const handleTransform = async () => {
    try {
      setIsTransforming(true);

      // Datei vom Server laden
      const response = await fetch(`/api/storage/filesystem?action=binary&fileId=${item.id}`);
      const blob = await response.blob();
      const file = new File([blob], item.metadata.name, { type: item.metadata.mimeType });

      // Transformation durchführen
      const result = await transformAudio({
        file,
        target_language: targetLanguage,
      });

      // Shadow-Twin speichern
      const storageProvider = StorageService.getInstance().getProvider('filesystem');
      await saveShadowTwin(
        item,
        { output_text: result.output_text },
        targetLanguage,
        storageProvider
      );

      onTransformComplete?.(result.output_text);
      toast.success('Audio-Datei wurde erfolgreich transkribiert und als Shadow-Twin gespeichert');
    } catch (error) {
      console.error('Fehler bei der Audio-Transkription:', error);
      toast.error('Fehler bei der Transkription der Audio-Datei');
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Zielsprache</label>
        <Select value={targetLanguage} onValueChange={setTargetLanguage}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((language) => (
              <SelectItem key={language.value} value={language.value}>
                {language.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={handleTransform} 
        disabled={isTransforming}
        className="w-full"
      >
        {isTransforming ? 'Wird transkribiert...' : 'Audio transkribieren'}
      </Button>
    </div>
  );
} 