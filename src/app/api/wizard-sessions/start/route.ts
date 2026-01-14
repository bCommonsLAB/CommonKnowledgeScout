import { NextRequest, NextResponse } from 'next/server'
import { createWizardEvent, getWizardUserIdentifier } from '@/lib/wizard-session-logger'
import { appendWizardEvent, createWizardSession } from '@/lib/wizard-session-repository'

interface StartWizardSessionBody {
  templateId: string
  typeId: string
  libraryId: string
  initialMode?: 'interview' | 'form'
  initialStepIndex?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as StartWizardSessionBody | null
    if (!body) return NextResponse.json({ error: 'Body fehlt' }, { status: 400 })

    const templateId = typeof body.templateId === 'string' ? body.templateId : ''
    const typeId = typeof body.typeId === 'string' ? body.typeId : ''
    const libraryId = typeof body.libraryId === 'string' ? body.libraryId : ''
    const initialMode = body.initialMode === 'form' || body.initialMode === 'interview' ? body.initialMode : undefined
    const initialStepIndex = typeof body.initialStepIndex === 'number' ? body.initialStepIndex : 0

    if (!templateId || !typeId || !libraryId) {
      return NextResponse.json({ error: 'templateId/typeId/libraryId sind erforderlich' }, { status: 400 })
    }

    const ident = await getWizardUserIdentifier(request)
    if (!ident.userId && !ident.sessionIdAnon) {
      return NextResponse.json({ error: 'Nicht authentifiziert (userId oder X-Session-ID fehlt)' }, { status: 401 })
    }

    const session = await createWizardSession({
      userId: ident.userId,
      sessionIdAnon: ident.sessionIdAnon,
      templateId,
      typeId,
      libraryId,
      initialMode,
      initialStepIndex,
    })

    // Start-Event (sparsam, aber reproduzierbar)
    await appendWizardEvent({
      sessionId: session.sessionId,
      event: createWizardEvent({
        eventType: 'wizard_started',
        stepIndex: initialStepIndex,
        parameters: {
          templateId,
          typeId,
          libraryId,
          initialMode,
        },
      }),
    })

    return NextResponse.json({ sessionId: session.sessionId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}



