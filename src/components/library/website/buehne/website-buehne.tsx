'use client'

/**
 * Die Common-UX-Buehne der Fragen-Sektion (Plan `commonux-buehne-fragen-sektion`, P4 und K4).
 *
 * Diese Datei ist der einzige Ort, der den Player laedt (`@commonux/player`, Buendel unter
 * `vendor/`). `use-website-buehne.ts` holt sie erst, wenn die Buehne an ist — sonst zahlt die
 * Seite nichts dafuer.
 *
 * Hinten ist die Ebene am Bildschirm fest (`position: fixed`), blass und ohne Schrift; der Bereich
 * des Chats ist ihr Fenster (`clip-path` im Rahmen). So scrollt der Text ueber einer ruhenden
 * Buehne, und der Player rechnet die Bildschirmkoordinaten der Zitatmarken selbst in seine Welt
 * um. Vorn fuellt sie ihren Raum in der Karte, in voller Farbe und bedienbar. Es bleibt derselbe
 * Player: Beim Wechsel gleiten die Darsteller, statt neu zu entstehen.
 */

import '@commonux/player/styles.css'
import { useCallback, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { CommonUxPlayer, farbeFuerDokument, gespraechDarstellerId, type DarstellerAnker, type DarstellerKlick, type Gespraech } from '@commonux/player'
import type { WebsiteBelegAnker, WebsiteBuehneEbene, WebsiteStoryBuehne } from '@ks/module-website/react'
import { ankerFuerPlayer } from './buehne-anker'
import { GESPRAECH_AUFFUEHRUNG } from './gespraech-auffuehrung'

const KEINE: readonly WebsiteBelegAnker[] = []
const HINTEN: CSSProperties = { position: 'fixed', inset: 0 }
const VORN: CSSProperties = { position: 'absolute', inset: 0 }

function WebsiteBuehneEbeneAnsicht({ gespraech, anker, vorn, onFrage, onBeleg }: WebsiteBuehneEbene) {
  // Nur diese Ebene rendert, wenn die Marken beim Scrollen wandern; die uebrigen Props bleiben gleich.
  const marken = useSyncExternalStore(anker.abonniere, anker.stand, () => KEINE)
  const fuerPlayer = useMemo<DarstellerAnker[]>(() => ankerFuerPlayer(marken), [marken])
  // Vorn: Ein Klick auf das Blatt zeigt mehr Text und wieder weniger.
  const [gross, setGross] = useState(false)
  const frageId = gespraech?.frage.id
  const fuerBuehne = useMemo<Gespraech | undefined>(
    () => (gespraech ? { ...gespraech, blatt: vorn && gross ? 'gross' : 'klein' } : undefined),
    [gespraech, vorn, gross],
  )

  const beiKlick = useCallback(
    (klick: DarstellerKlick) => {
      if (!gespraech) return
      const folge = gespraech.folgefragen.find((f) => gespraechDarstellerId('folgefrage', f.id) === klick.darstellerId)
      if (folge) {
        setGross(false)
        onFrage(folge.text)
        return
      }
      const beleg = gespraech.belege.find((b) => gespraechDarstellerId('beleg', b.id) === klick.darstellerId)
      if (beleg) {
        onBeleg(beleg.id)
        return
      }
      if (frageId !== undefined && klick.darstellerId === gespraechDarstellerId('blatt', frageId)) setGross((g) => !g)
    },
    [gespraech, frageId, onFrage, onBeleg],
  )

  return (
    <div style={vorn ? VORN : HINTEN} data-website-buehne={vorn ? 'vorn' : 'hinten'}>
      <CommonUxPlayer
        szene={GESPRAECH_AUFFUEHRUNG}
        gespraech={fuerBuehne}
        anker={vorn ? undefined : fuerPlayer}
        stufe={vorn ? 'voll' : 'blass'}
        durchlass={!vorn}
        durchsichtig
        einpassen={vorn ? 'contain' : 'cover'}
        bewegung="system"
        onDarstellerKlick={vorn ? beiKlick : undefined}
      />
    </div>
  )
}

export const WEBSITE_BUEHNE: NonNullable<WebsiteStoryBuehne['darstellung']> = {
  ebene: (p) => <WebsiteBuehneEbeneAnsicht {...p} />,
  // Dieselbe Rechnung wie im Player: Kreis und Marke haben dieselbe Farbe.
  farbeFuerBeleg: (belegId) => farbeFuerDokument(belegId),
}
