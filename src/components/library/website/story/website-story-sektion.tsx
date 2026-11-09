'use client'

/**
 * Die Story-Sektion der Website-Landingpage (Welle N1, Plan
 * website-story-sektion): der Chat der Library auf der Startseite —
 * Beispielfragen als Kacheln, sichtbare Eingabe, darunter NUR das juengste
 * Frage-Antwort-Paar (Owner 08.11.2026: wie eine Suche, nicht wie ein Chat;
 * aeltere Fragen erreicht der Verweis in den Story-Modus). „Erst fragen, dann
 * einstellen": kein Dialog beim Betreten, Perspektive nur per Knopf, Belege als Blatt.
 *
 * Dritter Gastgeber der Story-Bausteine (nach Galerie-Mitte und Embed):
 * komponiert `@ks/module-story`, kopiert nichts aus `StoryRoot`. Der
 * Konversationsblock mit den Karten-Darstellungen (`cards=column|inline`,
 * Owner 09.11.2026) liegt in `website-story-konversation.tsx`; der Marker
 * `rules=<name>` waehlt den Regelsatz der Library fuer diese Sektion.
 */

import { useCallback, useMemo, useState } from 'react'
import { useSetAtom } from 'jotai'
import { useUser } from '@clerk/nextjs'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { chatReferencesAtom } from '@ks/module-explorer/react'
import { StoryEingabeInline, type Nachricht } from '@ks/module-story/react'
import type { HeadingCase, WebsiteSection } from '@/lib/website/types'
import type { SiteThemeResolved } from '@/lib/website/site-theme'
import { storyBloecke } from '@/lib/website/story-section'
import { eintragsBezeichnung, type BezeichnungQuelle } from '@/lib/website/eintrags-bezeichnung'
import { PerspektiveDialogApp } from '@/components/library/story/perspektive-dialog-app'
import { useProfilPerspektive } from '@/hooks/use-profil-perspektive'
import { StoryFragenKacheln, WebsiteStorySektionRahmen } from './website-story-sektion-rahmen'
import { WebsiteStoryBelege } from './website-story-belege'
import type { WebsiteStoryNavigation } from './use-website-story-navigation'
import { useBelegDokumente, useWebsiteStory, type BelegeBlatt } from './use-website-story'
import { StoryStatus } from './website-story-status'
import { StoryPopulaereFragen } from './website-story-populaer'
import { WebsiteStoryKonversation } from './website-story-konversation'

export interface WebsiteStorySektionProps {
  libraryId: string
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  navigation: WebsiteStoryNavigation
  /** Galerie-Texte der Library (`publicPublishing.gallery`): Bezeichnung der Eintraege (`itemLabel`/`itemLabelPlural`). */
  galleryTexte?: BezeichnungQuelle
}

export function WebsiteStorySektion(p: WebsiteStorySektionProps) {
  const { t } = useTranslation()
  const { isSignedIn } = useUser()
  const s = useWebsiteStory(p.libraryId, p.section.filter, p.section.rules)
  const profil = useProfilPerspektive()
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [text, setText] = useState('')
  const [perspektiveOffen, setPerspektiveOffen] = useState(false)
  const [blatt, setBlatt] = useState<BelegeBlatt | null>(null)
  const [blattOffen, setBlattOffen] = useState(false)
  const belegDocs = useBelegDokumente(p.libraryId, blatt?.references ?? [], s.sessionHeaders)
  const bloecke = useMemo(() => storyBloecke(p.section), [p.section])
  const fragen = bloecke.fragen
  // Bezeichnung der Eintraege (Owner 09.11.2026): „Vortraege" statt „Quellen", einsprachig je Library.
  const bezeichnung = useMemo(() => eintragsBezeichnung(p.galleryTexte, t), [p.galleryTexte, t])

  const senden = useCallback(
    (frage: string) => {
      const f = frage.trim()
      if (!f || s.k.laeuft) return
      setText('')
      void s.k.frageSenden(f)
    },
    [s.k],
  )

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

  const anzahl = s.paare.length
  const status = <StoryStatus anzahl={anzahl} filter={p.section.filter} />
  const kopf = (
    <Button variant="outline" size="sm" className="gap-2" onClick={() => setPerspektiveOffen(true)} data-story-perspektive-knopf>
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      {t('website.story.anpassen')}
    </Button>
  )

  let inhalt
  if (s.loading) inhalt = <p className="mt-4 text-sm text-neutral-500">{t('website.story.laden')}</p>
  else if (s.error) inhalt = <p className="mt-4 text-sm text-destructive" role="alert">{s.error}</p>
  else {
    const konversation = anzahl > 0 || s.k.laeuft || s.k.fehler
    inhalt = (
      <>
        <StoryFragenKacheln fragen={fragen} onFrage={senden} gesperrt={s.k.laeuft} />
        {bloecke.populaer !== null && <StoryPopulaereFragen libraryId={p.libraryId} n={bloecke.populaer} onFrage={senden} gesperrt={s.k.laeuft} />}
        {konversation && (
          <WebsiteStoryKonversation
            libraryId={p.libraryId}
            s={s}
            navigation={p.navigation}
            cards={p.section.cards ?? 'hidden'}
            bezeichnung={bezeichnung}
            markenAnfangsVerborgen={p.section.citationsVisible !== true}
            isSignedIn={isSignedIn === true}
            onText={setText}
            onBelege={belegeOeffnen}
          />
        )}
        <StoryEingabeInline
          className="mt-6"
          text={text}
          setText={setText}
          onSenden={() => senden(text)}
          laeuft={s.k.laeuft}
          antwortLaenge={s.k.antwortLaenge}
          setAntwortLaenge={s.k.setAntwortLaenge}
          placeholder={p.section.placeholder ?? s.cfg?.config.placeholder}
        />
      </>
    )
  }

  return (
    <>
      <WebsiteStorySektionRahmen section={p.section} headingCase={p.headingCase} theme={p.theme} status={status} kopf={kopf}>
        {inhalt}
      </WebsiteStorySektionRahmen>
      {perspektiveOffen && <PerspektiveDialogApp open={perspektiveOffen} onOpenChange={setPerspektiveOffen} onProfil={profil.speichern} darstellung="blatt" />}
      {blatt && (
        <WebsiteStoryBelege
          libraryId={p.libraryId}
          offen={blattOffen}
          onOpenChange={setBlattOffen}
          references={blatt.references}
          usedDocs={belegDocs}
          katalogAnzahl={s.katalogAnzahl}
          navigation={p.navigation}
          markenFarbe={p.theme?.accentInk}
          titel={bezeichnung.blattTitel}
        />
      )}
    </>
  )
}
