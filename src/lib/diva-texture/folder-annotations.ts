/**
 * @fileoverview Live-Annotationen eines Texturordners aus der Sidecar.
 *
 * @description
 * Matcht Basecolor-Dateien im Ordner gegen die geladenen Sidecar-Eintraege
 * (PFTFile / TextureName). Quelle fuer den Dateilisten-Filter „Mit DIVA-Info"
 * — ohne vorherigen MongoDB-Preprocess. Nur *_basecolor* (eine Datei pro
 * Material), keine normal/roughness/metallic/ao-Maps.
 */

import { matchTextureCode } from './match-texture-code'
import { isBasecolorFileName } from './preprocess-folder'
import { resolveTextureItemKey } from './load-supplier-data'
import { buildFlatAttributes } from './supplier-properties'
import type { ItemAnnotation, SupplierEntry } from './types'

export interface AnnotatableFile {
  id: string
  name: string
}

/**
 * Baut Live-Annotationen nur fuer Basecolor-Dateien mit Sidecar-Treffer.
 */
export function buildLiveFolderAnnotations(
  files: AnnotatableFile[],
  entries: SupplierEntry[],
): ItemAnnotation[] {
  if (entries.length === 0) return []

  const annotations: ItemAnnotation[] = []
  for (const file of files) {
    if (!isBasecolorFileName(file.name)) continue
    const result = matchTextureCode(file.name, entries)
    if (!result.match) continue
    annotations.push({
      fileName: file.name,
      fileId: file.id,
      itemKey: resolveTextureItemKey(result.match.entry),
      attributes: buildFlatAttributes(result.match.entry),
      entry: result.match.entry,
    })
  }
  return annotations
}
