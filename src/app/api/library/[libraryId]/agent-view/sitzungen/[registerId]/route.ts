/**
 * @fileoverview API-Route: eine Zeile des Sitzungs-Registers pflegen (Register, Welle R3).
 *
 * @description
 * PATCH /api/library/[libraryId]/agent-view/sitzungen/[registerId]
 *   Body: Felder von `sitzung_setzen` — `entscheidung`, `entscheidungGrund`,
 *   `zugbereiche`, `vorhabenVorschlag` (null loescht), `bemerkung` ("" loescht),
 *   `sitzungId` (Kennung nachtragen). Den Stand setzt niemand: er wird aus
 *   Beleg und Notiz gerechnet. Derselbe Dienst wie die Bruecke
 *   (`setzeSitzung`). Benannte Fehler: 400 Eingabe, 404 unbekannte Zeile,
 *   409 Kennung vergeben.
 *
 * Konventionen: `docs/architecture/api-route-conventions.md`.
 *
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server'
import { FileLogger } from '@/lib/debug/logger'
import { SitzungNichtGefundenError, setzeSitzung } from '@/lib/agent-view/sitzungen-register/register-dienst'
import type { SitzungSetzenAntwort } from '@/lib/agent-view/sitzungen-register/reiter-antwort'
import { SitzungsEingabeError } from '@/lib/agent-view/sitzungen-register/schreib-plaene'
import { leseSetzBody } from '@/lib/agent-view/sitzungen-register/setz-eingabe-lesen'
import { SitzungsKennungVergebenError } from '@/lib/repositories/agent-view-sitzungen-repo'
import { pruefeSitzungenZugriff } from '../sitzungen-zugriff'

type RouteParams = { params: Promise<{ libraryId: string; registerId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { libraryId, registerId: roh } = await params
    // Schluessel wie `alt:B12` kommen kodiert an; nur dekodieren, wenn noetig.
    const registerId = roh.includes('%') ? decodeURIComponent(roh) : roh
    const zugriff = await pruefeSitzungenZugriff(libraryId)
    if (zugriff.fehler) return zugriff.fehler

    const body: unknown = await request.json().catch(() => null)
    if (body === null) return NextResponse.json({ error: 'JSON-Body erforderlich' }, { status: 400 })
    const gelesen = leseSetzBody(body)
    if (!gelesen.ok) return NextResponse.json({ error: gelesen.fehler, code: 'eingabe_ungueltig' }, { status: 400 })

    const r = await setzeSitzung({ libraryId: zugriff.libraryId, registerId, eingabe: gelesen.eingabe, jetzt: new Date().toISOString() })
    const antwort: SitzungSetzenAntwort = {
      registerId: r.zeile.registerId,
      geaendert: r.felder,
      unveraendert: r.felder.length === 0,
      umgeschluesselt: r.umgeschluesselt,
      zusammengefuehrt: r.zusammengefuehrt,
    }
    return NextResponse.json(antwort)
  } catch (error) {
    if (error instanceof SitzungsEingabeError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    if (error instanceof SitzungNichtGefundenError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 })
    }
    if (error instanceof SitzungsKennungVergebenError) {
      return NextResponse.json({ error: error.message, code: 'kennung_vergeben' }, { status: 409 })
    }
    FileLogger.error('agent-view-sitzungen', 'PATCH fehlgeschlagen', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Interner Fehler' }, { status: 500 })
  }
}
