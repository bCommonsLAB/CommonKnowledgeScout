/**
 * @fileoverview Folgeaufrufe nach `sitzung_abschliessen` (Register, Welle R4, W5/E7). Reine Funktion.
 *
 * @description
 * Owner-Entscheid E7 (15.11.): Das Werkzeug wartet nicht auf den Job; der
 * Skill ruft die Folgeschritte nach `job_status: completed`. Darum nennt die
 * Antwort sie fertig zum Aufrufen: erst den Job verfolgen, dann
 * `sitzung_eintragen` — die Zeile in Block (Haupt- und Nebenvorhaben) und
 * Chronik, ohne Scan (R4b, Befund 16.11.2026: vorher ein Teilbaum-Block, der
 * Querverweise loeschte, und ein voller Chronik-Lauf, je 90–100 s). Ohne
 * Vorhaben bleibt der volle Chronik-Lauf. Scheiterte der Start, steht der
 * Neustart vorne; war die Notiz schon aktuell, entfaellt der Job.
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
  if (args.blockOrdner.length > 0) {
    // R4b (Befund 16.11.): EIN Aufruf ohne Scan statt Teilbaum-Block (loeschte Querverweise) und vollem Chronik-Lauf.
    aufrufe.push({
      werkzeug: 'sitzung_eintragen',
      argumente: { libraryId: args.libraryId, sitzungId: args.sitzungId, begruendung },
      wann: `${nachJob} — Zeile im Block von ${args.blockOrdner.map((o) => o.name).join(', ')} und in der Chronik, ohne Scan (Sekunden); nennt sie offen, die vollen Laeufe aus ihren folgeaufrufen`,
    })
    return aufrufe
  }
  // Ohne Vorhaben: kein Block, und die Ablage bestimmt nur der volle Lauf.
  aufrufe.push({
    werkzeug: 'sichten_regenerieren',
    argumente: { libraryId: args.libraryId, sichten: ['sitzungen'], begruendung },
    wann: `${nachJob} — Chronik SITZUNGEN.md (voller Lauf, 1–2 min)`,
  })
  return aufrufe
}
