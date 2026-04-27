/**
 * @fileoverview Media Persistence Service
 *
 * @description
 * Zentraler, einziger Eintrittspunkt fuer das Persistieren bildlicher Binaerfragmente
 * von Shadow-Twins. Ersetzt den frueheren if/else-Spaghetti im `shadow-twin-mongo-writer`.
 *
 * Die Funktion `persistOcrImages()` entscheidet anhand der von `getMediaStorageStrategy()`
 * gelieferten Strategie deterministisch:
 *  - ob Bilder nach Azure hochgeladen werden,
 *  - ob zusaetzlich der Filesystem-Pfad (Backup-Spiegel) bedient wird,
 *  - ob ein zweiter ImageProcessor-Lauf ueber relative Pfade noetig ist,
 *  - oder ob die Konfiguration unvollstaendig ist und ein harter Fehler geworfen werden muss.
 *
 * @module shadow-twin
 *
 * @exports
 * - PersistOcrImagesArgs
 * - PersistOcrImagesResult
 * - persistOcrImages
 *
 * @usedIn
 * - src/lib/shadow-twin/shadow-twin-mongo-writer.ts (einziger Aufrufer; ersetzt die alte Inline-Logik)
 *
 * @dependencies
 * - @/lib/shadow-twin/media-storage-strategy: Strategie-Funktion
 * - @/lib/shadow-twin/shadow-twin-direct-upload: ZIP -> Azure Direkt-Upload
 * - @/lib/ingestion/image-processor: Filesystem-basierte Bild-URL-Aufloesung (Legacy/Backup)
 * - @/lib/services/library-service, @/lib/config/azure-storage: Library-Doc + Azure-Verfuegbarkeit
 * - @/lib/external-jobs-log-buffer: Trace-Events
 */

import type { StorageProvider } from '@/lib/storage/types'
import { LibraryService } from '@/lib/services/library-service'
import { resolveAzureStorageConfig } from '@/lib/config/azure-storage'
import { ImageProcessor } from '@/lib/ingestion/image-processor'
import { uploadImagesFromZipDirectly } from './shadow-twin-direct-upload'
import { getMediaStorageStrategy, type MediaStorageStrategy } from './media-storage-strategy'
import { matchBinaryFragmentByLookupName, type BinaryFragmentLookupFields } from './binary-fragment-lookup'
import { FileLogger } from '@/lib/debug/logger'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

/** ZIP-Archiv aus dem OCR-Schritt (z.B. von Mistral-OCR), enthaelt extrahierte Bilder. */
export interface ZipArchiveInput {
  base64Data: string
  fileName: string
  /**
   * Optional: Hint fuer den Direct-Upload, dass dieses ZIP komplette Seitenrenderings enthaelt
   * (Mistral `pages_archive`). Konsequenz im Direct-Upload:
   * - Dateinamen werden auf `page_NNN.<ext>` normalisiert.
   * - Die zurueckgegebenen `UploadedImageMetadata`-Eintraege bekommen `variant='page-render'` + `pageNumber`.
   * - Der Mongo-Writer persistiert diese Eintraege auch dann als binaryFragments, wenn sie nicht
   *   im Markdown referenziert sind (= bisheriger Verlust-Fall).
   */
  variantHint?: 'page-render'
}

/** Metadaten eines hochgeladenen Bildes; spiegelt das Format aus shadow-twin-direct-upload. */
export interface UploadedImageMetadata {
  fileName: string
  url: string
  hash: string
  size: number
  mimeType: string
  /**
   * Optional: Variant-Klassifikation des Bildes.
   *  - 'page-render': HighRes-Seitenrendering (200 DPI), Quelle fuer Split-Pages-Funktion.
   *  - 'thumbnail':   Vorschau-Seitenrendering (~360 px), fuer UI-Thumbnails.
   */
  variant?: 'page-render' | 'thumbnail'
  /** Optional: 1-basierte Seitennummer (bei variant='page-render' oder 'thumbnail'). */
  pageNumber?: number
}

/** Mapping eines im Markdown ersetzten Bildpfads -> Azure-URL. */
export interface ImageRewriteMapping {
  originalPath: string
  azureUrl: string
}

export interface PersistOcrImagesArgs {
  /** Library-ID, ueber die Library-Doc + Azure-Konfig aufgeloest werden. */
  libraryId: string
  /** Storage-ID des Quelldokuments (z.B. PDF-Original). */
  sourceItemId: string
  /** Markdown aus OCR mit ggf. relativen Bildreferenzen. */
  markdown: string
  /** Optionaler Storage-Provider fuer den Filesystem-Lese-/Backup-Pfad. */
  provider?: StorageProvider
  /** Shadow-Twin-Ordner, falls vorhanden (nur fuer Filesystem-Pfade relevant). */
  shadowTwinFolderId?: string
  /**
   * Optional: ZIP-Archive aus dem OCR-Schritt. Wenn vorhanden, ist das der schnellste Pfad
   * (kein Umweg ueber Filesystem-Provider). Bei Strategien `azure-only` / `azure-with-fs-backup`
   * wird er bevorzugt verwendet.
   */
  zipArchives?: ZipArchiveInput[]
  /** Optional: Job-ID fuer Trace-/Buffer-Logs. */
  jobId?: string
}

/**
 * Diagnose-Felder fuer Trace/Logging.
 * Werden vom Aufrufer in `extract_only_mongo_saved`-Trace-Event geschrieben, damit wir im
 * Trace eindeutig sehen, ob der Direct-Upload-Pfad lief oder ob auf den ImageProcessor
 * zurueckgefallen wurde (= Quelle des "Bild nicht gefunden"-Spams im Status quo).
 */
export interface PersistOcrImagesDiagnostics {
  /** Wahr, wenn `zipArchives` mit mindestens einem Eintrag hereinkam. */
  hasZip: boolean
  /** Anzahl uebergebener ZIP-Archive (vor Verarbeitung). */
  zipArchiveCount: number
  /** Wahr, wenn der schnelle ZIP -> Azure-Direkt-Upload-Pfad lief. */
  ranDirectUpload: boolean
  /** Wahr, wenn der ImageProcessor (Filesystem-Pfad) lief (Backup oder einziger Pfad). */
  ranImageProcessor: boolean
}

export interface PersistOcrImagesResult {
  /** Markdown nach Bild-Verarbeitung (Pfade ggf. durch absolute Azure-URLs ersetzt). */
  markdown: string
  /** Bild-Metadaten aus dem Direct-Upload (leer im Filesystem-Pfad). */
  imageMetadata: UploadedImageMetadata[]
  /** Mapping aus dem ImageProcessor-Lauf (leer im reinen ZIP-Pfad). */
  imageMapping: ImageRewriteMapping[]
  /** Liste der Bilder, die nicht aufgeloest werden konnten. */
  imageErrors: Array<{ imagePath: string; error: string }>
  /** Effektiv eingesetzte Strategie (zur Weitergabe an Aufrufer/Logs). */
  strategy: MediaStorageStrategy
  /** Diagnose-Felder fuer Trace/Logging (welcher Pfad lief tatsaechlich?). */
  diagnostics: PersistOcrImagesDiagnostics
}

/**
 * Einziger Eintrittspunkt fuer OCR-Bild-Persistenz in Shadow-Twins.
 *
 * Verhalten je Strategie:
 *  - `unavailable`     : wirft sofort, bevor irgendwas geschrieben wird (kein Silent-Drop).
 *  - `azure-only`      : nur Direkt-Upload nach Azure (oder ImageProcessor-Azure-Pfad als Fallback).
 *                        Kein Filesystem-Schreiben. Kein Filesystem-Lesefallback.
 *  - `azure-with-fs-backup`: Direkt-Upload nach Azure + ImageProcessor laeuft zusaetzlich
 *                        ueber relative Pfade (fuer Bilder, die NICHT im ZIP liegen, z.B. spaeter
 *                        ergaenzte Inline-Bilder).
 *  - `filesystem-only` : alter Pfad ueber ImageProcessor.processMarkdownImages().
 */
export async function persistOcrImages(
  args: PersistOcrImagesArgs,
): Promise<PersistOcrImagesResult> {
  const { libraryId, sourceItemId, markdown, provider, shadowTwinFolderId, zipArchives, jobId } = args

  // 1) Library-Doc + Azure-Verfuegbarkeit aufloesen, daraus Strategie ableiten.
  const libraryDoc = await LibraryService.getInstance().getLibraryById(libraryId)
  const libraryConfig = libraryDoc?.config
  const azureConfigured = resolveAzureStorageConfig(libraryConfig) !== null
  const strategy = getMediaStorageStrategy(libraryDoc, azureConfigured)

  // Trace: einmal pro Aufruf, mit voller Strategie (statt frueher dutzender Filesystem-Spam-Logs).
  if (jobId) {
    bufferLog(jobId, {
      phase: 'media_persist_started',
      message: `Bild-Persistenz gestartet (Modus=${strategy.mode})`,
      mode: strategy.mode,
      writeToAzure: strategy.writeToAzure,
      writeToFilesystem: strategy.writeToFilesystem,
      zipArchiveCount: zipArchives?.length ?? 0,
      hasShadowTwinFolderId: Boolean(shadowTwinFolderId),
    })
  }
  FileLogger.info('media-persistence-service', 'Strategie ermittelt', {
    libraryId,
    sourceItemId,
    mode: strategy.mode,
    rationale: strategy.rationale,
  })

  // 2) `unavailable` -> harter Abbruch.
  if (strategy.mode === 'unavailable') {
    const err = new Error(
      `Media-Storage nicht verfuegbar: ${strategy.rationale}`,
    )
    if (jobId) {
      bufferLog(jobId, {
        phase: 'media_persist_failed',
        message: err.message,
        mode: strategy.mode,
      })
    }
    throw err
  }

  let processedMarkdown = markdown
  let imageMetadata: UploadedImageMetadata[] = []
  let imageMapping: ImageRewriteMapping[] = []
  const imageErrors: Array<{ imagePath: string; error: string }> = []

  const hasZip = Array.isArray(zipArchives) && zipArchives.length > 0
  // Diagnose-Flags: werden weiter unten in den Result geschrieben, damit der Aufrufer
  // (extract-only.ts) sie ins Trace stecken kann. Wichtig fuer das aktuelle Image-Loss-Debugging.
  let ranDirectUpload = false
  let ranImageProcessor = false

  // 3) Azure-Pfade
  if (strategy.writeToAzure) {
    if (hasZip) {
      // 3a) Schneller Pfad: ZIP -> Azure direkt (kein Filesystem-Round-Trip).
      const upload = await uploadImagesFromZipDirectly({
        zipArchives: zipArchives!,
        markdown: processedMarkdown,
        libraryId,
        sourceItemId,
        jobId,
      })
      processedMarkdown = upload.markdown
      imageMetadata = upload.imageMetadata
      ranDirectUpload = true
    }

    // 3b) Optional zusaetzlicher ImageProcessor-Lauf:
    //   - Im `azure-with-fs-backup`-Modus laufen wir auch ueber den FS-Provider, um relative
    //     Pfade zu finden, die NICHT im ZIP enthalten waren (z.B. nachtraeglich eingefuegt).
    //   - Im reinen `azure-only`-Modus skippen wir das, sofern der ZIP-Pfad bereits gelaufen ist.
    //     Das eliminiert den frueheren "Bild nicht gefunden"-Spam aus dem Status-Quo.
    const shouldRunFsImageProcessor =
      provider != null &&
      (strategy.mode === 'azure-with-fs-backup' ||
        (strategy.mode === 'azure-only' && !hasZip))

    if (shouldRunFsImageProcessor) {
      try {
        const processed = await ImageProcessor.processMarkdownImages(
          processedMarkdown,
          provider!,
          libraryId,
          sourceItemId,
          shadowTwinFolderId,
          jobId,
          false,
          libraryConfig,
        )
        processedMarkdown = processed.markdown
        imageMapping = processed.imageMapping
        imageErrors.push(...processed.imageErrors)
        ranImageProcessor = true
      } catch (imgErr) {
        const msg = imgErr instanceof Error ? imgErr.message : String(imgErr)
        // Wenn Azure ploetzlich doch nicht da ist (Race), markieren wir das aber werfen weiter,
        // weil die Strategie Azure verlangt hat.
        FileLogger.warn('media-persistence-service', 'ImageProcessor-Lauf (Azure-Pfad) fehlgeschlagen', {
          libraryId, sourceItemId, error: msg,
        })
        throw imgErr
      }
    }
  } else if (provider) {
    // 4) Filesystem-only: alter Pfad ueber ImageProcessor (laedt ggf. nach Azure als Anzeige-Spiegel).
    const processed = await ImageProcessor.processMarkdownImages(
      processedMarkdown,
      provider,
      libraryId,
      sourceItemId,
      shadowTwinFolderId,
      jobId,
      false,
      libraryConfig,
    )
    processedMarkdown = processed.markdown
    imageMapping = processed.imageMapping
    imageErrors.push(...processed.imageErrors)
    ranImageProcessor = true
  }
  // Kein provider + kein writeToAzure: nichts zu tun (z.B. reine Markdown-Aktualisierung).

  if (jobId) {
    bufferLog(jobId, {
      phase: 'media_persist_completed',
      message:
        `Bild-Persistenz abgeschlossen: ${imageMetadata.length} Direkt-Uploads, ` +
        `${imageMapping.length} Filesystem-Replacements, ${imageErrors.length} Fehler`,
      mode: strategy.mode,
      imageCount: imageMetadata.length,
      imageMappingCount: imageMapping.length,
      imageErrorsCount: imageErrors.length,
    })
  }

  return {
    markdown: processedMarkdown,
    imageMetadata,
    imageMapping,
    imageErrors,
    strategy,
    diagnostics: {
      hasZip,
      zipArchiveCount: zipArchives?.length ?? 0,
      ranDirectUpload,
      ranImageProcessor,
    },
  }
}

/**
 * Ergebnis der `freezeMarkdownImageUrls()`-Funktion.
 */
export interface FreezeMarkdownImageUrlsResult {
  /** Markdown nach dem Freeze; alle aufloesbaren relativen Bildpfade ersetzt durch absolute URLs. */
  markdown: string
  /** Anzahl tatsaechlich vorgenommener Ersetzungen. */
  replacedCount: number
  /** Bildpfade, die NICHT gegen ein Fragment aufgeloest werden konnten (Markdown bleibt dafuer unveraendert). */
  unresolved: string[]
}

const RELATIVE_MD_IMG_RE = /!\[([^\]]*)\]\((?!https?:\/\/|data:|\/api\/)([^)]+)\)/g
const RELATIVE_HTML_IMG_RE = /<img\s+([^>]*?)src=["'](?!https?:\/\/|data:|\/api\/)([^"']+)["']([^>]*)>/gi

/**
 * Friert ein Markdown deterministisch ein: Alle relativen Bildpfade werden anhand der
 * uebergebenen `binaryFragments` (per `matchBinaryFragmentByLookupName`) gegen absolute
 * Azure-URLs aufgeloest. Pfade ohne Treffer bleiben unveraendert und werden in `unresolved`
 * zurueckgegeben (Caller entscheidet ueber Fehler/Logging).
 *
 * Diese Funktion ersetzt im Render-Pfad jeden Server-Round-Trip: nach dem Freeze enthaelt
 * das Markdown bei korrekter Konfiguration ausschliesslich absolute Azure-URLs, sodass der
 * Browser direkt aus Azure laedt.
 */
export function freezeMarkdownImageUrls(
  markdown: string,
  binaryFragments: BinaryFragmentLookupFields[] | null | undefined,
): FreezeMarkdownImageUrlsResult {
  if (!binaryFragments?.length) {
    return { markdown, replacedCount: 0, unresolved: [] }
  }

  let replacedCount = 0
  const unresolved: string[] = []

  // 1) Markdown-Image-Syntax: ![alt](relativer/pfad)
  let out = markdown.replace(RELATIVE_MD_IMG_RE, (full, alt: string, relPath: string) => {
    const lookup = lastSegment(relPath)
    const fragment = matchBinaryFragmentByLookupName(binaryFragments, lookup)
    if (fragment?.url) {
      replacedCount++
      return `![${alt}](${fragment.url})`
    }
    unresolved.push(relPath)
    return full
  })

  // 2) HTML-img-Tags: <img ... src="relativer/pfad" ...>
  out = out.replace(RELATIVE_HTML_IMG_RE, (full, before: string, relPath: string, after: string) => {
    const lookup = lastSegment(relPath)
    const fragment = matchBinaryFragmentByLookupName(binaryFragments, lookup)
    if (fragment?.url) {
      replacedCount++
      return `<img ${before}src="${fragment.url}"${after}>`
    }
    unresolved.push(relPath)
    return full
  })

  return { markdown: out, replacedCount, unresolved }
}

function lastSegment(p: string): string {
  const noQuery = p.split('?')[0] ?? p
  const norm = noQuery.replace(/\\/g, '/').replace(/^\.\//, '')
  const slash = norm.lastIndexOf('/')
  return slash >= 0 ? norm.slice(slash + 1) : norm
}
