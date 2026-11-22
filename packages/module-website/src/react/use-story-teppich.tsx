'use client'

/**
 * Der Teppich der Dokumente an der Fragen-Sektion (Plan `teppich-der-dokumente`, T2/T3).
 *
 * T2: Ebene hinter der Sektion; Klick auf eine freie Stelle blendet den Vordergrund aus.
 * T3: Beim Fragen weicht der Vordergrund bis auf die Frage, die Punkte schwaermen; mit der
 * Antwort fliegen die Belege neben ihre Karten (`cards=column`), dann kommt der Vordergrund
 * zurueck. Liefert, was der Rahmen der Sektion braucht; ohne Teppich am Gastgeber nichts.
 */

import * as React from 'react'
import type { DocCardMeta } from '@ks/contracts'
import { belegReihenfolge, kandidatenAusSchritten } from '..'
import type { WebsiteStoryGastgeber } from './website-story-gastgeber'
import type { WebsiteStoryStand } from './use-website-story'
import type { WebsiteStorySektionRahmenProps } from './website-story-sektion-rahmen'
import { WebsiteTeppichEbene } from './website-teppich-ebene'
import { TeppichSzene } from './teppich-szene'
import { useTeppichAblauf } from './use-teppich-ablauf'

type TeppichRahmen = Pick<WebsiteStorySektionRahmenProps, 'teppich' | 'abgetaucht' | 'hinweis' | 'frage'>

export function useStoryTeppich(
  gastgeber: WebsiteStoryGastgeber,
  libraryId: string,
  s: WebsiteStoryStand,
  onDokument: (doc: DocCardMeta) => void,
): { rahmen: TeppichRahmen } {
  const an = gastgeber.teppich === true
  const [abgetaucht, setAbgetaucht] = React.useState(false)
  const paar = s.sichtbar.paar
  const belege = React.useMemo(() => belegReihenfolge(paar?.antwort?.belege ?? []), [paar])
  // T4: die Auswahl der Suche, sobald der Server sie meldet (retrieval_complete).
  const kandidaten = React.useMemo(() => kandidatenAusSchritten(s.k.schritte), [s.k.schritte])
  const ablauf = useTeppichAblauf(an, { laeuft: s.k.laeuft, fehler: s.k.fehler !== null, hatAntwort: belege.length > 0 })
  const fragt = ablauf.phase === 'sucht' || ablauf.phase === 'landet'
  const szene = React.useMemo(() => new TeppichSzene(), [])
  if (!an) return { rahmen: {} }
  return {
    rahmen: {
      teppich: (
        <WebsiteTeppichEbene
          instanz={gastgeber.instanz} libraryId={libraryId} abgetaucht={abgetaucht} onAbgetaucht={setAbgetaucht}
          onDokument={onDokument} phase={ablauf.phase} belege={belege} kandidaten={kandidaten} onGelandet={ablauf.gelandet} szene={szene}
        />
      ),
      abgetaucht: abgetaucht || fragt,
      hinweis: abgetaucht && !fragt,
      frage: fragt ? paar?.frage.text : undefined,
    },
  }
}
