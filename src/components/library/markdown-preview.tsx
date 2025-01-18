import * as React from 'react';
import { Remarkable } from 'remarkable';
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { MarkdownMetadata } from './markdown-metadata';

interface MarkdownPreviewProps {
  content: string;
  currentFolderId?: string;
  provider?: StorageProvider | null;
  currentItem?: StorageItem | null;
  className?: string;
}

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
  className
}: MarkdownPreviewProps) {
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

  return (
    <div className={className}>
      <div 
        className="prose dark:prose-invert max-w-none p-4 w-full"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Return true if we should NOT update
  return (
    prevProps.content === nextProps.content &&
    prevProps.currentFolderId === nextProps.currentFolderId &&
    prevProps.provider === nextProps.provider &&
    prevProps.currentItem?.id === nextProps.currentItem?.id &&
    prevProps.className === nextProps.className
  );
}); 