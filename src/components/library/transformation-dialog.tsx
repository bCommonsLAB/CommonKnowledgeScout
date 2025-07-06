"use client";

import { useAtom } from 'jotai';
import { useState, useCallback, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, FileText, File } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  baseTransformOptionsAtom,
  BaseTransformOptions
} from '@/atoms/transcription-options';
import { BatchTransformService, BatchTransformProgress, BatchTransformResult } from '@/lib/transform/batch-transform-service';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';
import { SUPPORTED_LANGUAGES } from '@/lib/secretary/constants';
import { StorageItem } from '@/lib/storage/types';

interface ProgressState {
  isProcessing: boolean;
  currentProgress: BatchTransformProgress | null;
  results: BatchTransformResult | null;
}

interface TransformationDialogProps {
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function TransformationDialog({ onRefreshFolder }: TransformationDialogProps) {
  const [isOpen, setIsOpen] = useAtom(transformationDialogOpenAtom);
  const [selectedItems] = useAtom(selectedTransformationItemsAtom);
  const [progressState, setProgressState] = useState<ProgressState>({
    isProcessing: false,
    currentProgress: null,
    results: null
  });
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Besprechung');
  const [customTemplateNames, setCustomTemplateNames] = useState<string[]>([]);
  const [customFileName, setCustomFileName] = useState<string>('');
  const [fileNameError, setFileNameError] = useState<string>('');
  
  const { provider, refreshItems, listItems } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const baseOptions = useAtomValue(baseTransformOptionsAtom);
  
  // Initialisiere selectedLanguage mit dem Standard-Wert
  const [selectedLanguage, setSelectedLanguage] = useState<string>(baseOptions.targetLanguage);

  // Verwende konsistente Sprachauswahl aus den Constants
  const availableLanguages = SUPPORTED_LANGUAGES;

  // Standard-Templates definieren
  const standardTemplates = [
    { name: "Besprechung", isStandard: true },
    { name: "Gedanken", isStandard: true },
    { name: "Interview", isStandard: true },
    { name: "Zusammenfassung", isStandard: true }
  ];

  // Templates laden wenn Provider und Library bereit sind
  useEffect(() => {
    async function loadTemplatesIfNeeded() {
      if (!provider || !activeLibraryId) {
        return;
      }

      try {
        // Templates-Ordner finden oder erstellen
        const rootItems = await listItems('root');
        let templatesFolder = rootItems.find(item => 
          item.type === 'folder' && item.metadata.name === 'templates'
        );
        
        if (!templatesFolder) {
          // Templates-Ordner erstellen
          templatesFolder = await provider.createFolder('root', 'templates');
        }

        // Template-Dateien laden
        const templateItems = await listItems(templatesFolder.id);
        const templateFiles = templateItems.filter(item => 
          item.type === 'file' && item.metadata.name.endsWith('.md')
        );

        // Nur Template-Namen extrahieren
        const templateNames = templateFiles.map(file => 
          file.metadata.name.replace('.md', '')
        );

        setCustomTemplateNames(templateNames);
      } catch (error) {
        console.error('Fehler beim Laden der Templates:', error);
        // Bei Fehler leere Template-Liste setzen
        setCustomTemplateNames([]);
      }
    }

    loadTemplatesIfNeeded();
  }, [provider, activeLibraryId, listItems]);

  // Generiere Standard-Dateinamen basierend auf ausgewählten Dateien
  useEffect(() => {
    if (selectedItems.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const languageName = availableLanguages.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage;
      
      // Erstelle einen aussagekräftigeren Namen basierend auf den ausgewählten Dateien
      let defaultName = '';
      
      if (selectedItems.length === 1) {
        // Bei einer Datei: Verwende den ursprünglichen Namen + Transformation + Sprache
        const originalName = selectedItems[0].item.metadata.name;
        const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
        defaultName = `${nameWithoutExt}_Transformiert_${languageName}_${timestamp}`;
      } else {
        // Bei mehreren Dateien: Verwende die ersten beiden Namen + Anzahl + Sprache
        const firstNames = selectedItems.slice(0, 2).map(item => 
          item.item.metadata.name.split('.').slice(0, -1).join('.')
        );
        defaultName = `${firstNames.join('_')}_und_${selectedItems.length - 2}_weitere_${languageName}_${timestamp}`;
      }
      
      setCustomFileName(defaultName);
      // Validiere den generierten Namen
      setFileNameError(validateFileName(defaultName));
    }
  }, [selectedItems, selectedLanguage]);

  // Validierung des Dateinamens
  const validateFileName = (fileName: string): string => {
    if (!fileName.trim()) {
      return 'Dateiname ist erforderlich';
    }
    
    // Prüfe auf ungültige Zeichen
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(fileName)) {
      return 'Dateiname enthält ungültige Zeichen (< > : " / \\ | ? *)';
    }
    
    // Prüfe auf zu lange Namen
    if (fileName.length > 100) {
      return 'Dateiname ist zu lang (max. 100 Zeichen)';
    }
    
    // Prüfe auf reservierte Namen
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(fileName.toUpperCase())) {
      return 'Dateiname ist reserviert';
    }
    
    return '';
  };

  // Validierung bei Änderung des Dateinamens
  const handleFileNameChange = (value: string) => {
    setCustomFileName(value);
    const error = validateFileName(value);
    setFileNameError(error);
  };

  // Handler für die Batch-Text-Transformation
  const handleStartBatchTransformation = useCallback(async () => {
    if (!provider || !activeLibraryId || selectedItems.length === 0) {
      toast.error("Fehler", {
        description: "Storage Provider oder Bibliothek nicht verfügbar"
      });
      return;
    }

    setProgressState({
      isProcessing: true,
      currentProgress: null,
      results: null
    });

    try {
      // Progress-Callback für Fortschrittsanzeige
      const onProgress = (progress: BatchTransformProgress) => {
        setProgressState(prev => ({
          ...prev,
          currentProgress: progress
        }));
      };

      // Batch-Text-Transformation starten
      const results = await BatchTransformService.transformTextBatch(
        selectedItems,
        {
          ...baseOptions,
          targetLanguage: selectedLanguage,
          fileName: customFileName.trim() || `Kombinierte_Transformation_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`
        },
        selectedTemplate,
        provider,
        refreshItems,
        activeLibraryId,
        onProgress
      );

      setProgressState(prev => ({
        ...prev,
        isProcessing: false,
        results
      }));

      // Erfolgs-/Fehlermeldung anzeigen
      if (results.success) {
        const successCount = results.results.filter(r => r.success).length;
        toast.success("Batch-Text-Transformation abgeschlossen", {
          description: `${successCount} von ${selectedItems.length} Dateien erfolgreich verarbeitet. Eine kombinierte Datei wurde erstellt.`
        });
        
        // Fileliste automatisch aktualisieren
        if (selectedItems.length > 0) {
          const parentId = selectedItems[0].item.parentId;
          if (parentId) {
            try {
              const updatedItems = await refreshItems(parentId);
              console.log('TransformationDialog: Fileliste aktualisiert', {
                parentId,
                itemCount: updatedItems.length
              });
              
              // Informiere die übergeordnete Komponente über die Aktualisierung
              if (onRefreshFolder) {
                onRefreshFolder(parentId, updatedItems);
              }
            } catch (error) {
              console.error('TransformationDialog: Fehler beim Aktualisieren der Fileliste', error);
            }
          }
        }
      } else {
        const errorCount = results.results.filter(r => !r.success).length;
        toast.error("Batch-Text-Transformation mit Fehlern abgeschlossen", {
          description: `${errorCount} von ${selectedItems.length} Dateien konnten nicht verarbeitet werden.`
        });
      }

    } catch (error) {
      console.error('Batch text transformation error:', error);
      setProgressState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast.error("Fehler", {
        description: `Batch-Text-Transformation fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, activeLibraryId, selectedItems, baseOptions, selectedTemplate, refreshItems, customFileName, selectedLanguage]);

  // Dialog schließen und State zurücksetzen
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setProgressState({
      isProcessing: false,
      currentProgress: null,
      results: null
    });
  }, [setIsOpen]);

  // Fortschrittsanzeige berechnen
  const progressPercentage = progressState.currentProgress 
    ? (progressState.currentProgress.currentItem / progressState.currentProgress.totalItems) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch-Text-Transformation</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          {/* Ausgewählte Dateien */}
          <div>
            <h4 className="mb-4 text-sm font-medium">
              Ausgewählte Dateien ({selectedItems.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedItems.map(({ item, type }) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  {type === 'text' ? (
                    <FileText className="h-4 w-4 text-blue-500" />
                  ) : (
                    <File className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="truncate">{item.metadata.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {type}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Alle ausgewählten Texte werden zu einem kombinierten Dokument zusammengeführt und mit dem ausgewählten Template transformiert.
            </p>
          </div>

          {/* Template-Auswahl */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="template">Template für Transformation</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Template auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Benutzerdefinierte Templates zuerst */}
                    {customTemplateNames.length > 0 && (
                      <>
                        {customTemplateNames.map((templateName) => (
                          <SelectItem key={templateName} value={templateName}>
                            {templateName}
                          </SelectItem>
                        ))}
                        {/* Trenner zwischen benutzerdefinierten und Standard-Templates */}
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-t mt-1 pt-2">
                          Standard-Templates
                        </div>
                      </>
                    )}
                    
                    {/* Standard-Templates */}
                    {standardTemplates.map((standardTemplate) => (
                      <SelectItem key={standardTemplate.name} value={standardTemplate.name}>
                        {standardTemplate.name} <span className="text-muted-foreground">(Standard)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="language">Zielsprache</Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={setSelectedLanguage}
                  disabled={progressState.isProcessing}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Sprache auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="filename">Dateiname für kombinierte Datei</Label>
                <Input
                  id="filename"
                  value={customFileName}
                  onChange={(e) => handleFileNameChange(e.target.value)}
                  placeholder="Dateiname eingeben..."
                  disabled={progressState.isProcessing}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Der Dateiname wird automatisch mit der Endung .{baseOptions.fileExtension} gespeichert.
                </p>
                {fileNameError && (
                  <p className="text-xs text-red-500 mt-1">
                    {fileNameError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Fortschrittsanzeige */}
          {progressState.isProcessing && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Verarbeitung läuft...</h4>
              <Progress value={progressPercentage} className="w-full" />
              {progressState.currentProgress && (
                <div className="text-sm text-muted-foreground">
                  {progressState.currentProgress.currentFileName} ({progressState.currentProgress.currentItem}/{progressState.currentProgress.totalItems})
                </div>
              )}
            </div>
          )}

          {/* Ergebnisse */}
          {progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Ergebnisse</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {progressState.results.results.map((result) => (
                  <div key={result.item.id} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="truncate">{result.item.metadata.name}</span>
                    {!result.success && (
                      <span className="text-xs text-red-500 truncate">
                        {result.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {progressState.results.results.some(r => r.savedItem) && (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  ✓ Eine kombinierte Datei wurde erfolgreich erstellt und gespeichert.
                </div>
              )}
            </div>
          )}

          {/* Einstellungen */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Einstellungen</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Zielsprache:</span>
                  <div className="font-medium">
                    {availableLanguages.find(lang => lang.code === selectedLanguage)?.name}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Dateiendung:</span>
                  <div className="font-medium">.{baseOptions.fileExtension}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={progressState.isProcessing}
          >
            {progressState.results ? 'Schließen' : 'Abbrechen'}
          </Button>
          
          {!progressState.isProcessing && !progressState.results && (
            <Button 
              onClick={handleStartBatchTransformation}
              disabled={selectedItems.length === 0 || !!fileNameError}
            >
              Transformation starten ({selectedItems.length} Dateien kombinieren)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 