/**
 * @fileoverview Antwortgrenze und Verdichtung fuer `ordner_listen` (Welle W5).
 *
 * @description
 * Cowork-Befund 02.09.2026: `tiefe: 2` auf einen grossen Vorhabensordner ergab
 * **78.634 Zeichen**. Der Ordner blieb deswegen ungeprueft — nicht, weil etwas
 * kaputt waere, sondern weil die Antwort nicht durch das Fenster passt.
 *
 * `datei_lesen` loest dasselbe Problem seit ST2 mit `maxBytes`/`gekuerzt`
 * (siehe `bereich.ts`). `ordner_listen` hatte nur `limit`/`cursor` — das
 * begrenzt die ZAHL der Eintraege, nicht die GROESSE der Antwort. Bei tiefen
 * Laeufen ist die Groesse die bindende Grenze, denn ein Eintrag mit langem
 * Pfad ist ein Vielfaches eines kurzen.
 *
 * Zwei Antworten darauf, beide hier:
 *
 * 1. **`begrenzeSeite`** — ein Byte-Budget ueber der Seite. Gekuerzt wird am
 *    Ende, nie in der Mitte, und die Kuerzung wird GEMELDET (dieselbe Regel
 *    wie bei `abgeschnitten`: eine gekappte Liste, die vollstaendig aussieht,
 *    ist schlimmer als eine, die zu gross ist).
 * 2. **`fasseZusammen`** — je direktem Unterordner nur Anzahl, Gesamtgroesse
 *    und juengstes Datum. Fuer die Frage „wo liegt ueberhaupt Arbeit?" ist die
 *    Namensliste Ballast, und genau diese Frage steht am Anfang jedes
 *    Durchgangs.
 *
 * Reine Funktionen, kein Storage — deshalb hier und nicht im Werkzeug.
 *
 * @module mcp/storage
 */

import type { Eintrag } from './listen'

/**
 * Vorgabe fuer `maxBytes` bei Listings.
 *
 * Bewusst kleiner als die 256 kB von `datei_lesen`: Der gemessene Ausfall lag
 * bei 78.634 Zeichen, eine Vorgabe darueber haette ihn nicht verhindert.
 */
export const MAX_BYTES_LISTE_VORGABE = 64 * 1024

/** Ein Eintrag als JSON — dieselbe Form, in der er die Antwort belastet. */
function byteGroesse(eintrag: Eintrag): number {
  return Buffer.byteLength(JSON.stringify(eintrag), 'utf8')
}

export interface BegrenzteSeite {
  seite: Eintrag[]
  /** Gesetzt, wenn das Byte-Budget vor dem Ende der Seite griff. */
  gekuerzt?: string
}

/**
 * Kuerzt eine Seite auf `maxBytes`.
 *
 * Der erste Eintrag geht IMMER mit, auch wenn er allein das Budget reisst:
 * Sonst antwortet das Werkzeug mit einer leeren Liste und einem Cursor, der
 * ewig auf derselben Stelle stehen bleibt — eine Endlosschleife, die wie ein
 * leerer Ordner aussieht.
 */
export function begrenzeSeite(eintraege: Eintrag[], maxBytes: number): BegrenzteSeite {
  const seite: Eintrag[] = []
  let verbraucht = 0

  for (const eintrag of eintraege) {
    const kosten = byteGroesse(eintrag)
    if (seite.length > 0 && verbraucht + kosten > maxBytes) break
    seite.push(eintrag)
    verbraucht += kosten
  }

  if (seite.length === eintraege.length) return { seite }
  return {
    seite,
    gekuerzt:
      `Nach ${seite.length} von ${eintraege.length} Eintraegen der Seite gekuerzt ` +
      `(maxBytes ${maxBytes}). Mit naechsterCursor weiterblaettern, ` +
      'oder zusammenfassung=true fuer den Ueberblick statt der Namensliste.',
  }
}

/** Ein Zweig unter dem gelisteten Ordner — verdichtet. */
export interface ZusammenfassungZeile {
  /** Pfad des direkten Unterordners; "." = Eintraege direkt im Ordner. */
  pfad: string
  /**
   * Storage-Id des Unterordners; bei "." die des gelisteten Ordners.
   *
   * `null`, wenn der Ordner-Eintrag selbst durch `muster` herausgefiltert
   * wurde — dann gibt es die Id in dieser Antwort schlicht nicht, und sie zu
   * raten waere schlechter, als sie fehlen zu lassen.
   */
  id: string | null
  dateien: number
  ordner: number
  gesamtGroesse: number
  /** ISO-Zeitstempel der juengsten Aenderung in diesem Zweig; null = leer. */
  juengsteAenderung: string | null
}

/**
 * Das erste Pfadsegment eines Eintrags UNTERHALB des gelisteten Ordners.
 *
 * `null` = der Eintrag liegt direkt im gelisteten Ordner. Ein direkter
 * Unterordner faellt selbst in diesen Fall — er ist Kind des gelisteten
 * Ordners, nicht Kind seiner selbst.
 */
function direkterZweig(wurzelPfad: string, eintragPfad: string): string | null {
  const rest = wurzelPfad === '' ? eintragPfad : eintragPfad.slice(wurzelPfad.length + 1)
  const schnitt = rest.indexOf('/')
  return schnitt === -1 ? null : rest.slice(0, schnitt)
}

/** Zweig-Name eines Eintrags, der SELBST ein direkter Unterordner ist. */
function alsDirekterUnterordner(wurzelPfad: string, eintrag: Eintrag): string | null {
  if (eintrag.typ !== 'ordner') return null
  const rest = wurzelPfad === '' ? eintrag.pfad : eintrag.pfad.slice(wurzelPfad.length + 1)
  return rest.includes('/') ? null : rest
}

function zweigPfad(wurzelPfad: string, zweig: string): string {
  return wurzelPfad === '' ? zweig : `${wurzelPfad}/${zweig}`
}

/**
 * Verdichtet die gesammelten Eintraege je direktem Unterordner.
 *
 * Aggregiert wird ueber den GANZEN durchlaufenen Zweig, nicht nur ueber seine
 * erste Ebene: Bei `tiefe: 2` zaehlt eine Datei zwei Ebenen tiefer zu dem
 * Unterordner, unter dem sie liegt. Sonst waere die Zahl kleiner als die
 * Wahrheit — und eine zu kleine Zahl liest sich wie „hier ist nichts zu tun".
 *
 * Der Unterordner selbst zaehlt in den Bucket "." (er liegt direkt im
 * gelisteten Ordner) und eroeffnet zugleich seine eigene Zeile — auch dann,
 * wenn der Abstieg ihn nicht mehr erreicht hat. Eine Zeile mit lauter Nullen
 * heisst dann „nicht hineingeschaut", nicht „leer"; welcher der beiden Faelle
 * vorliegt, sagt `abgeschnitten` bzw. die gewaehlte `tiefe`.
 */
export function fasseZusammen(
  alle: readonly Eintrag[],
  wurzelPfad: string,
  wurzelId: string,
): ZusammenfassungZeile[] {
  const zeilen = new Map<string, ZusammenfassungZeile>()

  const hole = (schluessel: string, pfad: string, id: string | null): ZusammenfassungZeile => {
    const vorhanden = zeilen.get(schluessel)
    if (vorhanden) {
      if (vorhanden.id === null && id !== null) vorhanden.id = id
      return vorhanden
    }
    const neu: ZusammenfassungZeile = {
      pfad, id, dateien: 0, ordner: 0, gesamtGroesse: 0, juengsteAenderung: null,
    }
    zeilen.set(schluessel, neu)
    return neu
  }

  for (const eintrag of alle) {
    // Ein direkter Unterordner bekommt seine eigene Zeile (mit Id) — auch
    // wenn unter ihm nichts gesammelt wurde.
    const eigenerZweig = alsDirekterUnterordner(wurzelPfad, eintrag)
    if (eigenerZweig !== null) hole(eigenerZweig, eintrag.pfad, eintrag.id)

    const zweig = direkterZweig(wurzelPfad, eintrag.pfad)
    const zeile = zweig === null
      ? hole('.', '.', wurzelId)
      : hole(zweig, zweigPfad(wurzelPfad, zweig), null)

    if (eintrag.typ === 'ordner') zeile.ordner += 1
    else {
      zeile.dateien += 1
      zeile.gesamtGroesse += eintrag.groesse
    }
    if (zeile.juengsteAenderung === null || eintrag.geaendertAm > zeile.juengsteAenderung) {
      zeile.juengsteAenderung = eintrag.geaendertAm
    }
  }

  return [...zeilen.values()].sort((a, b) => a.pfad.localeCompare(b.pfad))
}
