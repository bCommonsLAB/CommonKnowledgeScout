import * as React from 'react';
import { cn } from "@/lib/utils";
import { FileLogger } from "@/lib/debug/logger"

interface MarkdownMetadataProps {
  content: string;
  className?: string;
}

/**
 * Extracts and formats YAML frontmatter from markdown content
 */
export function extractFrontmatter(content: string): Record<string, unknown> | null {
  // Match frontmatter with or without newlines after the dashes
  const frontmatterMatch = content.match(/^---\s*([\s\S]*?)\s*---/);
  if (!frontmatterMatch) {
    FileLogger.debug('MarkdownMetadata', 'No frontmatter match found');
    return null;
  }

  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterMatch[1].split('\n');

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && trimmedLine.includes(':')) {
      const [key, ...valueParts] = trimmedLine.split(':');
      let value = valueParts.join(':').trim();
      
      // Remove surrounding quotes
      value = value.replace(/^["'](.*)["']$/, '$1');
      
      // Special handling for arrays in square brackets
      if (value.startsWith('[') && value.endsWith(']')) {
        const cleanValue = value.slice(1, -1);
        frontmatter[key.trim()] = cleanValue
          .split(',')
          .map(item => item.trim().replace(/^["'](.*)["']$/, '$1'))
          .filter(Boolean);
      }
      // Handle comma-separated values without brackets
      else if (value.includes(',')) {
        frontmatter[key.trim()] = value
          .split(',')
          .map(item => item.trim().replace(/^["'](.*)["']$/, '$1'))
          .filter(Boolean);
      }
      // Handle empty values
      else if (!value) {
        frontmatter[key.trim()] = null;
      }
      // Handle regular values
      else {
        frontmatter[key.trim()] = value;
      }
    }
  });

  FileLogger.debug('MarkdownMetadata', 'Extracted frontmatter', { frontmatter });
  return frontmatter;
}

/**
 * Component for displaying markdown metadata/frontmatter
 */
export const MarkdownMetadata = React.memo(function MarkdownMetadata({
  content,
  className
}: MarkdownMetadataProps) {
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

              // Handle arrays
              if (Array.isArray(value)) {
                return (
                  <tr key={key} className="border-t border-muted">
                    <td className="py-2 pr-4 align-top text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {key}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      <div className="flex flex-wrap gap-1">
                        {value.map((item: string) => (
                          <span 
                            key={item}
                            className="bg-muted/50 px-1.5 py-0.5 rounded"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
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