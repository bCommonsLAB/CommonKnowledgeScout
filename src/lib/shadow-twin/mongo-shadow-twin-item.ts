/**
 * @fileoverview Mongo Shadow-Twin Virtual Items
 *
 * @description
 * Erzeugt virtuelle StorageItems fuer Mongo-basierte Shadow-Twins.
 */

import type { StorageItem } from '@/lib/storage/types'
import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { buildMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'

export function buildMongoShadowTwinItem(args: {
  libraryId: string
  sourceId: string
  sourceName: string
  parentId: string
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
  markdownLength?: number
  updatedAt?: string
}): StorageItem {
  const {
    libraryId,
    sourceId,
    sourceName,
    parentId,
    kind,
    targetLanguage,
    templateName,
    markdownLength,
    updatedAt,
  } = args

  const fileName = buildArtifactName(
    { sourceId, kind, targetLanguage, templateName },
    sourceName
  )

  return {
    id: buildMongoShadowTwinId({
      libraryId,
      sourceId,
      kind,
      targetLanguage,
      templateName,
    }),
    parentId,
    type: 'file',
    metadata: {
      name: fileName,
      size: markdownLength || 0,
      modifiedAt: updatedAt ? new Date(updatedAt) : new Date(),
      mimeType: 'text/markdown',
      isTwin: true,
    },
  }
}
