/**
 * @fileoverview API-Route: Erklaerten Stand eines Vorhabens setzen (F8, Welle W7).
 *
 * @description
 * POST /api/library/[libraryId]/agent-view/stand
 * Body `{ folderId, stand, erwarteterStand, reportGeneratedAt, bestaetigen? }`
 * → 200 `{ stand: { bearbeitungsstand, bearbeitungsstandSeit } }`.
 *
 * Duenne Route (Logik in `stand-plan.ts`/`stand-schreiben.ts`): Sie verdrahtet
 * Provider, gespeicherten Report und den frischen, UNGESPEICHERTEN
 * Teilbaum-Scan der Stufe 4. Benannter Fehlerkatalog statt anonymer Fehler:
 * 400 `invalid_request` · 404 Library/Ordner · 409 `kein_index` |
 * `stand_geaendert` (mit `aktuellerStand`) | `report_veraltet` |
 * `nicht_bereit` (mit `befunde` + `gesamt`). Bei jedem Befund wird nichts
 * geschrieben. Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { OrdnerNichtGefundenError } from '@/lib/agent-view/bericht-laden'
import { scanLibraryCoverage } from '@/lib/agent-view/run-coverage-scan'
import {
  KeinIndexError,
  NichtBereitError,
  ReportVeraltetError,
  StandGeaendertError,
  StandValidationError,
  parseStandRequest,
} from '@/lib/agent-view/stand-plan'
import { setzeStand } from '@/lib/agent-view/stand-schreiben'
import { FileLogger } from '@/lib/debug/logger'
import { getCoverageReport } from '@/lib/repositories/agent-view-coverage-repo'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'

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
    if (!libraryId) return NextResponse.json({ error: 'Library-ID fehlt' }, { status: 400 })

    const standRequest = parseStandRequest(await request.json().catch(() => null))

    // Zugriffspruefung: Library muss fuer diesen User sichtbar sein.
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const provider = await getServerProvider(userEmail, libraryId)
    const gespeichert = await getCoverageReport(libraryId)

    const ergebnis = await setzeStand(
      {
        request: standRequest,
        gespeicherterGeneratedAt: gespeichert?.generatedAt ?? null,
        // Stufe 4: frisch gerechnet, NIE gespeichert (§F10: Rechnung ≠ Cache).
        scanTeilbaum: async () =>
          (await scanLibraryCoverage({ libraryId, userEmail, folderId: standRequest.folderId })).gaps,
        now: () => new Date().toISOString(),
      },
      {
        listFolder: (id) => provider.listItemsById(id),
        readText: async (id) => (await provider.getBinary(id)).blob.text(),
        deleteFile: (id) => provider.deleteItem(id),
        uploadMarkdown: async (folderId, name, content) => {
          const uploaded = await provider.uploadFile(
            folderId,
            new File([content], name, { type: 'text/markdown' }),
          )
          return { fileId: uploaded.id }
        },
      },
    )

    FileLogger.info('agent-view-stand', 'Stand gesetzt', {
      libraryId, folderId: standRequest.folderId,
      stand: standRequest.stand, bestaetigen: standRequest.bestaetigen,
    })
    return NextResponse.json({ stand: ergebnis })
  } catch (error) {
    if (error instanceof StandValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    if (error instanceof OrdnerNichtGefundenError) {
      return NextResponse.json({ error: 'Ordner nicht gefunden' }, { status: 404 })
    }
    if (error instanceof KeinIndexError || error instanceof ReportVeraltetError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    if (error instanceof StandGeaendertError) {
      return NextResponse.json(
        { error: error.message, code: error.code, aktuellerStand: error.aktuellerStand },
        { status: 409 },
      )
    }
    if (error instanceof NichtBereitError) {
      return NextResponse.json(
        { error: error.message, code: error.code, befunde: error.befunde, gesamt: error.gesamt },
        { status: 409 },
      )
    }
    FileLogger.error('agent-view-stand', 'POST fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
