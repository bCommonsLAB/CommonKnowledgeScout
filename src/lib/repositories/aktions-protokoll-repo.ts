/**
 * @fileoverview Aktions-Protokoll — WARUM eine Aktion lief, nicht nur DASS.
 *
 * @description
 * KnowledgeScout fuehrt Job-Historie und Befunde ohnehin in seiner Datenbank —
 * die BEGRUENDUNG einer Aktion hatte dort bisher keinen Platz. Deshalb legten
 * Agenten sie als `ORDNUNGSZUSTAND.md` im Archiv ab: dieselbe Buchhaltung ein
 * zweites Mal, von Hand gepflegt (Entscheidung Peter, 27.08.2026 — „ich werde
 * das nicht pflegen").
 *
 * Jede schreibende Aktion ueber die MCP-Bruecke traegt darum eine
 * `begruendung`, und die landet hier. Der Vault bleibt frei davon.
 *
 * Bewusste Abweichung vom Per-Library-Pattern
 * (`docs/architecture/mongodb-repository-pattern.md`), wie beim
 * {@link module:repositories/mail-log-repo}: EINE globale Collection, damit
 * ein Vorhaben ueber Library-Grenzen hinweg lesbar bleibt; der Library-Bezug
 * ist ein Feld.
 *
 * **Das Protokoll darf eine Aktion NIE blockieren.** Schlaegt das Schreiben
 * fehl, wird es laut geloggt und die Aktion gilt trotzdem.
 *
 * @module repositories
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'
import { FileLogger } from '@/lib/debug/logger'

const COLLECTION_NAME = 'aktions_protokoll'

/** Obergrenze der Begruendung — ein Satz, kein Aufsatz. */
export const MAX_BEGRUENDUNG = 500

export interface AktionsProtokollEintrag {
  /** Werkzeugname der Bruecke, z. B. `stand_setzen`. */
  werkzeug: string
  libraryId: string
  /**
   * Handelnder laut Account-Schluessel. ACHTUNG: Das ist der Inhaber des
   * Schluessels, NICHT der Agent, der ihn benutzt — die Bruecke kennt keine
   * Agenten-Identitaet. Wer gehandelt hat, sagt darum {@link kanal}.
   */
  akteur: string
  /**
   * Woher die Aktion kam (Cowork-Befund 27.08.2026: „Der Akteur sagt nicht,
   * wer gehandelt hat"). `bruecke` = ein Agent ueber MCP; die Knoepfe der
   * Werkbank schreiben hier gar nicht.
   */
  kanal: 'bruecke'
  /**
   * `vorschau` = die Aktion hat NICHTS geaendert (z. B. `nurVorschau: true`).
   * Ohne diese Unterscheidung behauptet das Protokoll Aenderungen, die es
   * nicht gab.
   */
  modus?: 'vorschau'
  /** Vorhaben/Ordner der Aktion, soweit bekannt. */
  folderId?: string
  /** Library-relativer Pfad, soweit bekannt (fuer die Anzeige je Vorhaben). */
  pfad?: string
  /** Betroffene Quelle, soweit die Aktion eine meint. */
  sourceId?: string
  /** WARUM — der eigentliche Zweck dieses Protokolls. */
  begruendung: string
  status: 'ok' | 'fehler'
  /** Kurzfassung des Ergebnisses (jobIds, geschriebene Felder, …). */
  ergebnis?: Record<string, unknown>
  /** Klartext bei `status: 'fehler'` — auch Fehlversuche sind Geschichte. */
  fehler?: string
  createdAt: string
}

let cachedCollection: Collection<AktionsProtokollEintrag> | null = null
let indexesEnsured = false

async function collection(): Promise<Collection<AktionsProtokollEintrag>> {
  if (!cachedCollection) {
    cachedCollection = await getCollection<AktionsProtokollEintrag>(COLLECTION_NAME)
  }
  if (!indexesEnsured) {
    await cachedCollection.createIndex({ libraryId: 1, folderId: 1, createdAt: -1 })
    await cachedCollection.createIndex({ libraryId: 1, createdAt: -1 })
    indexesEnsured = true
  }
  return cachedCollection
}

/**
 * Schreibt einen Eintrag. Wirft NIE — eine gescheiterte Protokollierung darf
 * die Aktion nicht rueckgaengig machen, die bereits gelaufen ist.
 */
export async function protokolliereAktion(
  eintrag: Omit<AktionsProtokollEintrag, 'createdAt'>,
): Promise<void> {
  try {
    const col = await collection()
    await col.insertOne({ ...eintrag, createdAt: new Date().toISOString() })
  } catch (fehler) {
    FileLogger.error('aktions-protokoll', 'Eintrag nicht geschrieben', {
      werkzeug: eintrag.werkzeug,
      libraryId: eintrag.libraryId,
      fehler: fehler instanceof Error ? fehler.message : String(fehler),
    })
  }
}

/** Protokoll eines Vorhabens, juengste zuerst. */
export async function leseAktionsProtokoll(args: {
  libraryId: string
  folderId?: string
  limit?: number
}): Promise<AktionsProtokollEintrag[]> {
  const col = await collection()
  const filter: Record<string, unknown> = { libraryId: args.libraryId }
  if (args.folderId !== undefined) filter.folderId = args.folderId
  return col
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(args.limit ?? 50, 200))
    .toArray()
}
