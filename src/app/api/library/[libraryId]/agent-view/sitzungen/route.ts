/**
 * @fileoverview API-Route: Sitzungs-Register fuer den Reiter „Sitzungen" (Register, Welle R3).
 *
 * @description
 * GET /api/library/[libraryId]/agent-view/sitzungen
 *   → `SitzungenAntwort`: alle Zeilen (juengste zuerst) mit gerechnetem Stand,
 *   Hinweisen und Bericht-Stempeln, dazu die Bilanz. Liest das Register und
 *   die Notiz-Transformationen aus MongoDB (`ladeRegisterSicht`, derselbe Weg
 *   wie `sitzungen_auflisten`); den Speicher nur fuer die wenigen bekannten
 *   Belege ohne Notiz, einzeln per Id — kein Scan. Haengt NICHT am
 *   Coverage-Report (W8). Filter, Gruppen und Suche rechnet der Reiter.
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { FileLogger } from '@/lib/debug/logger'
import { bilanz, sortiereSitzungen } from '@/lib/agent-view/sitzungen-register/filter'
import { ladeRegisterSicht, type ItemLesen } from '@/lib/agent-view/sitzungen-register/ist-laden'
import type { SitzungenAntwort } from '@/lib/agent-view/sitzungen-register/reiter-antwort'
import { getServerProvider } from '@/lib/storage/server-provider'
import type { StorageProvider } from '@/lib/storage/types'
import { pruefeSitzungenZugriff } from './sitzungen-zugriff'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
): Promise<NextResponse> {
  try {
    const { libraryId } = await params
    const zugriff = await pruefeSitzungenZugriff(libraryId)
    if (zugriff.fehler) return zugriff.fehler

    // Der Speicher wird nur gebraucht, wenn das Register Belege ohne Notiz kennt.
    let provider: StorageProvider | null = null
    const itemLesen: ItemLesen = async (sourceId) => {
      const p = provider ?? (provider = await getServerProvider(zugriff.userEmail, zugriff.libraryId))
      const item = await p.getItemById(sourceId)
      return { id: item.id, parentId: item.parentId, name: item.metadata.name }
    }
    const jetzt = new Date().toISOString()
    const sicht = await ladeRegisterSicht({ libraryId: zugriff.libraryId, itemLesen, jetzt })
    const zeilen = sortiereSitzungen(sicht.zeilen)
    const antwort: SitzungenAntwort = { zeilen, bilanz: bilanz(zeilen), imSpeicherGeprueft: sicht.imSpeicherGeprueft, geladenAm: jetzt }
    return NextResponse.json(antwort)
  } catch (error) {
    FileLogger.error('agent-view-sitzungen', 'GET fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
