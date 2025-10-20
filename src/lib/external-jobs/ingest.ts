import type { IngestArgs, IngestResult } from '@/types/external-jobs'
import { IngestionService } from '@/lib/chat/ingestion-service'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

export async function runIngestion(args: IngestArgs): Promise<IngestResult> {
  const { ctx, savedItemId, fileName, markdown, meta } = args
  const res = await IngestionService.upsertMarkdown(ctx.job.userEmail, ctx.job.libraryId, savedItemId, fileName, markdown, meta || {}, ctx.jobId)
  bufferLog(ctx.jobId, { phase: 'ingest_pinecone_upserted', message: `Upsert abgeschlossen: ${res.chunksUpserted} Chunks` })
  return res
}


