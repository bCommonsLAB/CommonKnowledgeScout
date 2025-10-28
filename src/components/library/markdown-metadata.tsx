import * as React from 'react';
import { cn } from "@/lib/utils";
import { FileLogger } from "@/lib/debug/logger"
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

interface MarkdownMetadataProps {
  content: string;
  className?: string;
}

/**
 * Extrahiert Frontmatter (strikt) via parseFrontmatter und gibt Meta zurück.
 * Arrays/Objekte werden korrekt aus JSON gelesen (chapters, toc, ...).
 */
export function extractFrontmatter(content: string): Record<string, unknown> | null {
  const { meta } = parseFrontmatter(content);
  if (!meta || Object.keys(meta).length === 0) {
    FileLogger.debug('MarkdownMetadata', 'No frontmatter found');
    return null;
  }
  FileLogger.debug('MarkdownMetadata', 'Extracted frontmatter', { keys: Object.keys(meta) });
  return meta;
}

/**
 * Component for displaying markdown metadata/frontmatter
 */
export const MarkdownMetadata = React.memo(function MarkdownMetadata({
  content,
  className
}: MarkdownMetadataProps) {
  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  function truncate(value: string, max = 160): string {
    return value.length > max ? `${value.slice(0, max)}…` : value
  }

  function toDisplayString(value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  const frontmatter = React.useMemo(() => extractFrontmatter(content), [content]);
  const metadata = React.useMemo(() => frontmatter, [frontmatter]);

  FileLogger.debug('MarkdownMetadata', 'Analyzing content', {
    contentLength: content.length,
    hasFrontmatter: !!frontmatter,
    frontmatterKeys: frontmatter ? Object.keys(frontmatter) : []
  });

  FileLogger.debug('MarkdownMetadata', 'Metadata', metadata || undefined);

  if (!metadata) return null;

  return (
    <div className={cn("bg-muted/30 rounded-lg overflow-hidden mb-8", className)}>
      <div className="p-4">
        <table className="w-full border-collapse">
          <tbody>
            {Object.entries(metadata).map(([key, value]) => {
              // Special handling for tags
              if (key.toLowerCase() === 'tags' && Array.isArray(value)) {
                return (
                  <tr key={key} className="border-t border-muted">
                    <td className="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {key}
                    </td>
                    <td className="py-2 text-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {value.map((tag: string) => (
                          <span 
                            key={tag}
                            className="bg-primary/10 text-primary px-2 py-1 rounded-full font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              }

              // Handle arrays (primitive vs. Objekt-Array)
              if (Array.isArray(value)) {
                const hasObjects = value.some(v => isPlainObject(v))
                if (!hasObjects) {
                  const items = value.map(v => toDisplayString(v))
                  return (
                    <tr key={key} className="border-t border-muted">
                      <td className="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">
                        {key}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          {items.map((text, idx) => (
                            <span
                              key={`${key}-${idx}-${text}`}
                              className="bg-muted/50 px-1.5 py-0.5 rounded"
                            >
                              {text}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                }
                // Objekt-Arrays tabellarisch darstellen (z. B. slides)
                const objects = value.filter(v => isPlainObject(v)) as Record<string, unknown>[]
                // Schlüssel priorisieren
                const preferred = ['page_num', 'page', 'title', 'summary', 'image_url', 'url', 'speaker', 'time']
                const keySet = new Set<string>()
                for (const k of preferred) keySet.add(k)
                for (const obj of objects) for (const k of Object.keys(obj)) keySet.add(k)
                const cols = Array.from(keySet)
                return (
                  <tr key={key} className="border-t border-muted">
                    <td className="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {key}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      <div className="rounded-md border border-muted-foreground/20 overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              {cols.map(col => (
                                <th key={`${key}-h-${col}`} className="text-left px-2 py-1 font-medium text-muted-foreground whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {objects.map((obj, r) => (
                              <tr key={`${key}-r-${r}`} className="border-t border-muted/40">
                                {cols.map(col => {
                                  const cell = toDisplayString((obj as Record<string, unknown>)[col])
                                  return (
                                    <td key={`${key}-r-${r}-c-${col}`} className="px-2 py-1 align-top">
                                      <span className="bg-muted/30 px-1 py-0.5 rounded inline-block max-w-[28rem] truncate" title={cell}>{truncate(cell)}</span>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )
              }

              // Regular values
              return (
                <tr key={key} className="border-t border-muted">
                  <td className="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {key}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    <span className="bg-muted/50 px-1.5 py-0.5 rounded">
                      {typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value) || '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}); 