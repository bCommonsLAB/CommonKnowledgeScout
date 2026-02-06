/**
 * @fileoverview Thumbnail-Repair-Service
 * 
 * @description
 * Service für die Reparatur fehlender Thumbnails in Shadow-Twins.
 * Durchsucht alle Shadow-Twins einer Library und generiert Thumbnails
 * für Cover-Bilder, die noch keine Thumbnails haben.
 * 
 * Zusätzlich: Reparatur von fehlenden `variant` Feldern in binaryFragments.
 * 
 * @module image
 */

import { getCollection } from '@/lib/mongodb-service'
import { getShadowTwinCollectionName } from '@/lib/repositories/shadow-twin-repo'
import { 
  generateThumbnail, 
  generateThumbnailFileName, 
  isSupportedImageFormat,
  THUMBNAIL_SIZE,
  THUMBNAIL_FORMAT,
  THUMBNAIL_QUALITY,
} from './thumbnail-generator'
import { AzureStorageService, calculateImageHash } from '@/lib/services/azure-storage-service'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'
import { FileLogger } from '@/lib/debug/logger'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import type { BinaryFragment } from '@/lib/shadow-twin/store/shadow-twin-store'

/**
 * Fortschritt der Thumbnail-Reparatur
 */
export interface ThumbnailRepairProgress {
  /** Aktueller Index (0-basiert) */
  current: number
  /** Gesamtanzahl der zu reparierenden Shadow-Twins */
  total: number
  /** Source-ID des aktuell verarbeiteten Shadow-Twins */
  currentSourceId: string
  /** Aktueller Status */
  status: 'processing' | 'completed' | 'error' | 'skipped'
  /** Fehlerdetails (wenn status === 'error') */
  error?: string
  /** Zusätzliche Informationen */
  message?: string
}

/**
 * Statistik über fehlende Thumbnails
 */
export interface ThumbnailRepairStats {
  /** Gesamtanzahl der Shadow-Twins */
  total: number
  /** Anzahl mit coverImageUrl */
  withCoverImage: number
  /** Anzahl mit fehlendem Thumbnail */
  missingThumbnails: number
  /** Anzahl bereits reparierter (mit Thumbnail) */
  alreadyRepaired: number
}

/**
 * Shadow-Twin Dokument für Thumbnail-Reparatur
 */
interface ShadowTwinForRepair {
  sourceId: string
  sourceName: string
  binaryFragments?: BinaryFragment[]
  artifacts: {
    transcript?: Record<string, { frontmatter?: Record<string, unknown>; markdown: string }>
    transformation?: Record<string, Record<string, { frontmatter?: Record<string, unknown>; markdown: string }>>
  }
}

/**
 * Zählt Shadow-Twins mit fehlenden Thumbnails
 * 
 * @param libraryId Library-ID
 * @returns Statistik über fehlende Thumbnails
 */
export async function countMissingThumbnails(libraryId: string): Promise<ThumbnailRepairStats> {
  const collectionName = getShadowTwinCollectionName(libraryId)
  const col = await getCollection(collectionName)
  
  // Zähle alle Shadow-Twins
  const total = await col.countDocuments({})
  
  // Zähle Shadow-Twins mit coverImageUrl in irgendeinem Artefakt
  // Suche in binaryFragments nach Bildern mit kind === 'image'
  const withCoverImagePipeline = [
    {
      $match: {
        'binaryFragments': { 
          $elemMatch: { 
            kind: 'image',
            url: { $exists: true, $ne: null }
          }
        }
      }
    },
    { $count: 'count' }
  ]
  
  const withCoverImageResult = await col.aggregate(withCoverImagePipeline).toArray()
  const withCoverImage = withCoverImageResult[0]?.count ?? 0
  
  // Zähle Shadow-Twins mit Thumbnail in binaryFragments
  // Ein Thumbnail hat einen Namen der mit "thumb_" beginnt
  const withThumbnailPipeline = [
    {
      $match: {
        'binaryFragments': { 
          $elemMatch: { 
            kind: 'image',
            name: { $regex: /^thumb_/i }
          }
        }
      }
    },
    { $count: 'count' }
  ]
  
  const withThumbnailResult = await col.aggregate(withThumbnailPipeline).toArray()
  const alreadyRepaired = withThumbnailResult[0]?.count ?? 0
  
  // Fehlende Thumbnails = mit Cover-Bild aber ohne Thumbnail
  const missingThumbnails = Math.max(0, withCoverImage - alreadyRepaired)
  
  return {
    total,
    withCoverImage,
    missingThumbnails,
    alreadyRepaired,
  }
}

/**
 * Findet Shadow-Twins mit fehlenden Thumbnails
 * 
 * @param libraryId Library-ID
 * @returns Array von Shadow-Twins, die repariert werden müssen
 */
async function findShadowTwinsWithMissingThumbnails(libraryId: string): Promise<ShadowTwinForRepair[]> {
  const collectionName = getShadowTwinCollectionName(libraryId)
  const col = await getCollection(collectionName)
  
  // Finde Shadow-Twins die:
  // 1. Ein Bild in binaryFragments haben (kind: 'image', url vorhanden)
  // 2. KEIN Thumbnail in binaryFragments haben (name beginnt nicht mit 'thumb_')
  const pipeline = [
    {
      $match: {
        'binaryFragments': { 
          $elemMatch: { 
            kind: 'image',
            url: { $exists: true, $ne: null }
          }
        }
      }
    },
    {
      // Filtere nach Shadow-Twins ohne Thumbnail
      $match: {
        $or: [
          // Kein Thumbnail-Fragment
          {
            'binaryFragments': {
              $not: {
                $elemMatch: {
                  name: { $regex: /^thumb_/i }
                }
              }
            }
          },
          // Keine binaryFragments (sollte durch obigen Match ausgeschlossen sein, aber sicher ist sicher)
          { 'binaryFragments': { $exists: false } }
        ]
      }
    },
    {
      $project: {
        sourceId: 1,
        sourceName: 1,
        binaryFragments: 1,
        artifacts: 1,
      }
    }
  ]
  
  const docs = await col.aggregate(pipeline).toArray()
  return docs as unknown as ShadowTwinForRepair[]
}

/**
 * Lädt ein Bild von einer Azure-URL
 * 
 * @param imageUrl Azure Blob Storage URL
 * @returns Buffer mit dem Bild
 */
async function downloadImageFromUrl(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Fehler beim Laden des Bildes: ${response.status} ${response.statusText}`)
  }
  
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Repariert Thumbnails für alle Shadow-Twins einer Library.
 * Gibt einen AsyncGenerator zurück, der Fortschritts-Updates liefert.
 * 
 * @param libraryId Library-ID
 * @yields ThumbnailRepairProgress mit aktuellem Fortschritt
 */
export async function* repairThumbnailsForLibrary(
  libraryId: string
): AsyncGenerator<ThumbnailRepairProgress> {
  // 1. Finde alle Shadow-Twins mit fehlenden Thumbnails
  const shadowTwins = await findShadowTwinsWithMissingThumbnails(libraryId)
  
  if (shadowTwins.length === 0) {
    yield {
      current: 0,
      total: 0,
      currentSourceId: '',
      status: 'completed',
      message: 'Keine Shadow-Twins mit fehlenden Thumbnails gefunden',
    }
    return
  }
  
  FileLogger.info('thumbnail-repair', 'Starte Thumbnail-Reparatur', {
    libraryId,
    count: shadowTwins.length,
  })
  
  // Azure Storage initialisieren
  const azureConfig = getAzureStorageConfig()
  if (!azureConfig) {
    throw new Error('Azure Storage nicht konfiguriert')
  }
  
  const azureStorage = new AzureStorageService()
  if (!azureStorage.isConfigured()) {
    throw new Error('Azure Storage Service nicht konfiguriert')
  }
  
  const collectionName = getShadowTwinCollectionName(libraryId)
  const col = await getCollection(collectionName)
  
  // 2. Verarbeite jedes Shadow-Twin
  for (let i = 0; i < shadowTwins.length; i++) {
    const twin = shadowTwins[i]
    
    yield {
      current: i,
      total: shadowTwins.length,
      currentSourceId: twin.sourceId,
      status: 'processing',
      message: `Verarbeite ${twin.sourceName || twin.sourceId}`,
    }
    
    try {
      // Finde das Original-Bild in binaryFragments
      const originalImage = twin.binaryFragments?.find(
        f => f.kind === 'image' && f.url && !f.name?.startsWith('thumb_')
      )
      
      if (!originalImage?.url) {
        yield {
          current: i,
          total: shadowTwins.length,
          currentSourceId: twin.sourceId,
          status: 'skipped',
          message: 'Kein Original-Bild gefunden',
        }
        continue
      }
      
      // Prüfe MIME-Type (falls vorhanden)
      if (originalImage.mimeType && !isSupportedImageFormat(originalImage.mimeType)) {
        yield {
          current: i,
          total: shadowTwins.length,
          currentSourceId: twin.sourceId,
          status: 'skipped',
          message: `Bildformat nicht unterstützt: ${originalImage.mimeType}`,
        }
        continue
      }
      
      // 3. Lade Original-Bild von Azure
      const imageBuffer = await downloadImageFromUrl(originalImage.url)
      
      // 4. Generiere Thumbnail (640x640, WebP für HD-Displays)
      // Verwendet zentrale Konfiguration aus thumbnail-generator.ts
      const thumbnailResult = await generateThumbnail(imageBuffer, {
        size: THUMBNAIL_SIZE,
        format: THUMBNAIL_FORMAT,
        quality: THUMBNAIL_QUALITY,
      })
      
      // 5. Lade Thumbnail nach Azure
      const thumbnailHash = calculateImageHash(thumbnailResult.buffer)
      const thumbnailFileName = generateThumbnailFileName(originalImage.name || 'cover', 'webp')
      
      const scope: 'books' | 'sessions' = 'books'
      
      // Prüfe ob Thumbnail bereits existiert
      let thumbnailUrl = await azureStorage.getImageUrlByHashWithScope(
        azureConfig.containerName,
        libraryId,
        scope,
        twin.sourceId,
        thumbnailHash,
        'webp'
      )
      
      if (!thumbnailUrl) {
        // Upload Thumbnail nach Azure
        thumbnailUrl = await azureStorage.uploadImageToScope(
          azureConfig.containerName,
          libraryId,
          scope,
          twin.sourceId,
          thumbnailHash,
          'webp',
          thumbnailResult.buffer
        )
      }
      
      // 6. Füge Thumbnail zu binaryFragments hinzu
      const thumbnailFragment: BinaryFragment = {
        name: thumbnailFileName,
        url: thumbnailUrl,
        hash: thumbnailHash,
        mimeType: 'image/webp',
        size: thumbnailResult.size,
        kind: 'image',
        createdAt: new Date().toISOString(),
        variant: 'thumbnail',
        sourceHash: originalImage.hash,
      }
      
      // Update in MongoDB: Thumbnail hinzufügen
      await col.updateOne(
        { sourceId: twin.sourceId },
        {
          $push: { binaryFragments: thumbnailFragment },
          $set: { updatedAt: new Date().toISOString() },
        } as any // eslint-disable-line @typescript-eslint/no-explicit-any -- MongoDB $push Typisierung ist restriktiv
      )
      
      // Setze variant: 'original' für das Original-Bild (falls noch nicht gesetzt)
      // Verwendet arrayFilters um nur das spezifische Fragment zu aktualisieren
      if (originalImage.hash && !originalImage.variant) {
        await col.updateOne(
          { sourceId: twin.sourceId },
          {
            $set: { 'binaryFragments.$[elem].variant': 'original' }
          },
          {
            arrayFilters: [{ 'elem.hash': originalImage.hash }]
          }
        )
      }
      
      // 7. Patche coverThumbnailUrl in allen Artefakten
      // Suche nach Artefakten mit coverImageUrl im Frontmatter
      // WICHTIG: Verwende thumbnailUrl (Azure-URL) statt thumbnailFileName,
      // damit die URLs direkt in der Galerie funktionieren.
      const artifactUpdates: Record<string, unknown> = {}
      
      // Durchsuche transcript-Artefakte
      if (twin.artifacts?.transcript) {
        for (const [lang, artifact] of Object.entries(twin.artifacts.transcript)) {
          if (artifact.frontmatter?.coverImageUrl && !artifact.frontmatter?.coverThumbnailUrl) {
            const patchedMarkdown = patchFrontmatter(artifact.markdown, { coverThumbnailUrl: thumbnailUrl })
            artifactUpdates[`artifacts.transcript.${lang}.markdown`] = patchedMarkdown
            artifactUpdates[`artifacts.transcript.${lang}.frontmatter.coverThumbnailUrl`] = thumbnailUrl
            artifactUpdates[`artifacts.transcript.${lang}.updatedAt`] = new Date().toISOString()
          }
        }
      }
      
      // Durchsuche transformation-Artefakte
      if (twin.artifacts?.transformation) {
        for (const [templateName, templates] of Object.entries(twin.artifacts.transformation)) {
          for (const [lang, artifact] of Object.entries(templates)) {
            if (artifact.frontmatter?.coverImageUrl && !artifact.frontmatter?.coverThumbnailUrl) {
              const patchedMarkdown = patchFrontmatter(artifact.markdown, { coverThumbnailUrl: thumbnailUrl })
              artifactUpdates[`artifacts.transformation.${templateName}.${lang}.markdown`] = patchedMarkdown
              artifactUpdates[`artifacts.transformation.${templateName}.${lang}.frontmatter.coverThumbnailUrl`] = thumbnailUrl
              artifactUpdates[`artifacts.transformation.${templateName}.${lang}.updatedAt`] = new Date().toISOString()
            }
          }
        }
      }
      
      // Wende Artefakt-Updates an
      if (Object.keys(artifactUpdates).length > 0) {
        await col.updateOne(
          { sourceId: twin.sourceId },
          { $set: artifactUpdates }
        )
      }
      
      FileLogger.info('thumbnail-repair', 'Thumbnail erfolgreich generiert', {
        sourceId: twin.sourceId,
        originalSize: imageBuffer.length,
        thumbnailSize: thumbnailResult.size,
        reduction: `${Math.round((1 - thumbnailResult.size / imageBuffer.length) * 100)}%`,
      })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      FileLogger.error('thumbnail-repair', 'Fehler bei Thumbnail-Generierung', {
        sourceId: twin.sourceId,
        error: errorMessage,
      })
      
      yield {
        current: i,
        total: shadowTwins.length,
        currentSourceId: twin.sourceId,
        status: 'error',
        error: errorMessage,
      }
      
      // Fortfahren mit nächstem Shadow-Twin (nicht abbrechen)
      continue
    }
  }
  
  // Abschluss
  yield {
    current: shadowTwins.length,
    total: shadowTwins.length,
    currentSourceId: '',
    status: 'completed',
    message: `Reparatur abgeschlossen: ${shadowTwins.length} Shadow-Twins verarbeitet`,
  }
}

/**
 * Statistik über fehlende Variant-Felder
 */
export interface VariantRepairStats {
  /** Gesamtanzahl der Shadow-Twins mit binaryFragments */
  total: number
  /** Anzahl der Fragments ohne variant Feld */
  missingVariant: number
  /** Anzahl der bereits korrekten Fragments */
  alreadyCorrect: number
}

/**
 * Zählt binaryFragments mit fehlenden variant Feldern
 * 
 * Wichtig: Nur Bilder (kind: 'image') werden gezählt, da nur diese
 * ein variant Feld benötigen (original/thumbnail).
 * 
 * @param libraryId Library-ID
 * @returns Statistik über fehlende variant Felder
 */
export async function countMissingVariants(libraryId: string): Promise<VariantRepairStats> {
  const collectionName = getShadowTwinCollectionName(libraryId)
  const col = await getCollection(collectionName)
  
  // Zähle Shadow-Twins mit binaryFragments (die Bilder enthalten)
  const withImageFragmentsPipeline = [
    {
      $match: {
        'binaryFragments': { 
          $elemMatch: { kind: 'image' }
        }
      }
    },
    { $count: 'count' }
  ]
  
  const withFragmentsResult = await col.aggregate(withImageFragmentsPipeline).toArray()
  const total = withFragmentsResult[0]?.count ?? 0
  
  // Zähle Bild-Fragments ohne variant Feld
  const missingVariantPipeline = [
    { $unwind: '$binaryFragments' },
    {
      $match: {
        'binaryFragments.kind': 'image',
        'binaryFragments.variant': { $exists: false }
      }
    },
    { $count: 'count' }
  ]
  
  const missingVariantResult = await col.aggregate(missingVariantPipeline).toArray()
  const missingVariant = missingVariantResult[0]?.count ?? 0
  
  // Zähle Bild-Fragments mit variant Feld
  const withVariantPipeline = [
    { $unwind: '$binaryFragments' },
    {
      $match: {
        'binaryFragments.kind': 'image',
        'binaryFragments.variant': { $exists: true }
      }
    },
    { $count: 'count' }
  ]
  
  const withVariantResult = await col.aggregate(withVariantPipeline).toArray()
  const alreadyCorrect = withVariantResult[0]?.count ?? 0
  
  return {
    total,
    missingVariant,
    alreadyCorrect,
  }
}

/**
 * Repariert fehlende variant Felder in binaryFragments.
 * Setzt 'original' für Bilder ohne 'thumb_' Prefix und 'thumbnail' für Thumbnails.
 * 
 * @param libraryId Library-ID
 * @returns Anzahl der reparierten Fragments
 */
export async function repairBinaryFragmentVariants(libraryId: string): Promise<{
  repairedOriginals: number
  repairedThumbnails: number
}> {
  const collectionName = getShadowTwinCollectionName(libraryId)
  const col = await getCollection(collectionName)
  
  FileLogger.info('variant-repair', 'Starte Variant-Reparatur', { libraryId })
  
  // 1. Setze variant: 'original' für alle Bilder ohne 'thumb_' Prefix und ohne variant
  const originalResult = await col.updateMany(
    {
      'binaryFragments': {
        $elemMatch: {
          kind: 'image',
          name: { $not: /^thumb_/i },
          variant: { $exists: false }
        }
      }
    },
    {
      $set: { 
        'binaryFragments.$[elem].variant': 'original',
        updatedAt: new Date().toISOString()
      }
    },
    {
      arrayFilters: [{ 
        'elem.kind': 'image',
        'elem.name': { $not: /^thumb_/i },
        'elem.variant': { $exists: false }
      }]
    }
  )
  
  // 2. Setze variant: 'thumbnail' für alle Bilder mit 'thumb_' Prefix und ohne variant
  const thumbnailResult = await col.updateMany(
    {
      'binaryFragments': {
        $elemMatch: {
          kind: 'image',
          name: /^thumb_/i,
          variant: { $exists: false }
        }
      }
    },
    {
      $set: { 
        'binaryFragments.$[elem].variant': 'thumbnail',
        updatedAt: new Date().toISOString()
      }
    },
    {
      arrayFilters: [{ 
        'elem.kind': 'image',
        'elem.name': /^thumb_/i,
        'elem.variant': { $exists: false }
      }]
    }
  )
  
  // 3. Versuche sourceHash für Thumbnails zu setzen (basierend auf Dateinamen-Matching)
  // Thumbnails haben Namen wie "thumb_cover_generated_2026-02-06.webp"
  // Originale haben Namen wie "cover_generated_2026-02-06.png"
  const docsWithThumbnails = await col.find({
    'binaryFragments': {
      $elemMatch: {
        variant: 'thumbnail',
        sourceHash: { $exists: false }
      }
    }
  }).toArray()
  
  let sourceHashUpdates = 0
  for (const doc of docsWithThumbnails) {
    const fragments = doc.binaryFragments as BinaryFragment[] | undefined
    if (!fragments) continue
    
    for (const thumb of fragments) {
      if (thumb.variant !== 'thumbnail' || thumb.sourceHash) continue
      
      // Versuche das Original zu finden basierend auf dem Dateinamen
      // thumb_cover_generated_2026-02-06.webp → cover_generated_2026-02-06.png
      const baseName = thumb.name?.replace(/^thumb_/, '').replace(/\.[^.]+$/, '')
      if (!baseName) continue
      
      const original = fragments.find(f => 
        f.variant === 'original' && 
        f.name?.replace(/\.[^.]+$/, '') === baseName
      )
      
      if (original?.hash) {
        await col.updateOne(
          { 
            sourceId: doc.sourceId,
            'binaryFragments.name': thumb.name
          },
          {
            $set: { 'binaryFragments.$.sourceHash': original.hash }
          }
        )
        sourceHashUpdates++
      }
    }
  }
  
  const repairedOriginals = originalResult.modifiedCount
  const repairedThumbnails = thumbnailResult.modifiedCount
  
  FileLogger.info('variant-repair', 'Variant-Reparatur abgeschlossen', {
    libraryId,
    repairedOriginals,
    repairedThumbnails,
    sourceHashUpdates,
  })
  
  return { repairedOriginals, repairedThumbnails }
}

/**
 * Regeneriert ALLE Thumbnails einer Library mit der aktuellen Größe (640x640).
 * Im Gegensatz zu repairThumbnailsForLibrary() werden hier auch bereits
 * existierende Thumbnails neu berechnet.
 * 
 * @param libraryId Library-ID
 * @yields Fortschritts-Updates für SSE
 */
export async function* regenerateAllThumbnails(
  libraryId: string
): AsyncGenerator<ThumbnailRepairProgress> {
  FileLogger.info('thumbnail-regenerate', 'Starte Thumbnail-Regenerierung für Library', { libraryId })
  
  const collectionName = getShadowTwinCollectionName(libraryId)
  const col = await getCollection(collectionName)
  
  // Azure Storage konfigurieren
  const azureConfig = getAzureStorageConfig()
  if (!azureConfig) {
    yield {
      current: 0,
      total: 0,
      currentSourceId: '',
      status: 'error',
      error: 'Azure Storage nicht konfiguriert',
    }
    return
  }
  
  const azureStorage = new AzureStorageService()
  if (!azureStorage.isConfigured()) {
    yield {
      current: 0,
      total: 0,
      currentSourceId: '',
      status: 'error',
      error: 'Azure Storage Service nicht konfiguriert',
    }
    return
  }
  
  // Finde alle Shadow-Twins mit Cover-Bildern (Original-Bilder)
  const shadowTwins = await col.find({
    'binaryFragments.variant': 'original'
  }).toArray() as unknown as ShadowTwinForRepair[]
  
  if (shadowTwins.length === 0) {
    yield {
      current: 0,
      total: 0,
      currentSourceId: '',
      status: 'completed',
      message: 'Keine Shadow-Twins mit Cover-Bildern gefunden',
    }
    return
  }
  
  FileLogger.info('thumbnail-regenerate', `Regeneriere Thumbnails für ${shadowTwins.length} Shadow-Twins`, {
    libraryId,
    count: shadowTwins.length,
    newSize: THUMBNAIL_SIZE,
  })
  
  for (let i = 0; i < shadowTwins.length; i++) {
    const twin = shadowTwins[i]
    
    yield {
      current: i,
      total: shadowTwins.length,
      currentSourceId: twin.sourceId,
      status: 'processing',
    }
    
    try {
      const fragments = twin.binaryFragments || []
      
      // Finde das Original-Bild
      const originalImage = fragments.find(f => f.variant === 'original' && f.url)
      
      if (!originalImage?.url) {
        yield {
          current: i,
          total: shadowTwins.length,
          currentSourceId: twin.sourceId,
          status: 'skipped',
          message: 'Kein Original-Bild mit URL gefunden',
        }
        continue
      }
      
      // Prüfe ob das Format unterstützt wird
      if (!isSupportedImageFormat(originalImage.mimeType || '')) {
        yield {
          current: i,
          total: shadowTwins.length,
          currentSourceId: twin.sourceId,
          status: 'skipped',
          message: `Bildformat nicht unterstützt: ${originalImage.mimeType}`,
        }
        continue
      }
      
      // Lade Original-Bild von Azure
      const imageBuffer = await downloadImageFromUrl(originalImage.url)
      
      // Generiere neues Thumbnail mit aktueller Größe (640x640)
      const thumbnailResult = await generateThumbnail(imageBuffer, {
        size: THUMBNAIL_SIZE,
        format: THUMBNAIL_FORMAT,
        quality: THUMBNAIL_QUALITY,
      })
      
      // Neuen Hash für das Thumbnail berechnen
      const thumbnailHash = calculateImageHash(thumbnailResult.buffer)
      const thumbnailFileName = generateThumbnailFileName(originalImage.name || 'cover', 'webp')
      
      const scope: 'books' | 'sessions' = 'books'
      
      // Upload neues Thumbnail nach Azure (ersetzt ggf. altes)
      const thumbnailUrl = await azureStorage.uploadImageToScope(
        azureConfig.containerName,
        libraryId,
        scope,
        twin.sourceId,
        thumbnailHash,
        'webp',
        thumbnailResult.buffer
      )
      
      // Erstelle neues Thumbnail-Fragment
      const newThumbnailFragment: BinaryFragment = {
        name: thumbnailFileName,
        url: thumbnailUrl,
        hash: thumbnailHash,
        mimeType: 'image/webp',
        size: thumbnailResult.size,
        kind: 'image',
        createdAt: new Date().toISOString(),
        variant: 'thumbnail',
        sourceHash: originalImage.hash,
      }
      
      // Entferne altes Thumbnail (falls vorhanden) und füge neues hinzu
      await col.updateOne(
        { sourceId: twin.sourceId },
        {
          $pull: { binaryFragments: { variant: 'thumbnail', sourceHash: originalImage.hash } },
        } as any // eslint-disable-line @typescript-eslint/no-explicit-any -- MongoDB $pull Typisierung ist restriktiv
      )
      
      await col.updateOne(
        { sourceId: twin.sourceId },
        {
          $push: { binaryFragments: newThumbnailFragment },
          $set: { updatedAt: new Date().toISOString() },
        } as any // eslint-disable-line @typescript-eslint/no-explicit-any -- MongoDB $push Typisierung ist restriktiv
      )
      
      // Aktualisiere coverThumbnailUrl in allen Artefakten
      const artifactUpdates: Record<string, unknown> = {}
      
      // Durchsuche transcript-Artefakte
      if (twin.artifacts?.transcript) {
        for (const [lang, artifact] of Object.entries(twin.artifacts.transcript)) {
          if (artifact.frontmatter?.coverImageUrl) {
            const patchedMarkdown = patchFrontmatter(artifact.markdown, { coverThumbnailUrl: thumbnailUrl })
            artifactUpdates[`artifacts.transcript.${lang}.markdown`] = patchedMarkdown
            artifactUpdates[`artifacts.transcript.${lang}.frontmatter.coverThumbnailUrl`] = thumbnailUrl
            artifactUpdates[`artifacts.transcript.${lang}.updatedAt`] = new Date().toISOString()
          }
        }
      }
      
      // Durchsuche transformation-Artefakte
      if (twin.artifacts?.transformation) {
        for (const [templateName, templates] of Object.entries(twin.artifacts.transformation)) {
          for (const [lang, artifact] of Object.entries(templates)) {
            if (artifact.frontmatter?.coverImageUrl) {
              const patchedMarkdown = patchFrontmatter(artifact.markdown, { coverThumbnailUrl: thumbnailUrl })
              artifactUpdates[`artifacts.transformation.${templateName}.${lang}.markdown`] = patchedMarkdown
              artifactUpdates[`artifacts.transformation.${templateName}.${lang}.frontmatter.coverThumbnailUrl`] = thumbnailUrl
              artifactUpdates[`artifacts.transformation.${templateName}.${lang}.updatedAt`] = new Date().toISOString()
            }
          }
        }
      }
      
      // Wende Artefakt-Updates an
      if (Object.keys(artifactUpdates).length > 0) {
        await col.updateOne(
          { sourceId: twin.sourceId },
          { $set: artifactUpdates }
        )
      }
      
      FileLogger.info('thumbnail-regenerate', 'Thumbnail erfolgreich regeneriert', {
        sourceId: twin.sourceId,
        originalSize: imageBuffer.length,
        thumbnailSize: thumbnailResult.size,
        newSize: `${THUMBNAIL_SIZE}x${THUMBNAIL_SIZE}`,
        reduction: `${Math.round((1 - thumbnailResult.size / imageBuffer.length) * 100)}%`,
      })
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      FileLogger.error('thumbnail-regenerate', 'Fehler bei Thumbnail-Regenerierung', {
        sourceId: twin.sourceId,
        error: errorMessage,
      })
      
      yield {
        current: i,
        total: shadowTwins.length,
        currentSourceId: twin.sourceId,
        status: 'error',
        error: errorMessage,
      }
      
      // Fortfahren mit nächstem Shadow-Twin (nicht abbrechen)
      continue
    }
  }
  
  // Abschluss
  yield {
    current: shadowTwins.length,
    total: shadowTwins.length,
    currentSourceId: '',
    status: 'completed',
    message: `${shadowTwins.length} Thumbnails erfolgreich regeneriert (${THUMBNAIL_SIZE}x${THUMBNAIL_SIZE}px)`,
  }
  
  FileLogger.info('thumbnail-regenerate', 'Thumbnail-Regenerierung abgeschlossen', {
    libraryId,
    totalRegenerated: shadowTwins.length,
    newSize: `${THUMBNAIL_SIZE}x${THUMBNAIL_SIZE}`,
  })
}
