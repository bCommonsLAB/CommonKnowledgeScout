'use client'

/**
 * Die Common-UX-Buehne hinter der Fragen-Sektion (Plan `commonux-buehne-fragen-sektion`, P4).
 *
 * Diese Datei ist der einzige Ort, der den Player laedt (`@commonux/player`, Buendel unter
 * `vendor/`). `use-website-buehne.ts` holt sie erst, wenn die Buehne an ist — sonst zahlt die
 * Seite nichts dafuer.
 *
 * Die Ebene ist am Bildschirm fest (`position: fixed`); die Karte der Sektion ist ihr Fenster
 * (`clip-path` im Rahmen). So scrollt der Text ueber einer ruhenden Buehne, und der Player rechnet
 * die Bildschirmkoordinaten der Zitatmarken selbst in seine Welt um.
 */

import '@commonux/player/styles.css'
import { useMemo, useSyncExternalStore } from 'react'
import { CommonUxPlayer, farbeFuerDokument, type DarstellerAnker } from '@commonux/player'
import type { WebsiteAnkerQuelle, WebsiteBelegAnker, WebsiteStoryBuehne } from '@ks/module-website/react'
import type { WebsiteGespraech } from '@ks/module-website'
import { ankerFuerPlayer } from './buehne-anker'
import { GESPRAECH_AUFFUEHRUNG } from './gespraech-auffuehrung'

const KEINE: readonly WebsiteBelegAnker[] = []

function WebsiteBuehneEbene({ gespraech, anker }: { gespraech: WebsiteGespraech | null; anker: WebsiteAnkerQuelle }) {
  // Nur diese Ebene rendert, wenn die Marken beim Scrollen wandern; die uebrigen Props bleiben gleich.
  const marken = useSyncExternalStore(anker.abonniere, anker.stand, () => KEINE)
  const fuerPlayer = useMemo<DarstellerAnker[]>(() => ankerFuerPlayer(marken), [marken])
  return (
    <div style={{ position: 'fixed', inset: 0 }} data-website-buehne>
      <CommonUxPlayer
        szene={GESPRAECH_AUFFUEHRUNG}
        gespraech={gespraech ?? undefined}
        anker={fuerPlayer}
        stufe="blass"
        durchlass
        durchsichtig
        einpassen="cover"
        bewegung="system"
      />
    </div>
  )
}

export const WEBSITE_BUEHNE: WebsiteStoryBuehne = {
  ebene: (p) => <WebsiteBuehneEbene gespraech={p.gespraech} anker={p.anker} />,
  // Dieselbe Rechnung wie im Player: Kreis und Marke haben dieselbe Farbe.
  farbeFuerBeleg: (belegId) => farbeFuerDokument(belegId),
}
