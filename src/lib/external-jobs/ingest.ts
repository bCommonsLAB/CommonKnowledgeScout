/**
 * @fileoverview External Jobs Ingestion - RAG Ingestion Pipeline
 * 
 * @description
 * Runs RAG ingestion for transformed markdown documents. Upserts document content into
 * Pinecone vector database and MongoDB for chat/retrieval functionality. Handles chunking,
 * embedding generation, and metadata storage.
 * 
 * @module external-jobs
 * 
 * @exports
 * - runIngestion: Executes RAG ingestion pipeline
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback runs ingestion
 * - src/app/api/external/jobs/[jobId]/start/route.ts: Job start may run ingestion
 * 
 * @dependencies
 * - @/lib/chat/ingestion-service: Ingestion service for RAG pipeline
 * - @/lib/external-jobs-log-buffer: Log buffering
 * - @/types/external-jobs: Ingestion types
 */

import type { IngestArgs, IngestResult } from '@/types/external-jobs'
import { IngestionService } from '@/lib/chat/ingestion-service'
import { bufferLog } from '@/lib/external-jobs-log-buffer'

export async function runIngestion(args: IngestArgs): Promise<IngestResult> {
  const { ctx, savedItemId, fileName, markdown, meta, provider, shadowTwinFolderId } = args
  const res = await IngestionService.upsertMarkdown(ctx.job.userEmail, ctx.job.libraryId, savedItemId, fileName, markdown, meta || {}, ctx.jobId, provider, shadowTwinFolderId)
  bufferLog(ctx.jobId, { phase: 'ingest_pinecone_upserted', message: `Upsert abgeschlossen: ${res.chunksUpserted} Chunks` })
  return res
}


