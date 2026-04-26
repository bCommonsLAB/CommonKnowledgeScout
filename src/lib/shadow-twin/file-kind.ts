/**
 * @fileoverview File-Kind- und MIME-Type-Helper fuer Shadow-Twin
 *
 * Pure (state-less) Helper-Funktionen, die in Welle 2 / Schritt 4 aus
 * `src/lib/shadow-twin/shadow-twin-migration-writer.ts` extrahiert wurden.
 * Die Logik ist unveraendert; nur der Code-Ort wird kanonisch.
 *
 * @module shadow-twin
 */

/**
 * Datei-Kategorie fuer Shadow-Twin-Persistierung.
 *
 * - `markdown`: Markdown-/Text-Dateien (`.md`, `.mdx`, `.txt`).
 * - `image`: Bilder (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`).
 * - `audio`: Audio-Dateien (`.mp3`, `.m4a`, `.wav`, `.ogg`, `.opus`, `.flac`).
 * - `video`: Video-Dateien (`.mp4`, `.mov`, `.avi`, `.webm`, `.mkv`).
 * - `binary`: Alles andere (Default-Fallback).
 */
export type FileKind = 'markdown' | 'image' | 'audio' | 'video' | 'binary';

/**
 * Bestimmt den Dateityp basierend auf Dateiname und MIME-Type.
 *
 * Bevorzugt MIME-Type-Match (per `startsWith` oder `includes('markdown')`).
 * Faellt auf Datei-Endung zurueck, wenn der MIME-Type fehlt oder nicht
 * eindeutig ist.
 *
 * Aus Welle 2 / Schritt 4 extrahiert (vorher private Funktion in
 * `shadow-twin-migration-writer.ts`). Tests:
 * `tests/unit/shadow-twin/file-kind.test.ts`.
 */
export function getFileKind(fileName: string, mimeType?: string): FileKind {
  const name = fileName.toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mime.includes('markdown') || /\.(md|mdx|txt)$/.test(name)) return 'markdown';
  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return 'image';
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return 'audio';
  if (mime.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return 'video';
  return 'binary';
}

/**
 * Bestimmt MIME-Type basierend auf Dateiendung.
 *
 * Liefert `undefined` fuer unbekannte Endungen (Aufrufer entscheidet, ob
 * `application/octet-stream`-Default oder Throw).
 *
 * Aus Welle 2 / Schritt 4 extrahiert.
 */
export function getMimeTypeFromFileName(fileName: string): string | undefined {
  // Datei-Endung extrahieren ohne Node-Import (Helper bleibt
  // browser-/Edge-fuegig nutzbar).
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot < 0 || lastDot === fileName.length - 1) return undefined;
  const ext = fileName.substring(lastDot + 1).toLowerCase();

  const mimeMap: Record<string, string> = {
    // Bilder
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    // Audio
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    flac: 'audio/flac',
    // Video
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    // Markdown / Text
    md: 'text/markdown',
    mdx: 'text/markdown',
    txt: 'text/plain',
  };
  return mimeMap[ext];
}
