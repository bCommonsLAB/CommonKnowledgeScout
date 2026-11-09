'use client'

/**
 * Konversationsblock der Story-Sektion (aus `website-story-sektion.tsx`
 * herausgeloest, 09.11.2026, Dateigrenze): das juengste Frage-Antwort-Paar
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
 */

import { useCallback, useMemo } from 'react'
import { List } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { GalleryNavigationProvider } from '@ks/module-explorer/react'
import { AntwortText, StoryKonversation, type AntwortKopfApi, type Nachricht } from '@ks/module-story/react'
import type { StoryCards } from '@/lib/website/types'
import type { EintragsBezeichnung } from '@/lib/website/eintrags-bezeichnung'
import { kartenEintraege } from '@/lib/website/story-karten'
import { ChatConfigDisplay } from '@/components/library/chat/chat-config-display'
import { StoryVerarbeitungAufklapper } from '@/components/library/story/story-verarbeitung-aufklapper'
import { AppLogo } from '@/components/shared/app-logo'
import { useBelegDokumente, type WebsiteStoryStand } from './use-website-story'
import { useWebsiteStoryNavigation, type WebsiteStoryNavigation } from './use-website-story-navigation'
import { StoryFruehereFragen } from './website-story-fruehere'
import { WebsiteStoryVortragsspalte } from './website-story-vortragsspalte'
import { WebsiteStoryAntwortZweispaltig } from './website-story-antwort-zweispaltig'

export interface WebsiteStoryKonversationProps {
  libraryId: string
  s: WebsiteStoryStand
  navigation: WebsiteStoryNavigation
  cards: StoryCards
  bezeichnung: EintragsBezeichnung
  markenAnfangsVerborgen: boolean
  isSignedIn: boolean
  /** Anschlussfrage oder „neu stellen": Text in die Eingabe. */
  onText: (text: string) => void
  /** Belege-Blatt zu dieser Antwort oeffnen. */
  onBelege: (antwort: Nachricht) => void
}

const PROSE = 'prose prose-sm max-w-none dark:prose-invert'
const keinSchliessen = () => {}

export function WebsiteStoryKonversation(p: WebsiteStoryKonversationProps) {
  const { t } = useTranslation()
  const { s, bezeichnung } = p
  const antwort = s.sichtbar.paar?.antwort
  const belege = useMemo(() => antwort?.belege ?? [], [antwort])
  // Karten erst, wenn die Antwort fertig ist und Belege hat — sonst die heutige Darstellung.
  const kartenAktiv = p.cards !== 'hidden' && antwort !== undefined && !s.k.laeuft && belege.length > 0
  const kartenDocs = useBelegDokumente(p.libraryId, kartenAktiv ? belege : [], s.sessionHeaders)
  const eintraege = useMemo(() => (kartenAktiv ? kartenEintraege(belege, kartenDocs) : []), [kartenAktiv, belege, kartenDocs])
  const { zurGalerie, nav } = useWebsiteStoryNavigation(p.navigation, keinSchliessen)
  const oeffnen = useCallback((slug: string) => zurGalerie({ doc: slug }), [zurGalerie])

  // N5: „Quellen anzeigen" (mit der Bezeichnung der Library) steht in der Kopfzeile der
  // Antwort. Der Klick blendet die Zitatmarken ein UND oeffnet die Belege als Blatt.
  const kopfAktion = useCallback(
    (a: Nachricht, api: AntwortKopfApi) => {
      if (new Set((a.belege ?? []).map((b) => b.fileId)).size === 0) return null
      return (
        <Button variant="outline" size="sm" className="gap-1.5" data-story-belege-knopf onClick={() => { api.setSichtbar(true); p.onBelege(a) }}>
          <List className="h-4 w-4" aria-hidden="true" />
          {bezeichnung.anzeigen}
        </Button>
      )
    },
    [bezeichnung.anzeigen, p],
  )

  // N5: schlanke Fusszeile — eine dezente Zeile statt KI-Block und Parameter-Liste.
  const fuss = useCallback(
    (a: Nachricht) => (
      <div className="mt-3 border-t border-black/5 pt-2 text-xs text-neutral-500" data-story-antwort-fuss>
        <p>{t('website.story.kiHinweis', { count: new Set((a.belege ?? []).map((b) => b.fileId)).size })}</p>
        {a.queryId && <ChatConfigDisplay libraryId={p.libraryId} queryId={a.queryId} llmModel={s.llmModel} />}
        {/* N5: die Berechnungsschritte bleiben an der fertigen Antwort einsehbar (dezent, nur fuer Angemeldete). */}
        {a.queryId && p.isSignedIn && <StoryVerarbeitungAufklapper libraryId={p.libraryId} queryId={a.queryId} />}
      </div>
    ),
    [p.libraryId, p.isSignedIn, s.llmModel, t],
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
    <GalleryNavigationProvider navigation={nav}>
      <div
        className={spalte ? 'mt-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8' : 'mt-6'}
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
            onFrage={p.onText}
            onErneut={p.onText}
            fuss={fuss}
            kopfAktion={kopfAktion}
            markenAnfangsVerborgen={p.markenAnfangsVerborgen}
            antwortAvatar={<AppLogo size={32} />}
            quellenPlakette={bezeichnung.zitiert}
            antwortDarstellung={inline ? antwortDarstellung : undefined}
          />
          <StoryFruehereFragen paare={s.paare} navigation={p.navigation} />
        </div>
        {spalte && (
          <div className="mt-6 min-w-0 lg:mt-0">
            <WebsiteStoryVortragsspalte eintraege={eintraege} libraryId={p.libraryId} titel={bezeichnung.spalte} weitereLabel={bezeichnung.weitere} onWeitere={() => p.onBelege(antwort)} onOpen={oeffnen} />
          </div>
        )}
      </div>
    </GalleryNavigationProvider>
  )
}
