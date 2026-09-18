/**
 * @fileoverview Groessenhinweis beim Schreiben einer `BERICHT.md` (Wunschliste 6, B2).
 *
 * @description
 * Berichte wachsen zu Tagebuechern, weil Anhaengen ein billiger Aufruf ist
 * und Verdichten ein teurer. Der Scan meldet das erst beim naechsten Lauf —
 * dieser Hinweis macht es IM MOMENT des Schreibens sichtbar: Die Antwort von
 * `datei_patchen`, `datei_schreiben` und `datei_anlegen` traegt bei jeder
 * `BERICHT.md` die Groesse nachher, die Schwelle ihrer Rolle und ob sie
 * ueberschritten ist.
 *
 * NICHT blockierend (Wunschliste 6, Teil D): Ein Bericht darf kurzzeitig
 * ueber der Schwelle liegen, waehrend verdichtet wird.
 *
 * Reine Funktion; die Schwelle kommt aus derselben Quelle wie im Scan
 * (`leseBerichtMaxBytes`, `schwelleFuerRolle`) — kein zweiter Massstab.
 *
 * @module mcp/storage
 */

import { BERICHT_FILE_NAME } from '@/lib/agent-view/archive-scan'
import { leseBerichtMaxBytes, schwelleFuerRolle, type BerichtMaxBytesConfig } from '@/lib/agent-view/bericht-zustand'
import { asString } from '@/lib/agent-view/sichten/bericht-lesen'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { PatchModus } from './patch'

export interface BerichtHinweis {
  groesseNachher: number
  /** Schwelle der Rolle in Bytes; null = fuer diese Rolle ist keine gesetzt. */
  schwelle: number | null
  schwelleUeberschritten: boolean
  hinweis?: string
}

const NEUER_ABSCHNITT = 'Neuer Abschnitt im Bericht — gehört das in eine Ereignisnotiz?'

function dateiname(pfad: string): string {
  return pfad.replace(/\\/g, '/').split('/').pop() ?? ''
}

/** Fuegt einer der Schritte einen Block mit eigener `##`-Ueberschrift ein? */
function fuegtAbschnittEin(modi: readonly PatchModus[]): boolean {
  return modi.some((modus) => modus.art === 'abschnitt_einfuegen' && /^## /m.test(modus.inhalt))
}

/**
 * Liefert die Hinweis-Felder fuer die Werkzeug-Antwort — oder ein leeres
 * Objekt, wenn die Datei keine `BERICHT.md` ist.
 */
export function berichtHinweis(args: {
  pfad: string
  inhaltNachher: string
  berichtMaxBytes: BerichtMaxBytesConfig | undefined
  modi?: readonly PatchModus[]
}): BerichtHinweis | Record<string, never> {
  if (dateiname(args.pfad) !== BERICHT_FILE_NAME) return {}
  const groesseNachher = Buffer.byteLength(args.inhaltNachher, 'utf-8')
  const rolle = asString(parseFrontmatter(args.inhaltNachher).meta.rolle)
  const { schwelle } = schwelleFuerRolle(rolle, leseBerichtMaxBytes(args.berichtMaxBytes))
  return {
    groesseNachher,
    schwelle,
    schwelleUeberschritten: schwelle !== null && groesseNachher > schwelle,
    ...(args.modi && fuegtAbschnittEin(args.modi) ? { hinweis: NEUER_ABSCHNITT } : {}),
  }
}
