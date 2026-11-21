/**
 * Zitatmarken als Anker fuer die Common-UX-Buehne (Plan `commonux-buehne-fragen-sektion`, P4):
 * die Lage der Marken messen, sie ausserhalb von React halten und die Stilregeln ihrer Farben
 * bauen. Ohne React; die Sektion bindet es in `website-story-buehne.tsx` an.
 */

/** Lage der Zitatmarken eines Belegs in Bildschirmkoordinaten (wie `clientX`/`clientY`). */
export interface WebsiteBelegAnker {
  belegId: string
  /** `key` bleibt je Marke ueber das Scrollen gleich. */
  marken: { key: string; x: number; y: number }[]
}

/** Die Anker ausserhalb von React: Die Ebene der Buehne abonniert sie (`useSyncExternalStore`). */
export interface WebsiteAnkerQuelle {
  stand: () => readonly WebsiteBelegAnker[]
  abonniere: (horcher: () => void) => () => void
}

const KEINE_ANKER: readonly WebsiteBelegAnker[] = []

export interface AnkerSpeicher extends WebsiteAnkerQuelle {
  setze: (anker: readonly WebsiteBelegAnker[]) => void
}

/** Speicher der Anker; meldet nur, wenn sich eine Lage geaendert hat. */
export function erzeugeAnkerQuelle(): AnkerSpeicher {
  let anker = KEINE_ANKER
  let schluessel = '[]'
  const horcher = new Set<() => void>()
  return {
    stand: () => anker,
    abonniere: (h) => {
      horcher.add(h)
      return () => { horcher.delete(h) }
    },
    setze: (neu) => {
      const s = JSON.stringify(neu)
      if (s === schluessel) return
      schluessel = s
      anker = neu.length === 0 ? KEINE_ANKER : neu
      horcher.forEach((h) => h())
    },
  }
}

/**
 * Misst die Zitatmarken im Behaelter. Die Marke traegt die Dokumentnummer
 * (`data-beleg`), `belegJeNummer` nennt den Beleg dazu. Verborgene Marken
 * (`display: none`, „Quellen anzeigen" noch nicht gewaehlt) haben keine Lage;
 * ihr Beleg bleibt dann an seinem Ruhe-Ort.
 */
export function messeMarken(behaelter: Element, belegJeNummer: Readonly<Record<number, string>>): WebsiteBelegAnker[] {
  const jeBeleg = new Map<string, WebsiteBelegAnker['marken']>()
  const stelle = new Map<number, number>()
  behaelter.querySelectorAll('a[data-beleg]').forEach((marke) => {
    const nummer = Number(marke.getAttribute('data-beleg'))
    const belegId = belegJeNummer[nummer]
    // Eine Marke ohne Beleg (das Sprachmodell zitiert eine Nummer, die es nicht gibt) hat keinen Kreis.
    if (belegId === undefined) return
    const n = stelle.get(nummer) ?? 0
    stelle.set(nummer, n + 1)
    const r = marke.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return
    const marken = jeBeleg.get(belegId) ?? []
    marken.push({ key: `${nummer}-${n}`, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) })
    jeBeleg.set(belegId, marken)
  })
  return Array.from(jeBeleg, ([belegId, marken]) => ({ belegId, marken }))
}

const FARBE = /^#[0-9a-fA-F]{6}$/
/** Schrift auf der gefaerbten Marke. */
const MARKEN_SCHRIFT = '#16161d'
/**
 * Die Marke ist im Ton ihres Belegs gefuellt, so blass wie sein Kreis dahinter (Stufe „blass" des
 * Players: Deckkraft 0,3), mit Rand in voller Farbe. Voll gefuellt waere die Schrift auf blauen
 * und violetten Belegen nicht lesbar (gemessen: 3,3 : 1).
 */
const MARKEN_TON_PROZENT = 30

/** Stilregeln, die jede Zitatmarke im Bereich `scope` in der Farbe ihres Belegs zeigen. */
export function markenFarbenCss(scope: string, belegJeNummer: Readonly<Record<number, string>>, farbeFuerBeleg: (belegId: string) => string): string {
  return Object.entries(belegJeNummer)
    .map(([nummer, belegId]) => {
      const farbe = farbeFuerBeleg(belegId)
      if (!FARBE.test(farbe)) throw new Error(`Buehne: Farbe des Belegs ${belegId} ist kein #RRGGBB: "${farbe}"`)
      return `[data-story-buehne="${scope}"] a[data-beleg="${nummer}"]{background-color:color-mix(in srgb,${farbe} ${MARKEN_TON_PROZENT}%,white)!important;border-color:${farbe}!important;color:${MARKEN_SCHRIFT}!important}`
    })
    .join('\n')
}
