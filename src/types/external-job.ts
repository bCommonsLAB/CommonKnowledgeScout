export type ExternalJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'pending-storage';

export interface ExternalJobCorrelationSource {
  itemId?: string;
  parentId?: string;
  mediaType?: string; // e.g. 'pdf'
  mimeType?: string;
  name?: string;
}

export interface ExternalJobCorrelation {
  jobId: string;
  libraryId: string;
  source?: ExternalJobCorrelationSource;
  options?: Record<string, unknown>;
  batchId?: string;
}

export interface ExternalJobPayloadMeta {
  // secretary/process payload fields (subset)
  extracted_text?: string;
  // Neu: Link-basiert statt große Base64-Blobs
  images_archive_url?: string;
  // Alt (deprecated): Wird nicht mehr persistiert
  images_archive_data?: string;
  images_archive_filename?: string;
  metadata?: Record<string, unknown>;
}

export interface ExternalJobResultRefs {
  savedItemId?: string;
  savedItems?: string[];
}

export interface ExternalJobLogEntry {
  timestamp: Date;
  phase?: string;
  progress?: number; // 0..100
  message?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExternalJobStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  endedAt?: Date;
  durationMs?: number;
  details?: Record<string, unknown>;
  error?: { message: string; code?: string; details?: Record<string, unknown> };
}

export interface ExternalJobIngestionInfo {
  vectorsUpserted?: number;
  index?: string;
  namespace?: string;
  upsertAt?: Date;
}

export interface ExternalJob {
  jobId: string;
  jobSecretHash: string; // sha256 of secret
  job_type: 'pdf' | 'audio' | 'video' | 'image' | 'text' | string;
  operation: 'extract' | 'transcribe' | 'transform' | 'summarize' | string;
  worker: 'secretary' | string;
  status: ExternalJobStatus;
  libraryId: string;
  userEmail: string;
  correlation: ExternalJobCorrelation;
  processId?: string;
  payload?: ExternalJobPayloadMeta;
  result?: ExternalJobResultRefs;
  logs?: ExternalJobLogEntry[];
  steps?: ExternalJobStep[];
  parameters?: Record<string, unknown>;
  cumulativeMeta?: Record<string, unknown>;
  metaHistory?: Array<{ at: Date; meta: Record<string, unknown>; source: string }>;
  ingestion?: ExternalJobIngestionInfo;
  createdAt: Date;
  updatedAt: Date;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}


