/**
 * @fileoverview Dateiname-Generierung für Creation Wizard Saves
 *
 * Ziel: stabiler, Windows-sicherer Dateiname aus Metadaten / Fallback.
 * - Keine externen Dependencies
 * - Pure Funktion + Unit-Tests
 */

export interface CreationOutputFileNameConfig {
  metadataFieldKey?: string
  autoFillMetadataField?: boolean
  extension?: string
  fallbackPrefix?: string
}

export interface BuildCreationFileNameArgs {
  typeId: string
  metadata: Record<string, unknown>
  config?: CreationOutputFileNameConfig
  now?: Date
}

export interface BuildCreationFileNameResult {
  fileName: string
  updatedMetadata: Record<string, unknown>
}

function toSafeSlug(input: string): string {
  const normalized = input
    .normalize('NFKD')
    // Diakritika entfernen
    .replace(/[\u0300-\u036f]/g, '')
    // Windows-reservierte Zeichen + Control chars entfernen
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    // Kommas/Points etc. in Trennzeichen überführen
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized
}

function toDateStamp(d: Date): string {
  // YYYY-MM-DD (lokal unabhängig)
  return d.toISOString().slice(0, 10)
}

function normalizeExtension(ext: string | undefined): string {
  const raw = (ext || 'md').trim().replace(/^\./, '')
  return raw.length > 0 ? raw : 'md'
}

export function buildCreationFileName(args: BuildCreationFileNameArgs): BuildCreationFileNameResult {
  const now = args.now ?? new Date()
  const cfg = args.config
  const extension = normalizeExtension(cfg?.extension)
  const fallbackPrefix = (cfg?.fallbackPrefix?.trim() || args.typeId).trim()
  const stamp = toDateStamp(now)

  const metadataFieldKey = cfg?.metadataFieldKey?.trim() || undefined
  const autoFill = cfg?.autoFillMetadataField === true

  const updatedMetadata: Record<string, unknown> = { ...args.metadata }

  const candidateRaw = (() => {
    if (metadataFieldKey) {
      const v = updatedMetadata[metadataFieldKey]
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (autoFill) {
        // Fallback: title, sonst prefix+date
        const title = typeof updatedMetadata.title === 'string' ? updatedMetadata.title.trim() : ''
        const auto = title || `${fallbackPrefix} ${stamp}`
        updatedMetadata[metadataFieldKey] = auto
        return auto
      }
    }
    const title = typeof updatedMetadata.title === 'string' ? updatedMetadata.title.trim() : ''
    return title || `${fallbackPrefix} ${stamp}`
  })()

  const base = toSafeSlug(candidateRaw) || toSafeSlug(`${fallbackPrefix}-${stamp}`) || `${args.typeId}-${stamp}`
  const fileName = base.endsWith(`.${extension}`) ? base : `${base}.${extension}`

  return { fileName, updatedMetadata }
}







