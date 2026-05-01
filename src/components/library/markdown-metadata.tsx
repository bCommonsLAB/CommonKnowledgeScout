import * as React from 'react';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { FileLogger } from "@/lib/debug/logger"
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
// Pure Helpers wurden in src/components/library/markdown-metadata/cell-utils.ts
// ausgegliedert (Welle 3-II-b, Schritt 6/8).
import {
  isPlainObject,
  truncate,
  toDisplayString,
  getCellType,
  extractAndSortColumns,
  tryParseJsonArray,
  resolveImageUrl,
} from './markdown-metadata/cell-utils'

interface MarkdownMetadataProps {
  content: string;
  className?: string;
  libraryId?: string; // Optional: für Auflösung relativer Bildpfade
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

export const MarkdownMetadata = React.memo(function MarkdownMetadata({
  content,
  className,
  libraryId
}: MarkdownMetadataProps) {

  const frontmatter = React.useMemo(() => extractFrontmatter(content), [content]);
  // Versuche String-Werte die JSON-Arrays enthalten zu parsen (Fallback)
  const metadata = React.useMemo(() => {
    if (!frontmatter) return null
    const parsed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(frontmatter)) {
      parsed[key] = tryParseJsonArray(value)
    }
    return parsed
  }, [frontmatter]);

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
                FileLogger.debug('MarkdownMetadata', `Array gefunden: "${key}"`, {
                  arrayLength: value.length,
                  firstItem: value[0],
                  firstItemType: typeof value[0],
                  isFirstItemObject: value[0] && typeof value[0] === 'object' && !Array.isArray(value[0])
                })
                const hasObjects = value.some(v => isPlainObject(v))
                FileLogger.debug('MarkdownMetadata', `Array "${key}" - hasObjects: ${hasObjects}`, {
                  hasObjects
                })
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
                // Objekt-Arrays tabellarisch darstellen (z. B. slides, chapters, etc.)
                const objects = value.filter(v => isPlainObject(v)) as Record<string, unknown>[]
                
                // Dynamisch alle Spalten extrahieren und intelligent sortieren
                const cols = extractAndSortColumns(objects)
                
                // Debug: Logge die erkannten Spalten für Diagnose
                FileLogger.debug('MarkdownMetadata', `Objekt-Array "${key}" erkannt`, {
                  objectCount: objects.length,
                  columns: cols,
                  firstObjectKeys: objects[0] ? Object.keys(objects[0]) : []
                })
                
                if (cols.length === 0) {
                  // Fallback: Keine Spalten gefunden
                  return (
                    <tr key={key} className="border-t border-muted">
                      <td className="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">
                        {key}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        <span className="bg-muted/50 px-1.5 py-0.5 rounded italic">
                          Leeres Array
                        </span>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={key} className="border-t border-muted">
                    <td className="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {key}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      <div className="rounded-md border border-muted-foreground/20 overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-muted/40 sticky top-0">
                            <tr>
                              {cols.map(col => (
                                <th 
                                  key={`${key}-h-${col}`} 
                                  className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap border-r border-muted/40 last:border-r-0"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {objects.map((obj, r) => (
                              <tr 
                                key={`${key}-r-${r}`} 
                                className="border-t border-muted/40 hover:bg-muted/20 transition-colors"
                              >
                                {cols.map(col => {
                                  const cellValue = (obj as Record<string, unknown>)[col]
                                  const cellType = getCellType(cellValue)
                                  const cellString = toDisplayString(cellValue)
                                  const isEmpty = cellType === 'empty'

                                  return (
                                    <td 
                                      key={`${key}-r-${r}-c-${col}`} 
                                      className="px-3 py-2 align-top border-r border-muted/40 last:border-r-0"
                                    >
                                      {isEmpty ? (
                                        <span className="text-muted-foreground/50 italic text-[10px]">—</span>
                                      ) : cellType === 'url' ? (
                                        <a 
                                          href={cellString} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline break-all max-w-[20rem] block"
                                          title={cellString}
                                        >
                                          {truncate(cellString, 40)}
                                        </a>
                                      ) : cellType === 'image' ? (
                                        // Für image_url Spalten: Bild als Thumbnail anzeigen
                                        (() => {
                                          const resolvedUrl = resolveImageUrl(cellString, libraryId);
                                          return resolvedUrl ? (
                                            <div className="flex items-center gap-2">
                                              <div className="relative h-12 w-auto max-w-[12rem]">
                                                <Image
                                                  src={resolvedUrl}
                                                  alt={cellString}
                                                  width={192}
                                                  height={48}
                                                  className="h-12 w-auto max-w-[12rem] object-cover rounded border border-muted-foreground/20"
                                                  onError={(e) => {
                                                    // Fallback: Zeige Text, wenn Bild nicht geladen werden kann
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                    const fallback = target.nextSibling as HTMLElement;
                                                    if (fallback) fallback.style.display = 'block';
                                                  }}
                                                />
                                              </div>
                                              <span className="text-primary/80 break-all max-w-[20rem] block font-medium hidden text-xs" title={cellString}>
                                                🖼️ {truncate(cellString.split('/').pop() || cellString, 30)}
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="text-primary/80 break-all max-w-[20rem] block font-medium text-xs" title={cellString}>
                                              🖼️ {truncate(cellString.split('/').pop() || cellString, 30)}
                                            </span>
                                          );
                                        })()
                                      ) : cellType === 'boolean' ? (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          cellValue ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-500/20 text-red-700 dark:text-red-400'
                                        }`}>
                                          {cellValue ? '✓' : '✗'}
                                        </span>
                                      ) : cellType === 'number' ? (
                                        <span className="font-mono text-muted-foreground/90">
                                          {cellString}
                                        </span>
                                      ) : (
                                        <span 
                                          className="bg-muted/30 px-1.5 py-0.5 rounded break-words max-w-[28rem] block" 
                                          title={cellString.length > 160 ? cellString : undefined}
                                        >
                                          {truncate(cellString, 160)}
                                        </span>
                                      )}
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