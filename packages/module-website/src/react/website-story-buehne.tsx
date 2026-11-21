'use client'

/**
 * Die Fragen-Sektion und die Common-UX-Buehne (Plan `commonux-buehne-fragen-sektion`, P4 und K4).
 *
 * Die Buehne liegt neben der Sektion: Der Gastgeber reicht sie (`WebsiteStoryGastgeber.buehne`),
 * dieses Paket kennt den Player nicht. Drei Zustaende:
 *  - `aus`: die Sektion wie immer, dazu das Symbol „Zur Buehne" im Kopf der Karte;
 *  - `hinten`: die Buehne blass hinter dem Text — die Sektion meldet ihr Gespraech, misst die
 *    Zitatmarken (`a[data-beleg]`) und faerbt sie im Ton ihres Belegs;
 *  - `vorn`: die Buehne statt des Texts, bedienbar; das Symbol mit den drei Linien fuehrt zurueck.
 *
 * Ohne `buehne` am Gastgeber geschieht nichts davon (Embed, Vorschau).
 */

import * as React from 'react'
import { AlignLeft } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { gespraechAusStory, type GespraechEingabe, type WebsiteGespraech } from '..'
import { erzeugeAnkerQuelle, markenFarbenCss, messeMarken, type AnkerSpeicher, type WebsiteAnkerQuelle } from './website-story-anker'

export type WebsiteBuehneModus = 'aus' | 'hinten' | 'vorn'

export interface WebsiteBuehneEbene {
  gespraech: WebsiteGespraech | null
  anker: WebsiteAnkerQuelle
  /** Die Buehne steht vorn: volle Farbe, Schrift, bedienbar, eingepasst in ihren Raum. */
  vorn: boolean
  /** Vorn: eine Anschlussfrage wurde angeklickt. */
  onFrage: (text: string) => void
  /** Vorn: ein Beleg wurde angeklickt. */
  onBeleg: (belegId: string) => void
}

export interface WebsiteStoryBuehne {
  modus: WebsiteBuehneModus
  /** Das Symbol im Kopf der Karte wurde gewaehlt. */
  onModus: (modus: 'hinten' | 'vorn') => void
  /** Die Buehne selbst; fehlt, solange sie aus ist oder der Gastgeber sie noch laedt. */
  darstellung?: {
    /** Die Ebene im Fenster der Sektion. Hinten schneidet die Sektion sie zu, Klicks erreichen sie nicht. */
    ebene: (p: WebsiteBuehneEbene) => React.ReactNode
    /** Farbe des Belegs (`#RRGGBB`), dieselbe wie sein Kreis auf der Buehne. */
    farbeFuerBeleg: (belegId: string) => string
  }
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
  /** Die Buehne steht vorn und nimmt Klicks an. */
  vorn: boolean
  /** Das Symbol fuer den Kopf der Karte; ohne Buehne am Gastgeber `null`. */
  knopf: React.ReactNode
  /** Umschliesst den Inhalt der Sektion: Messbereich der Marken und Geltungsbereich ihrer Farben; vorn der Raum der Buehne. */
  umschliesse: (inhalt: React.ReactNode) => React.ReactNode
}

/** Flaechen der Antwort, die ueber der Buehne durchsichtig werden; Text und Eingabe bleiben, wie sie sind. */
const DURCHSICHTIG = '[&_[data-antwort]>div]:!bg-transparent'

/** Drei kleine Kreise: das Zeichen der Buehne. */
function KreiseSymbol() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="6" r="3.2" />
      <circle cx="12" cy="4.2" r="2" />
      <circle cx="10.8" cy="11.6" r="2.6" />
    </svg>
  )
}

function BuehnenKnopf({ buehne }: { buehne: WebsiteStoryBuehne }) {
  const { t } = useTranslation()
  const vorn = buehne.modus === 'vorn'
  const name = t(vorn ? 'website.story.zumText' : 'website.story.zurBuehne')
  return (
    <Button variant="outline" size="sm" className="h-9 w-9 p-0" title={name} aria-label={name} onClick={() => buehne.onModus(vorn ? 'hinten' : 'vorn')} data-story-buehne-knopf={vorn ? 'text' : 'buehne'}>
      {vorn ? <AlignLeft className="h-4 w-4" aria-hidden="true" /> : <KreiseSymbol />}
    </Button>
  )
}

/** Alles, was die Sektion fuer die Buehne tut; ohne `buehne` reicht der Hook den Inhalt unveraendert durch. */
export function useStoryBuehne(buehne: WebsiteStoryBuehne | undefined, eingabe: Omit<GespraechEingabe, 'lesen'>, aktionen: Pick<WebsiteBuehneEbene, 'onFrage' | 'onBeleg'>): StoryBuehneStand {
  const scope = React.useId()
  const behaelter = React.useRef<HTMLDivElement | null>(null)
  const quelle = React.useMemo(() => erzeugeAnkerQuelle(), [])
  const darstellung = buehne?.darstellung
  // Vorn erst, wenn die Buehne da ist — bis dahin bleibt der Text stehen.
  const vorn = buehne?.modus === 'vorn' && darstellung !== undefined
  const { paare, laeuft, schritte, fehler } = eingabe
  const ergebnis = React.useMemo(
    () => (darstellung ? gespraechAusStory({ paare, laeuft, schritte, fehler, lesen: !vorn }) : null),
    [darstellung, paare, laeuft, schritte, fehler, vorn],
  )
  const belegJeNummer = ergebnis?.belegJeNummer
  React.useEffect(() => {
    if (ergebnis && ergebnis.verworfen > 0) console.error(`[StoryBuehne] ${ergebnis.verworfen} Beleg(e) ohne fileId oder Nummer — sie fehlen auf der Buehne`)
  }, [ergebnis])
  useMarkenAnker(quelle, behaelter, belegJeNummer ?? {}, !vorn && belegJeNummer !== undefined && ergebnis?.gespraech?.stand === 'fertig')

  const farbeFuerBeleg = darstellung?.farbeFuerBeleg
  const stil = React.useMemo(
    () => (belegJeNummer && farbeFuerBeleg && !vorn ? markenFarbenCss(scope, belegJeNummer, farbeFuerBeleg) : ''),
    [scope, belegJeNummer, farbeFuerBeleg, vorn],
  )
  const gespraech = ergebnis?.gespraech ?? null
  const { onFrage, onBeleg } = aktionen
  const hintergrund = React.useMemo(
    () => darstellung?.ebene({ gespraech, anker: quelle, vorn, onFrage, onBeleg }),
    [darstellung, gespraech, quelle, vorn, onFrage, onBeleg],
  )

  const umschliesse = React.useCallback(
    (inhalt: React.ReactNode) => {
      if (!darstellung) return inhalt
      // Vorn: statt des Texts der Raum, in dem die Buehne spielt.
      if (vorn) return <div style={{ height: '70vh', minHeight: 480 }} data-story-buehne-raum />
      return (
        <div ref={behaelter} data-story-buehne={scope} className={DURCHSICHTIG}>
          {stil !== '' && <style>{stil}</style>}
          {inhalt}
        </div>
      )
    },
    [darstellung, vorn, scope, stil],
  )
  const knopf = React.useMemo(() => (buehne ? <BuehnenKnopf buehne={buehne} /> : null), [buehne])
  return { hintergrund, vorn, knopf, umschliesse }
}
