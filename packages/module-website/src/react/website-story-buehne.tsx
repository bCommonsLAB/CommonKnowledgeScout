'use client'

/**
 * Die Fragen-Sektion ueber der Common-UX-Buehne (Plan
 * `commonux-buehne-fragen-sektion`, Welle P4).
 *
 * Die Buehne liegt neben der Sektion: Der Gastgeber reicht sie als Slot
 * (`WebsiteStoryGastgeber.buehne`), dieses Paket kennt den Player nicht. Die
 * Sektion tut dreierlei:
 *  - sie uebersetzt ihren Stand in das Gespraech (`gespraechAusStory`),
 *  - sie misst die Lage der Zitatmarken (`a[data-beleg]`) und haelt sie in
 *    einer Quelle ausserhalb von React — beim Scrollen rendert nur die Ebene
 *    der Buehne neu, nicht die Sektion,
 *  - sie faerbt jede Marke in der Farbe ihres Belegs.
 *
 * Ohne `buehne` am Gastgeber geschieht nichts davon (Embed, Vorschau, Schalter aus).
 */

import * as React from 'react'
import { gespraechAusStory, type GespraechEingabe, type WebsiteGespraech } from '..'

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

export interface WebsiteStoryBuehne {
  /** Die Buehne hinter dem Inhalt der Karte. Die Sektion schneidet sie auf die Karte zu; Klicks erreichen sie nicht. */
  ebene: (p: { gespraech: WebsiteGespraech | null; anker: WebsiteAnkerQuelle }) => React.ReactNode
  /** Farbe des Belegs (`#RRGGBB`), dieselbe wie sein Kreis auf der Buehne. */
  farbeFuerBeleg: (belegId: string) => string
}

const KEINE_ANKER: readonly WebsiteBelegAnker[] = []

interface AnkerSpeicher extends WebsiteAnkerQuelle {
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

/** Haelt die Quelle aktuell: misst nach jeder Aenderung, die eine Marke verschieben kann, hoechstens einmal je Bild. */
function useMarkenAnker(quelle: AnkerSpeicher, behaelter: React.RefObject<HTMLDivElement | null>, belegJeNummer: Readonly<Record<number, string>>, aktiv: boolean): void {
  React.useEffect(() => {
    const el = behaelter.current
    if (!aktiv || !el) {
      quelle.setze([])
      return
    }
    let bild = 0
    const messen = () => quelle.setze(messeMarken(el, belegJeNummer))
    const beiBewegung = () => {
      cancelAnimationFrame(bild)
      bild = requestAnimationFrame(messen)
    }
    beiBewegung()
    // `capture`: Im Site-Modus der App scrollt ein innerer Behaelter, nicht das Fenster.
    window.addEventListener('scroll', beiBewegung, { capture: true, passive: true })
    window.addEventListener('resize', beiBewegung)
    const groesse = new ResizeObserver(beiBewegung)
    groesse.observe(el)
    // Marken erscheinen mit „Quellen anzeigen" (Attribut) und mit einer neuen Antwort (Kinder).
    const wandel = new MutationObserver(beiBewegung)
    wandel.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-marken-verborgen'] })
    return () => {
      cancelAnimationFrame(bild)
      window.removeEventListener('scroll', beiBewegung, { capture: true })
      window.removeEventListener('resize', beiBewegung)
      groesse.disconnect()
      wandel.disconnect()
      quelle.setze([])
    }
  }, [quelle, behaelter, belegJeNummer, aktiv])
}

export interface StoryBuehneStand {
  /** Die Ebene fuer den Rahmen der Sektion (`hintergrund`); ohne Buehne `undefined`. */
  hintergrund: React.ReactNode
  /** Umschliesst den Inhalt der Sektion: Messbereich der Marken und Geltungsbereich ihrer Farben. */
  umschliesse: (inhalt: React.ReactNode) => React.ReactNode
}

/** Flaechen der Antwort, die ueber der Buehne durchsichtig werden; Text und Eingabe bleiben, wie sie sind. */
const DURCHSICHTIG = '[&_[data-antwort]>div]:!bg-transparent'

/** Alles, was die Sektion fuer die Buehne tut; ohne `buehne` reicht der Hook den Inhalt unveraendert durch. */
export function useStoryBuehne(buehne: WebsiteStoryBuehne | undefined, eingabe: Omit<GespraechEingabe, 'lesen'>): StoryBuehneStand {
  const scope = React.useId()
  const behaelter = React.useRef<HTMLDivElement | null>(null)
  const quelle = React.useMemo(() => erzeugeAnkerQuelle(), [])
  const { paare, laeuft, schritte, fehler } = eingabe
  const ergebnis = React.useMemo(
    // In dieser Welle steht die Seite immer vorn; den Buehnen-Modus bringt K4.
    () => (buehne ? gespraechAusStory({ paare, laeuft, schritte, fehler, lesen: true }) : null),
    [buehne, paare, laeuft, schritte, fehler],
  )
  const belegJeNummer = ergebnis?.belegJeNummer
  React.useEffect(() => {
    if (ergebnis && ergebnis.verworfen > 0) console.error(`[StoryBuehne] ${ergebnis.verworfen} Beleg(e) ohne fileId oder Nummer — sie fehlen auf der Buehne`)
  }, [ergebnis])
  useMarkenAnker(quelle, behaelter, belegJeNummer ?? {}, belegJeNummer !== undefined && ergebnis?.gespraech?.stand === 'fertig')

  const farbeFuerBeleg = buehne?.farbeFuerBeleg
  const stil = React.useMemo(
    () => (belegJeNummer && farbeFuerBeleg ? markenFarbenCss(scope, belegJeNummer, farbeFuerBeleg) : ''),
    [scope, belegJeNummer, farbeFuerBeleg],
  )
  const gespraech = ergebnis?.gespraech ?? null
  const hintergrund = React.useMemo(() => buehne?.ebene({ gespraech, anker: quelle }), [buehne, gespraech, quelle])

  const umschliesse = React.useCallback(
    (inhalt: React.ReactNode) =>
      buehne ? (
        <div ref={behaelter} data-story-buehne={scope} className={DURCHSICHTIG}>
          {stil !== '' && <style>{stil}</style>}
          {inhalt}
        </div>
      ) : inhalt,
    [buehne, scope, stil],
  )
  return { hintergrund, umschliesse }
}
