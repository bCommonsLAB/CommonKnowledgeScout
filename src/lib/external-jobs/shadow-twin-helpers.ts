/**
 * @fileoverview External Jobs Shadow-Twin Helpers - Shadow-Twin Directory Utilities
 * 
 * @description
 * Helper functions for finding and creating Shadow-Twin directories. Consolidates
 * repeated Shadow-Twin logic from the route handler to reduce duplication and
 * ensure consistent error handling.
 * 
 * @module external-jobs
 * 
 * @exports
 * - findOrCreateShadowTwinFolder: Finds or creates a Shadow-Twin directory
 * - prepareImageProcessingContext: Prepares context for image processing
 * 
 * @usedIn
 * - src/lib/external-jobs/images.ts: Image processing uses Shadow-Twin helpers
 * - src/lib/external-jobs/extract-only.ts: Extract-only mode uses helpers
 * 
 * @dependencies
 * - @/lib/storage/shadow-twin: Shadow-Twin utilities
 * - @/lib/external-jobs-log-buffer: Log buffering
 * - @/types/external-jobs: Context types
 */

import type { StorageProvider } from '@/lib/storage/types'
import type { ExternalJob } from '@/types/external-job'
import { findShadowTwinFolder, generateShadowTwinFolderName } from '@/lib/storage/shadow-twin'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

/**
 * Finds an existing Shadow-Twin folder or creates a new one if it doesn't exist.
 * 
 * @param provider - Storage provider instance
 * @param parentId - Parent directory ID
 * @param originalName - Original file name (without extension)
 * @param jobId - Job ID for logging
 * @returns Shadow-Twin folder ID, or undefined if creation/finding failed
 */
export async function findOrCreateShadowTwinFolder(
  provider: StorageProvider,
  parentId: string,
  originalName: string,
  jobId: string
): Promise<string | undefined> {
  if (!parentId || !originalName) {
    return undefined
  }

  try {
    // Versuche zuerst, existierendes Shadow-Twin-Verzeichnis zu finden
    const shadowTwinFolder = await findShadowTwinFolder(parentId, originalName, provider)
    if (shadowTwinFolder) {
      bufferLog(jobId, {
        phase: 'shadow_twin_folder_found',
        message: `Shadow-Twin-Verzeichnis gefunden: ${shadowTwinFolder.metadata.name}`
      })
      return shadowTwinFolder.id
    }

    // Erstelle Shadow-Twin-Verzeichnis falls nicht vorhanden
    const folderName = generateShadowTwinFolderName(originalName)
    const createdFolder = await provider.createFolder(parentId, folderName)
    bufferLog(jobId, {
      phase: 'shadow_twin_folder_created',
      message: `Shadow-Twin-Verzeichnis erstellt: ${folderName}`
    })
    return createdFolder.id
  } catch (error) {
    bufferLog(jobId, {
      phase: 'shadow_twin_folder_error',
      message: `Fehler beim Erstellen/Finden des Shadow-Twin-Verzeichnisses: ${error instanceof Error ? error.message : String(error)}`
    })
    return undefined
  }
}

/**
 * Prepares the context needed for image processing, including the original item
 * metadata and text contents from the callback body.
 * 
 * @param provider - Storage provider instance (unused but kept for consistency)
 * @param job - External job object
 * @param targetParentId - Target parent directory ID
 * @param body - Callback body containing metadata
 * @returns Object containing originalItemForImages and textContents
 */
export function prepareImageProcessingContext(
  provider: StorageProvider,
  job: ExternalJob,
  targetParentId: string,
  body: { data?: { metadata?: unknown } } | undefined
): {
  originalItemForImages: {
    id: string
    parentId: string
    type: 'file'
    metadata: {
      name: string
      size: number
      modifiedAt: Date
      mimeType: string
    }
  }
  textContents: Array<{ page: number; content: string }> | undefined
} {
  const originalName = job.correlation?.source?.name || 'source.pdf'
  const originalItemForImages = {
    id: job.correlation?.source?.itemId || 'unknown',
    parentId: targetParentId,
    type: 'file' as const,
    metadata: {
      name: originalName,
      size: 0,
      modifiedAt: new Date(),
      mimeType: job.correlation?.source?.mimeType || 'application/pdf',
    },
  }

  const textContents = ((body?.data as { metadata?: unknown })?.metadata as {
    text_contents?: Array<{ page: number; content: string }>
  } | undefined)?.text_contents

  return {
    originalItemForImages,
    textContents,
  }
}


