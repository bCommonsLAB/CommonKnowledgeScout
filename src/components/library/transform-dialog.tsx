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
  transformDialogOpenAtom,
  transformProcessingAtom,
  BatchItem,
  BaseTransformOptions,
  MediaType
} from '@/atoms/transform-options';
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
    case 'image':
      return <FileIcon className="h-4 w-4 text-green-500" />;
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

export function TransformDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useAtom(transformDialogOpenAtom);
  const [baseOptions, setBaseOptions] = useAtom(baseTransformOptionsAtom);
  const [selectedItems] = useAtom(selectedBatchItemsAtom);
  const [isProcessing, setIsProcessing] = useAtom(transformProcessingAtom);
  const [progress, setProgress] = useState<BatchTransformProgress | null>(null);
  
  const { provider, refreshItems } = useStorage();
  const activeLibrary = useAtomValue(activeLibraryAtom);

  // Gruppiere Items nach Typ für die Verarbeitung
  const itemsByType = useMemo(() => {
    return selectedItems.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {} as Record<MediaType, BatchItem[]>);
  }, [selectedItems]);

  // Prüfe ob erweiterte Optionen benötigt werden
  const needsAdvancedOptions = useMemo(() => {
    return selectedItems.some(item => 
      item.type === 'video' || item.type === 'audio'
    );
  }, [selectedItems]);

  const handleTransform = async () => {
    if (!provider || !activeLibrary) {
      toast.error("Fehler", {
        description: "Provider oder Bibliothek nicht verfügbar"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(null);

    try {
      const result = await BatchTransformService.transformBatch(
        selectedItems,
        baseOptions,
        provider,
        refreshItems,
        activeLibrary.id,
        (progress) => {
          setProgress(progress);
        }
      );

      if (result.success) {
        toast.success(
          selectedItems.length === 1 
            ? "Datei erfolgreich transformiert" 
            : `${selectedItems.length} Dateien erfolgreich transformiert`
        );
      } else {
        const errorCount = result.results.filter(r => !r.success).length;
        toast.warning("Transformation teilweise fehlgeschlagen", {
          description: `${errorCount} von ${selectedItems.length} Dateien konnten nicht transformiert werden.`
        });
      }

      setIsOpen(false);
    } catch (error) {
      toast.error("Fehler bei der Transformation", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler"
      });
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {selectedItems.length > 1 
              ? `${selectedItems.length} Dateien transformieren` 
              : "Datei transformieren"}
          </DialogTitle>
          <DialogDescription>
            Wählen Sie die grundlegenden Transformationsoptionen.
            {needsAdvancedOptions && " Erweiterte Optionen werden aus den Einstellungen übernommen."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <BaseOptionsForm 
            options={baseOptions} 
            onChange={setBaseOptions}
          />

          {needsAdvancedOptions && (
            <Alert>
              <AlertTitle>Hinweis</AlertTitle>
              <AlertDescription>
                Spezifische Optionen für Audio/Video werden aus den Einstellungen übernommen.
                <Button 
                  variant="link" 
                  className="px-0"
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/settings');
                  }}
                >
                  Einstellungen anpassen
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="border rounded p-2">
            <h4 className="text-sm font-medium mb-2">Ausgewählte Dateien:</h4>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {selectedItems.map(item => (
                <div key={item.item.id} className="text-sm flex items-center gap-2">
                  <MediaTypeIcon type={item.type} />
                  <span className="truncate">{item.item.metadata.name}</span>
                </div>
              ))}
            </div>
          </div>

          {progress && (
            <TransformProgress progress={progress} />
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={isProcessing}
          >
            Abbrechen
          </Button>
          <Button 
            onClick={handleTransform} 
            disabled={isProcessing}
          >
            {isProcessing 
              ? "Wird verarbeitet..." 
              : `${selectedItems.length} Datei(en) transformieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 