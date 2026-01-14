"use client"

import { getOrCreateSessionId } from '@/lib/session/session-utils'
import type { WizardSession, WizardSessionEvent, WizardSessionError } from '@/types/wizard-session'

export interface WizardUserIdentifierClient {
  userId?: string
  sessionIdAnon?: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function getSessionHeaders(userIdentifier: WizardUserIdentifierClient): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (isNonEmptyString(userIdentifier.sessionIdAnon) && !userIdentifier.sessionIdAnon.startsWith('temp-')) {
    headers['X-Session-ID'] = userIdentifier.sessionIdAnon
  }
  return headers
}

export function getUserIdentifierClient(): WizardUserIdentifierClient {
  // Authentifizierte userId wird im Wizard (via Clerk useUser) ergänzt.
  const sessionIdAnon = getOrCreateSessionId()
  return { sessionIdAnon }
}

export async function createWizardSessionClient(args: {
  userIdentifier: WizardUserIdentifierClient
  templateId: string
  typeId: string
  libraryId: string
  initialStepIndex: number
  initialMode?: 'interview' | 'form'
}): Promise<string> {
  const res = await fetch('/api/wizard-sessions/start', {
    method: 'POST',
    headers: getSessionHeaders(args.userIdentifier),
    body: JSON.stringify({
      templateId: args.templateId,
      typeId: args.typeId,
      libraryId: args.libraryId,
      initialStepIndex: args.initialStepIndex,
      initialMode: args.initialMode,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as { sessionId?: unknown; error?: unknown }
  if (!res.ok) {
    const msg = isNonEmptyString(json.error) ? json.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  if (!isNonEmptyString(json.sessionId)) throw new Error('sessionId fehlt in Response')
  return json.sessionId
}

/**
 * Client-Helper im Stil der bestehenden Wizard-Aufrufe:
 * - Keine Übergabe von userIdentifier nötig.
 * - Authentifizierte Nutzer: Server erkennt userId via Clerk Cookie.
 * - Anonyme Nutzer: wir senden X-Session-ID aus localStorage.
 */
export async function logWizardEventClient(
  sessionId: string,
  event: Omit<WizardSessionEvent, 'eventId' | 'timestamp'>
): Promise<void> {
  if (!isNonEmptyString(sessionId)) return
  const userIdentifier = getUserIdentifierClient()
  await fetch(`/api/wizard-sessions/${encodeURIComponent(sessionId)}/events`, {
    method: 'POST',
    headers: getSessionHeaders(userIdentifier),
    body: JSON.stringify(event),
  }).catch(() => {
    // best effort
  })
}

export async function addJobIdToSessionClient(
  sessionId: string,
  jobId: string,
  jobType?: string
): Promise<void> {
  if (!isNonEmptyString(jobId)) return
  await logWizardEventClient(sessionId, {
    eventType: 'job_started',
    jobId,
    jobType,
  })
}

export async function finalizeWizardSessionClient(
  sessionId: string,
  status: WizardSession['status'],
  args?: {
    finalStepIndex?: number
    finalFileIds?: WizardSession['finalFileIds']
    finalFilePaths?: WizardSession['finalFilePaths']
    error?: WizardSessionError
  }
): Promise<void> {
  if (!isNonEmptyString(sessionId)) return
  const userIdentifier = getUserIdentifierClient()
  await fetch(`/api/wizard-sessions/${encodeURIComponent(sessionId)}/finalize`, {
    method: 'POST',
    headers: getSessionHeaders(userIdentifier),
    body: JSON.stringify({
      status,
      finalStepIndex: args?.finalStepIndex,
      finalFileIds: args?.finalFileIds,
      finalFilePaths: args?.finalFilePaths,
      error: args?.error,
    }),
  }).catch(() => {
    // best effort
  })
}

function padBase64(s: string): string {
  const mod = s.length % 4
  if (mod === 0) return s
  return s + '='.repeat(4 - mod)
}

function tryDecodeBase64(value: string): string | undefined {
  try {
    const normalized = padBase64(value.replace(/-/g, '+').replace(/_/g, '/'))
    // atob ist im Browser verfügbar
    const decoded = atob(normalized)
    return decoded
  } catch {
    return undefined
  }
}

export function getFilePathsClient(fileIds: {
  baseFileId?: string
  transcriptFileId?: string
  transformFileId?: string
  savedItemId?: string
}): { basePath?: string; transcriptPath?: string; transformPath?: string; savedPath?: string } {
  // Best-effort: Storage-IDs sind häufig Base64-kodierte Pfade (Filesystem-Provider)
  const basePath = isNonEmptyString(fileIds.baseFileId) ? tryDecodeBase64(fileIds.baseFileId) : undefined
  const transcriptPath = isNonEmptyString(fileIds.transcriptFileId) ? tryDecodeBase64(fileIds.transcriptFileId) : undefined
  const transformPath = isNonEmptyString(fileIds.transformFileId) ? tryDecodeBase64(fileIds.transformFileId) : undefined
  const savedPath = isNonEmptyString(fileIds.savedItemId) ? tryDecodeBase64(fileIds.savedItemId) : undefined
  return { basePath, transcriptPath, transformPath, savedPath }
}


