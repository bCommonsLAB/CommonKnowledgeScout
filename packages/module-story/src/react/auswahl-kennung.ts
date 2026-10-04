/**
 * Kennung der Auswahl (D2).
 *
 * Die Auswahl lebt in der Adresse (`q=<queryId>`), damit Zurueck-Knopf und
 * Teilen eines Links funktionieren. Das Paket kennt keine Adresszeile
 * (`paket-schnitt.test.ts`): Es sagt nur, WELCHE Kennung eine Auswahl hat
 * und WAS eine von aussen kommende Kennung an der Auswahl aendert. WIE das
 * in die Adresse kommt, entscheidet, wer das Paket montiert — in der
 * Voll-App `StoryAuswahlUrl` (nuqs), wie `NextGalleryNavigation` fuer die
 * Galerie.
 */

import { STORY_UEBERSICHT, type StoryAuswahl } from './types'

/** Kennung fuer die Adresse: nur eine gespeicherte Konversation hat eine. */
export function auswahlZuKennung(auswahl: StoryAuswahl): string | null {
  return auswahl.art === 'konversation' && auswahl.queryId !== undefined ? auswahl.queryId : null
}

/**
 * Was eine von aussen kommende Kennung (Neu laden, Zurueck-Knopf, geteilter
 * Link) an der Auswahl aendert — `null`, wenn nichts zu tun ist.
 *
 * Fehlt die Kennung, gilt die Themenuebersicht (Plan, Klickmodell). Ein
 * gewaehltes Thema und eine noch laufende Frage (ohne gespeicherte Kennung)
 * haben keine Kennung in der Adresse und bleiben deshalb unberuehrt.
 */
export function auswahlAusKennung(kennung: string | null, aktuell: StoryAuswahl): StoryAuswahl | null {
  if (kennung !== null) {
    if (aktuell.art === 'konversation' && aktuell.queryId === kennung) return null
    return { art: 'konversation', queryId: kennung }
  }
  if (aktuell.art === 'konversation' && aktuell.queryId !== undefined) return STORY_UEBERSICHT
  return null
}

/**
 * Dieselbe laufende Frage hat ihre gespeicherte Kennung bekommen: Die Adresse
 * wird ersetzt, nicht als neuer Verlaufseintrag geschrieben — sonst fuehrte
 * „Zurueck" auf den Zwischenstand „laeuft".
 */
export function istNachtrag(vorher: StoryAuswahl, nachher: StoryAuswahl): boolean {
  return (
    vorher.art === 'konversation' &&
    nachher.art === 'konversation' &&
    vorher.queryId === undefined &&
    nachher.queryId !== undefined &&
    vorher.frageId !== undefined &&
    vorher.frageId === nachher.frageId
  )
}
