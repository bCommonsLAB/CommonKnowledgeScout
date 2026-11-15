'use client'

/**
 * @fileoverview URL-Zustand des Reiters „Sitzungen" — gebuendelt (Register, Welle R3).
 *
 * @description
 * Sicht, Gruppierung, Sortierung, Suche, Werkzeug-Chips, Zeitraum und die
 * gewaehlte Zeile wohnen in der URL (`nuqs`), wie in der Werkbank: teilbar
 * und reload-fest. Eigene Schluessel mit `s`-Vorsilbe, weil Werkbank und
 * Reiter dieselbe Adresse teilen (`q`, `sort`, `vorhaben` gehoeren der
 * Werkbank).
 *
 * Gruppierung je Sicht: „Offen"/„Alle" kennen Bereich und Werkzeug,
 * „Auffällig" Hinweis und Bereich (Figma-Konzept). Steht in der Adresse eine
 * Gruppierung, die die Sicht nicht kennt, gilt die erste der Sicht — benannt
 * in {@link GRUPPIERUNGEN_JE_SICHT}, und beim Sichtwechsel wird sie geleert.
 *
 * @module hooks/agent-view
 */

import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs'
import { REITER_GRUPPIERUNGEN, type ReiterGruppierung } from '@/lib/agent-view/sitzungen-register/reiter-gruppen'
import {
  REITER_SICHTEN, REITER_SORTIERUNGEN, REITER_WERKZEUGE, type ReiterSicht,
} from '@/lib/agent-view/sitzungen-register/reiter-sicht'

export const GRUPPIERUNGEN_JE_SICHT: Readonly<Record<ReiterSicht, readonly ReiterGruppierung[]>> = {
  offen: ['bereich', 'werkzeug'],
  auffaellig: ['hinweis', 'bereich'],
  alle: ['bereich', 'werkzeug'],
}

export function wirksameGruppierung(sicht: ReiterSicht, gewaehlt: ReiterGruppierung | null): ReiterGruppierung {
  const erlaubt = GRUPPIERUNGEN_JE_SICHT[sicht]
  return gewaehlt !== null && erlaubt.includes(gewaehlt) ? gewaehlt : erlaubt[0]
}

export function useSitzungenUrlState() {
  const [sicht, setSichtRoh] = useQueryState('sicht', parseAsStringLiteral(REITER_SICHTEN).withDefault('offen'))
  const [gruppierung, setGruppierung] = useQueryState('sgruppe', parseAsStringLiteral(REITER_GRUPPIERUNGEN))
  const [sortierung, setSortierung] = useQueryState('ssort', parseAsStringLiteral(REITER_SORTIERUNGEN).withDefault('neueste'))
  const [suche, setSuche] = useQueryState('ssuche', parseAsString.withDefault('').withOptions({ throttleMs: 300 }))
  const [werkzeuge, setWerkzeuge] = useQueryState(
    'swerkzeug',
    parseAsArrayOf(parseAsStringLiteral(REITER_WERKZEUGE)).withDefault([]),
  )
  const [von, setVon] = useQueryState('svon', parseAsString)
  const [bis, setBis] = useQueryState('sbis', parseAsString)
  const [auswahl, setAuswahl] = useQueryState('sitzung', parseAsString)

  const setSicht = (neu: ReiterSicht) => {
    void setSichtRoh(neu)
    void setGruppierung(null)
  }

  return {
    sicht, setSicht,
    gruppierung: wirksameGruppierung(sicht, gruppierung), setGruppierung,
    sortierung, setSortierung, suche, setSuche, werkzeuge, setWerkzeuge,
    von, setVon, bis, setBis, auswahl, setAuswahl,
  }
}
