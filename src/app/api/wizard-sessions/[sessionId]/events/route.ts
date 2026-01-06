import { NextRequest, NextResponse } from 'next/server'
import { appendWizardEvent, getWizardSessionById } from '@/lib/wizard-session-repository'
import { createWizardEvent, getWizardUserIdentifier } from '@/lib/wizard-session-logger'
import type { WizardSessionEvent, WizardSessionError } from '@/types/wizard-session'

interface PostWizardEventBody {
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
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    if (!sessionId) return NextResponse.json({ error: 'sessionId fehlt' }, { status: 400 })

    const session = await getWizardSessionById(sessionId)
    if (!session) return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 })

    // Owner-Check (DSGVO): userId oder sessionIdAnon muss passen
    const ident = await getWizardUserIdentifier(request)
    const sameUser =
      (ident.userId && session.userId && ident.userId === session.userId)
      || (ident.sessionIdAnon && session.sessionIdAnon && ident.sessionIdAnon === session.sessionIdAnon)

    if (!sameUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = (await request.json().catch(() => null)) as PostWizardEventBody | null
    if (!body) return NextResponse.json({ error: 'Body fehlt' }, { status: 400 })

    if (!body.eventType) return NextResponse.json({ error: 'eventType fehlt' }, { status: 400 })

    await appendWizardEvent({
      sessionId,
      event: createWizardEvent({
        eventType: body.eventType,
        stepIndex: typeof body.stepIndex === 'number' ? body.stepIndex : undefined,
        stepPreset: typeof body.stepPreset === 'string' ? body.stepPreset : undefined,
        sourceId: typeof body.sourceId === 'string' ? body.sourceId : undefined,
        sourceKind: body.sourceKind,
        jobId: typeof body.jobId === 'string' ? body.jobId : undefined,
        jobType: typeof body.jobType === 'string' ? body.jobType : undefined,
        fileIds: body.fileIds,
        filePaths: body.filePaths,
        parameters: body.parameters,
        metadata: body.metadata,
        error: body.error,
      }),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}



