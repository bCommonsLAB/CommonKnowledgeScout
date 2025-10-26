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
import { TransformService, TransformSaveOptions, TransformResult } from "@/lib/transform/transform-service";
import { transformTextWithTemplate } from "@/lib/secretary/client";
import { Label } from "@/components/ui/label";
import { TransformResultHandler } from "@/components/library/transform-result-handler";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FileLogger } from "@/lib/debug/logger"
import { SUPPORTED_LANGUAGES } from "@/lib/secretary/constants";
import { stripAllFrontmatter, parseFrontmatter } from '@/lib/markdown/frontmatter'

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
  const { listItems } = useStorage();
  
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
  
  // Generiere Shadow-Twin Dateinamen basierend auf source_file aus Frontmatter
  const generateTransformationFileName = React.useCallback((
    content: string, 
    template: string, 
    targetLanguage: string,
    currentFileName?: string
  ): string => {
    // Extrahiere Frontmatter
    const metadata = extractFrontmatter(content);
    
    // Verwende source_file aus Frontmatter, falls vorhanden
    let baseName: string;
    if (metadata.source_file) {
      FileLogger.debug('TextTransform', 'Verwende source_file aus Frontmatter', { sourceFile: metadata.source_file });
      baseName = getBaseFileName(metadata.source_file);
    } else if (currentFileName) {
      // Fallback: Verwende aktuellen Dateinamen ohne Sprach-Suffix
      baseName = currentFileName;
      // Entferne existierende Sprach-Suffixe (z.B. ".de" aus "Sprache 133.de.md")
      const langPattern = /\.(de|en|fr|es|it)$/i;
      if (langPattern.test(baseName)) {
        baseName = baseName.replace(langPattern, '');
      }
      FileLogger.debug('TextTransform', 'Kein source_file in Frontmatter, verwende aktuellen Dateinamen', { baseName });
    } else {
      baseName = "transformation";
    }
    
    // Generiere neuen Dateinamen: <source_file>.<template>.<targetlanguage>
    return `${baseName}.${template}.${targetLanguage}`;
  }, [extractFrontmatter, getBaseFileName]);
  
  // Initialisiere saveOptions mit korrektem Dateinamen
  const [saveOptions, setSaveOptions] = React.useState<TransformSaveOptions>(() => {
    const targetLang = "de";
    
    const fileName = generateTransformationFileName(
      content,
      template,
      targetLang,
      currentItem?.metadata.name
    );
    
    return {
      targetLanguage: targetLang,
      fileName: fileName,
      createShadowTwin: true,
      fileExtension: "md"
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
  React.useEffect(() => {
    if (saveOptions.createShadowTwin) {
      const newFileName = generateTransformationFileName(
        content,
        template,
        saveOptions.targetLanguage,
        currentItem?.metadata.name
      );
      
      if (newFileName !== saveOptions.fileName) {
        FileLogger.debug('TextTransform', 'Aktualisiere fileName', {
          oldFileName: saveOptions.fileName,
          newFileName: newFileName,
          targetLanguage: saveOptions.targetLanguage
        });
        
        setSaveOptions(prev => ({
          ...prev,
          fileName: newFileName
        }));
      }
    }
  }, [content, template, saveOptions.targetLanguage, saveOptions.createShadowTwin, currentItem, generateTransformationFileName]);
  
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const { refreshItems } = useStorage();

  // Standard-Templates definieren
  const standardTemplates = [
    { name: "Besprechung", isStandard: true },
    { name: "Gedanken", isStandard: true },
    { name: "Interview", isStandard: true },
    { name: "Zusammenfassung", isStandard: true }
  ];

  // Templates laden wenn Provider und Library bereit sind
  React.useEffect(() => {
    async function loadTemplatesIfNeeded() {
      if (!provider || libraryStatus !== 'ready' || !activeLibrary) {
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
  }, [provider, libraryStatus, activeLibrary, listItems]);

  // Aktualisiere den Dateinamen, wenn das Template geändert wird
  React.useEffect(() => {
    if (saveOptions.createShadowTwin) {
      const newFileName = generateTransformationFileName(
        content,
        template,
        saveOptions.targetLanguage,
        currentItem?.metadata.name
      );
      
      if (newFileName !== saveOptions.fileName) {
        FileLogger.debug('TextTransform', 'Template geändert, aktualisiere fileName', {
          oldTemplate: saveOptions.targetLanguage,
          newTemplate: template,
          oldFileName: saveOptions.fileName,
          newFileName: newFileName
        });
        
        setSaveOptions(prev => ({
          ...prev,
          fileName: newFileName
        }));
      }
    }
  }, [template, content, saveOptions.targetLanguage, saveOptions.createShadowTwin, currentItem?.metadata.name, saveOptions.fileName, generateTransformationFileName]);

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
        
        result = await TransformService.transformText(
          text, 
          currentItem,
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
          // Templates-Ordner finden
          const rootItems = await listItems('root');
          const templatesFolder = rootItems.find(item => 
            item.type === 'folder' && item.metadata.name === 'templates'
          );
          
          if (!templatesFolder) {
            throw new Error('Templates-Ordner nicht gefunden');
          }
          
          // Template-Datei finden
          const templateItems = await listItems(templatesFolder.id);
          const templateFile = templateItems.find(item => 
            item.type === 'file' && 
            item.metadata.name === `${template}.md`
          );
          
          if (!templateFile) {
            throw new Error(`Template-Datei "${template}.md" nicht gefunden`);
          }
          
          // Template-Inhalt laden
          const { blob } = await provider.getBinary(templateFile.id);
          const templateContent = await blob.text();
          
          FileLogger.info('TextTransform', 'Template-Inhalt geladen', { 
            templateName: template,
            contentLength: templateContent.length 
          });
          
          // Direkter Secretary Service Call mit Template-Content
          const transformedText = await transformTextWithTemplate(
            text,
            saveOptions.targetLanguage,
            activeLibrary.id,
            templateContent
          );
          
          // Ergebnis speichern falls gewünscht
          if (saveOptions.createShadowTwin) {
            const saveResult = await TransformService.saveTransformedText(
              transformedText,
              currentItem,
              saveOptions,
              provider,
              refreshItems
            );
            result = saveResult;
          } else {
            result = {
              text: transformedText,
              updatedItems: []
            };
          }
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
                              currentItem?.metadata.name
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
                      
                      <div>
                        <Label htmlFor="file-extension">Dateierweiterung</Label>
                        <Select
                          value={saveOptions.fileExtension}
                          onValueChange={(value) => setSaveOptions(prev => ({ ...prev, fileExtension: value }))}
                          disabled={saveOptions.createShadowTwin}
                        >
                          <SelectTrigger id="file-extension">
                            <SelectValue placeholder="Erweiterung wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="md">Markdown (.md)</SelectItem>
                            <SelectItem value="txt">Text (.txt)</SelectItem>
                            <SelectItem value="json">JSON (.json)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="file-name">Dateiname</Label>
                      <Input
                        id="file-name"
                        value={saveOptions.fileName}
                        onChange={(e) => setSaveOptions(prev => ({ ...prev, fileName: e.target.value }))}
                        disabled={saveOptions.createShadowTwin}
                        placeholder={saveOptions.createShadowTwin ? "Automatisch generiert" : "Dateiname eingeben"}
                      />
                      {saveOptions.createShadowTwin && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Format: {saveOptions.fileName}.{saveOptions.fileExtension}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="create-shadow-twin"
                        checked={saveOptions.createShadowTwin}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const newFileName = generateTransformationFileName(
                              content,
                              template,
                              saveOptions.targetLanguage,
                              currentItem?.metadata.name
                            );
                            
                            setSaveOptions(prev => ({
                              ...prev,
                              createShadowTwin: true,
                              fileName: newFileName
                            }));
                          } else {
                            setSaveOptions(prev => ({ ...prev, createShadowTwin: false }));
                          }
                        }}
                      />
                      <Label htmlFor="create-shadow-twin">Als Shadow-Twin speichern</Label>
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
  return '<div class="overflow-x-auto my-4"><table class="min-w-full divide-y divide-muted-foreground/20">';
};

md.renderer.rules.thead_open = function() {
  return '<thead class="bg-muted">';
};

md.renderer.rules.th_open = function() {
  return '<th class="px-4 py-2 text-left text-sm font-semibold">';
};

md.renderer.rules.td_open = function() {
  return '<td class="px-4 py-2 text-sm border-t border-muted-foreground/10">';
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
 * Converts Obsidian paths and prepares markdown content
 */
function processObsidianContent(
  content: string, 
  currentFolderId: string = 'root',
  provider: StorageProvider | null = null
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

  // Add base URL to relative image paths
  if (currentFolderId) {
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
      hasOnRefreshFolder: !!onRefreshFolder
    });
  }, [content.length, currentItem?.id, currentItem?.metadata.name, activeTab, provider, onTransform, onRefreshFolder]);
  
  // Bei Änderung der Datei-ID auf Vorschau-Tab zurücksetzen
  React.useEffect(() => {
    FileLogger.debug('MarkdownPreview', 'Datei-ID geändert, setze Tab zurück', {
      currentItemId: currentItem?.id,
      currentItemName: currentItem?.metadata.name
    });
    setActiveTab("preview");
  }, [currentItem?.id]);
  
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
      provider
    );

    const rendered = md.render(processedContent);
    
    return rendered;
  }, [content, currentFolderId, provider]);
  
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
    if (old && old.parentElement) {
      const txt = old.textContent || '';
      const textNode = document.createTextNode(txt);
      old.parentElement.replaceChild(textNode, old);
    }
  };

  const scrollContainerTo = (el: HTMLElement) => {
    const root = containerRef.current;
    if (!root) return;
    const top = el.offsetTop - 16;
    root.scrollTo({ top, behavior: 'smooth' });
  };

  const scrollToPage = (n: number | string) => {
    const el = contentRef.current?.querySelector(`[data-page-marker="${String(n)}"]`) as HTMLElement | null;
    if (el) scrollContainerTo(el);
  };

  const scrollToText = (q: string) => {
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
        node.parentNode?.replaceChild(frag, node);
        scrollContainerTo(span);
        return;
      }
      node = walker.nextNode();
    }
  };

  const setQueryAndSearch = (q: string) => { setQuery(q); scrollToText(q); };

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
  }, [onRegisterApi]);

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
        
        <TabsContent value="preview" className="flex-1 overflow-auto relative" data-markdown-scroll-root="true" ref={!isFullscreen ? containerRef : undefined}>
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
            className={cn("prose dark:prose-invert max-w-none w-full", compact ? "p-1" : "p-4")}
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
                className={cn("prose dark:prose-invert max-w-none w-full", compact ? "p-1" : "p-4")}
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