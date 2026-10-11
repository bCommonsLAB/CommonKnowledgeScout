/**
 * @fileoverview Seitenbilder einer PDF-Extraktion im Filesystem-Modus als
 * binaryFragments nachregistrieren (Welle J Nachzug, Befund 11.10.2026).
 *
 * @description
 * Mit `persistToFilesystem` sammelt `extract-only.ts` die ZIP-Archive des
 * Secretary nicht fuer den Direct-Upload; `pages.zip` (preview_NNN.jpg,
 * page_NNN.jpeg) landet ueber den ImageProcessor nur im Twin-Ordner des
 * Storage. Der Mongo-Writer registriert dann nur die im Markdown
 * referenzierten OCR-Bilder — am Twin fehlen die Seitenbilder, und Folien,
 * Cover und Anhaenge der Welle J finden nichts (Live-Prueffall: 174
 * Seitenbilder hochgeladen, 0 registriert).
 *
 * Hier wird nach dem Mongo-Speichern derselbe Weg genommen wie
 * `register-image-fragments` der Sync-Engine: Twin-Ordner listen,
 * `reconstructPageImages` registriert page_NNN und preview_NNN mit Variante und
 * Seitennummer (Upsert je Name, also wiederholbar). Ergebnis und Fehler gehen
 * ins Job-Log und in den Trace, nie still.
 *
 * @module external-jobs
 */

import { FileLogger } from '@/lib/debug/logger'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import type { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

export interface RegistrierePageImagesArgs {
  provider: StorageProvider
  repo: ExternalJobsRepository
  jobId: string
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  parentId: string
  shadowTwinFolderId: string | undefined
}

export interface RegistrierePageImagesResult {
  /** Dateien im Twin-Ordner insgesamt. */
  twinItems: number
  /** Als Fragment registrierte Seitenbilder. */
  registriert: number
  /** Grund, wenn nichts passiert ist. */
  uebersprungen?: 'kein_twin_ordner'
}

async function trace(repo: ExternalJobsRepository, jobId: string, name: string, attributes: Record<string, unknown>, level?: 'warn'): Promise<void> {
  try {
    await repo.traceAddEvent(jobId, { spanId: 'extract', name, ...(level ? { level } : {}), attributes })
  } catch (err) {
    FileLogger.warn('extract-page-images', `Trace-Event ${name} nicht geschrieben`, { jobId, error: err instanceof Error ? err.message : String(err) })
  }
}

export async function registrierePageImagesAusTwinOrdner(args: RegistrierePageImagesArgs): Promise<RegistrierePageImagesResult> {
  const { provider, repo, jobId, libraryId, userEmail, sourceItem, parentId, shadowTwinFolderId } = args
  if (!shadowTwinFolderId) {
    await trace(repo, jobId, 'extract_only_page_images_skipped', { grund: 'kein_twin_ordner' }, 'warn')
    return { twinItems: 0, registriert: 0, uebersprungen: 'kein_twin_ordner' }
  }
  const twinItems = await provider.listItemsById(shadowTwinFolderId)
  const { reconstructPageImages } = await import('@/lib/shadow-twin/reconstruct-from-storage')
  const registriert = await reconstructPageImages({ provider, libraryId, userEmail, sourceItem, parentId, items: twinItems })
  bufferLog(jobId, {
    phase: 'extract_only_page_images_registered',
    message: `${registriert} Seitenbild(er) aus dem Twin-Ordner als Fragmente registriert`,
    twinItems: twinItems.length,
    registriert,
  })
  await trace(repo, jobId, 'extract_only_page_images_registered', { twinItems: twinItems.length, registriert })
  return { twinItems: twinItems.length, registriert }
}
