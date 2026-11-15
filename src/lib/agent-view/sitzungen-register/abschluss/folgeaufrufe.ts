/**
 * @fileoverview Folgeaufrufe nach `sitzung_abschliessen` (Register, Welle R4, W5/E7). Reine Funktion.
 *
 * @description
 * Owner-Entscheid E7 (15.11.): Das Werkzeug wartet nicht auf den Job; der
 * Skill ruft die Folgeschritte nach `job_status: completed`. Darum nennt die
 * Antwort sie fertig zum Aufrufen: erst den Job verfolgen, dann den Block in
 * jedem Vorhaben (Haupt- und Nebenvorhaben) und die Chronik neu erzeugen —
 * beides braucht der Stand `berichtet` (W4). Scheiterte der Start, steht
 * der Neustart vorne; war die Notiz schon aktuell, entfaellt der Job.
 *
 * @module agent-view/sitzungen-register/abschluss
 */

import { SITZUNGS_VORLAGE } from '@/lib/agent-view/sichten/sitzungen-types'
import type { AbschlussErgebnis, Folgeaufruf } from './abschluss-typen'

export function planeFolgeaufrufe(args: {
  libraryId: string
  sitzungId: string
  sourceId: string
  transformation: AbschlussErgebnis['transformation']
  /** Vorhaben, deren Block die Sitzung nennen soll (leer = ohne Vorhaben). */
  blockOrdner: ReadonlyArray<{ folderId: string; name: string }>
}): Folgeaufruf[] {
  const begruendung = `Folgeschritt sitzung_abschliessen ${args.sitzungId}`
  const t = args.transformation
  const aufrufe: Folgeaufruf[] = []
  if ('jobId' in t) {
    aufrufe.push({
      werkzeug: 'job_status',
      // job_status kennt nur jobId (Schema ohne libraryId; Befund R4-Abnahme 15.11.).
      argumente: { jobId: t.jobId },
      wann: 'wiederholen, bis status completed (etwa 30 s); bei failed fehlerDetails melden und hier aufhoeren',
    })
  }
  if ('fehler' in t) {
    aufrufe.push({
      werkzeug: 'transformation_starten',
      argumente: { libraryId: args.libraryId, sourceId: args.sourceId, template: SITZUNGS_VORLAGE, begruendung },
      wann: 'nachdem der Fehler behoben ist; danach job_status bis completed',
    })
  }
  const nachJob = 'jobId' in t || 'fehler' in t ? 'nach job_status completed' : 'sofort (Notiz ist aktuell)'
  for (const ordner of args.blockOrdner) {
    aufrufe.push({
      werkzeug: 'sitzungen_block_schreiben',
      argumente: { libraryId: args.libraryId, folderId: ordner.folderId, begruendung },
      wann: `${nachJob} — Block im BERICHT.md von ${ordner.name}`,
    })
  }
  aufrufe.push({
    werkzeug: 'sichten_regenerieren',
    argumente: { libraryId: args.libraryId, sichten: ['sitzungen'], begruendung },
    wann: `${nachJob} — Chronik SITZUNGEN.md`,
  })
  return aufrufe
}
