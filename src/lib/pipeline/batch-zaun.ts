/**
 * @fileoverview Zaun fuer Stapel-Laeufe: welche Ordner ein Batch NIE betritt.
 *
 * @description
 * Live-Test 07./08.10.2026: Der Batch-Dialog „Verzeichnis verarbeiten" nahm
 * Twin-Ordner (`_…`) und einen `test/`-Ordner mit — 29 Doppelgaenger im
 * Index. Owner-Entscheidung 08.10.: EIN Zaun fuer Batch-Dialog UND Bruecke
 * (`index_aktualisieren`), damit sich beide gleich verhalten. Ob die Library
 * ihre Twins im Dateisystem spiegelt, spielt dafuer keine Rolle mehr: ein
 * `_`-Ordner ist nie Quelle eines Stapels, `test` ist Spielwiese.
 *
 * @module pipeline
 */

import { isShadowTwinFolderName } from '@/lib/storage/shadow-twin'

/** Ordnernamen, die als Testbereich gelten (Vergleich ohne Gross/Klein). */
const TEST_ORDNER: ReadonlySet<string> = new Set(['test', 'tests'])

/** true = dieser Ordner (und alles darunter) bleibt aussen vor. */
export function istVomBatchAusgeschlossen(ordnerName: string): boolean {
  const name = ordnerName.trim()
  if (name === '') return false
  return isShadowTwinFolderName(name) || TEST_ORDNER.has(name.toLocaleLowerCase('de'))
}

/** Satz fuer Antworten und Hinweise — eine Formulierung, nicht zwei. */
export const ZAUN_BESCHREIBUNG = 'Twin-Ordner (_…) und test/-Ordner werden uebersprungen'
