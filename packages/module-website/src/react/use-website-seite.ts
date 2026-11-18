'use client'

/**
 * Welche Website-Seite gilt (aus `website-landing.tsx` herausgeloest, WE4).
 *
 * `seite` ist die Kennung wie `?site=` (Slug oder fileId); ohne Kennung gilt
 * die Startseite: das Main-Menue-Doc mit kleinstem `menu_order`. Eine
 * Kennung, die zu keinem Doc passt:
 *  - `startseite`: gemeldet, die Startseite erscheint (App, `?site=` aus der Adresse),
 *  - `fehler`: Fehler im Rahmen, kein Rueckfall (Startseiten-Embed, Plan 3.1 —
 *    die Container-Anwendung hat die Kennung selbst gesetzt).
 */

import * as React from 'react'
import type { DocCardMeta } from '@ks/contracts'
import { resolveSiteParamDoc, selectMainMenuDocs } from '..'

export type UnbekannteSeite = 'startseite' | 'fehler'

export interface WebsiteSeiteStand {
  /** fileId der gewaehlten Seite; `null`, solange die Liste fehlt. */
  fileId: string | null
  /** Klartext, wenn die Kennung bei `fehler` zu keiner Seite passt. */
  fehler: string | null
}

export function useWebsiteSeite(allDocs: DocCardMeta[], seite: string | null, unbekannteSeite: UnbekannteSeite): WebsiteSeiteStand {
  const [stand, setStand] = React.useState<WebsiteSeiteStand>({ fileId: null, fehler: null })
  const mainMenuDocs = React.useMemo(() => selectMainMenuDocs(allDocs), [allDocs])

  React.useEffect(() => {
    if (allDocs.length === 0) return
    if (seite) {
      const resolved = resolveSiteParamDoc(allDocs, seite)
      if (resolved?.fileId) {
        setStand({ fileId: resolved.fileId, fehler: null })
        return
      }
      if (unbekannteSeite === 'fehler') {
        console.error(`[website] Seite "${seite}" passt zu keinem website-Doc`)
        setStand({ fileId: null, fehler: `Die Seite "${seite}" gibt es in dieser Library nicht.` })
        return
      }
      console.warn(`[website] Seite "${seite}" passt zu keinem website-Doc — zeige Startseite`)
    }
    setStand({ fileId: mainMenuDocs[0]?.fileId ?? allDocs[0]?.fileId ?? null, fehler: null })
  }, [allDocs, mainMenuDocs, seite, unbekannteSeite])

  return stand
}
