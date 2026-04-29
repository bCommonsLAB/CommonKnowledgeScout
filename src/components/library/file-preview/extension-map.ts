/**
 * file-preview/extension-map.ts
 *
 * Pure Helper-Funktionen, die View-Typ und Sprach-Labels aus Dateinamen
 * ableiten. Aus `file-preview.tsx` extrahiert (Welle 3-II-a, Schritt 4b).
 *
 * Alle Funktionen sind deterministisch und ohne Hooks/Side-Effects —
 * konform mit `welle-3-archiv-detail-contracts.mdc` §1.
 */

import type { StorageItem } from '@/lib/storage/types'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'

/**
 * Extrahiert den Sprachcode aus dem Dateinamen eines Transkripts.
 * Erwartet das Pattern: `name.LANG.md` (z.B. "Voice-test.en.md" → "en").
 * Gibt den Code in Kleinbuchstaben zurück oder `null`, wenn kein Muster erkannt wird.
 */
export function extractTranscriptLang(filename: string): string | null {
  const match = filename.match(/\.([a-z]{2})\.md$/i)
  return match ? match[1].toLowerCase() : null
}

/**
 * Sprachlabels für die Dropdown-Anzeige in der File-Preview.
 */
export const TRANSCRIPT_LANG_LABELS: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  am: 'አማርኛ',
  ar: 'العربية',
  sw: 'Kiswahili',
  om: 'Oromoo',
}

/**
 * Erzeugt ein lesbares Label fuer eine Transformation, basierend auf:
 * - Mongo-Shadow-Twin-ID (parsed) ODER
 * - Dateiname mit Pattern `name.template.lang.md`
 *
 * Fallback: original Dateiname.
 */
export function getTransformationLabel(item: StorageItem): string {
  const id = item.id
  if (isMongoShadowTwinId(id)) {
    const parsed = parseMongoShadowTwinId(id)
    if (parsed) {
      const lang = parsed.targetLanguage?.toLowerCase()
      const langLabel = lang ? (TRANSCRIPT_LANG_LABELS[lang] ?? lang.toUpperCase()) : '?'
      const template = parsed.templateName || 'template'
      return `${lang ? lang.toUpperCase() : '?'} – ${langLabel} · ${template}`
    }
  }
  const filename = item.metadata.name
  const match = filename.match(/\.([^.]+)\.([a-z]{2})\.md$/i)
  if (match) {
    const template = match[1]
    const lang = match[2].toLowerCase()
    const langLabel = TRANSCRIPT_LANG_LABELS[lang] ?? lang.toUpperCase()
    return `${lang.toUpperCase()} – ${langLabel} · ${template}`
  }
  return filename
}

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
