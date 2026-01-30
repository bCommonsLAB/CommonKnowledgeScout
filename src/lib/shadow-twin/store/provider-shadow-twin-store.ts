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
    } catch {
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
        // Aktualisiere Inhalt: Lösche alte Datei und erstelle neue
        await this.provider.deleteItem(fileId)
        // Erstelle die Datei neu mit uploadFile
        const newFile = await this.provider.uploadFile(
          targetParentId,
          new File([markdown], fileName, { type: 'text/markdown' })
        )
        fileId = newFile.id
      } else {
        throw new Error(`Artefakt existiert, konnte aber nicht aufgelöst werden: ${fileName}`)
      }
    } else {
      // Create: Neue Datei erstellen mit uploadFile
      const item = await this.provider.uploadFile(
        targetParentId,
        new File([markdown], fileName, { type: 'text/markdown' })
      )
      fileId = item.id
    }

    return {
      id: fileId,
      name: fileName,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBinaryFragments(_sourceId: string): Promise<BinaryFragment[] | null> {
    // Provider-Stores haben keine zentrale Binary-Fragment-Verwaltung.
    // Binary-Fragmente sind normalerweise als separate Dateien im Shadow-Twin-Verzeichnis gespeichert.
    // Diese Implementierung gibt null zurück, da wir keine strukturierte Fragment-Liste haben.
    return null
  }
}
