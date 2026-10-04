'use client'

/**
 * Inhalt der Detailansicht (D6b aus `detail-overlay.tsx` gezogen): die
 * Ansicht zum Typ, darunter das generische SDG-Profil und die Kommentare.
 */

import type { ReactNode } from 'react'
import type { DetailViewType } from '@ks/contracts'
import { extractSdgValues, extractSdgBegruendung, hasSdgData } from '@ks/util'
import { SdgProfile } from '../sdg-profile'
import type { DetailRenderer, DetailRenderProps } from './types'

interface DetailAnsichtProps extends DetailRenderProps {
  viewType: DetailViewType
  renderers: Record<DetailViewType, DetailRenderer>
}

/**
 * Waehlt die Ansicht zum Typ. Die Tabelle selbst kommt vom Montagepunkt
 * (`gallery-detail-renderers.tsx` in der App, M4g); hier steht nur noch die
 * Auswahl — und der laute Fall fuer einen Typ, der der Tabelle fehlt.
 */
export function DetailAnsicht({ viewType, renderers, ...renderProps }: DetailAnsichtProps) {
  // Die Typgrenze deckt den Normalfall ab. Sollte ein ungeprueftes
  // detailViewType aus alter Library-Config doch durchkommen, wird das
  // ausdruecklich gemeldet statt still zur Buch-Ansicht zu werden.
  const Renderer = renderers[viewType]
  if (!Renderer) {
    console.error(`[DetailBody] Unbekannter detailViewType "${viewType}" — es wird die Buch-Ansicht gezeigt.`)
  }
  const Ansicht = Renderer ?? renderers.book
  return (
    <div className='p-0 w-full max-w-full overflow-x-hidden'>
      <Ansicht {...renderProps} />
    </div>
  )
}

export interface DetailBodyProps extends DetailAnsichtProps {
  /** Generisches SDG-Profil (Flag `config.chat.gallery.showSdgProfile`). */
  sdgEnabled: boolean
  sdgDocMeta: Record<string, unknown> | null
  /** Kommentar-Sektion; im Bewertungsmodus oben, sonst unten. */
  kommentare: ReactNode
  ratingActive: boolean
}

export function DetailBody({ sdgEnabled, sdgDocMeta, kommentare, ratingActive, ...ansicht }: DetailBodyProps) {
  return (
    <>
      {/* Bewertungsmodus: Kommentare oben, direkt unter der Leiste. */}
      {ratingActive ? kommentare : null}
      <DetailAnsicht {...ansicht} />
      {/* Generisches SDG-Profil (library-uebergreifend, flag-gesteuert):
          nur wenn aktiviert UND die SDG-Felder vorhanden sind. Fuer
          climateAction NICHT hier — die Klima-Detailansicht rendert das
          SDG-Rad selbst als Accordion-Abschnitt (nach der KI-Einschaetzung). */}
      {sdgEnabled && ansicht.viewType !== 'climateAction' && sdgDocMeta && hasSdgData(sdgDocMeta) ? (
        <div className='px-6 pb-6'>
          <SdgProfile values={extractSdgValues(sdgDocMeta)} begruendung={extractSdgBegruendung(sdgDocMeta)} />
        </div>
      ) : null}
      {/* Normalmodus: Kommentare unten, unter den Infos. */}
      {!ratingActive ? kommentare : null}
    </>
  )
}
