/**
 * @fileoverview Provider/Filesystem Shadow-Twin Store Implementation
 *
 * @description
 * Implementiert ShadowTwinStore für Filesystem/OneDrive/Drive über StorageProvider.
 * Nutzt resolveArtifact() für die Artefakt-Auflösung.
 *
 * @module shadow-twin/store
 */

import type { ShadowTwinStore, ArtifactMarkdownResult, UpsertArtifactResult, BinaryFragment } from './shadow-twin-store'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import type { StorageProvider } from '@/lib/storage/types'
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'

/**
 * Provider/Filesystem Shadow-Twin Store Implementation.
 */
export class ProviderShadowTwinStore implements ShadowTwinStore {
  constructor(
    private readonly provider: StorageProvider,
    private readonly sourceName: string,
    private readonly parentId: string
  ) {}

  async existsArtifact(key: ArtifactKey): Promise<boolean> {
    const resolved = await resolveArtifact(this.provider, {
      sourceItemId: key.sourceId,
      sourceName: this.sourceName,
      parentId: this.parentId,
      targetLanguage: key.targetLanguage,
      templateName: key.templateName,
      preferredKind: key.kind,
    })
    return resolved !== null
  }

  async getArtifactMarkdown(key: ArtifactKey): Promise<ArtifactMarkdownResult | null> {
    const resolved = await resolveArtifact(this.provider, {
      sourceItemId: key.sourceId,
      sourceName: this.sourceName,
      parentId: this.parentId,
      targetLanguage: key.targetLanguage,
      templateName: key.templateName,
      preferredKind: key.kind,
    })

    if (!resolved) return null

    try {
      const binary = await this.provider.getBinary(resolved.fileId)
      const markdown = await binary.blob.text()

      // Optional: Frontmatter parsen
      let frontmatter: Record<string, unknown> | undefined
      try {
        const { parseFrontmatter } = await import('@/lib/markdown/frontmatter')
        const parsed = parseFrontmatter(markdown)
        if (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta)) {
          frontmatter = parsed.meta as Record<string, unknown>
        }
      } catch {
        // Frontmatter-Parsing optional
      }

      return {
        id: resolved.fileId,
        name: resolved.fileName,
        markdown,
        frontmatter,
      }
    } catch (error) {
      // Fehler beim Laden → null zurückgeben
      return null
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
    // Defense in depth: Provider-Store schreibt in Dateien – leere Dateien sollen nicht entstehen.
    if (typeof markdown !== 'string' || markdown.trim().length === 0) {
      const template = key.templateName ? `, template=${key.templateName}` : ''
      throw new Error(
        `ShadowTwin(Provider): Leeres Markdown darf nicht gespeichert werden (kind=${key.kind}, lang=${key.targetLanguage}${template}, source=${this.sourceName})`
      )
    }

    // WICHTIG: Provider-basierte Stores schreiben direkt ins Filesystem/Drive.
    // Diese Implementierung ist primär für Lesen gedacht.
    // Für Schreiben sollte normalerweise der Mongo-Store verwendet werden,
    // es sei denn, persistToFilesystem=true ist gesetzt.

    const fileName = buildArtifactName(key, context?.sourceName || this.sourceName)
    const targetParentId = context?.parentId || this.parentId

    // Prüfe, ob Datei bereits existiert
    const existing = await this.existsArtifact(key)
    let fileId: string

    if (existing) {
      // Update: Lade bestehende Datei und aktualisiere Inhalt
      const resolved = await resolveArtifact(this.provider, {
        sourceItemId: key.sourceId,
        sourceName: context?.sourceName || this.sourceName,
        parentId: targetParentId,
        targetLanguage: key.targetLanguage,
        templateName: key.templateName,
        preferredKind: key.kind,
      })

      if (resolved) {
        fileId = resolved.fileId
        // Aktualisiere Inhalt
        await this.provider.updateBinary(fileId, new Blob([markdown], { type: 'text/markdown' }))
      } else {
        throw new Error(`Artefakt existiert, konnte aber nicht aufgelöst werden: ${fileName}`)
      }
    } else {
      // Create: Neue Datei erstellen
      const item = await this.provider.createFile({
        parentId: targetParentId,
        name: fileName,
        mimeType: 'text/markdown',
        content: new Blob([markdown], { type: 'text/markdown' }),
      })
      fileId = item.id
    }

    return {
      id: fileId,
      name: fileName,
    }
  }

  async getBinaryFragments(sourceId: string): Promise<BinaryFragment[] | null> {
    // Provider-Stores haben keine zentrale Binary-Fragment-Verwaltung.
    // Binary-Fragmente sind normalerweise als separate Dateien im Shadow-Twin-Verzeichnis gespeichert.
    // Diese Implementierung gibt null zurück, da wir keine strukturierte Fragment-Liste haben.
    return null
  }
}
