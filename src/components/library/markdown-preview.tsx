import * as React from 'react';
import { Remarkable } from 'remarkable';
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { MarkdownMetadata } from './markdown-metadata';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import 'highlight.js/styles/github-dark.css';
import { z } from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { transformText } from "@/lib/secretary/client"; 
import { useAtomValue } from "jotai";
import { activeLibraryAtom } from "@/atoms/library-atom";

interface MarkdownPreviewProps {
  content: string;
  currentFolderId?: string;
  provider?: StorageProvider | null;
  currentItem?: StorageItem | null;
  className?: string;
  onTransform?: () => void;
}

/**
 * Interface for TextTransform component props
 */
interface TextTransformProps {
  content: string;
  currentItem?: StorageItem | null;
  provider?: StorageProvider | null;
  onTransform: (transformedContent: string) => void;
}

/**
 * TextTransform component for transforming markdown content
 */
const TextTransform = ({ content, currentItem, provider, onTransform }: TextTransformProps) => {
  const [text, setText] = React.useState(content);
  const [isLoading, setIsLoading] = React.useState(false);
  const [targetLanguage, setTargetLanguage] = React.useState("de");
  const [template, setTemplate] = React.useState("Besprechung");
  const activeLibrary = useAtomValue(activeLibraryAtom);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleTransformClick = async () => {
    setIsLoading(true);
    try {
      // Prüfen, ob Secretary Service konfiguriert ist
      if (!activeLibrary?.config.secretaryService || 
          !activeLibrary.config.secretaryService.apiUrl || 
          !activeLibrary.config.secretaryService.apiKey) {
        throw new Error("Secretary Service API URL oder API Key nicht konfiguriert");
      }

      // Transformation mit dem Secretary Service
      const transformedContent = await transformText(
        text, 
        targetLanguage, 
        activeLibrary.id,
        activeLibrary.config.secretaryService.apiUrl, 
        activeLibrary.config.secretaryService.apiKey,
        template
      );

      console.log(transformedContent);

      /*
      // Shadow-Twin speichern
      const originalTwinItem = await saveShadowTwin(
        item,
        { output_text: transformedText },
        targetLanguage,
        provider
      );

      // Das Verzeichnis neu laden und die aktualisierten Items erhalten
      const updatedItems = await refreshItems(item.parentId);
      
      // Den Namen des erwarteten Twin-Items ermitteln
      const twinFileName = generateShadowTwinName(item.metadata.name, targetLanguage);
      
      // Das aktualisierte Twin-Item in der neuen Liste finden
      const updatedTwinItem = updatedItems.find(updatedItem => 
        updatedItem.metadata.name === twinFileName
      );
      
      // Das aktualisierte Twin-Item auswählen, wenn vorhanden, sonst das ursprüngliche
      const twinItemToSelect = updatedTwinItem || originalTwinItem;
      
      
      // Den neuen Twin auswählen mit dem aktualisierten Objekt
      selectFile(twinItemToSelect);

      toast.success("Transkription erfolgreich", {
        description: "Die Audio-Datei wurde erfolgreich transkribiert, bitte den Text kontrollieren und mit einer Transformation fortfahren.",
        duration: 7000
      });

      // Gib den Text, das neue Twin-Item UND die aktualisierten Items zurück
      onTransformComplete(text, twinItemToSelect, updatedItems);


      toast.success("Transformation erfolgreich", {
        description: "Der Text wurde erfolgreich transformiert.",
        duration: 7000
      });
      */
      onTransform(transformedContent);
    } catch (error) {
      console.error("Fehler bei der Transformation:", error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler bei der Transformation",
        duration: 7000
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
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Select
            value={targetLanguage}
            onValueChange={setTargetLanguage}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sprache auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="en">Englisch</SelectItem>
              <SelectItem value="fr">Französisch</SelectItem>
              <SelectItem value="es">Spanisch</SelectItem>
              <SelectItem value="it">Italienisch</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={template}
            onValueChange={setTemplate}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Template auswählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Besprechung">Besprechung</SelectItem>
              <SelectItem value="Gedanken">Gedanken</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button 
            onClick={handleTransformClick}
            disabled={isLoading}
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
};

// Initialize Remarkable with options
const md = new Remarkable('full', {
  html: true,        // Enable HTML tags in source
  xhtmlOut: true,    // Use '/' to close single tags (<br />)
  breaks: true,      // Convert '\n' in paragraphs into <br>
  linkify: true,     // Autoconvert URL-like text to links
  typographer: true, // Enable smartypants and other sweet transforms
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (err) {}
    }
    try {
      return hljs.highlightAuto(str).value;
    } catch (err) {}
    return '';
  }
});

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
  const token = (state as any).push('hr', 'hr', 0);
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
    } catch (e) {}
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
  provider: StorageProvider | null = null,
  currentItem: StorageItem | null = null
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
 * Process markdown content for rendering
 */
function processMarkdownContent(content: string): string {
  // Replace *** with a unique horizontal line
  return content.replace(/^\s*\*{3,}\s*$/gm, '\n---\n');
}

/**
 * MarkdownPreview component for rendering markdown content with advanced formatting
 */
export const MarkdownPreview = React.memo(function MarkdownPreview({
  content,
  currentFolderId = 'root',
  provider = null,
  currentItem = null,
  className,
  onTransform
}: MarkdownPreviewProps) {
  const [activeTab, setActiveTab] = React.useState<string>("preview");
  
  // Memoize the markdown renderer
  const renderedContent = React.useMemo(() => {
    if (!content) return '';

    // Get the content after the frontmatter
    const mainContent = content.split('---').length > 2 
      ? content.split('---').slice(2).join('---')
      : content;

    // Process the main content
    const processedContent = processObsidianContent(
      mainContent,
      currentFolderId,
      provider,
      currentItem
    );

    return md.render(processedContent);
  }, [content, currentFolderId, provider, currentItem]);

  const handleTransformButtonClick = () => {
    setActiveTab("transform");
  };

  const handleTransformComplete = (transformedContent: string) => {
    // Hier könnten wir den transformierten Inhalt verarbeiten
    // Zum Beispiel könnten wir ihn an die übergeordnete Komponente weitergeben
    if (onTransform) {
      onTransform();
    }
    // Zurück zur Vorschau wechseln
    setActiveTab("preview");
  };

  return (
    <div className={className}>
      {currentItem && (
        <div className="flex items-center justify-between mx-4 mt-4 mb-2">
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
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="hidden">
          <TabsTrigger value="preview">Vorschau</TabsTrigger>
          <TabsTrigger value="transform">Transformieren</TabsTrigger>
        </TabsList>
        
        <TabsContent value="preview">
          <div 
            className="prose dark:prose-invert max-w-none p-4 w-full"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        </TabsContent>
        
        <TabsContent value="transform">
          <TextTransform 
            content={content}
            currentItem={currentItem}
            provider={provider}
            onTransform={handleTransformComplete}
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
    prevProps.currentItem?.id === nextProps.currentItem?.id &&
    prevProps.className === nextProps.className &&
    prevProps.onTransform === nextProps.onTransform
  );
}); 