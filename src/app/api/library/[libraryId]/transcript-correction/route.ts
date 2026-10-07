/**
 * @fileoverview Reiter „Korrektur" am Audio-Transkript (P3b): Zustand und Schreiben.
 *
 * @description
 * GET  ?sourceId=…  → Zustand ohne Body: `updatedAt` (Riegel), `speakers`,
 *                     `speakerNames`, Revisions-Felder, Transformationen.
 * POST { sourceId, ersetzungen?, sprecher?, begruendung, ifUpdatedAt, nurVorschau? }
 *      → wendet die Korrektur an (alles oder nichts) und schreibt nach
 *        MongoDB; der Spiegel folgt ueber den Service, wenn die Library
 *        `persistToFilesystem` fuehrt. 409 bei veraltetem `ifUpdatedAt`,
 *        422 bei nicht gefundenen oder mehrdeutigen Stellen — nie still.
 *
 * Die Bruecke (`transkript_korrigieren`) geht denselben Kern, behaelt aber
 * Spiegel-Riegel und `ifVersion`; hier gilt der MongoDB-Stand.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { FileLogger } from '@/lib/debug/logger'
import { ErsetzungNichtEindeutigError, ErsetzungNichtGefundenError, type Ersetzung } from '@/lib/mcp/transkript-korrektur'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getServerProvider } from '@/lib/storage/server-provider'
import { wendeKorrekturAn, type SprecherZuordnung } from '@/lib/transkript-korrektur/anwenden'
import { ladeTranskript, transkriptZustand } from '@/lib/transkript-korrektur/laden'
import { schreibeTranskriptKorrektur } from '@/lib/transkript-korrektur/schreiben'

interface ApplyBody {
  sourceId?: unknown
  ersetzungen?: unknown
  sprecher?: unknown
  begruendung?: unknown
  ifUpdatedAt?: unknown
  nurVorschau?: unknown
}

async function anmelden(): Promise<{ userEmail: string } | NextResponse> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
  if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
  return { userEmail }
}

function ersetzungenLesen(value: unknown): Ersetzung[] | string {
  if (value === undefined) return []
  if (!Array.isArray(value)) return 'ersetzungen muss eine Liste sein'
  const out: Ersetzung[] = []
  for (const [i, e] of value.entries()) {
    const o = e && typeof e === 'object' ? (e as Record<string, unknown>) : null
    if (!o || typeof o['alt'] !== 'string' || typeof o['neu'] !== 'string') return `ersetzungen[${i}]: alt und neu muessen Strings sein`
    if (o['alle'] !== undefined && typeof o['alle'] !== 'boolean') return `ersetzungen[${i}]: alle muss ein Boolean sein`
    out.push({ alt: o['alt'], neu: o['neu'], ...(o['alle'] === true ? { alle: true } : {}) })
  }
  return out
}

function sprecherLesen(value: unknown): SprecherZuordnung[] | string {
  if (value === undefined) return []
  if (!Array.isArray(value)) return 'sprecher muss eine Liste sein'
  const out: SprecherZuordnung[] = []
  for (const [i, e] of value.entries()) {
    const o = e && typeof e === 'object' ? (e as Record<string, unknown>) : null
    if (!o || typeof o['label'] !== 'string' || typeof o['name'] !== 'string') return `sprecher[${i}]: label und name muessen Strings sein`
    out.push({ label: o['label'], name: o['name'] })
  }
  return out
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const anmeldung = await anmelden()
    if (anmeldung instanceof NextResponse) return anmeldung
    const { libraryId } = await params
    const sourceId = new URL(request.url).searchParams.get('sourceId') || ''
    if (!sourceId) return NextResponse.json({ error: 'sourceId erforderlich' }, { status: 400 })

    const library = await LibraryService.getInstance().getLibrary(anmeldung.userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const stand = await ladeTranskript({ libraryId, sourceId })
    if (!stand) return NextResponse.json({ error: 'Kein Transkript fuer diese Quelle', code: 'kein_transkript' }, { status: 404 })
    return NextResponse.json(transkriptZustand(stand), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    FileLogger.error('transcript-correction', 'GET fehlgeschlagen', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const anmeldung = await anmelden()
    if (anmeldung instanceof NextResponse) return anmeldung
    const { userEmail } = anmeldung
    const { libraryId } = await params
    const body = (await request.json().catch(() => null)) as ApplyBody | null
    const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''
    if (!sourceId) return NextResponse.json({ error: 'sourceId erforderlich' }, { status: 400 })
    const ersetzungen = ersetzungenLesen(body?.ersetzungen)
    if (typeof ersetzungen === 'string') return NextResponse.json({ error: ersetzungen }, { status: 400 })
    const sprecher = sprecherLesen(body?.sprecher)
    if (typeof sprecher === 'string') return NextResponse.json({ error: sprecher }, { status: 400 })
    const nurVorschau = body?.nurVorschau === true
    const begruendung = typeof body?.begruendung === 'string' ? body.begruendung.trim() : ''
    // Die Vorschau schreibt nichts — sie braucht keine Begruendung; der Stempel ist dann nur Platzhalter.
    if (!begruendung && !nurVorschau) return NextResponse.json({ error: 'begruendung erforderlich' }, { status: 400 })
    const ifUpdatedAt = typeof body?.ifUpdatedAt === 'string' ? body.ifUpdatedAt : ''
    if (!ifUpdatedAt) return NextResponse.json({ error: 'ifUpdatedAt erforderlich (Stand aus GET)' }, { status: 400 })

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const stand = await ladeTranskript({ libraryId, sourceId })
    if (!stand) return NextResponse.json({ error: 'Kein Transkript fuer diese Quelle', code: 'kein_transkript' }, { status: 404 })
    if (stand.record.updatedAt !== ifUpdatedAt) {
      return NextResponse.json(
        { error: 'Das Transkript wurde inzwischen geaendert — bitte neu laden', code: 'konflikt', aktuelleVersion: stand.record.updatedAt },
        { status: 409 },
      )
    }

    const revision = { revised_by: userEmail, revised_at: new Date().toISOString(), revision_note: begruendung || '(Vorschau)' }
    let anwendung
    try {
      anwendung = wendeKorrekturAn({ markdown: stand.record.markdown, ersetzungen, sprecher, revision })
    } catch (error) {
      if (error instanceof ErsetzungNichtGefundenError || error instanceof ErsetzungNichtEindeutigError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: 422 })
      }
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error), code: 'ungueltig' }, { status: 422 })
    }
    const zustandVorher = transkriptZustand(stand)
    const basis = {
      belege: anwendung.belege,
      speakerNames: anwendung.speakerNames,
      revision,
      transformationen: zustandVorher.transformationen,
    }
    if (nurVorschau) return NextResponse.json({ ...basis, geschrieben: false, updatedAt: stand.record.updatedAt })

    const persistToFilesystem = getShadowTwinConfig(library).persistToFilesystem
    const provider = persistToFilesystem ? await getServerProvider(userEmail, libraryId) : undefined
    await schreibeTranskriptKorrektur({
      library, userEmail, provider, doc: stand.doc, markdownNeu: anwendung.markdownNeu, skipFilesystemMirror: false,
    })
    const danach = await ladeTranskript({ libraryId, sourceId })
    FileLogger.info('transcript-correction', 'Korrektur geschrieben', {
      libraryId, sourceId, ersetzungen: anwendung.belege.length, sprecher: sprecher.length, userEmail,
    })
    return NextResponse.json({ ...basis, geschrieben: true, updatedAt: danach?.record.updatedAt ?? null })
  } catch (error) {
    FileLogger.error('transcript-correction', 'POST fehlgeschlagen', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
