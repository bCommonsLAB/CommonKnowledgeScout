/**
 * @fileoverview Wizard Sessions Repository (MongoDB)
 *
 * DSGVO:
 * - Keine E-Mail-Adressen speichern
 * - Keine Klartext-Inhalte (z.B. Markdown) speichern
 *
 * Speicherung:
 * - Eine Wizard-Sitzung = ein Dokument in `wizard_sessions`
 * - Events werden append-only geloggt
 */

import { getCollection } from '@/lib/mongodb-service'
import type { Collection } from 'mongodb'
import crypto from 'crypto'
import type {
  CreateWizardSessionInput,
  WizardSession,
  WizardSessionEvent,
  WizardSessionError,
} from '@/types/wizard-session'

const COLLECTION_NAME = 'wizard_sessions'

let ensuredIndexes = false

async function getWizardSessionsCollection(): Promise<Collection<WizardSession>> {
  const col = await getCollection<WizardSession>(COLLECTION_NAME)
  if (ensuredIndexes) return col

  // Indizes nur einmal (best effort)
  try {
    await Promise.all([
      col.createIndex({ sessionId: 1 }, { unique: true, name: 'sessionId_unique' }),
      col.createIndex({ userId: 1, templateId: 1, startedAt: -1 }, { name: 'user_template_startedAt_desc' }),
      col.createIndex({ sessionIdAnon: 1, templateId: 1, startedAt: -1 }, { name: 'anon_template_startedAt_desc' }),
      col.createIndex({ jobIds: 1 }, { name: 'jobIds' }),
      col.createIndex({ status: 1, lastActivityAt: -1 }, { name: 'status_lastActivityAt_desc' }),
    ])
  } catch {
    // ignore
  } finally {
    ensuredIndexes = true
  }

  return col
}

function randomShortId(): string {
  return crypto.randomBytes(8).toString('hex')
}

export function createWizardSessionId(args: {
  templateId: string
  userId?: string
  sessionIdAnon?: string
  nowMs?: number
}): string {
  const base = (args.userId && args.userId.trim().length > 0)
    ? args.userId
    : (args.sessionIdAnon && args.sessionIdAnon.trim().length > 0)
      ? args.sessionIdAnon
      : 'unknown'
  const ts = String(typeof args.nowMs === 'number' ? args.nowMs : Date.now())
  return `${base}-${args.templateId}-${ts}-${randomShortId()}`
}

export async function createWizardSession(input: CreateWizardSessionInput): Promise<WizardSession> {
  const col = await getWizardSessionsCollection()

  const sessionId = createWizardSessionId({
    templateId: input.templateId,
    userId: input.userId,
    sessionIdAnon: input.sessionIdAnon,
  })

  const now = new Date()

  const doc: WizardSession = {
    sessionId,
    userId: input.userId,
    sessionIdAnon: input.sessionIdAnon,
    templateId: input.templateId,
    typeId: input.typeId,
    libraryId: input.libraryId,
    status: 'active',
    initialMode: input.initialMode,
    initialStepIndex: input.initialStepIndex,
    jobIds: [],
    events: [],
    startedAt: now,
    lastActivityAt: now,
    errors: [],
  }

  await col.insertOne(doc)
  return doc
}

export async function appendWizardEvent(args: {
  sessionId: string
  event: WizardSessionEvent
}): Promise<void> {
  const col = await getWizardSessionsCollection()
  const now = new Date()

  // WICHTIG:
  // - events[]: append-only via $push
  // - jobIds[]: UNIQUE via $addToSet (sonst doppelt bei job_started + job_completed)
  const update: Record<string, unknown> = {
    $push: {
      events: args.event,
      ...(args.event.error
        ? {
            errors: {
              timestamp: args.event.timestamp,
              eventId: args.event.eventId,
              error: args.event.error,
            },
          }
        : {}),
    },
    ...(args.event.jobId
      ? {
          $addToSet: {
            jobIds: args.event.jobId,
          },
        }
      : {}),
    $set: {
      lastActivityAt: now,
    },
  }

  await col.updateOne({ sessionId: args.sessionId }, update as never)
}

export async function setWizardSessionStatus(args: {
  sessionId: string
  status: WizardSession['status']
  finalStepIndex?: number
  finalFileIds?: WizardSession['finalFileIds']
  finalFilePaths?: WizardSession['finalFilePaths']
  error?: WizardSessionError
}): Promise<void> {
  const col = await getWizardSessionsCollection()
  const now = new Date()

  const update: Record<string, unknown> = {
    $set: {
      status: args.status,
      lastActivityAt: now,
      ...(typeof args.finalStepIndex === 'number' ? { finalStepIndex: args.finalStepIndex } : {}),
      ...(args.finalFileIds ? { finalFileIds: args.finalFileIds } : {}),
      ...(args.finalFilePaths ? { finalFilePaths: args.finalFilePaths } : {}),
      ...(args.status === 'completed' ? { completedAt: now } : {}),
    },
  }

  // Optional: zentraler Fehlerstack (ohne PII)
  if (args.error) {
    update.$push = {
      ...(typeof update.$push === 'object' && update.$push ? (update.$push as object) : {}),
      errors: { timestamp: now, eventId: `finalize-${now.getTime()}`, error: args.error },
    }
  }

  await col.updateOne({ sessionId: args.sessionId }, update as never)
}

export async function getWizardSessionById(sessionId: string): Promise<WizardSession | null> {
  const col = await getWizardSessionsCollection()
  return await col.findOne({ sessionId })
}

export async function listWizardSessionsByUser(args: {
  userId?: string
  sessionIdAnon?: string
  limit?: number
}): Promise<Array<Pick<WizardSession, 'sessionId' | 'templateId' | 'typeId' | 'libraryId' | 'status' | 'startedAt' | 'lastActivityAt' | 'completedAt'>>> {
  const col = await getWizardSessionsCollection()
  const limit = Math.max(1, Math.min(50, args.limit ?? 20))

  const filter =
    args.userId && args.userId.trim().length > 0
      ? { userId: args.userId }
      : args.sessionIdAnon && args.sessionIdAnon.trim().length > 0
        ? { sessionIdAnon: args.sessionIdAnon }
        : null

  if (!filter) return []

  return await col
    .find(filter, {
      projection: {
        sessionId: 1,
        templateId: 1,
        typeId: 1,
        libraryId: 1,
        status: 1,
        startedAt: 1,
        lastActivityAt: 1,
        completedAt: 1,
      },
      sort: { startedAt: -1 },
      limit,
    })
    .toArray()
}

export async function findWizardSessionByJobId(jobId: string): Promise<WizardSession | null> {
  const col = await getWizardSessionsCollection()
  return await col.findOne({ jobIds: jobId })
}


