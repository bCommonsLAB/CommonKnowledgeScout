/**
 * @fileoverview Shadow-Twin Service - Zentrale Orchestrierung für Shadow-Twin Operationen
 *
 * @description
 * Orchestriert Shadow-Twin Operationen über verschiedene Stores (MongoDB, Filesystem/Provider).
 * Entscheidet basierend auf Library-Config, welcher Store verwendet wird und koordiniert Fallbacks.
 * Enthält Domain-Regeln wie "Transformation impliziert Extract".
 *
 * @module shadow-twin/store
 *
 * @exports
 * - ShadowTwinService: Haupt-Service-Klasse
 * - ShadowTwinServiceOptions: Optionen für Service-Erstellung
 */

import type { Library } from '@/types/library'
import type { StorageProvider } from '@/lib/storage/types'
import type { ArtifactKey, ArtifactKind } from '@/lib/shadow-twin/artifact-types'
import type {
  ShadowTwinStore,
  ArtifactMarkdownResult,
  UpsertArtifactResult,
  BinaryFragment,
} from './shadow-twin-store'
import { MongoShadowTwinStore } from './mongo-shadow-twin-store'
import { ProviderShadowTwinStore } from './provider-shadow-twin-store'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getServerProvider } from '@/lib/storage/server-provider'
import { toArtifactKey } from '@/lib/repositories/shadow-twin-repo'
import { buildMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'

export interface ShadowTwinServiceOptions {
  library: Library | null | undefined
  userEmail: string
  sourceId: string
  sourceName: string
  parentId: string
  /**
   * Optional: Bereits erstellter Provider (zur Wiederverwendung).
   * Wenn nicht angegeben, wird ein neuer Provider erstellt.
   */
  provider?: StorageProvider
}

export interface ExistsOptions {
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
  /**
   * Wenn true, wird auch geprüft, ob ein "Superset"-Artefakt existiert.
   * Beispiel: Bei kind='transcript' wird auch nach Transformationen gesucht.
   */
  includeSupersets?: boolean
}

export interface GetMarkdownOptions {
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
}

export interface UpsertMarkdownOptions {
  kind: ArtifactKind
  targetLanguage: string
  templateName?: string
  markdown: string
  binaryFragments?: BinaryFragment[]
}

export interface ResolveSavedItemIdOptions {
  expectedKind: ArtifactKind
  targetLanguage: string
  templateName?: string
}

/**
 * Shadow-Twin Service - Zentrale Orchestrierung.
 */
export class ShadowTwinService {
  private readonly config: ReturnType<typeof getShadowTwinConfig>
  private readonly primaryStore: ShadowTwinStore
  private readonly fallbackStore: ShadowTwinStore | null

  constructor(private readonly options: ShadowTwinServiceOptions) {
    this.config = getShadowTwinConfig(options.library)

    // Primary Store erstellen
    if (this.config.primaryStore === 'mongo') {
      if (!options.library) {
        throw new Error('Library ist erforderlich für MongoDB Store')
      }
      this.primaryStore = new MongoShadowTwinStore(
        options.library.id,
        options.userEmail,
        options.sourceName,
        options.parentId
      )
    } else {
      // Filesystem/Provider Store
      if (!options.provider) {
        throw new Error('Provider ist erforderlich für Filesystem Store')
      }
      this.primaryStore = new ProviderShadowTwinStore(
        options.provider,
        options.sourceName,
        options.parentId
      )
    }

    // Fallback Store (nur wenn erlaubt und unterschiedlich zum Primary)
    if (
      this.config.allowFilesystemFallback &&
      this.config.primaryStore === 'mongo' &&
      options.provider
    ) {
      this.fallbackStore = new ProviderShadowTwinStore(
        options.provider,
        options.sourceName,
        options.parentId
      )
    } else {
      this.fallbackStore = null
    }
  }

  /**
   * Prüft, ob ein Artefakt existiert.
   *
   * @param opts Existenz-Optionen
   * @returns true wenn das Artefakt existiert, sonst false
   */
  async exists(opts: ExistsOptions): Promise<boolean> {
    const key: ArtifactKey = {
      sourceId: this.options.sourceId,
      kind: opts.kind,
      targetLanguage: opts.targetLanguage,
      templateName: opts.templateName,
    }

    // 1. Prüfe Primary Store
    const existsInPrimary = await this.primaryStore.existsArtifact(key)
    if (existsInPrimary) return true

    // 2. Domain-Regel: Transformation impliziert Extract
    // Wenn wir nach Transcript suchen und includeSupersets=true,
    // prüfe auch Transformationen (die fachlich Transcript enthalten).
    if (opts.kind === 'transcript' && opts.includeSupersets && opts.templateName) {
      const transformationKey: ArtifactKey = {
        sourceId: this.options.sourceId,
        kind: 'transformation',
        targetLanguage: opts.targetLanguage,
        templateName: opts.templateName,
      }
      const transformationExists = await this.primaryStore.existsArtifact(transformationKey)
      if (transformationExists) return true
    }

    // 3. Fallback Store (wenn erlaubt)
    if (this.fallbackStore) {
      const existsInFallback = await this.fallbackStore.existsArtifact(key)
      if (existsInFallback) return true

      // Auch Superset-Check im Fallback
      if (opts.kind === 'transcript' && opts.includeSupersets && opts.templateName) {
        const transformationKey: ArtifactKey = {
          sourceId: this.options.sourceId,
          kind: 'transformation',
          targetLanguage: opts.targetLanguage,
          templateName: opts.templateName,
        }
        const transformationExists = await this.fallbackStore.existsArtifact(transformationKey)
        if (transformationExists) return true
      }
    }

    return false
  }

  /**
   * Lädt ein Markdown-Artefakt.
   *
   * @param opts Markdown-Optionen
   * @returns Artefakt-Daten oder null wenn nicht gefunden
   */
  async getMarkdown(opts: GetMarkdownOptions): Promise<ArtifactMarkdownResult | null> {
    const key: ArtifactKey = {
      sourceId: this.options.sourceId,
      kind: opts.kind,
      targetLanguage: opts.targetLanguage,
      templateName: opts.templateName,
    }

    // 1. Primary Store
    const result = await this.primaryStore.getArtifactMarkdown(key)
    if (result) return result

    // 2. Fallback Store (wenn erlaubt)
    if (this.fallbackStore) {
      const fallbackResult = await this.fallbackStore.getArtifactMarkdown(key)
      if (fallbackResult) return fallbackResult
    }

    return null
  }

  /**
   * Speichert oder aktualisiert ein Markdown-Artefakt.
   *
   * @param opts Upsert-Optionen
   * @returns Ergebnis mit ID und Name des gespeicherten Artefakts
   */
  async upsertMarkdown(opts: UpsertMarkdownOptions): Promise<UpsertArtifactResult> {
    // Domain-Regel: Leere Artefakte sind fast immer ein Fehler (z.B. Audio-Transkript leer).
    // Wir werfen hier absichtlich früh, damit Jobs/Tests nicht "completed" werden,
    // obwohl nichts Nutzbares gespeichert wurde.
    if (typeof opts.markdown !== 'string' || opts.markdown.trim().length === 0) {
      const template = opts.templateName ? `, template=${opts.templateName}` : ''
      throw new Error(
        `ShadowTwin: Leeres Markdown darf nicht gespeichert werden (kind=${opts.kind}, lang=${opts.targetLanguage}${template}, source=${this.options.sourceName})`
      )
    }

    const key: ArtifactKey = {
      sourceId: this.options.sourceId,
      kind: opts.kind,
      targetLanguage: opts.targetLanguage,
      templateName: opts.templateName,
    }

    const context = {
      libraryId: this.options.library?.id || '',
      userEmail: this.options.userEmail,
      sourceName: this.options.sourceName,
      parentId: this.options.parentId,
    }

    // 1. Primary Store speichern
    const result = await this.primaryStore.upsertArtifact(key, opts.markdown, opts.binaryFragments, context)

    // 2. Wenn persistToFilesystem=true, auch im Filesystem speichern
    if (this.config.persistToFilesystem && this.config.primaryStore === 'mongo' && this.fallbackStore) {
      // Optional: Auch im Filesystem speichern (für Kompatibilität)
      // Hinweis: Dies könnte zu Duplikaten führen, daher optional
      try {
        await this.fallbackStore.upsertArtifact(key, opts.markdown, opts.binaryFragments, context)
      } catch (error) {
        // Fehler beim Filesystem-Write nicht kritisch, wenn Primary erfolgreich war
        // Logging könnte hier sinnvoll sein
      }
    }

    return result
  }

  /**
   * Lädt alle Binary-Fragmente für die Quelle.
   *
   * @returns Array von Binary-Fragmenten oder null wenn nicht gefunden
   */
  async getBinaryFragments(): Promise<BinaryFragment[] | null> {
    // 1. Primary Store
    const fragments = await this.primaryStore.getBinaryFragments(this.options.sourceId)
    if (fragments) return fragments

    // 2. Fallback Store (wenn erlaubt)
    if (this.fallbackStore) {
      const fallbackFragments = await this.fallbackStore.getBinaryFragments(this.options.sourceId)
      if (fallbackFragments) return fallbackFragments
    }

    return null
  }

  /**
   * Löst eine savedItemId für den Contract auf.
   * Prüft, ob ein Artefakt des erwarteten Typs existiert und gibt eine gültige ID zurück.
   *
   * @param opts Contract-Optionen
   * @returns savedItemId oder null wenn nicht gefunden
   */
  async resolveSavedItemIdForContract(opts: ResolveSavedItemIdOptions): Promise<string | null> {
    const key: ArtifactKey = {
      sourceId: this.options.sourceId,
      kind: opts.expectedKind,
      targetLanguage: opts.targetLanguage,
      templateName: opts.templateName,
    }

    // 1. Prüfe Primary Store
    const primaryResult = await this.primaryStore.getArtifactMarkdown(key)
    if (primaryResult) {
      // Validierung: Prüfe, ob die ID zum erwarteten Typ passt
      if (this.validateSavedItemId(primaryResult.id, opts.expectedKind, opts.templateName)) {
        return primaryResult.id
      }
    }

    // 2. Fallback Store (wenn erlaubt)
    if (this.fallbackStore) {
      const fallbackResult = await this.fallbackStore.getArtifactMarkdown(key)
      if (fallbackResult) {
        if (this.validateSavedItemId(fallbackResult.id, opts.expectedKind, opts.templateName)) {
          return fallbackResult.id
        }
      }
    }

    return null
  }

  /**
   * Validiert, ob eine savedItemId zum erwarteten Artefakt-Typ passt.
   */
  private validateSavedItemId(
    id: string,
    expectedKind: ArtifactKind,
    expectedTemplateName?: string
  ): boolean {
    // MongoDB-IDs direkt validieren
    if (isMongoShadowTwinId(id)) {
      const parsed = parseMongoShadowTwinId(id)
      if (!parsed) return false

      const isExpectedKind = parsed.kind === expectedKind
      const isExpectedTemplate =
        expectedKind === 'transformation'
          ? !expectedTemplateName ||
            !parsed.templateName ||
            parsed.templateName.toLowerCase() === expectedTemplateName.toLowerCase()
          : true

      return isExpectedKind && isExpectedTemplate
    }

    // Provider-IDs: Validierung erfolgt über Dateinamen (wird in getMarkdown gemacht)
    // Hier akzeptieren wir sie erstmal, detaillierte Validierung sollte über Provider erfolgen
    return true
  }

  /**
   * Factory-Methode: Erstellt einen Service mit automatischer Provider-Erstellung.
   */
  static async create(opts: Omit<ShadowTwinServiceOptions, 'provider'>): Promise<ShadowTwinService> {
    let provider: StorageProvider | undefined

    // Provider nur erstellen, wenn benötigt (Filesystem primary oder Fallback)
    const config = getShadowTwinConfig(opts.library)
    if (config.primaryStore === 'filesystem' || config.allowFilesystemFallback) {
      if (!opts.library) {
        throw new Error('Library ist erforderlich für Provider-Erstellung')
      }
      provider = await getServerProvider(opts.userEmail, opts.library.id)
    }

    return new ShadowTwinService({ ...opts, provider })
  }
}
