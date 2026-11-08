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
 * komponiert `@ks/module-story`, kopiert nichts aus `StoryRoot`.
 */

import { useCallback, useMemo, useState } from 'react'
import { useSetAtom } from 'jotai'
import { useUser } from '@clerk/nextjs'
import { List, SlidersHorizontal } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { chatReferencesAtom } from '@ks/module-explorer/react'
import { StoryEingabeInline, StoryKonversation, type AntwortKopfApi, type Nachricht } from '@ks/module-story/react'
import type { HeadingCase, WebsiteSection } from '@/lib/website/types'
import type { SiteThemeResolved } from '@/lib/website/site-theme'
import { storyBloecke } from '@/lib/website/story-section'
import { PerspektiveDialogApp } from '@/components/library/story/perspektive-dialog-app'
import { ChatConfigDisplay } from '@/components/library/chat/chat-config-display'
import { StoryVerarbeitungAufklapper } from '@/components/library/story/story-verarbeitung-aufklapper'
import { AppLogo } from '@/components/shared/app-logo'
import { useProfilPerspektive } from '@/hooks/use-profil-perspektive'
import { StoryFragenKacheln, WebsiteStorySektionRahmen } from './website-story-sektion-rahmen'
import { WebsiteStoryBelege, type WebsiteStoryNavigation } from './website-story-belege'
import { StoryFruehereFragen } from './website-story-fruehere'
import { useBelegDokumente, useWebsiteStory, type BelegeBlatt } from './use-website-story'

export interface WebsiteStorySektionProps {
  libraryId: string
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  navigation: WebsiteStoryNavigation
}

export function WebsiteStorySektion(p: WebsiteStorySektionProps) {
  const { t } = useTranslation()
  const { isSignedIn } = useUser()
  const s = useWebsiteStory(p.libraryId)
  const profil = useProfilPerspektive()
  const setChatReferences = useSetAtom(chatReferencesAtom)
  const [text, setText] = useState('')
  const [perspektiveOffen, setPerspektiveOffen] = useState(false)
  const [blatt, setBlatt] = useState<BelegeBlatt | null>(null)
  const [blattOffen, setBlattOffen] = useState(false)
  const belegDocs = useBelegDokumente(p.libraryId, blatt?.references ?? [], s.sessionHeaders)
  const fragen = useMemo(() => storyBloecke(p.section).fragen, [p.section])

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

  // N5: „Quellen anzeigen" steht in der Kopfzeile der Antwort. Der Klick blendet
  // die Zitatmarken ein (die Plakette „N Quellen zitiert" ist selbst der Umschalter)
  // UND oeffnet die Belege als Blatt von rechts.
  const kopfAktion = useCallback(
    (antwort: Nachricht, api: AntwortKopfApi) => {
      const dokumente = new Set((antwort.belege ?? []).map((b) => b.fileId)).size
      if (dokumente === 0) return null
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          data-story-belege-knopf
          onClick={() => {
            api.setSichtbar(true)
            belegeOeffnen(antwort)
          }}
        >
          <List className="h-4 w-4" aria-hidden="true" />
          {t('website.story.quellenAnzeigenKurz')}
        </Button>
      )
    },
    [belegeOeffnen, t],
  )

  // N5: schlanke Fusszeile — eine dezente Zeile statt KI-Block, Parameter-Liste und
  // Logs/Debug. Perspektive/Modell kommen aus der Query-Anzeige (dezent).
  const fuss = useCallback(
    (antwort: Nachricht) => {
      const dokumente = new Set((antwort.belege ?? []).map((b) => b.fileId)).size
      return (
        <div className="mt-3 border-t border-black/5 pt-2 text-xs text-neutral-500" data-story-antwort-fuss>
          <p>{t('website.story.kiHinweis', { count: dokumente })}</p>
          {antwort.queryId && <ChatConfigDisplay libraryId={p.libraryId} queryId={antwort.queryId} llmModel={s.llmModel} />}
          {/* N5: die Berechnungsschritte bleiben an der fertigen Antwort einsehbar (dezent, nur fuer Angemeldete). */}
          {antwort.queryId && isSignedIn && <StoryVerarbeitungAufklapper libraryId={p.libraryId} queryId={antwort.queryId} />}
        </div>
      )
    },
    [p.libraryId, s.llmModel, t, isSignedIn],
  )

  const anzahl = s.paare.length
  const status = (
    <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--site-accent)]" aria-hidden="true" />
      {anzahl === 0 ? t('website.story.bereit') : anzahl === 1 ? t('website.story.fragenInSitzung.one') : t('website.story.fragenInSitzung.many', { count: anzahl })}
    </span>
  )
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
        {konversation && (
          <div
            className="mt-6"
            data-story-konversation
            // N5: Akzent der Antwort-Bausteine (Deine-Frage-Band, Plakette, umrandete
            // Zitatmarken) folgt dem Grün der Site; ausserhalb der Website gilt die Vorgabe.
            style={{ ['--story-accent' as string]: 'var(--site-accent-strong)', ['--zitat-mark' as string]: 'var(--site-accent-strong)' }}
          >
            <StoryKonversation
              paare={s.sichtbar.paar ? [s.sichtbar.paar] : []}
              laeuft={s.k.laeuft}
              schritte={s.k.schritte}
              fehler={s.k.fehler}
              fehlerDetail={s.k.fehlerDetail}
              onFrage={setText}
              onErneut={setText}
              fuss={fuss}
              kopfAktion={kopfAktion}
              markenAnfangsVerborgen
              antwortAvatar={<AppLogo size={32} />}
            />
            <StoryFruehereFragen fruehere={s.sichtbar.fruehere} navigation={p.navigation} />
          </div>
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
        />
      )}
    </>
  )
}
