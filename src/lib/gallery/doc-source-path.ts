import type { DocCardMeta } from '@/lib/gallery/types'
import { tryDecodeRelativePathFromFileId } from '@/utils/decode-storage-file-id'

/** Verzeichnis + Dateiname für die zweizeilige Tabellen-Unterzeile (Owner). */
export type GalleryDocSourcePathParts = {
  directory: string
  fileName: string
  /** Slash zwischen Ordner und Datei (Speicherpfad); sonst „ · “ wie bei ID + Index-Dateiname. */
  joinWithSlash: boolean
}

function splitRelativePath(full: string): { directory: string; fileName: string } {
  const t = full.trim().replace(/\/+$/, '')
  if (!t) return { directory: '', fileName: '' }
  const i = t.lastIndexOf('/')
  if (i === -1) return { directory: '', fileName: t }
  return { directory: t.slice(0, i), fileName: t.slice(i + 1) }
}

/**
 * Zerlegung für die Galerie-Tabelle: Zeile 1 = Ordner, Zeile 2 = Datei(en).
 * Semantik parallel zu `OpenInArchiveButton` / ehemaliger Ein-Zeilen-Anzeige.
 */
export function buildGalleryDocSourcePathParts(doc: DocCardMeta): GalleryDocSourcePathParts {
  const fileId = (doc.fileId || doc.id || '').trim()
  if (!fileId) return { directory: '—', fileName: '', joinWithSlash: true }

  const indexFileName = doc.fileName?.trim()
  const ingestPath = doc.sourcePath?.trim()
  const ingestFile = doc.sourceFileName?.trim()
  const hasIngestLoc = Boolean(ingestPath || ingestFile)
  const storagePathDecoded = !hasIngestLoc ? tryDecodeRelativePathFromFileId(fileId) : undefined

  if (hasIngestLoc) {
    const filePart = ingestFile || indexFileName || ''
    if (ingestPath) {
      const base = ingestPath.replace(/\/+$/, '')
      if (filePart) return { directory: base, fileName: filePart, joinWithSlash: true }
      return { directory: base, fileName: '', joinWithSlash: true }
    }
    if (filePart) return { directory: '', fileName: filePart, joinWithSlash: true }
    return { directory: '—', fileName: '', joinWithSlash: true }
  }

  if (storagePathDecoded) {
    const { directory: dir, fileName: baseFile } = splitRelativePath(storagePathDecoded)
    if (indexFileName && !storagePathDecoded.endsWith(indexFileName)) {
      const fileLine = baseFile ? `${baseFile} · ${indexFileName}` : indexFileName
      const directoryLine = dir || (baseFile ? '' : storagePathDecoded)
      return { directory: directoryLine, fileName: fileLine, joinWithSlash: true }
    }
    if (dir) return { directory: dir, fileName: baseFile, joinWithSlash: true }
    return { directory: '', fileName: baseFile || storagePathDecoded, joinWithSlash: true }
  }

  const idShort = fileId.length > 120 ? `${fileId.slice(0, 120)}…` : fileId
  if (indexFileName) {
    return { directory: idShort, fileName: indexFileName, joinWithSlash: false }
  }
  return { directory: '', fileName: idShort, joinWithSlash: false }
}

/**
 * Eine Zeile (Tooltip, Kopieren): kompatibel zur früheren `buildGalleryDocSourcePathLine`-Semantik.
 */
export function buildGalleryDocSourcePathLine(doc: DocCardMeta): string {
  const p = buildGalleryDocSourcePathParts(doc)
  if (p.directory && p.fileName) {
    if (p.joinWithSlash) return `${p.directory}/${p.fileName}`
    return `${p.directory} · ${p.fileName}`
  }
  if (p.fileName) return p.fileName
  return p.directory || '—'
}
