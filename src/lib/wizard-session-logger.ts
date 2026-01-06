/**
 * @fileoverview Wizard Session Logger (Server-side helpers)
 *
 * Diese Helper werden in API Routes verwendet.
 * Client-Code ruft API Routes auf (kein direkter DB-Zugriff im Browser).
 */

import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import type { WizardSessionEvent, WizardSessionError } from '@/types/wizard-session'
import { auth } from '@clerk/nextjs/server'

export interface WizardUserIdentifier {
  userId?: string
  sessionIdAnon?: string
}

/**
 * DSGVO: Identifikation ohne E-Mail.
 * - Authentifiziert: Clerk userId
 * - Anonym: X-Session-ID Header (siehe useSessionHeaders())
 */
export async function getWizardUserIdentifier(request: NextRequest): Promise<WizardUserIdentifier> {
  try {
    const { userId } = await auth()
    if (userId) return { userId }
  } catch {
    // ignore
  }

  const sessionIdAnon = request.headers.get('X-Session-ID') || request.headers.get('x-session-id') || undefined
  if (sessionIdAnon && sessionIdAnon.trim().length > 0) return { sessionIdAnon }

  return {}
}

export function createEventId(): string {
  return crypto.randomBytes(12).toString('hex')
}

export function createWizardEvent(args: {
  eventType: WizardSessionEvent['eventType']
  stepIndex?: number
  stepPreset?: string
  sourceId?: string
  sourceKind?: WizardSessionEvent['sourceKind']
  jobId?: string
  jobType?: string
  fileIds?: WizardSessionEvent['fileIds']
  filePaths?: WizardSessionEvent['filePaths']
  parameters?: WizardSessionEvent['parameters']
  metadata?: WizardSessionEvent['metadata']
  error?: WizardSessionError
}): WizardSessionEvent {
  return {
    eventId: createEventId(),
    timestamp: new Date(),
    eventType: args.eventType,
    stepIndex: args.stepIndex,
    stepPreset: args.stepPreset,
    sourceId: args.sourceId,
    sourceKind: args.sourceKind,
    jobId: args.jobId,
    jobType: args.jobType,
    fileIds: args.fileIds,
    filePaths: args.filePaths,
    parameters: args.parameters,
    metadata: args.metadata,
    error: args.error,
  }
}



