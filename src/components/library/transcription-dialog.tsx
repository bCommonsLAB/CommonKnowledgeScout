"use client";

import { useState, useMemo } from "react";
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { FileIcon } from "lucide-react";
import { toast } from "sonner";

import {
  baseTransformOptionsAtom,
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  transformProcessingAtom,
  BatchTranscriptionItem,
  BaseTransformOptions,
  MediaType
} from '@/atoms/transcription-options';
import { BatchTransformService, BatchTransformProgress } from '@/lib/transform/batch-transform-service';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { activeLibraryAtom } from '@/atoms/library-atom';

interface BaseOptionsFormProps {
  options: BaseTransformOptions;
  onChange: (options: BaseTransformOptions) => void;
}

// Formular für die Basis-Optionen
function BaseOptionsForm({ options, onChange }: BaseOptionsFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="targetLanguage">Zielsprache</Label>
        <Select
          value={options.targetLanguage}
          onValueChange={(value) => onChange({ ...options, targetLanguage: value })}
        >
          <SelectTrigger id="targetLanguage">
            <SelectValue placeholder="Zielsprache auswählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="en">Englisch</SelectItem>
            <SelectItem value="fr">Französisch</SelectItem>
            <SelectItem value="es">Spanisch</SelectItem>
            <SelectItem value="it">Italienisch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="createShadowTwin"
          checked={options.createShadowTwin}
          onCheckedChange={(checked) => 
            onChange({ ...options, createShadowTwin: checked === true })
          }
        />
        <Label htmlFor="createShadowTwin">Shadow-Twin erstellen</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fileExtension">Dateiendung</Label>
        <Select
          value={options.fileExtension}
          onValueChange={(value) => onChange({ ...options, fileExtension: value })}
        >
          <SelectTrigger id="fileExtension">
            <SelectValue placeholder="Dateiendung auswählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="md">Markdown (.md)</SelectItem>
            <SelectItem value="txt">Text (.txt)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Icon-Komponente für verschiedene Medientypen
function MediaTypeIcon({ type }: { type: MediaType }) {
  switch (type) {
    case 'audio':
      return <FileIcon className="h-4 w-4 text-blue-500" />;
    case 'video':
      return <FileIcon className="h-4 w-4 text-purple-500" />;
    default:
      return <FileIcon className="h-4 w-4" />;
  }
}

// Progress-Komponente
function TransformProgress({ progress }: { progress: BatchTransformProgress }) {
  const percentage = (progress.currentItem / progress.totalItems) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{progress.currentFileName}</span>
        <span>{progress.currentItem} von {progress.totalItems}</span>
      </div>
      <Progress value={percentage} className="h-2" />
      {progress.status === 'error' && (
        <p className="text-sm text-destructive mt-1">{progress.error}</p>
      )}
    </div>
  );
}

export function TranscriptionDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useAtom(transcriptionDialogOpenAtom);
  const [selectedItems] = useAtom(selectedBatchItemsAtom);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dateien transkribieren</DialogTitle>
        </DialogHeader>
        <div className="py-6">
          <h4 className="mb-4 text-sm font-medium">Ausgewählte Dateien ({selectedItems.length})</h4>
          <div className="space-y-4">
            {selectedItems.map(({ item }) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm">{item.metadata.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => {
            // TODO: Implement batch transcription
            setIsOpen(false);
          }}>
            Transkription starten
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 