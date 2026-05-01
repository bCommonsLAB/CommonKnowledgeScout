'use client'

/**
 * markdown-preview/text-transform.tsx
 *
 * TextTransform-Komponente: Transformations-UI fuer Markdown-Inhalte
 * (Tab-View "Transformieren" innerhalb der MarkdownPreview).
 *
 * Aus `markdown-preview.tsx` ausgegliedert (Welle 3-II-b, Schritt 5/8).
 *
 * Zustaendigkeiten:
 * - Template-Auswahl (Built-in + Custom)
 * - Sprachen-Auswahl
 * - Aufruf des Secretary-Service zur Transformation
 * - Speichern via TransformService mit deterministischem Artifact-Naming
 *
 * Diese Komponente ist gross (~660 Zeilen), bleibt aber als ein Modul,
 * weil ihre interne Logik (Template-Resolution, source_file-Extraktion,
 * ArtifactKey-Konstruktion) eng verzahnt ist.
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { activeLibraryAtom, libraryStatusAtom } from '@/atoms/library-atom'
import { useStorage } from '@/contexts/storage-context'
import { StorageItem, StorageProvider } from '@/lib/storage/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Wand2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { FileLogger } from '@/lib/debug/logger'
import { TransformService, TransformSaveOptions, TransformResult } from '@/lib/transform/transform-service'
import { transformTextWithTemplate } from '@/lib/secretary/client'
import { TransformResultHandler } from '@/components/library/transform-result-handler'
import { SUPPORTED_LANGUAGES } from '@/lib/secretary/constants'
import { stripAllFrontmatter, parseFrontmatter } from '@/lib/markdown/frontmatter'
import { buildArtifactName, extractBaseName, parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

interface TextTransformProps {
  content: string;
  currentItem?: StorageItem | null;
  provider?: StorageProvider | null;
  onTransform: (transformedContent: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

/**
 * TextTransform component for transforming markdown content
 */
export const TextTransform = ({ content, currentItem, provider, onTransform, onRefreshFolder }: TextTransformProps) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [template, setTemplate] = React.useState("Besprechung");
  
  // Template-Management Integration
  const [customTemplateNames, setCustomTemplateNames] = React.useState<string[]>([]);
  const libraryStatus = useAtomValue(libraryStatusAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);
  
  // Text State mit entferntem Frontmatter initialisieren (strikt)
  const [text, setText] = React.useState(() => {
    return stripAllFrontmatter(content || '');
  });
  
  // Text aktualisieren, wenn sich der content ändert
  React.useEffect(() => {
    setText(stripAllFrontmatter(content || ''));
  }, [content]);
  
  // Debug-Logging für Text
  React.useEffect(() => {
    FileLogger.debug('TextTransform', 'Component mounted/updated', {
      itemId: currentItem?.id,
      itemName: currentItem?.metadata.name,
      hasText: !!text,
      textLength: text?.length || 0
    });
  }, [currentItem, text]);
  
  // Funktion zum Extrahieren der Frontmatter-Metadaten (strikt)
  const extractFrontmatter = React.useCallback((markdownContent: string): Record<string, unknown> => {
    return parseFrontmatter(markdownContent).meta;
  }, []);


  
  // Hilfsfunktion für den Dateinamen
  const getBaseFileName = React.useCallback((fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
  }, []);
  
  // Generiere Shadow-Twin Dateinamen mit zentraler Logik
  // WICHTIG: Verwendet IMMER die zentrale buildArtifactName Funktion, wenn currentItem vorhanden ist
  // WICHTIG: Verwendet IMMER den ursprünglichen Basisnamen (ohne Shadow-Twin-Suffixe)
  const generateTransformationFileName = React.useCallback((
    content: string, 
    template: string, 
    targetLanguage: string,
    currentFileName?: string,
    currentItem?: StorageItem | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    activeLibrary?: { id: string } | null
  ): string => {
    // IMMER zentrale Logik verwenden, wenn currentItem vorhanden ist
    if (currentItem) {
      try {
        // Bestimme den ursprünglichen Basisnamen:
        // PRIORITÄT 1: source_file aus Frontmatter (beste Quelle - enthält den originalen Dateinamen)
        // PRIORITÄT 2: Extrahiere Basisnamen aus currentItem (falls kein source_file vorhanden)
        let originalSourceFileName: string = currentItem.metadata.name;
        let sourceFromFrontmatter = false;
        
        // Versuche source_file aus Frontmatter zu extrahieren (PRIORITÄT 1)
        try {
          const metadata = extractFrontmatter(content);
          if (metadata.source_file && typeof metadata.source_file === 'string') {
            let sourceFile = metadata.source_file.trim();
            // Entferne Anführungszeichen am Anfang und Ende (falls vorhanden)
            sourceFile = sourceFile.replace(/^["']|["']$/g, '').trim();
            // Entferne Platzhalter, falls vorhanden (z.B. {{audiofile}})
            const cleanedSourceFile = sourceFile.replace(/\{\{.*?\}\}/g, '').trim();
            if (cleanedSourceFile && cleanedSourceFile.length > 0) {
              originalSourceFileName = cleanedSourceFile;
              sourceFromFrontmatter = true;
              FileLogger.debug('TextTransform', 'Verwende source_file aus Frontmatter', { 
                sourceFile: originalSourceFileName,
                originalSourceFile: metadata.source_file,
                currentFileName: currentItem.metadata.name
              });
            }
          }
        } catch (error) {
          FileLogger.debug('TextTransform', 'Konnte source_file nicht aus Frontmatter extrahieren', { error });
        }
        
        // PRIORITÄT 2: Wenn kein source_file im Frontmatter gefunden wurde,
        // extrahiere den ursprünglichen Basisnamen aus dem Dateinamen (falls Shadow-Twin)
        if (!sourceFromFrontmatter && originalSourceFileName === currentItem.metadata.name) {
          // Prüfe ob es ein Shadow-Twin ist (hat .md Extension und möglicherweise Suffixe)
          if (originalSourceFileName.endsWith('.md')) {
            const fileNameWithoutExt = originalSourceFileName.replace(/\.md$/, '');
            const extractedBase = extractBaseName(originalSourceFileName);
            
            FileLogger.debug('TextTransform', 'Prüfe Shadow-Twin Extraktion (Fallback)', {
              originalFileName: originalSourceFileName,
              fileNameWithoutExt,
              extractedBase,
              isDifferent: extractedBase !== fileNameWithoutExt
            });
            
            // Wenn extractBaseName den Basisnamen erfolgreich extrahiert hat (ohne Suffixe)
            // Beispiel: "Todo jänner.de.md" -> extractBaseName = "Todo jänner"
            if (extractedBase !== fileNameWithoutExt) {
              // Verwende den extrahierten Basisnamen
              // buildArtifactName verwendet path.parse().name, was die Extension entfernt
              // Also können wir einfach den Basisnamen + eine beliebige Extension verwenden
              originalSourceFileName = extractedBase + '.md';
              FileLogger.debug('TextTransform', 'Extrahierten Basisnamen aus Shadow-Twin', {
                original: currentItem.metadata.name,
                extractedBase,
                originalSourceFileName
              });
            }
          }
        }
        
        // Erstelle ArtifactKey für Transformation
        const artifactKey: ArtifactKey = {
          sourceId: currentItem.id, // Für UI-Vorschau reicht ID (beim Speichern wird Content-Hash verwendet)
          kind: 'transformation',
          targetLanguage,
          templateName: template,
        };
        
        // Nutze IMMER zentrale buildArtifactName Funktion mit dem ursprünglichen Dateinamen
        // WICHTIG: Entferne Anführungszeichen, falls vorhanden (path.parse würde sonst falsch parsen)
        const cleanSourceFileName = originalSourceFileName.replace(/^["']|["']$/g, '').trim();
        const artifactName = buildArtifactName(artifactKey, cleanSourceFileName);
        
        FileLogger.debug('TextTransform', 'Dateiname mit zentraler Logik generiert', {
          artifactKey,
          artifactName,
          originalSourceFileName,
          currentFileName: currentItem.metadata.name,
        });
        
        // Entferne .md Extension (wird später wieder hinzugefügt)
        return artifactName.replace(/\.md$/, '');
      } catch (error) {
        FileLogger.error('TextTransform', 'Fehler bei zentraler Logik', { error });
        // Fallback: Verwende aktuellen Dateinamen als Basis
        // Versuche auch hier parseArtifactName für robuste Extraktion
        let baseName: string;
        if (currentFileName) {
          try {
            const parsed = parseArtifactName(currentFileName);
            baseName = parsed.baseName || getBaseFileName(currentFileName);
          } catch {
            baseName = getBaseFileName(currentFileName);
          }
        } else {
          baseName = 'transformation';
        }
        // Fallback-Format: {baseName}.{template}.{targetLanguage}
        return `${baseName}.${template}.${targetLanguage}`;
      }
    }
    
    // Fallback: Nur wenn kein currentItem vorhanden ist (sollte eigentlich nicht passieren)
    // Versuche auch hier parseArtifactName für robuste Extraktion
    let baseName: string;
    if (currentFileName) {
      try {
        const parsed = parseArtifactName(currentFileName);
        baseName = parsed.baseName || getBaseFileName(currentFileName);
      } catch {
        baseName = getBaseFileName(currentFileName);
      }
    } else {
      baseName = 'transformation';
    }
    return `${baseName}.${template}.${targetLanguage}`;
  }, [getBaseFileName, extractFrontmatter]);
  
  // Initialisiere saveOptions mit korrektem Dateinamen
  // WICHTIG: content sollte beim ersten Render verfügbar sein (wird als Prop übergeben)
  const [saveOptions, setSaveOptions] = React.useState<TransformSaveOptions>(() => {
    const targetLang = "de";
    
    // Verwende content (sollte Frontmatter mit source_file enthalten)
    const fileName = generateTransformationFileName(
      content || '', // Fallback auf leeren String falls content noch nicht geladen
      template,
      targetLang,
      currentItem?.metadata.name,
      currentItem,
      activeLibrary
    );
    
    FileLogger.debug('TextTransform', 'Initialisiere saveOptions', {
      contentLength: content?.length || 0,
      hasContent: !!content,
      currentItemName: currentItem?.metadata.name,
      generatedFileName: fileName
    });
    
    return {
      targetLanguage: targetLang,
      fileName: fileName,
      createShadowTwin: true, // Immer true - Shadow-Twin ist Standard
      fileExtension: "md" // Immer .md für Shadow-Twins
    };
  });
  
  // Debug-Logging für saveOptions
  React.useEffect(() => {
    FileLogger.debug('TextTransform', 'saveOptions', {
      targetLanguage: saveOptions.targetLanguage,
      fileName: saveOptions.fileName,
      createShadowTwin: saveOptions.createShadowTwin
    });
  }, [saveOptions]);
  
  // Aktualisiere saveOptions wenn sich relevante Parameter ändern
  // WICHTIG: saveOptions.fileName NICHT in Dependencies, um Endlosschleife zu vermeiden
  // Verwende setSaveOptions mit Funktion, um auf aktuellen Wert zuzugreifen
  React.useEffect(() => {
    // Generiere neuen Dateinamen basierend auf aktuellen Parametern
    const newFileName = generateTransformationFileName(
      content,
      template,
      saveOptions.targetLanguage,
      currentItem?.metadata.name,
      currentItem,
      activeLibrary
    );
    
    // Verwende setSaveOptions mit Funktion, um auf aktuellen Wert zuzugreifen
    // Das vermeidet Race Conditions und Endlosschleifen
    setSaveOptions(prev => {
      // Nur aktualisieren, wenn sich der Dateiname wirklich geändert hat
      if (prev.fileName !== newFileName) {
        FileLogger.debug('TextTransform', 'Aktualisiere fileName', {
          oldFileName: prev.fileName,
          newFileName: newFileName,
          template,
          targetLanguage: saveOptions.targetLanguage
        });
        
        return {
          ...prev,
          fileName: newFileName
        };
      }
      // Keine Änderung nötig - gib vorherigen State zurück
      return prev;
    });
  }, [content, template, saveOptions.targetLanguage, currentItem?.metadata.name, currentItem, activeLibrary, generateTransformationFileName]); // saveOptions.fileName ENTFERNT aus Dependencies!
  
  const { refreshItems } = useStorage();

  // Standard-Templates definieren
  const standardTemplates = [
    { name: "Besprechung", isStandard: true },
    { name: "Gedanken", isStandard: true },
    { name: "Interview", isStandard: true },
    { name: "Zusammenfassung", isStandard: true }
  ];

  // Templates laden wenn Library bereit ist
  React.useEffect(() => {
    async function loadTemplatesIfNeeded() {
      if (!activeLibrary?.id || libraryStatus !== 'ready') {
        return;
      }

      try {
        // Verwende zentrale Client-Library für MongoDB-Templates
        const { listAvailableTemplates } = await import('@/lib/templates/template-service-client')
        const templateNames = await listAvailableTemplates(activeLibrary.id)
        setCustomTemplateNames(templateNames);
      } catch (error) {
        console.error('Fehler beim Laden der Templates:', error);
        // Bei Fehler leere Template-Liste setzen
        setCustomTemplateNames([]);
      }
    }

    loadTemplatesIfNeeded();
  }, [activeLibrary?.id, libraryStatus]);

  // Debug-Logging für activeLibrary
  React.useEffect(() => {
    FileLogger.debug('TextTransform', 'activeLibrary', {
      libraryId: activeLibrary?.id,
      libraryLabel: activeLibrary?.label
    });
  }, [activeLibrary]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };
  
  // Referenz für den TransformResultHandler
  const transformResultHandlerRef = React.useRef<(result: TransformResult) => void>(() => {});
  
  const handleTransformClick = async () => {
    FileLogger.info('TextTransform', 'handleTransformClick aufgerufen', { textLength: text?.length || 0 });
    
    if (!text || text.trim().length === 0) {
      toast.error("Fehler", {
        description: "Bitte geben Sie einen Text zum Transformieren ein",
        duration: 7000
      });
      return;
    }
    
    if (!provider || !currentItem) {
      toast.error("Fehler", {
        description: "Provider oder Datei nicht verfügbar",
        duration: 7000
      });
      return;
    }
    
    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Keine aktive Bibliothek gefunden",
        duration: 7000
      });
      return;
    }

    // Für Text-Transformation brauchen wir keine Secretary Service Konfiguration zu prüfen,
    // da die API Route die Konfiguration aus der Datenbank lädt
    FileLogger.info('TextTransform', 'Starte Text-Transformation für Bibliothek', { libraryId: activeLibrary.id });

    setIsLoading(true);
    try {
      // Template-Typ bestimmen
      const isStandardTemplate = standardTemplates.some(t => t.name === template);
      
      let result: TransformResult;
      
      if (isStandardTemplate) {
        // Standard-Template: Verwende TransformService mit Template-Name
        FileLogger.info('TextTransform', 'Verwende Standard-Template', { templateName: template });
        
        // WICHTIG: Extrahiere source_file aus Frontmatter der Quelldatei, falls vorhanden
        // Dies stellt sicher, dass der ursprüngliche Dateiname verwendet wird, nicht der Shadow-Twin-Name
        let originalSourceFileName = currentItem.metadata.name;
            try {
              const metadata = extractFrontmatter(content);
              if (metadata.source_file && typeof metadata.source_file === 'string') {
                let sourceFile = metadata.source_file.trim();
                // Entferne Anführungszeichen am Anfang und Ende (falls vorhanden)
                sourceFile = sourceFile.replace(/^["']|["']$/g, '').trim();
                const cleanedSourceFile = sourceFile.replace(/\{\{.*?\}\}/g, '').trim();
                if (cleanedSourceFile && cleanedSourceFile.length > 0) {
                  originalSourceFileName = cleanedSourceFile;
                  FileLogger.debug('TextTransform', 'Verwende source_file aus Frontmatter für Platzhalter-Ersetzung', {
                    sourceFile: originalSourceFileName,
                    originalSourceFile: metadata.source_file,
                    currentFileName: currentItem.metadata.name
                  });
                }
              }
            } catch (error) {
              FileLogger.debug('TextTransform', 'Konnte source_file nicht aus Frontmatter extrahieren', { error });
            }
        
        // Erstelle temporäres Item mit korrektem Namen für Platzhalter-Ersetzung
        const itemForPlaceholder = {
          ...currentItem,
          metadata: {
            ...currentItem.metadata,
            name: originalSourceFileName
          }
        };
        
        result = await TransformService.transformText(
          text, 
          itemForPlaceholder, // Verwende Item mit korrektem source_file Namen
          saveOptions,
          provider,
          refreshItems,
          activeLibrary.id,
          template
        );
      } else if (customTemplateNames.includes(template)) {
        // Benutzerdefiniertes Template: Lade Inhalt und verwende direkten Secretary Service Call
        FileLogger.info('TextTransform', 'Lade benutzerdefinierten Template-Inhalt', { templateName: template });
        
        try {
          if (!activeLibrary?.id) return;
          // Verwende zentrale Client-Library für MongoDB-Templates
          const { loadTemplate } = await import('@/lib/templates/template-service-client')
          const templateResult = await loadTemplate({
            libraryId: activeLibrary.id,
            preferredTemplateName: template
          })
          const templateContent = templateResult.templateContent
          
          FileLogger.info('TextTransform', 'Template-Inhalt geladen', { 
            templateName: template,
            contentLength: templateContent.length 
          });
          
          // Direkter Secretary Service Call mit Template-Content
          let transformedText = await transformTextWithTemplate(
            text,
            saveOptions.targetLanguage,
            activeLibrary.id,
            templateContent
          );
          
          // DEBUG: Logge den zurückgegebenen Text vor Platzhalter-Ersetzung
          FileLogger.debug('TextTransform', 'Secretary Service Response erhalten', {
            textLength: transformedText.length,
            textPreview: transformedText.substring(0, 500),
            hasFrontmatter: transformedText.includes('---'),
          });
          
          // Ersetze Platzhalter im Frontmatter (z.B. {{audiofile}} → tatsächlicher Dateiname)
          // WICHTIG: Verwende source_file aus Frontmatter der Quelldatei, falls vorhanden
          if (currentItem) {
            let originalSourceFileName = currentItem.metadata.name;
            try {
              const metadata = extractFrontmatter(content);
              if (metadata.source_file && typeof metadata.source_file === 'string') {
                let sourceFile = metadata.source_file.trim();
                // Entferne Anführungszeichen am Anfang und Ende (falls vorhanden)
                sourceFile = sourceFile.replace(/^["']|["']$/g, '').trim();
                const cleanedSourceFile = sourceFile.replace(/\{\{.*?\}\}/g, '').trim();
                if (cleanedSourceFile && cleanedSourceFile.length > 0) {
                  originalSourceFileName = cleanedSourceFile;
                  FileLogger.debug('TextTransform', 'Verwende source_file aus Frontmatter für Platzhalter-Ersetzung (Custom Template)', {
                    sourceFile: originalSourceFileName,
                    originalSourceFile: metadata.source_file,
                    currentFileName: currentItem.metadata.name
                  });
                }
              }
            } catch (error) {
              FileLogger.debug('TextTransform', 'Konnte source_file nicht aus Frontmatter extrahieren (Custom Template)', { error });
            }
            
            const beforeReplace = transformedText;
            transformedText = replacePlaceholdersInMarkdown(transformedText, originalSourceFileName);
            
            // DEBUG: Logge Unterschied nach Platzhalter-Ersetzung
            if (beforeReplace !== transformedText) {
              FileLogger.debug('TextTransform', 'Platzhalter ersetzt', {
                originalItemName: currentItem.metadata.name,
                originalSourceFileName,
                beforePreview: beforeReplace.substring(0, 500),
                afterPreview: transformedText.substring(0, 500),
              });
            }
          }
          
          // Ergebnis immer als Shadow-Twin speichern
          // Explizite Parameter übergeben statt aus Dateinamen zu parsen
          const saveResult = await TransformService.saveTransformedText(
            transformedText,
            currentItem,
            saveOptions,
            provider,
            refreshItems,
            activeLibrary?.id, // libraryId für Modus-Bestimmung
            'transformation', // artifactKind: Template-Transformation
            template // templateName: Explizit übergeben
          );
          result = saveResult;
        } catch (error) {
          FileLogger.error('TextTransform', 'Fehler beim Laden des Template-Inhalts', error);
          // Fallback auf Standard-Template
          result = await TransformService.transformText(
            text, 
            currentItem,
            saveOptions,
            provider,
            refreshItems,
            activeLibrary.id,
            "Besprechung"
          );
        }
      } else {
        // Unbekanntes Template: Fallback auf Standard-Template
        FileLogger.warn('TextTransform', 'Unbekanntes Template, verwende Standard-Template', { templateName: template });
        
        result = await TransformService.transformText(
          text, 
          currentItem,
          saveOptions,
          provider,
          refreshItems,
          activeLibrary.id,
          "Besprechung"
        );
      }

      FileLogger.info('TextTransform', 'Markdown Transformation abgeschlossen', {
        originalFile: currentItem.metadata.name,
        transformedFile: result.savedItem?.metadata.name || 'unknown',
        textLength: result.text.length
      });

      // Wenn wir einen onRefreshFolder-Handler haben, informiere die übergeordnete Komponente
      if (onRefreshFolder && currentItem.parentId && result.updatedItems && result.updatedItems.length > 0) {
        FileLogger.info('TextTransform', 'Informiere Library über aktualisierte Dateiliste', {
          libraryId: activeLibrary?.id,
          newFileCount: result.updatedItems.length
        });
        onRefreshFolder(currentItem.parentId, result.updatedItems, result.savedItem || undefined);
      } else {
        // Wenn kein onRefreshFolder-Handler da ist, rufen wir selbst den handleTransformResult auf
        transformResultHandlerRef.current(result);
      }
      
      // Jetzt den allgemeinen onTransform-Callback aufrufen
      onTransform(result.text);
    } catch (error) {
      FileLogger.error('TextTransform', 'Fehler bei der Transformation', error);
      toast.error("Fehler", {
        description: `Die Transformation ist fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="text-sm font-medium">Text transformieren</div>
      <Textarea 
        value={text} 
        onChange={handleTextChange} 
        className="min-h-[300px] font-mono text-sm"
        placeholder="Markdown-Text zur Transformation eingeben..."
      />
      
      <TransformResultHandler
        onResultProcessed={() => {
          FileLogger.info('TextTransform', 'Transformation vollständig abgeschlossen und Datei ausgewählt');
          // Hier könnten zusätzliche Aktionen ausgeführt werden
        }}
        childrenAction={(handleTransformResult, isProcessingResult) => {
          // Speichere die handleTransformResult-Funktion in der Ref
          transformResultHandlerRef.current = handleTransformResult;
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Custom SaveOptions für Text-Transformation */}
              <Card className="p-4 border rounded-md">
                <CardContent className="p-0">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="target-language">Zielsprache</Label>
                        <Select
                          value={saveOptions.targetLanguage}
                          onValueChange={(value) => {
                            const newFileName = generateTransformationFileName(
                              content,
                              template,
                              value,
                              currentItem?.metadata.name,
                              currentItem,
                              activeLibrary
                            );
                            
                            setSaveOptions(prev => ({
                              ...prev,
                              targetLanguage: value,
                              fileName: newFileName
                            }));
                          }}
                        >
                          <SelectTrigger id="target-language">
                            <SelectValue placeholder="Sprache auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORTED_LANGUAGES.map((language) => (
                              <SelectItem key={language.code} value={language.code}>
                                {language.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Dateierweiterung ist immer .md für Shadow-Twins */}
                    </div>

                    <div>
                      <Label htmlFor="file-name">Dateiname</Label>
                      <div className="px-3 py-2 bg-muted rounded-md text-sm">
                        {saveOptions.fileName}.{saveOptions.fileExtension}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Automatisch generiert nach Konvention
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="space-y-4 p-4 border rounded-md">
                <div>
                  <Label htmlFor="template">Vorlage</Label>
                  <Select
                    value={template}
                    onValueChange={setTemplate}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Vorlage auswählen" />
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
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleTransformClick}
                    disabled={isLoading || isProcessingResult}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>Wird transformiert...</>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Transformieren
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

