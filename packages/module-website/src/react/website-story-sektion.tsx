'use client'

/**
 * Die Story-Sektion der Website-Landingpage (Welle N1, Plan
 * website-story-sektion): der Chat der Library auf der Startseite — EINE
 * Fragebox (R1, 24.11.2026), darunter die Beispielfragen und NUR die juengste
 * Antwort (Owner 08.11.2026: wie eine Suche, nicht wie ein Chat; aeltere Fragen
 * erreicht der Verweis in den Story-Modus). Die Box enthaelt die gestellte Frage
 * und bleibt editierbar; jede angebotene Frage (Beispiel, populaer, Thema,
 * Weiterfrage) fuellt die Box und wird sofort gestellt. „Erst fragen, dann
 * einstellen": kein Dialog beim Betreten, Perspektive nur per Knopf, Belege als Blatt.
 *
 * Komponiert `@ks/module-story`, kopiert nichts aus `StoryRoot`. Der Konversationsblock mit den
 * Karten-Darstellungen (`cards=column|inline`) liegt in `website-story-konversation.tsx`; der
 * Marker `rules=<name>` waehlt den Regelsatz der Library fuer diese Sektion.
 *
 * WE3: ohne App-Bindung — den Rest reicht der Gastgeber herein
 * (`WebsiteStoryGastgeber`), jeder Weg hinaus geht ueber `WebsiteNavigation`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSetAtom } from 'jotai'
import { useTranslation } from '@ks/i18n/react'
import type { DocCardMeta } from '@ks/contracts'
import { chatReferencesAtom } from '@ks/module-explorer/react'
import { StoryEingabeInline, type Nachricht } from '@ks/module-story/react'
import {
  type HeadingCase,
  type WebsiteSection,
  type SiteThemeResolved,
  storyBloecke,
  eintragsBezeichnung,
  type BezeichnungQuelle,
  type WebsiteNavigation,
} from '..'
import { getEffectiveDocumentNavigationSlug } from '@ks/util'
import { StoryFragenKacheln, WebsiteStorySektionRahmen } from './website-story-sektion-rahmen'
import { StoryBeispiele } from './website-story-beispiele'
import { StoryFrageLeiste } from './website-story-frage-leiste'
import { useStoryVollbild } from './use-story-vollbild'
import { useFrageAuftrag } from './use-story-frage-auftrag'
import { WebsiteStoryBelege } from './website-story-belege'
import { wegGehen } from './use-website-story-navigation'
import { useBelegDokumente, useWebsiteStory, type BelegeBlatt } from './use-website-story'
import type { WebsiteStoryGastgeber } from './website-story-gastgeber'
import { useStoryTeppich } from './use-story-teppich'
import { StoryStatus } from './website-story-status'
import { StoryPopulaereFragen } from './website-story-populaer'
import { WebsiteStoryKonversation } from './website-story-konversation'

export interface WebsiteStorySektionProps {
  libraryId: string
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  /** WE3: was die Sektion von der Seite braucht, auf der sie steht. */
  gastgeber: WebsiteStoryGastgeber
  navigation: WebsiteNavigation
  /** Galerie-Texte der Library (`publicPublishing.gallery`): Bezeichnung der Eintraege (`itemLabel`/`itemLabelPlural`). */
  galleryTexte?: BezeichnungQuelle
}

export function WebsiteStorySektion(p: WebsiteStorySektionProps) {
  const { t } = useTranslation()
  const { gastgeber, navigation } = p
  const s = useWebsiteStory(gastgeber, p.libraryId, p.section.filter, p.section.rules)
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [text, setText] = useState('')
  const [perspektiveOffen, setPerspektiveOffen] = useState(false)
  const [blatt, setBlatt] = useState<BelegeBlatt | null>(null)
  const [blattOffen, setBlattOffen] = useState(false)
  const [detail, setDetail] = useState<{ doc: DocCardMeta; page?: number } | null>(null)
  const mitDetail = gastgeber.detail !== undefined
  const dokumentOeffnen = useCallback((doc: DocCardMeta, page?: number) => {
    setBlattOffen(false)
    if (mitDetail) {
      setDetail({ doc, page })
      return
    }
    const slug = getEffectiveDocumentNavigationSlug(doc)
    if (slug) wegGehen(navigation, { art: 'dokument', slug })
    else console.error('[WebsiteStorySektion] Dokument ohne Slug — nichts zu oeffnen', doc)
  }, [mitDetail, navigation])
  const belegDocs = useBelegDokumente(gastgeber.instanz, p.libraryId, blatt?.references ?? [], s.sessionHeaders)
  const bloecke = useMemo(() => storyBloecke(p.section), [p.section])
  // Bezeichnung der Eintraege (Owner 09.11.2026): „Vortraege" statt „Quellen", einsprachig je Library.
  const bezeichnung = useMemo(() => eintragsBezeichnung(p.galleryTexte, t), [p.galleryTexte, t])

  const senden = useCallback(
    (frage: string) => {
      const f = frage.trim()
      if (!f || s.k.laeuft) return
      // Die Frage bleibt in der Box stehen: dort wird sie gelesen, geaendert und neu gestellt.
      setText(f)
      void s.k.frageSenden(f)
    },
    [s.k],
  )
  // Die Box zeigt die Frage zur sichtbaren Antwort — auch nach dem Wiederkommen in die Sitzung.
  const gestellt = s.sichtbar.paar?.frage.text
  useEffect(() => {
    if (gestellt) setText(gestellt)
  }, [gestellt])

  // 18.11.2026: Frage aus der Themen-Sektion (`layout=topics`) — einmal annehmen, hinaufrollen, stellen.
  const anker = useRef<HTMLDivElement>(null)
  useFrageAuftrag(anker, { laedt: s.loading, fehler: Boolean(s.error), laeuft: s.k.laeuft }, senden, setText)

  const belegeOeffnen = useCallback(
    (antwort: Nachricht) => {
      const references = antwort.belege ?? []
      setBlatt({ references, queryId: antwort.queryId ?? null })
      setBlattOffen(true)
      // Die Galerie laedt die zitierten Dokumente nach (additionalDocs), damit `?doc=` sie findet.
      setChatReferences({ references, queryId: antwort.queryId })
    },
    [setChatReferences],
  )

  // T2/T3: Teppich der Dokumente hinter der Sektion (`use-story-teppich.tsx`).
  const teppich = useStoryTeppich(gastgeber, p.libraryId, s, dokumentOeffnen, p.section.animation ?? 'schwarm')
  // R3: auf dem Telefon laeuft die Frage im Vollbild (`use-story-vollbild.ts`).
  const v = useStoryVollbild(anker, s.k.laeuft)
  const platzhalter = p.section.placeholder ?? gastgeber.eingabe.platzhalter
  const anzahl = s.paare.length
  const status = <StoryStatus anzahl={anzahl} filter={p.section.filter} />

  let inhalt
  let eingabe
  if (s.loading) inhalt = <p className="mt-4 text-sm text-neutral-500">{t('website.story.laden')}</p>
  else if (s.error) inhalt = <p className="mt-4 text-sm text-destructive" role="alert">{s.error}</p>
  else {
    const konversation = anzahl > 0 || s.k.laeuft || s.k.fehler
    inhalt = (
      <>
        {!v.vollbild && (bloecke.fragen.length > 0 || bloecke.populaer !== null) && (
          <StoryBeispiele eingeklappt={Boolean(konversation)} frage={gestellt}>
            <StoryFragenKacheln fragen={bloecke.fragen} onFrage={senden} gesperrt={s.k.laeuft} />
            {bloecke.populaer !== null && <StoryPopulaereFragen instanz={gastgeber.instanz} libraryId={p.libraryId} n={bloecke.populaer} onFrage={senden} gesperrt={s.k.laeuft} />}
          </StoryBeispiele>
        )}
        {konversation && (
          <WebsiteStoryKonversation
            libraryId={p.libraryId}
            s={s}
            gastgeber={gastgeber}
            navigation={navigation}
            cards={p.section.cards ?? 'hidden'}
            bezeichnung={bezeichnung}
            markenAnfangsVerborgen={p.section.citationsVisible !== true}
            onFrage={senden}
            onBelege={belegeOeffnen}
            onDokument={dokumentOeffnen}
            onGraph={teppich.graphZeigen}
            onAnpassen={gastgeber.perspektiveDialog ? () => setPerspektiveOffen(true) : undefined}
          />
        )}
      </>
    )
    eingabe = <StoryEingabeInline className={v.vollbild ? '' : 'mt-6'} ohneLaenge={v.vollbild} text={text} setText={setText} onSenden={() => senden(text)} laeuft={s.k.laeuft} antwortLaenge={s.k.antwortLaenge} setAntwortLaenge={s.k.setAntwortLaenge} placeholder={platzhalter} />
  }

  return (
    <>
      {/* Anker fuer Fragen aus der Themen-Sektion: die Seite rollt hierher. */}
      <div ref={anker} className="scroll-mt-4" style={v.platz}>
        <WebsiteStorySektionRahmen section={p.section} headingCase={p.headingCase} theme={p.theme} status={status} {...teppich.rahmen} eingabe={eingabe} vollbild={v.vollbild} onVollbildZu={v.schliessen}>
          {inhalt}
        </WebsiteStorySektionRahmen>
      </div>
      <StoryFrageLeiste anker={anker} text={platzhalter ?? t('chat.input.askQuestion')} aus={v.vollbild || s.loading || Boolean(s.error)} />
      {perspektiveOffen && gastgeber.perspektiveDialog?.({ offen: perspektiveOffen, onOpenChange: setPerspektiveOffen })}
      {blatt && (
        <WebsiteStoryBelege
          libraryId={p.libraryId}
          offen={blattOffen}
          onOpenChange={setBlattOffen}
          references={blatt.references}
          usedDocs={belegDocs}
          katalogAnzahl={s.katalogAnzahl}
          navigation={navigation}
          markenFarbe={p.theme?.accentInk}
          titel={bezeichnung.blattTitel}
          onDokument={dokumentOeffnen}
        />
      )}
      {detail && gastgeber.detail?.({ doc: detail.doc, page: detail.page, onClose: () => setDetail(null) })}
    </>
  )
}
