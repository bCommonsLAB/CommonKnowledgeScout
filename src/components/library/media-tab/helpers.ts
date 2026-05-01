/**
 * media-tab/helpers.ts
 *
 * Pure-Helper + async-Helper + Types fuer MediaTab.
 *
 * Aus `media-tab.tsx` ausgegliedert (Welle 3-II-c, Schritt 3/5).
 *
 * Enthaelt:
 * - `AssignmentTarget` Type — Slot-first-Zuordnungs-Ziel
 * - `GalleryItem` Type — Eintrag in der kombinierten Galerie
 * - `safeArray` (Pure) — robuste String-Array-Konvertierung
 * - `parseUrlFileContent` (Pure) — URL aus .url/.webloc extrahieren
 * - `patchFrontmatterField` (async) — Frontmatter-Feld direkt patchen
 * - `handleFileUpload` (async) — Upload via shadow-twins/upload-media
 * - `removeAttachment` (async) — Eintrag aus attachments_url entfernen
 * - `removeArrayFieldItem` (async) — Eintrag aus beliebigem Array-Feld
 */

import { toast } from 'sonner'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { fetchShadowTwinMarkdown, updateShadowTwinMarkdown } from '@/lib/shadow-twin/shadow-twin-mongo-client'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import type { StorageProvider } from '@/lib/storage/types'

/** Ziel fuer die Slot-first-Zuordnung. */
export interface AssignmentTarget {
  fieldKey: string
  arrayIndex?: number
  arrayAppend?: boolean
}

/** Eintrag in der kombinierten Galerie. */
export interface GalleryItem {
  id: string
  name: string
  /** Quelle: 'sibling' (Verzeichnis) oder 'fragment' (binaryFragments/Azure) */
  source: 'sibling' | 'fragment'
  mediaKind: 'image' | 'pdf' | 'document' | 'link'
  /** Vorschau-URL (Thumbnail oder Original) */
  previewUrl?: string
  /** Bereits einem Feld zugeordnet? */
  assignedTo?: string
  size?: number
  /** Bei Fragmenten: Shadow-Twin-Quelle (PDF-`sourceId`), fuer eindeutige Keys und resolve-binary-url */
  fragmentSourceId?: string
  /** Bei Fragmenten: Speicher-Dateiname der Quelle (z. B. PDF) — nur Anzeige/Tooltip */
  sourceFileName?: string
  /**
   * Wert fuers Frontmatter bei PDF-/MD-Fragmenten: `_Quelle.pdf/img-0.jpeg`.
   * Siblings: ungesetzt → `name` wird gespeichert.
   */
  frontmatterRef?: string
}

/** Konvertiert einen unbekannten Wert sicher in ein String-Array. */
export function safeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed.replace(/'/g, '"'))
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        }
      } catch {
        // Fallback auf Einzelwert (dokumentierter Fallback,
        // siehe no-silent-fallbacks.mdc)
      }
    }
    return [trimmed]
  }
  return []
}

/**
 * Parst den Inhalt einer .url-Datei (Windows Internet Shortcut) oder
 * .webloc-Datei (macOS). Extrahiert die URL aus dem Dateiformat.
 *
 * Windows .url Format:
 *   [InternetShortcut]
 *   URL=https://example.com
 *
 * macOS .webloc Format (XML plist):
 *   <string>https://example.com</string>
 */
export function parseUrlFileContent(content: string): string | null {
  // Windows .url Format
  const urlMatch = content.match(/^URL\s*=\s*(.+)$/mi)
  if (urlMatch) {
    const url = urlMatch[1].trim()
    if (url.startsWith('http://') || url.startsWith('https://')) return url
  }

  // macOS .webloc Format (XML plist mit <string>URL</string>)
  const weblocMatch = content.match(/<string>(https?:\/\/[^<]+)<\/string>/i)
  if (weblocMatch) return weblocMatch[1]

  // Fallback: Erste URL im Text finden
  const genericMatch = content.match(/(https?:\/\/\S+)/i)
  if (genericMatch) return genericMatch[1]

  return null
}

/**
 * Patcht ein Frontmatter-Feld direkt (ohne Upload, fuer bereits vorhandene
 * Fragments / Storage-Siblings).
 *
 * NOTE: provider/fileId/frontmatterMeta/fullContent sind Teil des
 * Funktions-Vertrags (1:1 portiert), werden im Body aber nicht alle
 * verwendet — bewusst beibehalten fuer API-Kompatibilitaet.
 */
export async function patchFrontmatterField(
  target: AssignmentTarget,
  fileName: string,
  libraryId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fileId: string,
  effectiveMdId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  frontmatterMeta: Record<string, unknown> | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fullContent: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  provider: StorageProvider | null,
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void,
  /** Zusaetzliche Keys (z. B. coverThumbnailUrl entfernen); undefined-Werte werden von patchFrontmatter gestrichen */
  extraPatches?: Record<string, unknown>,
) {
  if (!effectiveMdId || !isMongoShadowTwinId(effectiveMdId)) {
    toast.error('Nur fuer MongoDB-Shadow-Twins unterstuetzt')
    return
  }
  const parts = parseMongoShadowTwinId(effectiveMdId)
  if (!parts) {
    toast.error('Ungueltige Dokument-ID')
    return
  }

  const mdResult = await fetchShadowTwinMarkdown(libraryId, parts)
  if (!mdResult) throw new Error('Markdown konnte nicht geladen werden')

  const { patchFrontmatter } = await import('@/lib/markdown/frontmatter-patch')
  let patches: Record<string, unknown>

  if (target.arrayIndex !== undefined) {
    // Array-Feld: Index setzen
    const { meta } = parseSecretaryMarkdownStrict(mdResult)
    const current = Array.isArray(meta[target.fieldKey]) ? [...(meta[target.fieldKey] as string[])] : []
    while (current.length <= target.arrayIndex) current.push('')
    current[target.arrayIndex] = fileName
    patches = { [target.fieldKey]: current }
  } else if (target.arrayAppend) {
    // Array-Feld: Anhaengen
    const { meta } = parseSecretaryMarkdownStrict(mdResult)
    const current = Array.isArray(meta[target.fieldKey]) ? [...(meta[target.fieldKey] as string[])] : []
    current.push(fileName)
    patches = { [target.fieldKey]: current }
  } else {
    // String-Feld
    patches = { [target.fieldKey]: fileName }
  }

  if (extraPatches && Object.keys(extraPatches).length > 0) {
    patches = { ...patches, ...extraPatches }
  }

  const patchedMarkdown = patchFrontmatter(mdResult, patches)
  await updateShadowTwinMarkdown(libraryId, parts, patchedMarkdown)

  const { meta } = parseSecretaryMarkdownStrict(patchedMarkdown)
  onFrontmatterUpdate(meta, patchedMarkdown)
}

/** Datei-Upload ueber die generalisierte Upload-API. */
export async function handleFileUpload(
  file: File,
  target: AssignmentTarget,
  libraryId: string,
  fileId: string,
  templateName: string | undefined,
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void,
  setIsUploading: (v: boolean) => void,
) {
  setIsUploading(true)
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('sourceId', fileId)
    formData.append('fieldKey', target.fieldKey)
    formData.append('kind', 'transformation')
    formData.append('targetLanguage', 'de')
    if (templateName) formData.append('templateName', templateName)
    if (target.arrayIndex !== undefined) formData.append('arrayIndex', String(target.arrayIndex))
    if (target.arrayAppend) formData.append('arrayAppend', 'true')

    const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/upload-media`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || `Upload fehlgeschlagen: ${res.status}`)
    }

    const result = await res.json() as { markdown: string }
    const { meta } = parseSecretaryMarkdownStrict(result.markdown)
    onFrontmatterUpdate(meta, result.markdown)
    toast.success('Datei hochgeladen und zugeordnet')
  } catch (error) {
    toast.error('Upload-Fehler: ' + (error instanceof Error ? error.message : 'Unbekannt'))
  } finally {
    setIsUploading(false)
  }
}

/**
 * Entfernt einen Anhang aus dem `attachments_url`-Array.
 *
 * NOTE: fileId/frontmatterMeta/fullContent/provider sind Teil des
 * 1:1-portierten API-Vertrags (auch wenn nicht alle verwendet).
 */
export async function removeAttachment(
  index: number,
  libraryId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fileId: string,
  effectiveMdId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  frontmatterMeta: Record<string, unknown> | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fullContent: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  provider: StorageProvider | null,
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void,
) {
  if (!effectiveMdId || !isMongoShadowTwinId(effectiveMdId)) return
  const parts = parseMongoShadowTwinId(effectiveMdId)
  if (!parts) return

  const mdResult = await fetchShadowTwinMarkdown(libraryId, parts)
  if (!mdResult) return

  const { meta } = parseSecretaryMarkdownStrict(mdResult)
  const current = safeArray(meta.attachments_url)
  current.splice(index, 1)

  const { patchFrontmatter } = await import('@/lib/markdown/frontmatter-patch')
  const patchedMarkdown = patchFrontmatter(mdResult, { attachments_url: JSON.stringify(current) })
  await updateShadowTwinMarkdown(libraryId, parts, patchedMarkdown)

  const { meta: newMeta } = parseSecretaryMarkdownStrict(patchedMarkdown)
  onFrontmatterUpdate(newMeta, patchedMarkdown)
  toast.success('Anhang entfernt')
}

/** Entfernt einen Eintrag aus einem beliebigen Array-Frontmatter-Feld. */
export async function removeArrayFieldItem(
  fieldKey: string,
  index: number,
  libraryId: string,
  effectiveMdId: string | null,
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void,
) {
  if (!effectiveMdId || !isMongoShadowTwinId(effectiveMdId)) return
  const parts = parseMongoShadowTwinId(effectiveMdId)
  if (!parts) return

  const mdResult = await fetchShadowTwinMarkdown(libraryId, parts)
  if (!mdResult) return

  const { meta } = parseSecretaryMarkdownStrict(mdResult)
  const current = safeArray(meta[fieldKey])
  if (index < 0 || index >= current.length) return
  current.splice(index, 1)

  const { patchFrontmatter } = await import('@/lib/markdown/frontmatter-patch')
  const patchedMarkdown = patchFrontmatter(mdResult, { [fieldKey]: JSON.stringify(current) })
  await updateShadowTwinMarkdown(libraryId, parts, patchedMarkdown)

  const { meta: newMeta } = parseSecretaryMarkdownStrict(patchedMarkdown)
  onFrontmatterUpdate(newMeta, patchedMarkdown)
  toast.success('Eintrag entfernt')
}
