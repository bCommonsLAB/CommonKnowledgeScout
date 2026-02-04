/**
 * @fileoverview Shadow-Twin Repository (MongoDB)
 *
 * @description
 * Persistiert und laedt Shadow-Twin-Artefakte aus MongoDB.
 * Ein Dokument pro sourceId (Original-Datei).
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import type { ArtifactKey, ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { FileLogger } from '@/lib/debug/logger'

export interface ShadowTwinArtifactRecord {
  markdown: string
  frontmatter?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ShadowTwinDocument {
  _id?: string
  libraryId: string
  sourceId: string
  sourceName: string
  parentId: string
  userEmail: string
  artifacts: {
    transcript?: Record<string, ShadowTwinArtifactRecord>
    transformation?: Record<string, Record<string, ShadowTwinArtifactRecord>>
  }
  binaryFragments?: Array<Record<string, unknown>>
  filesystemSync?: {
    enabled: boolean
    shadowTwinFolderId?: string | null
    lastSyncedAt?: string | null
  }
  createdAt: string
  updatedAt: string
}

const collectionCache = new Map<string, Collection<ShadowTwinDocument>>()
const indexCache = new Set<string>()

export function getShadowTwinCollectionName(libraryId: string): string {
  return `shadow_twins__${libraryId}`
}

async function getShadowTwinCollection(libraryId: string): Promise<Collection<ShadowTwinDocument>> {
  const name = getShadowTwinCollectionName(libraryId)
  const cached = collectionCache.get(name)
  if (cached) return cached
  const col = await getCollection<ShadowTwinDocument>(name)
  collectionCache.set(name, col)
  return col
}

export async function ensureShadowTwinIndexes(libraryId: string): Promise<void> {
  const name = getShadowTwinCollectionName(libraryId)
  if (indexCache.has(name)) return
  const col = await getShadowTwinCollection(libraryId)
  await col.createIndex({ libraryId: 1, parentId: 1 })
  await col.createIndex({ libraryId: 1, sourceId: 1 }, { unique: true })
  indexCache.add(name)
}

export function buildArtifactPath(key: ArtifactKey): string {
  if (key.kind === 'transcript') {
    return `artifacts.transcript.${key.targetLanguage}`
  }
  const templateName = key.templateName || 'unknown'
  return `artifacts.transformation.${templateName}.${key.targetLanguage}`
}

function pickArtifact(doc: ShadowTwinDocument, key: ArtifactKey): ShadowTwinArtifactRecord | null {
  const path = buildArtifactPath(key).split('.')
  let current: unknown = doc
  for (const segment of path) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[segment]
  }
  if (!current || typeof current !== 'object') return null
  return current as ShadowTwinArtifactRecord
}

export async function upsertShadowTwinArtifact(args: {
  libraryId: string
  userEmail: string
  sourceId: string
  sourceName: string
  parentId: string
  artifactKey: ArtifactKey
  markdown: string
  binaryFragments?: Array<Record<string, unknown>>
}): Promise<void> {
  const { libraryId, userEmail, sourceId, sourceName, parentId, artifactKey, markdown, binaryFragments } = args
  // Domain-Regel: Leere Artefakte sind ein Fehler. Das schützt auch direkte Repo-Nutzung.
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    const template = artifactKey.templateName ? `, template=${artifactKey.templateName}` : ''
    throw new Error(
      `ShadowTwinRepo: Leeres Markdown darf nicht gespeichert werden (kind=${artifactKey.kind}, lang=${artifactKey.targetLanguage}${template}, source=${sourceName})`
    )
  }
  await ensureShadowTwinIndexes(libraryId)
  const col = await getShadowTwinCollection(libraryId)

  const now = new Date().toISOString()
  const parsed = parseFrontmatter(markdown)
  const record: ShadowTwinArtifactRecord = {
    markdown,
    frontmatter: parsed.meta || undefined,
    createdAt: now,
    updatedAt: now,
  }

  const artifactPath = buildArtifactPath(artifactKey)
  const update: Record<string, unknown> = {
    $set: {
      libraryId,
      userEmail,
      sourceId,
      sourceName,
      parentId,
      updatedAt: now,
      [artifactPath]: record,
    },
    $setOnInsert: {
      createdAt: now,
      filesystemSync: {
        enabled: false,
        shadowTwinFolderId: null,
        lastSyncedAt: null,
      },
    },
  }

  if (Array.isArray(binaryFragments) && binaryFragments.length > 0) {
    update.$set = {
      ...(update.$set as Record<string, unknown>),
      binaryFragments,
    }
  }

  await col.updateOne({ libraryId, sourceId }, update, { upsert: true })
}

export async function getShadowTwinsBySourceIds(args: {
  libraryId: string
  sourceIds: string[]
}): Promise<Map<string, ShadowTwinDocument>> {
  const { libraryId, sourceIds } = args
  if (!sourceIds.length) return new Map()

  const col = await getShadowTwinCollection(libraryId)
  const docs = await col
    .find({ libraryId, sourceId: { $in: sourceIds } })
    .toArray()

  return new Map(docs.map((doc) => [doc.sourceId, doc]))
}

export async function getShadowTwinArtifact(args: {
  libraryId: string
  sourceId: string
  artifactKey: ArtifactKey
}): Promise<ShadowTwinArtifactRecord | null> {
  const { libraryId, sourceId, artifactKey } = args
  const col = await getShadowTwinCollection(libraryId)
  const doc = await col.findOne({ libraryId, sourceId })
  
  if (!doc) {
    FileLogger.warn('shadow-twin-repo', 'Dokument nicht gefunden', {
      libraryId,
      sourceId,
      artifactKey,
      collectionName: getShadowTwinCollectionName(libraryId),
    })
    return null
  }
  
  const artifact = pickArtifact(doc, artifactKey)
  if (!artifact) {
    FileLogger.warn('shadow-twin-repo', 'Artefakt im Dokument nicht gefunden', {
      libraryId,
      sourceId,
      artifactKey,
      availableArtifacts: doc.artifacts ? Object.keys(doc.artifacts) : [],
    })
  }
  
  return artifact
}

/**
 * Binary Fragment aus MongoDB
 * Enthält entweder url (Azure) oder fileId (Dateisystem-Referenz)
 */
export interface MongoBinaryFragment {
  name: string
  /** Azure Blob Storage URL (bevorzugt) */
  url?: string
  /** Dateisystem-Referenz (Fallback, wenn keine Azure-URL) */
  fileId?: string
  hash?: string
  mimeType?: string
  size?: number
  kind?: string
  createdAt?: string
}

/**
 * Lädt binaryFragments aus MongoDB Shadow-Twin Dokument
 * @param libraryId Library-ID
 * @param sourceId Source-Datei-ID
 * @returns Array von binaryFragments oder null wenn Dokument nicht gefunden
 */
export async function getShadowTwinBinaryFragments(
  libraryId: string,
  sourceId: string
): Promise<MongoBinaryFragment[] | null> {
  const col = await getShadowTwinCollection(libraryId)
  const doc = await col.findOne({ libraryId, sourceId })
  if (!doc || !doc.binaryFragments) return null
  
  // Konvertiere binaryFragments zu typisiertem Array
  // Unterstützt sowohl url (Azure) als auch fileId (Dateisystem-Fallback)
  return doc.binaryFragments.map(fragment => {
    const f = fragment as Record<string, unknown>
    return {
      name: typeof f.name === 'string' ? f.name : '',
      url: typeof f.url === 'string' ? f.url : undefined,
      fileId: typeof f.fileId === 'string' ? f.fileId : undefined,
      hash: typeof f.hash === 'string' ? f.hash : undefined,
      mimeType: typeof f.mimeType === 'string' ? f.mimeType : undefined,
      size: typeof f.size === 'number' ? f.size : undefined,
      kind: typeof f.kind === 'string' ? f.kind : undefined,
      createdAt: typeof f.createdAt === 'string' ? f.createdAt : undefined,
    }
  })
}

/**
 * Fügt ein Binary-Fragment zu einem Shadow-Twin hinzu oder ersetzt es bei gleichem Namen.
 * 
 * Verwendet $push mit $each und $slice für atomare Updates.
 * Bei gleichem Fragment-Namen wird das vorhandene ersetzt.
 * 
 * @param libraryId Library-ID
 * @param sourceId Source-Datei-ID
 * @param fragment Binary-Fragment zum Speichern
 */
export async function upsertShadowTwinBinaryFragment(
  libraryId: string,
  sourceId: string,
  fragment: MongoBinaryFragment
): Promise<void> {
  const col = await getShadowTwinCollection(libraryId)
  const now = new Date().toISOString()

  // Schritt 1: Entferne vorhandenes Fragment mit gleichem Namen (falls vorhanden)
  await col.updateOne(
    { libraryId, sourceId },
    {
      $pull: { binaryFragments: { name: fragment.name } }
    }
  )

  // Schritt 2: Füge neues Fragment hinzu
  await col.updateOne(
    { libraryId, sourceId },
    {
      $push: { binaryFragments: fragment as unknown as Record<string, unknown> },
      $set: { updatedAt: now },
      $setOnInsert: {
        libraryId,
        sourceId,
        createdAt: now,
        artifacts: {},
        filesystemSync: { enabled: false, shadowTwinFolderId: null, lastSyncedAt: null },
      }
    },
    { upsert: true }
  )
}

export function toArtifactKey(args: {
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
  sourceId: string
}): ArtifactKey {
  return {
    sourceId: args.sourceId,
    kind: args.kind,
    targetLanguage: args.targetLanguage,
    templateName: args.templateName,
  }
}

export async function updateShadowTwinArtifactMarkdown(args: {
  libraryId: string
  sourceId: string
  artifactKey: ArtifactKey
  markdown: string
}): Promise<void> {
  const { libraryId, sourceId, artifactKey, markdown } = args
  // Domain-Regel: Leere Artefakte sind ein Fehler.
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    const template = artifactKey.templateName ? `, template=${artifactKey.templateName}` : ''
    throw new Error(
      `ShadowTwinRepo: Leeres Markdown darf nicht gespeichert werden (kind=${artifactKey.kind}, lang=${artifactKey.targetLanguage}${template})`
    )
  }
  const col = await getShadowTwinCollection(libraryId)
  const now = new Date().toISOString()
  const parsed = parseFrontmatter(markdown)
  const path = buildArtifactPath(artifactKey)

  await col.updateOne(
    { libraryId, sourceId },
    {
      $set: {
        [`${path}.markdown`]: markdown,
        [`${path}.frontmatter`]: parsed.meta || undefined,
        [`${path}.updatedAt`]: now,
        updatedAt: now,
      },
    }
  )
}

/**
 * Löscht das Shadow‑Twin Dokument (alle Artefakte + binaryFragments) für eine Quelle.
 *
 * WICHTIG:
 * - Diese Operation ist primär für deterministische Test-Setups gedacht ("clean" State).
 * - In der Produktion sollte das nur bewusst/gezielt genutzt werden.
 */
export async function deleteShadowTwinBySourceId(libraryId: string, sourceId: string): Promise<void> {
  const col = await getShadowTwinCollection(libraryId)
  await col.deleteOne({ libraryId, sourceId })
}

export function logShadowTwinRepoError(scope: string, error: unknown): void {
  FileLogger.error('shadow-twin-repo', scope, {
    error: error instanceof Error ? error.message : String(error),
  })
}
