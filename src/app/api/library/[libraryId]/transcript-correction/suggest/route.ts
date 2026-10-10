/**
 * @fileoverview Korrektur-Assistent: Vorschlaege fuer ein Audio-Transkript.
 *
 * @description
 * POST { sourceId, begleitSourceIds: string[], auftrag: string }.
 * Laedt die Satz-Segmente des letzten Transkriptions-Laufs und die
 * Begleittexte server-seitig aus MongoDB (der Client reicht keine Volltexte
 * durch), ruft die KI mit dem sichtbaren, editierbaren Auftrag und gibt
 * gepruefte Vorschlaege zurueck: Korrekturen je Satz (alt → neu) und
 * Sprecherwechsel (ab Satz, Name). Verworfenes kommt mit Grund mit.
 * Ohne Satz-Segmente kein Vorschlag (409) — dann zuerst neu transkribieren.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { getTranscriptSegments } from '@/lib/repositories/transcript-segments-repo'
import { LibraryService } from '@/lib/services/library-service'
import { ladeBegleittexte } from '@/lib/transkript-korrektur/laden'
import { ASSISTENT_MAX_ZEICHEN, holeAssistentVorschlaege } from '@/lib/transkript-korrektur/assistent-vorschlag'

interface Body {
  sourceId?: unknown
  begleitSourceIds?: unknown
  auftrag?: unknown
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
    const auftrag = typeof body?.auftrag === 'string' ? body.auftrag.trim() : ''
    if (!auftrag) return NextResponse.json({ error: 'auftrag erforderlich (Text an die KI)' }, { status: 400 })
    const begleit = body?.begleitSourceIds
    if (begleit !== undefined && (!Array.isArray(begleit) || begleit.some((id) => typeof id !== 'string'))) {
      return NextResponse.json({ error: 'begleitSourceIds muss eine Liste von Strings sein' }, { status: 400 })
    }
    const begleitSourceIds = (begleit as string[] | undefined) ?? []

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const segmente = await getTranscriptSegments({ libraryId, sourceId })
    if (!segmente || segmente.segments.length === 0) {
      return NextResponse.json(
        { error: 'Fuer dieses Transkript liegen keine Saetze vor — zuerst neu transkribieren', code: 'keine_saetze' },
        { status: 409 },
      )
    }
    const saetze = segmente.segments.map((s, index) => ({ index, text: s.text }))

    let begleittexte
    try {
      begleittexte = await ladeBegleittexte({ libraryId, sourceIds: begleitSourceIds })
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error), code: 'begleittext_fehlt' }, { status: 400 })
    }

    const zeichen = saetze.reduce((sum, s) => sum + s.text.length, 0) + begleittexte.reduce((sum, t) => sum + t.text.length, 0)
    if (zeichen > ASSISTENT_MAX_ZEICHEN) {
      return NextResponse.json(
        { error: `Transkript und Begleittexte haben ${zeichen} Zeichen, erlaubt sind ${ASSISTENT_MAX_ZEICHEN} — weniger Begleitdokumente waehlen`, code: 'INPUT_TOO_LARGE' },
        { status: 413 },
      )
    }

    // Bekannte Namen der Library belegen Namen wie ein Begleitdokument (z. B. Personen aus dem Publikum, die sich vorstellen).
    const bekannteNamen = Array.isArray(library.config?.extractionKnownNames) ? library.config.extractionKnownNames : []
    const lauf = await holeAssistentVorschlaege({ auftrag, saetze, begleittexte, bekannteNamen })
    FileLogger.info('transcript-correction/suggest', 'Assistent-Vorschlaege', {
      libraryId, sourceId, begleit: begleittexte.length, korrekturen: lauf.korrekturen.length,
      sprecher: lauf.sprecher.length, verworfen: lauf.verworfen.length, modell: lauf.modell, dauerMs: lauf.dauerMs,
    })
    return NextResponse.json(lauf)
  } catch (error) {
    FileLogger.error('transcript-correction/suggest', 'Vorschlaege fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
