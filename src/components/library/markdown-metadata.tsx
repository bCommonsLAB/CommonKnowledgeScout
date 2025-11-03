import * as React from 'react';
import { cn } from "@/lib/utils";
import { FileLogger } from "@/lib/debug/logger"
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

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

/**
 * Component for displaying markdown metadata/frontmatter
 */
/**
 * Konvertiert einen relativen Pfad (bezogen auf Library-Root) zu einer Storage-API-URL
 * Der relative Pfad wird base64-kodiert und als fileId verwendet
 * 
 * @param relativePath Relativer Pfad wie "2024 SFSCON/assets/ansible/preview_001.jpg"
 * @param libraryId Die Library-ID
 * @returns Storage-API-URL oder undefined falls libraryId fehlt
 */
function resolveImageUrl(relativePath: string | undefined, libraryId: string | undefined): string | undefined {
  if (!relativePath || !libraryId) {
    return relativePath; // Fallback: ursprüngliche URL verwenden
  }

  // Prüfe ob es bereits eine absolute URL ist (http/https)
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }

  // Normalisiere den Pfad (entferne führende/trailing Slashes)
  const normalizedPath = relativePath.replace(/^\/+|\/+$/g, '');

  // Prüfe auf Path-Traversal-Versuche
  if (normalizedPath.includes('..')) {
    console.warn('[MarkdownMetadata] Path traversal detected, ignoring:', normalizedPath);
    return relativePath; // Fallback: ursprüngliche URL verwenden
  }

  // Konvertiere relativen Pfad zu base64-kodierter fileId
  // Browser-kompatible base64-Kodierung für UTF-8-Strings
  try {
    // Konvertiere UTF-8-String zu Uint8Array und dann zu base64
    const utf8Bytes = new TextEncoder().encode(normalizedPath);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const fileId = btoa(binary);
    
    // Baue Storage-API-URL
    return `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(fileId)}&libraryId=${encodeURIComponent(libraryId)}`;
  } catch (error) {
    console.error('[MarkdownMetadata] Fehler beim Konvertieren des Bildpfads:', error);
    return relativePath; // Fallback: ursprüngliche URL verwenden
  }
}

export const MarkdownMetadata = React.memo(function MarkdownMetadata({
  content,
  className,
  libraryId
}: MarkdownMetadataProps) {
  function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  /**
   * Kürzt einen String auf eine maximale Länge
   */
  function truncate(value: string, max = 160): string {
    return value.length > max ? `${value.slice(0, max)}…` : value
  }

  /**
   * Konvertiert einen Wert in einen String für die Anzeige
   */
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

  /**
   * Bestimmt den Datentyp einer Zelle für bessere Formatierung
   */
  function getCellType(value: unknown): 'empty' | 'number' | 'boolean' | 'url' | 'image' | 'text' {
    if (value === null || value === undefined || value === '') return 'empty'
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'string') {
      // Prüfe auf URL (http/https)
      if (value.startsWith('http://') || value.startsWith('https://')) return 'url'
      // Prüfe auf Bild-URL (endet mit Bild-Extension)
      if (/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(value)) return 'image'
      return 'text'
    }
    return 'text'
  }

  /**
   * Ermittelt dynamisch alle Spalten eines Objekt-Arrays und sortiert sie intelligent
   * - Spalten mit numerischen Namen (z.B. page_num, page) kommen zuerst
   * - Spalten mit häufigen Namen (title, name, summary, etc.) kommen vor seltenen
   * - Ansonsten alphabetisch
   */
  function extractAndSortColumns(objects: Record<string, unknown>[]): string[] {
    const keySet = new Set<string>()
    const keyFrequency = new Map<string, number>()

    // Sammle alle Keys und deren Häufigkeit
    for (const obj of objects) {
      for (const key of Object.keys(obj)) {
        keySet.add(key)
        keyFrequency.set(key, (keyFrequency.get(key) || 0) + 1)
      }
    }

    const keys = Array.from(keySet)

    // Sortiere dynamisch basierend auf:
    // 1. Namen mit numerischen Begriffen (page_num, page, index, id, etc.) zuerst
    // 2. Häufige, semantisch wichtige Namen (title, name, summary, description, etc.)
    // 3. Alphabetisch
    const numericPattern = /^(page|num|index|id|order|rank|position|seq)/i
    const semanticPattern = /^(title|name|label|summary|description|text|content|value|url|image|link|source|target|key|type|status|state|category|tag)/i

    keys.sort((a, b) => {
      const aHasNumeric = numericPattern.test(a)
      const bHasNumeric = numericPattern.test(b)
      const aHasSemantic = semanticPattern.test(a)
      const bHasSemantic = semanticPattern.test(b)
      const aFreq = keyFrequency.get(a) || 0
      const bFreq = keyFrequency.get(b) || 0

      // Numerische Keys zuerst
      if (aHasNumeric && !bHasNumeric) return -1
      if (!aHasNumeric && bHasNumeric) return 1

      // Dann semantische Keys
      if (aHasSemantic && !bHasSemantic) return -1
      if (!aHasSemantic && bHasSemantic) return 1

      // Dann nach Häufigkeit (häufigere zuerst)
      if (aFreq !== bFreq) return bFreq - aFreq

      // Zuletzt alphabetisch
      return a.localeCompare(b)
    })

    return keys
  }

  /**
   * Versucht einen Wert als JSON-Array zu parsen, falls er ein String ist
   */
  function tryParseJsonArray(value: unknown): unknown {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
          return JSON.parse(trimmed)
        } catch {
          // Nicht parsen, falls Fehler
        }
      }
    }
    return value
  }

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
                                              <img
                                                src={resolvedUrl}
                                                alt={cellString}
                                                className="h-12 w-auto max-w-[12rem] object-cover rounded border border-muted-foreground/20"
                                                onError={(e) => {
                                                  // Fallback: Zeige Text, wenn Bild nicht geladen werden kann
                                                  const target = e.target as HTMLImageElement;
                                                  target.style.display = 'none';
                                                  const fallback = target.nextSibling as HTMLElement;
                                                  if (fallback) fallback.style.display = 'block';
                                                }}
                                              />
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