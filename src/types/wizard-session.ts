/**
 * @fileoverview Wizard Session Logging Types (DSGVO-konform)
 *
 * - Speichert KEINE E-Mail-Adressen oder Klartext-Inhalte.
 * - Referenziert externe Jobs über jobId (Details liegen in `external_jobs`).
 * - Speichert File-Referenzen als IDs + (optional) ableitbare Pfadinfos.
 */

export interface WizardSessionError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface WizardSessionFileIds {
  baseFileId?: string
  transcriptFileId?: string
  transformFileId?: string
  savedItemId?: string
}

export interface WizardSessionFilePaths {
  basePath?: string
  transcriptPath?: string
  transformPath?: string
  savedPath?: string
}

export interface WizardSessionEvent {
  eventId: string
  timestamp: Date
  eventType:
    | 'wizard_started'
    | 'step_changed'
    /**
     * Präzisere Step-Telemetrie:
     * - step_changed bleibt als Navigation-Event bestehen
     * - step_entered/step_exited zeigen klar, wann ein Step "aktiv" wurde/endet
     */
    | 'step_entered'
    | 'step_exited'
    | 'source_added'
    | 'source_removed'
    | 'job_started'
    | 'job_completed'
    | 'job_failed'
    | 'markdown_confirmed'
    | 'metadata_edited'
    | 'file_saved'
    /**
     * Asynchrone Prozess-Telemetrie (Reihenfolge & Dauer sichtbar machen)
     */
    | 'save_started'
    | 'save_completed'
    | 'save_failed'
    | 'publish_started'
    | 'publish_completed'
    | 'publish_failed'
    | 'ingest_started'
    | 'ingest_completed'
    | 'ingest_failed'
    | 'wizard_completed'
    | 'wizard_abandoned'
    | 'error'

  stepIndex?: number
  stepPreset?: string
  sourceId?: string
  sourceKind?: 'text' | 'url' | 'file'
  jobId?: string
  jobType?: string
  fileIds?: WizardSessionFileIds
  filePaths?: WizardSessionFilePaths
  parameters?: Record<string, unknown>
  metadata?: Record<string, unknown>
  error?: WizardSessionError
}

export interface WizardSession {
  /**
   * Stable identifier for a single wizard run.
   * Format: `${userId || sessionIdAnon}-${templateId}-${timestamp}-${rand}`
   */
  sessionId: string

  // DSGVO-konform: Keine E-Mail. Authentifiziert => Clerk userId. Anonym => sessionIdAnon.
  userId?: string
  sessionIdAnon?: string

  templateId: string
  typeId: string
  libraryId: string

  status: 'active' | 'completed' | 'abandoned' | 'error'

  initialMode?: 'interview' | 'form'
  initialStepIndex: number

  finalStepIndex?: number
  finalFileIds?: Pick<WizardSessionFileIds, 'savedItemId' | 'transformFileId'>
  finalFilePaths?: Pick<WizardSessionFilePaths, 'savedPath' | 'transformPath'>

  jobIds: string[]
  events: WizardSessionEvent[]

  startedAt: Date
  completedAt?: Date
  lastActivityAt: Date

  errors?: Array<{
    timestamp: Date
    eventId: string
    error: WizardSessionError
  }>
}

export interface CreateWizardSessionInput {
  userId?: string
  sessionIdAnon?: string
  templateId: string
  typeId: string
  libraryId: string
  initialMode?: 'interview' | 'form'
  initialStepIndex: number
}



