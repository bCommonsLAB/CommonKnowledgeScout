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
import { CheckCircle, XCircle, FileText, File, X } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  selectedTransformationItemsAtom,
  transformationDialogOpenAtom,
  baseTransformOptionsAtom
} from '@/atoms/transcription-options';
import { BatchTransformService, BatchTransformProgress, BatchTransformResult } from '@/lib/transform/batch-transform-service';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';
import { SUPPORTED_LANGUAGES } from '@/lib/secretary/constants';
import { StorageItem } from '@/lib/storage/types';
import { CombinedChatDialog } from '@/components/library/combined-chat-dialog'
import { templateContextDocsAtom } from '@/atoms/template-context-atom'
import { useSetAtom } from 'jotai'
import { useRouter } from 'next/navigation'

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
  const setTemplateContext = useSetAtom(templateContextDocsAtom)
  const router = useRouter()
  
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

  // Templates nur laden, wenn der Dialog geöffnet wird
  useEffect(() => {
    let cancelled = false;
    async function loadTemplatesIfNeeded() {
      if (!isOpen || !provider || !activeLibraryId) return;

      try {
        const rootItems = await listItems('root');
        let templatesFolder = rootItems.find(item => 
          item.type === 'folder' && item.metadata.name === 'templates'
        );
        
        if (!templatesFolder) {
          templatesFolder = await provider.createFolder('root', 'templates');
        }

        const templateItems = await listItems(templatesFolder.id);
        const templateFiles = templateItems.filter(item => 
          item.type === 'file' && item.metadata.name.endsWith('.md')
        );

        const templateNames = templateFiles.map(file => file.metadata.name.replace('.md', ''));
        if (!cancelled) setCustomTemplateNames(templateNames);
      } catch (error) {
        if (!cancelled) setCustomTemplateNames([]);
        console.error('Fehler beim Laden der Templates:', error);
      }
    }

    loadTemplatesIfNeeded();
    return () => { cancelled = true; };
  }, [isOpen, provider, activeLibraryId, listItems]);

  // Erzeuge effektive Eingabeliste: nur Markdown; PDFs → Shadow‑Twin (Markdown) im gleichen Ordner
  const [effectiveItems, setEffectiveItems] = useState<typeof selectedItems>([]);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [excludedItemIds, setExcludedItemIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function computeEffective() {
      try {
        if (!provider || selectedItems.length === 0) {
          if (!cancelled) { setEffectiveItems([]); setSkippedCount(0); }
          return;
        }
        const byParent = new Map<string, StorageItem[]>();
        const loadSiblings = async (parentId: string): Promise<StorageItem[]> => {
          if (byParent.has(parentId)) return byParent.get(parentId)!;
          const sibs = await listItems(parentId);
          byParent.set(parentId, sibs);
          return sibs;
        };
        const results: typeof selectedItems = [];
        let skipped = 0;
        for (const sel of selectedItems) {
          const it = sel.item;
          const name = it.metadata.name.toLowerCase();
          const isMarkdown = name.endsWith('.md') || (it.metadata.mimeType || '').toLowerCase() === 'text/markdown';
          if (isMarkdown) { results.push({ item: it, type: 'text' }); continue; }
          const isPdf = name.endsWith('.pdf') || (it.metadata.mimeType || '').toLowerCase() === 'application/pdf';
          if (!isPdf || !it.parentId) { skipped++; continue; }
          const siblings = await loadSiblings(it.parentId);
          const base = it.metadata.name.replace(/\.[^./]+$/,'');
          // Bevorzugt Sprache passend auswählen
          const preferred = `${base}.${selectedLanguage}.md`.toLowerCase();
          let twin = siblings.find(s => s.type === 'file' && s.metadata.name.toLowerCase() === preferred);
          if (!twin) {
            twin = siblings.find(s => s.type === 'file' && s.metadata.name.toLowerCase().startsWith(`${base.toLowerCase()}.`) && s.metadata.name.toLowerCase().endsWith('.md'));
          }
          if (twin) results.push({ item: twin, type: 'text' }); else skipped++;
        }
        // Anwender-entfernte IDs ausfiltern
        const filtered = results.filter(entry => !excludedItemIds.includes(entry.item.id));
        // Deduplizieren nach item.id
        const dedupMap = new Map<string, (typeof selectedItems)[number]>()
        for (const entry of filtered) dedupMap.set(entry.item.id, entry)
        const dedup = Array.from(dedupMap.values())
        if (!cancelled) { setEffectiveItems(dedup); setSkippedCount(skipped); }
      } catch {
        if (!cancelled) { setEffectiveItems([]); setSkippedCount(0); }
      }
    }
    void computeEffective();
    return () => { cancelled = true; };
  }, [provider, listItems, selectedItems, selectedLanguage, excludedItemIds]);

  const handleRemoveEffectiveItem = (id: string) => {
    setEffectiveItems(prev => prev.filter(entry => entry.item.id !== id));
    setExcludedItemIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Generiere Standard-Dateinamen basierend auf effektiven Dateien
  useEffect(() => {
    if (effectiveItems.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const languageName = availableLanguages.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage;
      
      // Erstelle einen aussagekräftigeren Namen basierend auf den ausgewählten Dateien
      let defaultName = '';
      
      if (effectiveItems.length === 1) {
        // Bei einer Datei: Verwende den ursprünglichen Namen + Transformation + Sprache
        const originalName = effectiveItems[0].item.metadata.name;
        const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
        defaultName = `${nameWithoutExt}_Transformiert_${languageName}_${timestamp}`;
      } else {
        // Bei mehreren Dateien: Verwende die ersten beiden Namen + Anzahl + Sprache
        const firstNames = effectiveItems.slice(0, 2).map(item => 
          item.item.metadata.name.split('.').slice(0, -1).join('.')
        );
        defaultName = `${firstNames.join('_')}_und_${effectiveItems.length - 2}_weitere_${languageName}_${timestamp}`;
      }
      
      setCustomFileName(defaultName);
      // Validiere den generierten Namen
      setFileNameError(validateFileName(defaultName));
    }
  }, [effectiveItems, selectedLanguage]);

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
        effectiveItems,
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
        toast.success("Kombinierte Transformation abgeschlossen", {
          description: `${successCount} von ${effectiveItems.length} Dateien erfolgreich verarbeitet. Eine kombinierte Datei wurde erstellt.`
        });
        
        // Fileliste automatisch aktualisieren
        if (effectiveItems.length > 0) {
          const parentId = effectiveItems[0].item.parentId;
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
        toast.error("Kombinierte Transformation mit Fehlern abgeschlossen", {
          description: `${errorCount} von ${effectiveItems.length} Dateien konnten nicht verarbeitet werden.`
        });
      }

    } catch (error) {
      console.error('Combined text transformation error:', error);
      setProgressState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast.error("Fehler", {
        description: `Kombinierte Transformation fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, activeLibraryId, effectiveItems, baseOptions, selectedTemplate, refreshItems, customFileName, selectedLanguage]);

  // Dialog schließen und State zurücksetzen
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setProgressState({
      isProcessing: false,
      currentProgress: null,
      results: null
    });
    setExcludedItemIds([]);
  }, [setIsOpen]);

  // Fortschrittsanzeige berechnen
  const progressPercentage = progressState.currentProgress 
    ? (progressState.currentProgress.currentItem / progressState.currentProgress.totalItems) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mehrere Dateien zu einem Dokument transformieren</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          {/* Ausgewählte Dateien */}
          <div>
            <h4 className="mb-1 text-sm font-medium">
              Eingabedateien ({effectiveItems.length})
            </h4>
            {skippedCount > 0 && (
              <p className="text-xs text-amber-600 mb-2">{skippedCount} Elemente wurden übersprungen (keine Markdown-Quelle gefunden).</p>
            )}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {effectiveItems.map(({ item, type }) => (
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
                  <button
                    type="button"
                    className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                    title="Aus Liste entfernen"
                    aria-label="Aus Liste entfernen"
                    onClick={() => handleRemoveEffectiveItem(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Die ausgewählten Texte werden zu einem einzigen Dokument kombiniert und anschließend mit dem gewählten Template verarbeitet.
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
              disabled={effectiveItems.length === 0 || !!fileNameError}
              className="min-w-[280px]"
            >
              Kombinierte Transformation starten
            </Button>
          )}
          {!progressState.isProcessing && !progressState.results && (
            <Button 
              variant="secondary"
              onClick={() => {
                const docs = effectiveItems.map(e => ({ id: e.item.id, name: e.item.metadata.name, parentId: e.item.parentId }))
                setTemplateContext(docs)
                router.push('/templates')
              }}
              disabled={effectiveItems.length === 0}
            >
              Im Template‑Editor testen
            </Button>
          )}
        </div>
      </DialogContent>
      {/* Modal für Prompt-Design*/}
      {!progressState.isProcessing && !progressState.results && (
        <CombinedChatDialog 
          provider={provider}
          items={effectiveItems.map(e => e.item)}
          selectedTemplate={selectedTemplate}
          selectedLanguage={selectedLanguage}
          defaultFileName={customFileName}
        />
      )}
    </Dialog>
  );
} 