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
import { toArtifactKey, upsertShadowTwinBinaryFragment } from '@/lib/repositories/shadow-twin-repo'
import { buildMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { AzureStorageService, calculateImageHash } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'
import { FileLogger } from '@/lib/debug/logger'
import path from 'path'

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
 * Optionen für Binary-Fragment-Upload
 */
export interface UploadBinaryFragmentOptions {
  /** Buffer mit den Binärdaten */
  buffer: Buffer
  /** Dateiname (z.B. "cover_generated_2026-01-27.png") */
  fileName: string
  /** MIME-Type (z.B. "image/png") */
  mimeType: string
  /** Art des Fragments */
  kind: 'image' | 'audio' | 'video'
}

/**
 * Ergebnis eines Binary-Fragment-Uploads
 */
export interface UploadBinaryFragmentResult extends BinaryFragment {
  /** Aufgelöste URL (Azure oder Storage-API) */
  resolvedUrl: string
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
   * Löst die URL eines Binary-Fragments nach Namen auf.
   * 
   * Diese Methode kapselt die Storage-Abstraktion:
   * - Wenn Azure-URL vorhanden → direkt verwenden
   * - Wenn nur fileId vorhanden → Storage-API-URL generieren
   * 
   * @param fragmentName Name des Fragments (z.B. "cover_generated_2026-01-20_12-20-43.png")
   * @returns URL zum Fragment oder null wenn nicht gefunden
   */
  async resolveBinaryFragmentUrl(fragmentName: string): Promise<string | null> {
    const fragments = await this.getBinaryFragments()
    if (!fragments) return null

    // Suche Fragment nach Namen (case-insensitive)
    const fragment = fragments.find(
      f => f.name.toLowerCase() === fragmentName.toLowerCase()
    )
    if (!fragment) return null

    // 1. Bevorzugt: Azure Blob Storage URL
    if (fragment.url) {
      return fragment.url
    }

    // 2. Fallback: Dateisystem-Referenz → Storage-API-URL generieren
    if (fragment.fileId && this.options.library?.id) {
      // Generiere Storage-API-URL für Dateisystem-Zugriff
      const libraryId = this.options.library.id
      return `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(fragment.fileId)}&libraryId=${encodeURIComponent(libraryId)}`
    }

    return null
  }

  /**
   * Löst alle Binary-Fragmente mit ihren URLs auf.
   * 
   * Gibt alle Fragmente mit aufgelösten URLs zurück (Azure oder Storage-API).
   * 
   * @returns Array von Fragmenten mit aufgelösten URLs
   */
  async resolveAllBinaryFragmentUrls(): Promise<Array<BinaryFragment & { resolvedUrl?: string }>> {
    const fragments = await this.getBinaryFragments()
    if (!fragments) return []

    const libraryId = this.options.library?.id

    return fragments.map(fragment => {
      let resolvedUrl: string | undefined

      // 1. Bevorzugt: Azure Blob Storage URL
      if (fragment.url) {
        resolvedUrl = fragment.url
      }
      // 2. Fallback: Dateisystem-Referenz → Storage-API-URL generieren
      else if (fragment.fileId && libraryId) {
        resolvedUrl = `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(fragment.fileId)}&libraryId=${encodeURIComponent(libraryId)}`
      }

      return {
        ...fragment,
        resolvedUrl,
      }
    })
  }

  /**
   * Lädt ein Binary-Fragment hoch (z.B. Cover-Bild).
   * 
   * Verwendet automatisch den korrekten Storage basierend auf der Konfiguration:
   * - MongoDB-Modus: Upload nach Azure, Fragment in MongoDB speichern
   * - Filesystem-Modus: Upload via Provider, Storage-API-URL generieren
   * 
   * @param opts Upload-Optionen mit Buffer, Dateiname, MIME-Type und Kind
   * @returns Fragment mit aufgelöster URL
   */
  async uploadBinaryFragment(opts: UploadBinaryFragmentOptions): Promise<UploadBinaryFragmentResult> {
    const { buffer, fileName, mimeType, kind } = opts

    // Ermittle Extension aus Dateiname
    const extension = path.extname(fileName).toLowerCase().slice(1) || 'jpg'

    // Berechne Hash für Deduplizierung
    const hash = calculateImageHash(buffer)
    const size = buffer.length
    const createdAt = new Date().toISOString()

    // MongoDB-Modus: Upload nach Azure
    if (this.config.primaryStore === 'mongo') {
      const azureConfig = getAzureStorageConfig()
      if (!azureConfig) {
        throw new Error('Azure Storage nicht konfiguriert für MongoDB-Modus')
      }

      const azureStorage = new AzureStorageService()
      if (!azureStorage.isConfigured()) {
        throw new Error('Azure Storage Service nicht konfiguriert')
      }

      const libraryId = this.options.library?.id
      if (!libraryId) {
        throw new Error('Library-ID erforderlich für Azure-Upload')
      }

      // Prüfe ob Container existiert
      const containerExists = await azureStorage.containerExists(azureConfig.containerName)
      if (!containerExists) {
        throw new Error(`Azure Container '${azureConfig.containerName}' existiert nicht`)
      }

      // Scope basierend auf Kind (Bilder gehen zu 'books')
      const scope: 'books' | 'sessions' = 'books'

      // Prüfe ob Bild bereits existiert (Deduplizierung)
      const existingUrl = await azureStorage.getImageUrlByHashWithScope(
        azureConfig.containerName,
        libraryId,
        scope,
        this.options.sourceId,
        hash,
        extension
      )

      let azureUrl: string
      if (existingUrl) {
        // Bild existiert bereits, verwende vorhandene URL
        azureUrl = existingUrl
        FileLogger.info('shadow-twin-service', 'Binary-Fragment existiert bereits in Azure', {
          fileName,
          hash,
          azureUrl,
        })
      } else {
        // Upload nach Azure
        azureUrl = await azureStorage.uploadImageToScope(
          azureConfig.containerName,
          libraryId,
          scope,
          this.options.sourceId,
          hash,
          extension,
          buffer
        )
        FileLogger.info('shadow-twin-service', 'Binary-Fragment nach Azure hochgeladen', {
          fileName,
          hash,
          azureUrl,
          size,
        })
      }

      // Fragment mit Azure-URL erstellen
      const fragment: UploadBinaryFragmentResult = {
        name: fileName,
        url: azureUrl,
        hash,
        mimeType,
        size,
        kind,
        resolvedUrl: azureUrl,
      }

      // In MongoDB speichern
      await upsertShadowTwinBinaryFragment(libraryId, this.options.sourceId, {
        name: fileName,
        url: azureUrl,
        hash,
        mimeType,
        size,
        kind,
        createdAt,
      })

      return fragment
    }

    // Filesystem-Modus: Upload via Provider
    if (!this.options.provider) {
      throw new Error('Provider erforderlich für Filesystem-Upload')
    }

    // Ermittle Shadow-Twin-Verzeichnis
    const shadowTwinFolderName = `.${this.options.sourceName}`
    const parentItem = await this.options.provider.getItemById(this.options.parentId)
    if (!parentItem) {
      throw new Error('Parent-Ordner nicht gefunden')
    }

    // Suche oder erstelle Shadow-Twin-Verzeichnis
    const shadowTwinItems = await this.options.provider.listContents(this.options.parentId)
    let shadowTwinFolder = shadowTwinItems.items.find(
      item => item.type === 'folder' && item.metadata.name === shadowTwinFolderName
    )

    if (!shadowTwinFolder) {
      // Erstelle Shadow-Twin-Verzeichnis
      shadowTwinFolder = await this.options.provider.createFolder(this.options.parentId, shadowTwinFolderName)
    }

    // Erstelle File-Objekt für Upload
    const blob = new Blob([buffer], { type: mimeType })
    const file = new File([blob], fileName, { type: mimeType })

    // Upload via Provider
    const uploadedItem = await this.options.provider.uploadFile(shadowTwinFolder.id, file)

    // Generiere Storage-API-URL
    const libraryId = this.options.library?.id || ''
    const resolvedUrl = `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(uploadedItem.id)}&libraryId=${encodeURIComponent(libraryId)}`

    FileLogger.info('shadow-twin-service', 'Binary-Fragment ins Dateisystem hochgeladen', {
      fileName,
      fileId: uploadedItem.id,
      resolvedUrl,
    })

    return {
      name: fileName,
      fileId: uploadedItem.id,
      hash,
      mimeType,
      size,
      kind,
      resolvedUrl,
    }
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
   * Patcht das Frontmatter eines existierenden Artefakts.
   * 
   * Lädt das Markdown, patcht das Frontmatter mit den übergebenen Werten,
   * und speichert es wieder. Funktioniert für MongoDB und Filesystem.
   * 
   * WICHTIG: Wenn templateName nicht angegeben wird, wird es automatisch
   * aus dem existierenden Artefakt ermittelt (für Transformationen).
   * 
   * @param opts Optionen mit kind, targetLanguage, templateName und patches
   * @returns Aktualisiertes Markdown und Ergebnis-Informationen
   */
  async patchArtifactFrontmatter(opts: {
    kind: ArtifactKind
    targetLanguage: string
    templateName?: string
    patches: Record<string, unknown>
  }): Promise<{ markdown: string; id: string }> {
    const { kind, targetLanguage, patches } = opts
    let { templateName } = opts

    // 1. Lade existierendes Artefakt
    // getMarkdown() kann Transformationen auch ohne templateName finden
    const existing = await this.getMarkdown({ kind, targetLanguage, templateName })
    if (!existing) {
      throw new Error(`Artefakt nicht gefunden: kind=${kind}, lang=${targetLanguage}, template=${templateName}`)
    }

    // 2. Für Transformationen ist templateName PFLICHT (deterministische Architektur)
    // Der Caller MUSS templateName liefern - wir raten nicht!
    // Einzige Ausnahme: Wenn das Artefakt gefunden wurde UND die ID das templateName enthält,
    // können wir es als Validierung/Korrektur verwenden.
    if (kind === 'transformation') {
      if (!templateName) {
        // Versuche templateName aus der gefundenen ID zu extrahieren (als letzter Ausweg)
        if (isMongoShadowTwinId(existing.id)) {
          const parsed = parseMongoShadowTwinId(existing.id)
          if (parsed?.templateName) {
            templateName = parsed.templateName
            FileLogger.warn('shadow-twin-service', 'templateName aus ID extrahiert - Caller sollte templateName liefern', {
              sourceId: this.options.sourceId,
              templateName,
              id: existing.id,
            })
          }
        }
      }
      
      // Wenn immer noch kein templateName, ist das ein Fehler im Caller
      if (!templateName) {
        throw new Error(
          `templateName ist PFLICHT für Transformationen. ` +
          `Caller muss templateName explizit übergeben. ` +
          `sourceId=${this.options.sourceId}`
        )
      }
    }

    // 3. Patche das Frontmatter
    // Import dynamisch, um zirkuläre Abhängigkeiten zu vermeiden
    const { patchFrontmatter } = await import('@/lib/markdown/frontmatter-patch')
    const updatedMarkdown = patchFrontmatter(existing.markdown, patches)

    // 4. Speichere aktualisiertes Markdown mit ermitteltem templateName
    const result = await this.upsertMarkdown({
      kind,
      targetLanguage,
      templateName,
      markdown: updatedMarkdown,
    })

    FileLogger.info('shadow-twin-service', 'Artefakt-Frontmatter gepatcht', {
      sourceId: this.options.sourceId,
      kind,
      targetLanguage,
      templateName,
      patchedKeys: Object.keys(patches),
    })

    return {
      markdown: updatedMarkdown,
      id: result.id,
    }
  }

  /**
   * Kombinierte Methode: Lädt ein Bild hoch und setzt coverImageUrl im Frontmatter.
   * 
   * Diese Methode abstrahiert den gesamten Cover-Bild-Workflow:
   * 1. Bild hochladen (Azure oder Filesystem)
   * 2. Fragment in MongoDB/Filesystem registrieren
   * 3. Frontmatter mit coverImageUrl patchen
   * 
   * @param opts Upload-Optionen mit Buffer, Dateiname, MIME-Type, Kind und Artefakt-Infos
   * @returns Fragment-Info und aktualisiertes Markdown
   */
  async uploadCoverImageAndPatchFrontmatter(opts: {
    buffer: Buffer
    fileName: string
    mimeType: string
    kind: ArtifactKind
    targetLanguage: string
    templateName?: string
  }): Promise<{
    fragment: UploadBinaryFragmentResult
    markdown: string
    artifactId: string
  }> {
    const { buffer, fileName, mimeType, kind, targetLanguage, templateName } = opts

    // 1. Bild hochladen
    const fragment = await this.uploadBinaryFragment({
      buffer,
      fileName,
      mimeType,
      kind: 'image',
    })

    // 2. Frontmatter mit coverImageUrl patchen
    const patchResult = await this.patchArtifactFrontmatter({
      kind,
      targetLanguage,
      templateName,
      patches: { coverImageUrl: fragment.name },
    })

    FileLogger.info('shadow-twin-service', 'Cover-Bild hochgeladen und Frontmatter gepatcht', {
      sourceId: this.options.sourceId,
      imageName: fragment.name,
      resolvedUrl: fragment.resolvedUrl,
      artifactId: patchResult.id,
    })

    return {
      fragment,
      markdown: patchResult.markdown,
      artifactId: patchResult.id,
    }
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
