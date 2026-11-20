/**
 * @fileoverview Fehlerantwort der Admin-Routen: behebbare Fehler 400, alles andere 500 (geloggt).
 *
 * @module admin
 */

import { NextResponse } from 'next/server'
import { FileLogger } from '@/lib/debug/logger'
import { SprachmodellFehler } from '@/lib/llm-models/regeln'

export function fehlerAntwort(scope: string, aktion: string, error: unknown): NextResponse {
  const meldung = error instanceof Error ? error.message : String(error)
  if (error instanceof SprachmodellFehler) return NextResponse.json({ error: meldung }, { status: 400 })
  FileLogger.error(scope, `${aktion} fehlgeschlagen`, { error: meldung })
  return NextResponse.json({ error: meldung || 'Interner Fehler' }, { status: 500 })
}

/** Liest einen JSON-Body; ungueltiges JSON ist ein behebbarer Fehler (400). */
export async function leseJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch (error) {
    console.debug('[admin] Body ist kein JSON:', error)
    throw new SprachmodellFehler('Anfrage ohne gueltiges JSON')
  }
}
