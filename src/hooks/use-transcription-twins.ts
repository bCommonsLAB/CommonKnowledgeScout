import { useMemo } from 'react';
import { StorageItem } from '@/lib/storage/types';

// Liste der möglichen Transkript-Suffixe
const TRANSCRIPT_SUFFIXES = ['', '_anthropic', '_openai'];

/**
 * Extracts the base name of a file by removing:
 * 1. File extension
 * 2. Known transcript suffixes
 * Keeps the numbering in parentheses like (1), (2) intact
 */
function getBaseName(fileName: string): string {
  // Remove file extension
  const withoutExt = fileName.includes('.') 
    ? fileName.substring(0, fileName.lastIndexOf('.'))
    : fileName;

  // Remove known suffixes
  for (const suffix of TRANSCRIPT_SUFFIXES) {
    if (suffix && withoutExt.endsWith(suffix)) {
      return withoutExt.slice(0, -suffix.length);
    }
  }

  return withoutExt;
}

/**
 * Hook to process files and detect markdown transcription twins.
 * A file has a transcription twin if there exists a .md file with matching name patterns:
 * - example.m4a -> example.md, example_anthropic.md, example_openai.md
 * 
 * @param items - Array of storage items to process
 * @param transcriptionEnabled - Whether transcription detection is enabled
 * @returns Processed array of storage items with hasTranscript flags and twin references
 */
export function useTranscriptionTwins(
  items: StorageItem[],
  transcriptionEnabled: boolean
): StorageItem[] {
  return useMemo(() => {
    if (!transcriptionEnabled) return items;

    // Group files by their base name
    const fileGroups = new Map<string, StorageItem[]>();
    
    items.forEach(item => {
      if (item.type === 'file') {
        const baseName = getBaseName(item.metadata.name);
        const group = fileGroups.get(baseName) || [];
        group.push(item);
        fileGroups.set(baseName, group);
      }
    });

    // Process all items and set twin references
    return items.map(item => {
      if (item.type === 'file') {
        const baseName = getBaseName(item.metadata.name);
        const group = fileGroups.get(baseName) || [];
        
        // File is a twin only if it's a markdown file with a non-markdown original
        const isMarkdownTwin = item.metadata.name.endsWith('.md') && 
          group.some(f => !f.metadata.name.endsWith('.md'));

        // Find the original file (non-markdown) if this is a markdown file
        const originalFile = item.metadata.name.endsWith('.md')
          ? group.find(f => !f.metadata.name.endsWith('.md'))
          : undefined;

        // Find markdown twin for non-markdown files
        const mdTwin = !item.metadata.name.endsWith('.md')
          ? group.find(f => f.metadata.name.endsWith('.md'))
          : undefined;

        return {
          ...item,
          metadata: {
            ...item.metadata,
            hasTranscript: !!mdTwin,
            isTwin: isMarkdownTwin,
            transcriptionTwin: (originalFile || mdTwin) ? {
              id: (originalFile || mdTwin)!.id,
              name: (originalFile || mdTwin)!.metadata.name,
              isTranscription: !!originalFile
            } : undefined
          }
        };
      }

      return item;
    });
  }, [items, transcriptionEnabled]);
} 