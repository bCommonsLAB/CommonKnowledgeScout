/**
 * @fileoverview Begruendungs-Pflicht fuer schreibende Bruecken-Werkzeuge.
 *
 * @description
 * Entscheidung Peter (27.08.2026): Das Arbeitsprotokoll gehoert nicht als
 * `ORDNUNGSZUSTAND.md` in den Vault — KnowledgeScout fuehrt Jobs und Befunde
 * ohnehin in seiner Datenbank, nur das WARUM fehlte dort. Also traegt jede
 * schreibende Aktion der Bruecke eine `begruendung`, und die wird
 * mitgeschrieben.
 *
 * Die Pflicht trifft ausdruecklich NUR die Bruecke — die Knoepfe der Werkbank
 * laufen nicht hier durch. Der Mensch fuellt nichts aus, der Agent begruendet.
 *
 * Grenze, die das Protokoll NICHT ueberschreiten kann (Cowork-Befund
 * 27.08.2026): Eine Eingabe, die schon an der Schema-Pruefung scheitert —
 * etwa ein Aufruf OHNE `begruendung` — erreicht diesen Code nie und steht
 * darum nicht im Protokoll. Erfasst sind Fehler NACH der Validierung.
 *
 * @module mcp
 */

import { z } from 'zod'
import { MAX_BEGRUENDUNG, protokolliereAktion } from '@/lib/repositories/aktions-protokoll-repo'

/** Pflichtfeld jeder schreibenden Aktion — ein Satz, warum sie noetig ist. */
export const BEGRUENDUNG = z
  .string()
  .trim()
  .min(3)
  .max(MAX_BEGRUENDUNG)
  .describe(
    'PFLICHT: in einem Satz, WARUM diese Aktion noetig ist (z. B. „Transkript nach Hoerfehler-Korrektur neu transformiert"). ' +
      'Wird im Aktions-Protokoll der Library mitgeschrieben und ersetzt handgepflegte Protokoll-Dateien im Archiv.',
  )

export interface ProtokollKopf {
  werkzeug: string
  libraryId: string
  akteur: string
  begruendung: string
  folderId?: string
  pfad?: string
  sourceId?: string
  /** Setzen, wenn die Aktion nur rendert/prueft und nichts schreibt. */
  modus?: 'vorschau'
}

/**
 * Fuehrt die Aktion aus und schreibt sie mit ihrer Begruendung ins Protokoll —
 * Erfolg wie Fehlschlag. Der Fehler wird unveraendert weitergereicht, damit
 * die Werkzeuge ihre bestehende Fehlerbehandlung behalten.
 */
export async function mitProtokoll<T>(kopf: ProtokollKopf, ausfuehren: () => Promise<T>): Promise<T> {
  try {
    const ergebnis = await ausfuehren()
    await protokolliereAktion({
      ...kopf,
      kanal: 'bruecke',
      status: 'ok',
      ergebnis: zusammenfassung(ergebnis),
    })
    return ergebnis
  } catch (fehler) {
    // Auch ein Fehlversuch ist Geschichte: Wer spaeter fragt, warum dreimal
    // dasselbe versucht wurde, findet es hier.
    await protokolliereAktion({
      ...kopf,
      kanal: 'bruecke',
      status: 'fehler',
      fehler: fehler instanceof Error ? fehler.message : String(fehler),
    })
    throw fehler
  }
}

/** Kurzfassung des Ergebnisses — das Protokoll ist kein zweiter Report. */
function zusammenfassung(ergebnis: unknown): Record<string, unknown> | undefined {
  if (ergebnis === null || typeof ergebnis !== 'object') return undefined
  const roh = JSON.stringify(ergebnis)
  if (roh.length <= 2000) return ergebnis as Record<string, unknown>
  return { gekuerzt: `${roh.slice(0, 2000)}…`, hinweis: 'Ergebnis zu gross fuers Protokoll — gekuerzt' }
}
