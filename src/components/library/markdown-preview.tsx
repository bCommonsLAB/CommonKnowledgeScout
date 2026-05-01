import * as React from 'react';
// Remarkable, linkify, hljs und hljs-CSS wurden in
// src/components/library/markdown-preview/md-renderer.ts ausgegliedert
// (Welle 3-II-b, Schritt 3/8).
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { Button } from '@/components/ui/button';
// Search/ChevronDown/ChevronUp wurden mit SearchPopover ausgegliedert
// (Welle 3-II-b, Schritt 4/8).
import { Wand2, Maximize2, X as CloseIcon, Copy, Check, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
// SearchPopover wurde in src/components/library/markdown-preview/search-popover.tsx
// ausgegliedert (Welle 3-II-b, Schritt 4/8).
import { SearchPopover } from './markdown-preview/search-popover'
import { SUPPORTED_LANGUAGES } from "@/lib/secretary/constants";
import { stripAllFrontmatter, parseFrontmatter } from '@/lib/markdown/frontmatter'
import {
  injectMongoTranscriptCheckLinks,
  replaceCompositePdfImageWikilinksWithPlaceholders,
  replaceCompositeSourceWikilinksWithLinks,
} from '@/lib/markdown/composite-wiki-preview'
import { replaceCompositeMultiPreviewBlock } from '@/lib/markdown/composite-multi-preview'
import { replacePlaceholdersInMarkdown } from '@/lib/markdown/placeholder-replacement'
import { buildArtifactName, extractBaseName, parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

// injectPageAnchors, getYouTubeId, resolveImageUrl,
// encodeSpacesInRelativeMarkdownHrefs und processObsidianContent wurden
// in src/components/library/markdown-preview/markdown-helpers.ts
// ausgegliedert (Welle 3-II-b, Schritt 2/8).
import {
  injectPageAnchors,
  resolveImageUrl,
  processObsidianContent,
} from './markdown-preview/markdown-helpers'

/** Optionen für Wikilink-/Fragment-Vorschau bei Sammeltranskripten (`kind: composite-transcript`). */
export interface CompositeWikiPreviewOptions {
  libraryId: string
  parentFolderId: string
  /** Dateiname → Storage-`fileId` (Geschwister im Ordner der Composite-Datei) */
  siblingNameToId: Record<string, string>
  /** true: injizierte „Transkript prüfen“-Links (Mongo-only), wenn im Markdown keine FS-Zeile steht */
  injectMongoTranscriptLinks: boolean
  onNavigateToFile: (fileId: string, options?: { openTranscriptTab?: boolean }) => void | Promise<void>
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
  /** Callback für Bearbeiten-Button - wenn gesetzt, wird der Bearbeiten-Button angezeigt */
  onEdit?: () => void;
  /** Sammeltranskript: Wikilinks auflösen, PDF-Fragmente als Bilder, Navigation zu Quellen */
  compositeWikiPreview?: CompositeWikiPreviewOptions | null;
}

// TextTransform-Komponente wurde in
// src/components/library/markdown-preview/text-transform.tsx
// ausgegliedert (Welle 3-II-b, Schritt 5/8).
import { TextTransform } from './markdown-preview/text-transform'


// Markdown-Renderer (Remarkable + highlight.js + Tailwind-Renderer-Rules)
// wurde in src/components/library/markdown-preview/md-renderer.ts
// ausgegliedert (Welle 3-II-b, Schritt 3/8).
import { md } from './markdown-preview/md-renderer'



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
  compact = false,
  onEdit,
  compositeWikiPreview = null,
}: MarkdownPreviewProps) {
  const currentItem = useAtomValue(selectedFileAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [activeTab, setActiveTab] = React.useState<string>("preview");
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  // Merkt sich die letzte Zielposition der Suche, um Scroll-Resets abzufangen
  const lastSearchScrollRef = React.useRef<{ top: number; timestamp: number } | null>(null);
  // Merkt sich die aktuelle Suchposition, um vor/zurueck navigieren zu koennen
  const searchStateRef = React.useRef<{ query: string; index: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  // State für Kopieren-Feedback
  const [isCopied, setIsCopied] = React.useState<boolean>(false);
  
  // Kopiert den Markdown-Inhalt in die Zwischenablage
  const handleCopyMarkdown = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast.success('Markdown in Zwischenablage kopiert');
      // Nach 2 Sekunden Icon zurücksetzen
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  }, [content]);
  
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

    // Frontmatter VOR dem Strippen lesen, damit wir den `kind`-Wert kennen
    // (zum Aktivieren des Composite-Multi-Vorschau-Grids).
    const { meta: frontmatterMeta } = parseFrontmatter(content);
    const isCompositeMulti = frontmatterMeta?.kind === 'composite-multi';

    // Entferne Frontmatter robust
    let mainContent = stripAllFrontmatter(content);

    // Composite-Multi: Vorschau-Block (Obsidian-Embeds) durch ein Bild-Grid
    // mit Platzhalter-<img>-Tags ersetzen. Der eigentliche src-Wert wird
    // im useEffect weiter unten asynchron gesetzt (anhand siblingNameToId).
    if (isCompositeMulti) {
      mainContent = replaceCompositeMultiPreviewBlock(mainContent);
    }

    // Mongo-only-Sammeltranskript: fehlende „Transkript prüfen“-Zeilen ergänzen (gleiches Erscheinungsbild wie Wikilink).
    if (compositeWikiPreview?.injectMongoTranscriptLinks) {
      mainContent = injectMongoTranscriptCheckLinks(mainContent);
    }

    // Seite‑Marker als Anker einfügen, z. B. "— Seite 12 —" → <div data-page-marker="12"></div>
    mainContent = injectPageAnchors(mainContent);

    // Composite: Wikilink-Transformationen (Reihenfolge wichtig!).
    // 1. PDF-Fragmente (`[[doc.pdf#frag.png]]`) → <img>-Platzhalter (eigener Helper).
    // 2. Reine Datei-Wikilinks (`[[name.ext]]`) → klickbare <a>-Tags.
    //    Reihenfolge: Fragmente zuerst, weil deren Pattern strenger ist und der
    //    Source-Helper sonst potenziell Teile davon konsumieren wuerde.
    if (compositeWikiPreview) {
      mainContent = replaceCompositePdfImageWikilinksWithPlaceholders(mainContent);
      mainContent = replaceCompositeSourceWikilinksWithLinks(mainContent);
    }

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
  }, [content, currentFolderId, provider, activeLibraryId, compositeWikiPreview]);
  
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

  // Composite: PDF-Fragment-<img>-Platzhalter → echte URLs (nach DOM-Update)
  React.useEffect(() => {
    const root = contentRef.current;
    if (!root || !compositeWikiPreview || !activeLibraryId) return;

    const imgs = root.querySelectorAll<HTMLImageElement>(
      'img.ks-wikilink-fragment[data-wikilink-source][data-wikilink-fragment]'
    );

    imgs.forEach((img) => {
      if (img.getAttribute('data-ks-resolved') === '1') return;
      const sourceName = img.getAttribute('data-wikilink-source');
      const frag = img.getAttribute('data-wikilink-fragment');
      if (!sourceName || !frag) return;
      const sourceId = compositeWikiPreview.siblingNameToId[sourceName];
      if (!sourceId) return;

      void (async () => {
        try {
          const res = await fetch(
            `/api/library/${encodeURIComponent(activeLibraryId)}/shadow-twins/resolve-binary-url`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceId,
                sourceName,
                parentId: compositeWikiPreview.parentFolderId,
                fragmentName: frag,
              }),
            }
          );
          if (!res.ok) return;
          const data = (await res.json()) as { resolvedUrl?: string };
          if (!data.resolvedUrl || !root.contains(img)) return;
          img.src = data.resolvedUrl;
          img.setAttribute('loading', 'lazy');
          img.setAttribute('data-ks-resolved', '1');
        } catch {
          // Vorschau darf bei Netzwerkfehlern nicht abbrechen
        }
      })();
    });
  }, [renderedContent, compositeWikiPreview, activeLibraryId]);

  // Composite-Multi: Platzhalter-<img>-Tags mit echten Streaming-URLs befuellen.
  // Quelle ist `siblingNameToId` aus dem composite-transcript-Pfad — wir nutzen
  // genau dieselbe Map, weil composite-multi-Quellen ebenfalls Geschwister
  // im selben Verzeichnis sind.
  //
  // Bugfix 2026-04-28: Frueher wurde hier eine hand-gebaute URL auf
  // `/api/storage/streaming-url?...` gesetzt. Diese Route geht durch die
  // `media-storage-strategy` und liefert bei `mode: 'azure-only'` ein 404,
  // wenn das Bild nicht als `binaryFragment` in MongoDB registriert ist —
  // selbst dann, wenn die Datei im Storage-Provider direkt verfuegbar waere.
  // Beweis: `image-preview.tsx` (Direkt-Preview einer .jpeg-Datei) nutzt
  // `provider.getStreamingUrl(item.id)` und funktioniert bei derselben Library.
  // Wir uebernehmen exakt dasselbe Muster, damit der Composite-Multi-Vorschau-
  // Pfad konsistent zum direkten Bild-Preview ist.
  React.useEffect(() => {
    const root = contentRef.current;
    if (!root || !compositeWikiPreview || !activeLibraryId) return;

    const imgs = root.querySelectorAll<HTMLImageElement>(
      'img.ks-composite-multi-image[data-composite-multi-source]'
    );

    imgs.forEach((img) => {
      if (img.getAttribute('data-ks-resolved') === '1') return;
      const sourceName = img.getAttribute('data-composite-multi-source');
      if (!sourceName) return;
      const fileId = compositeWikiPreview.siblingNameToId[sourceName];
      if (!fileId) return;

      // Sofort als "in Bearbeitung" markieren, damit ein erneuter useEffect-
      // Lauf (z.B. wegen Re-Render) nicht parallel denselben Provider-Call
      // anstoesst. Identisches Verhalten zum Vorgaenger-Code.
      img.setAttribute('data-ks-resolved', '1');
      img.setAttribute('loading', 'lazy');

      if (provider) {
        // Bevorzugter Pfad: direkter Provider-Aufruf wie in `image-preview.tsx`.
        // Der Provider-Pfad umgeht die strikte `azure-only`-Strategy und
        // liefert die Storage-URL (z.B. `/api/storage/filesystem?action=binary&...`)
        // direkt zurueck.
        void provider
          .getStreamingUrl(fileId)
          .then((url) => {
            if (url) img.src = url;
          })
          .catch((error) => {
            FileLogger.warn(
              'MarkdownPreview',
              'Composite-Multi: Streaming-URL fehlgeschlagen',
              {
                sourceName,
                fileId,
                error: error instanceof Error ? error.message : String(error),
              },
            );
          });
        return;
      }

      // Fallback: Strategy-Route (nur wenn kein Provider injiziert wurde).
      // Dieser Pfad ist der historisch einzige und greift jetzt nur noch in
      // sehr eingeschraenkten Konstellationen (z.B. read-only-Renderings ohne
      // aktiven Storage-Context).
      img.src =
        `/api/storage/streaming-url` +
        `?libraryId=${encodeURIComponent(activeLibraryId)}` +
        `&fileId=${encodeURIComponent(fileId)}`;
    });
  }, [renderedContent, compositeWikiPreview, activeLibraryId, provider]);

  // Composite: Klicks auf interne Dateilinks und injizierte „Transkript prüfen“-Links
  React.useEffect(() => {
    const root = contentRef.current;
    if (!root || !compositeWikiPreview) return;

    const handler = (ev: MouseEvent) => {
      const el = ev.target as HTMLElement | null;
      if (!el) return;
      const a = el.closest('a');
      if (!a || !root.contains(a)) return;

      if (a.classList.contains('ks-composite-transcript-check')) {
        ev.preventDefault();
        const name = a.getAttribute('data-ks-source-name');
        if (!name) return;
        const fid = compositeWikiPreview.siblingNameToId[name];
        if (fid) void compositeWikiPreview.onNavigateToFile(fid, { openTranscriptTab: true });
        return;
      }

      const href = a.getAttribute('href');
      if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('#')) {
        return;
      }

      const base = href.split('/').pop() || href;
      let decoded = base;
      try {
        decoded = decodeURIComponent(base);
      } catch {
        /* ignore */
      }
      const fid =
        compositeWikiPreview.siblingNameToId[decoded] ||
        compositeWikiPreview.siblingNameToId[base] ||
        compositeWikiPreview.siblingNameToId[href];

      if (fid) {
        ev.preventDefault();
        void compositeWikiPreview.onNavigateToFile(fid, {});
      }
    };

    root.addEventListener('click', handler);
    return () => root.removeEventListener('click', handler);
  }, [compositeWikiPreview, renderedContent]);

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

  const ensureScrollPosition = React.useCallback((top: number) => {
    const root = containerRef.current;
    if (!root) return;
    // Direkt setzen, um "zurueckspringen" durch spaetere Reflows zu verhindern
    lastSearchScrollRef.current = { top, timestamp: Date.now() };
    root.scrollTop = top;
    // Zwei kurze Nachkorrekturen fuer spaete Reflows/State-Updates
    requestAnimationFrame(() => {
      const currentRoot = containerRef.current;
      if (!currentRoot) return;
      if (Math.abs(currentRoot.scrollTop - top) > 2) currentRoot.scrollTop = top;
    });
    setTimeout(() => {
      const currentRoot = containerRef.current;
      if (!currentRoot) return;
      if (Math.abs(currentRoot.scrollTop - top) > 2) currentRoot.scrollTop = top;
    }, 120);
  }, []);

  const scrollContainerTo = React.useCallback((el: HTMLElement) => {
    const root = containerRef.current;
    if (!root) return;
    // Verwende requestAnimationFrame, um sicherzustellen, dass das DOM vollständig aktualisiert ist
    requestAnimationFrame(() => {
      // Nochmal prüfen, ob das Element noch existiert
      if (!root.contains(el)) return;
      const top = el.offsetTop - 16;
      // Stabiler als smooth scroll, weil smooth durch Re-Renders leicht abgebrochen wird
      ensureScrollPosition(top);
    });
  }, [ensureScrollPosition]);

  const scrollToPage = React.useCallback((n: number | string) => {
    const el = contentRef.current?.querySelector(`[data-page-marker="${String(n)}"]`) as HTMLElement | null;
    if (el) scrollContainerTo(el);
  }, [scrollContainerTo]);

  const findMatches = React.useCallback((q: string) => {
    const root = contentRef.current;
    if (!root || !q) return [];
    // Alte Markierung entfernen, bevor wir neue Treffer berechnen
    removeOldHit();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const lower = q.toLowerCase();
    const matches: Array<{ node: Node; idx: number; length: number }> = [];
    let node: Node | null = walker.nextNode();
    while (node) {
      const text = (node.textContent || '').toLowerCase();
      if (!text) {
        node = walker.nextNode();
        continue;
      }
      let idx = text.indexOf(lower);
      while (idx >= 0) {
        matches.push({ node, idx, length: q.length });
        idx = text.indexOf(lower, idx + lower.length);
      }
      node = walker.nextNode();
    }
    return matches;
  }, [removeOldHit]);

  const highlightMatchAtIndex = React.useCallback((q: string, targetIndex: number) => {
    const root = contentRef.current;
    if (!root || !q) return;
    const matches = findMatches(q);
    if (matches.length === 0) return;
    const normalizedIndex = ((targetIndex % matches.length) + matches.length) % matches.length;
    const match = matches[normalizedIndex];
    // Suche speichern, damit Vor/Zurueck funktioniert
    searchStateRef.current = { query: q, index: normalizedIndex };

    const node = match.node;
    if (!node.parentNode || !node.parentNode.contains(node)) return;

    const orig = node.textContent || '';
    const before = orig.slice(0, match.idx);
    const hit = orig.slice(match.idx, match.idx + match.length);
    const after = orig.slice(match.idx + match.length);
    const span = document.createElement('span');
    span.setAttribute('data-search-hit', '1');
    span.className = 'bg-yellow-200 dark:bg-yellow-600/40 rounded px-0.5';
    span.textContent = hit;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));

    try {
      if (node.parentNode && node.parentNode.contains(node)) {
        node.parentNode.replaceChild(frag, node);
        // Scroll mit kurzer Verzoegerung, damit DOM und Layout stabil sind
        setTimeout(() => {
          if (root.contains(span)) scrollContainerTo(span);
        }, 50);
      }
    } catch (error) {
      FileLogger.debug('MarkdownPreview', 'replaceChild in highlightMatchAtIndex fehlgeschlagen', { error });
    }
  }, [findMatches, scrollContainerTo]);

  const scrollToText = React.useCallback((q: string) => {
    // Startet immer beim ersten Treffer
    highlightMatchAtIndex(q, 0);
  }, [highlightMatchAtIndex]);

  const scrollToNextMatch = React.useCallback((q: string) => {
    const state = searchStateRef.current;
    const startIndex = state && state.query === q ? state.index + 1 : 0;
    highlightMatchAtIndex(q, startIndex);
  }, [highlightMatchAtIndex]);

  const scrollToPrevMatch = React.useCallback((q: string) => {
    const state = searchStateRef.current;
    const startIndex = state && state.query === q ? state.index - 1 : -1;
    highlightMatchAtIndex(q, startIndex);
  }, [highlightMatchAtIndex]);

  const setQueryAndSearch = React.useCallback((q: string) => { scrollToText(q); }, [scrollToText]);

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
          {/* Fixierte Icon-Leiste rechts oben, bleibt beim Scrollen sichtbar */}
          <div className="sticky top-2 z-20 flex justify-end px-2 pointer-events-none">
            <div className="hidden md:flex flex-row gap-2 pointer-events-auto">
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
              {onEdit && (
                <button
                  type="button"
                  aria-label="Bearbeiten"
                  title="Bearbeiten"
                  onClick={onEdit}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                aria-label="Markdown kopieren"
                title="Markdown kopieren"
                onClick={handleCopyMarkdown}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
              >
                {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                aria-label="Vollbild"
                title="Vollbild"
                onClick={() => setIsFullscreen(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <SearchPopover onSearchFirst={scrollToText} onSearchNext={scrollToNextMatch} onSearchPrev={scrollToPrevMatch} />
            </div>
          </div>
          <div 
            ref={!isFullscreen ? contentRef : undefined}
            className={cn(
              "prose dark:prose-invert max-w-none w-full overflow-x-hidden [&>*]:max-w-full [&>*]:overflow-x-hidden",
              compact ? "p-1 pt-0 [&>*:first-child]:!mt-0" : "p-4 [&>*:first-child]:!mt-0",
              compositeWikiPreview &&
                "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:rounded-md [&_h3]:border-l-4 [&_h3]:border-primary/35 [&_h3]:bg-muted/45 [&_h3]:pl-3 [&_h3]:py-2 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:my-1"
            )}
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        </TabsContent>
        {isFullscreen && (
          <div className="fixed inset-0 z-[100] bg-background">
            <div className="h-full overflow-auto relative" data-markdown-scroll-root="true" ref={containerRef}>
              <div className="sticky top-2 z-20 flex justify-end px-2 pointer-events-none">
                <div className="hidden md:flex flex-row gap-2 pointer-events-auto">
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
                  {onEdit && (
                    <button
                      type="button"
                      aria-label="Bearbeiten"
                      title="Bearbeiten"
                      onClick={() => {
                        setIsFullscreen(false)
                        onEdit()
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Markdown kopieren"
                    title="Markdown kopieren"
                    onClick={handleCopyMarkdown}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
                  >
                    {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Vollbild beenden"
                    title="Vollbild beenden"
                    onClick={() => setIsFullscreen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background/80 hover:bg-muted text-muted-foreground"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                  <SearchPopover onSearchFirst={scrollToText} onSearchNext={scrollToNextMatch} onSearchPrev={scrollToPrevMatch} />
                </div>
              </div>
              <div 
                ref={contentRef}
                className={cn(
                  "prose dark:prose-invert max-w-none w-full overflow-x-hidden [&>*]:max-w-full [&>*]:overflow-x-hidden",
                  compact ? "p-1 pt-0 [&>*:first-child]:!mt-0" : "p-4 [&>*:first-child]:!mt-0",
                  compositeWikiPreview &&
                    "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:rounded-md [&_h3]:border-l-4 [&_h3]:border-primary/35 [&_h3]:bg-muted/45 [&_h3]:pl-3 [&_h3]:py-2 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:my-1"
                )}
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
    prevProps.onRefreshFolder === nextProps.onRefreshFolder &&
    prevProps.compositeWikiPreview === nextProps.compositeWikiPreview &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.compact === nextProps.compact
  );
}); 