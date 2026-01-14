import * as React from 'react';
import { Remarkable } from 'remarkable';
import { linkify } from 'remarkable/linkify';
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { Button } from '@/components/ui/button';
import { Wand2, Search, Maximize2, X as CloseIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import 'highlight.js/styles/github-dark.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAtomValue } from "jotai";
import { activeLibraryAtom, selectedFileAtom, libraryStatusAtom } from "@/atoms/library-atom";
import { useStorage } from "@/contexts/storage-context";
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import { TransformService, TransformSaveOptions, TransformResult } from "@/lib/transform/transform-service";
import { transformTextWithTemplate } from "@/lib/secretary/client";
import { Label } from "@/components/ui/label";
import { TransformResultHandler } from "@/components/library/transform-result-handler";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FileLogger } from "@/lib/debug/logger"
import { SUPPORTED_LANGUAGES } from "@/lib/secretary/constants";
import { stripAllFrontmatter, parseFrontmatter } from '@/lib/markdown/frontmatter'
import { replacePlaceholdersInMarkdown } from '@/lib/markdown/placeholder-replacement'
import { buildArtifactName, extractBaseName, parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

/**
 * Fügt unsichtbare Anker vor Zeilen wie "— Seite 12 —" ein, damit Scroll‑Sync möglich ist.
 * Der sichtbare Text bleibt erhalten; wir ergänzen nur ein Marker‑DIV vorher.
 */
function injectPageAnchors(content: string): string {
  const pageLine = /^(?:\s*[–—-])\s*Seite\s+(\d+)\s*(?:[–—-])\s*$/gmi;
  return content.replace(pageLine, (_m, pageNum: string) => {
    const n = String(pageNum).trim();
    return `<div data-page-marker="${n}"></div>\n— Seite ${n} —`;
  });
}

interface MarkdownPreviewProps {
  content: string;
  currentFolderId?: string;
  provider?: StorageProvider | null;
  className?: string;
  onTransform?: () => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
  onRegisterApi?: (api: { scrollToText: (q: string) => void; scrollToPage: (n: number | string) => void; setQueryAndSearch: (q: string) => void; getVisiblePage: () => number | null }) => void;
  compact?: boolean; // Kompakte Ansicht: ohne Schnellsuche, minimale Ränder
}

/**
 * Interface for TextTransform component props
 */
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
const TextTransform = ({ content, currentItem, provider, onTransform, onRefreshFolder }: TextTransformProps) => {
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

// Initialize Remarkable with options
const md = new Remarkable({
  html: true,        // Enable HTML tags in source
  xhtmlOut: true,    // Use '/' to close single tags (<br />)
  breaks: true,      // Convert '\n' in paragraphs into <br>
  typographer: true, // Enable smartypants and other sweet transforms
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {}
    }
    try {
      return hljs.highlightAuto(str).value;
    } catch {}
    return '';
  }
}).use(linkify); // Linkify als Plugin hinzufügen

// Configure horizontal line detection
md.block.ruler.disable(['hr']);
md.block.ruler.at('hr', function (state, startLine, endLine, silent) {
  const pos = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const marker = state.src.charCodeAt(pos);

  if (marker !== 0x2A /* * */ && marker !== 0x2D /* - */ && marker !== 0x5F /* _ */) {
    return false;
  }

  let count = 1;
  let ch = marker;
  let pos2 = pos + 1;

  while (pos2 < max) {
    ch = state.src.charCodeAt(pos2);
    if (ch !== marker) { break; }
    count++;
    pos2++;
  }

  if (count < 3) { return false; }

  if (silent) { return true; }

  state.line = startLine + 1;
  interface PushableState { push: (type: string, tag: string, nesting: number) => unknown; }
  const token = (state as unknown as PushableState).push('hr', 'hr', 0) as Record<string, unknown>;
  token.map = [startLine, state.line];
  token.markup = Array(count + 1).join(String.fromCharCode(marker));

  return true;
}, {});

md.inline.ruler.enable(['emphasis']);

// Customize renderer rules for better formatting
md.renderer.rules.heading_open = function(tokens, idx) {
  const token = tokens[idx];
  const level = token.hLevel;
  const classes = {
    1: 'text-4xl font-bold mt-8 mb-4',
    2: 'text-3xl font-semibold mt-6 mb-3',
    3: 'text-2xl font-semibold mt-4 mb-2',
    4: 'text-xl font-medium mt-4 mb-2',
    5: 'text-lg font-medium mt-3 mb-2',
    6: 'text-base font-medium mt-3 mb-2'
  }[level as 1|2|3|4|5|6] || '';
  
  return `<h${level} class="${classes}">`;
};

// Code blocks with syntax highlighting
md.renderer.rules.fence = function (tokens, idx) {
  const token = tokens[idx];
  const lang = token.params || '';
  const content = token.content || '';
  
  let code = content;
  if (lang && hljs.getLanguage(lang)) {
    try {
      code = hljs.highlight(content, { language: lang }).value;
    } catch {}
  }
  
  return `
    <div class="relative">
      <div class="absolute right-2 top-2 text-xs text-muted-foreground">${lang}</div>
      <pre class="hljs bg-muted p-4 rounded-lg overflow-x-auto">
        <code class="language-${lang}">${code}</code>
      </pre>
    </div>`;
};

// Inline code
md.renderer.rules.code = function (tokens, idx) {
  const token = tokens[idx];
  return `<code class="bg-muted px-1.5 py-0.5 rounded-sm text-sm">${token.content || ''}</code>`;
};

// Blockquotes
md.renderer.rules.blockquote_open = function() {
  return '<blockquote class="border-l-4 border-muted-foreground/20 pl-4 italic my-4">';
};

// Lists
md.renderer.rules.list_item_open = function() {
  return '<li class="ml-6 pl-2">';
};

md.renderer.rules.bullet_list_open = function() {
  return '<ul class="list-disc list-outside space-y-1 my-4">';
};

// Horizontal lines
md.renderer.rules.hr = function() {
  return '<div class="w-full px-0 my-8"><hr class="w-full border-0 border-b-[3px] border-muted-foreground/40" /></div>';
};

// Paragraphs and line breaks
md.renderer.rules.paragraph_open = function() {
  return '<p class="mb-4 whitespace-pre-wrap">';
};

md.renderer.rules.softbreak = function() {
  return '\n';
};

md.renderer.rules.hardbreak = function() {
  return '<br />';
};

md.renderer.rules.ordered_list_open = function() {
  return '<ol class="list-decimal list-outside space-y-1 my-4">';
};

// Nested lists
md.renderer.rules.bullet_list_close = function() {
  return '</ul>';
};

md.renderer.rules.ordered_list_close = function() {
  return '</ol>';
};

// Links
md.renderer.rules.link_open = function (tokens, idx) {
  const href = tokens[idx].href || '';
  if (href && href.startsWith('http')) {
    return `<a href="${href}" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">`;
  }
  return `<a href="${href}" class="text-primary hover:underline">`;
};

// Tables
md.renderer.rules.table_open = function() {
  return '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-muted-foreground/20 border-collapse">';
};

md.renderer.rules.table_close = function() {
  return '</table></div>';
};

md.renderer.rules.thead_open = function() {
  return '<thead class="bg-muted">';
};

md.renderer.rules.tbody_open = function() {
  return '<tbody class="divide-y divide-muted-foreground/10">';
};

md.renderer.rules.tr_open = function() {
  return '<tr class="border-b border-muted-foreground/10">';
};

md.renderer.rules.th_open = function() {
  return '<th class="px-4 py-3 text-left text-sm font-semibold align-top w-1/2">';
};

md.renderer.rules.th_close = function() {
  return '</th>';
};

md.renderer.rules.td_open = function() {
  return '<td class="px-4 py-3 text-sm align-top w-1/2 prose prose-sm max-w-none [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_a]:text-primary [&_a]:underline [&_h3]:!text-lg [&_h3]:!font-semibold [&_h3]:!mt-4 [&_h3]:!mb-2 [&_h3]:first:!mt-0 [&_hr]:!border-t [&_hr]:!border-muted-foreground/20 [&_hr]:!my-3 [&_hr]:!block">';
};

md.renderer.rules.td_close = function() {
  return '</td>';
};

// Emphasis
md.renderer.rules.em_open = function() {
  return '<em class="italic">';
};

md.renderer.rules.strong_open = function() {
  return '<strong class="font-bold">';
};

/**
 * Extracts YouTube ID from various URL formats
 */
function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
    /youtube\.com\/watch\?.*v=([^&\s]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * Konvertiert einen relativen Bildpfad zu einer Storage-API-URL
 * 
 * WICHTIG: Diese Funktion verwendet die zentrale Shadow-Twin-Bild-Auflösung,
 * wenn baseItem und provider verfügbar sind. Andernfalls verwendet sie
 * die Legacy-Logik mit currentFolderId.
 * 
 * @param imagePath Relativer Bildpfad (z.B. "img-0.jpeg")
 * @param currentFolderId ID des aktuellen Verzeichnisses (wo die Markdown-Datei liegt) - Legacy-Fallback
 * @param libraryId Die Library-ID
 * @param baseItem Optional: Die Basisdatei (z.B. PDF) für Shadow-Twin-Auflösung
 * @param provider Optional: Storage Provider für Shadow-Twin-Auflösung
 * @returns Storage-API-URL oder ursprünglicher Pfad bei Fehler
 */
function resolveImageUrl(
  imagePath: string, 
  currentFolderId: string, 
  libraryId: string | undefined,
  baseItem?: StorageItem | null,
  provider?: StorageProvider | null
): string {
  if (!imagePath || !libraryId) return imagePath;
  
  // Prüfe ob es bereits eine absolute URL ist (HTTP/HTTPS oder bereits aufgelöste Storage-API-URL)
  // Berücksichtige auch HTML-encoded URLs (&amp; statt &)
  const decodedPath = imagePath.replace(/&amp;/g, '&');
  if (decodedPath.startsWith('http://') || 
      decodedPath.startsWith('https://') || 
      decodedPath.startsWith('/api/storage/')) {
    return imagePath; // Gib die ursprüngliche URL zurück (mit Encoding falls vorhanden)
  }
  
  // Normalisiere den Pfad (entferne führende/trailing Slashes)
  const normalizedPath = imagePath.replace(/^\/+|\/+$/g, '');
  
  // Prüfe auf Path-Traversal-Versuche
  if (normalizedPath.includes('..')) {
    console.warn('[MarkdownPreview] Path traversal detected, ignoring:', normalizedPath);
    return imagePath;
  }
  
  // Verwende zentrale Shadow-Twin-Bild-Auflösung, wenn baseItem und provider verfügbar sind
  // Diese wird asynchron aufgelöst, daher geben wir hier einen Platzhalter zurück
  // Die tatsächliche Auflösung erfolgt in einem useEffect
  if (baseItem && provider) {
    // Asynchrone Auflösung wird in useEffect durchgeführt
    // Hier geben wir einen Platzhalter zurück, der später ersetzt wird
    return imagePath; // Wird in useEffect aufgelöst
  }
  
  // Legacy-Logik: Konstruiere den vollständigen Pfad relativ zum aktuellen Verzeichnis
  // WICHTIG: currentFolderId ist bereits base64-kodiert, muss zuerst dekodiert werden
  let fullPath: string;
  if (currentFolderId === 'root') {
    fullPath = normalizedPath;
  } else {
    try {
      // Dekodiere currentFolderId von base64 zu UTF-8 String
      // atob() gibt einen binären String zurück, der dann mit TextDecoder zu UTF-8 dekodiert werden muss
      const binaryString = atob(currentFolderId);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decodedFolderPath = new TextDecoder().decode(bytes);
      // Füge den Bildpfad hinzu
      fullPath = `${decodedFolderPath}/${normalizedPath}`;
    } catch (error) {
      // Falls Dekodierung fehlschlägt, verwende currentFolderId direkt (Fallback)
      console.warn('[MarkdownPreview] Fehler beim Dekodieren von currentFolderId:', error);
      fullPath = `${currentFolderId}/${normalizedPath}`;
    }
  }
  
  // Debug-Log für Bild-URL-Auflösung (nur wenn currentFolderId 'root' ist, um Problem zu identifizieren)
  if (currentFolderId === 'root') {
    FileLogger.debug('MarkdownPreview', 'Bild-URL-Auflösung mit root', {
      imagePath,
      currentFolderId,
      normalizedPath,
      fullPath,
      libraryId
    });
  }
  
  try {
    // Konvertiere UTF-8-String zu base64-kodierter fileId
    const utf8Bytes = new TextEncoder().encode(fullPath);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const fileId = btoa(binary);
    
    // Baue Storage-API-URL
    const resolvedUrl = `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(fileId)}&libraryId=${encodeURIComponent(libraryId)}`;
    
    // Debug-Log für erfolgreiche Auflösung (nur wenn currentFolderId nicht 'root' ist)
    if (currentFolderId !== 'root') {
      FileLogger.debug('MarkdownPreview', 'Bild-URL erfolgreich aufgelöst', {
        imagePath,
        currentFolderId,
        fullPath,
        fileId,
        resolvedUrl
      });
    }
    
    return resolvedUrl;
  } catch (error) {
    console.error('[MarkdownPreview] Fehler beim Konvertieren des Bildpfads:', error);
    return imagePath;
  }
}

/**
 * Converts Obsidian paths and prepares markdown content
 */
function processObsidianContent(
  content: string, 
  currentFolderId: string = 'root',
  provider: StorageProvider | null = null,
  libraryId: string | undefined = undefined
): string {
  if (!provider) return content;

  // Convert Obsidian audio embeds to links
  content = content.replace(/!\[\[(.*?\.(?:mp3|m4a|wav|ogg))\]\]/g, (match, audioFile) => {
    return `<div class="my-4">
      <div class="text-xs text-muted-foreground">Audio: ${audioFile}</div>
    </div>`;
  });

  // Convert Obsidian image paths
  content = content.replace(/!\[\[(.*?\.(?:jpg|jpeg|png|gif|webp))\]\]/g, '![]($1)');

  // Convert YouTube links
  content = content.replace(
    /\[(.*?)\]\((https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)]+)\)/g,
    (match, title, url) => {
      const videoId = getYouTubeId(url);
      if (!videoId) return match;
      
      return `
<div class="youtube-embed my-8">
  <div class="relative w-full" style="padding-bottom: 56.25%;">
    <iframe
      src="https://www.youtube.com/embed/${videoId}"
      title="${title || 'YouTube video player'}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      class="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
    ></iframe>
  </div>
</div>`;
    }
  );

  // Convert Obsidian YouTube callouts
  content = content.replace(
    />\s*\[!youtube\]\s*\n?\s*(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s)]+)/g,
    (match, url) => {
      const videoId = getYouTubeId(url);
      if (!videoId) return match;
      
      return `
<div class="youtube-embed my-8">
  <div class="relative w-full" style="padding-bottom: 56.25%;">
    <iframe
      src="https://www.youtube.com/embed/${videoId}"
      title="YouTube video player"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      class="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
    ></iframe>
  </div>
</div>`;
    }
  );

  // Resolve relative image paths to Storage API URLs
  if (currentFolderId && libraryId) {
    // Markdown image syntax: ![alt](path)
    content = content.replace(
      /!\[(.*?)\]\((?!http)(.*?)\)/g,
      (match, alt, imagePath) => {
        const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, libraryId);
        return `![${alt}](${resolvedUrl})`;
      }
    );
    
    // HTML image tags: <img-0.jpeg> or <img src="img-0.jpeg">
    content = content.replace(
      /<img-(\d+\.(?:jpeg|jpg|png|gif|webp))>/gi,
      (match, imagePath) => {
        const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, libraryId);
        return `![${imagePath}](${resolvedUrl})`;
      }
    );
    
    // HTML img tags with src attribute: <img src="img-0.jpeg">
    content = content.replace(
      /<img\s+src=["'](?!http)([^"']+)["'][^>]*>/gi,
      (match, imagePath) => {
        const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, libraryId);
        return `<img src="${resolvedUrl}">`;
      }
    );
  } else if (currentFolderId) {
    // Fallback: Add base URL to relative image paths (ohne libraryId)
    content = content.replace(
      /!\[(.*?)\]\((?!http)(.*?)\)/g,
      `![$1](${currentFolderId}/$2)`
    );
  }

  // Convert Obsidian internal links to normal links
  content = content.replace(/\[\[(.*?)\]\]/g, '[$1]($1)');

  // Convert Obsidian callouts
  content = content.replace(
    /> \[(.*?)\](.*?)(\n|$)/g,
    '<div class="callout $1">$2</div>'
  );

  return content;
}

/**
 * MarkdownPreview component for rendering markdown content with advanced formatting
 */
export const MarkdownPreview = React.memo(function MarkdownPreview({
  content,
  currentFolderId = 'root',
  provider = null,
  className,
  onTransform,
  onRefreshFolder,
  onRegisterApi,
  compact = false
}: MarkdownPreviewProps) {
  const currentItem = useAtomValue(selectedFileAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [activeTab, setActiveTab] = React.useState<string>("preview");
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = React.useState<string>("");
  const [showSearch, setShowSearch] = React.useState<boolean>(false);
  const [hoverTop, setHoverTop] = React.useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  
  // Logging in useEffect verschieben, um State-Updates während des Renderns zu vermeiden
  React.useEffect(() => {
    FileLogger.debug('MarkdownPreview', 'Komponente gerendert', {
      contentLength: content.length,
      currentItemId: currentItem?.id,
      currentItemName: currentItem?.metadata.name,
      activeTab,
      hasProvider: !!provider,
      hasOnTransform: !!onTransform,
      hasOnRefreshFolder: !!onRefreshFolder,
      currentFolderIdProp: currentFolderId,
      currentFolderIdType: typeof currentFolderId
    });
  }, [content.length, currentItem?.id, currentItem?.metadata.name, activeTab, provider, onTransform, onRefreshFolder, currentFolderId]);
  
  // Bei Änderung der Datei-ID auf Vorschau-Tab zurücksetzen
  React.useEffect(() => {
    FileLogger.debug('MarkdownPreview', 'Datei-ID geändert, setze Tab zurück', {
      currentItemId: currentItem?.id,
      currentItemName: currentItem?.metadata.name
    });
    setActiveTab("preview");
  }, [currentItem?.id, currentItem?.metadata.name]);
  
  // Memoize the markdown renderer
  const renderedContent = React.useMemo(() => {
    if (!content) return '';

    // Entferne Frontmatter robust
    let mainContent = stripAllFrontmatter(content);

    // Seite‑Marker als Anker einfügen, z. B. "— Seite 12 —" → <div data-page-marker="12"></div>
    mainContent = injectPageAnchors(mainContent);

    // Process the main content
    const processedContent = processObsidianContent(
      mainContent,
      currentFolderId,
      provider,
      activeLibraryId
    );

    const rendered = md.render(processedContent);
    
    // Nachbearbeitung: Ersetze Bild-URLs im gerenderten HTML
    // Remarkable lässt HTML-Tags durch, daher müssen wir die Bild-URLs im HTML ersetzen
    if (currentFolderId && activeLibraryId) {
      // Ersetze ALLE <img> Tags im gerenderten HTML (auch die von Remarkable generierten)
      // WICHTIG: Füge loading="lazy" hinzu, um Bilder nur zu laden, wenn sie im Viewport sind
      // WICHTIG: Füge onerror Handler hinzu, um fehlgeschlagene Requests nicht zu wiederholen
      let processedHtml = rendered.replace(
        /<img\s+([^>]*?)>/gi,
        (match, attributes) => {
          // Extrahiere src-Attribut (falls vorhanden)
          const srcMatch = attributes.match(/src=["']([^"']+)["']/i);
          if (!srcMatch) return match; // Kein src-Attribut, überspringe
          
          const imagePath = srcMatch[1];
          // Überspringe bereits absolute URLs (http/https oder Storage-API)
          if (imagePath.startsWith('http://') || 
              imagePath.startsWith('https://') || 
              imagePath.startsWith('/api/storage/')) {
            // Auch für absolute URLs: loading="lazy" hinzufügen, falls nicht vorhanden
            if (!attributes.includes('loading=')) {
              return `<img ${attributes} loading="lazy">`;
            }
            return match;
          }
          
          // Resolve relative URLs
          const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, activeLibraryId);
          
          // Ersetze src-Attribut
          let updatedAttributes = attributes.replace(/src=["'][^"']+["']/i, `src="${resolvedUrl}"`);
          
          // Füge loading="lazy" hinzu, falls nicht vorhanden
          if (!updatedAttributes.includes('loading=')) {
            updatedAttributes = `loading="lazy" ${updatedAttributes}`;
          }
          
          // Füge onerror Handler hinzu, falls nicht vorhanden
          // Zeige dezente Fehlermeldung statt Bild zu verstecken
          if (!updatedAttributes.includes('onerror=')) {
            const imageNameMatch = match.match(/alt=["']([^"']+)["']/) || match.match(/src=["']([^"']+)["']/);
            const displayName = imageNameMatch ? imageNameMatch[1] : 'Bild';
            // Verwende CSS-Klassen für dezente Fehlermeldung
            updatedAttributes = `${updatedAttributes} onerror="this.onerror=null; this.style.display='none'; const placeholder=document.createElement('div'); placeholder.className='text-xs text-muted-foreground text-center p-2 border border-dashed border-muted-foreground/20 rounded bg-muted/30'; placeholder.textContent='${displayName.replace(/'/g, "\\'")} nicht verfügbar'; this.parentNode?.appendChild(placeholder);"`;
          }
          
          return `<img ${updatedAttributes}>`;
        }
      );
      
      // Ersetze auch einfache <img-0.jpeg> Tags (falls Remarkable sie nicht konvertiert)
      // Diese werden möglicherweise als Text gerendert, nicht als HTML-Tag
      processedHtml = processedHtml.replace(
        /&lt;img-(\d+\.(?:jpeg|jpg|png|gif|webp))&gt;/gi,
        (match, imagePath) => {
          const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, activeLibraryId);
          const safeImagePath = imagePath.replace(/'/g, "\\'");
          return `<img src="${resolvedUrl}" alt="${imagePath}" loading="lazy" onerror="this.onerror=null; this.style.display='none'; const placeholder=document.createElement('div'); placeholder.className='text-xs text-muted-foreground text-center p-2 border border-dashed border-muted-foreground/20 rounded bg-muted/30'; placeholder.textContent='${safeImagePath} nicht verfügbar'; this.parentNode?.appendChild(placeholder);">`;
        }
      );
      
      // Ersetze auch als Text gerenderte <img-0.jpeg> Tags (nicht HTML-encoded)
      processedHtml = processedHtml.replace(
        /<img-(\d+\.(?:jpeg|jpg|png|gif|webp))>/gi,
        (match, imagePath) => {
          const resolvedUrl = resolveImageUrl(imagePath, currentFolderId, activeLibraryId);
          const safeImagePath = imagePath.replace(/'/g, "\\'");
          return `<img src="${resolvedUrl}" alt="${imagePath}" loading="lazy" onerror="this.onerror=null; this.style.display='none'; const placeholder=document.createElement('div'); placeholder.className='text-xs text-muted-foreground text-center p-2 border border-dashed border-muted-foreground/20 rounded bg-muted/30'; placeholder.textContent='${safeImagePath} nicht verfügbar'; this.parentNode?.appendChild(placeholder);">`;
        }
      );
      
      return processedHtml;
    }
    
    return rendered;
  }, [content, currentFolderId, provider, activeLibraryId]);
  
  // Logging nach dem Rendern in useEffect
  React.useEffect(() => {
    if (content) {
      FileLogger.debug('MarkdownPreview', 'Markdown Content verarbeitet', {
        contentLength: content.length,
        hasFrontmatter: content.includes('---'),
        renderedLength: renderedContent.length
      });
    }
  }, [content, renderedContent.length]);

  const handleTransformButtonClick = () => {
    FileLogger.info('MarkdownPreview', 'Transform-Button geklickt', {
      currentTab: activeTab
    });
    setActiveTab("transform");
  };

  // Navigations-API bereitstellen
  const removeOldHit = () => {
    const old = contentRef.current?.querySelector('[data-search-hit="1"]') as HTMLElement | null;
    // Prüfe, ob der Knoten noch existiert und ein Kind des Parent-Elements ist
    // Dies verhindert Fehler auf mobilen Geräten, wo React schneller neu rendern kann
    if (old && old.parentElement && old.parentElement.contains(old)) {
      const txt = old.textContent || '';
      const textNode = document.createTextNode(txt);
      try {
        old.parentElement.replaceChild(textNode, old);
      } catch (error) {
        // Fallback: Wenn replaceChild fehlschlägt, entferne den Knoten sicher
        // Dies kann passieren, wenn React die Komponente während der Manipulation neu rendert
        FileLogger.debug('MarkdownPreview', 'replaceChild fehlgeschlagen, verwende Fallback', { error });
        if (old.parentElement.contains(old)) {
          old.parentElement.removeChild(old);
          old.parentElement.appendChild(textNode);
        }
      }
    }
  };

  const scrollContainerTo = React.useCallback((el: HTMLElement) => {
    const root = containerRef.current;
    if (!root) return;
    const top = el.offsetTop - 16;
    root.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const scrollToPage = React.useCallback((n: number | string) => {
    const el = contentRef.current?.querySelector(`[data-page-marker="${String(n)}"]`) as HTMLElement | null;
    if (el) scrollContainerTo(el);
  }, [scrollContainerTo]);

  const scrollToText = React.useCallback((q: string) => {
    const root = contentRef.current;
    if (!root || !q) return;
    removeOldHit();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const lower = q.toLowerCase();
    let node: Node | null = walker.nextNode();
    while (node) {
      const text = (node.textContent || '').toLowerCase();
      const idx = text.indexOf(lower);
      if (idx >= 0) {
        // Prüfe, ob der Knoten noch existiert und ein Kind des Parent-Elements ist
        // Dies verhindert Fehler auf mobilen Geräten, wo React schneller neu rendern kann
        if (!node.parentNode || !node.parentNode.contains(node)) {
          // Knoten wurde bereits entfernt, überspringe diesen
          node = walker.nextNode();
          continue;
        }
        
        const orig = node.textContent || '';
        const before = orig.slice(0, idx);
        const hit = orig.slice(idx, idx + q.length);
        const after = orig.slice(idx + q.length);
        const span = document.createElement('span');
        span.setAttribute('data-search-hit', '1');
        span.className = 'bg-yellow-200 dark:bg-yellow-600/40 rounded px-0.5';
        span.textContent = hit;
        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        frag.appendChild(span);
        if (after) frag.appendChild(document.createTextNode(after));
        
        try {
          // Prüfe erneut vor replaceChild, da React die Komponente während der Suche neu rendern kann
          if (node.parentNode && node.parentNode.contains(node)) {
            node.parentNode.replaceChild(frag, node);
            scrollContainerTo(span);
            return;
          }
        } catch (error) {
          // Fallback: Wenn replaceChild fehlschlägt, logge den Fehler und breche ab
          // Dies kann passieren, wenn React die Komponente während der Manipulation neu rendert
          FileLogger.debug('MarkdownPreview', 'replaceChild in scrollToText fehlgeschlagen', { error });
          return;
        }
      }
      node = walker.nextNode();
    }
  }, [scrollContainerTo]);

  const setQueryAndSearch = React.useCallback((q: string) => { setQuery(q); scrollToText(q); }, [scrollToText]);

  const getVisiblePage = (): number | null => {
    const root = containerRef.current;
    if (!root) return null;
    const top = root.scrollTop + 8;
    const markers = Array.from(root.querySelectorAll('[data-page-marker]')) as HTMLElement[];
    if (markers.length === 0) return null;
    let candidate: { page: number; dist: number } | null = null;
    for (const m of markers) {
      const attr = m.getAttribute('data-page-marker');
      const page = attr ? Number(attr) : NaN;
      if (Number.isNaN(page)) continue;
      const dist = Math.abs(m.offsetTop - top);
      if (!candidate || dist < candidate.dist) candidate = { page, dist };
    }
    return candidate ? candidate.page : null;
  };

  React.useEffect(() => {
    onRegisterApi?.({ scrollToText, scrollToPage, setQueryAndSearch, getVisiblePage });
  }, [onRegisterApi, scrollToText, scrollToPage, setQueryAndSearch]);

  const handleTransformComplete = () => {
    FileLogger.info('MarkdownPreview', 'Transform abgeschlossen', {
      currentTab: activeTab
    });
    // Hier könnten wir den transformierten Inhalt verarbeiten
    // Zum Beispiel könnten wir ihn an die übergeordnete Komponente weitergeben
    if (onTransform) {
      onTransform();
    }
    // Zurück zur Vorschau wechseln
    setActiveTab("preview");
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {currentItem && !compact && (
        <div className="flex items-center justify-between mx-4 mt-4 mb-2 flex-shrink-0">
          <div className="text-xs text-muted-foreground">
            {currentItem.metadata.name}
          </div>
          {onTransform && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTransformButtonClick}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Transformieren
            </Button>
          )}
        </div>
      )}
      
      <Tabs value={activeTab} onValueChange={(value) => {
        FileLogger.info('MarkdownPreview', 'Tab gewechselt', {
          oldTab: activeTab,
          newTab: value,
          currentItemId: currentItem?.id,
          currentItemName: currentItem?.metadata.name
        });
        setActiveTab(value);
      }} className="flex flex-col flex-1 min-h-0">
        <TabsList className="hidden">
          <TabsTrigger value="preview">Vorschau</TabsTrigger>
          <TabsTrigger value="transform">Transformieren</TabsTrigger>
        </TabsList>
        
        <TabsContent value="preview" className="flex-1 overflow-auto relative pt-0" data-markdown-scroll-root="true" ref={!isFullscreen ? containerRef : undefined}>
          {/* Hover-Zone und Suchleiste (immer verfügbar, nimmt verborgen keinen Platz ein) */}
          <div
            className="sticky top-0 z-20 h-3 w-full"
            onMouseEnter={() => setHoverTop(true)}
            onMouseLeave={() => setHoverTop(false)}
          />
          <div
            className={cn(
              "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center gap-2 transition-all",
              (showSearch || hoverTop)
                ? "px-4 pt-3 pb-2 border-b opacity-100 translate-y-0 pointer-events-auto"
                : "h-0 p-0 border-0 opacity-0 -translate-y-2 pointer-events-none overflow-hidden"
            )}
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') scrollToText(query); if (e.key === 'Escape') setShowSearch(false); }}
              placeholder="Schnellsuche… (Enter)"
              className="h-8 text-xs"
            />
            <Button variant="outline" size="sm" className="h-8" onClick={() => scrollToText(query)}>Suchen</Button>
          </div>
          {/* Schwebende Icon-Leiste rechts oben */}
          <div className="absolute top-2 right-2 z-20">
            <div className="hidden md:flex flex-col gap-2">
              {onTransform && (
                <button
                  type="button"
                  aria-label="Transformieren"
                  title="Transformieren"
                  onClick={handleTransformButtonClick}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
                >
                  <Wand2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label="Vollbild"
                title="Vollbild"
                onClick={() => setIsFullscreen(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Schnellsuche"
                title="Schnellsuche"
                onClick={() => setShowSearch(v => !v)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div 
            ref={!isFullscreen ? contentRef : undefined}
            className={cn("prose dark:prose-invert max-w-none w-full overflow-x-hidden [&>*]:max-w-full [&>*]:overflow-x-hidden", compact ? "p-1 pt-0 [&>*:first-child]:!mt-0" : "p-4 [&>*:first-child]:!mt-0")}
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        </TabsContent>
        {isFullscreen && (
          <div className="fixed inset-0 z-[100] bg-background">
            <div className="h-full overflow-auto relative" data-markdown-scroll-root="true" ref={containerRef}>
              <div
                className="sticky top-0 z-20 h-3 w-full"
                onMouseEnter={() => setHoverTop(true)}
                onMouseLeave={() => setHoverTop(false)}
              />
              <div
                className={cn(
                  "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center gap-2 transition-all",
                  (showSearch || hoverTop)
                    ? "px-4 pt-3 pb-2 border-b opacity-100 translate-y-0 pointer-events-auto"
                    : "h-0 p-0 border-0 opacity-0 -translate-y-2 pointer-events-none overflow-hidden"
                )}
              >
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') scrollToText(query); if (e.key === 'Escape') setShowSearch(false); }}
                  placeholder="Schnellsuche… (Enter)"
                  className="h-8 text-xs"
                />
                <Button variant="outline" size="sm" className="h-8" onClick={() => scrollToText(query)}>Suchen</Button>
              </div>
              <div className="absolute top-2 right-2 z-20">
                <div className="hidden md:flex flex-col gap-2">
                  {onTransform && (
                    <button
                      type="button"
                      aria-label="Vollbild beenden und transformieren"
                      title="Transformieren"
                      onClick={handleTransformButtonClick}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
                    >
                      <Wand2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Vollbild beenden"
                    title="Vollbild beenden"
                    onClick={() => setIsFullscreen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Schnellsuche"
                    title="Schnellsuche"
                    onClick={() => setShowSearch(v => !v)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div 
                ref={contentRef}
                className={cn("prose dark:prose-invert max-w-none w-full overflow-x-hidden [&>*]:max-w-full [&>*]:overflow-x-hidden", compact ? "p-1 pt-0 [&>*:first-child]:!mt-0" : "p-4 [&>*:first-child]:!mt-0")}
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            </div>
          </div>
        )}
        
        <TabsContent value="transform" className="flex-1 overflow-auto">
          <TextTransform 
            content={content}
            currentItem={currentItem}
            provider={provider}
            onTransform={handleTransformComplete}
            onRefreshFolder={onRefreshFolder}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}, (prevProps, nextProps) => {
  // Return true if we should NOT update
  return (
    prevProps.content === nextProps.content &&
    prevProps.currentFolderId === nextProps.currentFolderId &&
    prevProps.provider === nextProps.provider &&
    prevProps.className === nextProps.className &&
    prevProps.onTransform === nextProps.onTransform &&
    prevProps.onRefreshFolder === nextProps.onRefreshFolder
  );
}); 