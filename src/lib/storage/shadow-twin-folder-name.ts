/**
 * Shadow-Twin-Ordnernamen — reine String-Logik (ohne Node `path`), damit Client und Server identisch bleiben.
 */

const SHADOW_TWIN_FOLDER_PREFIX = '_'
const SHADOW_TWIN_FOLDER_PREFIX_LEGACY = '.'

export function isShadowTwinFolderName(name: string): boolean {
  return name.startsWith(SHADOW_TWIN_FOLDER_PREFIX) || name.startsWith(SHADOW_TWIN_FOLDER_PREFIX_LEGACY)
}

/**
 * Ordnersegment `_Quelldatei.pdf` aus dem ursprünglichen Dateinamen (wie bisher in shadow-twin.ts).
 */
export function generateShadowTwinFolderName(originalName: string, maxLength: number = 255): string {
  const cleanName = originalName.trim().replace(/^\/+|\/+$/g, '')
  const folderName = `${SHADOW_TWIN_FOLDER_PREFIX}${cleanName}`

  if (folderName.length <= maxLength) {
    return folderName
  }

  const lastDot = cleanName.lastIndexOf('.')
  const extension = lastDot > 0 ? cleanName.slice(lastDot) : ''
  const baseName = lastDot > 0 ? cleanName.slice(0, lastDot) : cleanName

  const reservedLength = 2 + extension.length
  const availableLength = maxLength - reservedLength

  if (availableLength <= 0) {
    return `${SHADOW_TWIN_FOLDER_PREFIX}${extension}`
  }

  const truncatedBase = baseName.length > availableLength
    ? baseName.slice(0, availableLength)
    : baseName

  return `${SHADOW_TWIN_FOLDER_PREFIX}${truncatedBase}${extension}`
}

/**
 * Relativer Medien-Verweis für Frontmatter: `_Quelle.pdf/img-0.jpeg`
 * (Twin-Ordner / Fragment-Dateiname, eindeutig bei mehreren PDFs).
 */
export function buildTwinRelativeMediaRef(sourceFileName: string, fragmentFileName: string): string {
  const folder = generateShadowTwinFolderName(sourceFileName)
  const leaf = fragmentFileName.trim().replace(/^\/+|\/+$/g, '')
  return `${folder}/${leaf}`
}

export function parseTwinRelativeImageRef(ref: string): { twinFolderName: string; imageFileName: string } | null {
  const normalized = ref.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized || normalized.includes('..')) return null
  const slash = normalized.indexOf('/')
  if (slash < 0) return null
  const twinFolderName = normalized.slice(0, slash)
  const imageFileName = normalized.slice(slash + 1).replace(/^\/+/, '')
  if (!imageFileName || !isShadowTwinFolderName(twinFolderName)) return null
  return { twinFolderName, imageFileName }
}
