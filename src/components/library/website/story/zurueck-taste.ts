/**
 * Zurueck-Taste fuer Ueberlagerungen der Fragen-Sektion (Telefon-Vollbild, Graph-Ansicht; Owner
 * 24.11.2026). Der App-Teil zu `WebsiteStoryGastgeber.zurueckTaste`: das Paket `@ks/module-website`
 * fasst die Adresszeile nicht an, die App darf es.
 *
 * Je offener Ueberlagerung liegt EIN Schritt in der Chronik (gleiche Adresse, eigene Marke). Geht
 * der Leser zurueck, schliesst die zuletzt geoeffnete — die Seite bleibt, wo sie ist. Schliesst er
 * selbst, nimmt die App ihren Schritt wieder heraus, damit die Zurueck-Taste danach nicht ins Leere
 * geht.
 */

interface Eintrag { onZurueck: () => void }

const stapel: Eintrag[] = []
/** So viele `popstate` stammen von uns selbst (`history.back()` nach dem Schliessen per Knopf). */
let eigene = 0
let lauscht = false

function beiZurueck(): void {
  if (eigene > 0) { eigene--; return }
  const oben = stapel.pop()
  if (oben) oben.onZurueck()
}

/** Meldet eine Ueberlagerung an. Die Rueckgabe meldet sie ab; `schrittZurueck` nimmt den Schritt aus der Chronik. */
export function zurueckTaste(onZurueck: () => void): (schrittZurueck: boolean) => void {
  if (!lauscht) { window.addEventListener('popstate', beiZurueck); lauscht = true }
  const eintrag: Eintrag = { onZurueck }
  stapel.push(eintrag)
  // Gleiche Adresse: Next uebernimmt seinen eigenen Zustand in den neuen Schritt.
  window.history.pushState({ ksUeberlagerung: stapel.length }, '')
  return (schrittZurueck) => {
    const i = stapel.indexOf(eintrag)
    // Schon durch die Zurueck-Taste geschlossen: der Schritt ist bereits weg.
    if (i < 0) return
    stapel.splice(i, 1)
    if (!schrittZurueck) return
    eigene++
    window.history.back()
  }
}
