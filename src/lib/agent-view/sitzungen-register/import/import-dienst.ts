/**
 * @fileoverview Arbeitsliste ins Sitzungs-Register uebernehmen (R2, I/O).
 *
 * @description
 * Liest die Liste aus dem Speicher (ueber den Text, nie von einem Modell
 * abgetippt, W10), das Register und die Belege mit Notiz (MongoDB), plant mit
 * `planeImport` und schreibt nur ohne `nurVorschau`. Die Bilanz zaehlt je
 * Teil (A–D) erledigt, offen und uebersprungen, damit sie gegen den Nachtrag
 * der Liste geprueft werden kann.
 *
 * @module agent-view/sitzungen-register/import
 */

import { SITZUNGS_SPRACHE, SITZUNGS_VORLAGE } from '@/lib/agent-view/sichten/sitzungen-types'
import { listeRegister, schreibeImport, type AbgleichSchreibErgebnis } from '@/lib/repositories/agent-view-sitzungen-repo'
import { findeTransformationenNachVorlage } from '@/lib/repositories/shadow-twin-transformationen'
import { istAusTransformation } from '../ist-beleg'
import { parseArbeitsliste, type ParseFehler } from './arbeitsliste-parsen'
import { planeImport, type ImportZeileBericht } from './import-planen'

export interface ImportBilanz {
  zeilen: number
  jeTeil: Record<string, { zeilen: number; erledigt: number; offen: number; uebersprungen: number }>
  jeWeg: Record<string, number>
  jeAktion: Record<string, number>
}

export interface ImportErgebnis {
  modus: 'vorschau' | 'geschrieben'
  abschnitte: number
  bilanz: ImportBilanz
  geplant: { neu: number; ergaenzt: number }
  geschrieben: AbgleichSchreibErgebnis | null
  parseFehler: ParseFehler[]
  lesefehler: string[]
  /** Zeilen mit Hinweisen (erledigt ohne Beleg, mehrdeutig, Widerspruch …). */
  auffaellig: ImportZeileBericht[]
  belegeOhneZeile: string[]
}

function zaehle<T extends string>(werte: readonly T[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const w of werte) r[w] = (r[w] ?? 0) + 1
  return r
}

export function bilanzDesImports(zeilen: readonly ImportZeileBericht[]): ImportBilanz {
  const jeTeil: ImportBilanz['jeTeil'] = {}
  for (const z of zeilen) {
    const teil = z.nr.charAt(0)
    const t = (jeTeil[teil] ??= { zeilen: 0, erledigt: 0, offen: 0, uebersprungen: 0 })
    t.zeilen += 1
    if (z.ueberspringen) t.uebersprungen += 1
    if (z.erledigt) t.erledigt += 1
    else t.offen += 1
  }
  return { zeilen: zeilen.length, jeTeil, jeWeg: zaehle(zeilen.map((z) => z.weg)), jeAktion: zaehle(zeilen.map((z) => z.aktion)) }
}

export async function importiereArbeitsliste(args: {
  libraryId: string
  text: string
  nurVorschau: boolean
  jetzt: string
}): Promise<ImportErgebnis> {
  const parsed = parseArbeitsliste(args.text)
  if (parsed.zeilen.length === 0) {
    throw new Error('Keine Listenzeilen gefunden — fehlt der Abschnitt „## Sitzungen nach Vorhaben"?')
  }
  const [docs, transformationen] = await Promise.all([
    listeRegister(args.libraryId),
    findeTransformationenNachVorlage({ libraryId: args.libraryId, template: SITZUNGS_VORLAGE, language: SITZUNGS_SPRACHE }),
  ])
  const plan = planeImport({
    libraryId: args.libraryId, zeilen: parsed.zeilen, docs, belege: transformationen.map(istAusTransformation), jetzt: args.jetzt,
  })
  const geschrieben = args.nurVorschau ? null : await schreibeImport(args.libraryId, plan)
  return {
    modus: args.nurVorschau ? 'vorschau' : 'geschrieben',
    abschnitte: parsed.abschnitte.length,
    bilanz: bilanzDesImports(plan.zeilen),
    geplant: { neu: plan.neu.length, ergaenzt: plan.aenderungen.length },
    geschrieben,
    parseFehler: parsed.fehler,
    lesefehler: plan.fehler,
    auffaellig: plan.zeilen.filter((z) => z.hinweise.length > 0),
    belegeOhneZeile: plan.belegeOhneZeile,
  }
}
