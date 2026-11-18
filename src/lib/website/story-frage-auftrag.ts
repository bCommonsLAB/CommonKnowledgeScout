/**
 * Frage aus der Themenuebersicht an die Story-Sektion (Owner 18.11.2026).
 *
 * Die Sektion `layout=topics` zeigt die Themen des Story-Modus; ein Klick auf
 * eine Frage soll oben im Frage-Kasten gestellt werden. Die Themen-Sektion
 * legt dafuer einen Auftrag ab (`websiteStoryFrageAtom`), die Story-Sektion
 * nimmt ihn genau einmal an. Was sie damit tut, entscheidet diese reine
 * Funktion — damit es ohne React pruefbar ist.
 */

/** Eine Frage, die die Story-Sektion stellen soll. */
export interface StoryFrageAuftrag {
  text: string
}

/**
 * - `warten`: die Sektion laedt noch (Konfig) — Auftrag liegen lassen.
 * - `verwerfen`: die Sektion zeigt einen Fehler und hat keine Eingabe — laut verwerfen.
 * - `eintragen`: eine Antwort laeuft noch — Frage ins Eingabefeld setzen, nicht verlieren.
 * - `senden`: Frage sofort stellen (wie eine Beispielfrage).
 */
export type AuftragSchritt = 'warten' | 'verwerfen' | 'eintragen' | 'senden'

export function auftragSchritt(stand: { laedt: boolean; fehler: boolean; laeuft: boolean }): AuftragSchritt {
  if (stand.laedt) return 'warten'
  if (stand.fehler) return 'verwerfen'
  return stand.laeuft ? 'eintragen' : 'senden'
}
