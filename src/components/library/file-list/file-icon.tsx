'use client';

/**
 * file-list/file-icon.tsx
 *
 * Memoized File-Icon-Komponente, die anhand der Dateiendung
 * (`getFileTypeFromName`) das passende Lucide-Icon rendert.
 *
 * Aus `file-list.tsx` extrahiert (Welle 3-I, Schritt 4b).
 *
 * Vertrag: rein, deterministisch, keine Hooks ausser useMemo via React.memo.
 */

import * as React from 'react';
import {
  File,
  FileText,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  Presentation,
  Globe,
  Image as ImageIcon,
  FileType2,
} from 'lucide-react';
import type { StorageItem } from '@/lib/storage/types';
import { getFileTypeFromName } from './list-utils';

/**
 * Icon-Mapping basierend auf Dateityp:
 * - PDF → FileType2 (rot)
 * - Word/RTF → FileText (blau)
 * - Excel/CSV → FileSpreadsheet (gruen)
 * - PowerPoint → Presentation (orange)
 * - Markdown/Text → FileText (neutral)
 * - Audio → FileAudio (pink)
 * - Video → FileVideo (lila)
 * - Bilder → ImageIcon (cyan)
 * - URL/Website → Globe (hellblau)
 * - Code → FileText (violett)
 * - Unbekannt → File (generisch)
 */
export const FileIconComponent = React.memo(function FileIconComponent({
  item,
}: {
  item: StorageItem;
}) {
  const fileName = item.metadata.name || '';
  const fileType = getFileTypeFromName(fileName);

  switch (fileType) {
    case 'pdf':
      return <FileType2 className="h-4 w-4 text-red-600" />;
    case 'docx':
      return <FileText className="h-4 w-4 text-blue-600" />;
    case 'xlsx':
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    case 'pptx':
      return <Presentation className="h-4 w-4 text-orange-600" />;
    case 'markdown':
      return <FileText className="h-4 w-4" />;
    case 'code':
      return <FileText className="h-4 w-4 text-violet-600" />;
    case 'video':
      return <FileVideo className="h-4 w-4 text-purple-600" />;
    case 'audio':
      return <FileAudio className="h-4 w-4 text-pink-600" />;
    case 'image':
      return <ImageIcon className="h-4 w-4 text-cyan-600" />;
    case 'website':
      return <Globe className="h-4 w-4 text-sky-600" />;
    default:
      return <File className="h-4 w-4" />;
  }
});
