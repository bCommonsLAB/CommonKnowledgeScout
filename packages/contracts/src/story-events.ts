/**
 * DOM-Ereignisse zwischen Story-Mitte und Galerie (D12e).
 *
 * Mitte (`@ks/module-story`) und Quellen (`@ks/module-explorer`) haengen in
 * getrennten Slots und kennen einander nicht. Ein Klick auf eine Zitatmarke
 * ①… soll die Belegkarte zeigen — seit D11b steht die Belegliste aber nur im
 * DOM, wenn die Quellen-Schicht offen ist. Findet die Mitte die Karte nicht,
 * bittet sie den Gastgeber ueber dieses Ereignis, die Quellen zu oeffnen und
 * zur Marke zu scrollen.
 */

export const STORY_BELEG_ZEIGEN_EVENT = 'story-beleg-zeigen'

export interface StoryBelegZeigenDetail {
  /** Nummer der Marke (Belegkarte `#beleg-<marke>`). */
  marke: string
}
