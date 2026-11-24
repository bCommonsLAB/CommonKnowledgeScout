'use client'

/**
 * Der Teppich der Dokumente an der Fragen-Sektion (Plan `teppich-der-dokumente`, T2/T3).
 *
 * T2: Ebene hinter der Sektion; Klick auf eine freie Stelle blendet den Vordergrund aus.
 * T3: Beim Fragen bleibt der Vordergrund stehen, nur die Antwort ist verborgen; dahinter arbeitet
 * die Wolke, dann blendet die Antwort ein (Owner 23.11.2026: nichts soll springen). Liefert, was der Rahmen der Sektion braucht; ohne Teppich am Gastgeber nichts.
 */

import * as React from 'react'
import type { DocCardMeta } from '@ks/contracts'
import { belegReihenfolge, kandidatenAusSchritten, type TeppichAnimation } from '..'
import type { WebsiteStoryGastgeber } from './website-story-gastgeber'
import type { WebsiteStoryStand } from './use-website-story'
import type { WebsiteStorySektionRahmenProps } from './website-story-sektion-rahmen'
import { WebsiteTeppichEbene } from './website-teppich-ebene'
import { TeppichSzene } from './teppich-szene'
import { useTeppichAblauf } from './use-teppich-ablauf'
import { useTeppichBotschaft } from './use-teppich-botschaft'
import { useZurueckTaste } from './use-ueberlagerung'

type TeppichRahmen = Pick<WebsiteStorySektionRahmenProps, 'teppich' | 'abgetaucht' | 'fragt' | 'fest'>

export function useStoryTeppich(
  gastgeber: WebsiteStoryGastgeber,
  libraryId: string,
  s: WebsiteStoryStand,
  onDokument: (doc: DocCardMeta) => void,
  animation: TeppichAnimation,
  /** Duerfen Ueberlagerungen am Bildschirm haengen (`useBildschirmFest`)? */
  fest: boolean,
): { rahmen: TeppichRahmen; graphZeigen?: () => void } {
  const an = gastgeber.teppich === true
  const [abgetaucht, setAbgetaucht] = React.useState(false)
  const paar = s.sichtbar.paar
  const belege = React.useMemo(() => belegReihenfolge(paar?.antwort?.belege ?? []), [paar])
  // T4: die Auswahl der Suche, sobald der Server sie meldet (retrieval_complete).
  const kandidaten = React.useMemo(() => kandidatenAusSchritten(s.k.schritte), [s.k.schritte])
  const ablauf = useTeppichAblauf(an, { laeuft: s.k.laeuft, fehler: s.k.fehler !== null, hatAntwort: belege.length > 0 })
  const fragt = ablauf.phase === 'sucht' || ablauf.phase === 'landet'
  // Eine Frage laeuft: die Graph-Ansicht weicht, sonst saehe man die Antwort nicht entstehen.
  React.useEffect(() => { if (fragt) setAbgetaucht(false) }, [fragt])
  const graphZu = React.useCallback(() => setAbgetaucht(false), [])
  useZurueckTaste(gastgeber.zurueckTaste, an && abgetaucht, graphZu)
  const szene = React.useMemo(() => new TeppichSzene(), [])
  // Erklaert den Rechenweg in Worten, zum Schluss die Storyline (Owner 22.11.2026).
  const botschaft = useTeppichBotschaft(ablauf.phase, s.k.schritte, kandidaten.length, belege.length)
  if (!an) return { rahmen: {} }
  return {
    rahmen: {
      teppich: (
        <WebsiteTeppichEbene
          instanz={gastgeber.instanz} libraryId={libraryId} abgetaucht={abgetaucht} onAbgetaucht={setAbgetaucht}
          onDokument={onDokument} phase={ablauf.phase} belege={belege} kandidaten={kandidaten} onGelandet={ablauf.gelandet} szene={szene}
          botschaft={botschaft} animation={animation} fest={fest}
        />
      ),
      abgetaucht,
      fragt,
      fest,
    },
    // Der Graph-Knopf der Antwort: Vordergrund weg, die Wolke zum Erkunden frei.
    graphZeigen: () => setAbgetaucht(true),
  }
}
