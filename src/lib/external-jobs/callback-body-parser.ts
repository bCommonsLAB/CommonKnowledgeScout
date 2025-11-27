/**
 * @fileoverview Callback-Body-Parser für External Jobs
 *
 * @description
 * Extrahiert alle relevanten Felder aus dem Callback-Body des Secretary Service
 * und gibt ein strukturiertes Objekt zurück.
 *
 * @module external-jobs
 */

export interface ParsedCallbackBody {
  extractedText?: string
  pagesArchiveData?: string
  pagesArchiveUrl?: string
  pagesArchiveFilename?: string
  imagesArchiveData?: string
  imagesArchiveUrl?: string
  imagesArchiveFilename?: string
  mistralOcrRaw?: unknown
  mistralOcrRawUrl?: string
  mistralOcrRawMetadata?: unknown
  mistralOcrImagesUrl?: string
  metadata?: Record<string, unknown>
  phase?: string
  processId?: string
  hasFinalPayload: boolean
  hasError: boolean
}

/**
 * Parst den Callback-Body vom Secretary Service.
 *
 * @param body Roher Callback-Body
 * @returns Strukturiertes Objekt mit allen relevanten Feldern
 */
export function parseCallbackBody(body: unknown): ParsedCallbackBody {
  const data = (body && typeof body === 'object' && 'data' in body && body.data && typeof body.data === 'object')
    ? (body.data as Record<string, unknown>)
    : {}

  const extractedText = data.extracted_text as string | undefined
  const pagesArchiveData = data.pages_archive_data as string | undefined
  const pagesArchiveUrl = data.pages_archive_url as string | undefined
  const pagesArchiveFilename = data.pages_archive_filename as string | undefined
  const imagesArchiveData = data.images_archive_data as string | undefined
  const imagesArchiveUrl = data.images_archive_url as string | undefined
  const imagesArchiveFilename = data.images_archive_filename as string | undefined
  const mistralOcrRaw = data.mistral_ocr_raw as unknown
  const mistralOcrRawUrl = data.mistral_ocr_raw_url as string | undefined
  const mistralOcrRawMetadata = data.mistral_ocr_raw_metadata as unknown
  const mistralOcrImagesUrl = data.mistral_ocr_images_url as string | undefined

  const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const metadata = (data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata))
    ? (data.metadata as Record<string, unknown>)
    : undefined
  const phase = typeof bodyObj.phase === 'string' ? bodyObj.phase : typeof data.phase === 'string' ? data.phase : undefined
  const processId =
    (bodyObj.process && typeof bodyObj.process === 'object' && 'id' in bodyObj.process && typeof bodyObj.process.id === 'string')
      ? bodyObj.process.id
      : typeof data.processId === 'string'
        ? data.processId
        : undefined

  const hasFinalPayload = !!(
    extractedText ||
    imagesArchiveUrl ||
    pagesArchiveData ||
    pagesArchiveUrl ||
    imagesArchiveData ||
    mistralOcrRawUrl ||
    mistralOcrRawMetadata ||
    mistralOcrRaw ||
    bodyObj.status === 'completed' ||
    phase === 'template_completed'
  )

  const hasError = !!(bodyObj.error || data.error)

  return {
    extractedText,
    pagesArchiveData,
    pagesArchiveUrl,
    pagesArchiveFilename,
    imagesArchiveData,
    imagesArchiveUrl,
    imagesArchiveFilename,
    mistralOcrRaw,
    mistralOcrRawUrl,
    mistralOcrRawMetadata,
    mistralOcrImagesUrl,
    metadata,
    phase,
    processId,
    hasFinalPayload,
    hasError,
  }
}





