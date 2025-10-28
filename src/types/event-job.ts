export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum AccessVisibility {
  PRIVATE = 'private',
  PUBLIC = 'public'
}

export interface AccessControl {
  visibility: AccessVisibility;
  read_access: string[];
  write_access: string[];
  admin_access: string[];
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
}

export interface JobProgress {
  step: string;
  percent: number;
  message?: string;
}

export interface JobParameters {
  event?: string;
  session?: string;
  url?: string;
  filename?: string;
  track?: string;
  day?: string;
  starttime?: string;
  endtime?: string;
  speakers?: string[] | null;
  image_url?: string; // Optional: Bild-URL von der Session-Seite
  video_url?: string;
  template?: string;
  attachments_url?: string;
  source_language: string;
  target_language: string;
  use_cache?: boolean;
}

export interface JobResults {
  markdown_file?: string;
  markdown_content?: string;
  assets?: string[];
  web_text?: string;
  video_transcript?: string;
  attachments_text?: string | null;
  context?: Record<string, unknown> | null;
  attachments_url?: string | null;
  // Archive-spezifische Felder
  archive_data?: string; // Base64-kodierte ZIP-Daten
  archive_filename?: string; // Name der ZIP-Datei
  structured_data?: Record<string, unknown>; // Strukturierte Session-Daten
}

export interface JobError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface Job {
  job_id: string;
  job_type: string;
  job_name?: string;
  event_name?: string; // 🆕 Neues Feld für Event-Filterung
  status: JobStatus;
  parameters: JobParameters;
  results?: JobResults;
  error?: JobError;
  progress?: JobProgress;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  started_at?: Date;
  processing_started_at?: Date;
  user_id?: string;
  access_control: AccessControl;
  event_type?: string;
  batch_id?: string;
  logs?: LogEntry[];
  archived: boolean;
}

export enum BatchStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface Batch {
  batch_id: string;
  batch_name?: string;
  event_name?: string; // 🆕 Neues Feld für Event-Filterung
  status: BatchStatus;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  user_id?: string;
  access_control: AccessControl;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs?: number;
  processing_jobs?: number;
  isActive: boolean;
  archived: boolean;
  archivedAt?: Date;
  description?: string;
  metadata?: Record<string, unknown>;
}

// API-Anfrage- und Antworttypen
export interface CreateBatchRequest {
  batch_name?: string;
  jobs: Array<Omit<Job, 'job_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>>;
  user_id?: string;
}

export interface BatchListResponse {
  status: 'success' | 'error';
  data?: {
    batches: Batch[];
    total: number;
    limit: number;
    skip: number;
  };
  message?: string;
}

export interface BatchResponse {
  status: 'success' | 'error';
  data?: {
    batch: Batch;
  };
  message?: string;
}

export interface JobListResponse {
  status: 'success' | 'error';
  data?: {
    jobs: Job[];
    total: number;
    limit: number;
    skip: number;
  };
  message?: string;
}

export interface JobResponse {
  status: 'success' | 'error';
  data?: {
    job: Job;
  };
  message?: string;
}

export interface EventJob {
  _id: string;
  batchId: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  lastErrorMessage?: string;
  retryCount: number;
  maxRetries: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  priority: number;
}

export interface BatchCreatePayload {
  name: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface JobCreatePayload {
  batchId: string;
  payload: Record<string, unknown>;
  priority?: number;
  maxRetries?: number;
}

export interface BatchStats {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
}

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

// Event-spezifische Interfaces
export interface EventFilterOptions {
  eventName?: string;
  archived?: boolean;
  status?: BatchStatus;
  limit?: number;
  skip?: number;
  isActive?: boolean;
}

export interface EventListResponse {
  status: 'success' | 'error';
  data?: {
    events: string[];
    total: number;
  };
  message?: string;
} 