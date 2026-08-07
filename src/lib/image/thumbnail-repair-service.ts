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
import { getShadowTwinCollectionName, readTranscriptRecord } from '@/lib/repositories/shadow-twin-repo'
import { 
  generateThumbnail, 
  generateThumbnailFileName, 
  isSupportedImageFormat,
  THUMBNAIL_SIZE,
  THUMBNAIL_FORMAT,
  THUMBNAIL_QUALITY,
} from './thumbnail-generator'
import { AzureStorageService, calculateImageHash } from '@/lib/services/azure-storage-service'
import { resolveAzureStorageConfig } from '@/lib/config/azure-storage'
import { FileLogger } from '@/lib/debug/logger'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import type { BinaryFragment } from '@/lib/shadow-twin/store/shadow-twin-store'
import type { StorageConfig } from '@/types/library'

/**
 * EIN Kriterium fuer alle Pfade (Statistik, Reparatur, Regenerierung) —
 * historisch nutzten die drei Pfade unterschiedliche Erkennungen
 * (Name-Regex vs. variant-Feld), wodurch Statistik und Buttons einander
 * widersprachen.
 */

/** Fragment gilt als Thumbnail: variant-Feld ODER Namens-Praefix. */
const THUMBNAIL_ELEM = {
  kind: 'image',
  $or: [{ variant: 'thumbnail' }, { name: { $regex: /^thumb_/i } }],
}

/**
 * Fragment gilt als Original-Bild: hat URL, ist kein Thumbnail, und der
 * MIME-Typ ist ein Bild (manche Alt-Daten registrieren PDF-Anhaenge als
 * kind='image' — die kann kein Thumbnail bekommen und darf daher auch
 * nicht als "fehlend" zaehlen).
 */
const ORIGINAL_ELEM = {
  kind: 'image',
  url: { $exists: true, $ne: null },
  variant: { $ne: 'thumbnail' },
  name: { $not: /^thumb_/i },
  $or: [{ mimeType: { $exists: false } }, { mimeType: { $regex: /^image\// } }],
}

/** Original-Bild eines Twins im Speicher-Dokument finden (gleiches Kriterium wie ORIGINAL_ELEM). */
function findOriginalImage(fragments: BinaryFragment[] | undefined): BinaryFragment | undefined {
  return fragments?.find(
    (f) =>
      f.kind === 'image' &&
      !!f.url &&
      f.variant !== 'thumbnail' &&
      !/^thumb_/i.test(f.name ?? '') &&
      (!f.mimeType || f.mimeType.startsWith('image/')),
  )
}

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
    // Transkript ist sprach-neutral (ein Record pro Quelle). Legacy-Map wird beim Lesen
    // von readTranscriptRecord() toleriert.
    transcript?: { frontmatter?: Record<string, unknown>; markdown: string; updatedAt?: string }
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

  const total = await col.countDocuments({})
  const withCoverImage = await col.countDocuments({ binaryFragments: { $elemMatch: ORIGINAL_ELEM } })
  const alreadyRepaired = await col.countDocuments({ binaryFragments: { $elemMatch: THUMBNAIL_ELEM } })

  // Echte Mengen-Differenz statt Arithmetik: ein Twin mit Thumbnail aber ohne
  // Original wuerde sonst echte Luecken maskieren.
  const missingThumbnails = await col.countDocuments({
    $and: [
      { binaryFragments: { $elemMatch: ORIGINAL_ELEM } },
      { binaryFragments: { $not: { $elemMatch: THUMBNAIL_ELEM } } },
    ],
  })

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

  // Gleiche Menge wie countMissingThumbnails().missingThumbnails —
  // Statistik und Reparatur duerfen sich nie widersprechen.
  const docs = await col
    .find(
      {
        $and: [
          { binaryFragments: { $elemMatch: ORIGINAL_ELEM } },
          { binaryFragments: { $not: { $elemMatch: THUMBNAIL_ELEM } } },
        ],
      },
      { projection: { sourceId: 1, sourceName: 1, binaryFragments: 1, artifacts: 1 } },
    )
    .toArray()
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
 * @param libraryConfig Library-Config — noetig, damit Library-eigene
 * Azure-Zugangsdaten (ingestionStorage) statt der Prozess-ENV greifen.
 * @yields ThumbnailRepairProgress mit aktuellem Fortschritt
 */
export async function* repairThumbnailsForLibrary(
  libraryId: string,
  libraryConfig?: StorageConfig | null
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
  
  // Azure Storage initialisieren — Library-Config gewinnt vor Prozess-ENV
  const azureConfig = resolveAzureStorageConfig(libraryConfig)
  if (!azureConfig) {
    throw new Error('Azure Storage nicht konfiguriert')
  }

  const azureStorage = new AzureStorageService(libraryConfig)
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
      // Finde das Original-Bild in binaryFragments (gleiches Kriterium wie die Statistik)
      const originalImage = findOriginalImage(twin.binaryFragments)

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
      
      // Transkript-Artefakt (sprach-neutral, ein Record pro Quelle; Helper toleriert Legacy-Map)
      const transcriptRecord = readTranscriptRecord(twin)
      if (transcriptRecord?.frontmatter?.coverImageUrl && !transcriptRecord.frontmatter?.coverThumbnailUrl) {
        const patchedMarkdown = patchFrontmatter(transcriptRecord.markdown, { coverThumbnailUrl: thumbnailUrl })
        artifactUpdates[`artifacts.transcript.markdown`] = patchedMarkdown
        artifactUpdates[`artifacts.transcript.frontmatter.coverThumbnailUrl`] = thumbnailUrl
        artifactUpdates[`artifacts.transcript.updatedAt`] = new Date().toISOString()
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

  // EIN Durchlauf statt drei (frueher 2x $unwind ueber die ganze Collection —
  // das war der "Lade Statistik…"-Haenger bei grossen Libraries).
  const isImage = (cond: object) => ({
    $size: {
      $filter: {
        input: { $ifNull: ['$binaryFragments', []] },
        as: 'f',
        cond: { $and: [{ $eq: ['$$f.kind', 'image'] }, cond] },
      },
    },
  })
  const result = await col
    .aggregate([
      { $match: { binaryFragments: { $elemMatch: { kind: 'image' } } } },
      {
        $project: {
          missing: isImage({ $eq: [{ $type: '$$f.variant' }, 'missing'] }),
          withVariant: isImage({ $ne: [{ $type: '$$f.variant' }, 'missing'] }),
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          missingVariant: { $sum: '$missing' },
          alreadyCorrect: { $sum: '$withVariant' },
        },
      },
    ])
    .toArray()

  return {
    total: result[0]?.total ?? 0,
    missingVariant: result[0]?.missingVariant ?? 0,
    alreadyCorrect: result[0]?.alreadyCorrect ?? 0,
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
 * @param libraryConfig Library-Config (Library-eigene Azure-Zugangsdaten)
 * @yields Fortschritts-Updates für SSE
 */
export async function* regenerateAllThumbnails(
  libraryId: string,
  libraryConfig?: StorageConfig | null
): AsyncGenerator<ThumbnailRepairProgress> {
  FileLogger.info('thumbnail-regenerate', 'Starte Thumbnail-Regenerierung für Library', { libraryId })

  const collectionName = getShadowTwinCollectionName(libraryId)
  const col = await getCollection(collectionName)

  // Azure Storage konfigurieren — Library-Config gewinnt vor Prozess-ENV
  const azureConfig = resolveAzureStorageConfig(libraryConfig)
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
  
  const azureStorage = new AzureStorageService(libraryConfig)
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

  // Finde alle Shadow-Twins mit Original-Bildern — gleiches Kriterium wie
  // die Statistik (withCoverImage), nicht nur Fragmente mit variant-Feld.
  const shadowTwins = await col.find({
    binaryFragments: { $elemMatch: ORIGINAL_ELEM }
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

      // Finde das Original-Bild (gleiches Kriterium wie die Statistik;
      // variant='original' ist dank ORIGINAL_ELEM nicht mehr Voraussetzung)
      const originalImage = findOriginalImage(fragments)

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
      
      // Transkript-Artefakt (sprach-neutral, ein Record pro Quelle; Helper toleriert Legacy-Map)
      const transcriptRecord = readTranscriptRecord(twin)
      if (transcriptRecord?.frontmatter?.coverImageUrl) {
        const patchedMarkdown = patchFrontmatter(transcriptRecord.markdown, { coverThumbnailUrl: thumbnailUrl })
        artifactUpdates[`artifacts.transcript.markdown`] = patchedMarkdown
        artifactUpdates[`artifacts.transcript.frontmatter.coverThumbnailUrl`] = thumbnailUrl
        artifactUpdates[`artifacts.transcript.updatedAt`] = new Date().toISOString()
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
