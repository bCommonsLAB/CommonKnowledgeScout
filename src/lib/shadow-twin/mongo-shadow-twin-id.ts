/**
 * @fileoverview Shadow-Twin Mongo ID Helpers
 *
 * @description
 * Verwaltet virtuelle IDs fuer Shadow-Twin-Artefakte aus MongoDB.
 * Diese IDs ermoeglichen es, Artefakte wie StorageItems zu behandeln,
 * ohne sie im Filesystem zu speichern.
 */

import type { ArtifactKind } from '@/lib/shadow-twin/artifact-types'

const MONGO_SHADOW_TWIN_PREFIX = 'mongo-shadow-twin:'
const MONGO_SHADOW_TWIN_SEPARATOR = '::'

export interface MongoShadowTwinIdParts {
  libraryId: string
  sourceId: string
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
}

// Kodiert ID-Komponenten stabil, damit keine Trennzeichen kollidieren.
function encodePart(value: string): string {
  return encodeURIComponent(value)
}

function decodePart(value: string): string {
  return decodeURIComponent(value)
}

/**
 * Baut eine virtuelle ID fuer Mongo-Shadow-Twins.
 * Format: "mongo-shadow-twin:<libraryId>::<sourceId>::<kind>::<targetLanguage>::<templateName?>"
 */
export function buildMongoShadowTwinId(parts: MongoShadowTwinIdParts): string {
  const encoded = [
    encodePart(parts.libraryId),
    encodePart(parts.sourceId),
    encodePart(parts.kind),
    encodePart(parts.targetLanguage),
    encodePart(parts.templateName || ''),
  ]
  return `${MONGO_SHADOW_TWIN_PREFIX}${encoded.join(MONGO_SHADOW_TWIN_SEPARATOR)}`
}

/**
 * Prueft, ob es sich um eine Mongo-Shadow-Twin-ID handelt.
 */
export function isMongoShadowTwinId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(MONGO_SHADOW_TWIN_PREFIX)
}

/**
 * Zerlegt eine Mongo-Shadow-Twin-ID.
 */
export function parseMongoShadowTwinId(value: string | null | undefined): MongoShadowTwinIdParts | null {
  if (!isMongoShadowTwinId(value)) return null
  const raw = value.slice(MONGO_SHADOW_TWIN_PREFIX.length)
  const parts = raw.split(MONGO_SHADOW_TWIN_SEPARATOR)
  if (parts.length < 4) return null

  const [libraryId, sourceId, kind, targetLanguage, templateName] = parts.map(decodePart)
  if (!libraryId || !sourceId || !kind || !targetLanguage) return null

  return {
    libraryId,
    sourceId,
    kind: kind as ArtifactKind,
    targetLanguage,
    templateName: templateName || undefined,
  }
}
