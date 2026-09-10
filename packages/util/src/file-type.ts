/**
 * Dateityp aus der Endung — reine Zeichenketten-Arbeit, ohne Storage.
 *
 * Seit M5 hier statt in `src/components/library/file-preview/extension-map.ts`
 * (dort re-exportiert): Die Anhang-Liste der Buch-Ansicht liegt im Paket
 * `@ks/module-explorer` und klassifiziert Verweise damit (`reference-format.ts`).
 * Erfuellt die Regel dieses Pakets: laeuft ueberall, keine Abhaengigkeit.
 */

/**
 * Bestimmt den View-Typ fuer die File-Preview anhand der Dateiendung.
 *
 * Rueckgabe-Werte:
 * - `markdown` — Markdown/Text/Code-Dateien
 * - `video`, `audio`, `image` — Media-Renderer
 * - `pdf` — PDF-Renderer
 * - `docx`, `pptx`, `xlsx` — Office-Dokumente
 * - `website` — URL-Dateien
 * - `unknown` — alles andere
 *
 * Code-Dateien (json, html, py, etc.) werden als `markdown` behandelt,
 * damit sie als editierbare Textdatei angezeigt werden.
 */
export function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown'
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
    case 'mpeg':
    case 'mpg':
      return 'video'
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image'
    case 'pdf':
      return 'pdf'
    case 'doc':
    case 'docx':
      return 'docx'
    case 'odt':
      return 'docx'
    case 'ppt':
    case 'pptx':
      return 'pptx'
    case 'xls':
    case 'xlsx':
      return 'xlsx'
    case 'url':
      return 'website'
    default: {
      // Fuer unbekannte Dateitypen pruefen wir, ob es sich um eine
      // Textdatei handeln koennte (Code, Config, Log).
      const textExtensions = [
        'json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv',
        'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c',
        'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt',
        'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt',
      ]
      if (textExtensions.includes(extension || '')) {
        return 'markdown'
      }
      return 'unknown'
    }
  }
}
