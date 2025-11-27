/**
 * @fileoverview Standardisiertes Error-Handling für External Jobs
 *
 * @description
 * Zentrale Funktionen für konsistentes Error-Handling in Start- und Callback-Routen.
 * Behandelt Trace-Events, Status-Updates und Event-Bus-Updates.
 *
 * @module external-jobs
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { FileLogger } from '@/lib/debug/logger'

export interface JobErrorContext {
  jobId: string
  userEmail: string
  jobType?: string
  fileName?: string
  sourceItemId?: string
}

/**
 * Behandelt einen Job-Fehler standardisiert.
 *
 * @param error Fehler-Objekt oder Fehlermeldung
 * @param context Job-Kontext
 * @param repo External-Jobs-Repository
 * @param errorCode Optionaler Fehlercode (Standard: 'job_error')
 * @param traceSpanId Optionaler Span-ID für Trace-Events (Standard: 'job')
 */
export async function handleJobError(
  error: unknown,
  context: JobErrorContext,
  repo: ExternalJobsRepository,
  errorCode: string = 'job_error',
  traceSpanId: string = 'job'
): Promise<void> {
  const { jobId, userEmail, jobType, fileName, sourceItemId } = context
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  FileLogger.error('error-handler', 'Job-Fehler behandelt', {
    jobId,
    errorCode,
    errorMessage,
    errorStack,
  })

  try {
    await repo.setStatus(jobId, 'failed', {
      error: {
        code: errorCode,
        message: errorMessage,
      },
    })
  } catch (statusError) {
    FileLogger.error('error-handler', 'Fehler beim Setzen des Status', {
      jobId,
      error: statusError instanceof Error ? statusError.message : String(statusError),
    })
  }

  try {
    await repo.traceAddEvent(jobId, {
      spanId: traceSpanId,
      name: 'job_error',
      level: 'error',
      message: errorMessage,
      attributes: {
        errorCode,
        errorStack,
      },
    })
  } catch {
    // Trace-Fehler nicht kritisch
  }

  try {
    getJobEventBus().emitUpdate(userEmail, {
      type: 'job_update',
      jobId,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      message: errorMessage,
      jobType,
      fileName,
      sourceItemId,
    })
  } catch {
    // Event-Bus-Fehler nicht kritisch
  }
}

/**
 * Behandelt einen Job-Fehler mit zusätzlichen Details.
 *
 * @param error Fehler-Objekt oder Fehlermeldung
 * @param context Job-Kontext
 * @param repo External-Jobs-Repository
 * @param errorCode Fehlercode
 * @param details Zusätzliche Fehlerdetails
 * @param traceSpanId Optionaler Span-ID für Trace-Events (Standard: 'job')
 */
export async function handleJobErrorWithDetails(
  error: unknown,
  context: JobErrorContext,
  repo: ExternalJobsRepository,
  errorCode: string,
  details: Record<string, unknown>,
  traceSpanId: string = 'job'
): Promise<void> {
  const { jobId, userEmail, jobType, fileName, sourceItemId } = context
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  FileLogger.error('error-handler', 'Job-Fehler behandelt (mit Details)', {
    jobId,
    errorCode,
    errorMessage,
    errorStack,
    details,
  })

  try {
    await repo.setStatus(jobId, 'failed', {
      error: {
        code: errorCode,
        message: errorMessage,
        details,
      },
    })
  } catch (statusError) {
    FileLogger.error('error-handler', 'Fehler beim Setzen des Status', {
      jobId,
      error: statusError instanceof Error ? statusError.message : String(statusError),
    })
  }

  try {
    await repo.traceAddEvent(jobId, {
      spanId: traceSpanId,
      name: 'job_error',
      level: 'error',
      message: errorMessage,
      attributes: {
        errorCode,
        errorStack,
        ...details,
      },
    })
  } catch {
    // Trace-Fehler nicht kritisch
  }

  try {
    getJobEventBus().emitUpdate(userEmail, {
      type: 'job_update',
      jobId,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      message: errorMessage,
      jobType,
      fileName,
      sourceItemId,
    })
  } catch {
    // Event-Bus-Fehler nicht kritisch
  }
}





