import type { ImagesArgs, ImagesResult } from '@/types/external-jobs'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { getServerProvider } from '@/lib/storage/server-provider'
import { ImageExtractionService } from '@/lib/transform/image-extraction-service'
import { getSecretaryConfig } from '../env'

export async function maybeProcessImages(args: ImagesArgs): Promise<ImagesResult | void> {
  const { ctx, parentId, imagesZipUrl, extractedText, lang } = args
  if (!imagesZipUrl) return

  // Baue absolute URL, falls nötig
  const { baseUrl: baseRaw } = getSecretaryConfig()
  const isAbsolute = /^https?:\/\//i.test(imagesZipUrl)
  let archiveUrl = imagesZipUrl
  if (!isAbsolute) {
    const base = baseRaw.replace(/\/$/, '')
    const rel = imagesZipUrl.startsWith('/') ? imagesZipUrl : `/${imagesZipUrl}`
    archiveUrl = base.endsWith('/api') && rel.startsWith('/api/') ? `${base}${rel.substring(4)}` : `${base}${rel}`
  }
  const headers: Record<string, string> = {}
  const { apiKey } = getSecretaryConfig()
  if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey }

  const resp = await fetch(archiveUrl, { method: 'GET', headers })
  if (!resp.ok) {
    bufferLog(ctx.jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` })
    return
  }
  const arrayBuf = await resp.arrayBuffer()
  const base64Zip = Buffer.from(arrayBuf).toString('base64')
  const provider = await getServerProvider(ctx.job.userEmail, ctx.job.libraryId)
  const originalItemForImages = {
    id: ctx.job.correlation?.source?.itemId || 'unknown',
    parentId,
    type: 'file' as const,
    metadata: {
      name: ctx.job.correlation?.source?.name || 'source.pdf',
      size: 0,
      modifiedAt: new Date(),
      mimeType: ctx.job.correlation?.source?.mimeType || 'application/pdf',
    },
  }
  const textContents = ((ctx.body?.data as { metadata?: unknown })?.metadata as { text_contents?: Array<{ page: number; content: string }> } | undefined)?.text_contents
  const result = await ImageExtractionService.saveZipArchive(
    base64Zip,
    'images.zip',
    originalItemForImages,
    provider,
    async (folderId: string) => provider.listItemsById(folderId),
    extractedText,
    lang,
    textContents
  )
  const savedItemIds = result.savedItems.map(it => it.id)
  bufferLog(ctx.jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${savedItemIds.length})` })
  return { savedItemIds }
}


