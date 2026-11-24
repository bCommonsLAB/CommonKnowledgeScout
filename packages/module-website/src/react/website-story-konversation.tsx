'use client'

/**
 * Konversationsblock der Story-Sektion (aus `website-story-sektion.tsx`
 * herausgeloest, 09.11.2026, Dateigrenze): die juengste Antwort (die Frage
 * steht in der Fragebox darueber, R1 24.11.2026)
 * mit Kopfzeile („N Vortraege zitiert", „Vortraege anzeigen"), Fusszeile und
 * dem Verweis auf fruehere Fragen — plus die Karten-Darstellungen der
 * zitierten Dokumente (Owner 09.11.2026, Figma S2-A/S2-B):
 *
 * - `cards=column`: ab `lg` zwei Spalten, rechts die Kartenspalte (nicht
 *   sticky), darunter ein Raster unter der Antwort.
 * - `cards=inline`: der Antworttext zweispaltig je Absatz (Karte links).
 * - `cards=hidden` (Vorgabe): die heutige Antwort mit Belege-Blatt.
 *
 * Beide Karten-Darstellungen erst bei fertiger Antwort mit Belegen; waehrend
 * die Antwort laeuft, die heutige Darstellung. Nur hier in der Website-
 * Sektion — Story-Modus und Galerie-Chat bleiben unveraendert.
 *
 * WE3: Was unter dem KI-Hinweis steht (Konfig-Anzeige, Verbrauch,
 * Verarbeitung) und das Bild neben der Antwort reicht der Gastgeber herein;
 * der Verweis „fruehere Fragen" geht ueber die Navigation.
 */

import { useCallback, useMemo } from 'react'
import { List, Waypoints } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { DocCardMeta } from '@ks/contracts'
import { AntwortText, StoryKonversation, type AntwortKopfApi, type Nachricht } from '@ks/module-story/react'
import { type StoryCards, type EintragsBezeichnung, type WebsiteNavigation, kartenEintraege } from '..'
import { useBelegDokumenteStand, type WebsiteStoryStand } from './use-website-story'
import type { WebsiteStoryGastgeber } from './website-story-gastgeber'
import { StoryFruehereFragen } from './website-story-fruehere'
import { WebsiteStoryVortragsspalte } from './website-story-vortragsspalte'
import { WebsiteStoryAntwortZweispaltig } from './website-story-antwort-zweispaltig'

export interface WebsiteStoryKonversationProps {
  libraryId: string
  s: WebsiteStoryStand
  gastgeber: WebsiteStoryGastgeber
  navigation: WebsiteNavigation
  cards: StoryCards
  bezeichnung: EintragsBezeichnung
  markenAnfangsVerborgen: boolean
  /** Weiterfrage gewaehlt: Sie fuellt die Fragebox und wird sofort gestellt (R1, wie eine Beispielfrage). */
  onFrage: (text: string) => void
  /** Belege-Blatt zu dieser Antwort oeffnen. */
  onBelege: (antwort: Nachricht) => void
  /** Karte angeklickt: Detailansicht ueber der Startseite (10.11.2026). */
  onDokument: (doc: DocCardMeta) => void
  /**
   * Mit Teppich: die Wolke der Dokumente zum Erkunden freigeben. Stehen die Karten schon neben der
   * Antwort, ersetzt dieser Knopf „Quellen anzeigen" (Owner 23.11.2026: die Liste waere doppelt).
   */
  onGraph?: () => void
}

// Ohne `max-sm:` (die Variante erzeugt dieses Tailwind-Setup nicht): Grundzustand Telefon, ab `sm` zurueck.
const TELEFON = '[&_[data-antwort]>div:first-child]:hidden sm:[&_[data-antwort]>div:first-child]:block [&_[data-antwort-laeuft]>div:first-child]:hidden sm:[&_[data-antwort-laeuft]>div:first-child]:block'
const PROSE = 'prose prose-sm max-w-none dark:prose-invert'

export function WebsiteStoryKonversation(p: WebsiteStoryKonversationProps) {
  const { t } = useTranslation()
  const { s, bezeichnung } = p
  const { antwortFuss } = p.gastgeber
  const antwort = s.sichtbar.paar?.antwort
  const belege = useMemo(() => antwort?.belege ?? [], [antwort])
  // Karten erst, wenn die Antwort fertig ist und Belege hat — sonst die heutige Darstellung.
  const kartenAktiv = p.cards !== 'hidden' && antwort !== undefined && !s.k.laeuft && belege.length > 0
  // Solange die Karten laden, stehen Platzhalter — die Ansicht springt nicht nachtraeglich um (10.11.2026).
  const karten = useBelegDokumenteStand(p.gastgeber.instanz, p.libraryId, kartenAktiv ? belege : [], s.sessionHeaders)
  const eintraege = useMemo(() => (kartenAktiv ? kartenEintraege(belege, karten.docs, karten.laedt) : []), [kartenAktiv, belege, karten.docs, karten.laedt])
  const oeffnen = p.onDokument

  // N5: „Quellen anzeigen" (mit der Bezeichnung der Library) steht in der Kopfzeile der
  // Antwort. Der Klick blendet die Zitatmarken ein UND oeffnet die Belege als Blatt.
  const kopfAktion = useCallback(
    (a: Nachricht, api: AntwortKopfApi) => {
      if (new Set((a.belege ?? []).map((b) => b.fileId)).size === 0) return null
      if (p.onGraph && p.cards !== 'hidden') {
        return (
          <Button variant="outline" size="sm" className="gap-1.5" data-story-graph-knopf onClick={p.onGraph}>
            <Waypoints className="h-4 w-4" aria-hidden="true" />
            {t('website.story.graph')}
          </Button>
        )
      }
      return (
        <Button variant="outline" size="sm" className="gap-1.5" data-story-belege-knopf onClick={() => { api.setSichtbar(true); p.onBelege(a) }}>
          <List className="h-4 w-4" aria-hidden="true" />
          {bezeichnung.anzeigen}
        </Button>
      )
    },
    [bezeichnung.anzeigen, p, t],
  )

  // N5: schlanke Fusszeile — eine dezente Zeile statt KI-Block und Parameter-Liste;
  // darunter, was der Gastgeber zeigt (WE3: in der App Konfig-Anzeige, Verbrauch, Verarbeitung).
  const fuss = useCallback(
    (a: Nachricht) => (
      <div className="mt-3 border-t border-black/5 pt-2 text-xs text-neutral-500" data-story-antwort-fuss>
        <p>{t('website.story.kiHinweis', { count: new Set((a.belege ?? []).map((b) => b.fileId)).size })}</p>
        {antwortFuss?.(a)}
      </div>
    ),
    [antwortFuss, t],
  )

  // inline: Absatz-Zeilen mit Karte statt des ganzen Textes — nur fuer die Antwort mit Karten.
  const inline = p.cards === 'inline' && eintraege.length > 0 && antwort !== undefined
  const antwortDarstellung = useCallback(
    (a: Nachricht, markenVerborgen: boolean) =>
      a === antwort ? (
        <WebsiteStoryAntwortZweispaltig antwort={a} markenVerborgen={markenVerborgen} eintraege={eintraege} libraryId={p.libraryId} onOpen={oeffnen} restTitel={bezeichnung.spalte} weitereLabel={bezeichnung.weitere} onWeitere={() => p.onBelege(a)} />
      ) : (
        <AntwortText text={a.text} belege={a.belege} markenVerborgen={markenVerborgen} className={PROSE} />
      ),
    [antwort, eintraege, p, oeffnen, bezeichnung.spalte, bezeichnung.weitere],
  )

  const spalte = p.cards === 'column' && eintraege.length > 0 && antwort !== undefined
  return (
    <div
      // Telefon (R2, 24.11.2026): ohne Bild-Spalte neben der Antwort — volle Lesebreite.
      className={`${TELEFON} ${spalte ? 'mt-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8' : 'mt-6'}`}
      data-story-konversation
      data-story-karten-modus={p.cards}
      // N5: Akzent der Antwort-Bausteine (Deine-Frage-Band, Plakette, umrandete
      // Zitatmarken) folgt dem Gruen der Site; ausserhalb der Website gilt die Vorgabe.
      style={{ ['--story-accent' as string]: 'var(--site-accent-strong)', ['--zitat-mark' as string]: 'var(--site-accent-ink)' }}
    >
      <div className="min-w-0">
        <StoryKonversation
          paare={s.sichtbar.paar ? [s.sichtbar.paar] : []}
          laeuft={s.k.laeuft}
          schritte={s.k.schritte}
          fehler={s.k.fehler}
          fehlerDetail={s.k.fehlerDetail}
          onFrage={p.onFrage}
          ohneFrage
          fuss={fuss}
          kopfAktion={kopfAktion}
          markenAnfangsVerborgen={p.markenAnfangsVerborgen}
          antwortAvatar={p.gastgeber.antwortAvatar}
          quellenPlakette={bezeichnung.zitiert}
          antwortDarstellung={inline ? antwortDarstellung : undefined}
        />
        {kartenAktiv && karten.fehler && (
          // Kein stiller Wegfall der Karten (23.11.2026): Hinweis und erneut laden.
          <div role="alert" className="mt-3 flex items-center gap-3 text-sm text-neutral-600" data-story-belege-fehler>
            <span>{t('website.story.belegeFehler', { label: bezeichnung.spalte })}</span>
            <Button variant="outline" size="sm" onClick={karten.erneut}>{t('website.story.belegeErneut')}</Button>
          </div>
        )}
        <StoryFruehereFragen paare={s.paare} navigation={p.navigation} />
      </div>
      {spalte && (
        <div className="mt-6 min-w-0 lg:mt-0">
          <WebsiteStoryVortragsspalte eintraege={eintraege} libraryId={p.libraryId} titel={bezeichnung.spalte} weitereLabel={bezeichnung.weitere} onWeitere={() => p.onBelege(antwort)} onOpen={oeffnen} />
        </div>
      )}
    </div>
  )
}
