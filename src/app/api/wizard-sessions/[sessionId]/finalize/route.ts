import { NextRequest, NextResponse } from 'next/server'
import { getWizardSessionById, setWizardSessionStatus } from '@/lib/wizard-session-repository'
import { getWizardUserIdentifier } from '@/lib/wizard-session-logger'
import type { WizardSession, WizardSessionError } from '@/types/wizard-session'

interface FinalizeWizardSessionBody {
  status: WizardSession['status']
  finalStepIndex?: number
  finalFileIds?: WizardSession['finalFileIds']
  finalFilePaths?: WizardSession['finalFilePaths']
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

    const ident = await getWizardUserIdentifier(request)
    const sameUser =
      (ident.userId && session.userId && ident.userId === session.userId)
      || (ident.sessionIdAnon && session.sessionIdAnon && ident.sessionIdAnon === session.sessionIdAnon)
    if (!sameUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = (await request.json().catch(() => null)) as FinalizeWizardSessionBody | null
    if (!body) return NextResponse.json({ error: 'Body fehlt' }, { status: 400 })
    if (!body.status) return NextResponse.json({ error: 'status fehlt' }, { status: 400 })

    const status: WizardSession['status'] =
      body.status === 'active' || body.status === 'completed' || body.status === 'abandoned' || body.status === 'error'
        ? body.status
        : 'error'

    await setWizardSessionStatus({
      sessionId,
      status,
      finalStepIndex: typeof body.finalStepIndex === 'number' ? body.finalStepIndex : undefined,
      finalFileIds: body.finalFileIds,
      finalFilePaths: body.finalFilePaths,
      error: body.error,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}



