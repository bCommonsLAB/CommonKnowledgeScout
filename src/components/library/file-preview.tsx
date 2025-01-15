'use client';

import { useState, useEffect } from "react";
import { Remarkable } from 'remarkable';
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';
import { StorageItem, StorageProvider, StorageFile } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

interface FilePreviewProps {
  item: StorageItem | null;
  className?: string;
  provider: StorageProvider | null;
}

interface FileMetadata {
  content: {
    title?: string;
    description?: string;
  };
  transcriptionStatus?: 'pending' | 'completed' | 'failed';
  transcription?: string;
}

// Hilfsfunktion für die Dateityp-Erkennung
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'txt':
    case 'doc':
    case 'docx':
      return 'text';
    default:
      return 'unknown';
  }
}

// Initialisiere Remarkable mit Optionen
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

// Anpassen der Renderer-Regeln für bessere Formatierung
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

// Code-Blöcke mit Syntax-Highlighting
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

// Inline-Code
md.renderer.rules.code = function (tokens, idx) {
  const token = tokens[idx];
  return `<code class="bg-muted px-1.5 py-0.5 rounded-sm text-sm">${token.content || ''}</code>`;
};

// Blockquotes
md.renderer.rules.blockquote_open = function() {
  return '<blockquote class="border-l-4 border-muted-foreground/20 pl-4 italic my-4">';
};

// Listen
md.renderer.rules.list_item_open = function() {
  return '<li class="ml-6 pl-2">';
};

md.renderer.rules.bullet_list_open = function() {
  return '<ul class="list-disc list-outside space-y-1 my-4">';
};

md.renderer.rules.ordered_list_open = function() {
  return '<ol class="list-decimal list-outside space-y-1 my-4">';
};

// Verschachtelte Listen
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

// Tabellen
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

/**
 * Extrahiert die YouTube Video ID aus verschiedenen URL-Formaten
 */
function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
    /youtube\.com\/watch\?.*v=([^&\s]+)/,
    /youtube\.com\/shorts\/([^&\s]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Formatiert YAML-Frontmatter in eine lesbare Tabelle
 */
function formatFrontmatter(content: string): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return content;

  const frontmatter = frontmatterMatch[1];
  const restContent = content.slice(frontmatterMatch[0].length);

  // Konvertiere YAML in HTML-Tabelle
  const rows = frontmatter.split('\n')
    .filter(line => line.trim())
    .map(line => {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        let value = valueParts.join(':').trim();
        
        // Entferne umschließende Anführungszeichen
        value = value.replace(/^["'](.*)["']$/, '$1');
        
        // Behandle Arrays (mit oder ohne eckige Klammern)
        if (value.includes(',') || (value.startsWith('[') && value.endsWith(']'))) {
          // Entferne eckige Klammern falls vorhanden
          const cleanValue = value.replace(/^\[|\]$/g, '');
          const items = cleanValue
            .split(',')
            .map(item => item.trim().replace(/^["'](.*)["']$/, '$1'))
            .filter(Boolean);
            
          return `
            <tr class="border-t border-muted">
              <td class="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">${key.trim()}</td>
              <td class="py-2 text-xs text-muted-foreground">
                <div class="flex flex-wrap gap-1">
                  ${items.map(item => `<span class="bg-muted/50 px-1.5 py-0.5 rounded">${item}</span>`).join('')}
                </div>
              </td>
            </tr>`;
        }
        
        // Leere Werte
        if (!value) {
          value = '—'; // Em dash für leere Werte
        }

        return `
          <tr class="border-t border-muted">
            <td class="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">${key.trim()}</td>
            <td class="py-2 text-xs text-muted-foreground">
              <span class="bg-muted/50 px-1.5 py-0.5 rounded">${value}</span>
            </td>
          </tr>`;
      }
      return '';
    })
    .join('');

  return `
<div class="bg-muted/30 rounded-lg overflow-hidden mb-8">
  <div class="px-4 py-3 bg-muted/50 border-b border-muted">
    <div class="text-xs font-medium text-muted-foreground">Frontmatter</div>
  </div>
  <div class="p-4">
    <table class="w-full border-collapse">
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
</div>

${restContent}`;
}

/**
 * Lädt eine Audio-Datei und gibt die Binary-URL zurück
 */
async function getAudioUrl(filename: string, provider: StorageProvider | null, basePath: string): Promise<string | null> {
  if (!provider) {
    console.warn('No provider available');
    return null;
  }
  
  try {
    console.log('Loading audio file:', { filename, basePath });
    
    // Hole zuerst das aktuelle Item, um dessen parentId zu bekommen
    const currentItem = await provider.getItemById(basePath);
    console.log('Current item:', currentItem);
    
    // Suche nach der Datei im aktuellen Verzeichnis
    const files = await provider.listItemsById(currentItem.parentId);
    console.log('Found files:', files);
    
    const audioFile = files.find((f: StorageItem) => 
      f.type === 'file' && f.metadata.name === filename
    );
    
    if (!audioFile) {
      console.warn(`Audio file not found: ${filename} in path ${basePath}`);
      return null;
    }
    
    console.log('Found audio file:', audioFile);
    const { blob } = await provider.getBinary(audioFile.id);
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error loading audio file:', error);
    return null;
  }
}

/**
 * Konvertiert Obsidian-Bildpfade und bereitet den Markdown-Inhalt vor
 */
function processObsidianContent(content: string, basePath: string = '', provider: StorageProvider | null = null, currentItem: StorageItem | null = null): string {
  // Konvertiere Obsidian-Audio-Einbettungen (![[audio.m4a]] -> HTML5 Audio Player)
  content = content.replace(/!\[\[(.*?\.(?:mp3|m4a|wav|ogg))\]\]/g, (match, audioFile) => {
    const audioPath = basePath ? `${basePath}/${audioFile}` : audioFile;
    
    // Erstelle einen Platzhalter mit einer eindeutigen ID
    const placeholderId = `audio-${Math.random().toString(36).substr(2, 9)}`;
    
    // Lade die Audio-Datei asynchron
    if (currentItem) {
      getAudioUrl(audioFile, provider, currentItem.id).then(url => {
        if (url) {
          const placeholder = document.getElementById(placeholderId);
          if (placeholder) {
            placeholder.innerHTML = `
              <div class="my-4">
                <div class="text-xs text-muted-foreground mb-2">${audioFile}</div>
                <audio controls class="w-full">
                  <source src="${url}" type="audio/mpeg">
                  Ihr Browser unterstützt das Audio-Element nicht.
                </audio>
              </div>`;
          }
        }
      });
    }
    
    // Gib den Platzhalter zurück
    return `<div id="${placeholderId}" class="my-4">
      <div class="text-xs text-muted-foreground">Lade Audio: ${audioFile}...</div>
    </div>`;
  });

  // Konvertiere Obsidian-Bildpfade (![[image.png]] -> ![](image.png))
  content = content.replace(/!\[\[(.*?\.(?:jpg|jpeg|png|gif|webp))\]\]/g, '![]($1)');
  
  // Formatiere zuerst die Frontmatter
  content = formatFrontmatter(content);

  // Konvertiere verschiedene YouTube-Link-Formate
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

  // Konvertiere Obsidian YouTube-Callouts
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

  // Füge Basis-URL zu relativen Bildpfaden hinzu
  if (basePath) {
    content = content.replace(
      /!\[(.*?)\]\((?!http)(.*?)\)/g,
      `![$1](${basePath}/$2)`
    );
  }

  // Konvertiere Obsidian-interne Links zu normalen Links
  content = content.replace(/\[\[(.*?)\]\]/g, '[$1]($1)');

  // Konvertiere Obsidian Callouts
  content = content.replace(
    /> \[(.*?)\](.*?)(\n|$)/g,
    '<div class="callout $1">$2</div>'
  );

  return content;
}

export function FilePreview({ item, className, provider }: FilePreviewProps) {
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item?.type === 'file' && provider) {
      loadBinary();
    }
    return () => {
      if (binaryUrl) {
        URL.revokeObjectURL(binaryUrl);
      }
    };
  }, [item, provider]);

  const loadBinary = async () => {
    if (!item || !provider) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { blob, mimeType } = await provider.getBinary(item.id);
      
      if (getFileType(item.metadata.name) === 'markdown') {
        const text = await blob.text();
        // Speichere den Rohtext, die Verarbeitung erfolgt beim Rendern
        setMarkdownContent(text);
        setBinaryUrl(null);
      } else {
        const url = URL.createObjectURL(blob);
        setBinaryUrl(url);
        setMarkdownContent(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Datei';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) {
    return (
      <div className={cn("p-6", className)}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Bitte wählen Sie eine Datei aus, um die Vorschau anzuzeigen.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-6", className)}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // TODO: Hier würden wir die Metadaten von der API abrufen
  const metadata: FileMetadata = {
    content: {
      title: item.metadata.name,
      description: "Beschreibung der Datei wird hier angezeigt...",
    },
    transcriptionStatus: 'pending',
  };

  const renderFileContent = () => {
    const fileType = getFileType(item.metadata.name);

    if (isLoading) {
      return (
        <div className="w-full h-[400px] flex items-center justify-center">
          <Skeleton className="w-full h-full" />
        </div>
      );
    }

    // Separate loading check for markdown files
    if (fileType === 'markdown' && !markdownContent) {
      return (
        <div className="flex flex-col items-center justify-center h-[200px]">
          <p className="text-sm text-muted-foreground">Markdown wird geladen...</p>
        </div>
      );
    }

    // Loading check for non-markdown files
    if (fileType !== 'markdown' && !binaryUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-[200px]">
          <p className="text-sm text-muted-foreground">Datei wird geladen...</p>
        </div>
      );
    }

    return (
      <>
        <CardHeader>
          <CardTitle>{metadata.content.title}</CardTitle>
          <p className="text-muted-foreground line-clamp-2">
            {metadata.content.description}
          </p>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6">
            {fileType === 'audio' && binaryUrl && (
              <audio controls className="w-full">
                <source src={binaryUrl as string} type="audio/mpeg" />
                Ihr Browser unterstützt das Audio-Element nicht.
              </audio>
            )}
            {fileType === 'video' && binaryUrl && (
              <video controls className="w-full max-h-[400px]">
                <source src={binaryUrl as string} type="video/mp4" />
                Ihr Browser unterstützt das Video-Element nicht.
              </video>
            )}
            {fileType === 'image' && binaryUrl && (
              <div className="relative w-full h-[400px] bg-muted rounded-md overflow-hidden">
                <Image
                  src={binaryUrl as string}
                  alt={item.metadata.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            )}
            {fileType === 'pdf' && binaryUrl && (
              <iframe 
                src={binaryUrl as string}
                className="w-full h-[400px] border-none rounded-md"
              />
            )}
            {fileType === 'text' && binaryUrl && (
              <pre className="p-4 bg-muted rounded-md overflow-auto max-h-[400px]">
                {binaryUrl}
              </pre>
            )}
            {fileType === 'markdown' && markdownContent && (
              <div className="prose dark:prose-invert max-w-none">
                {/* Render frontmatter */}
                {markdownContent.includes('---') && (
                  <div className="bg-muted/30 rounded-lg overflow-hidden mb-8">
                    <div className="px-4 py-2 bg-muted/50 border-b border-muted">
                      <div className="text-xs font-medium text-muted-foreground">Metadaten</div>
                    </div>
                    <div className="p-4">
                      <div className="grid gap-2 text-sm">
                        {markdownContent.split('---')[1]?.split('\n').map((line, index) => {
                          if (!line.trim() || line === '---') return null;
                          if (line.includes(':')) {
                            const [key, ...valueParts] = line.split(':');
                            const value = valueParts.join(':').trim();
                            
                            // Handle arrays/lists
                            if (value.includes(',') || (value.startsWith('[') && value.endsWith(']'))) {
                              const tags = value
                                .replace(/^\[|\]$/g, '') // Remove brackets if present
                                .split(',')
                                .map(tag => tag.trim())
                                .filter(Boolean);
                              
                              return (
                                <div key={index} className="grid grid-cols-[120px,1fr] gap-2">
                                  <div className="text-xs font-medium text-muted-foreground">{key.trim()}</div>
                                  <div className="flex flex-wrap gap-1">
                                    {tags.map((tag, i) => (
                                      <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            
                            // Handle single values
                            return (
                              <div key={index} className="grid grid-cols-[120px,1fr] gap-2">
                                <div className="text-xs font-medium text-muted-foreground">{key.trim()}</div>
                                <div className="text-xs text-muted-foreground">
                                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted">
                                    {value || '—'}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Render markdown content */}
                <div 
                  className="p-4"
                  dangerouslySetInnerHTML={{ 
                    __html: md.render(
                      processObsidianContent(
                        markdownContent.split('---').length > 2 
                          ? markdownContent.split('---').slice(2).join('---')
                          : markdownContent,
                        item.metadata.path?.split('/').slice(0, -1).join('/') || '',
                        provider,
                        item
                      )
                    ) 
                  }}
                />
              </div>
            )}
            {fileType === 'unknown' && (
              <div className="flex flex-col items-center justify-center h-[200px] bg-muted rounded-md">
                <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Vorschau nicht verfügbar für diesen Dateityp
                </p>
              </div>
            )}
          </div>

          {(fileType === 'audio' || fileType === 'video') && (
            <div className="mt-6 border-t pt-4">
              <h2 className="text-xl font-semibold mb-2">Transkript</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {metadata.transcriptionStatus === 'completed' 
                  ? metadata.transcription || "Transkript wird geladen..."
                  : "Transkript wird erstellt..."}
              </p>
            </div>
          )}
        </CardContent>
      </>
    );
  };

  return (
    <Card className={cn("w-full h-full overflow-auto", className)}>
      {renderFileContent()}
    </Card>
  );
} 