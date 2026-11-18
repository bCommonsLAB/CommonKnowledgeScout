/**
 * Der Einstieg von `KnowledgeScoutExplorer` (Plan `startseite-als-embed`, WE0):
 * Womit die Komponente startet — ein offenes Dokument, Listen-Einstellungen,
 * eine Frage im Story-Modus.
 *
 * Dokument und Liste sind Adress-Parameter der Galerie (`doc`, `page`,
 * `starred`, `sort`); sie gehen als Anfangszustand an die Adressierung im
 * Speicher. Die Frage gehoert dem Story-Modus: Sie wird die Auswahl im
 * Speicher der Komponente (`knowledge-scout-explorer.tsx`), ihre Sitzung loest
 * `embed-story-einstieg.ts` auf.
 *
 * Passt der Einstieg nicht zur Ansicht, ist das ein Fehler im Rahmen — kein
 * stilles Weglassen (no-silent-fallbacks.md).
 */

import type { KsEinstieg, KsGalerieListe } from './typen'
import { SORTIERUNGEN } from './ziel-parameter'

type Ansicht = 'gallery' | 'story'

export type EinstiegsAufbau = { initialParams: string | undefined; frage: string | undefined } | { fehler: string }

const EINSTIEG_FELDER: readonly string[] = ['dokument', 'seitenzahl', 'frage', 'liste']
const LISTE_FELDER: readonly string[] = ['nurMitStern', 'sortierung']

function fremdesFeld(objekt: object, erlaubt: readonly string[]): string | undefined {
  return Object.keys(objekt).find((feld) => !erlaubt.includes(feld))
}

/** Traegt die Liste in die Parameter ein; liefert eine Fehlermeldung oder `null`. */
function listeEintragen(liste: KsGalerieListe, view: Ansicht, params: URLSearchParams): string | null {
  if (typeof liste !== 'object' || liste === null) return 'start.liste muss ein Objekt sein.'
  const fremd = fremdesFeld(liste, LISTE_FELDER)
  if (fremd) return `start.liste.${fremd} gibt es nicht — erlaubt: ${LISTE_FELDER.join(', ')}.`
  if (view !== 'gallery') return 'start.liste gehoert zur Galerie — view="gallery" nehmen.'
  if (liste.nurMitStern !== undefined && typeof liste.nurMitStern !== 'boolean') return 'start.liste.nurMitStern muss true oder false sein.'
  if (liste.nurMitStern === true) params.set('starred', '1')
  if (liste.sortierung !== undefined) {
    if (!(SORTIERUNGEN as readonly string[]).includes(liste.sortierung)) {
      return `start.liste.sortierung "${String(liste.sortierung)}" gibt es nicht — erlaubt: ${SORTIERUNGEN.join(', ')}.`
    }
    params.set('sort', liste.sortierung)
  }
  return null
}

/** Der Anfangszustand der Adressierung und die Frage — oder was nicht stimmt. */
export function einstiegAufbauen(start: KsEinstieg | undefined, view: Ansicht): EinstiegsAufbau {
  const params = new URLSearchParams(view === 'story' ? 'mode=story' : '')
  const fertig = (frage?: string): EinstiegsAufbau => ({ initialParams: params.toString() || undefined, frage })
  if (start === undefined) return fertig()
  if (typeof start !== 'object' || start === null) return { fehler: 'start muss ein Objekt sein.' }
  const fremd = fremdesFeld(start, EINSTIEG_FELDER)
  if (fremd) return { fehler: `start.${fremd} gibt es nicht — erlaubt: ${EINSTIEG_FELDER.join(', ')}.` }

  const { dokument, seitenzahl, frage, liste } = start
  if (dokument !== undefined) {
    if (typeof dokument !== 'string' || dokument.trim() === '') return { fehler: 'start.dokument muss der Slug eines Dokuments sein.' }
    if (view !== 'gallery') return { fehler: 'start.dokument gehoert zur Galerie — view="gallery" nehmen.' }
    params.set('doc', dokument.trim())
  }
  if (seitenzahl !== undefined) {
    if (dokument === undefined) return { fehler: 'start.seitenzahl braucht start.dokument.' }
    if (!Number.isInteger(seitenzahl) || seitenzahl < 1) return { fehler: `start.seitenzahl "${String(seitenzahl)}" ist keine Seite (ab 1).` }
    params.set('page', String(seitenzahl))
  }
  if (liste !== undefined) {
    const fehler = listeEintragen(liste, view, params)
    if (fehler) return { fehler }
  }
  if (frage !== undefined) {
    if (typeof frage !== 'string' || frage.trim() === '') return { fehler: 'start.frage muss die Kennung einer gespeicherten Frage sein.' }
    if (view !== 'story') return { fehler: 'start.frage zeigt eine Frage im Story-Modus — view="story" nehmen.' }
    return fertig(frage.trim())
  }
  return fertig()
}
