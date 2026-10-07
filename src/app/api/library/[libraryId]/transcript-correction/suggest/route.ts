/**
 * @fileoverview Korrekturvorschlag fuer ein Audio-Transkript (P3b).
 *
 * @description
 * POST { sourceId, begleitSourceIds: string[], zielsprache? }.
 * Laedt Transkript und Begleittexte server-seitig aus MongoDB (der Client
 * reicht keine Volltexte durch), ruft den Secretary (`transcript/
 * korrekturvorschlag`, P2) und gibt die Vorschlaege unveraendert zurueck.
 * Secretary-Fehler kommen mit Status und Code beim Client an.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { LibraryService } from '@/lib/services/library-service'
import { ladeBegleittexte, ladeTranskript } from '@/lib/transkript-korrektur/laden'
import { holeKorrekturvorschlag, SecretaryVorschlagError, VORSCHLAG_MAX_ZEICHEN } from '@/lib/transkript-korrektur/vorschlag'

interface Body {
  sourceId?: unknown
  begleitSourceIds?: unknown
  zielsprache?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const body = (await request.json().catch(() => null)) as Body | null
    const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''
    if (!sourceId) return NextResponse.json({ error: 'sourceId erforderlich' }, { status: 400 })
    const begleit = body?.begleitSourceIds
    if (begleit !== undefined && (!Array.isArray(begleit) || begleit.some((id) => typeof id !== 'string'))) {
      return NextResponse.json({ error: 'begleitSourceIds muss eine Liste von Strings sein' }, { status: 400 })
    }
    const begleitSourceIds = (begleit as string[] | undefined) ?? []
    const zielsprache = typeof body?.zielsprache === 'string' && body.zielsprache.trim() ? body.zielsprache.trim() : 'de'

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const stand = await ladeTranskript({ libraryId, sourceId })
    if (!stand) return NextResponse.json({ error: 'Kein Transkript fuer diese Quelle', code: 'kein_transkript' }, { status: 404 })

    let begleittexte
    try {
      begleittexte = await ladeBegleittexte({ libraryId, sourceIds: begleitSourceIds })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error), code: 'begleittext_fehlt' }, { status: 400 })
    }

    const zeichen = stand.body.length + begleittexte.reduce((sum, t) => sum + t.text.length, 0)
    if (zeichen > VORSCHLAG_MAX_ZEICHEN) {
      return NextResponse.json(
        { error: `Transkript und Begleittexte haben ${zeichen} Zeichen, erlaubt sind ${VORSCHLAG_MAX_ZEICHEN}`, code: 'INPUT_TOO_LARGE' },
        { status: 413 },
      )
    }

    const vorschlag = await holeKorrekturvorschlag({ transkript: stand.body, begleittexte, zielsprache })
    FileLogger.info('transcript-correction/suggest', 'Vorschlag erhalten', {
      libraryId, sourceId, begleit: begleittexte.length, ersetzungen: vorschlag.ersetzungen.length,
      sprecher: vorschlag.sprecher.length, verworfen: vorschlag.verworfen.length, modell: vorschlag.modell,
    })
    return NextResponse.json(vorschlag)
  } catch (error) {
    if (error instanceof SecretaryVorschlagError) {
      FileLogger.warn('transcript-correction/suggest', 'Secretary-Fehler', { status: error.status, code: error.code, message: error.message })
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    FileLogger.error('transcript-correction/suggest', 'Unerwarteter Fehler', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
