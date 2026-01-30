/**
 * @fileoverview MongoDB Shadow-Twin Store Implementation
 *
 * @description
 * Implementiert ShadowTwinStore für MongoDB als Backend.
 * Nutzt die bestehenden Funktionen aus shadow-twin-repo.ts.
 *
 * @module shadow-twin/store
 */

import type { ShadowTwinStore, ArtifactMarkdownResult, UpsertArtifactResult, BinaryFragment } from './shadow-twin-store'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import {
  getShadowTwinArtifact,
  getShadowTwinsBySourceIds,
  upsertShadowTwinArtifact,
  getShadowTwinBinaryFragments,
} from '@/lib/repositories/shadow-twin-repo'
import { buildMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select'

/**
 * MongoDB Shadow-Twin Store Implementation.
 */
export class MongoShadowTwinStore implements ShadowTwinStore {
  constructor(
    private readonly libraryId: string,
    private readonly userEmail: string,
    private readonly sourceName: string,
    private readonly parentId: string
  ) {}

  async existsArtifact(key: ArtifactKey): Promise<boolean> {
    // WICHTIG:
    // Transformationen werden in der UI nicht immer mit templateName adressiert.
    // Wenn templateName fehlt, prüfen wir "existiert irgendeine Transformation" für die Sprache.
    if (key.kind === 'transformation' && (!key.templateName || key.templateName.trim().length === 0)) {
      const docs = await getShadowTwinsBySourceIds({
        libraryId: this.libraryId,
        sourceIds: [key.sourceId],
      })
      const doc = docs.get(key.sourceId)
      if (!doc) return false
      return !!selectShadowTwinArtifact(doc, 'transformation', key.targetLanguage)
    }

    const record = await getShadowTwinArtifact({
      libraryId: this.libraryId,
      sourceId: key.sourceId,
      artifactKey: key,
    })
    return record !== null
  }

  async getArtifactMarkdown(key: ArtifactKey): Promise<ArtifactMarkdownResult | null> {
    // WICHTIG:
    // Transformation ohne templateName: wähle die „beste“ (neueste updatedAt) Transformation in der Sprache.
    if (key.kind === 'transformation' && (!key.templateName || key.templateName.trim().length === 0)) {
      const docs = await getShadowTwinsBySourceIds({
        libraryId: this.libraryId,
        sourceIds: [key.sourceId],
      })
      const doc = docs.get(key.sourceId)
      if (!doc) return null

      const selected = selectShadowTwinArtifact(doc, 'transformation', key.targetLanguage)
      if (!selected) return null

      const effectiveKey: ArtifactKey = {
        ...key,
        templateName: selected.templateName,
      }

      const id = buildMongoShadowTwinId({
        libraryId: this.libraryId,
        sourceId: effectiveKey.sourceId,
        kind: effectiveKey.kind,
        targetLanguage: effectiveKey.targetLanguage,
        templateName: effectiveKey.templateName,
      })
      const name = buildArtifactName(effectiveKey, this.sourceName)

      return {
        id,
        name,
        markdown: selected.record.markdown,
        frontmatter: selected.record.frontmatter,
      }
    }

    const record = await getShadowTwinArtifact({
      libraryId: this.libraryId,
      sourceId: key.sourceId,
      artifactKey: key,
    })

    if (!record) return null

    const id = buildMongoShadowTwinId({
      libraryId: this.libraryId,
      sourceId: key.sourceId,
      kind: key.kind,
      targetLanguage: key.targetLanguage,
      templateName: key.templateName,
    })

    const name = buildArtifactName(key, this.sourceName)

    return {
      id,
      name,
      markdown: record.markdown,
      frontmatter: record.frontmatter,
    }
  }

  async upsertArtifact(
    key: ArtifactKey,
    markdown: string,
    binaryFragments?: BinaryFragment[],
    context?: {
      libraryId: string
      userEmail: string
      sourceName: string
      parentId: string
    }
  ): Promise<UpsertArtifactResult> {
    // Defense in depth: selbst wenn jemand den Store direkt nutzt, verhindern wir leere Writes.
    if (typeof markdown !== 'string' || markdown.trim().length === 0) {
      const template = key.templateName ? `, template=${key.templateName}` : ''
      throw new Error(
        `ShadowTwin(Mongo): Leeres Markdown darf nicht gespeichert werden (kind=${key.kind}, lang=${key.targetLanguage}${template}, source=${this.sourceName})`
      )
    }

    const libraryId = context?.libraryId || this.libraryId
    const userEmail = context?.userEmail || this.userEmail
    const sourceName = context?.sourceName || this.sourceName
    const parentId = context?.parentId || this.parentId

    await upsertShadowTwinArtifact({
      libraryId,
      userEmail,
      sourceId: key.sourceId,
      sourceName,
      parentId,
      artifactKey: key,
      markdown,
      binaryFragments: binaryFragments?.map((f) => ({
        name: f.name,
        url: f.url,
        hash: f.hash,
        mimeType: f.mimeType,
        size: f.size,
      })),
    })

    const id = buildMongoShadowTwinId({
      libraryId,
      sourceId: key.sourceId,
      kind: key.kind,
      targetLanguage: key.targetLanguage,
      templateName: key.templateName,
    })

    const name = buildArtifactName(key, sourceName)

    return { id, name }
  }

  async getBinaryFragments(sourceId: string): Promise<BinaryFragment[] | null> {
    const fragments = await getShadowTwinBinaryFragments(this.libraryId, sourceId)
    if (!fragments) return null

    // Mappe alle Felder, inkl. fileId als Fallback für url
    return fragments.map((f) => ({
      name: f.name,
      url: f.url,
      fileId: f.fileId,
      hash: f.hash,
      mimeType: f.mimeType,
      size: f.size,
      kind: f.kind,
    }))
  }
}
