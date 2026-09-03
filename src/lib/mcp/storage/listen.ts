/**
 * @fileoverview Ordnerlisting mit Blaetterung, Muster und Tiefe (Welle ST2).
 *
 * @description
 * Zwei Belege aus der Cowork-Sitzung stecken hier drin:
 *
 * - Ein Ordner wurde viermal gelistet, nur um eine itemId zu finden — die
 *   Liste liefert deshalb je Eintrag alle Metadaten, damit kein zweiter
 *   Aufruf pro Datei noetig ist.
 * - Ein rekursiver Lauf ueber 1.100 Ordner reisst das 60-Sekunden-Limit.
 *   Deshalb ist die Zahl der Listings je Aufruf hart begrenzt — und eine
 *   erreichte Grenze wird GEMELDET, nicht stillschweigend abgeschnitten.
 *
 * @module mcp/storage
 */

import type { StorageItem } from '@/lib/storage/types'
import { kindPfad } from './adressierung'
import {
  MAX_BYTES_LISTE_VORGABE,
  type ZusammenfassungZeile,
  begrenzeSeite,
  fasseZusammen,
} from './listen-verdichten'

/** Ein Eintrag, wie ihn `ordner_listen` zurueckgibt. */
export interface Eintrag {
  name: string
  pfad: string
  id: string
  typ: 'datei' | 'ordner'
  groesse: number
  geaendertAm: string
  /** Fehlt, wenn der Provider fuer dieses Item keine Version liefert. */
  version?: string
}

/** Obergrenze fuer Ordner-Listings pro Aufruf — schuetzt vor dem Zeitlimit. */
export const MAX_LISTINGS = 200

export function zuEintrag(item: StorageItem, elternPfad: string): Eintrag {
  return {
    name: item.metadata.name,
    pfad: kindPfad(elternPfad, item.metadata.name),
    id: item.id,
    typ: item.type === 'folder' ? 'ordner' : 'datei',
    groesse: item.metadata.size,
    geaendertAm: item.metadata.modifiedAt.toISOString(),
    ...(item.metadata.version ? { version: item.metadata.version } : {}),
  }
}

/**
 * Uebersetzt ein Glob-Muster (`*.md`, `_*`, `BERICHT.?d`) in einen Regex.
 *
 * Bewusst nur `*` und `?` — kein `**`, keine Klassen. Ein maechtigeres Muster
 * wuerde hier mehr versprechen, als der Filter einloest: Er prueft nur den
 * NAMEN eines Eintrags, nicht seinen Pfad.
 */
export function musterAlsRegex(muster: string): RegExp {
  const escaped = muster.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i')
}

export interface ListenErgebnis {
  eintraege: Eintrag[]
  /** true = es gibt mehr Eintraege als geliefert. */
  weitereVorhanden: boolean
  /** Als `cursor` des naechsten Aufrufs; null = fertig. */
  naechsterCursor: string | null
  /** Wie viele Ordner tatsaechlich gelistet wurden. */
  gelisteteOrdner: number
  /**
   * Gesetzt, wenn {@link MAX_LISTINGS} gegriffen hat: Die Antwort ist dann
   * UNVOLLSTAENDIG, und zwar nicht am Ende, sondern in der Tiefe. Das muss
   * dastehen — eine gekappte Liste, die vollstaendig aussieht, ist schlimmer
   * als eine, die zu gross ist.
   */
  abgeschnitten?: string
  /** Gesetzt, wenn das Byte-Budget (`maxBytes`) die Seite gekuerzt hat. */
  gekuerzt?: string
  /**
   * Statt der Namensliste: je direktem Unterordner Anzahl, Groesse und
   * juengstes Datum. Gesetzt genau dann, wenn `zusammenfassung` angefordert
   * wurde — dann bleibt `eintraege` leer.
   */
  zusammenfassung?: ZusammenfassungZeile[]
}

/**
 * Listet einen Ordner, optional rekursiv bis `tiefe`, gefiltert nach `muster`,
 * und gibt eine Seite ab `cursor` zurueck.
 *
 * `liste` wird injiziert (statt eines Providers), damit die Blaetterungs- und
 * Tiefenlogik ohne Storage testbar bleibt.
 */
export async function listeOrdner(args: {
  liste: (folderId: string) => Promise<StorageItem[]>
  folderId: string
  ordnerPfad: string
  tiefe: number
  muster?: string
  limit: number
  cursor?: string
  maxBytes?: number
  zusammenfassung?: boolean
}): Promise<ListenErgebnis> {
  const { liste, folderId, ordnerPfad, tiefe, muster, limit } = args
  const regex = muster ? musterAlsRegex(muster) : null

  const alle: Eintrag[] = []
  let gelistet = 0
  let abgeschnitten: string | undefined

  const warteschlange: Array<{ id: string; pfad: string; tiefe: number }> = [
    { id: folderId, pfad: ordnerPfad, tiefe: 0 },
  ]

  while (warteschlange.length > 0) {
    const aktuell = warteschlange.shift() as { id: string; pfad: string; tiefe: number }
    if (gelistet >= MAX_LISTINGS) {
      abgeschnitten =
        `Nach ${MAX_LISTINGS} Ordner-Listings abgebrochen (Zeitlimit-Schutz) — ` +
        `${warteschlange.length + 1} Ordner ungelesen. Kleineren Teilbaum oder geringere Tiefe waehlen.`
      break
    }

    const items = await liste(aktuell.id)
    gelistet += 1

    for (const item of items) {
      const eintrag = zuEintrag(item, aktuell.pfad)
      // Der Muster-Filter betrifft nur die AUSGABE, nicht den Abstieg:
      // "*.md" soll Dateien in Unterordnern finden, nicht die Suche an
      // Ordnernamen abwuergen.
      if (!regex || regex.test(item.metadata.name)) alle.push(eintrag)
      if (item.type === 'folder' && aktuell.tiefe < tiefe) {
        warteschlange.push({ id: item.id, pfad: eintrag.pfad, tiefe: aktuell.tiefe + 1 })
      }
    }
  }

  const rest = { gelisteteOrdner: gelistet, ...(abgeschnitten ? { abgeschnitten } : {}) }

  // Die Verdichtung blaettert NICHT: Sie hat je Unterordner eine Zeile und
  // ist damit von Natur aus klein. `limit`/`cursor` darauf anzuwenden hiesse,
  // den Ueberblick zu zerschneiden, den sie herstellen soll.
  if (args.zusammenfassung) {
    return {
      eintraege: [],
      zusammenfassung: fasseZusammen(alle, ordnerPfad, folderId),
      weitereVorhanden: false,
      naechsterCursor: null,
      ...rest,
    }
  }

  const start = leseCursor(args.cursor)
  const { seite, gekuerzt } = begrenzeSeite(
    alle.slice(start, start + limit),
    args.maxBytes ?? MAX_BYTES_LISTE_VORGABE,
  )
  const weitere = start + seite.length < alle.length
  return {
    eintraege: seite,
    weitereVorhanden: weitere,
    naechsterCursor: weitere ? String(start + seite.length) : null,
    ...rest,
    ...(gekuerzt ? { gekuerzt } : {}),
  }
}

function leseCursor(cursor?: string): number {
  if (cursor === undefined) return 0
  const wert = Number.parseInt(cursor, 10)
  if (!Number.isInteger(wert) || wert < 0) {
    throw new Error(`Ungueltiger cursor: "${cursor}" — den Wert aus naechsterCursor unveraendert zurueckgeben`)
  }
  return wert
}
